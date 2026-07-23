// src/services/conversationService.ts
//
// Persiste o histórico de conversa da ARIA por usuário no Firestore
// (users/{uid}/ariaConversation/current), para sobreviver a recarregar
// a página ou trocar de dispositivo.
//
// Estratégia simples: um único documento por usuário guardando o array
// de mensagens (bom o suficiente para 20 mensagens; se o histórico
// crescer muito no futuro, migrar para sub-coleção com paginação).

import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from './firebaseConfig';
import { Content } from '@google/genai';

function conversationDoc(uid: string) {
  return doc(db, 'users', uid, 'ariaConversation', 'current');
}

export async function loadConversation(uid: string): Promise<Content[]> {
  const snap = await getDoc(conversationDoc(uid));
  if (!snap.exists()) return [];
  return (snap.data().mensagens as Content[]) ?? [];
}

export async function saveConversation(uid: string, mensagens: Content[]): Promise<void> {
  await setDoc(conversationDoc(uid), {
    mensagens,
    atualizadoEm: Date.now(),
  });
}
