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
| Módulo TTL↔RS485 **3,3 V** (MAX3485) | ou módulo com direção automática (aí `PIN_DE = -1`) |
| Conversor step-down → 5 V (mini-560 ou similar) | alimentado pelo mesmo V+/V− do medidor — **meça a tensão antes** |
| Fios e prensa-cabo | tudo dentro da caixa do medidor |

## Ligação
```
Medidor 485+  ──  A  (módulo RS485)
Medidor 485−  ──  B  (módulo RS485)
Módulo RO     ──  GPIO16 (ESP32)
Módulo DI     ──  GPIO17
Módulo DE+RE  ──  GPIO4   (juntos; não existe em módulo automático)
Módulo VCC/GND──  3V3 / GND do ESP32
Step-down 5 V ──  pino 5V/VIN e GND do ESP32 (entrada: V+/V− do medidor)
```
Se não vier nenhuma leitura, inverta A e B (é comum a serigrafia vir trocada).

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

## Firestore
| Caminho | Conteúdo |
|---|---|
| `vazaoMedidores/{id}` | `ultimo` `{ok, vazao (m³/h, média do minuto), total (m³, totalizador NET), q (sinal 0–99), erro, unidadeTotal, rssi, pendentes, fw, dia, hora, ts (ms)}` — gravado pelo ESP32 · `nome` — editado no app |
| `vazaoMedidores/{id}/dias/{AAAA-MM-DD}` | `pontos` mapa `hHHMM` → `"vazao,total,q"`, `campos:"vazao,total,q"` (uma chave por minuto, hora local) |
| `vazaoConfig/geral` | `{ref, comp, limitePct}` — par comparado e limite de alerta, editado no app (admin) |

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
