// src/services/googleAuthService.ts
//
// Ponto único de autenticação Google para toda a ARIA. Pede todos os
// escopos necessários (Calendar, Gmail, Drive) numa única janela de
// consentimento, e guarda o token em memória para os demais serviços
// (calendarService, gmailService, driveService) reutilizarem.
//
// Requer o script do Google Identity Services no index.html:
// <script src="https://accounts.google.com/gsi/client" async defer></script>

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string;

const SCOPES = [
  'https://www.googleapis.com/auth/calendar.events.readonly',
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/drive.readonly',
].join(' ');

let accessToken: string | null = null;
let expiresAt: number | null = null; // timestamp em ms

type Listener = (connected: boolean) => void;
const listeners: Listener[] = [];

export function onGoogleAuthChange(listener: Listener) {
  listeners.push(listener);
  return () => {
    const i = listeners.indexOf(listener);
    if (i >= 0) listeners.splice(i, 1);
  };
}

function notifyListeners() {
  listeners.forEach((l) => l(isGoogleConnected()));
}

export function connectGoogle(): Promise<void> {
  return new Promise((resolve, reject) => {
    // @ts-ignore - carregado via script tag do Google Identity Services
    const client = window.google.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: SCOPES,
      callback: (response: any) => {
        if (response.error) {
          reject(response);
          return;
        }
        accessToken = response.access_token;
        // expires_in vem em segundos
        expiresAt = Date.now() + (response.expires_in ?? 3600) * 1000;
        notifyListeners();
        resolve();
      },
    });
    client.requestAccessToken();
  });
}

export function isGoogleConnected(): boolean {
  if (!accessToken || !expiresAt) return false;
  return Date.now() < expiresAt;
}

// Usado pelos outros serviços (calendarService, gmailService, driveService)
// para pegar o token atual sem precisar reimplementar OAuth.
export function getGoogleAccessToken(): string {
  if (!isGoogleConnected() || !accessToken) {
    throw new Error('Google não conectado. Chame connectGoogle() primeiro.');
  }
  return accessToken;
}

export function disconnectGoogle() {
  accessToken = null;
  expiresAt = null;
  notifyListeners();
}
