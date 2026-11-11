// Escreve no Firestore com a conta de serviço (Admin SDK) — mesmas coleções e o mesmo
// "shape" que o app usa, pra tudo aparecer igual em recebimentos.html e estoque.html.
import admin from 'firebase-admin';
import fs from 'node:fs';

const normalizar = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();
const agoraISO = () => new Date().toISOString();

let db = null;
export function iniciar(cfg) {
  if (db) return db;
  // service account: caminho em cfg.servskcontaPath OU JSON na env FIREBASE_SERVICE_ACCOUNT
  let cred;
  if (process.env.FIREBASE_SERVICE_ACCOUNT) cred = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  else cred = JSON.parse(fs.readFileSync(cfg.serviceAccountPath, 'utf8'));
  admin.initializeApp({ credential: admin.credential.cert(cred) });
  db = admin.firestore();
  return db;
}

// ── dedup de mensagens já processadas (sobrevive a reinício/reenvio) ──
export async function jaProcessada(msgId) {
  const ref = db.collection('roboWhatsappProcessados').doc(String(msgId));
  // create atômico: se já existe, não processa de novo
  try { await ref.create({ em: agoraISO() }); return false; }
  catch { return true; }
}

// ── fazendas do app (pra casar nomes do relatório) ──
let _fazendas = null;
async function fazendasApp() {
  if (_fazendas) return _fazendas;
  const snap = await db.collection('talhoes').get();
  const set = new Set();
  snap.forEach(d => { const f = d.data().fazenda; if (f) set.add(f); });
  _fazendas = [...set];
  return _fazendas;
}
// Devolve o nome EXATO da fazenda no app (ou null se não casar). Usa alias do config.
export async function resolverFazenda(nome, cfg) {
  if (!nome) return null;
  const alias = (cfg.fazendaAlias || {});
  const direto = alias[nome] || alias[normalizar(nome)];
  const lista = await fazendasApp();
  const n = normalizar(direto || nome);
  return lista.find(f => normalizar(f) === n) || (direto && lista.includes(direto) ? direto : null);
}

// ── recebimento (mesmo shape de salvarRecebimento() em recebimentos.html) ──
export async function criarRecebimento(doc) {
  const ref = await db.collection('recebimentos').add({ ...doc, origem: 'whatsapp', criadoEm: agoraISO() });
  return ref.id;
}

// ── estoque: produto por (fazenda + nome normalizado), cria se não existir ──
async function acharOuCriarProduto(fazenda, nome, unidade, criadoPor) {
  const snap = await db.collection('estoque_produtos').where('fazenda', '==', fazenda).get();
  const n = normalizar(nome);
  let achado = null;
  snap.forEach(d => { if (!achado && normalizar(d.data().nome) === n) achado = { _docId: d.id, ...d.data() }; });
  if (achado) return achado;
  const novo = { fazenda, nome, nomeNormalizado: n, unidade: unidade || 'un', saldo: 0, criadoPor, criadoEm: agoraISO() };
  const ref = await db.collection('estoque_produtos').add(novo);
  return { _docId: ref.id, ...novo };
}

// compra → uma entrada no estoque por item (mesmo shape do estoque.html)
export async function lancarEstoqueCompra(fazenda, itens, meta) {
  for (const it of itens) {
    const p = await acharOuCriarProduto(fazenda, it.produto, it.unidade, meta.criadoPor);
    await db.collection('estoque_movimentacoes').add({
      fazenda, produtoId: p._docId, produtoNome: p.nome, unidade: p.unidade || it.unidade || 'un',
      tipo: 'entrada', quantidade: it.quantidade, motivo: 'Compra (WhatsApp)',
      observacao: meta.obs || '', data: meta.data, criadoPor: meta.criadoPor, criadoEm: agoraISO(),
      origem: 'whatsapp', recebimentoId: meta.recebimentoId,
    });
    await db.collection('estoque_produtos').doc(p._docId).update({ saldo: (p.saldo || 0) + it.quantidade });
  }
}

// transferência → saída na origem + entrada no destino (mesmo shape de lancarTransfEstoque)
export async function lancarEstoqueTransferencia(origem, destino, itens, meta) {
  for (const it of itens) {
    const pO = await acharOuCriarProduto(origem, it.produto, it.unidade, meta.criadoPor);
    const pD = await acharOuCriarProduto(destino, it.produto, it.unidade || pO.unidade, meta.criadoPor);
    const base = {
      unidade: pO.unidade || it.unidade || 'un', quantidade: it.quantidade, data: meta.data,
      observacao: `Transferência (WhatsApp)${meta.transportador ? ' · transp.: ' + meta.transportador : ''}`,
      origem: 'whatsapp', recebimentoId: meta.recebimentoId, criadoPor: meta.criadoPor, criadoEm: agoraISO(),
    };
    const saida = await db.collection('estoque_movimentacoes').add({ ...base, fazenda: origem, produtoId: pO._docId, produtoNome: pO.nome, tipo: 'transferencia_saida', motivo: `Transferência para ${destino}`, fazendaDestino: destino });
    const entrada = await db.collection('estoque_movimentacoes').add({ ...base, fazenda: destino, produtoId: pD._docId, produtoNome: pD.nome, unidade: pD.unidade || base.unidade, tipo: 'transferencia_entrada', motivo: `Transferência recebida de ${origem}`, fazendaOrigem: origem, movimentacaoPar: saida.id });
    await db.collection('estoque_movimentacoes').doc(saida.id).update({ movimentacaoPar: entrada.id });
    await db.collection('estoque_produtos').doc(pO._docId).update({ saldo: (pO.saldo || 0) - it.quantidade });
    await db.collection('estoque_produtos').doc(pD._docId).update({ saldo: (pD.saldo || 0) + it.quantidade });
  }
}
