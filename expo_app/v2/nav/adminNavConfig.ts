// ─────────────────────────────────────────────────────────────────────────────
// v2/nav/adminNavConfig — configuration de navigation ADMIN V2.
//
// Espace SÉPARÉ de la nav Concours-first (cavalier/coach/organisateur) : un
// compte admin ne voit jamais la bottom bar standard. Mirroir fonctionnel de
// components/CustomBottomBar.tsx TABS_BY_ROLE.admin (7 onglets opérationnels —
// « Accueil » V1 n'est pas repris : c'est un simple résumé/raccourcis vers les
// mêmes écrans, cf. VALIDATION_REPORT.md).
// ─────────────────────────────────────────────────────────────────────────────

export interface AdminTab {
  key: string;
  label: string;
  icon: string;
  route: string;
  match: string[];
}

export const ADMIN_TABS: AdminTab[] = [
  { key: 'analytics', label: 'Analytics', icon: 'chart-line', route: '/(v2)/admin/analytics', match: ['/admin/analytics'] },
  { key: 'disputes', label: 'Litiges', icon: 'scale-balance', route: '/(v2)/admin/disputes', match: ['/admin/disputes'] },
  { key: 'support', label: 'Réclamations', icon: 'email-alert-outline', route: '/(v2)/admin/support', match: ['/admin/support'] },
  { key: 'commissions', label: 'Commissions', icon: 'currency-eur', route: '/(v2)/admin/commissions', match: ['/admin/commissions'] },
  { key: 'import', label: 'Import CSV', icon: 'file-upload-outline', route: '/(v2)/admin/import-concours', match: ['/admin/import-concours'] },
  { key: 'notifications', label: 'Notifs', icon: 'bell-outline', route: '/(v2)/admin/notifications', match: ['/admin/notifications'] },
  { key: 'profil', label: 'Profil', icon: 'account-cog-outline', route: '/(v2)/admin/profil', match: ['/admin/profil'] },
];

export const ADMIN_HOME = '/(v2)/admin/analytics';
