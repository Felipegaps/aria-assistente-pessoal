// src/types/household.ts

export interface HouseholdMember {
  uid: string;
  displayName: string;
  role: 'owner' | 'member'; // você = owner, esposa = member (ou iguais, sua escolha)
}

export interface Household {
  id: string;
  name: string; // ex: "Casa Silva"
  members: string[]; // array de uids, facilita as regras de segurança
  createdAt: number;
}

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  householdId: string; // vincula o usuário a uma household
}
