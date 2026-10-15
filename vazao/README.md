# Medidores de vazão (TUF-2000M → ESP32 → Firestore)

Cada medidor ultrassônico ganha um **ESP32 + módulo RS485** que lê o aparelho por
Modbus RTU a cada 10 s e grava no Firestore a cada minuto, pelo Wi-Fi. No app, a
tela **Irrigação → 💧 Vazão** mostra os medidores ao vivo, compara a vazão da
**bomba** com a da **lavoura** (diferença em %, alerta de vazamento) e traz o
gráfico e o volume do dia.

## Material (por medidor)
| Item | Obs. |
|---|---|
| ESP32 DevKit (ESP32-WROOM-32) | qualquer "ESP32 Dev Module" |
| Conversor TTL↔RS485 **automático** (só VCC/TXD/RXD/GND no lado TTL; borne A+/B−) | `PIN_DE = -1` (padrão). Módulo com DE/RE (MAX3485): `PIN_DE = 4` |
| Conversor step-down → 5 V (mini-560 ou similar) | alimentado pelo mesmo V+/V− do medidor — **meça a tensão antes** |
| Fios e prensa-cabo | tudo dentro da caixa do medidor |

## Ligação
```
Medidor 485+   ──  A+  (conversor RS485)
Medidor 485−   ──  B−  (conversor RS485)
Conversor TXD  ──  TX2 (GPIO17 do ESP32)
Conversor RXD  ──  RX2 (GPIO16)
Conversor VCC  ──  3V3 do ESP32   (nunca o VIN)
Conversor GND  ──  GND do ESP32
Step-down 5 V  ──  VIN e GND do ESP32 (entrada: V+/V− do medidor)
                   ou: carregador USB 5 V no conector USB-C (sem step-down)
```
Se não vier nenhuma leitura: inverta TXD/RXD (cada fabricante etiqueta de um jeito); depois, A+/B−.

## Ajustes no medidor (teclado)
| Menu | Ajuste |
|---|---|
| **M63** | protocolo → **MODBUS_RTU** (de fábrica vem MODBUS ASCII) |
| **M62** | 9600, sem paridade, 8 bits, 1 stop |
| **M46** | endereço 1 (pode ser 1 nos dois — cada um tem o seu ESP32) |
| **M32** | unidade do totalizador em **m³** |
| **M34** | totalizador NET **ligado** |
| **M26** | depois de ajustar, gravar na memória flash |

## Conta do dispositivo
Firebase Console → **Authentication → Usuários → Adicionar usuário** (ex.:
`vazao@conilontech.app` + senha forte). Não precisa de doc em `usuarios` — ela
não entra no app, só grava dados. A regra genérica do `firestore.rules` (logado
pode escrever em coleções operacionais) já cobre `vazaoMedidores`.

## Gravar o programa
1. Arduino IDE → instalar o pacote **esp32** (Espressif) e a biblioteca **ModbusMaster** (Doc Walker).
2. Copiar `medidor_vazao/config.exemplo.h` para `medidor_vazao/config.h` e preencher
   Wi-Fi, `MEDIDOR_ID` (`bomba` num, `lavoura` no outro), e-mail/senha da conta.
   O `config.h` está no `.gitignore` — não vai para o GitHub.
3. Abrir `medidor_vazao/medidor_vazao.ino`, placa **ESP32 Dev Module**, carregar.
4. Monitor serial a 115200: deve aparecer `Login OK` e, a cada minuto, a vazão média.

**Primeira conferência:** a vazão no app tem de bater com o display (M01). Se vier
um número absurdo (ex. `1e-38`), troque `WORD_SWAP` no `config.h`. Confira também
o total contra o display (M00/M02).

## Alertas
Configurados no app (**💧 Vazão → ⚙️ Configuração**, admin) e avaliados pelo próprio ESP32 a
cada leitura (10 s), mesmo com o app fechado. O ESP32 relê os limites a cada 5 min.

| Alerta | Quando | Configuração |
|---|---|---|
| Vazão **baixa** | bomba rodando (> 0,5 m³/h) e vazão abaixo do mínimo por N min | `alertaMin` no medidor |
| Vazão **alta** | vazão acima do máximo por N min | `alertaMax` no medidor |
| **Diferença** bomba × lavoura | só no medidor de referência: diferença maior que o limite % por N min, os dois online e com fluxo | `alertaDif` + `limitePct` em `vazaoConfig/geral` |
| **Medidor não responde** | 10 min sem resposta do RS485 | sempre ligado |
| Bomba **ligou / desligou** | fluxo começou ou parou (estável por 1 min); o desligou traz tempo rodando e volume | `alertaLigaDesliga` no medidor |

N = `alertaMinutos` (padrão 5). Cada alerta avisa uma vez ao começar e uma vez quando normaliza
(bomba que **para** encerra o alerta de vazão baixa sem aviso — parada não é problema).
Bomba parada não gera alerta de vazão baixa; para detectar "deveria estar ligada e não está"
é preciso saber o estado da bomba (futuro: medidor de energia ou o comando de partida).

Todo aviso vai para a coleção `vazaoAlertas` (lista no app) e, se configurado, para o Telegram.

### Alertas no Telegram (opcional)
1. No Telegram, fale com **@BotFather** → `/newbot` → dê um nome → ele devolve o **token**
   (algo como `123456789:AAH...`).
2. Crie um **grupo** com as pessoas que devem receber os avisos e adicione o bot nele.
   Mande qualquer mensagem no grupo.
3. No navegador, abra `https://api.telegram.org/bot<TOKEN>/getUpdates` e procure
   `"chat":{"id":-100...` — esse número (com o `-`) é o **chat id**.
4. Preencha `TELEGRAM_TOKEN` e `TELEGRAM_CHAT` no `config.h` e grave o ESP32 de novo.

O token fica só no `config.h` (fora do GitHub), nunca no Firestore.

## Firestore
| Caminho | Conteúdo |
|---|---|
| `vazaoMedidores/{id}` | `alertaMin`, `alertaMax` (m³/h, 0 = desligado), `alertaMinutos`, `alertaLigaDesliga` — editados no app · `ultimo` `{ok, vazao (m³/h, média do minuto), total (m³, totalizador NET), q (sinal 0–99), erro, unidadeTotal, rssi, pendentes, fw, dia, hora, ts (ms)}` — gravado pelo ESP32 · `nome` — editado no app |
| `vazaoMedidores/{id}/dias/{AAAA-MM-DD}` | `pontos` mapa `hHHMM` → `"vazao,total,q"`, `campos:"vazao,total,q"` (uma chave por minuto, hora local) |
| `vazaoConfig/geral` | `{ref, comp, limitePct, alertaDif}` — par comparado, limite % e se a diferença gera alerta; editado no app (admin) |
| `vazaoAlertas/{auto}` | `{medidor, tipo (baixa/alta/diferenca/semResposta/liga/desliga), nivel (alerta/normal/info), texto, dia, hora, ts}` — gravado pelo ESP32 |

O ESP32 grava com `PATCH` + `updateMask`, então nunca apaga o `nome` dado no app.
São 2 gravações por minuto por medidor (~5,8 mil/dia para dois) — dentro da cota
gratuita do Firebase (20 mil/dia).

## Sem internet / falhas
* Sem Wi-Fi, os minutos ficam numa fila na RAM (até 3 h) e sobem quando a rede volta.
  Desligou o ESP32, a fila se perde — mas o **totalizador do medidor não perde nada**,
  então o volume do dia continua certo (só o gráfico fica com buraco).
* Com Wi-Fi há 30 min e nenhuma gravação bem-sucedida, o ESP32 reinicia sozinho.
* No app: **offline** = o ESP32 não grava há mais de 3 min; **medidor não responde** =
  o ESP32 está online mas não lê o RS485; **sinal fraco** = Q < 60 (transdutor mal
  acoplado, cano vazio ou com ar).

## Registradores usados (TUF-2000M, nº do protocolo; endereço Modbus = nº − 1)
`0001-0002` vazão REAL4 m³/h · `0025-0026` totalizador NET LONG · `0027-0028` fração REAL4 ·
`0072` erros (bits) · `0092` qualidade Q (byte baixo) · `1438` unidade do totalizador ·
`1439` multiplicador do totalizador (n → ×10^(n−3)).
O manual em português que veio com o aparelho não traz essa tabela — ela é a do
TUF-2000M padrão. Se algo não bater, peça ao suporte o "protocolo Modbus" do modelo.

## Segurança
O ESP32 usa TLS sem verificar o certificado (`setInsecure`) para não ter de
gravar e renovar certificados no firmware. A conta do dispositivo só tem o poder
de qualquer usuário logado; use uma senha forte e exclusiva.
