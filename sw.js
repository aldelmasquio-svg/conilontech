// Service worker do Conilon Tech: deixa o app instalável e abrindo com sinal fraco.
// - Arquivos do próprio site: rede primeiro (deploy aparece na hora); se a rede falhar
//   ou demorar mais que TIMEOUT_MS, usa a cópia guardada.
// - Bibliotecas de CDN com versão fixa (Firebase, Leaflet, Chart.js, fontes...): cache
//   primeiro, porque nunca mudam.
// - Firestore/Auth e o resto não passam por aqui: os dados offline já são do Firebase
//   (enableMultiTabIndexedDbPersistence).
// Ao mudar a lista de pré-cache ou a estratégia, suba a VERSAO para descartar o cache antigo.
const VERSAO = 'v1';
const CACHE_APP = 'conilon-app-' + VERSAO;
const CACHE_CDN = 'conilon-cdn-v1';
const TIMEOUT_MS = 4000;
const PRECACHE = ['./', 'index.html', 'login.html', 'style.css', 'acesso.js', 'menu.js',
  'manifest.webmanifest', 'icones/icone-192.png'];
const CDN = new Set(['unpkg.com', 'cdn.jsdelivr.net', 'cdnjs.cloudflare.com', 'cdn.sheetjs.com',
  'fonts.googleapis.com', 'fonts.gstatic.com']);

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE_APP).then(c => c.addAll(PRECACHE)).catch(() => {}));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(ks => Promise.all(ks.filter(k => k !== CACHE_APP && k !== CACHE_CDN).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin === self.location.origin) { e.respondWith(redePrimeiro(req)); return; }
  const cdn = CDN.has(url.hostname) || (url.hostname === 'www.gstatic.com' && url.pathname.startsWith('/firebasejs/'));
  if (cdn) e.respondWith(cachePrimeiro(req));
});

async function redePrimeiro(req) {
  const cache = await caches.open(CACHE_APP);
  const rede = fetch(req).then(r => { if (r.ok) cache.put(req, r.clone()); return r; });
  const guardado = await cache.match(req, { ignoreSearch: req.mode === 'navigate' });
  if (!guardado) return rede;
  const limite = new Promise(res => setTimeout(() => res(guardado), TIMEOUT_MS));
  return Promise.race([rede.catch(() => guardado), limite]);
}

async function cachePrimeiro(req) {
  const cache = await caches.open(CACHE_CDN);
  const guardado = await cache.match(req);
  if (guardado) return guardado;
  const r = await fetch(req);
  if (r.ok || r.type === 'opaque') cache.put(req, r.clone());
  return r;
}
