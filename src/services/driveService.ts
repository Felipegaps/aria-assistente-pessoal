// src/services/driveService.ts
//
// O Drive é sempre PRIVADO (cada usuário acessa só o próprio). Reutiliza
// o token único obtido via connectGoogle() em googleAuthService.ts — o
// escopo drive.readonly já é pedido lá.

import { getGoogleAccessToken } from './googleAuthService';
import { DriveFile } from '../types/drive';

const FIELDS = 'files(id,name,mimeType,webViewLink,modifiedTime,iconLink)';

function mapFile(f: any): DriveFile {
  return {
    id: f.id,
    nome: f.name,
    tipo: f.mimeType,
    link: f.webViewLink,
    modificadoEm: f.modifiedTime,
    iconeLink: f.iconLink,
  };
}

// Lista os arquivos mais recentes do Drive do usuário
export async function getRecentFiles(maxResults = 20): Promise<DriveFile[]> {
  const token = getGoogleAccessToken();

  const url =
    `https://www.googleapis.com/drive/v3/files` +
    `?pageSize=${maxResults}` +
    `&orderBy=modifiedTime desc` +
    `&fields=${encodeURIComponent(FIELDS)}` +
    `&q=${encodeURIComponent("trashed = false")}`;

  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`Falha ao listar arquivos: ${res.status}`);

  const data = await res.json();
  return (data.files ?? []).map(mapFile);
}

// Busca arquivos por nome (texto livre)
export async function searchFiles(termo: string, maxResults = 20): Promise<DriveFile[]> {
  const token = getGoogleAccessToken();

  // escapa aspas simples no termo de busca para não quebrar a query do Drive
  const termoEscapado = termo.replace(/'/g, "\\'");
  const q = `name contains '${termoEscapado}' and trashed = false`;

  const url =
    `https://www.googleapis.com/drive/v3/files` +
    `?pageSize=${maxResults}` +
    `&orderBy=modifiedTime desc` +
    `&fields=${encodeURIComponent(FIELDS)}` +
    `&q=${encodeURIComponent(q)}`;

  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`Falha ao buscar arquivos: ${res.status}`);

  const data = await res.json();
  return (data.files ?? []).map(mapFile);
}
