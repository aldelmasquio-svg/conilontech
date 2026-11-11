// Lê o texto dos relatórios do grupo (GranFarm) e devolve blocos estruturados.
// Formato (texto livre, com rótulos), podendo ter VÁRIOS blocos numa mensagem:
//
//   Entrada de Produtos: FAZENDA ALVORADA I
//   Data: 22/10/2026.
//   Produtos: AURORA
//   Quantidade: 10 L
//   Destino: Compra.
//   N° da Nota: 4.393
//   Fornecedor: RURAL COMÉRCIO DE IRRIGAÇÕES LTDA.
//
//   Transferência de Produtos
//   Origem: FAZENDA AEROPORTO
//   Data: 23/10/2026
//   Produtos: VERDADERO 600 G
//   Quantidade: 10 KG
//   Destino: FAZENDA ALVORADA I
//   Transportador: ÉDIO BELCAVELLO
//
// Variante com vários produtos:
//   Produtos/Quantidade:
//   • Epingle: 35 L
//   • Mol top: 100 L
//
// A ideia é ser conservador: só devolve um bloco quando dá pra entender com segurança
// (tipo reconhecido, fazenda preenchida e ao menos um item com quantidade > 0). O que
// não bate é devolvido com `ok:false` e um motivo, pra quem chama decidir (pular / avisar).

const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();

// "1.000 LITROS" → 1000 ; "13,5 L" → 13.5
function parseNumeroBR(s) {
  const m = String(s || '').match(/-?[\d.]*\d(?:,\d+)?/);
  if (!m) return null;
  const n = parseFloat(m[0].replace(/\./g, '').replace(',', '.'));
  return isNaN(n) ? null : n;
}

function normalizarUnidade(u) {
  const k = norm(u).replace(/\.$/, '');
  if (['l', 'lt', 'lts', 'litro', 'litros'].includes(k)) return 'L';
  if (['ml', 'mililitro', 'mililitros'].includes(k)) return 'mL';
  if (['kg', 'kgs', 'quilo', 'quilos', 'kilo', 'kilos'].includes(k)) return 'kg';
  if (['g', 'grama', 'gramas'].includes(k)) return 'g';
  if (['t', 'ton', 'tonelada', 'toneladas'].includes(k)) return 't';
  if (['sc', 'saca', 'sacas', 'saco', 'sacos'].includes(k)) return 'sc';
  if (['un', 'und', 'unid', 'unidade', 'unidades'].includes(k)) return 'un';
  return u ? String(u).trim() : '';
}

// "10 L", "1.000 LITROS", "100 LT" → {quantidade, unidade}
function parseQtd(s) {
  const quantidade = parseNumeroBR(s);
  if (quantidade == null) return null;
  const resto = String(s).replace(/-?[\d.]*\d(?:,\d+)?/, '').trim(); // o que sobra depois do número
  return { quantidade, unidade: normalizarUnidade(resto) };
}

function parseData(s) {
  const m = String(s || '').match(/(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})/);
  if (!m) return '';
  let [, d, mes, a] = m;
  if (a.length === 2) a = '20' + a;
  return `${a}-${mes.padStart(2, '0')}-${d.padStart(2, '0')}`;
}

// Pega o valor de um rótulo dentro das linhas do bloco (acento/caixa ignorados).
// labels: lista de sinônimos do rótulo. Retorna '' se não achar.
function campo(linhas, labels) {
  const alvos = labels.map(norm);
  for (const ln of linhas) {
    const i = ln.indexOf(':');
    if (i < 0) continue;
    const rot = norm(ln.slice(0, i));
    if (alvos.some(a => rot === a || rot.startsWith(a))) return ln.slice(i + 1).trim().replace(/\.$/, '').trim();
  }
  return '';
}

function parseItens(linhas) {
  const itens = [];
  // Variante bullet: "Produtos/Quantidade:" seguido de "• Nome: 35 L"
  const idxPQ = linhas.findIndex(ln => /produtos?\s*\/\s*quantidade/i.test(norm(ln)) || norm(ln).startsWith('produtos/quantidade'));
  if (idxPQ >= 0) {
    for (let i = idxPQ + 1; i < linhas.length; i++) {
      const raw = linhas[i];
      const ln = raw.replace(/^[\s•\-*·]+/, '').trim();
      if (!ln) continue;
      // para ao chegar num próximo rótulo conhecido
      if (/^(destino|origem|transportador|n[º°o.]*\s*da\s*nota|fornecedor|data)\b/i.test(norm(ln))) break;
      const i2 = ln.indexOf(':');
      if (i2 < 0) continue;
      const produto = ln.slice(0, i2).trim();
      const q = parseQtd(ln.slice(i2 + 1));
      if (produto && q && q.quantidade > 0) itens.push({ produto, quantidade: q.quantidade, unidade: q.unidade });
    }
    if (itens.length) return itens;
  }
  // Variante simples: "Produtos: NOME" + "Quantidade: 10 L"
  const produto = campo(linhas, ['produtos', 'produto']);
  const q = parseQtd(campo(linhas, ['quantidade', 'qtd', 'qtde']));
  if (produto && q && q.quantidade > 0) itens.push({ produto, quantidade: q.quantidade, unidade: q.unidade });
  return itens;
}

// Divide a mensagem em blocos a partir dos cabeçalhos e devolve um objeto por bloco.
export function parseRelatorio(texto) {
  const linhas = String(texto || '').split(/\r?\n/).map(l => l.trim());
  // índices onde um bloco começa
  const inicios = [];
  linhas.forEach((ln, i) => {
    const n = norm(ln);
    if (n.startsWith('entrada de produto')) inicios.push({ i, tipo: 'compra' });
    else if (n.startsWith('transferencia de produto')) inicios.push({ i, tipo: 'transferencia' });
  });
  if (!inicios.length) return [];

  const blocos = [];
  for (let k = 0; k < inicios.length; k++) {
    const ini = inicios[k].i;
    const fim = k + 1 < inicios.length ? inicios[k + 1].i : linhas.length;
    const corpo = linhas.slice(ini, fim).filter(Boolean);
    const tipo = inicios[k].tipo;
    const data = parseData(campo(corpo, ['data']));
    const itens = parseItens(corpo);

    if (tipo === 'compra') {
      // a fazenda costuma vir no próprio cabeçalho: "Entrada de Produtos: FAZENDA X"
      const cab = corpo[0] || '';
      let fazenda = cab.includes(':') ? cab.slice(cab.indexOf(':') + 1).trim() : '';
      if (!fazenda) fazenda = campo(corpo, ['fazenda', 'local', 'destino']);
      const bloco = {
        tipo, fazenda, data,
        nota: campo(corpo, ['n da nota', 'no da nota', 'nº da nota', 'n° da nota', 'nota', 'numero da nota']),
        fornecedor: campo(corpo, ['fornecedor']),
        itens, raw: corpo.join('\n'),
      };
      bloco.ok = !!(fazenda && itens.length);
      if (!bloco.ok) bloco.motivo = !fazenda ? 'fazenda não identificada' : 'sem produto/quantidade';
      blocos.push(bloco);
    } else {
      const origem = campo(corpo, ['origem']);
      const destino = campo(corpo, ['destino']);
      const bloco = {
        tipo, fazenda: destino, origemFazenda: origem, data,
        transportador: campo(corpo, ['transportador', 'transporte']),
        itens, raw: corpo.join('\n'),
      };
      bloco.ok = !!(origem && destino && itens.length);
      if (!bloco.ok) bloco.motivo = !origem ? 'origem não identificada' : !destino ? 'destino não identificado' : 'sem produto/quantidade';
      blocos.push(bloco);
    }
  }
  return blocos;
}

export const _internos = { parseNumeroBR, normalizarUnidade, parseQtd, parseData, norm };
