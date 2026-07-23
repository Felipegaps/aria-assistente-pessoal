// src/services/shoppingService.ts
import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  orderBy,
  where,
} from 'firebase/firestore';
import { db } from './firebaseConfig';
import { ShoppingItem, ShoppingType } from '../types/shopping';

function shoppingCollection(householdId: string) {
  return collection(db, 'households', householdId, 'shopping');
}

export async function addShoppingItem(
  householdId: string,
  data: {
    tipo: ShoppingType;
    item: string;
    link?: string;
    uid: string;
    displayName: string;
  }
) {
  await addDoc(shoppingCollection(householdId), {
    tipo: data.tipo,
    item: data.item,
    link: data.link ?? null,
    status: 'pendente',
    adicionadoPor: data.uid,
    adicionadoPorNome: data.displayName,
    criadoEm: Date.now(),
  });
}

export async function markAsPurchased(householdId: string, itemId: string) {
  await updateDoc(doc(db, 'households', householdId, 'shopping', itemId), {
    status: 'comprado',
    compradoEm: Date.now(),
  });
}

export async function markAsPending(householdId: string, itemId: string) {
  await updateDoc(doc(db, 'households', householdId, 'shopping', itemId), {
    status: 'pendente',
    compradoEm: null,
  });
}

export async function removeShoppingItem(householdId: string, itemId: string) {
  await deleteDoc(doc(db, 'households', householdId, 'shopping', itemId));
}

// Escuta em tempo real (pra refletir na hora quando a esposa adicionar algo)
export function listenShoppingList(
  householdId: string,
  tipo: ShoppingType,
  callback: (items: ShoppingItem[]) => void
) {
  const q = query(
    shoppingCollection(householdId),
    where('tipo', '==', tipo),
    orderBy('criadoEm', 'desc')
  );

  return onSnapshot(q, (snapshot) => {
    const items = snapshot.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    })) as ShoppingItem[];
    callback(items);
  });
}
