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
}
