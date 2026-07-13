/**
 * Cloud Function - Proxy Agrofit (Embrapa AgroAPI)
 * ---------------------------------------------------
 * Guarda o Consumer Key/Secret em variável de ambiente (nunca no código do app),
 * gera e renova o Access Token automaticamente, e repassa as consultas do app
 * pra API oficial do Agrofit.
 *
 * O app (HTML/JS do ConilonTech) chama SÓ essa função, nunca a API da Embrapa direto.
 */

const { onRequest } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");

// Essas duas "secrets" são configuradas via CLI, não ficam no código (ver instruções abaixo)
const AGROFIT_CONSUMER_KEY = defineSecret("AGROFIT_CONSUMER_KEY");
const AGROFIT_CONSUMER_SECRET = defineSecret("AGROFIT_CONSUMER_SECRET");

const TOKEN_URL = "https://api.cnptia.embrapa.br/token";
const API_BASE_URL = "https://api.cnptia.embrapa.br/agrofit/v1";

// Cache do token em memória (dura enquanto a instância da function ficar "quente")
let cachedToken = null;
let tokenExpiresAt = 0; // timestamp em ms

/**
 * Retorna um Access Token válido, gerando um novo se o cache expirou.
 */
async function getAccessToken(consumerKey, consumerSecret) {
  const now = Date.now();

  // Se ainda tem token em cache e falta mais de 60s pra expirar, reusa
  if (cachedToken && now < tokenExpiresAt - 60_000) {
    return cachedToken;
  }

  const basicAuth = Buffer.from(`${consumerKey}:${consumerSecret}`).toString("base64");

  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "Authorization": `Basic ${basicAuth}`,
    },
    body: "grant_type=client_credentials",
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Falha ao gerar token (${response.status}): ${errText}`);
  }

  const data = await response.json();
  // data.access_token e data.expires_in (segundos) vêm da AgroAPI
  cachedToken = data.access_token;
  tokenExpiresAt = now + (data.expires_in || 3600) * 1000;

  return cachedToken;
}

/**
 * Endpoint HTTP que o app chama.
 * Exemplo de uso no app:
 *   GET https://SUA-REGIAO-SEU-PROJETO.cloudfunctions.net/agrofitProxy?endpoint=produtos-formulados&ingredienteAtivo=glifosato
 *
 * Parâmetros:
 *  - endpoint: qual rota da API Agrofit chamar (ex: "produtos-formulados", "produtos-tecnicos", "culturas", "pragas")
 *  - qualquer outro parâmetro é repassado direto como query string pra API da Embrapa
 */
exports.agrofitProxy = onRequest(
  { secrets: [AGROFIT_CONSUMER_KEY, AGROFIT_CONSUMER_SECRET], cors: true },
  async (req, res) => {
    try {
      const { endpoint, ...filtros } = req.query;

      if (!endpoint) {
        res.status(400).json({ erro: "Parâmetro 'endpoint' é obrigatório (ex: produtos-formulados)" });
        return;
      }

      const token = await getAccessToken(
        AGROFIT_CONSUMER_KEY.value(),
        AGROFIT_CONSUMER_SECRET.value()
      );

      const queryString = new URLSearchParams(filtros).toString();
      const url = `${API_BASE_URL}/${endpoint}${queryString ? `?${queryString}` : ""}`;

      const apiResponse = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const body = await apiResponse.text();

      res.status(apiResponse.status).set("Content-Type", "application/json").send(body);
    } catch (err) {
      console.error("Erro no proxy Agrofit:", err);
      res.status(500).json({ erro: "Erro interno ao consultar o Agrofit", detalhes: err.message });
    }
  }
);
