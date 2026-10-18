// node testes/acesso.test.mjs  — regras de permissão de acesso.js
import assert from 'assert/strict';
import { nivelDoPerfil, adminDoSistema, semAcessoAoModulo } from '../acesso.js';

const dono = { modulos: { admin: 'admin', pedidos: 'admin' } };
const herbicidaAdmin = { modulos: { herbicida: 'admin', pedidos: 'operador', gestao: 'nenhum' } };

assert.equal(adminDoSistema(dono), true);
assert.equal(adminDoSistema({ perfil: 'admin' }), true);
assert.equal(adminDoSistema(herbicidaAdmin), false, 'admin de um módulo não é admin do sistema');
assert.equal(nivelDoPerfil(herbicidaAdmin, 'pedidos'), 'operador');
assert.equal(nivelDoPerfil({ modulos: { pedidos: 'admin' } }, 'cotacoes'), 'admin', 'cotações herda de pedidos');
assert.equal(nivelDoPerfil({ modulos: { pulverizacao: 'gerente' } }, 'drench'), 'gerente', 'drench herda de pulverização');
assert.equal(nivelDoPerfil({ modulos: {} }, 'estoque'), 'nenhum');
assert.equal(semAcessoAoModulo(herbicidaAdmin, 'gestao'), true, 'nenhum explícito bloqueia');
assert.equal(semAcessoAoModulo(herbicidaAdmin, 'estoque'), false, 'módulo ausente não bloqueia');
assert.equal(semAcessoAoModulo({ modulos: { admin: 'admin', gestao: 'nenhum' } }, 'gestao'), false, 'dono nunca é bloqueado');


// podeAbrir — espelha a trava de cada página (menu/atalhos/dashboard usam isto)
import { podeAbrir } from '../acesso.js';
const operador = { modulos: { herbicida: 'operador', gestao: 'nenhum', mapa: 'nenhum' } };
assert.equal(podeAbrir(operador, 'herbicida'), true);
assert.equal(podeAbrir(operador, 'irrigacao'), false, 'módulo com trava exige nível no perfil');
assert.equal(podeAbrir(operador, 'mapa'), false);
assert.equal(podeAbrir(operador, 'estoque'), true, 'módulo aberto por padrão: ausente não bloqueia');
assert.equal(podeAbrir(operador, 'gestao'), false, 'aberto por padrão, mas nenhum explícito bloqueia');
assert.equal(podeAbrir(operador, 'clima'), true);
assert.equal(podeAbrir({ modulos: { pulverizacao: 'operador' } }, 'drench'), true, 'drench herda de pulverização');
assert.equal(podeAbrir({ modulos: { admin: 'admin', mapa: 'nenhum' } }, 'mapa'), true, 'dono abre tudo');
assert.equal(podeAbrir(operador, undefined), true, 'item sem módulo (Dashboard) sempre aparece');
console.log('podeAbrir: ok');
console.log('acesso.js: ok');
