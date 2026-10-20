// Assistente da Conilon Tech no Telegram — Cloudflare Worker.
// Telegram → webhook → Claude (com ferramentas de leitura do Firestore e propostas de gravação)
// → resposta. Gravações só acontecem quando o usuário toca em ✅ Confirmar.

import Anthropic from '@anthropic-ai/sdk';
import { Firestore } from './firestore.js';
import { Telegram } from './telegram.js';
import { DEFINICOES, Ferramentas, executarProposta } from './ferramentas.js';
import { gerarPedidoPdf } from './pdf.js';
import { SISTEMA } from './prompt.js';
import { transcrever } from './audio.js';

const MAX_HISTORICO = 16;      // mensagens (texto) guardadas por conversa
const MAX_ITERACOES = 10;      // chamadas à API por mensagem do usuário
const VALIDADE_PROPOSTA_MS = 2 * 60 * 60 * 1000;
const FUSO = 'America/Sao_Paulo';
const MAX_AUDIO_S = 300;        // mensagens de voz mais longas que isso são recusadas

export default {
  async fetch(req, env) {
    const url = new URL(req.url);

    // Registro do webhook no Telegram: abrir uma vez no navegador.
    if (req.method === 'GET' && url.pathname === '/configurar') {
      if (url.searchParams.get('chave') !== env.TELEGRAM_WEBHOOK_SECRET) return new Response('Chave inválida', { status: 403 });
      const r = await new Telegram(env.TELEGRAM_TOKEN).configurarWebhook(`${url.origin}/telegram`, env.TELEGRAM_WEBHOOK_SECRET);
      return Response.json(r);
    }

    if (req.method === 'POST' && url.pathname === '/telegram') {
      if (req.headers.get('X-Telegram-Bot-Api-Secret-Token') !== env.TELEGRAM_WEBHOOK_SECRET) return new Response('Proibido', { status: 403 });
      const update = await req.json().catch(() => null);
      if (update) {
        try { await processarUpdate(update, env); }
        catch (e) { console.log('Erro ao processar update', e?.stack || e); }
      }
      // Sempre 200: um erro aqui não deve fazer o Telegram reenviar a mesma mensagem.
      return new Response('ok');
    }

    return new Response('Assistente Conilon Tech ativo.');
  },
};

function usuariosAutorizados(env) {
  try { return JSON.parse(env.TELEGRAM_USUARIOS || '{}'); } catch { return {}; }
}

async function carregarPerfil(fs, email) {
  const r = await fs.query('usuarios', { filtros: [{ campo: 'email', op: 'EQUAL', valor: email }], limite: 1 });
  const u = r[0];
  if (!u || u.ativo === false) return null;
  return u;
}

function agoraTexto() {
  const d = new Date();
  const data = new Intl.DateTimeFormat('en-CA', { timeZone: FUSO, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
  const dia = new Intl.DateTimeFormat('pt-BR', { timeZone: FUSO, weekday: 'long' }).format(d);
  const hora = new Intl.DateTimeFormat('pt-BR', { timeZone: FUSO, hour: '2-digit', minute: '2-digit' }).format(d);
  return `${data} (${dia}), ${hora}`;
}

async function processarUpdate(update, env) {
  const tg = new Telegram(env.TELEGRAM_TOKEN);
  const msg = update.message;
  const cb = update.callback_query;
  const chatId = String(msg?.chat?.id ?? cb?.message?.chat?.id ?? '');
  if (!chatId) return;

  const email = usuariosAutorizados(env)[chatId];
  if (!email) {
    if (msg) await tg.enviar(chatId, `Este chat ainda não está autorizado.\nSeu ID do Telegram é: ${chatId}\nPeça ao administrador para cadastrá-lo no assistente.`);
    else if (cb) await tg.responderBotao(cb.id, 'Chat não autorizado.');
    return;
  }

  const fs = new Firestore(env);
  const convRef = `assistenteConversas/${chatId}`;
  const conv = (await fs.get(convRef)) || {};

  // O Telegram reenvia o update se demorarmos; processa cada um uma única vez.
  if ((conv.ultimoUpdate || 0) >= update.update_id) return;
  await fs.set(convRef, { ultimoUpdate: update.update_id, email });

  const perfil = await carregarPerfil(fs, email);
  if (!perfil) {
    if (msg) await tg.enviar(chatId, `Não encontrei um usuário ativo com o e-mail ${email} no app.`);
    else await tg.responderBotao(cb.id, 'Usuário inativo.');
    return;
  }

  if (cb) return tratarBotao(cb, chatId, conv, convRef, perfil, email, fs, tg);

  const audio = msg.voice || msg.audio || msg.video_note;
  if (audio) {
    if ((audio.duration || 0) > MAX_AUDIO_S) {
      await tg.enviar(chatId, `Áudio muito longo (máx. ${MAX_AUDIO_S / 60} min). Pode dividir em partes menores?`);
      return;
    }
    await tg.digitando(chatId);
    let transcricao, talhoes;
    try {
      talhoes = await fs.query('talhoes', { limite: 2000 });
      const nomes = [...new Set(talhoes.flatMap(t => [t.fazenda, t.nome]).filter(Boolean))].join(', ');
      transcricao = await transcrever(env.AI, await tg.baixarArquivo(audio.file_id), nomes);
    } catch (e) {
      await tg.enviar(chatId, `⚠️ Não consegui entender o áudio (${e.message}). Pode mandar de novo ou escrever?`);
      return;
    }
    if (!transcricao) {
      await tg.enviar(chatId, 'Não ouvi nada no áudio. 🤔 Pode repetir?');
      return;
    }
    // Mostra o que foi entendido: o usuário percebe na hora se a transcrição errou um nome ou número.
    await tg.enviar(chatId, `🎤 «${transcricao}»`);
    await tg.digitando(chatId);
    const texto = `${transcricao}\n(mensagem de voz transcrita automaticamente — nomes e números podem ter saído errados; se algo essencial parecer estranho, pergunte)`;
    await conversar(texto, chatId, conv, convRef, perfil, email, fs, tg, env, talhoes);
    return;
  }

  const texto = (msg.text || '').trim();
  if (!texto) {
    await tg.enviar(chatId, 'Eu entendo mensagens de texto e de voz. 🙂');
    return;
  }
  if (texto === '/start' || texto === '/ajuda') {
    await tg.enviar(chatId, `Olá, ${perfil.nome || email}! 👋\nPode me mandar texto ou áudio 🎤 e perguntar qualquer coisa do app — programação da semana, estoque, chuva, irrigação, aplicações por talhão… — e pedir agendamentos de pulverização ou pedidos de produto. Antes de gravar eu sempre peço sua confirmação.\n\n/limpar — começa uma conversa nova`);
    return;
  }
  if (texto === '/limpar') {
    await fs.set(convRef, { historico: [], notas: [] });
    await tg.enviar(chatId, '🧹 Conversa reiniciada.');
    return;
  }

  await tg.digitando(chatId);
  await conversar(texto, chatId, conv, convRef, perfil, email, fs, tg, env);
}

async function conversar(texto, chatId, conv, convRef, perfil, email, fs, tg, env, talhoes = null) {
  const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
  const ferramentas = new Ferramentas(fs, perfil);
  if (talhoes) ferramentas._talhoes = talhoes;

  // Histórico guardado só como texto (sem blocos de raciocínio), então pode ser truncado à vontade.
  const historico = Array.isArray(conv.historico) ? conv.historico : [];
  const notas = Array.isArray(conv.notas) ? conv.notas : [];
  const cabecalho = [`[Agora: ${agoraTexto()} · Usuário: ${perfil.nome || email}]`, ...notas.map(n => `[${n}]`)].join('\n');
  const msgUsuario = `${cabecalho}\n${texto}`;

  const messages = [];
  for (const h of historico) {
    const ultima = messages[messages.length - 1];
    if (ultima && ultima.role === h.role) ultima.content += `\n\n${h.texto}`;
    else messages.push({ role: h.role, content: h.texto });
  }
  if (messages.length && messages[0].role !== 'user') messages.shift();
  if (messages.length && messages[messages.length - 1].role === 'user') messages.pop();
  messages.push({ role: 'user', content: msgUsuario });

  let resposta = '';
  for (let i = 0; i < MAX_ITERACOES; i++) {
    const r = await client.beta.messages.create({
      model: env.MODELO || 'claude-opus-5-5',
      max_tokens: 16000,
      system: SISTEMA,
      tools: DEFINICOES,
      messages,
      thinking: { type: 'adaptive' },
      output_config: { effort: env.ESFORCO || 'medium' },
      cache_control: { type: 'ephemeral' },
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
    });

    if (r.stop_reason === 'refusal') {
      resposta = 'Desculpe, não consigo ajudar com isso.';
      break;
    }

    const usos = r.content.filter(b => b.type === 'tool_use');
    if (r.stop_reason !== 'tool_use' || !usos.length) {
      resposta = r.content.filter(b => b.type === 'text').map(b => b.text).join('\n').trim();
      if (r.stop_reason === 'max_tokens') resposta += '\n\n(resposta cortada)';
      break;
    }

    messages.push({ role: 'assistant', content: r.content });
    await tg.digitando(chatId);
    const resultados = await Promise.all(usos.map(async u => {
      try {
        return { type: 'tool_result', tool_use_id: u.id, content: await ferramentas.executar(u.name, u.input || {}) };
      } catch (e) {
        return { type: 'tool_result', tool_use_id: u.id, content: `Erro: ${e.message}`, is_error: true };
      }
    }));
    messages.push({ role: 'user', content: resultados });
  }
  if (!resposta) resposta = ferramentas.propostas.length ? 'Confira o resumo abaixo e confirme.' : 'Desculpe, não consegui concluir essa consulta. Tente perguntar de outro jeito.';

  await tg.enviar(chatId, resposta);

  for (const p of ferramentas.propostas) {
    const id = await fs.add('assistentePropostas', { ...p, chatId, email, status: 'pendente', criadoEm: new Date().toISOString() });
    await tg.enviar(chatId, p.resumo, {
      reply_markup: { inline_keyboard: [[{ text: '✅ Confirmar', callback_data: `ok:${id}` }, { text: '❌ Cancelar', callback_data: `no:${id}` }]] },
    });
  }

  const novo = [...historico, { role: 'user', texto: msgUsuario }, { role: 'assistant', texto: resposta }].slice(-MAX_HISTORICO);
  await fs.set(convRef, { historico: novo, notas: [], atualizadoEm: new Date().toISOString() });
}

async function tratarBotao(cb, chatId, conv, convRef, perfil, email, fs, tg) {
  const [acao, id] = String(cb.data || '').split(':');
  const msgId = cb.message?.message_id;
  const prop = id ? await fs.get(`assistentePropostas/${id}`) : null;
  if (!prop || prop.chatId !== chatId) {
    await tg.responderBotao(cb.id, 'Proposta não encontrada.');
    return;
  }
  if (prop.status !== 'pendente') {
    await tg.responderBotao(cb.id, `Essa proposta já foi ${prop.status}.`);
    return;
  }
  const notas = Array.isArray(conv.notas) ? conv.notas : [];

  if (acao === 'no') {
    await fs.set(`assistentePropostas/${id}`, { status: 'cancelada', resolvidoEm: new Date().toISOString() });
    await tg.responderBotao(cb.id, 'Cancelado.');
    await tg.editarTexto(chatId, msgId, `${prop.resumo}\n\n❌ Cancelado — nada foi gravado.`);
    await fs.set(convRef, { notas: [...notas, `O usuário CANCELOU a proposta: ${prop.resumo.split('\n')[0]}`] });
    return;
  }
  if (acao !== 'ok') return;

  if (Date.now() - Date.parse(prop.criadoEm) > VALIDADE_PROPOSTA_MS) {
    await fs.set(`assistentePropostas/${id}`, { status: 'expirada' });
    await tg.responderBotao(cb.id, 'Proposta expirada.');
    await tg.editarTexto(chatId, msgId, `${prop.resumo}\n\n⌛ Expirou — peça de novo se ainda quiser.`);
    return;
  }

  // Marca antes de gravar para um toque duplo não gravar duas vezes.
  await fs.set(`assistentePropostas/${id}`, { status: 'confirmada', resolvidoEm: new Date().toISOString() });
  try {
    const ids = await executarProposta(fs, perfil, email, perfil._id, prop);
    await fs.set(`assistentePropostas/${id}`, { status: 'gravada', docIds: ids });
    await tg.responderBotao(cb.id, 'Gravado!');
    await tg.editarTexto(chatId, msgId, `${prop.resumo}\n\n✅ Gravado no app.`);
    await fs.set(convRef, { notas: [...notas, `O usuário CONFIRMOU e foi gravado no app: ${prop.resumo.split('\n')[0]}`] });
    // Pedido confirmado → gera e envia o PDF completo para encaminhar ao comprador.
    if (prop.tipo === 'pedido') {
      try {
        const dadosPed = prop.docs?.[0]?.dados || {};
        const bytes = await gerarPedidoPdf(dadosPed, { criadoPor: email, dataISO: new Date().toISOString() });
        const nome = `Pedido-insumos-${new Date().toISOString().slice(0, 10)}.pdf`;
        await tg.enviarDocumento(chatId, bytes, nome, 'Pedido de insumos — encaminhe ao responsável pela compra.');
      } catch (e) {
        console.log('PDF do pedido falhou: ' + (e?.message || e));
        await tg.enviar(chatId, 'O pedido foi gravado, mas não consegui gerar o PDF agora.');
      }
    }
  } catch (e) {
    await fs.set(`assistentePropostas/${id}`, { status: 'erro', erro: e.message });
    await tg.responderBotao(cb.id, 'Erro ao gravar.');
    await tg.editarTexto(chatId, msgId, `${prop.resumo}\n\n⚠️ Não foi gravado: ${e.message}`);
  }
}
