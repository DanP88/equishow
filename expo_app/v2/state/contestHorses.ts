// ─────────────────────────────────────────────────────────────────────────────
// v2/state/contestHorses — LE contexte cheval d'un concours (F8).
//
//   useV2AllHorses()          → chevaux réels (Supabase, LECTURE SEULE) fusionnés
//                               avec les chevaux locaux V2 (v2:chevaux).
//   useV2ContestHorses(id)    → chevaux choisis pour CE concours (dans « Préparer
//                               mon concours › Cheval ») + libellés prêts à
//                               afficher. Transport / Box / Coach lisent ceci —
//                               ils ne redemandent JAMAIS le cheval.
//
// Aucune écriture PROD : les chevaux réels viennent de `useMyChevaux()` sans
// mutation ; la sélection vit dans `concoursLocal` (AsyncStorage).
// ─────────────────────────────────────────────────────────────────────────────
import { useMemo } from 'react';
import { useMyChevaux } from '../../hooks/useChevaux';
import { useConcoursLocal, type NeedModule } from './concoursLocal';
import { useChevauxLocal } from './chevauxLocal';

export interface UnifiedHorse {
  id: string;
  nom: string;
  src: 'real' | 'local';
  race?: string;
  robe?: string;
  sexe?: string;
  anneeNaissance?: number;
  taille?: string;
  disciplines: string[];
  couleur?: string;
}

function ageLabel(y?: number): string | undefined {
  if (!y) return undefined;
  const a = new Date().getFullYear() - y;
  return a > 0 && a < 45 ? `${a} ans` : undefined;
}
/** Sous-titre « 12 ans · Selle Français · CSO » (segments vides ignorés). */
export function horseSubtitle(h: UnifiedHorse): string {
  return [ageLabel(h.anneeNaissance), h.race, h.disciplines[0]].filter(Boolean).join(' · ');
}

export function useV2AllHorses() {
  const { chevaux: real } = useMyChevaux();
  const { chevaux: local, ready: localReady } = useChevauxLocal();

  return useMemo(() => {
    const realU: UnifiedHorse[] = (real ?? []).map((c) => ({
      id: c.id, nom: c.nom, src: 'real' as const,
      race: c.race, robe: c.robe, sexe: c.sexe, anneeNaissance: c.anneeNaissance,
      taille: c.taille, disciplines: c.disciplines ?? [], couleur: c.photoColor,
    }));
    const localU: UnifiedHorse[] = (local ?? []).map((c) => ({
      id: c.id, nom: c.nom, src: 'local' as const,
      race: c.race, robe: c.robe, sexe: c.sexe, anneeNaissance: c.anneeNaissance,
      taille: c.taille, disciplines: c.discipline ? [c.discipline] : [], couleur: c.couleur,
    }));
    const all = [...realU, ...localU];
    return {
      ready: localReady,
      real: realU,
      local: localU,
      all,
      byId: (id?: string | null) => (id ? all.find((h) => h.id === id) : undefined),
      isEmpty: all.length === 0,
    };
  }, [real, local, localReady]);
}

export interface ContestHorses {
  ready: boolean;
  ids: string[];
  horses: UnifiedHorse[];
  names: string[];
  count: number;
  hasSelection: boolean;
  /** id du 1ᵉʳ cheval — pour les enregistrements mono-cheval (bookings). */
  primaryId?: string;
  /** rappel court : « Pour : Tornado » · « Pour : Tornado + Balou » · « 3 chevaux concernés ». */
  label: string;
  /** résumé carte : « 2 chevaux sélectionnés · Tornado, Balou ». */
  summary: string;
}

/**
 * @param module (F14) — si fourni, renvoie les chevaux RATTACHÉS À CE MODULE
 *   (transport/box/coach) ; repli sur la sélection concours complète si aucun
 *   cheval n'a été précisé pour ce module.
 */
export function useV2ContestHorses(concoursId?: string, module?: NeedModule): ContestHorses {
  const cl = useConcoursLocal(concoursId);
  const pool = useV2AllHorses();

  return useMemo(() => {
    const selected = cl.entry.selectedHorseIds ?? [];
    const moduleIds = module ? (cl.entry.horsesByNeed?.[module] ?? []) : [];
    const ids = module && moduleIds.length > 0 ? moduleIds : selected;
    const horses = ids.map((id) => pool.byId(id)).filter(Boolean) as UnifiedHorse[];
    const names = horses.map((h) => h.nom);
    const count = horses.length;
    let label = '';
    if (count === 1) label = `Pour : ${names[0]}`;
    else if (count === 2) label = `Pour : ${names[0]} + ${names[1]}`;
    else if (count >= 3) label = `${count} chevaux concernés`;
    const summary = count === 0
      ? 'Aucun cheval sélectionné'
      : `${count} ${count > 1 ? 'chevaux sélectionnés' : 'cheval sélectionné'}${names.length ? ` · ${names.join(', ')}` : ''}`;
    return {
      ready: cl.ready && pool.ready,
      ids, horses, names, count,
      hasSelection: count > 0,
      primaryId: horses[0]?.id,
      label, summary,
    };
  }, [cl.entry.selectedHorseIds, cl.entry.horsesByNeed, module, cl.ready, pool]);
}
