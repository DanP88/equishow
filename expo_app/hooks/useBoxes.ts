import { useCallback, useEffect, useId, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './useAuth';
import { BoxAnnonce, BoxReservation } from '../types/service';

// ── DB row shape : box_annonces ─────────────────────────────────────────────
interface BoxAnnonceRow {
  id: string;
  auteur_id: string;
  auteur_nom: string | null;
  auteur_pseudo: string | null;
  auteur_initiales: string | null;
  auteur_couleur: string | null;
  titre: string | null;
  adresse: string | null;
  code_postal: string | null;
  lieu: string;
  prix_nuit_ht: number;
  date_debut: string;
  date_fin: string;
  nb_boxes: number | null;
  nb_boxes_disponibles: number | null;
  concours: string | null;
  description: string | null;
  created_at: string;
  updated_at: string;
}

function rowToAnnonce(r: BoxAnnonceRow): BoxAnnonce {
  return {
    id: r.id,
    auteurId: r.auteur_id,
    auteurNom: r.auteur_nom ?? '',
    auteurPseudo: r.auteur_pseudo ?? '',
    auteurInitiales: r.auteur_initiales ?? '',
    auteurCouleur: r.auteur_couleur ?? '',
    lieu: r.lieu,
    dateDebut: new Date(r.date_debut),
    dateFin: new Date(r.date_fin),
    nbBoxes: r.nb_boxes ?? 0,
    nbBoxesDisponibles: r.nb_boxes_disponibles ?? 0,
    prixNuitHT: r.prix_nuit_ht,
    concours: r.concours ?? undefined,
    description: r.description ?? undefined,
  };
}

function annonceToRowPatch(a: Partial<BoxAnnonce>): Partial<BoxAnnonceRow> {
  const p: Partial<BoxAnnonceRow> = {};
  if (a.lieu !== undefined)               p.lieu = a.lieu;
  if (a.dateDebut !== undefined)          p.date_debut = a.dateDebut.toISOString().slice(0, 10);
  if (a.dateFin !== undefined)            p.date_fin = a.dateFin.toISOString().slice(0, 10);
  if (a.nbBoxes !== undefined)            p.nb_boxes = a.nbBoxes;
  if (a.nbBoxesDisponibles !== undefined) p.nb_boxes_disponibles = a.nbBoxesDisponibles;
  if (a.prixNuitHT !== undefined)         p.prix_nuit_ht = a.prixNuitHT;
  if (a.concours !== undefined)           p.concours = a.concours ?? null;
  if (a.description !== undefined)        p.description = a.description ?? null;
  return p;
}

interface AnnonceResult {
  data: BoxAnnonce | null;
  error: string | null;
}

// ── Hook : toutes les annonces box (marketplace) ───────────────────────────
export function useBoxAnnonces() {
  const channelId = useId();
  const [list, setList] = useState<BoxAnnonce[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    const { data, error: qErr } = await supabase
      .from('box_annonces')
      .select('*')
      .order('date_debut', { ascending: false });
    if (qErr) {
      setError(qErr.message);
      setList([]);
    } else {
      setError(null);
      setList(((data ?? []) as BoxAnnonceRow[]).map(rowToAnnonce));
    }
    setIsLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const channel = supabase
      .channel(`box-annonces-all-${channelId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'box_annonces' }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [load]);

  return { boxes: list, isLoading, error, reload: load };
}

// ── Hook : annonces box du user + CRUD ─────────────────────────────────────
export function useMyBoxAnnonces() {
  const { profile } = useAuth();
  const channelId = useId();
  const [list, setList] = useState<BoxAnnonce[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!profile?.id) { setList([]); return; }
    setIsLoading(true);
    const { data, error: qErr } = await supabase
      .from('box_annonces')
      .select('*')
      .eq('auteur_id', profile.id)
      .order('created_at', { ascending: false });
    if (qErr) {
      setError(qErr.message);
      setList([]);
    } else {
      setError(null);
      setList(((data ?? []) as BoxAnnonceRow[]).map(rowToAnnonce));
    }
    setIsLoading(false);
  }, [profile?.id]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!profile?.id) return;
    const channel = supabase
      .channel(`box-annonces-${profile.id}-${channelId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'box_annonces', filter: `auteur_id=eq.${profile.id}` },
        () => load(),
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [profile?.id, load]);

  const createAnnonce = useCallback(
    async (input: Partial<BoxAnnonce>): Promise<AnnonceResult> => {
      if (!profile?.id) return { data: null, error: 'Non authentifié' };
      const patch = annonceToRowPatch(input);
      const { data, error: insErr } = await supabase
        .from('box_annonces')
        .insert({
          auteur_id: profile.id,
          lieu: input.lieu ?? '',
          prix_nuit_ht: input.prixNuitHT ?? 0,
          date_debut: input.dateDebut?.toISOString().slice(0, 10) ?? new Date().toISOString().slice(0, 10),
          date_fin: input.dateFin?.toISOString().slice(0, 10) ?? new Date().toISOString().slice(0, 10),
          ...patch,
        })
        .select('*')
        .single();
      if (insErr || !data) return { data: null, error: insErr?.message ?? 'Erreur création' };
      return { data: rowToAnnonce(data as BoxAnnonceRow), error: null };
    },
    [profile?.id],
  );

  const updateAnnonce = useCallback(
    async (id: string, updates: Partial<BoxAnnonce>): Promise<AnnonceResult> => {
      const patch = annonceToRowPatch(updates);
      const { data, error: upErr } = await supabase
        .from('box_annonces')
        .update(patch)
        .eq('id', id)
        .select('*')
        .single();
      if (upErr || !data) return { data: null, error: upErr?.message ?? 'Erreur mise à jour' };
      return { data: rowToAnnonce(data as BoxAnnonceRow), error: null };
    },
    [],
  );

  const deleteAnnonce = useCallback(async (id: string): Promise<{ error: string | null }> => {
    const { error: dErr } = await supabase.from('box_annonces').delete().eq('id', id);
    return { error: dErr?.message ?? null };
  }, []);

  return {
    annonces: list,
    isLoading,
    error,
    createAnnonce,
    updateAnnonce,
    deleteAnnonce,
    reload: load,
  };
}

// ── DB row : box_reservations (cols en anglais, attention au mapping) ──────
interface BoxReservationRow {
  id: string;
  box_id: string;
  seller_id: string;
  buyer_id: string;
  title: string;
  lieu: string | null;
  nb_nuits: number;
  date_debut: string;
  date_fin: string;
  message: string | null;
  price_total_ht: number;
  platform_commission: number;
  price_total_ttc: number;
  status: string;
  created_at: string;
  updated_at: string;
}

function rowToReservation(r: BoxReservationRow): BoxReservation {
  return {
    id: r.id,
    boxId: r.box_id,
    sellerId: r.seller_id,
    buyerId: r.buyer_id,
    titre: r.title,
    lieu: r.lieu ?? '',
    nbNuits: r.nb_nuits,
    dateDebut: new Date(r.date_debut),
    dateFin: new Date(r.date_fin),
    message: r.message ?? '',
    prixTotalHT: r.price_total_ht,
    commissionPlateform: r.platform_commission,
    prixTotalTTC: r.price_total_ttc,
    statut: r.status as BoxReservation['statut'],
    dateCreation: new Date(r.created_at),
  };
}

export interface CreateBoxReservationInput {
  boxId: string;
  sellerId: string;
  titre: string;
  lieu: string;
  nbNuits: number;
  dateDebut: Date;
  dateFin: Date;
  message: string;
  prixTotalHT: number;
  commissionPlateform: number;
  prixTotalTTC: number;
}

// ── Hook : réservations box pour le user courant (buyer + seller) ──────────
export function useMyBoxReservations() {
  const { profile } = useAuth();
  const channelId = useId();
  const [list, setList] = useState<BoxReservation[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!profile?.id) { setList([]); return; }
    setIsLoading(true);
    const { data, error: qErr } = await supabase
      .from('box_reservations')
      .select('*')
      .or(`buyer_id.eq.${profile.id},seller_id.eq.${profile.id}`)
      .order('created_at', { ascending: false });
    if (qErr) {
      setError(qErr.message);
      setList([]);
    } else {
      setError(null);
      setList(((data ?? []) as BoxReservationRow[]).map(rowToReservation));
    }
    setIsLoading(false);
  }, [profile?.id]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!profile?.id) return;
    // Filter OR pas supporté : on s'abonne à toute la table (RLS borne déjà).
    const channel = supabase
      .channel(`box-reservations-${profile.id}-${channelId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'box_reservations' }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [profile?.id, load]);

  const createReservation = useCallback(
    async (input: CreateBoxReservationInput): Promise<{ data: BoxReservation | null; error: string | null }> => {
      if (!profile?.id) return { data: null, error: 'Non authentifié' };
      const { data, error: insErr } = await supabase
        .from('box_reservations')
        .insert({
          box_id: input.boxId,
          buyer_id: profile.id,
          seller_id: input.sellerId,
          title: input.titre,
          lieu: input.lieu,
          nb_nuits: input.nbNuits,
          date_debut: input.dateDebut.toISOString().slice(0, 10),
          date_fin: input.dateFin.toISOString().slice(0, 10),
          message: input.message,
          price_total_ht: input.prixTotalHT,
          platform_commission: input.commissionPlateform,
          price_total_ttc: input.prixTotalTTC,
          status: 'pending',
        })
        .select('*')
        .single();
      if (insErr || !data) return { data: null, error: insErr?.message ?? 'Erreur création' };
      return { data: rowToReservation(data as BoxReservationRow), error: null };
    },
    [profile?.id],
  );

  const updateStatut = useCallback(
    async (id: string, statut: BoxReservation['statut']): Promise<{ error: string | null }> => {
      const { error: upErr } = await supabase
        .from('box_reservations')
        .update({ status: statut })
        .eq('id', id);
      return { error: upErr?.message ?? null };
    },
    [],
  );

  return {
    reservations: list,
    isLoading,
    error,
    createReservation,
    updateStatut,
    reload: load,
  };
}
