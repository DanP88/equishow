export type UserRole = 'cavalier' | 'organisateur' | 'coach' | 'admin';

export type PlanId = 'gratuit' | 'cavalierMensuel' | 'cavalierAnnuel' | 'coachPro';

export interface UserAuth {
  id: string;
  email: string;
  prenom: string;
  nom: string;
  role: UserRole;
  planId: PlanId;
  disciplines: string[];
  region?: string;
  avatarUrl?: string;
}

export const UserRoleLabel: Record<UserRole, string> = {
  cavalier: 'Cavalier',
  organisateur: 'Organisateur',
  coach: 'Coach',
  admin: 'Admin',
};
