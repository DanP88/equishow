// ─────────────────────────────────────────────────────────────────────────────
// v2/ui/Icon — iconographie V2 (LOT F11).
//
// UNE seule famille (MaterialCommunityIcons, via @expo/vector-icons) → cohérence
// visuelle, cross-platform Web + iOS, fonts chargées automatiquement par Expo.
//
// Deux usages :
//   <Icon name="truck" />                     ← nom MCI direct
//   <Icon name="🚚" />  (ou Row icon="🚚")    ← emoji hérité, mappé vers MCI
//
// `resolveIconName()` : convertit un emoji/nom en nom MCI (ou null si inconnu) —
// utilisé par les primitives kit pour migrer sans toucher chaque écran.
// ─────────────────────────────────────────────────────────────────────────────
import React from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';

// Emoji hérité → nom MaterialCommunityIcons.
const EMOJI_ICON: Record<string, string> = {
  '🏠': 'home-variant-outline',
  '🏡': 'home-city-outline',
  '🏆': 'trophy-outline',
  '🐴': 'horse',
  '🐎': 'horse-variant',
  '🏇': 'horse-human',
  '📅': 'calendar-blank-outline',
  '👤': 'account-outline',
  '👥': 'account-group-outline',
  '🔔': 'bell-outline',
  '💬': 'message-outline',
  '🧵': 'forum-outline',
  '🚚': 'truck-outline',
  '🎓': 'school-outline',
  '🏟': 'stadium-variant',
  '🎫': 'ticket-outline',
  '🎟': 'ticket-confirmation-outline',
  '⭐': 'star-outline',
  '★': 'star',
  '✍️': 'pencil-outline',
  '✏️': 'pencil-outline',
  '📝': 'clipboard-text-outline',
  '📋': 'clipboard-list-outline',
  '🧩': 'puzzle-outline',
  '⚙️': 'cog-outline',
  '❓': 'help-circle-outline',
  '📊': 'chart-line',
  '💶': 'currency-eur',
  '⚥': 'gender-male-female',
  '🎂': 'cake-variant-outline',
  '🎨': 'palette-outline',
  '📏': 'ruler',
  '🔖': 'bookmark-outline',
  '🌤': 'weather-partly-cloudy',
  '🕓': 'clock-outline',
  '📍': 'map-marker-outline',
  '🔎': 'magnify',
  '📣': 'bullhorn-outline',
  '🚪': 'door',
  '🌾': 'sprout-outline',
  '🧰': 'toolbox-outline',
  '🗂': 'folder-outline',
  '🎯': 'target',
  '🛣': 'road-variant',
  '💺': 'seat-outline',
  '🧍': 'human',
  '👁': 'eye-outline',
  '📷': 'camera-outline',
  '💊': 'medical-bag',
  '🩺': 'stethoscope',
  '➕': 'plus',
  '➖': 'minus',
  '＋': 'plus',
  '✅': 'check-circle-outline',
  '🟢': 'check-circle',
  '✔️': 'check',
  '✔︎': 'check',
  '✕': 'close',
  '✂️': 'scissors-cutting',
  '⏳': 'timer-sand',
  '⚠': 'alert-outline',
  '⚠️': 'alert-outline',
  '♥': 'heart',
  '💰': 'wallet-outline',
};

export function resolveIconName(input?: string): string | null {
  if (!input) return null;
  const trimmed = input.trim();
  if (EMOJI_ICON[trimmed]) return EMOJI_ICON[trimmed];
  // nom MCI direct (lettres, chiffres, tirets) — laissé passer tel quel.
  if (/^[a-z][a-z0-9-]+$/.test(trimmed)) return trimmed;
  return null;
}

export function Icon({ name, size = 18, color = Colors.textSecondary, style }: {
  name?: string;
  size?: number;
  color?: string;
  style?: any;
}) {
  const resolved = resolveIconName(name);
  if (!resolved) return null;
  return <MaterialCommunityIcons name={resolved as any} size={size} color={color} style={style} />;
}
