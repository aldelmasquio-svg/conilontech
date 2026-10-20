// Gera o PDF do "Pedido de Insumos" (resumo + distribuição por fazenda), igual ao da
// página, só que no Worker (sem navegador) com pdf-lib. Helvetica = só Latin-1, sem emoji.
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

const VERDE = rgb(0.10, 0.36, 0.10);
const VERDE_ESC = rgb(0.043, 0.11, 0.051);
const VERDE_CLARO = rgb(0.886, 0.941, 0.886);
const CINZA = rgb(0.35, 0.40, 0.28);
const PRETO = rgb(0.07, 0.07, 0.07);
const BRANCO = rgb(1, 1, 1);
const ZEBRA = rgb(0.965, 0.965, 0.93);
const LINHA = rgb(0.78, 0.76, 0.69);

const MODO_LABEL = { terrestre: 'Terrestre', aerea: 'Aérea', fertirrigacao: 'Fertirrigação', drench: 'Drench' };

function num(v) { const n = parseFloat(String(v).replace(',', '.')); return isFinite(n) ? n : 0; }
function fmt(n, dec = 0) {
  const v = Number(n);
  if (!isFinite(v)) return '-';
  try { return v.toLocaleString('pt-BR', { minimumFractionDigits: dec, maximumFractionDigits: dec }); }
  catch { return String(Math.round(v * 100) / 100); }
}

export async function gerarPedidoPdf(dados, { criadoPor = '', dataISO = '' } = {}) {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const [PW, PH] = [595.28, 841.89]; // A4 retrato
  const MARG = 40;
  const largura = PW - MARG * 2;
  let page, y;
  const novaPagina = () => { page = pdf.addPage([PW, PH]); y = PH - MARG; };
  novaPagina();

  const limpar = (s) => String(s == null ? '' : s).replace(/[^\x09\x0A\x0D\x20-\x7E\xA0-\xFF]/g, '').trim();
  const lw = (s, size, f = font) => f.widthOfTextAtSize(limpar(s), size);
  const texto = (s, x, yy, { size = 10, f = font, cor = PRETO } = {}) => page.drawText(limpar(s), { x, y: yy, size, font: f, color: cor });
  const truncar = (s, size, max, f = font) => {
    s = limpar(s);
    if (lw(s, size, f) <= max) return s;
    while (s.length > 1 && lw(s + '...', size, f) > max) s = s.slice(0, -1);
    return s + '...';
  };
  const garantir = (h) => { if (y - h < MARG) novaPagina(); };
  const celula = (val, c, size = 9, f = font, cor = PRETO) => {
    const t = truncar(val, size, c.w - 8, f);
    let tx = c.x + 4;
    if (c.al === 'r') tx = c.x + c.w - 4 - lw(t, size, f);
    else if (c.al === 'c') tx = c.x + (c.w - lw(t, size, f)) / 2;
    texto(t, tx, y, { size, f, cor });
  };
  const cabTabela = (cols, bg = VERDE_ESC, cor = BRANCO) => {
    garantir(22);
    page.drawRectangle({ x: MARG, y: y - 4, width: largura, height: 18, color: bg });
    cols.forEach(c => celula(c.h, c, 8.5, bold, cor));
    y -= 20;
  };

  // ── Cabeçalho ──
  texto('CONILON TECH · GESTÃO AGRÍCOLA', MARG, y, { size: 8, f: bold, cor: CINZA });
  const nIns = (dados.itens || []).length;
  texto(`${nIns} insumo(s)`, PW - MARG - lw(`${nIns} insumo(s)`, 9), y, { size: 9, cor: CINZA });
  y -= 22;
  texto('PEDIDO DE INSUMOS', MARG, y, { size: 20, f: bold, cor: VERDE_ESC });
  y -= 16;
  const dataF = dataISO ? dataISO.slice(0, 10).split('-').reverse().join('/') : '';
  texto(`Data: ${dataF}${criadoPor ? ' · ' + criadoPor : ''}`, MARG, y, { size: 9, cor: CINZA });
  y -= 10;
  page.drawLine({ start: { x: MARG, y }, end: { x: PW - MARG, y }, thickness: 1.5, color: VERDE });
  y -= 24;

  // ── Resumo do pedido ──
  texto('RESUMO DO PEDIDO', MARG, y, { size: 10, f: bold, cor: VERDE }); y -= 18;
  const colsR = [
    { x: MARG, w: 22, h: '#', al: 'l' },
    { x: MARG + 24, w: 150, h: 'Produto', al: 'l' },
    { x: MARG + 176, w: 78, h: 'Modo', al: 'l' },
    { x: MARG + 256, w: 78, h: 'Dose/ha', al: 'c' },
    { x: MARG + 336, w: 80, h: 'Área total', al: 'c' },
    { x: MARG + 418, w: largura - 418, h: 'Total a pedir', al: 'r' },
  ];
  cabTabela(colsR);
  (dados.itens || []).forEach((it, i) => {
    garantir(16);
    if (i % 2 === 1) page.drawRectangle({ x: MARG, y: y - 4, width: largura, height: 16, color: ZEBRA });
    const temDose = it.dosePorHa != null && it.total != null;
    const dose = temDose ? `${fmt(it.dosePorHa, it.dosePorHa % 1 ? 2 : 0)} ${it.unidade || ''}/ha` : '-';
    const area = temDose ? `${fmt(it.areaTotal, 1)} ha` : '-';
    const total = temDose ? `${fmt(it.total, it.total % 1 ? 2 : 0)} ${it.unidade || ''}` : (it.quantidade || '-');
    celula(String(i + 1), colsR[0]);
    celula(it.produto, colsR[1], 9, bold);
    celula(MODO_LABEL[it.modo] || it.modo || '-', colsR[2]);
    celula(dose, colsR[3]);
    celula(area, colsR[4]);
    celula(total, colsR[5], 9, bold, VERDE);
    y -= 16;
  });
  y -= 18;

  // ── Distribuição por fazenda ──
  const porFaz = {};
  (dados.itens || []).forEach(it => (it.talhoes || []).forEach(t => {
    const f = t.fazenda || 'Sem fazenda';
    porFaz[f] = porFaz[f] || {};
    if (!porFaz[f][t.id]) porFaz[f][t.id] = { nome: t.nome || t.id, area: num(t.area), itens: [] };
    porFaz[f][t.id].itens.push(it);
  }));
  const fazNomes = Object.keys(porFaz).sort((a, b) => a.localeCompare(b, 'pt'));
  if (fazNomes.length) {
    garantir(30);
    texto('DISTRIBUIÇÃO POR FAZENDA', MARG, y, { size: 10, f: bold, cor: VERDE }); y -= 18;
    const colsD = [
      { x: MARG, w: 170, h: 'Talhão', al: 'l' },
      { x: MARG + 174, w: 150, h: 'Produto', al: 'l' },
      { x: MARG + 328, w: 86, h: 'Dose/ha', al: 'c' },
      { x: MARG + 418, w: largura - 418, h: 'Total do talhão', al: 'r' },
    ];
    for (const faz of fazNomes) {
      garantir(44);
      page.drawRectangle({ x: MARG, y: y - 4, width: largura, height: 18, color: VERDE_CLARO });
      texto(faz, MARG + 6, y + 1, { size: 9.5, f: bold, cor: VERDE_ESC });
      y -= 22;
      cabTabela(colsD);
      const tals = porFaz[faz];
      const subt = {};
      let linIdx = 0;
      for (const tid of Object.keys(tals)) {
        const td = tals[tid];
        td.itens.forEach((it, ii) => {
          garantir(15);
          if (linIdx % 2 === 1) page.drawRectangle({ x: MARG, y: y - 3, width: largura, height: 15, color: ZEBRA });
          if (ii === 0) page.drawLine({ start: { x: MARG, y: y + 11 }, end: { x: PW - MARG, y: y + 11 }, thickness: 0.6, color: LINHA });
          const temDose = it.dosePorHa != null;
          const dose = temDose ? `${fmt(it.dosePorHa, it.dosePorHa % 1 ? 2 : 0)} ${it.unidade || ''}/ha` : (it.quantidade || '-');
          const tot = (temDose && td.area > 0) ? `${fmt(it.dosePorHa * td.area, (it.dosePorHa * td.area) % 1 ? 2 : 0)} ${it.unidade || ''}` : '-';
          if (ii === 0) celula(`${tid} · ${td.nome}${td.area ? ` · ${fmt(td.area, td.area % 1 ? 1 : 0)}ha` : ''}`, colsD[0], 8.5, bold, VERDE_ESC);
          celula(it.produto, colsD[1], 8.5);
          celula(dose, colsD[2], 8.5, font, CINZA);
          celula(tot, colsD[3], 8.5, bold, VERDE);
          y -= 15;
          linIdx++;
          if (temDose && td.area > 0) {
            const k = `${it.produto}|${it.unidade || ''}`;
            subt[k] = (subt[k] || 0) + it.dosePorHa * td.area;
          }
        });
      }
      // subtotal da fazenda
      const partes = Object.entries(subt).map(([k, v]) => { const [p, u] = k.split('|'); return `${p}: ${fmt(v, v % 1 ? 2 : 0)} ${u}`; });
      if (partes.length) {
        garantir(16);
        page.drawRectangle({ x: MARG, y: y - 3, width: largura, height: 15, color: VERDE_CLARO });
        texto(`Total ${faz}: ` + partes.join(' · '), MARG + 6, y, { size: 8, f: bold, cor: VERDE_ESC });
        y -= 20;
      } else { y -= 6; }
    }
  }

  // ── Rodapé ──
  garantir(16);
  const ger = `Gerado em ${dataF || ''} · ConilonTech · via Telegram`;
  texto(ger, PW - MARG - lw(ger, 8), MARG - 12 + 0, { size: 8, cor: CINZA });

  return await pdf.save(); // Uint8Array
}
