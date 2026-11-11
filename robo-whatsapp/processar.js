// Liga o parser à escrita: cada bloco válido vira um recebimento e, se as fazendas
// casarem com o app, também lança no estoque (saldo). Nada se perde: se a fazenda não
// casar, o recebimento é criado mesmo assim (com aviso em obs) e o estoque é pulado.
import { parseRelatorio } from './parser.js';
import * as fb from './firestore.js';

// Processa o texto inteiro de uma mensagem. Retorna um resumo (array de strings) pro log.
export async function processarTexto(texto, cfg) {
  const blocos = parseRelatorio(texto);
  const linhas = [];
  for (const b of blocos) {
    if (!b.ok) { linhas.push(`⚠️ ignorado (${b.motivo}): ${b.raw.split('\n')[0]}`); continue; }
    try { linhas.push(await processarBloco(b, cfg)); }
    catch (e) { linhas.push(`❌ erro ao lançar (${e.message}): ${b.raw.split('\n')[0]}`); }
  }
  return linhas;
}

async function processarBloco(b, cfg) {
  const criadoPor = cfg.criadoPor;
  const data = b.data || new Date().toISOString().slice(0, 10);

  if (b.tipo === 'compra') {
    const faz = await fb.resolverFazenda(b.fazenda, cfg);
    const semEstoque = !faz;
    const obs = semEstoque ? `⚠️ fazenda "${b.fazenda}" não casou com o estoque — confira no app.` : '';
    const recId = await fb.criarRecebimento({
      tipo: 'compra', fazenda: faz || b.fazenda, data, nota: b.nota || '', fornecedor: b.fornecedor || '',
      origemFazenda: '', transportador: '', obs, itens: b.itens, criadoPor, estoqueLancado: !semEstoque,
    });
    if (!semEstoque) await fb.lancarEstoqueCompra(faz, b.itens, { data, criadoPor, obs: 'Compra (WhatsApp)', recebimentoId: recId });
    return `🛒 compra · ${faz || b.fazenda} · ${resumoItens(b.itens)}${semEstoque ? ' · (estoque pulado)' : ' · estoque ok'}`;
  }

  // transferência
  const origem = await fb.resolverFazenda(b.origemFazenda, cfg);
  const destino = await fb.resolverFazenda(b.fazenda, cfg);
  const semEstoque = !origem || !destino;
  const obs = semEstoque ? `⚠️ origem/destino não casou com o estoque (origem "${b.origemFazenda}", destino "${b.fazenda}") — confira no app.` : '';
  const recId = await fb.criarRecebimento({
    tipo: 'transferencia', fazenda: destino || b.fazenda, origemFazenda: origem || b.origemFazenda, data,
    transportador: b.transportador || '', nota: '', fornecedor: '', obs, itens: b.itens, criadoPor, estoqueLancado: !semEstoque,
  });
  if (!semEstoque) await fb.lancarEstoqueTransferencia(origem, destino, b.itens, { data, criadoPor, transportador: b.transportador, recebimentoId: recId });
  return `⇄ transferência · ${origem || b.origemFazenda} → ${destino || b.fazenda} · ${resumoItens(b.itens)}${semEstoque ? ' · (estoque pulado)' : ' · estoque ok'}`;
}

const resumoItens = itens => itens.map(i => `${i.produto} ${i.quantidade}${i.unidade}`).join(', ');
