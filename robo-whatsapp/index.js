// Robô que lê o grupo do WhatsApp e lança os relatórios no sistema.
// Roda no celular velho (Termux) com um NÚMERO DEDICADO. Veja o README.
import * as Baileys from '@whiskeysockets/baileys';
import qrcode from 'qrcode-terminal';
import { iniciar as iniciarFirestore, jaProcessada } from './firestore.js';
import { processarTexto } from './processar.js';
import cfg from './config.js';

const makeWASocket = Baileys.makeWASocket || Baileys.default;
const { useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } = Baileys;

iniciarFirestore(cfg);

let grupoAlvoJid = cfg.grupoJid || '';

function textoDe(m) {
  const msg = m.message || {};
  return msg.conversation || msg.extendedTextMessage?.text || msg.imageMessage?.caption || msg.videoMessage?.caption || '';
}
const pareceRelatorio = t => { const n = (t || '').toLowerCase(); return n.includes('entrada de produto') || n.includes('transfer'); };

async function iniciarSocket() {
  const { state, saveCreds } = await useMultiFileAuthState('auth_info');
  let versao;
  try { ({ version: versao } = await fetchLatestBaileysVersion()); } catch { /* usa a padrão */ }
  const sock = makeWASocket({ auth: state, version: versao, browser: ['ConilonTech Robo', 'Chrome', '1.0'] });
  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', async (u) => {
    const { connection, lastDisconnect, qr } = u;
    if (qr) { console.log('\nEscaneie o QR com o WhatsApp do número dedicado:\n'); qrcode.generate(qr, { small: true }); }
    if (connection === 'open') { console.log('✅ Conectado ao WhatsApp.'); await resolverGrupo(sock); }
    if (connection === 'close') {
      const code = lastDisconnect?.error?.output?.statusCode;
      const deslogado = code === DisconnectReason.loggedOut;
      console.log(`⚠️ Conexão caiu (${code}). ${deslogado ? 'Deslogado — apague a pasta auth_info e releia o QR.' : 'Reconectando em 3s...'}`);
      if (!deslogado) setTimeout(iniciarSocket, 3000);
    }
  });

  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return;
    for (const m of messages) {
      try {
        if (m.key.fromMe) continue;
        const jid = m.key.remoteJid || '';
        if (!jid.endsWith('@g.us')) continue;                 // só grupos
        if (grupoAlvoJid && jid !== grupoAlvoJid) continue;   // só o grupo alvo
        const texto = textoDe(m);
        if (!pareceRelatorio(texto)) continue;                // atalho barato
        if (await jaProcessada(m.key.id)) continue;           // não processa 2x
        const resumo = await processarTexto(texto, cfg);
        if (!resumo.length) continue;
        console.log(`\n[${new Date().toISOString()}] ${jid}\n${resumo.join('\n')}`);
        if (cfg.responderNoGrupo) await sock.sendMessage(jid, { text: '🤖 Lancei no sistema:\n' + resumo.join('\n') }, { quoted: m });
      } catch (e) { console.error('Erro no processamento da mensagem:', e.message); }
    }
  });
}

// Descobre o JID do grupo pelo nome (se grupoJid não foi fixado) e lista os grupos.
async function resolverGrupo(sock) {
  try {
    const grupos = await sock.groupFetchAllParticipating();
    const lista = Object.values(grupos).map(g => ({ jid: g.id, nome: g.subject }));
    console.log('\nGrupos em que este número está:');
    lista.forEach(g => console.log(`  ${g.jid}  —  ${g.nome}`));
    if (!grupoAlvoJid && cfg.grupoNome) {
      const alvo = lista.find(g => (g.nome || '').toLowerCase().includes(cfg.grupoNome.toLowerCase()));
      if (alvo) { grupoAlvoJid = alvo.jid; console.log(`\n👉 Grupo alvo: ${alvo.nome} (${alvo.jid}). Fixe isso em config.js como grupoJid.`); }
      else console.log(`\n⚠️ Não achei um grupo com nome contendo "${cfg.grupoNome}". Adicione o número ao grupo ou fixe grupoJid.`);
    }
  } catch (e) { console.error('Não consegui listar os grupos:', e.message); }
}

iniciarSocket().catch(e => { console.error('Falha ao iniciar:', e); process.exit(1); });
