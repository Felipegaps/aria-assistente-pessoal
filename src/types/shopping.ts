// src/types/shopping.ts

export type ShoppingType = 'casa' | 'online';
export type ShoppingStatus = 'pendente' | 'comprado';

export interface ShoppingItem {
  id: string;
  tipo: ShoppingType;
  item: string;
  link?: string; // só faz sentido para tipo 'online'
  status: ShoppingStatus;
  adicionadoPor: string; // uid
  adicionadoPorNome: string; // exibição rápida sem precisar de join
  criadoEm: number;
  compradoEm?: number;
}
