// Permissões compartilhadas pelas páginas (fonte única; antes cada página tinha sua cópia).
// Só leitura do perfil já carregado: nada aqui acessa o Firestore.

// Ferramentas derivadas herdam do módulo-pai quando não definidas explicitamente (retrocompat)
const HERANCA = { drench: 'pulverizacao', cotacoes: 'pedidos' };

export function nivelDoPerfil(perfil, mod) {
  const mods = perfil?.modulos || {};
  if (mods[mod]) return mods[mod];
  if (HERANCA[mod] && mods[HERANCA[mod]]) return mods[HERANCA[mod]];
  if (perfil?.perfil === 'admin') return 'admin';
  return 'nenhum';
}

// Dono/administrador do sistema: mesma regra do isAdmin() do firestore.rules.
// (Antes era "admin de qualquer módulo", o que dava poderes de admin em módulos alheios.)
export function adminDoSistema(perfil) {
  return perfil?.perfil === 'admin' || perfil?.modulos?.admin === 'admin';
}

// Para o bootstrap das páginas: bloqueia só quando o admin marcou o módulo como 'nenhum'.
// Módulo ausente no perfil não bloqueia, para não tirar de ninguém um acesso que já usa hoje.
export function semAcessoAoModulo(perfil, mod) {
  return !adminDoSistema(perfil) && perfil?.modulos?.[mod] === 'nenhum';
}

// Módulos "abertos por padrão": a página só trava quando o admin marcou 'nenhum' explicitamente
// (páginas anteriores à trava, ou sem trava nenhuma). Os demais exigem nível definido no perfil.
const ABERTOS = new Set(['adubacao', 'pulverizacao', 'equipe', 'estoque', 'pedidos', 'cotacoes',
  'gestao', 'clima', 'analises', 'recomendacoes', 'planejamento']);

// O usuário consegue abrir a ferramenta? Espelha a trava do bootstrap de cada página —
// usado pelo menu, pelos atalhos e pelos blocos do Dashboard para não oferecer o que a página recusa.
export function podeAbrir(perfil, mod) {
  if (!mod || adminDoSistema(perfil)) return true;
  if (ABERTOS.has(mod)) return !semAcessoAoModulo(perfil, mod);
  return nivelDoPerfil(perfil, mod) !== 'nenhum';
}
