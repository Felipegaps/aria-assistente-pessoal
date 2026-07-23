// src/agents/ariaAgent.ts
//
// VERSÃO NETLIFY: substitui a versão anterior, que chamava o Gemini
// direto do navegador com a chave embutida no bundle.
//
// O que mudou: o raciocínio do Gemini saiu daqui e foi para
// netlify/functions/aria.ts. Este arquivo agora cuida de:
//   - manter e persistir o histórico de conversa (Firestore)
//   - conversar com a function (/api/aria)
//   - EXECUTAR as ferramentas de verdade, aqui no navegador
//
// A execução tem que ficar no cliente porque o Firestore usa a sessão
// autenticada, as APIs do Google usam o token OAuth do usuário, e o
// Home Assistant está na rede local de casa.

import { Content } from '@google/genai';
import { getAuth } from 'firebase/auth';
import { getRecentEmails } from '../services/gmailService';
import { getCachedEvents, syncCalendarToCache } from '../services/calendarService';
import { addShoppingItem } from '../services/shoppingService';
import { getAllDevices, homeActions } from '../services/homeService';
import { searchFiles, getRecentFiles } from '../services/driveService';
import { loadConversation, saveConversation } from '../services/conversationService';
import { UserProfile } from '../types/household';

const ENDPOINT = '/api/aria';
const MAX_MENSAGENS_HISTORICO = 20;

// Cache em memória: carrega do Firestore uma vez por usuário por sessão.
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

// --- Comunicação com a function --------------------------------------
// A function exige um ID token do Firebase; sem isso o endpoint estaria
// aberto para qualquer um gastar a cota do Gemini.

async function chamarFunction(payload: Record<string, unknown>) {
  const user = getAuth().currentUser;
  if (!user) throw new Error('Usuário não autenticado.');

  const idToken = await user.getIdToken();

  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const erro = await res.json().catch(() => ({}));
    throw new Error(erro.erro ?? `Falha na comunicação com a ARIA (${res.status})`);
  }

  return res.json();
}

// --- Execução real das ferramentas (no navegador) ---------------------

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

// --- Orquestrador principal ------------------------------------------

export async function processAriaCommand(
  comandoUsuario: string,
  profile: UserProfile
): Promise<string> {
  const historico = await getHistorico(profile.uid);

  adicionarAoHistorico(profile.uid, { role: 'user', parts: [{ text: comandoUsuario }] });

  let textoFinal: string;

  try {
    // Fase 1: pergunta à function o que fazer
    const decisao = await chamarFunction({ modo: 'decidir', historico });

    if (decisao.tipo === 'texto') {
      textoFinal = decisao.texto;
    } else {
      // Fase 2: executa a ferramenta aqui e devolve o resultado
      const resultado = await executarFerramenta(decisao.nome, decisao.args, profile);

      const resposta = await chamarFunction({
        modo: 'responder',
        historico,
        chamada: { nome: decisao.nome, resultado },
      });

      textoFinal = resposta.texto;
    }
  } catch (err: any) {
    textoFinal = `Não consegui completar essa ação: ${err.message}`;
  }

  adicionarAoHistorico(profile.uid, { role: 'model', parts: [{ text: textoFinal }] });

  // Salva no Firestore sem bloquear a resposta ao usuário
  saveConversation(profile.uid, historicosEmMemoria.get(profile.uid) ?? []).catch((err) =>
    console.error('Falha ao salvar histórico da ARIA:', err)
  );

  return textoFinal;
}
