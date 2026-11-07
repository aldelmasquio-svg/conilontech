// Testes das notificações push do Worker (assistente/src/notificacoes.js): detecção dos eventos,
// quem recebe e uma execução completa do cron com Firestore e FCM falsos.
// Rodar: node testes/notificacoes.test.mjs
import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import {
  detectarIrrigacao, detectarChuva, detectarAdubacao, detectarPulverizacao,
  usuarioRecebe, verificarNotificacoes, agoraLocal, dataPlanejadaAp,
} from '../assistente/src/notificacoes.js';

let ok = 0;
const t = (nome, fn) => Promise.resolve().then(fn).then(() => { ok++; }, e => { console.error('✗', nome); throw e; });
const ms = s => Date.parse(s);

await t('agoraLocal usa o fuso de Brasília', () => {
  assert.deepEqual(agoraLocal(new Date('2026-11-07T02:30:00Z')), { dia: '2026-11-06', hora: 23, min: 30, hhmm: '23:30' });
});

await t('irrigação: avisa só depois da tolerância e uma vez', () => {
  const r = { _id: 'r1', status: 'aberto', horaFim: '', data: '2026-11-07', horaInicio: '06:00', horaFimPrevista: '14:00', setorNome: 'S1', talhaoNome: 'T1', fazenda: 'Km 18' };
  assert.equal(detectarIrrigacao([r], ms('2026-11-07T14:05:00-03:00')).length, 0);
  const ev = detectarIrrigacao([r], ms('2026-11-07T14:11:00-03:00'));
  assert.equal(ev.length, 1);
  assert.match(ev[0].corpo, /14:00/);
  assert.equal(ev[0].marcar[0].caminho, 'irrigacaoRegistros/r1');
  assert.equal(detectarIrrigacao([{ ...r, avisoAtrasoEm: 'x' }], ms('2026-11-07T14:11:00-03:00')).length, 0);
  assert.equal(detectarIrrigacao([{ ...r, status: 'concluido' }], ms('2026-11-07T14:11:00-03:00')).length, 0);
  // esquecido há mais de 1 dia: não avisa
  assert.equal(detectarIrrigacao([r], ms('2026-11-09T14:11:00-03:00')).length, 0);
});

await t('irrigação: turno que vira a noite termina no dia seguinte', () => {
  const r = { _id: 'r2', status: 'aberto', data: '2026-11-07', horaInicio: '22:00', horaFimPrevista: '06:00' };
  assert.equal(detectarIrrigacao([r], ms('2026-11-07T23:00:00-03:00')).length, 0);
  assert.equal(detectarIrrigacao([r], ms('2026-11-08T06:15:00-03:00')).length, 1);
});

await t('chuva: agrupa por fazenda e soma mês/ano do pluviômetro', () => {
  const hist = [
    { _id: 'a', fazenda: 'Km 18', pluviometro: 'Principal', data: '2026-10-30', mm: 40 },
    { _id: 'b', fazenda: 'Km 18', pluviometro: 'Principal', data: '2026-11-02', mm: 10 },
    { _id: 'c', fazenda: 'Km 18', pluviometro: 'Principal', data: '2026-11-07', mm: 22.5 },
    { _id: 'd', fazenda: 'Outra', data: '2026-11-07', mm: 0 },
  ];
  const ev = detectarChuva([hist[2], hist[3]], hist, Date.now());
  assert.equal(ev.length, 1);
  assert.equal(ev[0].fazenda, 'Km 18');
  assert.match(ev[0].corpo, /22,5 mm em 07\/11/);
  assert.match(ev[0].corpo, /nov: 32,5 mm/);
  assert.match(ev[0].corpo, /2026: 72,5 mm/);
  assert.equal(detectarChuva([{ ...hist[2], avisoEnviadoEm: 'x' }], hist, Date.now()).length, 0);
});

await t('adubação: só aplicações que venceram desde a última checagem', () => {
  const planos = [
    { fazenda: 'Km 18', talhaoNome: 'T1', mesAno: 'Novembro/2026', aplicacoes: [{ semana: '1ª Semana' }, { semana: '2ª Semana' }] },
    { fazenda: 'Km 18', talhaoNome: 'T2', mesAno: '2026-11', aplicacoes: [{ semana: '1ª Semana', feito: true }] },
    { fazenda: 'Km 18', talhaoNome: 'T3', mesAno: 'Outubro/2026', aplicacoes: [{ semana: '4ª Semana' }] },
  ];
  assert.equal(dataPlanejadaAp(planos[0], planos[0].aplicacoes[0]), '2026-11-05');
  const ev = detectarAdubacao(planos, '2026-11-05', '2026-11-06');
  assert.equal(ev.length, 1);
  assert.match(ev[0].corpo, /^1 talhão/);
  assert.match(ev[0].corpo, /T1 \(1ª sem\.\)/);
  assert.equal(detectarAdubacao(planos, '2026-11-06', '2026-11-07').length, 0);
});

await t('pulverização: programada não realizada que venceu', () => {
  const pulvs = [
    { fazenda: 'A', talhaoNome: 'T1', data: '2026-11-06', realizada: false },
    { fazenda: 'A', talhaoNome: 'T2', data: '2026-11-06', realizada: true },
    { fazenda: 'A', talhaoNome: 'T3', data: '2026-11-07' },
  ];
  const ev = detectarPulverizacao(pulvs, '2026-11-06', '2026-11-07');
  assert.equal(ev.length, 1);
  assert.equal(ev[0].corpo, 'T1 (prog. 06/11)');
});

await t('quem recebe: marcado no Admin + acesso ao módulo + fazenda', () => {
  const ev = { tipo: 'chuva', fazenda: 'Km 18' };
  assert.equal(usuarioRecebe({ modulos: { irrigacao: 'operador' } }, ev), false);                      // não marcado
  assert.equal(usuarioRecebe({ notificacoes: { chuva: true }, modulos: {} }, ev), false);              // sem módulo irrigação
  assert.equal(usuarioRecebe({ notificacoes: { chuva: true }, modulos: { irrigacao: 'operador' } }, ev), true);
  assert.equal(usuarioRecebe({ notificacoes: { chuva: true }, modulos: { irrigacao: 'operador' }, fazendasModulo: { irrigacao: ['Outra'] } }, ev), false);
  assert.equal(usuarioRecebe({ notificacoes: { chuva: true }, modulos: { irrigacao: 'operador' }, fazendasModulo: { irrigacao: ['Km 18'] } }, ev), true);
  assert.equal(usuarioRecebe({ notificacoes: { chuva: true }, modulos: { irrigacao: 'operador' }, ativo: false }, ev), false);
  assert.equal(usuarioRecebe({ notificacoes: { chuva: true }, perfil: 'admin', fazendasModulo: { irrigacao: ['Outra'] } }, ev), true);
  // pulverização é "aberta por padrão": sem o módulo no perfil ainda recebe
  assert.equal(usuarioRecebe({ notificacoes: { pulverizacao: true }, modulos: {} }, { tipo: 'pulverizacao', fazenda: 'A' }), true);
});

// ── execução completa com Firestore/FCM falsos ──
class DbFalso {
  constructor(cols) {
    this.cols = cols; this.gravados = {}; this.removidos = [];
    const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
    this.sa = { client_email: 'x@y', private_key: privateKey.export({ type: 'pkcs8', format: 'pem' }) };
    this.projeto = 'demo';
  }
  async query(col, { filtros = [] } = {}) {
    return (this.cols[col] || []).filter(d => filtros.every(f =>
      f.op === 'EQUAL' ? d[f.campo] === f.valor : f.op === 'GREATER_THAN_OR_EQUAL' ? String(d[f.campo] ?? '') >= f.valor : true));
  }
  async get(c) { return this.gravados[c] || null; }
  async set(c, dados) { this.gravados[c] = { ...(this.gravados[c] || {}), ...dados }; }
  async remove(c) { this.removidos.push(c); const [col, id] = c.split('/'); this.cols[col] = (this.cols[col] || []).filter(d => d._id !== id); }
}

await t('cron: envia para os aparelhos certos, apaga token inválido e não repete', async () => {
  const enviados = [];
  globalThis.fetch = async (url, opts) => {
    if (String(url).includes('oauth2')) return new Response(JSON.stringify({ access_token: 'tk', expires_in: 3600 }));
    const m = JSON.parse(opts.body).message;
    if (m.token === 'morto') return new Response(JSON.stringify({ error: { status: 'NOT_FOUND', details: [{ errorCode: 'UNREGISTERED' }] } }), { status: 404 });
    enviados.push(m);
    return new Response('{}');
  };
  const db = new DbFalso({
    usuarios: [
      { _id: 'u1', notificacoes: { irrigacao: true, pulverizacao: true }, modulos: { irrigacao: 'operador' } },
      { _id: 'u2', modulos: { irrigacao: 'operador' } },                        // não marcado
    ],
    pushTokens: [
      { _id: 'k1', uid: 'u1', token: 'web1', plataforma: 'web' },
      { _id: 'k2', uid: 'u1', token: 'and1', plataforma: 'android' },
      { _id: 'k3', uid: 'u1', token: 'morto', plataforma: 'web' },
      { _id: 'k4', uid: 'u2', token: 'web2', plataforma: 'web' },
    ],
    irrigacaoRegistros: [{ _id: 'r1', status: 'aberto', data: '2026-11-07', horaInicio: '06:00', horaFimPrevista: '14:00', fazenda: 'Km 18' }],
    pulverizacoes: [{ _id: 'p1', data: '2026-11-06', realizada: false, fazenda: 'Km 18', talhaoNome: 'T1' }],
    notificacoesTeste: [{ _id: 'x', uid: 'u2' }],
  });
  const r = await verificarNotificacoes(db, new Date('2026-11-07T14:30:00-03:00'));
  assert.equal(r.eventos, 3);                                   // teste + irrigação + pulverização
  assert.deepEqual(r.erros, []);
  assert.equal(enviados.filter(m => m.token === 'web2').length, 1);   // u2 só recebe o teste
  assert.equal(enviados.filter(m => m.token === 'web1').length, 2);
  const and = enviados.find(m => m.token === 'and1');
  assert.ok(and.android.notification.title);
  assert.ok(enviados.find(m => m.token === 'web1').webpush);
  assert.ok(db.removidos.includes('pushTokens/k3'));
  assert.ok(db.removidos.includes('notificacoesTeste/x'));
  assert.ok(db.gravados['irrigacaoRegistros/r1'].avisoAtrasoEm);
  assert.equal(db.gravados['notificacoesEstado/diario'].ultimoDia, '2026-11-07');

  // 5 min depois: nada novo (irrigação marcada; atrasadas já checadas hoje)
  db.cols.irrigacaoRegistros[0].avisoAtrasoEm = 'x';
  enviados.length = 0;
  const r2 = await verificarNotificacoes(db, new Date('2026-11-07T14:35:00-03:00'));
  assert.equal(r2.eventos, 0);
  assert.equal(enviados.length, 0);
});

await t('cron: atrasadas só a partir das 7h', async () => {
  globalThis.fetch = async () => new Response(JSON.stringify({ access_token: 'tk' }));
  const db = new DbFalso({ pulverizacoes: [{ _id: 'p1', data: '2026-11-06', fazenda: 'A' }] });
  const r = await verificarNotificacoes(db, new Date('2026-11-07T06:00:00-03:00'));
  assert.equal(r.eventos, 0);
  assert.equal(db.gravados['notificacoesEstado/diario'], undefined);
});

console.log(`✓ ${ok} testes de notificações passaram`);
