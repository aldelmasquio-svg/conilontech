// Menu lateral compartilhado (antes era copiado em cada página e as cópias divergiam).
// Ícones: o emoji fica escondido e o style.css desenha um SVG escolhido pelo href.
import { adminDoSistema, podeAbrir } from './acesso.js';

const SECOES = [
  { label: 'Principal', items: [
    { href:'index.html',         ico:'📊', label:'Dashboard' },
    { href:'mapa.html',          ico:'🗺️', label:'Mapa de Talhões',   acesso:'mapa' },
    { href:'adubacoes.html',     ico:'🧪', label:'Adubações',         acesso:'adubacao' },
    { href:'pulverizacoes.html', ico:'💧', label:'Pulverizações',     acesso:'pulverizacao' },
    { href:'drench.html',        ico:'🌱', label:'Drench Preventivo', acesso:'drench' },
    { href:'irrigacao.html',     ico:'💦', label:'Irrigação',         acesso:'irrigacao' },
    { href:'clima.html',         ico:'🌦️', label:'Clima',             acesso:'clima' },
    { href:'herbicida.html',     ico:'🌿', label:'Herbicida',         acesso:'herbicida' },
    { href:'equipe.html',        ico:'👥', label:'Equipe',            acesso:'equipe' },
    { href:'estoque.html',       ico:'🏬', label:'Estoque',           acesso:'estoque' },
    { href:'pedidos.html',       ico:'📦', label:'Pedidos',           acesso:'pedidos' },
    { href:'cotacoes.html',      ico:'💰', label:'Cotações',          acesso:'cotacoes' },
    { href:'calibracao.html',    ico:'⚙️', label:'Calibração',        acesso:'calibracao' },
    { href:'avaliacoes.html',    ico:'📍', label:'Avaliações',        acesso:'avaliacoes' },
    { href:'amostragem.html',    ico:'🧫', label:'Amostragem',        acesso:'amostragem' },
  ]},
  { label: 'Análise', items: [
    { href:'gestao.html',        ico:'📈', label:'Gestão',            acesso:'gestao' },
    { href:'analises.html',      ico:'🔬', label:'Análises',          acesso:'analises' },
    { href:'recomendacoes.html', ico:'💊', label:'Recomendações',     acesso:'recomendacoes' },
    { href:'planejamento.html',  ico:'🗓️', label:'Planejamento',      acesso:'planejamento' },
    { href:'admin.html',         ico:'⚙️', label:'Administração',     soDono:true },
  ]},
];

export function gerarMenu(perfil) {
  // Usuário desativado no Admin: volta ao login, que explica e encerra a sessão
  if (perfil?.ativo === false) { window.location.replace('login.html'); return; }
  const cont = document.getElementById('menuModulos');
  if (!cont) return;
  const pg = window.location.pathname.split('/').pop() || 'index.html';
  const visivel = m => m.soDono ? adminDoSistema(perfil) : podeAbrir(perfil, m.acesso);
  cont.innerHTML = SECOES.map(s => {
    const html = s.items.filter(visivel).map(m =>
      `<a class="menu-item${pg === m.href ? ' ativo' : ''}" href="${m.href}"><span class="menu-ico">${m.ico}</span><span>${m.label}</span></a>`
    ).join('');
    return html ? `<div class="menu-secao">${s.label}</div>${html}` : '';
  }).join('');
  itemInstalar();
}

// "Instalar aplicativo" no fim do menu, fora do app já instalado:
// - Chrome/Android avisa (beforeinstallprompt) quando dá para instalar; o item dispara o pedido.
// - iPhone/iPad não têm esse aviso: o item abre o passo a passo do "Adicionar à Tela de Início".
const jaInstalado = window.matchMedia?.('(display-mode: standalone)').matches || navigator.standalone === true || !!window.Capacitor;
const ehIOS = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
let pedidoInstalar = null;
function itemInstalar() {
  const cont = document.getElementById('menuModulos');
  if (!cont || jaInstalado || !(pedidoInstalar || ehIOS) || document.getElementById('menuInstalar')) return;
  cont.insertAdjacentHTML('beforeend',
    `<a class="menu-item" id="menuInstalar" data-ico="instalar" href="#" onclick="instalarApp();return false;"><span class="menu-ico">📲</span><span>Instalar aplicativo</span></a>`);
}
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); pedidoInstalar = e; itemInstalar(); });
window.addEventListener('appinstalled', () => { pedidoInstalar = null; document.getElementById('menuInstalar')?.remove(); });
window.instalarApp = async function() {
  if (ehIOS) { passoAPassoIOS(); return; }
  if (!pedidoInstalar) return;
  pedidoInstalar.prompt();
  await pedidoInstalar.userChoice.catch(() => {});
  pedidoInstalar = null;
  document.getElementById('menuInstalar')?.remove();
};
function passoAPassoIOS() {
  window.fecharMenu?.();
  document.getElementById('instalarIOS')?.remove();
  const passo = (n, html) => `<div style="display:flex;gap:12px;align-items:flex-start;margin-top:12px;"><span style="flex-shrink:0;width:26px;height:26px;border-radius:50%;background:var(--vb);color:var(--v);font-weight:700;display:flex;align-items:center;justify-content:center;font-size:.8rem;">${n}</span><div style="font-size:.9rem;line-height:1.45;padding-top:3px;">${html}</div></div>`;
  document.body.insertAdjacentHTML('beforeend', `
    <div id="instalarIOS" onclick="if(event.target===this)this.remove()" style="position:fixed;inset:0;background:rgba(10,20,14,.5);z-index:5000;display:flex;align-items:flex-end;justify-content:center;">
      <div style="background:var(--surface,#fff);color:var(--t);width:100%;max-width:480px;border-radius:18px 18px 0 0;padding:20px 20px calc(20px + env(safe-area-inset-bottom));box-shadow:0 -8px 30px rgba(0,0,0,.2);">
        <div style="display:flex;align-items:center;gap:12px;">
          <img src="icones/icone-192.png" alt="" style="width:44px;height:44px;border-radius:11px;">
          <div><div style="font-family:var(--font-display);font-weight:700;font-size:1.05rem;">Instalar no iPhone</div>
          <div style="font-size:.78rem;color:var(--c);">Ícone na tela inicial, abrindo em tela cheia</div></div>
        </div>
        ${passo(1, 'No <b>Safari</b>, toque em <b>Compartilhar</b> <span style="display:inline-block;border:1.5px solid currentColor;border-radius:5px;padding:0 5px;font-size:.8rem;">⬆</span> (na barra de baixo ou no topo).')}
        ${passo(2, 'Role as opções e toque em <b>Adicionar à Tela de Início</b> <span style="display:inline-block;border:1.5px solid currentColor;border-radius:5px;padding:0 5px;font-size:.8rem;">＋</span>.')}
        ${passo(3, 'Confirme em <b>Adicionar</b>. Pronto: abra o <b>Conilon Tech</b> pelo ícone.')}
        <button onclick="document.getElementById('instalarIOS').remove()" style="margin-top:18px;width:100%;border:none;border-radius:10px;background:var(--v);color:#fff;font-weight:600;font-size:.92rem;padding:12px;">Entendi</button>
      </div>
    </div>`);
}
