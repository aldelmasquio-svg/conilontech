// Ferramentas que o Claude pode chamar + regras de permissão (espelham as do app).

// ── Permissões (mesma lógica de nivelAcesso/fazendaPermitida das páginas) ──
const HERANCA = { drench: 'pulverizacao', cotacoes: 'pedidos' };
// Módulos abertos por padrão (como agenda/clima no app): só bloqueiam se o admin marcar 'nenhum'.
const ABERTOS = new Set(['clima', 'agenda']);

export function nivelAcesso(perfil, mod) {
  const mods = perfil.modulos || {};
  if (mods[mod]) return mods[mod];
  if (HERANCA[mod] && mods[HERANCA[mod]]) return mods[HERANCA[mod]];
  if (perfil.perfil === 'admin') return 'admin';
  return 'nenhum';
}
export function ehAdminSistema(perfil) {
  return Object.values(perfil.modulos || {}).includes('admin') || perfil.perfil === 'admin';
}
function podeLer(perfil, mod) {
  if (mod === 'base') return true;
  if (ABERTOS.has(mod)) return (perfil.modulos || {})[mod] !== 'nenhum';
  return nivelAcesso(perfil, mod) !== 'nenhum';
}
function fazendaPermitida(perfil, mod, fazenda) {
  if (mod === 'base' || !fazenda) return true;
  if (nivelAcesso(perfil, mod) === 'admin') return true;
  const fm = perfil.fazendasModulo || {};
  const lista = fm[mod] ?? fm[HERANCA[mod]];
  if (!lista || !lista.length) return true;
  return lista.includes(fazenda);
}

// Coleção de topo → módulo que controla o acesso. O que não está aqui não pode ser lido.
const COLECOES = {
  talhoes: 'base', config: 'base',
  pulverizacoes: 'pulverizacao',
  drenchPrevencao: 'drench',
  planosAdubacao: 'adubacao', catalogo_adubos: 'adubacao', configAdubacao: 'adubacao',
  equipeEmpregados: 'equipe', equipeMaquinas: 'equipe', equipeRegistros: 'equipe',
  estoque_produtos: 'estoque', estoque_movimentacoes: 'estoque',
  pedidos: 'pedidos',
  cotacoes: 'cotacoes', garantiasProdutos: 'cotacoes',
  analises: 'analises', amostras: 'analises',
  recomendacoes: 'recomendacoes',
  planejamentos_safra: 'planejamento',
  irrigacaoSetores: 'irrigacao', irrigacaoRegistros: 'irrigacao', pluviometria: 'irrigacao',
  vazaoMedidores: 'irrigacao', vazaoConfig: 'irrigacao', vazaoAlertas: 'irrigacao',
  herbicidaRegistros: 'herbicida', herbicidaConclusoes: 'herbicida', configHerbicida: 'herbicida',
  calibracoes: 'calibracao',
  avaliacaoPlantas: 'avaliacoes', avaliacaoRegistros: 'avaliacoes',
  amostragemPontos: 'amostragem', amostragemColetas: 'amostragem', amostragemConfig: 'amostragem',
  clima: 'clima',
};

function moduloDoCaminho(caminho) {
  const topo = String(caminho || '').split('/').filter(Boolean)[0];
  return Object.prototype.hasOwnProperty.call(COLECOES, topo) ? COLECOES[topo] : null;
}

// Campos pesados que não ajudam a responder (polígonos, fotos, séries por minuto).
const CAMPOS_PESADOS = new Set(['coordenadas', 'dataURI', 'pontos', 'poligono', 'geojson']);

function enxugar(x, prof = 0) {
  if (Array.isArray(x)) return x.map(v => enxugar(v, prof + 1));
  if (x && typeof x === 'object') {
    const o = {};
    for (const [k, v] of Object.entries(x)) {
      if (CAMPOS_PESADOS.has(k)) { o[k] = '[omitido]'; continue; }
      o[k] = enxugar(v, prof + 1);
    }
    return o;
  }
  if (typeof x === 'string' && x.length > 1500) return x.slice(0, 1500) + '…[cortado]';
  return x;
}

const LIMITE_SAIDA = 24000;
function serializar(docs, total) {
  let lista = docs;
  let txt = JSON.stringify(lista);
  while (txt.length > LIMITE_SAIDA && lista.length > 1) {
    lista = lista.slice(0, Math.max(1, Math.floor(lista.length * 0.7)));
    txt = JSON.stringify(lista);
  }
  if (txt.length > LIMITE_SAIDA) txt = txt.slice(0, LIMITE_SAIDA) + '…[cortado]';
  const nota = lista.length < total
    ? `\n[mostrando ${lista.length} documentos — refine os filtros ou use "campos" para trazer menos dados]`
    : `\n[${lista.length} documento(s)]`;
  return txt + nota;
}

const OPS = { '==': 'EQUAL', '!=': 'NOT_EQUAL', '<': 'LESS_THAN', '<=': 'LESS_THAN_OR_EQUAL', '>': 'GREATER_THAN', '>=': 'GREATER_THAN_OR_EQUAL', 'in': 'IN', 'array-contains': 'ARRAY_CONTAINS' };

function compara(v, op, alvo) {
  switch (op) {
    case '==': return v === alvo;
    case '!=': return v !== alvo && v !== undefined;
    case '<': return v != null && v < alvo;
    case '<=': return v != null && v <= alvo;
    case '>': return v != null && v > alvo;
    case '>=': return v != null && v >= alvo;
    case 'in': return Array.isArray(alvo) && alvo.includes(v);
    case 'array-contains': return Array.isArray(v) && v.includes(alvo);
    default: return false;
  }
}
function campo(doc, caminho) {
  return String(caminho).split('.').reduce((o, k) => (o == null ? undefined : o[k]), doc);
}

function normalizar(s) {
  return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}
function num(s) {
  if (s == null || s === '') return 0;
  const n = parseFloat(String(s).replace(/\s/g, '').replace(',', '.'));
  return isNaN(n) ? 0 : n;
}
function fmtData(d) {
  if (!d) return '—';
  const [a, m, dd] = String(d).split('-');
  return `${dd}/${m}/${a}`;
}
// O app identifica o talhão pelo campo `id` (código como "AERO-05"), não pelo id do documento;
// é esse código que vai em talhaoId/talhoes[].id. Documento sem `id` cai no id do documento.
function codTalhao(t) {
  return t.id != null && t.id !== '' ? String(t.id) : t._id;
}
function fmtNum(n) {
  return (Math.round(n * 100) / 100).toLocaleString('pt-BR');
}

// ── Definições enviadas à API ──
export const DEFINICOES = [
  {
    name: 'listar_talhoes',
    description: 'Lista os talhões cadastrados (id = código do talhão usado no app, ex.: "AERO-05"; nome, fazenda, área em ha e outros dados simples). Use para descobrir o id de um talhão a partir do nome antes de consultar ou propor algo. Nas outras coleções, talhaoId é esse mesmo código.',
    input_schema: {
      type: 'object',
      properties: { fazenda: { type: 'string', description: 'Filtra por fazenda (opcional, nome exato).' } },
    },
  },
  {
    name: 'consultar',
    description: 'Consulta documentos de uma coleção do Firestore do app. Aceita subcoleções pelo caminho (ex.: "clima/estacao-km18/resumos", "vazaoMedidores/ID/resumos"). Campos pesados (polígonos, fotos, séries por minuto) vêm omitidos. Prefira filtros e "campos" para trazer só o necessário.',
    input_schema: {
      type: 'object',
      properties: {
        colecao: { type: 'string' },
        filtros: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              campo: { type: 'string' },
              op: { type: 'string', enum: Object.keys(OPS) },
              valor: { description: 'string, número, booleano ou lista (para "in")' },
            },
            required: ['campo', 'op', 'valor'],
          },
        },
        ordenar_por: { type: 'string' },
        decrescente: { type: 'boolean' },
        limite: { type: 'integer', description: 'Máximo de documentos (padrão 50, máx. 300).' },
        campos: { type: 'array', items: { type: 'string' }, description: 'Devolve só estes campos (além do _id).' },
      },
      required: ['colecao'],
    },
  },
  {
    name: 'ler_documento',
    description: 'Lê um único documento pelo caminho completo (ex.: "clima/estacao-km18/status/ultimo", "vazaoConfig/geral", "pulverizacoes/ID").',
    input_schema: {
      type: 'object',
      properties: { caminho: { type: 'string' } },
      required: ['caminho'],
    },
  },
  {
    name: 'propor_pulverizacao',
    description: 'Prepara o agendamento (planejamento) de uma pulverização em um ou mais talhões — um registro por talhão, igual ao app. NÃO grava nada: o usuário recebe um resumo com botões Confirmar/Cancelar e só grava se confirmar. Obtenha os ids com listar_talhoes antes.',
    input_schema: {
      type: 'object',
      properties: {
        talhao_ids: { type: 'array', items: { type: 'string' } },
        data: { type: 'string', description: 'Data planejada, AAAA-MM-DD.' },
        modo: { type: 'string', enum: ['Terrestre', 'Drone', 'Costal', 'Tratorizado', 'Turbina', 'Jatão'] },
        produtos: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              produto: { type: 'string' },
              dose: { type: 'number', description: 'Dose por hectare.' },
              unidade: { type: 'string', enum: ['L', 'mL', 'kg', 'g'] },
            },
            required: ['produto', 'dose', 'unidade'],
          },
        },
        alvos: { type: 'array', items: { type: 'string' }, description: 'Pragas/doenças alvo (ex.: Ferrugem, Broca).' },
        observacoes: { type: 'string' },
      },
      required: ['talhao_ids', 'data', 'modo', 'produtos'],
    },
  },
  {
    name: 'propor_pedido',
    description: 'Prepara um pedido de compra de produtos. Cada item pode ser (a) por dose/ha × talhões — o total é calculado pela área — ou (b) só a quantidade total, sem talhões. NÃO grava nada: o usuário recebe um resumo com botões Confirmar/Cancelar.',
    input_schema: {
      type: 'object',
      properties: {
        itens: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              produto: { type: 'string' },
              unidade: { type: 'string', description: 'kg, L, sc, t, un…' },
              modo: { type: 'string', enum: ['terrestre', 'aerea', 'fertirrigacao', 'drench'] },
              dose_por_ha: { type: 'number' },
              talhao_ids: { type: 'array', items: { type: 'string' } },
              quantidade_total: { type: 'number', description: 'Use quando não houver talhões/dose.' },
            },
            required: ['produto', 'unidade'],
          },
        },
        observacoes: { type: 'string' },
      },
      required: ['itens'],
    },
  },
];

// ── Execução ──
export class Ferramentas {
  constructor(fs, perfil) {
    this.fs = fs;
    this.perfil = perfil;
    this.propostas = []; // propostas criadas neste turno, enviadas com botões no fim
    this._talhoes = null;
  }

  async talhoes() {
    if (!this._talhoes) this._talhoes = await this.fs.query('talhoes', { limite: 2000 });
    return this._talhoes;
  }

  async executar(nome, entrada) {
    switch (nome) {
      case 'listar_talhoes': return this.listarTalhoes(entrada);
      case 'consultar': return this.consultar(entrada);
      case 'ler_documento': return this.lerDocumento(entrada);
      case 'propor_pulverizacao': return this.proporPulverizacao(entrada);
      case 'propor_pedido': return this.proporPedido(entrada);
      default: throw new Error(`Ferramenta desconhecida: ${nome}`);
    }
  }

  async listarTalhoes({ fazenda } = {}) {
    const lista = (await this.talhoes())
      .filter(t => fazendaPermitida(this.perfil, 'mapa', t.fazenda))
      .filter(t => !fazenda || normalizar(t.fazenda) === normalizar(fazenda))
      .map(t => {
        const o = { id: codTalhao(t) };
        for (const [k, v] of Object.entries(t)) {
          if (k === '_id' || k === 'id' || CAMPOS_PESADOS.has(k) || /^(criado|editado)/.test(k)) continue;
          if (typeof v === 'number' || typeof v === 'boolean' || (typeof v === 'string' && v.length <= 80)) o[k] = v;
        }
        return o;
      })
      .sort((a, b) => String(a.fazenda).localeCompare(String(b.fazenda)) || String(a.nome).localeCompare(String(b.nome), 'pt-BR', { numeric: true }));
    return serializar(lista, lista.length);
  }

  _checarLeitura(caminho) {
    const mod = moduloDoCaminho(caminho);
    if (!mod) throw new Error(`Coleção não disponível para o assistente: ${String(caminho).split('/')[0]}`);
    if (!podeLer(this.perfil, mod)) throw new Error(`Seu usuário não tem acesso ao módulo "${mod}".`);
    return mod;
  }

  async consultar({ colecao, filtros = [], ordenar_por, decrescente, limite, campos }) {
    const mod = this._checarLeitura(colecao);
    limite = Math.min(Math.max(parseInt(limite) || 50, 1), 300);
    for (const f of filtros) if (!OPS[f.op]) throw new Error(`Operador inválido: ${f.op}`);
    const fsFiltros = filtros.map(f => ({ campo: f.campo, op: OPS[f.op], valor: f.valor }));
    // Com restrição de fazenda o filtro é feito aqui, então busca mais para não faltar documento.
    const restrito = nivelAcesso(this.perfil, mod) !== 'admin' && (this.perfil.fazendasModulo?.[mod] ?? this.perfil.fazendasModulo?.[HERANCA[mod]])?.length;
    let docs;
    try {
      docs = await this.fs.query(colecao, { filtros: fsFiltros, ordem: ordenar_por || null, direcao: decrescente ? 'DESCENDING' : 'ASCENDING', limite: restrito ? 1000 : limite + 1 });
    } catch (e) {
      // Combinação de filtro/ordem sem índice composto: busca com o 1º filtro e filtra/ordena aqui.
      if (e.status !== 'FAILED_PRECONDITION' && !/index/i.test(e.message)) throw e;
      docs = await this.fs.query(colecao, { filtros: fsFiltros.slice(0, 1), limite: 3000 });
      docs = docs.filter(d => filtros.every(f => compara(campo(d, f.campo), f.op, f.valor)));
      if (ordenar_por) {
        docs.sort((a, b) => {
          const va = campo(a, ordenar_por), vb = campo(b, ordenar_por);
          const r = va == null ? 1 : vb == null ? -1 : va < vb ? -1 : va > vb ? 1 : 0;
          return decrescente ? -r : r;
        });
      }
    }
    docs = docs.filter(d => fazendaPermitida(this.perfil, mod, d.fazenda));
    const haMais = docs.length > limite;
    const total = docs.length;
    docs = docs.slice(0, limite).map(d => {
      if (!campos || !campos.length) return enxugar(d);
      const o = { _id: d._id };
      for (const c of campos) o[c] = enxugar(campo(d, c));
      return o;
    });
    return serializar(docs, total) + (haMais ? ' [há mais documentos além do limite]' : '');
  }

  async lerDocumento({ caminho }) {
    const partes = String(caminho).split('/').filter(Boolean);
    if (partes.length % 2 !== 0) throw new Error('Caminho de documento deve ter número par de segmentos (coleção/id[/subcoleção/id]).');
    const mod = this._checarLeitura(caminho);
    const d = await this.fs.get(caminho);
    if (!d) return 'Documento não encontrado.';
    if (!fazendaPermitida(this.perfil, mod, d.fazenda)) throw new Error('Documento de uma fazenda que seu usuário não acessa.');
    return JSON.stringify(enxugar(d)).slice(0, LIMITE_SAIDA);
  }

  async _resolverTalhoes(ids, mod) {
    if (!Array.isArray(ids) || !ids.length) throw new Error('Informe ao menos um talhão (talhao_ids).');
    const todos = await this.talhoes();
    return ids.map(id => {
      const alvo = String(id).trim();
      const t = todos.find(x => codTalhao(x) === alvo)
        || todos.find(x => x._id === alvo)
        || todos.find(x => normalizar(codTalhao(x)) === normalizar(alvo));
      if (!t) throw new Error(`Talhão não encontrado: ${id}. Use listar_talhoes para obter os ids.`);
      if (!fazendaPermitida(this.perfil, mod, t.fazenda)) throw new Error(`Seu usuário não tem acesso à fazenda ${t.fazenda}.`);
      return t;
    });
  }

  async proporPulverizacao({ talhao_ids, data, modo, produtos, alvos = [], observacoes = '' }) {
    if (nivelAcesso(this.perfil, 'pulverizacao') !== 'admin') throw new Error('Só administradores de Pulverização podem agendar pulverizações.');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(data || '')) throw new Error('Data inválida — use AAAA-MM-DD.');
    const modos = ['Terrestre', 'Drone', 'Costal', 'Tratorizado', 'Turbina', 'Jatão'];
    if (!modos.includes(modo)) throw new Error(`Modo inválido. Opções: ${modos.join(', ')}.`);
    const prods = (produtos || []).filter(p => String(p.produto || '').trim());
    if (!prods.length) throw new Error('Informe ao menos um produto.');
    for (const p of prods) {
      if (!(Number(p.dose) > 0)) throw new Error(`Dose inválida para ${p.produto}.`);
      if (!['L', 'mL', 'kg', 'g'].includes(p.unidade)) throw new Error(`Unidade inválida para ${p.produto} (L, mL, kg ou g).`);
    }
    const tals = await this._resolverTalhoes(talhao_ids, 'pulverizacao');
    const prodsFS = prods.map(p => ({ produto: String(p.produto).trim(), dose: String(p.dose).replace('.', ','), unidade: p.unidade }));
    const pragaAlvo = (alvos || []).map(a => String(a).trim()).filter(Boolean);
    const docs = tals.map(t => ({
      colecao: 'pulverizacoes',
      dados: {
        talhaoId: codTalhao(t), talhaoNome: t.nome || codTalhao(t), fazenda: t.fazenda || '',
        data, modoAplicacao: modo, drone: '', produtos: prodsFS, pragaAlvo,
        observacoes: String(observacoes || '').trim(), realizada: false,
      },
    }));
    const resumo = [
      '🗓️ Agendar pulverização',
      `Data: ${fmtData(data)} · ${modo}`,
      `Talhões: ${tals.map(t => `${t.nome} (${t.fazenda || '—'})`).join(', ')}`,
      'Produtos:',
      ...prodsFS.map(p => `  • ${p.produto} — ${p.dose} ${p.unidade}/ha`),
      pragaAlvo.length ? `Alvo: ${pragaAlvo.join(', ')}` : '',
      observacoes ? `Obs.: ${String(observacoes).trim()}` : '',
    ].filter(Boolean).join('\n');
    return this._registrarProposta('pulverizacao', docs, resumo, `planejou pulverização em ${tals.map(t => t.nome).join(', ')} para ${fmtData(data)}`);
  }

  async proporPedido({ itens, observacoes = '' }) {
    if (!ehAdminSistema(this.perfil)) throw new Error('Só administradores podem criar pedidos.');
    if (!Array.isArray(itens) || !itens.length) throw new Error('Informe ao menos um item.');
    const MODOS = ['terrestre', 'aerea', 'fertirrigacao', 'drench'];
    const itensFS = [];
    const linhas = [];
    for (const it of itens) {
      const produto = String(it.produto || '').trim();
      const unidade = String(it.unidade || 'kg').trim();
      const modo = MODOS.includes(it.modo) ? it.modo : 'terrestre';
      if (!produto) throw new Error('Item sem produto.');
      if (Array.isArray(it.talhao_ids) && it.talhao_ids.length) {
        const dose = Number(it.dose_por_ha);
        if (!(dose > 0)) throw new Error(`Informe dose_por_ha para ${produto} (ou use quantidade_total sem talhões).`);
        const tals = await this._resolverTalhoes(it.talhao_ids, 'pedidos');
        const talhoesArr = tals.map(t => ({ id: codTalhao(t), nome: t.nome || codTalhao(t), fazenda: t.fazenda || '', area: num(t.area) }));
        const areaTotal = talhoesArr.reduce((s, t) => s + t.area, 0);
        if (!(areaTotal > 0)) throw new Error(`Os talhões de ${produto} não têm área cadastrada — informe quantidade_total.`);
        const total = Math.round(dose * areaTotal * 100) / 100;
        itensFS.push({
          produto, modo, dosePorHa: dose, unidade,
          areaTotal: Math.round(areaTotal * 100) / 100, total,
          quantidade: `${total.toLocaleString('pt-BR')} ${unidade} (${dose} ${unidade}/ha × ${areaTotal.toLocaleString('pt-BR')} ha)`,
          talhoes: talhoesArr,
        });
        linhas.push(`  • ${produto}: ${fmtNum(total)} ${unidade} (${dose} ${unidade}/ha × ${fmtNum(areaTotal)} ha — ${tals.map(t => t.nome).join(', ')})`);
      } else {
        const q = Number(it.quantidade_total);
        if (!(q > 0)) throw new Error(`Informe quantidade_total para ${produto} (ou dose_por_ha + talhao_ids).`);
        // Formato antigo (sem dosePorHa): a tela de pedidos mostra o campo "quantidade".
        itensFS.push({ produto, modo, unidade, total: q, quantidade: `${q.toLocaleString('pt-BR')} ${unidade}`, talhoes: [] });
        linhas.push(`  • ${produto}: ${fmtNum(q)} ${unidade}`);
      }
    }
    const dados = { itens: itensFS, status: 'solicitado' };
    if (String(observacoes || '').trim()) dados.observacoes = String(observacoes).trim();
    const resumo = ['🛒 Novo pedido', ...linhas, dados.observacoes ? `Obs.: ${dados.observacoes}` : ''].filter(Boolean).join('\n');
    return this._registrarProposta('pedido', [{ colecao: 'pedidos', dados }], resumo, `criou pedido (${itensFS.map(i => i.produto).join(', ')})`);
  }

  _registrarProposta(tipo, docs, resumo, log) {
    this.propostas.push({ tipo, docs, resumo, log });
    return `Proposta preparada (ainda NÃO gravada). Logo após a sua resposta o usuário recebe este resumo com botões ✅ Confirmar / ❌ Cancelar:\n${resumo}\nNão repita o resumo; diga em uma frase que ele deve conferir e confirmar.`;
  }
}

// Grava uma proposta confirmada. Revalida a permissão no momento da confirmação.
export async function executarProposta(fs, perfil, email, uid, prop) {
  if (prop.tipo === 'pulverizacao' && nivelAcesso(perfil, 'pulverizacao') !== 'admin') throw new Error('Sem permissão para agendar pulverizações.');
  if (prop.tipo === 'pedido' && !ehAdminSistema(perfil)) throw new Error('Sem permissão para criar pedidos.');
  const agora = new Date().toISOString();
  const ids = [];
  for (const d of prop.docs) {
    if (!['pulverizacoes', 'pedidos'].includes(d.colecao)) throw new Error(`Gravação não permitida em ${d.colecao}.`);
    ids.push(await fs.add(d.colecao, { ...d.dados, criadoEm: agora, criadoPor: email, origem: 'telegram' }));
  }
  try {
    await fs.add('logs', { tipo: prop.tipo === 'pedido' ? 'pedido' : 'pulverizacao', mensagem: `${email} ${prop.log} (via Telegram)`, criadoEm: agora, uid });
  } catch (e) { /* log é opcional, como no app */ }
  return ids;
}
