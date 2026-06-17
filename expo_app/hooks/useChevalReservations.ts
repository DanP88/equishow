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
  concoursId: string | null;
  concoursNom: string | null;
  concoursDateFin: string | null; // YYYY-MM-DD — pour marquer « Concours passé »
  concoursPast: boolean;
}

const today = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };

const firstConcours = (annonce: any): { id: string | null; nom: string | null; dateFin: string | null; past: boolean } => {
  const a = Array.isArray(annonce) ? annonce[0] : annonce;
  const c = a?.concours;
  const cc = Array.isArray(c) ? c[0] : c;
  const dateFin: string | null = cc?.date_fin ?? cc?.date_debut ?? null;
  const past = dateFin ? new Date(`${dateFin}T00:00:00`) < today() : false;
  return { id: cc?.id ?? null, nom: cc?.nom ?? null, dateFin, past };
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
          .select('id, title, status, date_debut, box_annonces(concours(id, nom, date_debut, date_fin))')
          .eq('cheval_id', chevalId);
        (data ?? []).forEach((r: any) => { const c = firstConcours(r.box_annonces); out.push({
          id: r.id, module: 'box', icon: '📦', title: r.title ?? 'Box',
          status: r.status ?? null, date: r.date_debut ?? null, concoursId: c.id, concoursNom: c.nom, concoursDateFin: c.dateFin, concoursPast: c.past,
        }); });
      }),
      safe(async () => {
        const { data } = await supabase
          .from('transport_reservations')
          .select('id, titre, statut, transport_annonces(type_transport, concours(id, nom, date_debut, date_fin))')
          .eq('cheval_id', chevalId);
        (data ?? []).forEach((r: any) => {
          const a = Array.isArray(r.transport_annonces) ? r.transport_annonces[0] : r.transport_annonces;
          const isTrajet = a?.type_transport === 'trajet';
          const c = firstConcours(r.transport_annonces);
          out.push({
            id: r.id, module: 'transport',
            icon: isTrajet ? '🚐' : '🚚',
            title: isTrajet ? 'Trajet' : 'Van seul',
            status: r.statut ?? null, date: null, concoursId: c.id, concoursNom: c.nom, concoursDateFin: c.dateFin, concoursPast: c.past,
          });
        });
      }),
      safe(async () => {
        const { data } = await supabase
          .from('course_demands')
          .select('id, title, status, date_debut, coach_annonces(concours(id, nom, date_debut, date_fin))')
          .eq('cheval_id', chevalId);
        (data ?? []).forEach((r: any) => { const c = firstConcours(r.coach_annonces); out.push({
          id: r.id, module: 'coach', icon: '🎓', title: r.title ?? 'Cours',
          status: r.status ?? null, date: r.date_debut ?? null, concoursId: c.id, concoursNom: c.nom, concoursDateFin: c.dateFin, concoursPast: c.past,
        }); });
      }),
      safe(async () => {
        const { data } = await supabase
          .from('stage_reservations')
          .select('id, title, status, stages(concours(id, nom, date_debut, date_fin))')
          .eq('cheval_id', chevalId);
        (data ?? []).forEach((r: any) => { const c = firstConcours(r.stages); out.push({
          id: r.id, module: 'stage', icon: '🏕️', title: r.title ?? 'Stage',
          status: r.status ?? null, date: null, concoursId: c.id, concoursNom: c.nom, concoursDateFin: c.dateFin, concoursPast: c.past,
        }); });
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
