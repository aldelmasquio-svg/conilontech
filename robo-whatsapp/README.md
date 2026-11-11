# Robô do WhatsApp → Recebimentos + Estoque

Lê os relatórios do grupo do WhatsApp ("Entrada de Produtos" / "Transferência de Produtos")
e lança **automaticamente** em `recebimentos` e no **estoque** (saldo), com `origem:'whatsapp'`
pra você revisar no app. Usa **Baileys** (leve, sem navegador) e o **Admin SDK** do Firebase.

> ⚠️ **Avisos honestos**
> - Isso usa o WhatsApp de um jeito **não oficial**. Use um **número/chip DEDICADO** (nunca o seu
>   principal): se o WhatsApp detectar automação, pode **banir esse número**.
> - É **tudo automático**: um relatório lido errado mexe no **saldo**. Dá pra desfazer no app
>   (apagar o recebimento e as movimentações), mas dá trabalho. Revise de vez em quando.
> - A sessão do WhatsApp às vezes cai (precisa reler o QR). Mantenha o celular ligado na tomada.

## O que ele faz

- **Entrada de Produtos** (Compra) → cria recebimento `tipo:'compra'` + **entrada** no estoque da fazenda.
- **Transferência de Produtos** → cria recebimento `tipo:'transferencia'` + **saída na origem** e **entrada no destino** no estoque.
- Se o nome da fazenda **não casar** com o app, cria o recebimento mesmo assim (com aviso em `obs`) e **pula** o estoque — nada se perde, você ajusta no app.
- Cada mensagem é processada **uma única vez** (guarda o id em `roboWhatsappProcessados`), mesmo que o robô reinicie.

## Instalar no celular velho (Android, Termux)

1. Instale o **Termux** pelo **F‑Droid** (o do Google Play é desatualizado).
2. No Termux:
   ```bash
   pkg update && pkg install nodejs git -y
   git clone https://github.com/aldelmasquio-svg/conilontech.git
   cd conilontech/robo-whatsapp
   npm install
   ```
3. **Conta de serviço do Firebase:** no console do Firebase → Configurações do projeto →
   Contas de serviço → *Gerar nova chave privada*. Salve o arquivo como
   `robo-whatsapp/service-account.json` (esse arquivo é **secreto**, nunca compartilhe).
4. Configure:
   ```bash
   cp config.example.js config.js
   nano config.js   # ajuste criadoPor, o grupo e (se precisar) o fazendaAlias
   ```
5. Rode:
   ```bash
   npm start
   ```
   - Aparece um **QR** no terminal → abra o WhatsApp **do número dedicado** → Aparelhos conectados → Conectar um aparelho → escaneie.
   - O robô lista os grupos e o **JID** de cada um. Copie o JID do grupo certo pra `grupoJid` no `config.js` (mais confiável que pelo nome).
   - Adicione o número dedicado **ao grupo** dos relatórios.

## Deixar rodando 24/7

```bash
termux-wake-lock          # impede o Android de matar o Termux
npm start
```
- Desative a otimização de bateria do Termux (Ajustes do Android → Apps → Termux → Bateria → Sem restrição).
- Mantenha o celular **na tomada**.
- Se cair, é só rodar `npm start` de novo (a sessão fica salva em `auth_info/`, não precisa reler o QR — a não ser que apareça "deslogado").

## Testar o leitor (sem WhatsApp)

```bash
npm test
```
Roda o parser nos exemplos reais dos relatórios. Se mudar o formato das mensagens, ajuste
`parser.js` e rode de novo.

## Arquivos

- `parser.js` — lê o texto do relatório e devolve blocos estruturados (compra/transferência).
- `firestore.js` — escreve recebimento + estoque (mesmo shape do app), com Admin SDK.
- `processar.js` — junta parser + escrita; decide quando pular o estoque.
- `index.js` — conecta no WhatsApp (Baileys) e dispara o processamento.
- `config.js` / `service-account.json` / `auth_info/` — **ficam fora do git** (`.gitignore`).

> Nota: a versão do Baileys muda com frequência e o WhatsApp às vezes quebra a lib. Se o
> `npm install`/conexão falhar, atualize `@whiskeysockets/baileys` no `package.json` e me avise.
