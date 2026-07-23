// src/agents/ariaAgent.ts
//
// Orquestrador central da ARIA. Recebe um comando em linguagem natural,
// usa o Gemini (function calling) para decidir qual sub-agente e ação
// executar, roda a ação de verdade contra os serviços reais (Firestore,
// Google APIs, Home Assistant), e devolve uma resposta em linguagem
// natural para o usuário.
//
// Mantém memória de conversa por usuário, persistida no Firestore, para
// entender referências a mensagens anteriores.

import { GoogleGenAI, FunctionDeclaration, Type, Content } from '@google/genai';
import { getRecentEmails } from '../services/gmailService';
import { getCachedEvents, syncCalendarToCache } from '../services/calendarService';
import { addShoppingItem } from '../services/shoppingService';
import { getAllDevices, homeActions } from '../services/homeService';
import { searchFiles, getRecentFiles } from '../services/driveService';
import { loadConversation, saveConversation } from '../services/conversationService';
import { UserProfile } from '../types/household';

const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY });

const MAX_MENSAGENS_HISTORICO = 20;

// Cache em memória para não bater no Firestore a cada mensagem — carrega
// uma vez por usuário por sessão do app, depois só atualiza local + salva.
const historicosEmMemoria = new Map<string, Content[]>();
const historicosCarregados = new Set<string>();

async function getHistorico(uid: string): Promise<Content[]> {
  if (!historicosCarregados.has(uid)) {
    const carregado = await loadConversation(uid);
    historicosEmMemoria.set(uid, carregado);
    historicosCarregados.add(uid);
  }
  return historicosEmMemoria.get(uid) ?? [];
}

function adicionarAoHistorico(uid: string, mensagem: Content) {
  const historico = historicosEmMemoria.get(uid) ?? [];
  historico.push(mensagem);
  if (historico.length > MAX_MENSAGENS_HISTORICO) {
    historico.splice(0, historico.length - MAX_MENSAGENS_HISTORICO);
  }
  historicosEmMemoria.set(uid, historico);
}

export async function limparHistorico(uid: string) {
  historicosEmMemoria.set(uid, []);
  await saveConversation(uid, []);
}

// --- Declaração das ferramentas disponíveis para o Gemini escolher ---

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

// --- Execução real de cada ferramenta ---

async function executarFerramenta(nome: string, args: any, profile: UserProfile): Promise<any> {
  switch (nome) {
    case 'listar_emails':
      return getRecentEmails();

    case 'listar_agenda':
      return getCachedEvents(profile.uid);

    case 'sincronizar_agenda':
      await syncCalendarToCache(profile.uid, profile.displayName);
      return { ok: true };

    case 'adicionar_item_compra':
      await addShoppingItem(profile.householdId, {
        tipo: args.tipo,
        item: args.item,
        link: args.link,
        uid: profile.uid,
        displayName: profile.displayName,
      });
      return { ok: true };

    case 'controlar_dispositivo': {
      const mapa: Record<string, (id: string) => Promise<any>> = {
        ligar: homeActions.ligar,
        desligar: homeActions.desligar,
        trancar: homeActions.trancar,
        destrancar: homeActions.destrancar,
      };
      await mapa[args.acao](args.entityId);
      return { ok: true };
    }

    case 'listar_dispositivos':
      return getAllDevices();

    case 'buscar_arquivo_drive':
      return searchFiles(args.termo);

    case 'listar_arquivos_recentes':
      return getRecentFiles();

    default:
      throw new Error(`Ferramenta desconhecida: ${nome}`);
  }
}

// --- Orquestrador principal ---

export async function processAriaCommand(
  comandoUsuario: string,
  profile: UserProfile
): Promise<string> {
  const historico = await getHistorico(profile.uid);

  const mensagemAtual: Content = { role: 'user', parts: [{ text: comandoUsuario }] };
  adicionarAoHistorico(profile.uid, mensagemAtual);

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: [...historico],
    config: {
      systemInstruction:
        'Você é a ARIA, uma assistente pessoal estilo JARVIS. Responda sempre em português, ' +
        'de forma direta e educada. Use as ferramentas disponíveis para executar ações reais ' +
        'quando o pedido do usuário exigir (agenda, e-mail, lista de compras, casa inteligente, ' +
        'arquivos do Drive). Use o histórico da conversa para entender referências a mensagens ' +
        'anteriores. Se o pedido não precisar de nenhuma ferramenta, responda normalmente com texto.',
      tools: [{ functionDeclarations: tools }],
    },
  });

  const call = response.functionCalls?.[0];
  let textoFinal: string;

  if (!call) {
    textoFinal = response.text ?? 'Não consegui processar seu pedido.';
  } else {
    try {
      const resultado = await executarFerramenta(call.name, call.args, profile);

      const respostaFinal = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [
          ...historico,
          {
            role: 'function',
            parts: [{ functionResponse: { name: call.name, response: resultado } }],
          },
        ],
        config: {
          systemInstruction:
            'Você é a ARIA. Transforme o resultado da ferramenta numa resposta curta, natural ' +
            'e em português para o usuário. Não invente dados que não estão no resultado.',
        },
      });

      textoFinal = respostaFinal.text ?? 'Ação executada com sucesso.';
    } catch (err: any) {
      textoFinal = `Não consegui completar essa ação: ${err.message}`;
    }
  }

  adicionarAoHistorico(profile.uid, { role: 'model', parts: [{ text: textoFinal }] });

  // Salva no Firestore de forma assíncrona (não bloqueia a resposta ao usuário)
  saveConversation(profile.uid, historicosEmMemoria.get(profile.uid) ?? []).catch((err) =>
    console.error('Falha ao salvar histórico da ARIA:', err)
  );

  return textoFinal;
}
