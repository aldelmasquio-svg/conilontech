// Exportar relatórios em PDF/arquivo de um jeito que funcione em todo lugar.
// - Navegador comum (computador, Chrome/Safari no celular): window.print() — PDF nítido,
//   imprime ou salva.
// - App Android (Capacitor) e site instalado na Tela de Início do iPhone: ali window.print()
//   não faz nada e downloads de blob somem, então gera o PDF (html2pdf) e abre o
//   compartilhamento do sistema (WhatsApp, e-mail, Salvar em Arquivos, Imprimir...).
// Uso: exportarPdf(area, { nome:'x.pdf', titulo:'Relatório', avisar:toast, imprimir:fn })
//   `area` é o elemento já preenchido com o HTML do relatório (o mesmo do @media print).

export function ehIOS() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1); // iPad "desktop"
}
export function instaladoNoIOS() {
  if (!ehIOS()) return false;
  return navigator.standalone === true ||
    (window.matchMedia && matchMedia('(display-mode: standalone)').matches);
}
// true quando window.print()/download não funcionam e é preciso gerar o arquivo e compartilhar.
export function precisaCompartilhar() {
  return !!window.Capacitor || instaladoNoIOS();
}

function carregarHtml2pdf() {
  return new Promise((resolve, reject) => {
    if (window.html2pdf) return resolve(window.html2pdf);
    const s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';
    s.onload = () => resolve(window.html2pdf);
    s.onerror = () => reject(new Error('cdn'));
    document.head.appendChild(s);
  });
}
function capPlugin(nome) {
  const c = window.Capacitor; if (!c) return null;
  if (c.Plugins && c.Plugins[nome]) return c.Plugins[nome];
  if (typeof c.registerPlugin === 'function') { try { return c.registerPlugin(nome); } catch (e) {} }
  return null;
}
function blobParaBase64(blob) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onerror = () => reject(new Error('leitura'));
    r.onload = () => resolve(String(r.result).split(',')[1] || '');
    r.readAsDataURL(blob);
  });
}
function foiCancelado(e) { return !!(e && (e.name === 'AbortError' || /cancel|abort/i.test(e.message || ''))); }

// Entrega um arquivo pronto: compartilhamento nativo do app → Web Share (iPhone/Android)
// → download. Devolve true se algo foi feito (inclusive o usuário cancelar o menu).
export async function compartilharArquivo(blob, nome, titulo, avisar = () => {}) {
  const Fs = capPlugin('Filesystem'), Sh = capPlugin('Share');
  if (Fs && Sh) {
    try {
      const b64 = await blobParaBase64(blob);
      const esc = await Fs.writeFile({ path: nome, data: b64, directory: 'CACHE', recursive: true });
      await Sh.share({ title: titulo, url: esc.uri, dialogTitle: titulo });
      return true;
    } catch (e) { if (foiCancelado(e)) return true; }
  }
  if (navigator.share) {
    const file = new File([blob], nome, { type: blob.type || 'application/octet-stream' });
    if (!navigator.canShare || navigator.canShare({ files: [file] })) {
      try { await navigator.share({ files: [file], title: titulo }); return true; }
      catch (e) {
        if (foiCancelado(e)) return true;
        // Safari só abre o compartilhamento logo após um toque; gerar o PDF demora e o
        // "toque" expira (NotAllowedError). Mostra um botão para o usuário tocar de novo.
        if (e && e.name === 'NotAllowedError') { botaoCompartilhar(file, titulo); return true; }
      }
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = nome;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 15000);
  avisar('📄 Arquivo gerado.');
  return true;
}

function botaoCompartilhar(file, titulo) {
  document.getElementById('exp-compartilhar')?.remove();
  const box = document.createElement('div');
  box.id = 'exp-compartilhar';
  box.style.cssText = 'position:fixed;inset:0;z-index:10000;background:rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;padding:16px;';
  box.innerHTML = `<div style="background:#fff;border-radius:14px;padding:20px;max-width:320px;width:100%;text-align:center;font-family:var(--font-body,sans-serif);">
    <div style="font-size:1rem;font-weight:700;margin-bottom:6px;">📄 PDF pronto</div>
    <div style="font-size:.85rem;color:#4b5563;margin-bottom:16px;">Toque para enviar, salvar em Arquivos ou imprimir.</div>
    <button type="button" data-ok style="width:100%;padding:12px;border:0;border-radius:10px;background:#1d6b3f;color:#fff;font-size:.95rem;font-weight:700;margin-bottom:8px;">📤 Compartilhar</button>
    <button type="button" data-fechar style="width:100%;padding:10px;border:0;border-radius:10px;background:#f3f4f6;color:#374151;font-size:.9rem;">Fechar</button></div>`;
  const fechar = () => box.remove();
  box.querySelector('[data-fechar]').onclick = fechar;
  box.querySelector('[data-ok]').onclick = () => {
    navigator.share({ files: [file], title: titulo }).then(fechar, e => { if (foiCancelado(e)) fechar(); });
  };
  document.body.appendChild(box);
}

// O iPhone recusa canvas acima de ~16,7 milhões de pixels (relatório longo sairia em branco):
// reduz a escala do html2canvas para caber.
const MAX_PIXELS = 16e6;

export async function exportarPdf(area, { nome = 'relatorio.pdf', titulo = 'Relatório', avisar = () => {}, imprimir } = {}) {
  if (!precisaCompartilhar()) { setTimeout(imprimir || (() => window.print()), 150); return; }
  let lib;
  try { lib = await carregarHtml2pdf(); }
  catch (e) { avisar('❌ Sem internet para gerar o PDF agora.'); return; }
  const estiloAntes = area.style.cssText;
  area.style.cssText = 'display:block;position:fixed;left:-10000px;top:0;width:794px;background:#fff;';
  avisar('⏳ Gerando PDF...');
  try {
    const alvo = area.firstElementChild || area;
    const alt = Math.max(alvo.scrollHeight, 1);
    const escala = Math.max(0.75, Math.min(2, Math.sqrt(MAX_PIXELS / (794 * alt))));
    const blob = await lib().set({
      margin: [8, 8, 8, 8], image: { type: 'jpeg', quality: 0.95 },
      html2canvas: { scale: escala, backgroundColor: '#ffffff', windowWidth: 794 },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
      pagebreak: { mode: ['css', 'legacy'] }
    }).from(alvo).outputPdf('blob');
    await compartilharArquivo(blob, nome, titulo, avisar);
  } catch (e) {
    if (!foiCancelado(e)) avisar('❌ Erro ao gerar PDF: ' + (e && e.message || e));
  } finally { area.style.cssText = estiloAntes; }
}
