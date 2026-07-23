// src/services/homeService.ts
//
// VERSÃO SEGURA: a URL e o token do Home Assistant vêm do Firestore
// (homeConfigService), não mais de variáveis VITE_ embutidas no bundle.
//
// Chame initHomeService(householdId) uma vez depois do login — o App.tsx
// já faz isso. A configuração é carregada sob demanda e cacheada.
//
// LEMBRETE: o app roda em HTTPS (Netlify), então o Home Assistant também
// precisa estar em https:// — o navegador bloqueia chamadas para http://
// simples a partir de uma página segura (mixed content). Configure um
// certificado no HA e confie nele no celular usado em casa.

import { HomeDeviceState } from '../types/home';
import { loadHomeConfig, HomeConfig } from './homeConfigService';

let householdIdAtual: string | null = null;
let cache: HomeConfig | null = null;

export function initHomeService(householdId: string) {
  householdIdAtual = householdId;
  cache = null; // força recarregar se trocar de household
}

// Invalida o cache depois de salvar uma configuração nova
export function invalidarConfigHome() {
  cache = null;
}

async function getConfig(): Promise<HomeConfig> {
  if (cache) return cache;

  if (!householdIdAtual) {
    throw new Error('Home Assistant não inicializado.');
  }

  const cfg = await loadHomeConfig(householdIdAtual);

  if (!cfg?.url || !cfg?.token) {
    throw new Error(
      'Home Assistant ainda não configurado. Cadastre a URL e o token na aba Casa.'
    );
  }

  cache = cfg;
  return cfg;
}

async function headers() {
  const { token } = await getConfig();
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
}

// Lista o estado de todos os dispositivos conhecidos pelo Home Assistant
export async function getAllDevices(): Promise<HomeDeviceState[]> {
  const { url } = await getConfig();
  const res = await fetch(`${url}/api/states`, { headers: await headers() });
  if (!res.ok) throw new Error(`Falha ao consultar dispositivos: ${res.status}`);
  return res.json();
}

// Retorna o estado de um único dispositivo (ex: "light.sala")
export async function getDeviceState(entityId: string): Promise<HomeDeviceState> {
  const { url } = await getConfig();
  const res = await fetch(`${url}/api/states/${entityId}`, { headers: await headers() });
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
  const { url } = await getConfig();
  const res = await fetch(`${url}/api/services/${domain}/${service}`, {
    method: 'POST',
    headers: await headers(),
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
