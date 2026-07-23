// src/services/homeConfigService.ts
//
// Guarda a URL e o token do Home Assistant no Firestore, dentro da
// household, em vez de embutir no bundle via variável VITE_.
//
// POR QUE: tudo que é VITE_* vira JavaScript público no site publicado.
// Um long-lived token do Home Assistant exposto ali significa que
// qualquer pessoa que alcance o HA consegue controlar a casa. Aqui o
// token só é legível por quem está autenticado e pertence à household
// (ver firestore.rules).

import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from './firebaseConfig';

export interface HomeConfig {
  url: string;
  token: string;
  atualizadoEm: number;
}

function configDoc(householdId: string) {
  return doc(db, 'households', householdId, 'config', 'homeAssistant');
}

export async function loadHomeConfig(householdId: string): Promise<HomeConfig | null> {
  const snap = await getDoc(configDoc(householdId));
  return snap.exists() ? (snap.data() as HomeConfig) : null;
}

export async function saveHomeConfig(
  householdId: string,
  url: string,
  token: string
): Promise<void> {
  await setDoc(configDoc(householdId), {
    url: url.trim().replace(/\/$/, ''), // remove barra final
    token: token.trim(),
    atualizadoEm: Date.now(),
  });
}
