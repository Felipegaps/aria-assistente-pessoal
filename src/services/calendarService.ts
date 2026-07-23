// src/services/calendarService.ts (v2 - usa googleAuthService)
//
// Substitui a versão anterior: não gerencia mais seu próprio OAuth,
// reutiliza o token único obtido via connectGoogle() em googleAuthService.ts.

import { collection, doc, setDoc, deleteDoc, getDocs } from 'firebase/firestore';
import { db } from './firebaseConfig';
import { getGoogleAccessToken } from './googleAuthService';
import { CalendarEvent } from '../types/calendar';

async function fetchOwnEvents(): Promise<any[]> {
  const token = getGoogleAccessToken();

  const timeMin = new Date().toISOString();
  const timeMax = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

  const url = `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${timeMin}&timeMax=${timeMax}&singleEvents=true&orderBy=startTime`;

  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`Falha ao buscar eventos: ${res.status}`);
  const data = await res.json();
  return data.items ?? [];
}

export async function syncCalendarToCache(uid: string, displayName: string) {
  const rawEvents = await fetchOwnEvents();
  const cacheRef = collection(db, 'users', uid, 'calendarCache');

  const existing = await getDocs(cacheRef);
  await Promise.all(existing.docs.map((d) => deleteDoc(d.ref)));

  await Promise.all(
    rawEvents.map((ev: any) => {
      const evento: CalendarEvent = {
        id: ev.id,
        titulo: ev.summary ?? '(Sem título)',
        inicio: ev.start?.dateTime ?? ev.start?.date,
        fim: ev.end?.dateTime ?? ev.end?.date,
        diaTodo: !ev.start?.dateTime,
        local: ev.location,
        donoUid: uid,
        donoNome: displayName,
      };
      return setDoc(doc(cacheRef, ev.id), evento);
    })
  );
}

export async function getCachedEvents(uid: string): Promise<CalendarEvent[]> {
  const cacheRef = collection(db, 'users', uid, 'calendarCache');
  const snap = await getDocs(cacheRef);
  return snap.docs.map((d) => d.data() as CalendarEvent);
}
