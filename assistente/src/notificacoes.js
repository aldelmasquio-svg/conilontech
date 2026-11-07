// Notificações push (cron do Worker, a cada 5 min). Só no EVENTO, uma vez cada:
//  - irrigacao:    turno de rega aberto que passou da hora prevista de terminar (+ tolerância)
//  - chuva:        lançamento novo no pluviômetro (mm > 0), com acumulado do mês e do ano
//  - adubacao:     aplicação que ficou atrasada (data planejada = ontem, ou desde a última checagem)
//  - pulverizacao: pulverização programada que ficou atrasada (idem)
// Atrasadas seguem a regra do sistema (pendência = data < hoje), checadas uma vez por dia a
// partir das 7h. Quem recebe: o dono marca em Admin (usuarios.notificacoes[tipo] = true);
// o envio respeita o acesso ao módulo e as fazendas do usuário (fazendasModulo).
// Aparelhos: pushTokens/{id} {uid, token, plataforma:'web'|'android'}, gravados pelas páginas.
// O envio é pelo FCM HTTP v1 com a mesma conta de serviço do Firestore.

import { podeAbrir, adminDoSistema } from '../../acesso.js';
import { tokenAcesso } from './firestore.js';

export const FUSO = 'America/Sao_Paulo';
export const TOLERANCIA_IRRIGACAO_MIN = 10;
export const HORA_ATRASADAS = 7;                 // a partir de que hora (local) avisa as atrasadas
const DIAS_SEMANA_ADUBACAO = [5, 12, 19, 26];    // mesmo de gestao.html (_dataPlanejadaAp)
const SEMANAS = ['1ª Semana', '2ª Semana', '3ª Semana', '4ª Semana'];
const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
export const MODULO_DO_TIPO = { adubacao: 'adubacao', pulverizacao: 'pulverizacao', irrigacao: 'irrigacao', chuva: 'irrigacao' };

// ── datas no fuso da fazenda ──
export function agoraLocal(d = new Date()) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: FUSO, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
    .formatToParts(d).map(x => [x.type, x.value]));
  return { dia: `${p.year}-${p.month}-${p.day}`, hora: Number(p.hour), min: Number(p.minute), hhmm: `${p.hour}:${p.minute}` };
}
export function somaDias(iso, n) {
  const d = new Date(iso + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
const fmtData = iso => { const [a, m, d] = String(iso).split('-'); return `${d}/${m}`; };
const semAcento = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const fmtMm = n => (Math.round(n * 10) / 10).toLocaleString('pt-BR');

// Mesmo critério de gestao.html _planoMesAno / index.html planoMesAno.
export function planoMesAno(p) {
  const s = String(p.mesAno || '');
  let m = s.match(/^(\d{4})-(\d{2})/);
  if (m) return { mesIdx: Number(m[2]) - 1, ano: Number(m[1]) };
  m = s.match(/^([^/]+)\/(\d{4})$/);
  if (m) { const i = MESES.findIndex(n => semAcento(n) === semAcento(m[1])); if (i >= 0) return { mesIdx: i, ano: Number(m[2]) }; }
  if (Number.isInteger(p.mesIdx) && p.mesIdx >= 0 && p.mesIdx <= 11 && p.ano) return { mesIdx: p.mesIdx, ano: Number(p.ano) };
  return null;
}
export function dataPlanejadaAp(plano, ap) {
  const ma = planoMesAno(plano); if (!ma) return null;
  const i = SEMANAS.findIndex(x => String(ap.semana || '').startsWith(x));
  const dia = DIAS_SEMANA_ADUBACAO[i >= 0 ? i : 0];
  return `${ma.ano}-${String(ma.mesIdx + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
}

// ── detecção (funções puras: dados → eventos) ──
// Evento: { tipo, fazenda, titulo, corpo, url, marcar?: [{caminho, campos}] }

// Fim previsto do turno em ms (turno que vira a noite termina no dia seguinte).
function fimPrevistoMs(r) {
  if (!r.data || !/^\d{2}:\d{2}$/.test(r.horaFimPrevista || '')) return null;
  const dia = (r.horaInicio && r.horaFimPrevista < r.horaInicio) ? somaDias(r.data, 1) : r.data;
  return Date.parse(`${dia}T${r.horaFimPrevista}:00-03:00`);
}
export function detectarIrrigacao(abertos, agoraMs) {
  const ev = [];
  for (const r of abertos) {
    if (r.status !== 'aberto' || r.horaFim || r.avisoAtrasoEm) continue;
    const fim = fimPrevistoMs(r); if (fim == null) continue;
    const passou = agoraMs - fim;
    // Turnos esquecidos há mais de 1 dia não geram aviso (evita enxurrada na 1ª execução).
    if (passou < TOLERANCIA_IRRIGACAO_MIN * 60000 || passou > 24 * 3600000) continue;
    const onde = [r.setorNome && `Setor ${r.setorNome}`, r.talhaoNome].filter(Boolean).join(' · ') || 'Setor';
    ev.push({
      tipo: 'irrigacao', fazenda: r.fazenda || '',
      titulo: '💦 Irrigação passou da hora',
      corpo: `${onde}${r.fazenda ? ` (${r.fazenda})` : ''}: previsto terminar às ${r.horaFimPrevista} e o turno ainda não foi finalizado.`,
      url: 'irrigacao.html',
      marcar: [{ caminho: `irrigacaoRegistros/${r._id}`, campos: { avisoAtrasoEm: new Date(agoraMs).toISOString() } }],
    });
  }
  return ev;
}

// novos: lançamentos recentes ainda não avisados; historico: todos os da(s) fazenda(s) (p/ acumulado)
export function detectarChuva(novos, historico, agoraMs) {
  const pend = novos.filter(p => !p.avisoEnviadoEm && Number(p.mm) > 0 && p.data);
  const porFaz = {};
  pend.forEach(p => (porFaz[p.fazenda || ''] = porFaz[p.fazenda || ''] || []).push(p));
  return Object.entries(porFaz).map(([faz, lst]) => {
    lst.sort((a, b) => String(a.data).localeCompare(String(b.data)));
    const linhas = lst.map(p => {
      const pluv = p.pluviometro || 'Principal';
      const doPluv = historico.filter(h => (h.fazenda || '') === faz && (h.pluviometro || 'Principal') === pluv);
      const soma = pref => doPluv.filter(h => String(h.data || '').startsWith(pref)).reduce((a, h) => a + (Number(h.mm) || 0), 0);
      const mesNome = MESES[Number(p.data.slice(5, 7)) - 1].slice(0, 3).toLowerCase();
      const varios = new Set(historico.filter(h => (h.fazenda || '') === faz).map(h => h.pluviometro || 'Principal')).size > 1;
      return `${fmtMm(Number(p.mm))} mm em ${fmtData(p.data)}${varios ? ` (${pluv})` : ''} · acumulado ${mesNome}: ${fmtMm(soma(p.data.slice(0, 7)))} mm · ${p.data.slice(0, 4)}: ${fmtMm(soma(p.data.slice(0, 4)))} mm`;
    });
    return {
      tipo: 'chuva', fazenda: faz,
      titulo: `🌧️ Chuva${faz ? ` — ${faz}` : ''}`,
      corpo: linhas.join('\n'),
      url: 'irrigacao.html',
      marcar: lst.map(p => ({ caminho: `pluviometria/${p._id}`, campos: { avisoEnviadoEm: new Date(agoraMs).toISOString() } })),
    };
  });
}

// Atrasadas que "venceram" desde a última checagem: data em [desde, hoje).
export function detectarAdubacao(planos, desde, hoje) {
  const porFaz = {};
  for (const p of planos) {
    for (const ap of (p.aplicacoes || [])) {
      if (ap.feito) continue;
      const dp = dataPlanejadaAp(p, ap);
      if (!dp || dp < desde || dp >= hoje) continue;
      const faz = p.fazenda || '';
      const g = (porFaz[faz] = porFaz[faz] || {});
      const nome = p.talhaoNome || p.talhaoId || 'Talhão';
      (g[nome] = g[nome] || new Set()).add(String(ap.semana || '').replace(' Semana', ' sem.') || fmtData(dp));
    }
  }
  return Object.entries(porFaz).map(([faz, tals]) => {
    const itens = Object.entries(tals).sort((a, b) => a[0].localeCompare(b[0], 'pt-BR', { numeric: true }));
    return {
      tipo: 'adubacao', fazenda: faz,
      titulo: `🧪 Adubação atrasada${faz ? ` — ${faz}` : ''}`,
      corpo: `${itens.length} talhão(ões) sem confirmar: ` + itens.map(([n, s]) => `${n} (${[...s].join(', ')})`).join(' · '),
      url: 'adubacoes.html',
    };
  });
}
export function detectarPulverizacao(pulvs, desde, hoje) {
  const porFaz = {};
  for (const p of pulvs) {
    if (p.realizada || !p.data || p.data < desde || p.data >= hoje) continue;
    (porFaz[p.fazenda || ''] = porFaz[p.fazenda || ''] || []).push(p);
  }
  return Object.entries(porFaz).map(([faz, lst]) => {
    lst.sort((a, b) => a.data.localeCompare(b.data) || String(a.talhaoNome).localeCompare(String(b.talhaoNome), 'pt-BR', { numeric: true }));
    return {
      tipo: 'pulverizacao', fazenda: faz,
      titulo: `💧 Pulverização atrasada${faz ? ` — ${faz}` : ''}`,
      corpo: lst.map(p => `${p.talhaoNome || 'Talhão'} (prog. ${fmtData(p.data)})`).join(' · '),
      url: 'pulverizacoes.html',
    };
  });
}

// ── quem recebe ──
export function usuarioRecebe(u, ev) {
  if (!u || u.ativo === false || !u.notificacoes?.[ev.tipo]) return false;
  const mod = MODULO_DO_TIPO[ev.tipo];
  if (!podeAbrir(u, mod)) return false;
  if (adminDoSistema(u) || !ev.fazenda) return true;
  const faz = u.fazendasModulo?.[mod];
  return !faz || !faz.length || faz.includes(ev.fazenda);
}

// ── envio (FCM HTTP v1) ──
async function enviarFcm(sa, projeto, tk, ev) {
  // Sem tag (exceto o teste): dois avisos do mesmo tipo não se substituem na tela.
  const dados = { titulo: ev.titulo, corpo: ev.corpo, url: ev.url || 'index.html', tag: ev.tag || '' };
  const message = { token: tk.token, data: dados };
  if (tk.plataforma === 'android') {
    message.android = { priority: 'high', notification: { title: ev.titulo, body: ev.corpo, ...(ev.tag ? { tag: ev.tag } : {}) } };
  } else {
    message.webpush = { headers: { Urgency: 'high', TTL: '86400' } };
  }
  const at = await tokenAcesso(sa);
  const r = await fetch(`https://fcm.googleapis.com/v1/projects/${projeto}/messages:send`, {
    method: 'POST', headers: { Authorization: `Bearer ${at}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ message }),
  });
  if (r.ok) return 'ok';
  const j = await r.json().catch(() => ({}));
  const code = j.error?.details?.find(x => x.errorCode)?.errorCode || j.error?.status || r.status;
  // Aparelho desinstalou/revogou: apaga o token
  if (r.status === 404 || code === 'UNREGISTERED' || (r.status === 400 && /registration token/i.test(j.error?.message || ''))) return 'invalido';
  throw new Error(`FCM ${code}: ${j.error?.message || ''}`.slice(0, 200));
}

async function entregar(db, eventos) {
  if (!eventos.length) return { enviados: 0, erros: [] };
  const [usuarios, tokens] = await Promise.all([
    db.query('usuarios', { limite: 1000 }),
    db.query('pushTokens', { limite: 2000 }),
  ]);
  const porUid = {};
  tokens.forEach(t => { if (t.uid && t.token) (porUid[t.uid] = porUid[t.uid] || []).push(t); });
  let enviados = 0; const erros = []; const invalidos = new Set();
  for (const ev of eventos) {
    for (const u of usuarios) {
      if (!(ev.uids ? ev.uids.includes(u._id) : usuarioRecebe(u, ev))) continue;
      for (const tk of (porUid[u._id] || [])) {
        if (invalidos.has(tk._id)) continue;
        try {
          const res = await enviarFcm(db.sa, db.projeto, tk, ev);
          if (res === 'invalido') { invalidos.add(tk._id); await db.remove(`pushTokens/${tk._id}`); }
          else enviados++;
        } catch (e) { erros.push(String(e.message || e)); }
      }
    }
  }
  return { enviados, erros };
}

async function marcar(db, eventos) {
  for (const ev of eventos) for (const m of (ev.marcar || [])) {
    try { await db.set(m.caminho, m.campos); } catch (e) { console.log('marcar', m.caminho, e.message); }
  }
}

// ── execução do cron ──
export async function verificarNotificacoes(db, agora = new Date()) {
  const loc = agoraLocal(agora);
  const agoraMs = agora.getTime();
  const eventos = [];

  // Testes pedidos pelo app (botão "Enviar teste"): vão só para o próprio usuário
  const testes = await db.query('notificacoesTeste', { limite: 20 });
  for (const t of testes) {
    await db.remove(`notificacoesTeste/${t._id}`);
    if (t.uid) eventos.push({ tipo: 'teste', uids: [t.uid], titulo: '🔔 Teste do Conilon Tech', corpo: 'As notificações estão funcionando neste aparelho.', url: 'index.html', tag: 'teste' });
  }

  const abertos = await db.query('irrigacaoRegistros', { filtros: [{ campo: 'status', op: 'EQUAL', valor: 'aberto' }], limite: 300 });
  eventos.push(...detectarIrrigacao(abertos, agoraMs));

  const desdeChuva = new Date(agoraMs - 48 * 3600000).toISOString();
  const recentes = await db.query('pluviometria', { filtros: [{ campo: 'criadoEm', op: 'GREATER_THAN_OR_EQUAL', valor: desdeChuva }], limite: 200 });
  if (recentes.some(p => !p.avisoEnviadoEm && Number(p.mm) > 0)) {
    const fazs = [...new Set(recentes.map(p => p.fazenda || ''))];
    const historico = [];
    for (const f of fazs) historico.push(...await db.query('pluviometria', { filtros: [{ campo: 'fazenda', op: 'EQUAL', valor: f }], limite: 5000 }));
    eventos.push(...detectarChuva(recentes, historico, agoraMs));
  }

  // Atrasadas: uma vez por dia, a partir das 7h
  let estadoDiario = null;
  if (loc.hora >= HORA_ATRASADAS) {
    const est = await db.get('notificacoesEstado/diario');
    if (!est || est.ultimoDia !== loc.dia) {
      // Desde o último dia checado (no máx. 3 dias atrás); 1ª vez: só o que venceu ontem.
      let desde = est?.ultimoDia || somaDias(loc.dia, -1);
      if (desde < somaDias(loc.dia, -3)) desde = somaDias(loc.dia, -3);
      const [planos, pulvs] = await Promise.all([
        db.query('planosAdubacao', { limite: 5000 }),
        db.query('pulverizacoes', { filtros: [{ campo: 'data', op: 'GREATER_THAN_OR_EQUAL', valor: desde }], limite: 2000 }),
      ]);
      eventos.push(...detectarAdubacao(planos, desde, loc.dia), ...detectarPulverizacao(pulvs, desde, loc.dia));
      estadoDiario = { ultimoDia: loc.dia, em: agora.toISOString() };
    }
  }

  // Marca antes de enviar: se o envio falhar, não repete o aviso a cada 5 min.
  await marcar(db, eventos);
  if (estadoDiario) await db.set('notificacoesEstado/diario', estadoDiario);
  const { enviados, erros } = await entregar(db, eventos);
  if (eventos.length) {
    await db.set('notificacoesEstado/ultimo', {
      em: agora.toISOString(), eventos: eventos.length, enviados,
      resumo: eventos.map(e => e.titulo).slice(0, 20), erros: erros.slice(0, 5),
    });
  }
  return { eventos: eventos.length, enviados, erros };
}
