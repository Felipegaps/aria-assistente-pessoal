// src/types/home.ts

export interface HomeDeviceState {
  entity_id: string; // ex: "light.sala", "climate.termostato"
  state: string; // ex: "on", "off", "22.5"
  attributes: Record<string, any>; // brilho, cor, temperatura alvo, etc.
  friendly_name: string;
}

export type DeviceDomain = 'light' | 'switch' | 'climate' | 'lock' | 'cover' | 'fan';
