// Notificações push: ativar no aparelho, renovar o token e pedir um teste.
// Quem recebe o quê é escolhido pelo dono em Admin (usuarios.notificacoes); quem envia é o cron
// do Worker (assistente/src/notificacoes.js), pelo FCM. Cada aparelho fica em pushTokens/{id}.
// - Navegador / site instalado (Android, computador, iPhone ≥ 16.4 instalado na Tela de Início):
//   Web Push via firebase-messaging, usando o nosso sw.js (que mostra a notificação).
// - App Android (Capacitor): plugin nativo PushNotifications, presente só no APK compilado com o
//   google-services.json (secret GOOGLE_SERVICES_JSON — ver app/README.md).
// Carregado sob demanda pelo menu.js (item "🔔 Notificações").
import { getApp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import { getFirestore, doc, setDoc, addDoc, collection } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

export const TIPOS = {
  adubacao:     { ico: '🧪', label: 'Adubação atrasada' },
  pulverizacao: { ico: '💧', label: 'Pulverização atrasada' },
  irrigacao:    { ico: '💦', label: 'Irrigação que passou da hora de terminar' },
  chuva:        { ico: '🌧️', label: 'Chuva lançada no pluviômetro' },
};
const CHAVE_ID = 'conilon-push-id', CHAVE_RENOVADO = 'conilon-push-renovado';
const ls = { get: k => { try { return localStorage.getItem(k); } catch (e) { return null; } },
             set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} } };

const ehIOS = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const instalado = window.matchMedia?.('(display-mode: standalone)').matches || navigator.standalone === true;
function pluginNativo() {
  const c = window.Capacitor;
  if (!c?.isPluginAvailable?.('PushNotifications')) return null;
  return c.Plugins?.PushNotifications || c.registerPlugin?.('PushNotifications') || null;
}

// 'nativo' | 'web' | 'instalar-ios' (iPhone no Safari: precisa instalar antes) | null (sem suporte)
export function suporte() {
  if (window.Capacitor) return pluginNativo() ? 'nativo' : null;
  if (ehIOS && !instalado) return 'instalar-ios';
  if ('Notification' in window && 'serviceWorker' in navigator && 'PushManager' in window) return 'web';
  return null;
}
export function ativadoNeste() {
  const s = suporte();
  if (s === 'web') return Notification.permission === 'granted' && !!ls.get(CHAVE_ID);
  if (s === 'nativo') return !!ls.get(CHAVE_ID);
  return false;
}
export function negadoNeste() { return suporte() === 'web' && Notification.permission === 'denied'; }

async function idDoToken(token) {
  const h = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token)));
  return Array.from(h.slice(0, 20), b => b.toString(16).padStart(2, '0')).join('');
}
async function salvarToken(token, plataforma) {
  const u = getAuth(getApp()).currentUser; if (!u || !token) return;
  const id = await idDoToken(token);
  await setDoc(doc(getFirestore(getApp()), 'pushTokens', id), {
    uid: u.uid, email: u.email || '', token, plataforma,
    aparelho: navigator.userAgent.slice(0, 160), atualizadoEm: new Date().toISOString(),
  });
  ls.set(CHAVE_ID, id); ls.set(CHAVE_RENOVADO, String(Date.now()));
}

async function tokenWeb() {
  const { getMessaging, getToken, isSupported } = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging.js');
  if (!(await isSupported())) throw new Error('Este navegador não aceita notificações.');
  const reg = await navigator.serviceWorker.register('sw.js');
  await navigator.serviceWorker.ready;
  // Sem vapidKey: usa a chave padrão do FCM do projeto.
  return getToken(getMessaging(getApp()), { serviceWorkerRegistration: reg });
}
function tokenNativo(pedirPermissao) {
  const P = pluginNativo();
  return new Promise(async (resolve, reject) => {
    const hs = [];
    const fim = () => hs.forEach(h => Promise.resolve(h).then(x => x?.remove?.()).catch(() => {}));
    try {
      let st = await P.checkPermissions();
      if (st.receive !== 'granted' && pedirPermissao) st = await P.requestPermissions();
      if (st.receive !== 'granted') return reject(new Error('permissao'));
      hs.push(P.addListener('registration', t => { fim(); resolve(t.value); }));
      hs.push(P.addListener('registrationError', e => { fim(); reject(new Error(e?.error || 'Falha ao registrar')); }));
      await P.register();
    } catch (e) { fim(); reject(e); }
  });
}

// App Android: tocar na notificação abre a página do aviso; com o app aberto, o Android não
// mostra a notificação, então aparece uma faixa no topo.
(function ouvirNativo() {
  const P = pluginNativo(); if (!P) return;
  P.addListener('pushNotificationActionPerformed', a => { const url = a?.notification?.data?.url; if (url) location.href = url; });
  P.addListener('pushNotificationReceived', n => {
    const d = n?.data || {};
    const el = document.createElement('div');
    el.style.cssText = 'position:fixed;top:calc(8px + env(safe-area-inset-top));left:8px;right:8px;z-index:10000;background:#0b1c0d;color:#fff;border-radius:12px;padding:12px 14px;box-shadow:0 6px 20px rgba(0,0,0,.35);font-size:.85rem;line-height:1.4;';
    const tit = document.createElement('b'); tit.textContent = n?.title || d.titulo || 'Conilon Tech';
    const corpo = document.createElement('div'); corpo.textContent = n?.body || d.corpo || '';
    el.append(tit, corpo);
    el.onclick = () => { el.remove(); if (d.url) location.href = d.url; };
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 10000);
  });
})();

// Chamado num toque do usuário (o iPhone só pede permissão assim).
export async function ativar() {
  const s = suporte();
  if (s === 'nativo') { await salvarToken(await tokenNativo(true), 'android'); return; }
  if (s !== 'web') throw new Error('Sem suporte neste aparelho.');
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') throw new Error('permissao');
  await salvarToken(await tokenWeb(), 'web');
}

// Em cada carregamento (via menu.js): se já ativado, renova o token 1x por dia (ele pode mudar).
export async function renovar() {
  const s = suporte();
  if (!ls.get(CHAVE_ID)) return;
  if (Date.now() - Number(ls.get(CHAVE_RENOVADO) || 0) < 86400000) return;
  try {
    if (s === 'web' && Notification.permission === 'granted') await salvarToken(await tokenWeb(), 'web');
    else if (s === 'nativo') await salvarToken(await tokenNativo(false), 'android');
  } catch (e) { /* tenta de novo no próximo carregamento */ }
}

// O Worker manda "🔔 Teste" só para este usuário em até 5 minutos.
export async function pedirTeste() {
  const u = getAuth(getApp()).currentUser; if (!u) return;
  await addDoc(collection(getFirestore(getApp()), 'notificacoesTeste'), { uid: u.uid, criadoEm: new Date().toISOString() });
}
