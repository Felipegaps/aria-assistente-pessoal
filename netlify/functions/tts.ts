// netlify/functions/tts.ts
//
// Converte texto em áudio usando o Google Cloud Text-to-Speech (vozes
// Chirp 3: HD — geração mais recente, soam naturais e fluidas).
//
// Por que uma function separada: a chave da API do Text-to-Speech não
// pode ir para o bundle do cliente (mesma lógica do GEMINI_API_KEY).
// Aqui ela fica em process.env.GOOGLE_TTS_API_KEY, só o servidor vê.
//
// Autenticação: exige o mesmo ID token do Firebase que a function do
// Gemini já usa, pra evitar que qualquer pessoa na internet gaste sua
// cota só descobrindo essa URL.
//
// Variável de ambiente necessária no painel da Netlify:
//   GOOGLE_TTS_API_KEY → chave do Google Cloud com a Text-to-Speech API ativada

import admin from 'firebase-admin';

export const config = { path: '/api/tts' };

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(
      JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT as string)
    ),
  });
}

async function verificarUsuario(req: Request): Promise<string | null> {
  const header = req.headers.get('Authorization');
  if (!header?.startsWith('Bearer ')) return null;

  try {
    const decoded = await admin.auth().verifyIdToken(header.slice(7));
    return decoded.uid;
  } catch {
    return null;
  }
}

// Voz feminina em português (Brasil), geração Chirp 3: HD — a mais fluida
// disponível hoje. Se quiser trocar o timbre, troque só o nome no fim
// (ex: Kore, Leda, Aoede são vozes femininas do mesmo catálogo).
const VOZ = 'pt-BR-Chirp3-HD-Aoede';

export default async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ erro: 'Método não permitido' }), { status: 405 });
  }

  const uid = await verificarUsuario(req);
  if (!uid) {
    return new Response(JSON.stringify({ erro: 'Não autenticado' }), { status: 401 });
  }

  const apiKey = process.env.GOOGLE_TTS_API_KEY;
  if (!apiKey) {
    return new Response(
      JSON.stringify({ erro: 'GOOGLE_TTS_API_KEY não configurada' }),
      { status: 500 }
    );
  }

  try {
    const { texto } = await req.json();
    if (!texto || typeof texto !== 'string') {
      return new Response(JSON.stringify({ erro: 'Envie "texto"' }), { status: 400 });
    }

    // Limite de segurança: corta textos muito longos (custo + latência)
    const textoFinal = texto.slice(0, 1000);

    const res = await fetch(
      `https://texttospeech.googleapis.com/v1/text:synthesize?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          input: { text: textoFinal },
          voice: { languageCode: 'pt-BR', name: VOZ },
          audioConfig: { audioEncoding: 'MP3' },
        }),
      }
    );

    if (!res.ok) {
      const errText = await res.text();
      return new Response(JSON.stringify({ erro: `TTS falhou: ${errText}` }), { status: 502 });
    }

    const data = await res.json();
    // data.audioContent já vem em base64, pronto pra tocar no navegador
    return new Response(JSON.stringify({ audioContent: data.audioContent }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ erro: err.message }), { status: 500 });
  }
};
