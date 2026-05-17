// ─────────────────────────────────────────────────────────────────────────────
// useCoachAnnonces — Lecture/écriture de public.coach_annonces (P24 phase 3).
//
// coach_annonces = annonces de coaching publiées par les coachs (concours ou
// régulier).
//
// Hooks exposés :
// - useCoachAnnonces()     — marketplace cavalier (toutes les annonces)
// - useCoachAnnonce(id)    — fiche détail (pour reserver-coach)
// - useMyCoachAnnonces()   — mes annonces (côté coach) + create/update/delete
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useId, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './useAuth';
import { CoachAnnonce } from '../types/service';

interface CoachAnnonceRow {
  id: string;
  auteur_id: string;
  auteur_nom: string | null;
  titre: string;
  description: string | null;
  type: 'concours' | 'regulier';
  discipline: string;
  niveau: string;
  places: number | null;
  places_disponibles: number | null;
  date_debut: string;
  date_fin: string;
  prix_heure_ht: number;
  prix_heure_ttc: number;
  concours_nom: string | null;
  region: string | null;
  created_at: string;
  updated_at: string;
}

function rowToAnnonce(r: CoachAnnonceRow): CoachAnnonce {
  return {
    id: r.id,
    auteurId: r.auteur_id,
    auteurNom: r.auteur_nom ?? '',
    auteurPseudo: '',
    auteurInitiales: '',
    auteurCouleur: '#7C3AED',
    titre: r.titre,
    description: r.description ?? '',
    type: r.type,
    discipline: r.discipline,
    niveau: r.niveau,
    dateDebut: new Date(r.date_debut),
    dateFin: new Date(r.date_fin),
    prixHeure: Number(r.prix_heure_ttc),
    places: r.places ?? 0,
    placesDisponibles: r.places_disponibles ?? 0,
    concours: r.concours_nom ?? undefined,
    region: r.region ?? undefined,
  };
}

interface AnnonceCreateInput {
  titre: string;
  description?: string;
  type: 'concours' | 'regulier';
  discipline: string;
  niveau: string;
  dateDebut: Date;
  dateFin: Date;
  prixHeureHT: number;
  places: number;
  concours?: string;
  region?: string;
}

interface AnnonceResult {
  data: CoachAnnonce | null;
  error: string | null;
}

// ── Pubsub local : propage mutations entre hooks siblings (sans realtime) ─
type CoachMutation =
  | { kind: 'delete'; id: string }
  | { kind: 'upsert'; annonce: CoachAnnonce };
const coachMutationListeners = new Set<(m: CoachMutation) => void>();
function emitCoachMutation(m: CoachMutation) {
  for (const l of coachMutationListeners) l(m);
}

// ─────────────────────────────────────────────────────────────────────────────
// useCoachAnnonces — marketplace (toutes les annonces)
// ─────────────────────────────────────────────────────────────────────────────
export function useCoachAnnonces() {
  const channelId = useId();
  const [list, setList] = useState<CoachAnnonce[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const load = useCallback(async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from('coach_annonces')
      .select('*')
      .order('date_debut', { ascending: true });
    if (!error && data) setList((data as CoachAnnonceRow[]).map(rowToAnnonce));
    setIsLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const channel = supabase
      .channel(`coach-annonces-all-${channelId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'coach_annonces' }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [load, channelId]);

  useEffect(() => {
    const handler = (m: CoachMutation) => {
      if (m.kind === 'delete') setList((curr) => curr.filter((a) => a.id !== m.id));
      else if (m.kind === 'upsert') setList((curr) => {
        const idx = curr.findIndex((a) => a.id === m.annonce.id);
        if (idx === -1) return [m.annonce, ...curr];
        const next = curr.slice();
        next[idx] = m.annonce;
        return next;
      });
    };
    coachMutationListeners.add(handler);
    return () => { coachMutationListeners.delete(handler); };
  }, []);

  return { annonces: list, isLoading, reload: load };
}

// ─────────────────────────────────────────────────────────────────────────────
// useCoachAnnonce — une annonce par id
// ─────────────────────────────────────────────────────────────────────────────
export function useCoachAnnonce(id?: string) {
  const channelId = useId();
  const [annonce, setAnnonce] = useState<CoachAnnonce | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const load = useCallback(async () => {
    if (!id) { setAnnonce(null); return; }
    setIsLoading(true);
    const { data, error } = await supabase
      .from('coach_annonces')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (!error) setAnnonce(data ? rowToAnnonce(data as CoachAnnonceRow) : null);
    setIsLoading(false);
  }, [id]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!id) return;
    const channel = supabase
      .channel(`coach-annonce-${id}-${channelId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'coach_annonces', filter: `id=eq.${id}` }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [id, load, channelId]);

  return { annonce, isLoading, reload: load };
}

// ─────────────────────────────────────────────────────────────────────────────
// useMyCoachAnnonces — mes annonces (côté coach) + CRUD
// ─────────────────────────────────────────────────────────────────────────────
export function useMyCoachAnnonces() {
  const { profile } = useAuth();
  const channelId = useId();
  const [list, setList] = useState<CoachAnnonce[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const load = useCallback(async () => {
    if (!profile?.id) { setList([]); return; }
    setIsLoading(true);
    const { data, error } = await supabase
      .from('coach_annonces')
      .select('*')
      .eq('auteur_id', profile.id)
      .order('date_debut', { ascending: false });
    if (!error && data) setList((data as CoachAnnonceRow[]).map(rowToAnnonce));
    setIsLoading(false);
  }, [profile?.id]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!profile?.id) return;
    const channel = supabase
      .channel(`my-coach-annonces-${profile.id}-${channelId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'coach_annonces', filter: `auteur_id=eq.${profile.id}` }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [profile?.id, load, channelId]);

  const createAnnonce = useCallback(async (input: AnnonceCreateInput): Promise<AnnonceResult> => {
    if (!profile?.id) return { data: null, error: 'Non authentifié' };
    const prixTTC = Math.round(input.prixHeureHT * 1.20 * 100) / 100;
    const { data, error } = await supabase
      .from('coach_annonces')
      .insert({
        auteur_id: profile.id,
        auteur_nom: `${(profile as any).prenom ?? ''} ${(profile as any).nom ?? ''}`.trim() || null,
        titre: input.titre,
        description: input.description ?? null,
        type: input.type,
        discipline: input.discipline,
        niveau: input.niveau,
        date_debut: input.dateDebut.toISOString().split('T')[0],
        date_fin: input.dateFin.toISOString().split('T')[0],
        prix_heure_ht: input.prixHeureHT,
        prix_heure_ttc: prixTTC,
        places: input.places,
        places_disponibles: input.places,
        concours_nom: input.concours ?? null,
        region: input.region ?? null,
      })
      .select('*')
      .single();
    if (error || !data) return { data: null, error: error?.message ?? 'Erreur création' };
    const created = rowToAnnonce(data as CoachAnnonceRow);
    setList((curr) => (curr.some((a) => a.id === created.id) ? curr : [created, ...curr]));
    emitCoachMutation({ kind: 'upsert', annonce: created });
    return { data: created, error: null };
  }, [profile?.id, (profile as any)?.prenom, (profile as any)?.nom]);

  const deleteAnnonce = useCallback(async (id: string): Promise<{ error: string | null }> => {
    let snapshot: CoachAnnonce[] = [];
    setList((curr) => { snapshot = curr; return curr.filter((a) => a.id !== id); });
    const { error } = await supabase.from('coach_annonces').delete().eq('id', id);
    if (error) { setList(snapshot); return { error: error.message }; }
    emitCoachMutation({ kind: 'delete', id });
    return { error: null };
  }, []);

  return { annonces: list, isLoading, createAnnonce, deleteAnnonce, reload: load };
}
