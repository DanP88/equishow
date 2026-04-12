/**
 * Configuration des onglets par rôle utilisateur
 * Structure claire et extensible
 */

export interface TabConfig {
  name: string;
  emoji: string;
  label: string;
}

export const TABS_BY_ROLE: Record<'cavalier' | 'coach' | 'organisateur', TabConfig[]> = {
  cavalier: [
    { name: 'chevaux', emoji: '🐴', label: 'Chevaux' },
    { name: 'concours', emoji: '🏆', label: 'Concours' },
    { name: 'services', emoji: '🤝', label: 'Services' },
    { name: 'communaute', emoji: '👥', label: 'Communauté' },
    { name: 'profil', emoji: '👤', label: 'Profil' },
  ],

  coach: [
    { name: 'coach-agenda', emoji: '📅', label: 'Mon agenda' },
    { name: 'coach-demandes', emoji: '📬', label: 'Demandes' },
    { name: 'coach-services', emoji: '🎓', label: 'Mes services' },
    { name: 'communaute-coach', emoji: '👥', label: 'Communauté coach' },
    { name: 'profil-coach', emoji: '👤', label: 'Profil' },
  ],

  organisateur: [
    { name: 'profil-org', emoji: '👤', label: 'Profil' },
    { name: 'org-concours', emoji: '🏆', label: 'Mes concours' },
    { name: 'communaute-org', emoji: '👥', label: 'Communauté' },
    { name: 'org-services', emoji: '📦', label: 'Services' },
  ],
};
