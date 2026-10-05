// Copie este arquivo para "config.h" (na mesma pasta) e preencha.
// O config.h NÃO vai para o GitHub (está no .gitignore) — ele tem senhas.

#pragma once

// ── Wi-Fi ──
#define WIFI_SSID   "nome-da-rede"
#define WIFI_SENHA  "senha-da-rede"

// ── Identificação do medidor no app ──
// Só letras minúsculas, números e "-". Um ESP32 por medidor, cada um com um ID.
// O app sugere comparar "bomba" (referência) com "lavoura"; o nome exibido
// pode ser trocado depois no próprio app (💧 Vazão → Configuração).
#define MEDIDOR_ID  "bomba"          // no outro ESP32: "lavoura"

// ── Conta do dispositivo no Firebase ──
// Crie em Firebase Console → Authentication → Usuários → "Adicionar usuário"
// (ex.: vazao@conilontech.app). Use a MESMA conta nos dois ESP32.
// A senha não pode conter aspas (").
#define DISP_EMAIL  "vazao@conilontech.app"
#define DISP_SENHA  "troque-esta-senha"

// ── RS485 / Modbus do medidor (menus M46, M62, M63) ──
#define MODBUS_ENDERECO  1      // M46 (endereço de rede do medidor)
#define MODBUS_BAUD      9600   // M62 (8 bits, sem paridade, 1 stop)
#define PIN_RX           16     // RO do módulo RS485 → GPIO16
#define PIN_TX           17     // DI do módulo RS485 → GPIO17
#define PIN_DE           4      // DE+RE do módulo → GPIO4. Use -1 em módulo com direção automática.

// Ordem das palavras dos números REAL/LONG. O TUF-2000M manda a palavra baixa
// primeiro (true). Se a vazão no app vier absurda (ex.: 1.2e-38 ou 4e+9)
// enquanto o display mostra um valor normal, troque para false.
#define WORD_SWAP        true
