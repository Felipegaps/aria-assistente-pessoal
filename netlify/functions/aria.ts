// netlify/functions/aria.ts
//
// Cérebro da ARIA rodando no servidor (Netlify Function).
//
// POR QUE ISSO EXISTE: no Vite, qualquer variável VITE_* é embutida no
// JavaScript final e fica pública. A chave do Gemini não pode ficar lá.
// Aqui ela vive em process.env.GEMINI_API_KEY — sem prefixo VITE_, ou
// seja, só o servidor enxerga.
//
// IMPORTANTE: a EXECUÇÃO das ferramentas continua no navegador. O
// Firestore usa a sessão autenticada do usuário, as APIs do Google usam
// o token OAuth dele, e o Home Assistant está na rede local de casa —
// nada disso o servidor da Netlify alcança. Esta function só decide o
// que fazer e depois formata o resultado.
//
// Fluxo em duas fases:
//   modo 'decidir'   → recebe o histórico, devolve texto final OU a
//                      ferramenta a ser chamada (nome + argumentos)
//   modo 'responder' → recebe o resultado da ferramenta executada no
//                      cliente, devolve a resposta em linguagem natural
//
// Variáveis de ambiente necessárias no painel da Netlify:
//   GEMINI_API_KEY            → chave do Gemini
//   FIREBASE_SERVICE_ACCOUNT  → JSON da service account (string única)

import { GoogleGenAI, FunctionDeclaration, Type } from '@google/genai';
import admin from 'firebase-admin';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// --- Autenticação -----------------------------------------------------
// Sem isso o endpoint seria um proxy aberto: qualquer pessoa na internet
// poderia chamar /api/aria e gastar a cota do Gemini. Só passa quem
// mandar um ID token válido do Firebase.

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

// --- Ferramentas disponíveis para o Gemini escolher -------------------
// A declaração vive aqui (o Gemini precisa dela para decidir), mas quem
// executa de verdade é o cliente, em src/agents/ariaAgent.ts.

const tools: FunctionDeclaration[] = [
  {
    name: 'listar_emails',
    description: 'Lista os e-mails recentes da caixa de entrada do usuário.',
    parameters: { type: Type.OBJECT, properties: {} },
  },
  {
    name: 'listar_agenda',
    description: 'Lista os próximos compromissos da agenda do usuário (30 dias).',
    parameters: { type: Type.OBJECT, properties: {} },
  },
  {
    name: 'sincronizar_agenda',
    description: 'Força uma nova sincronização da agenda do Google Calendar.',
    parameters: { type: Type.OBJECT, properties: {} },
  },
  {
    name: 'adicionar_item_compra',
    description: 'Adiciona um item a uma das listas de compras (casa ou online).',
    parameters: {
      type: Type.OBJECT,
      properties: {
        tipo: { type: Type.STRING, enum: ['casa', 'online'], description: 'Tipo da lista' },
        item: { type: Type.STRING, description: 'Nome do item a comprar' },
        link: { type: Type.STRING, description: 'Link do produto, se for compra online' },
      },
      required: ['tipo', 'item'],
    },
  },
  {
    name: 'controlar_dispositivo',
    description: 'Liga, desliga, tranca ou destranca um dispositivo da casa inteligente.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        entityId: { type: Type.STRING, description: 'Ex: light.sala, lock.porta_frente' },
        acao: { type: Type.STRING, enum: ['ligar', 'desligar', 'trancar', 'destrancar'] },
      },
      required: ['entityId', 'acao'],
    },
  },
  {
    name: 'listar_dispositivos',
    description: 'Lista todos os dispositivos da casa inteligente e seus estados atuais.',
    parameters: { type: Type.OBJECT, properties: {} },
  },
  {
    name: 'buscar_arquivo_drive',
    description: 'Busca arquivos no Google Drive do usuário pelo nome.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        termo: { type: Type.STRING, description: 'Texto a buscar no nome do arquivo' },
      },
      required: ['termo'],
    },
  },
  {
    name: 'listar_arquivos_recentes',
    description: 'Lista os arquivos modificados mais recentemente no Google Drive.',
    parameters: { type: Type.OBJECT, properties: {} },
  },
];

const INSTRUCAO_DECISAO =
  'Você é a ARIA, uma assistente pessoal estilo JARVIS. Responda sempre em português, ' +
  'de forma direta e educada. Use as ferramentas disponíveis para executar ações reais ' +
  'quando o pedido do usuário exigir (agenda, e-mail, lista de compras, casa inteligente, ' +
  'arquivos do Drive). Use o histórico da conversa para entender referências a mensagens ' +
  'anteriores. Se o pedido não precisar de nenhuma ferramenta, responda normalmente com texto.';

const INSTRUCAO_RESPOSTA =
  'Você é a ARIA. Transforme o resultado da ferramenta numa resposta curta, natural ' +
  'e em português para o usuário. Não invente dados que não estão no resultado.';

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

// --- Handler ----------------------------------------------------------

export default async (req: Request) => {
  if (req.method !== 'POST') {
    return json({ erro: 'Método não permitido' }, 405);
  }

  const uid = await verificarUsuario(req);
  if (!uid) {
    return json({ erro: 'Não autenticado' }, 401);
  }

  try {
    const { modo, historico = [], chamada } = await req.json();

    // Fase 1: o Gemini decide se precisa de ferramenta ou responde direto.
    // O histórico já chega do cliente com a mensagem atual no final.
    if (modo === 'decidir') {
      const response = await ai.models.generateContent({
        model: 'gemini-flash-latest',
        contents: historico,
        config: {
          systemInstruction: INSTRUCAO_DECISAO,
          tools: [{ functionDeclarations: tools }],
        },
      });

      const call = response.functionCalls?.[0];

      if (!call) {
        return json({
          tipo: 'texto',
          texto: response.text ?? 'Não consegui processar seu pedido.',
        });
      }

      return json({ tipo: 'ferramenta', nome: call.name, args: call.args });
    }

    // Fase 2: o cliente já executou a ferramenta e mandou o resultado.
    if (modo === 'responder') {
      const response = await ai.models.generateContent({
        model: 'gemini-flash-latest',
        contents: [
          ...historico,
          {
            role: 'function',
            parts: [
              { functionResponse: { name: chamada.nome, response: chamada.resultado } },
            ],
          },
        ],
        config: { systemInstruction: INSTRUCAO_RESPOSTA },
      });

      return json({
        tipo: 'texto',
        texto: response.text ?? 'Ação executada com sucesso.',
      });
    }

    return json({ erro: 'Modo inválido' }, 400);
  } catch (err: any) {
    console.error('Erro na function da ARIA:', err);
    return json({ erro: 'Falha ao processar o comando' }, 500);
  }
};

// Netlify Functions v2: define a rota diretamente, sem precisar de
// redirect no netlify.toml.
export const config = { path: '/api/aria' };
