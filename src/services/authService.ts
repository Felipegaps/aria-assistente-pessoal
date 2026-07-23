// src/services/authService.ts
import {
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signOut,
  User,
} from 'firebase/auth';
import { doc, setDoc, getDoc, updateDoc, arrayUnion } from 'firebase/firestore';
import { db } from './firebaseConfig'; // seu app já inicializado

const auth = getAuth();

export async function login(email: string, password: string) {
  const cred = await signInWithEmailAndPassword(auth, email, password);
  return cred.user;
}

export async function logout() {
  await signOut(auth);
}

// Criação de usuário + vínculo a uma household existente (via convite) ou nova
export async function registerUser(
  email: string,
  password: string,
  displayName: string,
  householdId?: string // se undefined, cria uma household nova
) {
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  const uid = cred.user.uid;

  let finalHouseholdId = householdId;

  if (!finalHouseholdId) {
    // cria uma nova household e o usuário vira owner
    finalHouseholdId = uid; // simplificação: id da household = uid do criador
    await setDoc(doc(db, 'households', finalHouseholdId), {
      id: finalHouseholdId,
      name: `Casa de ${displayName}`,
      members: [uid],
      createdAt: Date.now(),
    });
  } else {
    // entra numa household existente (ex: esposa entrando na do marido)
    await updateDoc(doc(db, 'households', finalHouseholdId), {
      members: arrayUnion(uid),
    });
  }

  await setDoc(doc(db, 'users', uid), {
    uid,
    email,
    displayName,
    householdId: finalHouseholdId,
  });

  return cred.user;
}

export function onAuthChange(callback: (user: User | null) => void) {
  return onAuthStateChanged(auth, callback);
}

export async function getUserProfile(uid: string) {
  const snap = await getDoc(doc(db, 'users', uid));
  return snap.exists() ? snap.data() : null;
}
