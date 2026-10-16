// Transcrição de mensagens de voz com o Whisper do Workers AI (roda no próprio Cloudflare,
// sem outra conta). O Telegram manda voz em OGG/Opus.

const MODELO_WHISPER = '@cf/openai/whisper-large-v3-turbo';

function paraBase64(bytes) {
  let s = '';
  const passo = 0x8000;
  for (let i = 0; i < bytes.length; i += passo) s += String.fromCharCode.apply(null, bytes.subarray(i, i + passo));
  return btoa(s);
}

// `contexto` = vocabulário da fazenda (nomes de talhões, fazendas, produtos) para o Whisper
// acertar palavras que ele não conhece. O Whisper só usa os ~224 últimos tokens do prompt.
export async function transcrever(ai, bytes, contexto = '') {
  if (!ai) throw new Error('Workers AI não configurado (binding "AI" no wrangler.toml)');
  const base = 'Conversa sobre fazenda de café conilon: talhão, pulverização, adubação, drench, irrigação, estoque, pedido, ferrugem, broca, cercospora, KCl, ureia, L/ha, kg/ha.';
  const r = await ai.run(MODELO_WHISPER, {
    audio: paraBase64(bytes),
    task: 'transcribe',
    language: 'pt',
    vad_filter: true,
    initial_prompt: `${base} ${contexto}`.slice(0, 800),
  });
  return String(r?.text || '').trim();
}
