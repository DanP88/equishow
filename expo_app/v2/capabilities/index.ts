export * from './types';
export { useCapabilities } from './useCapabilities';
export type { UseCapabilities } from './useCapabilities';
// Presets de test (7 combinaisons) — réutilisés par le panneau DEV.
import { Capability } from './types';

export const CAPABILITY_PRESETS: { key: string; label: string; caps: Capability[] }[] = [
  { key: 'cav', label: 'Cavalier seul', caps: ['cavalier'] },
  { key: 'coa', label: 'Coach seul', caps: ['coach'] },
  { key: 'org', label: 'Organisateur seul', caps: ['organisateur'] },
  { key: 'cav-coa', label: 'Cavalier + Coach', caps: ['cavalier', 'coach'] },
  { key: 'cav-org', label: 'Cavalier + Organisateur', caps: ['cavalier', 'organisateur'] },
  { key: 'coa-org', label: 'Coach + Organisateur', caps: ['coach', 'organisateur'] },
  { key: 'all', label: 'Cavalier + Coach + Organisateur', caps: ['cavalier', 'coach', 'organisateur'] },
];
