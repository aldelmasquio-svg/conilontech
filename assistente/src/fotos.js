// Fotos mandadas ao bot → caderno de campo (cadernoFotos), no mesmo formato de caderno.html:
// o arquivo ORIGINAL em pedaços base64 na subcoleção cadernoFotos/{id}/partes/{0..n-1}, e no doc
// da foto uma prévia leve (dataURI) + miniatura. Enquanto a anotação não é confirmada, a foto fica
// "pendente" do chat (notaId vazio, chatPendente = chatId); ao confirmar, é vinculada à nota.

import { Buffer } from 'node:buffer';

const BYTES_POR_PARTE = 700000;           // ~933 KB em base64 (limite do Firestore: 1 MB/doc)
const MAX_BYTES = 20 * 1024 * 1024;       // limite de download da Bot API
const PREVIA_MAX = 500000;                // bytes da prévia (vira ~670 KB de dataURI)
const MINI_MAX = 20000;
const VALIDADE_PENDENTE_MS = 2 * 24 * 60 * 60 * 1000;

// O que dá para guardar desta mensagem: foto comum (o Telegram já reduz) ou imagem mandada como arquivo (original).
export function fotoDaMensagem(msg) {
  if (Array.isArray(msg.photo) && msg.photo.length) {
    const tam = msg.photo.slice().sort((a, b) => (a.width * a.height) - (b.width * b.height));
    const orig = tam[tam.length - 1];
    const previa = tam.filter(p => (p.file_size || 0) <= PREVIA_MAX).pop() || null;
    const mini = tam.find(p => Math.max(p.width, p.height) >= 160 && (p.file_size || 0) <= MINI_MAX) || tam[0];
    return { arquivo: orig, tipo: 'image/jpeg', nome: '', previa, mini, comprimida: true };
  }
  const d = msg.document;
  if (d && /^image\//.test(d.mime_type || '')) {
    const th = d.thumbnail || d.thumb || null;
    return { arquivo: d, tipo: d.mime_type, nome: d.file_name || '', previa: th, mini: th && (th.file_size || 0) <= MINI_MAX ? th : null, comprimida: false };
  }
  return null;
}

// Buffer (nodejs_compat) codifica em código nativo: bem menos CPU do Worker que btoa em JS.
function b64(u8) {
  return Buffer.from(u8.buffer, u8.byteOffset, u8.length).toString('base64');
}

export function fmtBytes(n) {
  return n >= 1048576 ? (n / 1048576).toFixed(1).replace('.', ',') + ' MB' : Math.round(n / 1024) + ' KB';
}

// Guarda a foto como pendente do chat. Idempotente: o id vem do arquivo, então um reenvio do
// mesmo update (ou a mesma foto duas vezes) não duplica. Devolve { nova, tamanho }.
export async function guardarFotoPendente(fs, tg, chatId, email, foto) {
  const id = `tg-${chatId}-${foto.arquivo.file_unique_id}`;
  const existente = await fs.get(`cadernoFotos/${id}`);
  if (existente) return { nova: false, tamanho: existente.original?.tamanho || 0 };
  if ((foto.arquivo.file_size || 0) > MAX_BYTES) throw new Error(`a foto tem ${fmtBytes(foto.arquivo.file_size)}; o Telegram só deixa o bot baixar até 20 MB`);

  const bytes = await tg.baixarArquivo(foto.arquivo.file_id);
  const nPartes = Math.ceil(bytes.length / BYTES_POR_PARTE);
  // Pedaços antes do doc da foto: um doc de foto existente sempre tem o original completo.
  for (let i = 0; i < nPartes; i++) {
    await fs.set(`cadernoFotos/${id}/partes/${i}`, { i, b64: b64(bytes.subarray(i * BYTES_POR_PARTE, (i + 1) * BYTES_POR_PARTE)) });
  }
  const dataUri = async (f, max) => {
    if (!f) return null;
    if (f.file_id === foto.arquivo.file_id && bytes.length <= max) return `data:${foto.tipo};base64,${b64(bytes)}`;
    if ((f.file_size || 0) > max) return null;
    try { return `data:image/jpeg;base64,${b64(await tg.baixarArquivo(f.file_id))}`; } catch { return null; }
  };
  const previa = await dataUri(foto.previa, PREVIA_MAX);
  const mini = foto.mini && foto.mini.file_id === foto.previa?.file_id && (foto.mini.file_size || 0) <= MINI_MAX ? previa : await dataUri(foto.mini, MINI_MAX);
  await fs.set(`cadernoFotos/${id}`, {
    notaId: '', chatPendente: chatId, dataURI: previa, miniatura: mini,
    original: { partes: nPartes, tipo: foto.tipo, tamanho: bytes.length, nome: foto.nome },
    criadoEm: new Date().toISOString(), criadoPor: email, origem: 'telegram',
  });
  await apagarVencidas(fs, chatId).catch(() => {});
  return { nova: true, tamanho: bytes.length };
}

export async function fotosPendentes(fs, chatId) {
  const r = await fs.query('cadernoFotos', { filtros: [{ campo: 'chatPendente', op: 'EQUAL', valor: String(chatId) }], limite: 100 });
  return r.sort((a, b) => String(a.criadoEm).localeCompare(String(b.criadoEm)));
}

async function apagarFoto(fs, f) {
  for (let i = 0; i < (f.original?.partes || 0); i++) await fs.delete(`cadernoFotos/${f._id}/partes/${i}`);
  await fs.delete(`cadernoFotos/${f._id}`);
}

// Pendentes esquecidas (nunca viraram anotação) somem depois de 2 dias.
async function apagarVencidas(fs, chatId) {
  const limite = Date.now() - VALIDADE_PENDENTE_MS;
  for (const f of await fotosPendentes(fs, chatId)) if (Date.parse(f.criadoEm) < limite) await apagarFoto(fs, f);
}

export async function apagarPendentes(fs, chatId) {
  const fotos = await fotosPendentes(fs, chatId);
  for (const f of fotos) await apagarFoto(fs, f);
  return fotos.length;
}

// Ao confirmar a anotação: todas as fotos pendentes do chat (inclusive as que chegaram depois da
// proposta, como o resto de um álbum) passam a ser da nota. Devolve as fotos vinculadas.
export async function vincularPendentes(fs, chatId, notaId) {
  const fotos = await fotosPendentes(fs, chatId);
  for (const f of fotos) await fs.set(`cadernoFotos/${f._id}`, { notaId, chatPendente: '' });
  return fotos;
}
