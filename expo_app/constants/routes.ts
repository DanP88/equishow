import { UserRole } from '../types/user';

// Premier onglet (route home) par rôle — doit rester aligné avec
// TABS_BY_ROLE dans components/CustomBottomBar.tsx.
// Source unique réutilisée par signup, compte-type, etc.
export const HOME_ROUTE_BY_ROLE: Record<UserRole, string> = {
  cavalier:     '/(tabs)/chevaux',
  coach:        '/(tabs)/coach-agenda',
  organisateur: '/(tabs)/org-concours',
  admin:        '/(tabs)/admin-settings',
};
