// Copie este arquivo para `config.js` e ajuste. (config.js fica fora do git.)
export default {
  // Grupo do WhatsApp onde caem os relatórios. No 1º run o robô imprime os grupos
  // e o JID de cada um — copie o JID do grupo certo pra grupoJid (mais seguro que o nome).
  grupoNome: 'RELATÓRIO GRANFARM',
  grupoJid: '', // ex.: '120363000000000000@g.us'

  // E-mail que vai constar como autor dos lançamentos (use um usuário que existe no app).
  criadoPor: 'aldelmasquio@gmail.com',

  // Conta de serviço do Firebase (Admin SDK). Baixe no console do Firebase
  // (Configurações do projeto → Contas de serviço → Gerar nova chave) e salve aqui.
  // Alternativa: definir a env FIREBASE_SERVICE_ACCOUNT com o JSON inteiro.
  serviceAccountPath: './service-account.json',

  // true = o robô responde "🤖 Lancei no sistema: ..." no próprio grupo (bom pra conferir).
  responderNoGrupo: true,

  // De-para de nomes: quando o nome no relatório não é igual ao nome da fazenda no app.
  // Chave = como vem no WhatsApp; valor = nome EXATO da fazenda no app.
  fazendaAlias: {
    // 'FAZENDA AEROPORTO/ SÍTIO ELIANE': 'Fazenda Aeroporto',
    // 'SÍTIO PRATO QUEBRADO': 'Sítio Prato Quebrado',
  },
};
