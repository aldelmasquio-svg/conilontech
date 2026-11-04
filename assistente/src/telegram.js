// Chamadas mínimas à Bot API do Telegram.

export class Telegram {
  constructor(token) {
    this.api = `https://api.telegram.org/bot${token}`;
  }

  async _chamar(metodo, corpo) {
    const r = await fetch(`${this.api}/${metodo}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(corpo),
    });
    const j = await r.json().catch(() => ({}));
    if (!j.ok) console.log(`Telegram ${metodo} falhou: ${j.description || r.status}`);
    return j.result;
  }

  // Texto puro (sem parse_mode) para não quebrar com caracteres especiais; divide no limite de 4096.
  async enviar(chatId, texto, extra = {}) {
    const partes = [];
    let resto = String(texto || '').trim() || '…';
    while (resto.length > 4000) {
      let corte = resto.lastIndexOf('\n', 4000);
      if (corte < 1000) corte = 4000;
      partes.push(resto.slice(0, corte));
      resto = resto.slice(corte).trimStart();
    }
    partes.push(resto);
    let ultima;
    for (let i = 0; i < partes.length; i++) {
      const ehUltima = i === partes.length - 1;
      ultima = await this._chamar('sendMessage', { chat_id: chatId, text: partes[i], ...(ehUltima ? extra : {}) });
    }
    return ultima;
  }

  // Envia um arquivo (ex.: PDF do pedido) como documento no chat.
  async enviarDocumento(chatId, bytes, nomeArquivo, legenda = '') {
    const form = new FormData();
    form.append('chat_id', String(chatId));
    form.append('document', new Blob([bytes], { type: 'application/pdf' }), nomeArquivo);
    if (legenda) form.append('caption', String(legenda).slice(0, 1024));
    const r = await fetch(`${this.api}/sendDocument`, { method: 'POST', body: form });
    const j = await r.json().catch(() => ({}));
    if (!j.ok) console.log(`Telegram sendDocument falhou: ${j.description || r.status}`);
    return j.result;
  }

  // Baixa um arquivo enviado ao bot (voz, foto). Limite da Bot API: 20 MB.
  async baixarArquivo(fileId) {
    const f = await this._chamar('getFile', { file_id: fileId });
    if (!f?.file_path) throw new Error('não consegui baixar o arquivo do Telegram');
    const r = await fetch(`${this.api.replace('/bot', '/file/bot')}/${f.file_path}`);
    if (!r.ok) throw new Error(`download do arquivo falhou (HTTP ${r.status})`);
    return new Uint8Array(await r.arrayBuffer());
  }

  digitando(chatId) {
    return this._chamar('sendChatAction', { chat_id: chatId, action: 'typing' });
  }

  responderBotao(callbackId, texto = '') {
    return this._chamar('answerCallbackQuery', { callback_query_id: callbackId, text: texto });
  }

  editarTexto(chatId, messageId, texto) {
    return this._chamar('editMessageText', { chat_id: chatId, message_id: messageId, text: texto, reply_markup: { inline_keyboard: [] } });
  }

  configurarWebhook(url, segredo) {
    return fetch(`${this.api}/setWebhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, secret_token: segredo, allowed_updates: ['message', 'callback_query'], drop_pending_updates: true }),
    }).then(r => r.json());
  }
}
