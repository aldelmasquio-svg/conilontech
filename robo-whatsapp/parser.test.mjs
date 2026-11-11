// Teste do parser sem dependências: node robo-whatsapp/parser.test.mjs
import { parseRelatorio, _internos } from './parser.js';

let falhas = 0;
function ok(cond, msg) { if (!cond) { console.error('❌', msg); falhas++; } else console.log('✓', msg); }
function eq(a, b, msg) { ok(JSON.stringify(a) === JSON.stringify(b), `${msg} (esperado ${JSON.stringify(b)}, veio ${JSON.stringify(a)})`); }

// ── unidades e números ──
eq(_internos.parseNumeroBR('1.000 LITROS'), 1000, 'parseNumeroBR milhar');
eq(_internos.parseNumeroBR('13,5 L'), 13.5, 'parseNumeroBR decimal');
eq(_internos.normalizarUnidade('LITROS'), 'L', 'unidade LITROS→L');
eq(_internos.normalizarUnidade('LT'), 'L', 'unidade LT→L');
eq(_internos.normalizarUnidade('KG'), 'kg', 'unidade KG→kg');
eq(_internos.parseData('10/11/2026.'), '2026-11-10', 'data dd/mm/yyyy');
eq(_internos.parseData('22.10.2026'), '2026-10-22', 'data com pontos');

// ── compra (exemplo real) ──
const compra = parseRelatorio(`Entrada de Produtos: SÍTIO PRATO QUEBRADO
Data: 10/11/2026.
Produtos: AMINOAGRO MOL TOP
Quantidade: 1.000 LITROS
Destino: COMPRA
N° da Nota: 5.952`);
ok(compra.length === 1, 'compra: 1 bloco');
eq(compra[0].tipo, 'compra', 'compra: tipo');
eq(compra[0].fazenda, 'SÍTIO PRATO QUEBRADO', 'compra: fazenda no cabeçalho');
eq(compra[0].data, '2026-11-10', 'compra: data');
eq(compra[0].itens, [{ produto: 'AMINOAGRO MOL TOP', quantidade: 1000, unidade: 'L' }], 'compra: item');
eq(compra[0].nota, '5.952', 'compra: nota');
ok(compra[0].ok === true, 'compra: ok=true');

// ── transferência (exemplo real) ──
const transf = parseRelatorio(`Transferência de Produtos
Origem: SÍTIO PRATO QUEBRADO
Data: 10/11/2026
Produtos: AMINOAGRO MOL TOP
Quantidade: 100 LT
Destino: FAZENDA CONILON
Transportador: GEOVANI`);
ok(transf.length === 1, 'transf: 1 bloco');
eq(transf[0].tipo, 'transferencia', 'transf: tipo');
eq(transf[0].origemFazenda, 'SÍTIO PRATO QUEBRADO', 'transf: origem');
eq(transf[0].fazenda, 'FAZENDA CONILON', 'transf: destino vira fazenda');
eq(transf[0].transportador, 'GEOVANI', 'transf: transportador');
eq(transf[0].itens, [{ produto: 'AMINOAGRO MOL TOP', quantidade: 100, unidade: 'L' }], 'transf: item');
ok(transf[0].ok === true, 'transf: ok=true');

// ── bullet com vários produtos ──
const bullet = parseRelatorio(`Entrada de Produtos: FAZENDA AEROPORTO/ SÍTIO ELIANE
Data: 22.10.2026
Produtos/Quantidade:
• Epingle: 35 L
• Mol top: 100 L
Destino: COMPRA
N° da Nota: 53124
Fornecedor: Equilíbrio Rural`);
eq(bullet[0].fazenda, 'FAZENDA AEROPORTO/ SÍTIO ELIANE', 'bullet: fazenda');
eq(bullet[0].itens, [
  { produto: 'Epingle', quantidade: 35, unidade: 'L' },
  { produto: 'Mol top', quantidade: 100, unidade: 'L' },
], 'bullet: dois itens');
eq(bullet[0].fornecedor, 'Equilíbrio Rural', 'bullet: fornecedor');

// ── mensagem com os DOIS blocos juntos ──
const dois = parseRelatorio(`Entrada de Produtos: SÍTIO PRATO QUEBRADO
Data: 10/11/2026.
Produtos: AMINOAGRO MOL TOP
Quantidade: 1.000 LITROS
Destino: COMPRA
N° da Nota: 5.952
Transferência de Produtos
Origem: SÍTIO PRATO QUEBRADO
Data: 10/11/2026
Produtos: AMINOAGRO MOL TOP
Quantidade: 100 LT
Destino: FAZENDA CONILON
Transportador: GEOVANI`);
ok(dois.length === 2, 'mensagem com 2 blocos → 2 resultados');
eq(dois.map(b => b.tipo), ['compra', 'transferencia'], 'ordem compra→transferência');

// ── mensagem que não é relatório ──
eq(parseRelatorio('Bom dia pessoal, tudo certo?'), [], 'texto solto → nada');

console.log(falhas ? `\n${falhas} falha(s).` : '\nTudo ok.');
process.exit(falhas ? 1 : 0);
