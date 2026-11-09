# Coletor da Estação Km 18 (Tuya/Smart Life → Firestore)

Script Python rodado pelo GitHub Actions (`.github/workflows/clima-tuya.yml`,
a cada 5 min + manual). Plano gratuito: Firebase Spark + Actions, sem Cloud Functions.

## Fonte dos dados
1. **Conta do app Smart Life** (`smartlife.py`, usada sempre que existe login
   salvo em `climaSegredos/smartlife`). SDK oficial `tuya-device-sharing-sdk`,
   o mesmo da integração Tuya do Home Assistant: **não usa a Tuya IoT Core**, então
   não depende de trial/renovação. Só lê o **estado atual**: 1 amostra de cada
   código por execução (~5 min), gravada no último minuto do intervalo e repetida
   até a próxima. Rajada (`raj`) passa a ser a do instante da amostra, não o
   máximo real do minuto. Estação offline no app → nada é gravado.
2. **Tuya IoT Core** (`TUYA_ACCESS_ID/SECRET`, código original): report-logs com
   cada mudança + snapshot. Só é usada se **não** houver login Smart Life — o
   trial da plataforma IoT expira e depende de aprovação da Tuya para renovar.

`status/ultimo.fonte` mostra qual foi usada (`smartlife` / `iot`).

## Login Smart Life (1×, ou quando expirar)
1. No celular, app **Smart Life** (a conta onde a estação está cadastrada):
   **Eu → ⚙️ Configurações → Conta e segurança → Código de usuário**. Copie.
2. GitHub → **Actions** → **"Clima — login Smart Life"** → **Run workflow**,
   cole o código.
3. Abra a execução → passo **"1) Gerar QR code"**: o QR aparece no log. Se a
   leitura falhar pela tela, baixe o artefato **qr-login** (resumo da execução).
4. No app, toque no ícone de **escanear** (canto superior direito da tela
   inicial), leia o QR e **confirme**. O passo **2)** espera até 8 min, grava o
   token e lista os aparelhos da conta (marcando a estação de `TUYA_DEVICE_ID`).
5. Rode o coletor com **"Só diagnóstico"** para ver os códigos que o Smart Life
   devolve (e se falta algum).

O token (access + refresh) é renovado sozinho pelo coletor e regravado a cada
renovação. Fica em `climaSegredos/smartlife`, que as regras do Firestore negam a
todos os usuários do app (só o Admin SDK lê) — **publique o `firestore.rules`
atualizado**. Se o coletor passar a falhar com erro de token (status `⚠️` em
`clima.html`), refaça o login (trocar a senha do Smart Life ou remover a
autorização no app também exige refazer). Para voltar à IoT Core, apague o doc
`climaSegredos/smartlife` no console do Firebase.

O log do workflow mostra o QR e o código de usuário; sozinhos eles não dão acesso
(o login só vale após a confirmação no app, e o token nunca é impresso).

## Rodar manualmente / ver o log
GitHub → aba **Actions** → **"Clima — coletor Tuya (Estação Km 18)"** →
**Run workflow** (branch `main`). Clique na execução → job `coletar` → passo
**"Coletar Tuya → Firestore"**: mostra o intervalo processado, nº de logs e um
resumo por dia (T, UR, P, Rs, ETo). Falhas da fonte aparecem como ⚠️ *warning*
(o job fica verde) e ficam registradas em `status/ultimo`.

O cron do GitHub só roda na branch padrão e pode atrasar alguns minutos; o
cursor absorve atrasos. `clima-keepalive.yml` (dias 1 e 15) reativa o coletor
e a si mesmo pela API, para o GitHub não desativá-los após 60 dias sem commits.

## Firestore — `clima/estacao-km18/…`
| Caminho | Conteúdo |
|---|---|
| (doc `estacao-km18`) | `nome, lat, lng, fuso, campos` |
| `status/cursor` | `ate` (ms, fim do último minuto processado), `ultimoEventTime`, `ultimoReporte`, `estado` (último valor bruto de cada código, p/ carry-forward) |
| `status/ultimo` | `ok, mensagem, data, falhasSeguidas, logsRecebidos, minutosGravados, diasTocados, chamadasTuya` |
| `dias/{YYYY-MM-DD}` | dia local (America/Sao_Paulo): `pontos`, `campos`, `resumo` |
| `resumos/{YYYY-MM-DD}` | só o `resumo` do dia (+ `data`) — leve, para listar histórico |
| `bruto/{ISO}` (`_p2`…) | logs brutos `{c,t,v}` de cada execução + snapshot; apagados após 90 dias |

**`pontos`**: mapa `"HH:MM"` → string CSV com os valores na ordem de `campos`
(vazio = sem valor). Ex.: `"19.3,63,,1008,0.75,2.89,,112,…"`. Strings em vez
de arrays mantêm o doc pequeno (~70–100 KB/dia) e evitam dezenas de milhares
de entradas de índice.

| campo | unidade | origem |
|---|---|---|
| t | °C | temp_current_external ÷10 |
| ur | % | humidity_outdoor |
| orv | °C | dew_point_temp ÷10 |
| p | hPa | atmospheric_pressture (absoluta) |
| u | m/s | windspeed_avg ÷10 ÷3,6 |
| raj | m/s | windspeed_gust ÷10 ÷3,6 — **máximo do minuto** |
| vel | m/s | Wind_speed ÷10 ÷3,6 — **máximo do minuto** |
| dir | ° | Wing_direction (base64: bytes 0-3 = setor "SSE", bytes 5-6 = graus) |
| lux | klux | Light_intensity ÷100 |
| rad | W/m² | klux × 7,9 (aproximação) |
| uv | índice | uv_index |
| sol | min | sunlight_time |
| c1h / c24h | mm | rain_1h / rain_24h ÷10 |
| ctx | mm/h | rain_rate ÷10 |
| cmes | mm | rain_month ÷10 (só snapshot; acumulado do mês da estação, p/ conferência) — coluna acrescentada depois, pontos antigos têm 15 colunas |

Escalas conferidas no modelo do dispositivo (`/v1.0/iot-03/devices/{id}/specification`):
vento km/h scale 1, luz Klux scale 2, temperatura/orvalho °C scale 1, chuva mm scale 1.

**Só via snapshot (fonte IoT):** a API de report-logs recusa `Wind_speed`, `Wing_direction`,
`Light_intensity` e `sunlight_time` (erro 40000303). Eles entram 1× por execução
(~5 min, no horário da propriedade) e são repetidos até a próxima amostra —
então `rad`/`RsMJ` são integrados com amostras de ~5 min e `vel` não é o
máximo real do minuto (use `raj` para rajada).

Demais variáveis: último valor conhecido (carry-forward — a estação só
reporta quando o valor muda). Um minuto é **coberto** (e gravado) se a estação
enviou **qualquer** código nos 30 min anteriores; sem isso fica fora de `pontos`.

**`resumo`**: `Tmax, Tmin, Tmed` (média dos minutos), `URmax, URmin`, `u2med`
(m/s a 2 m = u × 0,947), `rajadaMax` (m/s) / `rajadaMaxKmh` / `rajadaHora`,
`RsMJ` (Σ rad × 60 s), `chuvaMm` (maior rain_24h do dia), `insolacaoMin`
(maior sunlight_time), `Pmed` (hPa), `altitudeEstimadaM` (pela Pmed, FAO-56
eq. 7 invertida), `minutosCobertos`, `coberturaPct` (sobre 1440), `completo`
(≥ 90 %), `chuvaMesMm` (maior rain_month do dia), `DTmin/DTmax/DTmed` (Delta T = T − bulbo úmido de Stull), `horasAptoDrone`/`horasAptoTrator` (minutos com Delta T 2–8 °C, vento ≤ 5/7 km/h e sem chuva — mesmo critério de `clima.html`), `ETo` (mm, FAO-56 Penman-Monteith; `null` se faltar dado).
O dia de hoje é parcial até terminar (`completo:false`).

## Diagnóstico
**Run workflow** com a opção *"Só diagnóstico"* marcada — **não grava dados
da estação**. Com login Smart Life: lista os aparelhos da conta, a especificação
(escala/unidade) e o estado atual de cada código, já convertido, e avisa os
códigos que faltarem. Sem login: lê a IoT Core e imprime o modelo, o snapshot
completo e quantos logs cada código devolve.

## Idempotência
Cada minuto é uma chave; reprocessar um intervalo sobrescreve os mesmos
minutos. O cursor (`ate`) só avança depois que todos os dias foram gravados.
Atrasado, o coletor recupera no máximo 24 h por execução.

## Configuração
Constantes no topo de `coletor.py` (latitude −18,7155016, fuso
America/Sao_Paulo, anemômetro a 2,6 m, endpoint `openapi.tuyaus.com`).
Secrets: `TUYA_DEVICE_ID` (id da estação, o mesmo nas duas fontes),
`FIREBASE_SERVICE_ACCOUNT` (JSON da service account); `TUYA_ACCESS_ID`,
`TUYA_ACCESS_SECRET` só para a fonte IoT (opcionais com login Smart Life).
