// ─────────────────────────────────────────────────────────────────────────────
// Conilon Tech · Medidor de vazão ultrassônico (TUF-2000M / INST-U) → Firestore
//
// ESP32 + módulo RS485 lê o medidor por Modbus RTU a cada AMOSTRA_MS e, a cada
// minuto, grava no Firestore (REST, conta própria do dispositivo):
//   vazaoMedidores/{MEDIDOR_ID}                 → ultimo {vazao,total,q,erro,ts,dia,hora,...}
//   vazaoMedidores/{MEDIDOR_ID}/dias/{AAAA-MM-DD} → pontos.hHHMM = "vazao,total,q", campos
// Visualizado em irrigacao.html (botão 💧 Vazão). Detalhes em vazao/README.md.
//
// Bibliotecas (Arduino IDE → Gerenciar bibliotecas): "ModbusMaster" (Doc Walker).
// Placa: "ESP32 Dev Module" (pacote esp32 da Espressif).
// ─────────────────────────────────────────────────────────────────────────────
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <ModbusMaster.h>
#include <time.h>
#include "config.h"

#define FW_VERSAO    "1.0"
#define PROJETO      "talhoes-df836"
#define API_KEY      "AIzaSyDvdDBTN6UUN4-Ep4qqXruFDSNee7IAzfg"   // mesma chave pública das páginas
#define FUSO         "<-03>3"                                   // America/Sao_Paulo (sem horário de verão)
#define AMOSTRA_MS   10000UL                                    // leitura do medidor a cada 10 s
#define TOKEN_MS     (50UL * 60UL * 1000UL)                     // renova o login a cada 50 min (token vale 60)
#define REINICIO_MS  (30UL * 60UL * 1000UL)                     // reinicia se ficar 30 min com Wi-Fi e sem conseguir gravar
#define FILA_MAX     180                                        // minutos guardados enquanto sem internet (3 h)
#define LOTE_MAX     60                                         // minutos por gravação

ModbusMaster mb;
HardwareSerial RS485(2);

// ── Leitura atual ──
struct Leitura { bool ok; float vazao; double total; int q; int erro; };
Leitura ultimaLeitura = {false, 0, 0, 0, 0};
int unidadeTotal = -1, multTotal = 3;      // regs 1438/1439 (lidos no início)

// ── Acumulação do minuto em curso ──
int    minAtual = -1;                      // minuto do dia (0-1439) que está sendo acumulado
char   diaAtual[11] = "";
double somaVazao = 0; int nAmostras = 0; int falhasModbus = 0;

// ── Fila de minutos ainda não gravados ──
struct Ponto { char dia[11]; char chave[6]; char csv[48]; };
Ponto fila[FILA_MAX]; int filaN = 0;

String idToken; unsigned long tokenEm = 0, ultimoSucesso = 0, ultimaAmostra = 0, conectadoDesde = 0, ultimoReconnect = 0;

// ─── Modbus ───
void preTx()  { if (PIN_DE >= 0) digitalWrite(PIN_DE, HIGH); }
void posTx()  { if (PIN_DE >= 0) digitalWrite(PIN_DE, LOW);  }

uint32_t junta(uint16_t a, uint16_t b) {   // a = 1º registrador, b = 2º
  return WORD_SWAP ? ((uint32_t)b << 16) | a : ((uint32_t)a << 16) | b;
}
float   comoFloat(uint32_t u) { float f; memcpy(&f, &u, 4); return f; }

// Mapa de registradores (TUF-2000M, numeração 1-based do protocolo; endereço = nº − 1):
//   0001-0002 vazão REAL4 (m³/h) · 0025-0026 totalizador líquido LONG · 0027-0028 fração REAL4
//   0072 código de erro (bits) · 0092 qualidade do sinal Q (0-99)
//   1438 unidade do totalizador (0 = m³) · 1439 multiplicador do totalizador (n → ×10^(n−3))
Leitura lerMedidor() {
  Leitura l = {false, 0, 0, 0, 0};
  if (mb.readHoldingRegisters(0, 28) != mb.ku8MBSuccess) return l;
  uint16_t r[28];
  for (int i = 0; i < 28; i++) r[i] = mb.getResponseBuffer(i);
  l.vazao = comoFloat(junta(r[0], r[1]));
  int32_t netInt  = (int32_t)junta(r[24], r[25]);
  float   netFrac = comoFloat(junta(r[26], r[27]));
  l.total = ((double)netInt + (double)netFrac) * pow(10.0, multTotal - 3);
  if (isnan(l.vazao) || isinf(l.vazao) || isnan(l.total) || isinf(l.total)) return l;
  if (mb.readHoldingRegisters(71, 1) == mb.ku8MBSuccess) l.erro = mb.getResponseBuffer(0);
  if (mb.readHoldingRegisters(91, 1) == mb.ku8MBSuccess) l.q = mb.getResponseBuffer(0) & 0xFF;
  l.ok = true;
  return l;
}

void lerUnidades() {
  if (mb.readHoldingRegisters(1437, 2) == mb.ku8MBSuccess) {
    unidadeTotal = mb.getResponseBuffer(0);
    int m = mb.getResponseBuffer(1);
    if (m >= 0 && m <= 7) multTotal = m;
  }
  Serial.printf("Totalizador: unidade=%d multiplicador=%d\n", unidadeTotal, multTotal);
}

// ─── HTTP / Firebase ───
String extrai(const String& json, const char* chave) {
  String k = String("\"") + chave + "\"";
  int i = json.indexOf(k); if (i < 0) return "";
  i = json.indexOf(':', i + k.length()); if (i < 0) return "";
  i = json.indexOf('"', i + 1);          if (i < 0) return "";
  int j = json.indexOf('"', i + 1);      if (j < 0) return "";
  return json.substring(i + 1, j);
}

// Faz a requisição; devolve o código HTTP (≤0 = falha de rede)
int requisita(const char* metodo, const String& url, const String& corpo, String* resposta, bool autenticado) {
  WiFiClientSecure cli;
  cli.setInsecure();   // sem verificação de certificado (simplicidade; ver README)
  HTTPClient http;
  http.setTimeout(15000);
  if (!http.begin(cli, url)) return -1;
  http.addHeader("Content-Type", "application/json");
  if (autenticado) http.addHeader("Authorization", "Bearer " + idToken);
  int cod = http.sendRequest(metodo, corpo);
  if (resposta) *resposta = http.getString();
  else if (cod >= 300) Serial.println(http.getString());
  http.end();
  return cod;
}

bool login() {
  String corpo = String("{\"email\":\"") + DISP_EMAIL + "\",\"password\":\"" + DISP_SENHA + "\",\"returnSecureToken\":true}";
  String resp;
  int cod = requisita("POST", String("https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=") + API_KEY, corpo, &resp, false);
  if (cod != 200) { Serial.printf("Login falhou (%d): %s\n", cod, resp.c_str()); return false; }
  idToken = extrai(resp, "idToken");
  tokenEm = millis();
  Serial.println("Login OK");
  return idToken.length() > 0;
}

String baseDocs() {
  return String("https://firestore.googleapis.com/v1/projects/") + PROJETO + "/databases/(default)/documents/";
}

// PATCH com updateMask (cria o doc se não existir e só mexe nos campos listados)
bool grava(const String& caminho, const String& mascaras, const String& campos) {
  if (!idToken.length() || millis() - tokenEm > TOKEN_MS) { if (!login()) return false; }
  String url = baseDocs() + caminho + "?" + mascaras;
  String corpo = "{\"fields\":{" + campos + "}}";
  int cod = requisita("PATCH", url, corpo, nullptr, true);
  if (cod == 401 || cod == 403) { if (login()) cod = requisita("PATCH", url, corpo, nullptr, true); }
  if (cod != 200) Serial.printf("Gravação falhou (%d) em %s\n", cod, caminho.c_str());
  return cod == 200;
}

// Grava os minutos pendentes da fila, um lote por dia
void enviaFila() {
  while (filaN > 0 && WiFi.status() == WL_CONNECTED) {
    const char* dia = fila[0].dia;
    String mascaras = "updateMask.fieldPaths=campos", pontos;
    int n = 0;
    for (int i = 0; i < filaN && n < LOTE_MAX; i++) {
      if (strcmp(fila[i].dia, dia) != 0) continue;
      mascaras += String("&updateMask.fieldPaths=pontos.") + fila[i].chave;
      if (n) pontos += ",";
      pontos += String("\"") + fila[i].chave + "\":{\"stringValue\":\"" + fila[i].csv + "\"}";
      n++;
    }
    String campos = "\"campos\":{\"stringValue\":\"vazao,total,q\"},\"pontos\":{\"mapValue\":{\"fields\":{" + pontos + "}}}";
    if (!grava(String("vazaoMedidores/") + MEDIDOR_ID + "/dias/" + dia, mascaras, campos)) return;
    // remove da fila os n pontos enviados (os primeiros n daquele dia)
    String diaEnviado = dia; int removidos = 0, j = 0;
    for (int i = 0; i < filaN; i++) {
      if (removidos < n && diaEnviado == fila[i].dia) { removidos++; continue; }
      fila[j++] = fila[i];
    }
    filaN = j;
    ultimoSucesso = millis();
  }
}

void gravaUltimo(const char* dia, int minuto, bool ok, float vazaoMed) {
  char hora[6]; snprintf(hora, sizeof hora, "%02d:%02d", minuto / 60, minuto % 60);
  time_t agora = time(nullptr);
  String f = "\"ultimo\":{\"mapValue\":{\"fields\":{";
  f += "\"ok\":{\"booleanValue\":" + String(ok ? "true" : "false") + "},";
  if (ok) {
    f += "\"vazao\":{\"doubleValue\":" + String(vazaoMed, 3) + "},";
    f += "\"total\":{\"doubleValue\":" + String(ultimaLeitura.total, 3) + "},";
    f += "\"q\":{\"integerValue\":\"" + String(ultimaLeitura.q) + "\"},";
    f += "\"erro\":{\"integerValue\":\"" + String(ultimaLeitura.erro) + "\"},";
  }
  f += "\"unidadeTotal\":{\"integerValue\":\"" + String(unidadeTotal) + "\"},";
  f += "\"rssi\":{\"integerValue\":\"" + String(WiFi.RSSI()) + "\"},";
  f += "\"pendentes\":{\"integerValue\":\"" + String(filaN) + "\"},";
  f += "\"fw\":{\"stringValue\":\"" FW_VERSAO "\"},";
  f += "\"dia\":{\"stringValue\":\"" + String(dia) + "\"},";
  f += "\"hora\":{\"stringValue\":\"" + String(hora) + "\"},";
  char ts[24]; snprintf(ts, sizeof ts, "%lld", (long long)agora * 1000LL);
  f += "\"ts\":{\"integerValue\":\"" + String(ts) + "\"}";
  f += "}}}";
  if (grava(String("vazaoMedidores/") + MEDIDOR_ID, "updateMask.fieldPaths=ultimo", f)) ultimoSucesso = millis();
}

// Fecha o minuto acumulado: entra na fila e tenta gravar
void fechaMinuto() {
  float media = nAmostras ? (float)(somaVazao / nAmostras) : 0;
  if (nAmostras) {
    if (filaN >= FILA_MAX) { memmove(&fila[0], &fila[1], sizeof(Ponto) * (FILA_MAX - 1)); filaN--; }
    Ponto& p = fila[filaN++];
    strncpy(p.dia, diaAtual, sizeof p.dia);
    snprintf(p.chave, sizeof p.chave, "h%02d%02d", minAtual / 60, minAtual % 60);
    snprintf(p.csv, sizeof p.csv, "%.3f,%.3f,%d", media, ultimaLeitura.total, ultimaLeitura.q);
  }
  Serial.printf("%s %02d:%02d  vazão média %.3f m³/h (%d amostras, %d falhas)  fila=%d\n",
                diaAtual, minAtual / 60, minAtual % 60, media, nAmostras, falhasModbus, filaN);
  if (WiFi.status() == WL_CONNECTED) {
    enviaFila();
    gravaUltimo(diaAtual, minAtual, nAmostras > 0, media);
  }
  somaVazao = 0; nAmostras = 0; falhasModbus = 0;
}

// ─── Setup / loop ───
void setup() {
  Serial.begin(115200);
  delay(300);
  Serial.printf("\nConilon Tech · medidor de vazão \"%s\" · fw %s\n", MEDIDOR_ID, FW_VERSAO);
  if (PIN_DE >= 0) { pinMode(PIN_DE, OUTPUT); digitalWrite(PIN_DE, LOW); }
  RS485.begin(MODBUS_BAUD, SERIAL_8N1, PIN_RX, PIN_TX);
  mb.begin(MODBUS_ENDERECO, RS485);
  mb.preTransmission(preTx);
  mb.postTransmission(posTx);

  WiFi.mode(WIFI_STA);
  WiFi.setAutoReconnect(true);
  WiFi.begin(WIFI_SSID, WIFI_SENHA);
  Serial.print("Wi-Fi");
  for (int i = 0; i < 60 && WiFi.status() != WL_CONNECTED; i++) { delay(500); Serial.print("."); }
  Serial.println(WiFi.status() == WL_CONNECTED ? " conectado" : " sem conexão (segue tentando)");

  configTzTime(FUSO, "pool.ntp.org", "time.google.com");
  struct tm t;
  while (!getLocalTime(&t, 5000)) { Serial.println("Aguardando hora (NTP)..."); if (WiFi.status() != WL_CONNECTED) WiFi.reconnect(); }
  lerUnidades();
  ultimoSucesso = millis();
}

void loop() {
  if (millis() - ultimaAmostra < AMOSTRA_MS) { delay(50); return; }
  ultimaAmostra = millis();

  struct tm t;
  if (!getLocalTime(&t, 1000)) return;
  int minuto = t.tm_hour * 60 + t.tm_min;
  char dia[11]; strftime(dia, sizeof dia, "%Y-%m-%d", &t);

  if (minAtual >= 0 && (minuto != minAtual || strcmp(dia, diaAtual) != 0)) fechaMinuto();
  minAtual = minuto; strncpy(diaAtual, dia, sizeof diaAtual);

  Leitura l = lerMedidor();
  ultimaLeitura = l.ok ? l : Leitura{false, ultimaLeitura.vazao, ultimaLeitura.total, ultimaLeitura.q, ultimaLeitura.erro};
  if (l.ok) { somaVazao += l.vazao; nAmostras++; if (unidadeTotal < 0) lerUnidades(); }
  else      { falhasModbus++; Serial.println("Medidor não respondeu (confira 485+/485−, M46, M62, M63)"); }

  // Wi-Fi caído: tenta reconectar a cada 1 min (a fila guarda até 3 h de minutos na RAM)
  if (WiFi.status() != WL_CONNECTED) {
    conectadoDesde = 0;
    if (millis() - ultimoReconnect > 60000UL) { ultimoReconnect = millis(); WiFi.reconnect(); }
  } else if (!conectadoDesde) {
    conectadoDesde = millis();
  }
  // Com Wi-Fi há 30 min e nenhuma gravação nesse tempo → algo travou (TLS/login): reinicia
  if (conectadoDesde && millis() - conectadoDesde > REINICIO_MS && millis() - ultimoSucesso > REINICIO_MS) {
    Serial.println("30 min conectado sem conseguir gravar — reiniciando"); delay(200); ESP.restart();
  }
}
