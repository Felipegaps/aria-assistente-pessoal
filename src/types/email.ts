// src/types/email.ts

export interface EmailMessage {
  id: string;
  remetente: string;
  assunto: string;
  resumo: string; // snippet
  recebidoEm: string; // ISO string
  lido: boolean;
}
