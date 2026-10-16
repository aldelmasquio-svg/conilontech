// Acesso ao Firestore via REST com a conta de serviço (mesma do coletor do clima).
// Workers não rodam o Admin SDK, então o token OAuth é gerado aqui (JWT RS256 via WebCrypto).

let _token = null; // { valor, expira }

function b64url(bytes) {
  let s = '';
  const arr = bytes instanceof Uint8Array ? bytes : new TextEncoder().encode(bytes);
  for (let i = 0; i < arr.length; i++) s += String.fromCharCode(arr[i]);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function tokenAcesso(sa) {
  const agora = Math.floor(Date.now() / 1000);
  if (_token && _token.expira - 60 > agora) return _token.valor;
  const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claims = b64url(JSON.stringify({
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/datastore',
    aud: 'https://oauth2.googleapis.com/token',
    iat: agora,
    exp: agora + 3600,
  }));
  const pem = sa.private_key.replace(/-----[^-]+-----/g, '').replace(/\s+/g, '');
  const der = Uint8Array.from(atob(pem), c => c.charCodeAt(0));
  const chave = await crypto.subtle.importKey('pkcs8', der, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
  const assinatura = new Uint8Array(await crypto.subtle.sign('RSASSA-PKCS1-v1_5', chave, new TextEncoder().encode(`${header}.${claims}`)));
  const jwt = `${header}.${claims}.${b64url(assinatura)}`;
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`,
  });
  const j = await r.json();
  if (!r.ok) throw new Error(`Falha ao autenticar no Firebase: ${j.error_description || j.error || r.status}`);
  _token = { valor: j.access_token, expira: agora + (j.expires_in || 3600) };
  return _token.valor;
}

// ── Conversão de valores Firestore REST <-> JS ──
export function deValor(v) {
  if (v == null) return null;
  if ('stringValue' in v) return v.stringValue;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue' in v) return v.doubleValue;
  if ('booleanValue' in v) return v.booleanValue;
  if ('nullValue' in v) return null;
  if ('timestampValue' in v) return v.timestampValue;
  if ('referenceValue' in v) return v.referenceValue;
  if ('geoPointValue' in v) return v.geoPointValue;
  if ('bytesValue' in v) return '[bytes]';
  if ('arrayValue' in v) return (v.arrayValue.values || []).map(deValor);
  if ('mapValue' in v) return deCampos(v.mapValue.fields || {});
  return null;
}
function deCampos(f) {
  const o = {};
  for (const k of Object.keys(f)) o[k] = deValor(f[k]);
  return o;
}
export function paraValor(x) {
  if (x === null || x === undefined) return { nullValue: null };
  if (typeof x === 'boolean') return { booleanValue: x };
  if (typeof x === 'number') return Number.isInteger(x) ? { integerValue: String(x) } : { doubleValue: x };
  if (typeof x === 'string') return { stringValue: x };
  if (Array.isArray(x)) return { arrayValue: { values: x.map(paraValor) } };
  if (typeof x === 'object') return { mapValue: { fields: paraCampos(x) } };
  return { stringValue: String(x) };
}
function paraCampos(o) {
  const f = {};
  for (const k of Object.keys(o)) if (o[k] !== undefined) f[k] = paraValor(o[k]);
  return f;
}

export class Firestore {
  constructor(env) {
    this.sa = JSON.parse(env.FIREBASE_SERVICE_ACCOUNT);
    this.projeto = env.FIREBASE_PROJECT_ID || this.sa.project_id;
    this.base = `https://firestore.googleapis.com/v1/projects/${this.projeto}/databases/(default)/documents`;
  }

  async _req(url, opts = {}) {
    const tk = await tokenAcesso(this.sa);
    const r = await fetch(url, { ...opts, headers: { Authorization: `Bearer ${tk}`, 'Content-Type': 'application/json', ...(opts.headers || {}) } });
    if (r.status === 404 && (!opts.method || opts.method === 'GET')) return null;
    const j = await r.json().catch(() => ({}));
    if (!r.ok) {
      const e = new Error(j.error?.message || `Firestore HTTP ${r.status}`);
      e.status = j.error?.status || r.status;
      throw e;
    }
    return j;
  }

  _caminho(c) {
    return String(c).split('/').filter(Boolean).map(encodeURIComponent).join('/');
  }

  _doc(d) {
    return { _id: d.name.split('/').pop(), ...deCampos(d.fields || {}) };
  }

  async get(caminho) {
    const d = await this._req(`${this.base}/${this._caminho(caminho)}`);
    return d ? this._doc(d) : null;
  }

  // colecao pode ser uma subcoleção: "clima/estacao-km18/resumos"
  async query(colecao, { filtros = [], ordem = null, direcao = 'ASCENDING', limite = 50 } = {}) {
    const partes = String(colecao).split('/').filter(Boolean);
    const colId = partes.pop();
    const pai = partes.length ? `${this.base}/${this._caminho(partes.join('/'))}` : this.base;
    const sq = { from: [{ collectionId: colId }] };
    const conds = filtros.map(f => ({ fieldFilter: { field: { fieldPath: f.campo }, op: f.op, value: paraValor(f.valor) } }));
    if (conds.length === 1) sq.where = conds[0];
    else if (conds.length > 1) sq.where = { compositeFilter: { op: 'AND', filters: conds } };
    if (ordem) sq.orderBy = [{ field: { fieldPath: ordem }, direction: direcao }];
    if (limite) sq.limit = limite;
    const res = await this._req(`${pai}:runQuery`, { method: 'POST', body: JSON.stringify({ structuredQuery: sq }) });
    return (res || []).filter(x => x.document).map(x => this._doc(x.document));
  }

  async add(colecao, dados) {
    const d = await this._req(`${this.base}/${this._caminho(colecao)}`, { method: 'POST', body: JSON.stringify({ fields: paraCampos(dados) }) });
    return d.name.split('/').pop();
  }

  // Cria/atualiza só os campos informados (merge), como setDoc(..., {merge:true}).
  async set(caminho, dados) {
    const mask = Object.keys(dados).map(k => `updateMask.fieldPaths=${encodeURIComponent(k)}`).join('&');
    await this._req(`${this.base}/${this._caminho(caminho)}?${mask}`, { method: 'PATCH', body: JSON.stringify({ fields: paraCampos(dados) }) });
  }
}
