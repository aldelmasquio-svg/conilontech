// Fotos e localização mandadas no Telegram, guardadas até virarem parte de uma anotação do caderno.
// Cada foto fica num doc de assistenteAnexos (até ~900 KB, como as do caderno.html) e expira em 2 h.

export const VALIDADE_ANEXO_MS = 2 * 60 * 60 * 1000;
const MAX_FOTO_BYTES = 650000;   // dataURI (base64 +33%) abaixo dos ~900 KB que o caderno.html aceita
const MAX_MINI_BYTES = 20000;    // mesma miniatura que o caderno.html guarda na nota

export function paraBase64(bytes) {
  let s = '';
  const passo = 0x8000;
  for (let i = 0; i < bytes.length; i += passo) s += String.fromCharCode.apply(null, bytes.subarray(i, i + passo));
  return btoa(s);
}

// O Telegram já entrega cada foto em vários tamanhos (JPEG): escolhe a maior que cabe
// e a maior miniatura até 20 KB — dispensa redimensionar no Worker.
export function escolherTamanhos(fotos) {
  const lista = [...(fotos || [])].sort((a, b) => (a.width * a.height) - (b.width * b.height));
  if (!lista.length) return null;
  const cabe = f => (f.file_size ? f.file_size <= MAX_FOTO_BYTES : Math.max(f.width, f.height) <= 1280);
  const principal = [...lista].reverse().find(cabe) || lista[0];
  const mini = [...lista].reverse().find(f => f.file_size && f.file_size <= MAX_MINI_BYTES && f !== principal) || lista[0];
  return { principal, mini };
}

export async function guardarFoto(fs, tg, chatId, fotos) {
  const t = escolherTamanhos(fotos);
  if (!t) throw new Error('foto sem tamanhos');
  const bytes = await tg.baixarArquivo(t.principal.file_id);
  if (bytes.length > MAX_FOTO_BYTES * 1.2) throw new Error('foto grande demais');
  const miniBytes = t.mini === t.principal ? null : await tg.baixarArquivo(t.mini.file_id).catch(() => null);
  return fs.add('assistenteAnexos', {
    chatId, tipo: 'foto',
    dataURI: `data:image/jpeg;base64,${paraBase64(bytes)}`,
    miniatura: miniBytes && miniBytes.length <= MAX_MINI_BYTES ? `data:image/jpeg;base64,${paraBase64(miniBytes)}` : null,
    criadoEm: new Date().toISOString(),
  });
}

// Fotos ainda livres deste chat (não reservadas por uma proposta e dentro da validade).
// Uma consulta de um filtro só (sem índice composto); as vencidas são apagadas aqui.
export async function fotosPendentes(fs, chatId) {
  const docs = await fs.query('assistenteAnexos', { filtros: [{ campo: 'chatId', op: 'EQUAL', valor: chatId }], limite: 50 });
  const agora = Date.now();
  const livres = [];
  for (const d of docs) {
    if (agora - Date.parse(d.criadoEm) > VALIDADE_ANEXO_MS) { fs.remove(`assistenteAnexos/${d._id}`).catch(() => {}); continue; }
    if (!d.reservadoPor) livres.push(d);
  }
  return livres.sort((a, b) => String(a.criadoEm).localeCompare(String(b.criadoEm)));
}

// ── Talhão em que um ponto cai (mesma lógica de talhaoDoPonto() do caderno.html) ──
function normLatLngs(coords) {
  return (coords || []).map(c => {
    if (Array.isArray(c)) return [c[0], c[1]];
    if (c && c.lat !== undefined) return [c.lat, c.lng];
    if (c && c.latitude !== undefined) return [c.latitude, c.longitude];
    return c;
  });
}
function pontoNoPoligono(lat, lng, coords) {
  const pts = normLatLngs(coords);
  let dentro = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const yi = pts[i][0], xi = pts[i][1], yj = pts[j][0], xj = pts[j][1];
    const inter = ((yi > lat) !== (yj > lat)) && (lng < (xj - xi) * (lat - yi) / ((yj - yi) || 1e-12) + xi);
    if (inter) dentro = !dentro;
  }
  return dentro;
}
export function talhaoDoPonto(talhoes, lat, lng) {
  return talhoes.find(t => Array.isArray(t.coordenadas) && t.coordenadas.length >= 3 && pontoNoPoligono(lat, lng, t.coordenadas)) || null;
}

// Localização mandada ao bot: vale por 2 h, para a próxima anotação.
export function localValida(conv) {
  const l = conv?.local;
  return l && l.lat != null && Date.now() - Date.parse(l.em) <= VALIDADE_ANEXO_MS ? l : null;
}
