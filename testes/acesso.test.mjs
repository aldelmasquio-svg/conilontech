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
console.log('acesso.js: ok');
