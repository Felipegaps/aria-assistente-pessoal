// src/services/homeService.ts
//
// IMPORTANTE (leia antes de usar):
// A ARIA roda como PWA em HTTPS (Firebase Hosting). Se o Home Assistant
// estiver servindo em http:// simples, o navegador vai bloquear essas
// chamadas por política de "mixed content". Configure HTTPS no HA
// (Configurações > Add-ons > "Let's Encrypt" ou certificado autoassinado)
// e confie no certificado no celular usado em casa. Depois disso, use
// https://homeassistant.local:8123 (ou o IP local) na env var abaixo.
//
// Defina no seu .env:
// VITE_HOME_ASSISTANT_URL=https://homeassistant.local:8123
// VITE_HOME_ASSISTANT_TOKEN=<seu long-lived access token>

import { HomeDeviceState } from '../types/home';

const HA_URL = import.meta.env.VITE_HOME_ASSISTANT_URL as string;
const HA_TOKEN = import.meta.env.VITE_HOME_ASSISTANT_TOKEN as string;

function headers() {
  return {
    Authorization: `Bearer ${HA_TOKEN}`,
    'Content-Type': 'application/json',
  };
}

// Lista o estado de todos os dispositivos conhecidos pelo Home Assistant
export async function getAllDevices(): Promise<HomeDeviceState[]> {
  const res = await fetch(`${HA_URL}/api/states`, { headers: headers() });
  if (!res.ok) throw new Error(`Falha ao consultar dispositivos: ${res.status}`);
  return res.json();
}

// Retorna o estado de um único dispositivo (ex: "light.sala")
export async function getDeviceState(entityId: string): Promise<HomeDeviceState> {
  const res = await fetch(`${HA_URL}/api/states/${entityId}`, { headers: headers() });
  if (!res.ok) throw new Error(`Dispositivo não encontrado: ${entityId}`);
  return res.json();
}

// Chama um serviço genérico do HA (ex: domain="light", service="turn_on")
export async function callService(
  domain: string,
  service: string,
  entityId: string,
  extraData: Record<string, any> = {}
) {
  const res = await fetch(`${HA_URL}/api/services/${domain}/${service}`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ entity_id: entityId, ...extraData }),
  });
  if (!res.ok) throw new Error(`Falha ao executar ${service} em ${entityId}`);
  return res.json();
}

// Atalhos comuns
export const homeActions = {
  ligar: (entityId: string) => callService('homeassistant', 'turn_on', entityId),
  desligar: (entityId: string) => callService('homeassistant', 'turn_off', entityId),
  ajustarTemperatura: (entityId: string, temperatura: number) =>
    callService('climate', 'set_temperature', entityId, { temperature: temperatura }),
  trancar: (entityId: string) => callService('lock', 'lock', entityId),
  destrancar: (entityId: string) => callService('lock', 'unlock', entityId),
};
