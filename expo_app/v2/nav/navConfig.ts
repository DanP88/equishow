// ─────────────────────────────────────────────────────────────────────────────
// v2/nav/navConfig — configuration de navigation V2.
//
// ⚠️ STRUCTURELLEMENT INDÉPENDANTE DES CAPACITÉS.
// Ces 5 onglets + la top bar sont IDENTIQUES pour les 7 combinaisons de
// capacités. Ce qui change vit À L'INTÉRIEUR des écrans, jamais ici.
// ─────────────────────────────────────────────────────────────────────────────

export interface V2Tab {
  key: string;
  label: string;
  icon: string;
  route: string;
  match: string[]; // préfixes de pathname qui « allument » l'onglet
}

export const V2_TABS: V2Tab[] = [
  { key: 'accueil', label: 'Accueil', icon: '🏠', route: '/(v2)/accueil', match: ['/accueil'] },
  { key: 'concours', label: 'Concours', icon: '🏆', route: '/(v2)/concours', match: ['/concours', '/(v2)/concours'] },
  { key: 'chevaux', label: 'Chevaux', icon: '🐴', route: '/(v2)/chevaux', match: ['/chevaux'] },
  { key: 'agenda', label: 'Agenda', icon: '📅', route: '/(v2)/agenda', match: ['/agenda'] },
  { key: 'profil', label: 'Profil', icon: '👤', route: '/(v2)/profil', match: ['/profil'] },
];

export const V2_TOPBAR = {
  home: '/(v2)/accueil',
  notifications: '/(v2)/notifications',
  messagerie: '/(v2)/messagerie',
  profil: '/(v2)/profil',
} as const;
