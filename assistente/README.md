# Assistente no Telegram

Bot do Telegram que conversa com os dados do app. Você pergunta em linguagem normal ("o que tem programado essa semana na Km 18?", "saldo de KCl?", "quanto choveu esse mês?") e ele consulta o Firestore e responde. Ele também agenda pulverizações e cria pedidos de produto, mas só grava depois que você toca em **✅ Confirmar** no resumo que ele manda.

```
Telegram ──webhook──▶ Cloudflare Worker (assistente/src) ──▶ Claude (API da Anthropic)
                                 │                                 │ pede consultas
                                 └──── Firestore (REST, conta de serviço) ◀┘
```

- **Áudio:** é só mandar uma mensagem de voz.
  - O bot transcreve com o Whisper do **Workers AI**, que roda no próprio Cloudflare (não precisa de outra conta). Ele recebe os nomes dos talhões e fazendas para acertar o vocabulário.
  - Antes de responder, o bot mostra o que entendeu (🎤 «…»), para você conferir na hora se ele errou um nome ou número.
  - Áudios de até 5 minutos.
- **Leitura:** qualquer módulo do app, respeitando as permissões do usuário em `admin.html` (o nível por módulo e as fazendas liberadas). `usuarios`, `logs` e fotos ficam de fora.
- **Gravação:** só pulverização (`pulverizacoes`, um registro por talhão, como no app) e pedido (`pedidos`, status `solicitado`). Os registros saem com `origem: 'telegram'` e `criadoPor` igual ao e-mail do usuário. A permissão é a mesma do app: admin de Pulverização para agendar, admin para criar pedido. Ela é conferida de novo no momento da confirmação. A proposta vale por 2 horas.
- **Coleções do próprio assistente:**
  - `assistenteConversas/{chatId}`: as últimas mensagens da conversa (só texto).
  - `assistentePropostas/{id}`: cada proposta e o que aconteceu com ela (pendente, gravada, cancelada, expirada ou erro).
  - O app não lê nenhuma das duas.

## Comandos no bot

- `/start` ou `/ajuda`: mostra o que o bot faz.
- `/limpar`: começa uma conversa nova (apaga o histórico).

## Como colocar no ar (uma vez)

Dá para fazer tudo pelo navegador, sem instalar nada no computador.

### 1. Criar o bot no Telegram
1. No Telegram, abra o **@BotFather** e mande `/newbot`.
2. Escolha um nome (ex.: *Conilon Tech*) e um usuário terminado em `bot` (ex.: `conilontech_fazenda_bot`).
3. Guarde o **token** que ele devolve (algo como `123456:ABC-...`).

### 2. Chave da API do Claude
1. Entre em <https://console.anthropic.com>, vá em **Billing** e coloque créditos.
2. Em **API Keys**, crie uma chave e guarde.

### 3. Conta no Cloudflare (gratuita)
1. Crie a conta em <https://dash.cloudflare.com>.
2. Em **Workers & Pages**, ative o subdomínio `*.workers.dev`.
3. Anote o **Account ID** (fica na lateral da página de Workers).
4. Em **My Profile → API Tokens → Create Token**, escolha o modelo **Edit Cloudflare Workers**.
5. Antes de criar, clique em **+ Add more** e acrescente a permissão **Account → Workers AI → Edit**. Ela é usada para transcrever os áudios.
6. Crie o token e guarde.

### 4. Segredos no GitHub
No repositório, vá em **Settings → Secrets and variables → Actions → New repository secret** e crie:

| Segredo | Valor |
|---|---|
| `CLOUDFLARE_API_TOKEN` | token do passo 3 |
| `CLOUDFLARE_ACCOUNT_ID` | Account ID do passo 3 |
| `TELEGRAM_TOKEN` | token do BotFather |
| `TELEGRAM_WEBHOOK_SECRET` | uma senha que você inventa, só letras e números, longa (ex.: `fazenda2026xyzABC123`) |
| `TELEGRAM_USUARIOS` | por enquanto `{}` (será preenchido no passo 6) |
| `ANTHROPIC_API_KEY` | chave do passo 2 |

O `FIREBASE_SERVICE_ACCOUNT` **já existe** (é o mesmo que o coletor do clima usa).

### 5. Publicar
1. Vá em **Actions → "Assistente Telegram — publicar no Cloudflare" → Run workflow**.
2. Ao terminar, o endereço aparece no log (ex.: `https://conilontech-assistente.SEU-USUARIO.workers.dev`).
3. Abra no navegador, uma única vez:

   `https://conilontech-assistente.SEU-USUARIO.workers.dev/configurar?chave=SUA_SENHA_DO_WEBHOOK`

   Deve aparecer `"ok":true`. Isso liga o bot ao Worker.

### 6. Liberar as pessoas
1. Cada pessoa abre o bot no Telegram e manda qualquer mensagem. O bot responde com o **ID do Telegram** dela.
2. Edite o segredo `TELEGRAM_USUARIOS` ligando cada ID ao e-mail com que a pessoa entra no app:
   ```json
   {"123456789":"dono@gmail.com","987654321":"encarregado@gmail.com"}
   ```
3. Rode o workflow de novo (passo 5) para aplicar.

A partir daí, cada pessoa vê pelo bot o mesmo que vê no app.

## Custos

- **Cloudflare:** o plano gratuito cobre o volume de mensagens.
  - Esse plano limita a 10 ms o tempo de processamento por mensagem. Perguntas que trazem muitos dados podem passar disso.
  - Se o log do Worker mostrar `Exceeded CPU limit` (veja em **Workers → conilontech-assistente → Logs**), mude para o plano **Workers Paid** (US$ 5/mês).
- **Áudio (Workers AI):** o plano gratuito inclui 10.000 "neurons" por dia, o que dá cerca de 200 minutos de áudio por dia. Acima disso, custa cerca de US$ 0,0005 por minuto.
- **Claude:** cobrado por uso na conta da Anthropic.
  - Com o modelo padrão (`claude-opus-5-5`), uma pergunta típica com 2 ou 3 consultas custa em torno de **US$ 0,05 a 0,20**.
  - Perguntas que leem muitos registros custam mais. O gasto real aparece em **console.anthropic.com → Usage**.
  - Para gastar menos, troque `MODELO` em `wrangler.toml` para `claude-sonnet-5-5` (cerca de metade do preço) ou `claude-haiku-5-5` (bem mais barato, mas entende menos as perguntas complexas). Depois publique de novo.

## Desenvolvimento

- `src/index.js`: webhook do Telegram, a conversa com o Claude e os botões Confirmar/Cancelar.
- `src/ferramentas.js`: as ferramentas que o Claude pode chamar (`listar_talhoes`, `consultar`, `ler_documento`, `propor_pulverizacao`, `propor_pedido`) e as regras de permissão (cópia de `nivelAcesso` e `fazendaPermitida` do app).
- `src/prompt.js`: instruções e o mapa das coleções.
  - O texto precisa ficar fixo para o cache de prompt funcionar; data e hora vão na mensagem.
  - Quando um módulo novo do app criar uma coleção, registre-a em `COLECOES` (`ferramentas.js`) e descreva os campos aqui.
- `src/audio.js`: transcrição das mensagens de voz (Whisper `@cf/openai/whisper-large-v3-turbo` via binding `AI`, idioma `pt`, `initial_prompt` com o vocabulário da fazenda).
- `src/firestore.js`: cliente REST do Firestore. Gera o token da conta de serviço com WebCrypto, porque o Worker não roda o Admin SDK.

O histórico da conversa é guardado só como texto, sem os blocos de raciocínio do modelo, e por isso pode ser cortado sem problema. Dentro de uma mesma pergunta, a lista de mensagens só cresce (nada é editado).

Para publicar da sua máquina em vez do GitHub Actions:

```bash
cd assistente
npm install
npx wrangler login
npx wrangler secret put TELEGRAM_TOKEN   # repita para cada segredo da tabela
npx wrangler deploy
npx wrangler tail                        # logs em tempo real
```
