// ─────────────────────────────────────────────────────────────────────────────
// useChevalReservations — historique des réservations rattachées à un cheval (078).
// Agrège les 4 modules (box/transport/coach/stage) filtrés sur cheval_id, avec le
// concours associé si l'annonce y est liée. Lecture seule, défensif : une requête
// en échec n'empêche pas l'affichage des autres (ne casse jamais la fiche cheval).
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export interface ChevalReservation {
  id: string;
  module: 'box' | 'transport' | 'coach' | 'stage';
  icon: string;
  title: string;
  status: string | null;
  date: string | null;        // YYYY-MM-DD
  concoursNom: string | null;
}

const firstConcoursNom = (annonce: any): string | null => {
  const a = Array.isArray(annonce) ? annonce[0] : annonce;
  const c = a?.concours;
  const cc = Array.isArray(c) ? c[0] : c;
  return cc?.nom ?? null;
};

export function useChevalReservations(chevalId?: string) {
  const [items, setItems] = useState<ChevalReservation[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const load = useCallback(async () => {
    if (!chevalId) { setItems([]); setIsLoading(false); return; }
    setIsLoading(true);

    const out: ChevalReservation[] = [];
    const safe = async (fn: () => Promise<void>) => { try { await fn(); } catch { /* défensif */ } };

    await Promise.all([
      safe(async () => {
        const { data } = await supabase
          .from('box_reservations')
          .select('id, title, status, date_debut, box_annonces(concours(nom))')
          .eq('cheval_id', chevalId);
        (data ?? []).forEach((r: any) => out.push({
          id: r.id, module: 'box', icon: '📦', title: r.title ?? 'Box',
          status: r.status ?? null, date: r.date_debut ?? null, concoursNom: firstConcoursNom(r.box_annonces),
        }));
      }),
      safe(async () => {
        const { data } = await supabase
          .from('transport_reservations')
          .select('id, titre, statut, transport_annonces(concours(nom))')
          .eq('cheval_id', chevalId);
        (data ?? []).forEach((r: any) => out.push({
          id: r.id, module: 'transport', icon: '🚐', title: r.titre ?? 'Transport',
          status: r.statut ?? null, date: null, concoursNom: firstConcoursNom(r.transport_annonces),
        }));
      }),
      safe(async () => {
        const { data } = await supabase
          .from('course_demands')
          .select('id, title, status, date_debut, coach_annonces(concours(nom))')
          .eq('cheval_id', chevalId);
        (data ?? []).forEach((r: any) => out.push({
          id: r.id, module: 'coach', icon: '🎓', title: r.title ?? 'Cours',
          status: r.status ?? null, date: r.date_debut ?? null, concoursNom: firstConcoursNom(r.coach_annonces),
        }));
      }),
      safe(async () => {
        const { data } = await supabase
          .from('stage_reservations')
          .select('id, title, status, stages(concours(nom))')
          .eq('cheval_id', chevalId);
        (data ?? []).forEach((r: any) => out.push({
          id: r.id, module: 'stage', icon: '🏕️', title: r.title ?? 'Stage',
          status: r.status ?? null, date: null, concoursNom: firstConcoursNom(r.stages),
        }));
      }),
    ]);

    // Tri : par date desc si dispo, sinon stable.
    out.sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''));
    setItems(out);
    setIsLoading(false);
  }, [chevalId]);

  useEffect(() => { load(); }, [load]);
  return { items, isLoading, reload: load };
}
