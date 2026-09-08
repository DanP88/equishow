// ─────────────────────────────────────────────────────────────────────────────
// v2/ui/blush — THÈME « Blush + fun » (test accueil V2).
//
//   Palette : direction 6 « Blush » (rose poudré + prune).
//   Seconds rôles (fun / étiquettes) : direction 2 « Sticker pop » (lilas + corail).
//   Dosage : « Équilibré ».
//
// FRONT-ONLY, réversible (git revert). N'écrase PAS constants/colors.ts (V1).
// ─────────────────────────────────────────────────────────────────────────────
import { Platform } from 'react-native';

export const BL = {
  bg: '#FBF4F3',
  card: '#FFFFFF',
  ink: '#3A2530',
  sub: '#806A73',
  faint: '#B9A6AD',
  line: '#F1E4E4',

  accent: '#B5546A',      // prune — actions & accents
  accentInk: '#FFFFFF',
  accentSoft: '#F7E3E6',
  accentLine: '#EBC7CE',

  lilac: '#9F7AD1',       // 2ᵈ rôle — social / nouveau / libellés de section
  lilacSoft: '#F0E9F8',
  coral: '#EE9E84',       // 2ᵈ rôle — dispo / places
  coralInk: '#C56A4E',
  coralSoft: '#FCECE4',
  berry: '#C33E63',       // urgence uniquement
  sage: '#5E8C70',
  sageSoft: '#EAF3EC',
  gold: '#A6822E',
  goldSoft: '#FBF1DB',
  neutralSoft: '#EFE7E9',

  radius: 20,
  radiusCard: 16,
  radiusTile: 16,
} as const;

// Polices : web = Google Fonts (injectées ci-dessous) ; iOS = repli Georgia ;
// autres natifs = système.
export const FONT = {
  head: Platform.select({ web: "'Fraunces', Georgia, serif", ios: 'Georgia', default: undefined }) as string | undefined,
  body: Platform.select({ web: "'Hanken Grotesk', system-ui, sans-serif", default: undefined }) as string | undefined,
};

let _fontsInjected = false;
/** Injecte Fraunces + Hanken Grotesk sur le web (une seule fois). No-op sur natif. */
export function injectBlushFonts() {
  if (_fontsInjected || Platform.OS !== 'web') return;
  if (typeof document === 'undefined') return;
  _fontsInjected = true;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href =
    'https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600;9..144,700' +
    '&family=Hanken+Grotesk:wght@400;500;600;700;800&display=swap';
  document.head.appendChild(link);
}

// ── Étiquettes ──────────────────────────────────────────────────────────────
export type StickerTone = 'accent' | 'berry' | 'lilac' | 'coral' | 'sage' | 'gold' | 'neutral';

export const STICKER_TONE: Record<StickerTone, { bg: string; fg: string }> = {
  accent: { bg: BL.accent, fg: BL.accentInk },
  berry: { bg: BL.berry, fg: '#FFFFFF' },
  lilac: { bg: BL.lilacSoft, fg: BL.lilac },
  coral: { bg: BL.coralSoft, fg: BL.coralInk },
  sage: { bg: BL.sageSoft, fg: BL.sage },
  gold: { bg: BL.goldSoft, fg: BL.gold },
  neutral: { bg: BL.neutralSoft, fg: BL.sub },
};

/** Nombre de jours entre aujourd'hui et `dateStr` (YYYY-MM-DD). null si invalide. */
export function daysUntil(dateStr?: string | null): number | null {
  if (!dateStr) return null;
  const d = new Date(`${String(dateStr).slice(0, 10)}T00:00:00`);
  if (isNaN(d.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - today.getTime()) / 86_400_000);
}

/** Étiquette de compte à rebours à partir d'un nb de jours. */
export function countdown(days: number | null): { label: string; tone: StickerTone } | null {
  if (days == null) return null;
  if (days < 0) return { label: 'terminé', tone: 'neutral' };
  if (days === 0) return { label: "aujourd'hui", tone: 'berry' };
  if (days === 1) return { label: 'demain', tone: 'berry' };
  if (days <= 12) return { label: `à J-${days}`, tone: 'accent' };
  if (days <= 60) return { label: `dans ${Math.round(days / 7)} sem.`, tone: 'accent' };
  return { label: `dans ${Math.round(days / 30)} mois`, tone: 'accent' };
}
