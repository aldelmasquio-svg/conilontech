// Testes do firestore.rules no emulador do Firebase (precisa de Java e internet na 1ª vez).
// Diferente dos outros testes de testes/, este usa dependências npm — rode numa pasta à parte:
//   mkdir /tmp/regras && cd /tmp/regras && npm init -y && npm i firebase-tools@13 @firebase/rules-unit-testing@3 firebase@10
//   echo '{"emulators":{"firestore":{"host":"127.0.0.1","port":8085},"ui":{"enabled":false}}}' > firebase.json
//   cp <repo>/testes/regras.test.mjs . && REGRAS=<repo>/firestore.rules npx firebase emulators:exec --only firestore --project demo-conilon "node regras.test.mjs"
// (copiado para lá porque o Node procura os pacotes a partir da pasta do script)
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc, deleteDoc, addDoc, collection, getDocs } from 'firebase/firestore';
import fs from 'fs';

const env = await initializeTestEnvironment({
  projectId: 'demo-conilon',
  firestore: { rules: fs.readFileSync(process.env.REGRAS || new URL('../firestore.rules', import.meta.url), 'utf8'), host: '127.0.0.1', port: 8085 },
});
const USUARIOS = {
  dono:     { perfil: 'admin', modulos: { admin: 'admin' }, ativo: true },
  rafael:   { modulos: { adubacao: 'admin', pulverizacao: 'admin', estoque: 'admin', mapa: 'admin', pedidos: 'admin' }, ativo: true },
  operador: { modulos: { pulverizacao: 'operador', mapa: 'operador', estoque: 'operador', irrigacao: 'nenhum', pedidos: 'nenhum' } },
  lemoa:    { modulos: { atividades: 'encarregado' }, ativo: true },
  inativo:  { modulos: { mapa: 'admin', estoque: 'admin' }, ativo: false },
};
await env.withSecurityRulesDisabled(async ctx => {
  const db = ctx.firestore();
  for (const [uid, d] of Object.entries(USUARIOS)) await setDoc(doc(db, 'usuarios', uid), d);
  await setDoc(doc(db, 'talhoes', 't1'), { nome: 'T1', fazenda: 'Km 18' });
  await setDoc(doc(db, 'config', 'geral'), { fazendas: [] });
  await setDoc(doc(db, 'clima', 'estacao-km18', 'dias', '2026-10-18'), { pontos: {} });
  await setDoc(doc(db, 'vazaoMedidores', 'bomba'), { nome: 'Bomba' });
  await setDoc(doc(db, 'logs', 'l1'), { msg: 'x' });
});
const db = uid => (uid ? env.authenticatedContext(uid) : env.unauthenticatedContext()).firestore();
let ok = 0, falhas = 0;
async function caso(nome, p) { try { await p; ok++; } catch (e) { falhas++; console.log('✗', nome, '-', e.message.split('\n')[0]); } }

// Leitura
await caso('anônimo não lê talhões', assertFails(getDoc(doc(db(null), 'talhoes', 't1'))));
await caso('intruso (sem cadastro) não lê talhões', assertFails(getDoc(doc(db('intruso'), 'talhoes', 't1'))));
await caso('desativado não lê talhões', assertFails(getDoc(doc(db('inativo'), 'talhoes', 't1'))));
await caso('operador lê talhões', assertSucceeds(getDoc(doc(db('operador'), 'talhoes', 't1'))));
await caso('operador lê pulverizações (outro módulo também)', assertSucceeds(getDocs(collection(db('operador'), 'drenchPrevencao'))));
await caso('ativo lê clima (subcoleção)', assertSucceeds(getDoc(doc(db('lemoa'), 'clima', 'estacao-km18', 'dias', '2026-10-18'))));
await caso('desativado lê o próprio perfil (login explica o bloqueio)', assertSucceeds(getDoc(doc(db('inativo'), 'usuarios', 'inativo'))));
await caso('intruso não lista usuários', assertFails(getDocs(collection(db('intruso'), 'usuarios'))));
await caso('ativo lista usuários', assertSucceeds(getDocs(collection(db('operador'), 'usuarios'))));
await caso('desativado não lê config', assertFails(getDoc(doc(db('inativo'), 'config', 'geral'))));

// Cadastro (auto-cadastro)
await caso('cadastro normal (desativado, sem módulos) passa', assertSucceeds(setDoc(doc(db('novo1'), 'usuarios', 'novo1'),
  { nome: 'Novo', email: 'n@x', modulos: { mapa: 'nenhum', admin: 'nenhum' }, ativo: false })));
await caso('cadastro já ativo é recusado', assertFails(setDoc(doc(db('novo2'), 'usuarios', 'novo2'), { nome: 'N', modulos: {}, ativo: true })));
await caso('cadastro como admin é recusado', assertFails(setDoc(doc(db('novo3'), 'usuarios', 'novo3'), { perfil: 'admin', ativo: false })));
await caso('cadastro com módulo admin é recusado', assertFails(setDoc(doc(db('novo4'), 'usuarios', 'novo4'), { modulos: { admin: 'admin' }, ativo: false })));
await caso('cadastro em nome de outro é recusado', assertFails(setDoc(doc(db('novo5'), 'usuarios', 'outro'), { ativo: false })));
await caso('usuário não se auto-promove', assertFails(updateDoc(doc(db('rafael'), 'usuarios', 'rafael'), { 'modulos.admin': 'admin' })));
await caso('usuário não se reativa', assertFails(updateDoc(doc(db('inativo'), 'usuarios', 'inativo'), { ativo: true })));
await caso('dono ativa usuário', assertSucceeds(updateDoc(doc(db('dono'), 'usuarios', 'novo1'), { ativo: true })));

// Escrita por módulo
await caso('mapa: operador de mapa grava talhão', assertSucceeds(updateDoc(doc(db('operador'), 'talhoes', 't1'), { obs: 'a' })));
await caso('mapa: lemoa (sem mapa) não grava talhão', assertFails(updateDoc(doc(db('lemoa'), 'talhoes', 't1'), { obs: 'b' })));
await caso('desativado não grava', assertFails(updateDoc(doc(db('inativo'), 'talhoes', 't1'), { obs: 'c' })));
await caso('intruso não grava', assertFails(setDoc(doc(db('intruso'), 'pulverizacoes', 'p1'), { x: 1 })));
await caso('pulverização: operador grava', assertSucceeds(setDoc(doc(db('operador'), 'pulverizacoes', 'p1'), { talhaoId: 't1' })));
await caso('pulverização dá baixa no estoque', assertSucceeds(addDoc(collection(db('operador'), 'estoque_movimentacoes'), { qtd: 1 })));
await caso('drench herda de pulverização', assertSucceeds(setDoc(doc(db('operador'), 'drenchPrevencao', 'd1'), { x: 1 })));
await caso('irrigação "nenhum" explícito não grava setores', assertFails(setDoc(doc(db('operador'), 'irrigacaoRegistros', 'i1'), { x: 1 })));
await caso('pedidos "nenhum" explícito bloqueia cotações (herança)', assertFails(setDoc(doc(db('operador'), 'cotacoes', 'c1'), { x: 1 })));
await caso('módulo aberto por padrão: lemoa grava equipe', assertSucceeds(setDoc(doc(db('lemoa'), 'equipeRegistros', 'e1'), { x: 1 })));
await caso('módulo com trava: lemoa não grava herbicida', assertFails(setDoc(doc(db('lemoa'), 'herbicidaRegistros', 'h1'), { x: 1 })));
await caso('adubação grava setores de irrigação (fertirrigação)', assertSucceeds(setDoc(doc(db('rafael'), 'irrigacaoSetores', 's1'), { x: 1 })));
await caso('coleção desconhecida: só o dono grava', assertFails(setDoc(doc(db('rafael'), 'colecaoNova', 'x'), { x: 1 })));
await caso('coleção desconhecida: dono grava', assertSucceeds(setDoc(doc(db('dono'), 'colecaoNova', 'x'), { x: 1 })));
await caso('subcoleção segue a coleção-mãe', assertSucceeds(setDoc(doc(db('operador'), 'pulverizacoes', 'p1', 'fotos', 'f1'), { x: 1 })));

await caso('análise exige nível explícito: admin de estoque não grava análises', assertFails(setDoc(doc(db('rafael'), 'analises', 'a1'), { x: 1 })));
await caso('dono grava análises', assertSucceeds(setDoc(doc(db('dono'), 'analises', 'a1'), { x: 1 })));

// Especiais
await caso('config: só dono grava', assertFails(setDoc(doc(db('rafael'), 'config', 'geral'), { x: 1 })));
await caso('config: dono grava', assertSucceeds(updateDoc(doc(db('dono'), 'config', 'geral'), { x: 1 })));
await caso('catálogo de adubos: só dono', assertFails(setDoc(doc(db('rafael'), 'catalogo_adubos', 'a'), { x: 1 })));
await caso('logs: ativo registra', assertSucceeds(addDoc(collection(db('lemoa'), 'logs'), { msg: 'oi' })));
await caso('logs: ninguém apaga o passado', assertFails(deleteDoc(doc(db('rafael'), 'logs', 'l1'))));
await caso('clima: nem o dono grava', assertFails(setDoc(doc(db('dono'), 'clima', 'estacao-km18'), { x: 1 })));
await caso('ESP32 (sem cadastro) grava leitura de vazão', assertSucceeds(setDoc(doc(db('esp32'), 'vazaoMedidores', 'bomba', 'dias', '2026-10-18'), { p: 1 })));
await caso('ESP32 atualiza último valor', assertSucceeds(updateDoc(doc(db('esp32'), 'vazaoMedidores', 'bomba'), { ultimo: { v: 1 } })));
await caso('ESP32 cria alerta', assertSucceeds(addDoc(collection(db('esp32'), 'vazaoAlertas'), { texto: 'x' })));
await caso('ESP32 lê config de vazão', assertSucceeds(getDoc(doc(db('esp32'), 'vazaoConfig', 'geral'))));
await caso('vazaoConfig: operador sem irrigação não grava', assertFails(setDoc(doc(db('operador'), 'vazaoConfig', 'geral'), { x: 1 })));
await caso('assistente: app não lê conversas', assertFails(getDoc(doc(db('dono'), 'assistenteConversas', 'c'))));

console.log(`\n${ok} ok, ${falhas} falha(s)`);
await env.cleanup();
process.exit(falhas ? 1 : 0);
