// src/types/calendar.ts

export interface CalendarEvent {
  id: string;
  titulo: string;
  inicio: string; // ISO string
  fim: string; // ISO string
  diaTodo: boolean;
  local?: string;
  donoUid: string; // uid de quem é o evento (você ou sua esposa)
  donoNome: string;
}
