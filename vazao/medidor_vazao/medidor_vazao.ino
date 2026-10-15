// ─────────────────────────────────────────────────────────────────────────────
// Conilon Tech · Medidor de vazão ultrassônico (TUF-2000M / INST-U) → Firestore
//
// ESP32 + módulo RS485 lê o medidor por Modbus RTU a cada AMOSTRA_MS e, a cada
// minuto, grava no Firestore (REST, conta própria do dispositivo):
//   vazaoMedidores/{MEDIDOR_ID}                 → ultimo {vazao,total,q,erro,ts,dia,hora,...}
//   vazaoMedidores/{MEDIDOR_ID}/dias/{AAAA-MM-DD} → pontos.hHHMM = "vazao,total,q", campos
// Alertas (vazão mínima/máxima, medidor sem resposta, bomba ligou/desligou e, no
// medidor de referência, diferença bomba × lavoura): limites lidos do Firestore
// (editados no app), avaliados aqui a cada leitura, gravados em vazaoAlertas e,
// se TELEGRAM_TOKEN estiver no config.h, enviados ao Telegram.
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

#define FW_VERSAO    "1.1"
#define PROJETO      "talhoes-df836"
#define API_KEY      "AIzaSyDvdDBTN6UUN4-Ep4qqXruFDSNee7IAzfg"   // mesma chave pública das páginas
#define FUSO         "<-03>3"                                   // America/Sao_Paulo (sem horário de verão)
#define AMOSTRA_MS   10000UL                                    // leitura do medidor a cada 10 s
#define TOKEN_MS     (50UL * 60UL * 1000UL)                     // renova o login a cada 50 min (token vale 60)
#define REINICIO_MS  (30UL * 60UL * 1000UL)                     // reinicia se ficar 30 min com Wi-Fi e sem conseguir gravar
#define FILA_MAX     180                                        // minutos guardados enquanto sem internet (3 h)
#define LOTE_MAX     60                                         // minutos por gravação
#define CFG_MS       (5UL * 60UL * 1000UL)                      // relê os limites de alerta a cada 5 min
#define VZ_FLUXO     0.5f                                       // m³/h: acima disso a bomba está rodando
#define SEM_RESP_MS  (10UL * 60UL * 1000UL)                     // medidor mudo por 10 min → alerta

// Telegram é opcional: config.h antigos não têm estas linhas
#ifndef TELEGRAM_TOKEN
#define TELEGRAM_TOKEN ""
#endif
#ifndef TELEGRAM_CHAT
#define TELEGRAM_CHAT  ""
#endif

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

// ── Alertas: limites (do Firestore) e estado de cada condição ──
struct CfgAlerta {
  String nome;                 // nome dado no app (vazio = MEDIDOR_ID)
  float  min = 0, max = 0;     // m³/h; 0 = desligado
  int    minutos = 5;          // a condição precisa durar isso para avisar
  bool   ligaDesliga = false;  // avisar quando a bomba ligar/desligar
  String ref, comp;            // par comparado (vazaoConfig/geral)
  float  limitePct = 5;
  bool   alertaDif = false;
} cfg;
unsigned long cfgEm = 0; bool cfgLido = false;

struct Cond { bool ativa = false; unsigned long desde = 0; bool avisado = false; };
Cond cBaixa, cAlta, cSemResp, cDif;

bool rodando = false, estadoInicial = true; unsigned long fluxoMudouEm = 0; bool fluxoAnterior = false;
time_t rodandoDesde = 0; double totalInicio = 0;

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

// ─── Leitura de documentos (REST) ───
// Valor de um campo na resposta do Firestore: "nome": { "doubleValue": 30 } / "integerValue": "30" /
// "stringValue": "x" / "booleanValue": true. Os nomes usados são únicos no documento.
String campo(const String& js, const char* nome) {
  int i = js.indexOf(String("\"") + nome + "\""); if (i < 0) return "";
  int a = js.indexOf('{', i), f = js.indexOf('}', a); if (a < 0 || f < 0) return "";
  String b = js.substring(a + 1, f);
  int c = b.indexOf(':'); if (c < 0) return "";
  String v = b.substring(c + 1); v.trim();
  if (v.startsWith("\"")) { int e = v.indexOf('"', 1); v = e > 0 ? v.substring(1, e) : ""; }
  return v;
}

int le(const String& caminho, String& resp) {
  if (!idToken.length() || millis() - tokenEm > TOKEN_MS) { if (!login()) return -1; }
  int cod = requisita("GET", baseDocs() + caminho, "", &resp, true);
  if (cod == 401 || cod == 403) { if (login()) cod = requisita("GET", baseDocs() + caminho, "", &resp, true); }
  return cod;
}

void leConfig() {
  String r;
  if (le(String("vazaoMedidores/") + MEDIDOR_ID, r) == 200) {
    cfg.nome = campo(r, "nome");
    cfg.min = campo(r, "alertaMin").toFloat();
    cfg.max = campo(r, "alertaMax").toFloat();
    int m = campo(r, "alertaMinutos").toInt(); cfg.minutos = m > 0 ? m : 5;
    cfg.ligaDesliga = campo(r, "alertaLigaDesliga") == "true";
  }
  r = "";
  int cod = le("vazaoConfig/geral", r);
  if (cod == 200) {
    cfg.ref = campo(r, "ref"); cfg.comp = campo(r, "comp");
    float l = campo(r, "limitePct").toFloat(); cfg.limitePct = l > 0 ? l : 5;
    cfg.alertaDif = campo(r, "alertaDif") == "true";
  }
  cfgEm = millis(); cfgLido = true;
  Serial.printf("Alertas: min=%.2f max=%.2f %d min liga/desliga=%d | ref=%s comp=%s dif=%d (%.1f%%)\n",
                cfg.min, cfg.max, cfg.minutos, cfg.ligaDesliga, cfg.ref.c_str(), cfg.comp.c_str(), cfg.alertaDif, cfg.limitePct);
}

// ─── Avisos ───
String urlEnc(const String& s) {
  String o; char h[4];
  for (size_t i = 0; i < s.length(); i++) {
    uint8_t c = s[i];
    if (isalnum((int)c) || c == '-' || c == '_' || c == '.' || c == '~') o += (char)c;
    else { snprintf(h, sizeof h, "%%%02X", c); o += h; }
  }
  return o;
}
String jsonEsc(const String& s) { String o = s; o.replace("\\", "\\\\"); o.replace("\"", "\\\""); return o; }
String nomeMedidor() { return cfg.nome.length() ? cfg.nome : String(MEDIDOR_ID); }

// nivel: "alerta" | "normal" | "info". Grava em vazaoAlertas e manda ao Telegram (se configurado).
void avisa(const char* tipo, const char* nivel, const String& texto) {
  Serial.printf("AVISO [%s] %s\n", tipo, texto.c_str());
  if (WiFi.status() != WL_CONNECTED) return;
  struct tm t; char dia[11] = "", hora[6] = "";
  if (getLocalTime(&t, 500)) { strftime(dia, sizeof dia, "%Y-%m-%d", &t); strftime(hora, sizeof hora, "%H:%M", &t); }
  char ts[24]; snprintf(ts, sizeof ts, "%lld", (long long)time(nullptr) * 1000LL);
  String corpo = String("{\"fields\":{") +
    "\"medidor\":{\"stringValue\":\"" MEDIDOR_ID "\"}," +
    "\"tipo\":{\"stringValue\":\"" + tipo + "\"}," +
    "\"nivel\":{\"stringValue\":\"" + nivel + "\"}," +
    "\"texto\":{\"stringValue\":\"" + jsonEsc(texto) + "\"}," +
    "\"dia\":{\"stringValue\":\"" + dia + "\"}," +
    "\"hora\":{\"stringValue\":\"" + hora + "\"}," +
    "\"ts\":{\"integerValue\":\"" + ts + "\"}}}";
  if (idToken.length() || login()) {
    int cod = requisita("POST", baseDocs() + "vazaoAlertas", corpo, nullptr, true);
    if (cod == 401 || cod == 403) { if (login()) requisita("POST", baseDocs() + "vazaoAlertas", corpo, nullptr, true); }
  }
  if (strlen(TELEGRAM_TOKEN) && strlen(TELEGRAM_CHAT)) {
    String ico = strcmp(nivel, "alerta") == 0 ? "🚨 " : strcmp(nivel, "normal") == 0 ? "✅ " : "ℹ️ ";
    String msg = ico + nomeMedidor() + " (" + hora + ")\n" + texto;
    String url = String("https://api.telegram.org/bot") + TELEGRAM_TOKEN + "/sendMessage?chat_id=" +
                 urlEnc(TELEGRAM_CHAT) + "&text=" + urlEnc(msg);
    int cod = requisita("GET", url, "", nullptr, false);
    if (cod != 200) Serial.printf("Telegram falhou (%d)\n", cod);
  }
}

// Condição que precisa durar 'tolMs' para virar alerta; avisa uma vez ao entrar e uma ao sair
// (a saída só é avisada se 'avisaSaida', p.ex. vazão voltou ao normal com a bomba ainda rodando).
void avalia(Cond& c, bool agora, unsigned long tolMs, const char* tipo, const String& msgEntra, const String& msgSai, bool avisaSaida) {
  if (agora) {
    if (!c.ativa) { c.ativa = true; c.desde = millis(); }
    if (!c.avisado && millis() - c.desde >= tolMs) { avisa(tipo, "alerta", msgEntra); c.avisado = true; }
  } else {
    if (c.avisado && avisaSaida) avisa(tipo, "normal", msgSai);
    c.ativa = false; c.avisado = false;
  }
}

String fmt(double v, int d = 1) { String s = String(v, d); s.replace('.', ','); return s; }

// Chamado a cada leitura (10 s)
void avaliaAlertas(const Leitura& l) {
  if (!cfgLido) return;
  unsigned long tol = (unsigned long)cfg.minutos * 60000UL;
  bool fluxo = l.ok && l.vazao >= VZ_FLUXO;

  // bomba ligou / desligou (estado estável por 1 min)
  if (l.ok && fluxo != fluxoAnterior) { fluxoAnterior = fluxo; fluxoMudouEm = millis(); }
  // 1º estado estável após ligar o ESP32: só registra (não avisa "ligou" se ela já estava rodando)
  if (estadoInicial && l.ok && millis() - fluxoMudouEm >= 60000UL) {
    estadoInicial = false; rodando = fluxo;
    if (rodando) { rodandoDesde = time(nullptr); totalInicio = l.total; }
  }
  if (!estadoInicial && l.ok && fluxo != rodando && millis() - fluxoMudouEm >= 60000UL) {
    rodando = fluxo;
    if (rodando) {
      rodandoDesde = time(nullptr); totalInicio = l.total;
      if (cfg.ligaDesliga) avisa("liga", "info", "Bomba ligou: " + fmt(l.vazao) + " m³/h");
    } else if (cfg.ligaDesliga && rodandoDesde) {
      long min = (long)(time(nullptr) - rodandoDesde) / 60;
      double vol = l.total - totalInicio;
      String txt = "Bomba desligou. Rodou " + String(min / 60) + "h" + (min % 60 < 10 ? "0" : "") + String(min % 60);
      if (vol >= 0) txt += ", " + fmt(vol) + " m³";
      avisa("desliga", "info", txt);
    }
  }

  // vazão baixa só conta com a bomba rodando (parada não é alerta); se ela parar, sai sem aviso
  bool baixa = fluxo && cfg.min > 0 && l.vazao < cfg.min;
  avalia(cBaixa, baixa, tol, "baixa",
         "Vazão BAIXA: " + fmt(l.vazao) + " m³/h (mínimo " + fmt(cfg.min) + "). Filtro entupido, registro fechado ou bomba perdendo escorva?",
         "Vazão normalizou: " + fmt(l.vazao) + " m³/h", fluxo);
  bool alta = l.ok && cfg.max > 0 && l.vazao > cfg.max;
  avalia(cAlta, alta, tol, "alta",
         "Vazão ALTA: " + fmt(l.vazao) + " m³/h (máximo " + fmt(cfg.max) + "). Possível vazamento ou cano rompido.",
         "Vazão normalizou: " + fmt(l.vazao) + " m³/h", l.ok);
  avalia(cSemResp, !l.ok, SEM_RESP_MS, "semResposta",
         "Medidor não responde há 10 min (RS485). Verifique a caixa do medidor.",
         "Medidor voltou a responder.", true);
}

// Chamado a cada minuto, só no medidor de referência: compara com o outro medidor
void avaliaDiferenca(bool okMin, float media) {
  if (!cfgLido || !cfg.alertaDif || cfg.ref != MEDIDOR_ID || !cfg.comp.length()) { cDif = Cond(); return; }
  String r;
  if (le(String("vazaoMedidores/") + cfg.comp, r) != 200) return;
  long long ts = atoll(campo(r, "ts").c_str());
  bool fresco = ts > 0 && (long long)time(nullptr) * 1000LL - ts < 3LL * 60LL * 1000LL;
  bool okComp = campo(r, "ok") == "true";
  float vComp = campo(r, "vazao").toFloat();
  String nComp = campo(r, "nome"); if (!nComp.length()) nComp = cfg.comp;
  bool valida = okMin && fresco && okComp && media >= VZ_FLUXO;
  float pct = valida ? (media - vComp) / media * 100.0f : 0;
  bool fora = valida && fabs(pct) > cfg.limitePct;
  String msg = pct >= 0
    ? nComp + " recebe " + fmt(fabs(pct)) + "% menos (" + fmt(media) + " → " + fmt(vComp) + " m³/h). Possível vazamento entre os dois pontos."
    : nComp + " marca " + fmt(fabs(pct)) + "% mais (" + fmt(media) + " → " + fmt(vComp) + " m³/h). Verifique a instalação dos medidores.";
  avalia(cDif, fora, (unsigned long)cfg.minutos * 60000UL, "diferenca", msg,
         "Diferença com " + nComp + " voltou ao normal (" + fmt(fabs(pct)) + "%).", valida);
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
    if (!cfgLido || millis() - cfgEm > CFG_MS) leConfig();
    avaliaDiferenca(nAmostras > 0, media);
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
  avaliaAlertas(l);

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
