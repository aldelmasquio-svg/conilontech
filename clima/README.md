# Coletor da Estação Km 18 (Tuya → Firestore)

Script Python rodado pelo GitHub Actions (`.github/workflows/clima-tuya.yml`,
a cada 5 min + manual). Plano gratuito: Firebase Spark + Actions, sem Cloud Functions.

## Rodar manualmente / ver o log
GitHub → aba **Actions** → **"Clima — coletor Tuya (Estação Km 18)"** →
**Run workflow** (branch `main`). Clique na execução → job `coletar` → passo
**"Coletar Tuya → Firestore"**: mostra o intervalo processado, nº de logs e um
resumo por dia (T, UR, P, Rs, ETo). Falhas da Tuya aparecem como ⚠️ *warning*
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
| dir | ° | Wing_direction (base64, últimos 2 bytes big-endian — hipótese) |
| lux | klux | Light_intensity ÷100 |
| rad | W/m² | klux × 7,9 (aproximação) |
| uv | índice | uv_index |
| sol | min | sunlight_time |
| c1h / c24h | mm | rain_1h / rain_24h ÷10 |
| ctx | mm/h | rain_rate ÷10 |

Demais variáveis: último valor conhecido (carry-forward — a estação só
reporta quando o valor muda). Um minuto é **coberto** (e gravado) se a estação
enviou **qualquer** código nos 30 min anteriores; sem isso fica fora de `pontos`.

**`resumo`**: `Tmax, Tmin, Tmed` (média dos minutos), `URmax, URmin`, `u2med`
(m/s a 2 m = u × 0,947), `rajadaMax` (m/s) / `rajadaMaxKmh` / `rajadaHora`,
`RsMJ` (Σ rad × 60 s), `chuvaMm` (maior rain_24h do dia), `insolacaoMin`
(maior sunlight_time), `Pmed` (hPa), `altitudeEstimadaM` (pela Pmed, FAO-56
eq. 7 invertida), `minutosCobertos`, `coberturaPct` (sobre 1440), `completo`
(≥ 90 %), `ETo` (mm, FAO-56 Penman-Monteith; `null` se faltar dado).
O dia de hoje é parcial até terminar (`completo:false`).

## Idempotência
Cada minuto é uma chave; reprocessar um intervalo sobrescreve os mesmos
minutos. O cursor (`ate`) só avança depois que todos os dias foram gravados.
Atrasado, o coletor recupera no máximo 24 h por execução.

## Configuração
Constantes no topo de `coletor.py` (latitude −18,7155016, fuso
America/Sao_Paulo, anemômetro a 2,6 m, endpoint `openapi.tuyaus.com`).
Secrets: `TUYA_ACCESS_ID`, `TUYA_ACCESS_SECRET`, `TUYA_DEVICE_ID`,
`FIREBASE_SERVICE_ACCOUNT` (JSON da service account).
