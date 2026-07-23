// src/services/gmailService.ts (v2 - usa googleAuthService)
//
// Substitui a versão anterior: não gerencia mais seu próprio OAuth,
// reutiliza o token único obtido via connectGoogle() em googleAuthService.ts.

import { getGoogleAccessToken } from './googleAuthService';

async function listMessageIds(maxResults = 15): Promise<string[]> {
  const token = getGoogleAccessToken();
  const url = `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=${maxResults}&labelIds=INBOX`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`Falha ao listar e-mails: ${res.status}`);
  const data = await res.json();
  return (data.messages ?? []).map((m: any) => m.id);
}

async function getMessageMeta(id: string) {
  const token = getGoogleAccessToken();
  const url = `https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`Falha ao buscar e-mail ${id}`);
  return res.json();
}

function extractHeader(headers: any[], name: string): string {
  return headers?.find((h) => h.name === name)?.value ?? '';
}

export async function getRecentEmails(maxResults = 15) {
  const ids = await listMessageIds(maxResults);

  const messages = await Promise.all(
    ids.map(async (id) => {
      const meta = await getMessageMeta(id);
      const headers = meta.payload?.headers ?? [];

      return {
        id: meta.id,
        remetente: extractHeader(headers, 'From'),
        assunto: extractHeader(headers, 'Subject') || '(Sem assunto)',
        resumo: meta.snippet ?? '',
        recebidoEm: new Date(Number(meta.internalDate)).toISOString(),
        lido: !meta.labelIds?.includes('UNREAD'),
      };
    })
  );

  return messages;
}
