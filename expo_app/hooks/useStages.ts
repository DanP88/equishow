// ─────────────────────────────────────────────────────────────────────────────
// useStages — Lecture/écriture de la table public.stages (P24).
//
// Tables :
// - `stages` (auteur_id FK users) — annonces de stage publiées par les coachs
// - `stage_reservations` (stage_id FK stages, coach_id, cavalier_id FK users)
//
// Hooks exposés :
// - useStages()              — tous les stages dispo (marketplace cavalier)
// - useStage(id)             — un stage par id
// - useMyStages()            — mes stages publiés (côté coach)
// - useMyStageReservations() — mes réservations (cavalier OU coach)
//
// Realtime via channels uniques (useId) pour éviter collision multi-instance.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useId, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './useAuth';
import { CoachStage, StageReservation } from '../types/service';

// ── DB row shapes ───────────────────────────────────────────────────────────

interface StageRow {
  id: string;
  auteur_id: string;
  auteur_nom: string | null;
  titre: string;
  description: string | null;
  disciplines: string[];
  niveaux: string[];
  date_debut: string;
  date_fin: string;
  nb_jours: number | null;
  prix_ttc: number;
  places: number | null;
  places_disponibles: number | null;
  concours: string | null;
  region: string | null;
  created_at: string;
  updated_at: string;
}

interface StageReservationRow {
  id: string;
  stage_id: string;
  coach_id: string;
  cavalier_id: string;
  title: string;
  stage_titre: string | null;
  cavalier_nom: string | null;
  cavalier_pseudo: string | null;
  cavalier_initiales: string | null;
  cavalier_couleur: string | null;
  nb_participants: number;
  message: string | null;
  price_total_ht: number;
  platform_commission: number;
  price_total_ttc: number;
  status: 'pending' | 'accepted' | 'rejected' | 'awaiting_payment' | 'paid';
  date_reservation: string | null;
  created_at: string;
  updated_at: string;
}

function rowToStage(r: StageRow): CoachStage {
  return {
    id: r.id,
    auteurId: r.auteur_id,
    auteurNom: r.auteur_nom ?? '',
    // Champs non stockés côté DB pour l'instant — laissés vides, l'UI gère.
    auteurPseudo: '',
    auteurInitiales: '',
    auteurCouleur: '#7C3AED',
    titre: r.titre,
    description: r.description ?? '',
    disciplines: r.disciplines ?? [],
    niveaux: r.niveaux ?? [],
    dateDebut: new Date(r.date_debut),
    dateFin: new Date(r.date_fin),
    nbJours: r.nb_jours ?? 1,
    prixTTC: Number(r.prix_ttc),
    places: r.places ?? 0,
    placesDisponibles: r.places_disponibles ?? 0,
    concours: r.concours ?? undefined,
    region: r.region ?? undefined,
  };
}

function rowToReservation(r: StageReservationRow): StageReservation {
  return {
    id: r.id,
    stageId: r.stage_id,
    stageTitre: r.stage_titre ?? r.title ?? '',
    coachId: r.coach_id,
    coachNom: '',
    cavalierNom: r.cavalier_nom ?? '',
    cavalierPseudo: r.cavalier_pseudo ?? '',
    cavalierInitiales: r.cavalier_initiales ?? '',
    cavalierCouleur: r.cavalier_couleur ?? '#0369A1',
    cavalierUserId: r.cavalier_id,
    nombreParticipants: r.nb_participants,
    prixTotal: Number(r.price_total_ttc),
    message: r.message ?? '',
    statut: r.status,
    dateReservation: r.date_reservation ? new Date(r.date_reservation) : new Date(r.created_at),
  };
}

// ── Patch (partial → DB row) ────────────────────────────────────────────────

interface StageCreateInput {
  titre: string;
  description?: string;
  disciplines: string[];
  niveaux: string[];
  dateDebut: Date;
  dateFin: Date;
  nbJours?: number;
  prixTTC: number;
  places: number;
  concours?: string;
  region?: string;
}

interface StageResult {
  data: CoachStage | null;
  error: string | null;
}

// ── Pubsub local : propage mutations entre hooks siblings (sans realtime) ─
type StageMutation =
  | { kind: 'delete'; id: string }
  | { kind: 'upsert'; stage: CoachStage };
const stageMutationListeners = new Set<(m: StageMutation) => void>();
function emitStageMutation(m: StageMutation) {
  for (const l of stageMutationListeners) l(m);
}

// ─────────────────────────────────────────────────────────────────────────────
// useStages — tous les stages dispo (marketplace cavalier)
// ─────────────────────────────────────────────────────────────────────────────
export function useStages() {
  const channelId = useId();
  const [list, setList] = useState<CoachStage[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const load = useCallback(async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from('stages')
      .select('*')
      .order('date_debut', { ascending: true });
    if (!error && data) setList((data as StageRow[]).map(rowToStage));
    setIsLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const channel = supabase
      .channel(`stages-all-${channelId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'stages' }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [load, channelId]);

  useEffect(() => {
    const handler = (m: StageMutation) => {
      if (m.kind === 'delete') setList((curr) => curr.filter((s) => s.id !== m.id));
      else if (m.kind === 'upsert') setList((curr) => {
        const idx = curr.findIndex((s) => s.id === m.stage.id);
        if (idx === -1) return [m.stage, ...curr];
        const next = curr.slice();
        next[idx] = m.stage;
        return next;
      });
    };
    stageMutationListeners.add(handler);
    return () => { stageMutationListeners.delete(handler); };
  }, []);

  return { stages: list, isLoading, reload: load };
}

// ─────────────────────────────────────────────────────────────────────────────
// useStage — un stage par id (pour reserver-stage)
// ─────────────────────────────────────────────────────────────────────────────
export function useStage(id?: string) {
  const channelId = useId();
  const [stage, setStage] = useState<CoachStage | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const load = useCallback(async () => {
    if (!id) { setStage(null); return; }
    setIsLoading(true);
    const { data, error } = await supabase
      .from('stages')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (!error) setStage(data ? rowToStage(data as StageRow) : null);
    setIsLoading(false);
  }, [id]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!id) return;
    const channel = supabase
      .channel(`stage-${id}-${channelId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'stages', filter: `id=eq.${id}` }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [id, load, channelId]);

  return { stage, isLoading, reload: load };
}

// ─────────────────────────────────────────────────────────────────────────────
// useMyStages — stages publiés par le coach courant + CRUD
// ─────────────────────────────────────────────────────────────────────────────
export function useMyStages() {
  const { profile } = useAuth();
  const channelId = useId();
  const [list, setList] = useState<CoachStage[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const load = useCallback(async () => {
    if (!profile?.id) { setList([]); return; }
    setIsLoading(true);
    const { data, error } = await supabase
      .from('stages')
      .select('*')
      .eq('auteur_id', profile.id)
      .order('date_debut', { ascending: false });
    if (!error && data) setList((data as StageRow[]).map(rowToStage));
    setIsLoading(false);
  }, [profile?.id]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!profile?.id) return;
    const channel = supabase
      .channel(`my-stages-${profile.id}-${channelId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'stages', filter: `auteur_id=eq.${profile.id}` }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [profile?.id, load, channelId]);

  const createStage = useCallback(async (input: StageCreateInput): Promise<StageResult> => {
    if (!profile?.id) return { data: null, error: 'Non authentifié' };
    const { data, error } = await supabase
      .from('stages')
      .insert({
        auteur_id: profile.id,
        auteur_nom: `${(profile as any).prenom ?? ''} ${(profile as any).nom ?? ''}`.trim() || null,
        titre: input.titre,
        description: input.description ?? null,
        disciplines: input.disciplines,
        niveaux: input.niveaux,
        date_debut: input.dateDebut.toISOString(),
        date_fin: input.dateFin.toISOString(),
        nb_jours: input.nbJours ?? null,
        prix_ttc: input.prixTTC,
        places: input.places,
        places_disponibles: input.places,
        concours: input.concours ?? null,
        region: input.region ?? null,
      })
      .select('*')
      .single();
    if (error || !data) return { data: null, error: error?.message ?? 'Erreur création' };
    const created = rowToStage(data as StageRow);
    setList((curr) => (curr.some((s) => s.id === created.id) ? curr : [created, ...curr]));
    emitStageMutation({ kind: 'upsert', stage: created });
    return { data: created, error: null };
  }, [profile?.id, (profile as any)?.prenom, (profile as any)?.nom]);

  const deleteStage = useCallback(async (id: string): Promise<{ error: string | null }> => {
    let snapshot: CoachStage[] = [];
    setList((curr) => { snapshot = curr; return curr.filter((s) => s.id !== id); });
    const { error } = await supabase.from('stages').delete().eq('id', id);
    if (error) { setList(snapshot); return { error: error.message }; }
    emitStageMutation({ kind: 'delete', id });
    return { error: null };
  }, []);

  return { stages: list, isLoading, createStage, deleteStage, reload: load };
}

// ─────────────────────────────────────────────────────────────────────────────
// useMyStageReservations — mes réservations (depuis cavalier OU coach)
// ─────────────────────────────────────────────────────────────────────────────
export function useMyStageReservations() {
  const { profile } = useAuth();
  const channelId = useId();
  const [list, setList] = useState<StageReservation[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const load = useCallback(async () => {
    if (!profile?.id) { setList([]); return; }
    setIsLoading(true);
    const { data, error } = await supabase
      .from('stage_reservations')
      .select('*')
      .or(`cavalier_id.eq.${profile.id},coach_id.eq.${profile.id}`)
      .order('created_at', { ascending: false });
    if (!error && data) setList((data as StageReservationRow[]).map(rowToReservation));
    setIsLoading(false);
  }, [profile?.id]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!profile?.id) return;
    const channel = supabase
      .channel(`stage-reservations-${profile.id}-${channelId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'stage_reservations' }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [profile?.id, load, channelId]);

  // create est gardé dans reserver-stage.tsx (insert direct car flow Stripe).
  // Mais updateStatus pour accept/reject côté coach est utile ici.
  const updateStatus = useCallback(
    async (id: string, status: StageReservationRow['status']): Promise<{ error: string | null }> => {
      const { error } = await supabase
        .from('stage_reservations')
        .update({ status })
        .eq('id', id);
      return { error: error?.message ?? null };
    },
    [],
  );

  return { reservations: list, isLoading, updateStatus, reload: load };
}
