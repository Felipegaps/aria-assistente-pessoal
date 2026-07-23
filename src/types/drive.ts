// src/types/drive.ts

export interface DriveFile {
  id: string;
  nome: string;
  tipo: string; // mimeType
  link: string; // webViewLink - abre o arquivo no Drive
  modificadoEm: string; // ISO string
  iconeLink?: string;
}
