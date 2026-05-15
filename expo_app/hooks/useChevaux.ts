import { useEffect, useId, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './useAuth';
import {
  Cheval,
  TypeCheval,
  Temperament,
  ComportementTransport,
  HabitudesVie,
  Sociabilite,
  NiveauPratique,
  NiveauTravail,
  FrequenceTravail,
  SuiviSante,
  GestionCheval,
  ConcourInscrit,
} from '../types/cheval';

// ── DB row shape (snake_case) ───────────────────────────────────────────────
interface ChevalRow {
  id: string;
  proprietaire_id: string;
  nom: string;
  type: TypeCheval;
  race: string | null;
  robe: string | null;
  annee_naissance: number | null;
  photo_url: string | null;
  photo_color: string | null;
  sexe: string | null;
  taille: string | null;
  numero_sire: string | null;
  temperament: string[];
  comportement_transport: string | null;
  habitudes: string | null;
  sociabilite: string | null;
  particularites_physiques: string | null;
  disciplines: string[];
  niveau_pratique: string | null;
  niveau_travail: string | null;
  frequence_travail: string | null;
  objectifs: string | null;
  sante: SuiviSante;
  gestion: GestionCheval;
  concours: ConcourInscrit[];
  created_at: string;
  updated_at: string;
}

function rowToCheval(r: ChevalRow): Cheval {
  return {
    id: r.id,
    proprietaireId: r.proprietaire_id,
    nom: r.nom,
    type: r.type,
    race: r.race ?? undefined,
    robe: r.robe ?? undefined,
    anneeNaissance: r.annee_naissance ?? undefined,
    photoUrl: r.photo_url ?? undefined,
    photoColor: r.photo_color ?? undefined,
    sexe: r.sexe ?? undefined,
    taille: r.taille ?? undefined,
    numeroSire: r.numero_sire ?? undefined,
    temperament: (r.temperament ?? []) as Temperament[],
    comportementTransport: (r.comportement_transport ?? undefined) as ComportementTransport | undefined,
    habitudes: (r.habitudes ?? undefined) as HabitudesVie | undefined,
    sociabilite: (r.sociabilite ?? undefined) as Sociabilite | undefined,
    particularitesPhysiques: r.particularites_physiques ?? undefined,
    disciplines: r.disciplines ?? [],
    niveauPratique: (r.niveau_pratique ?? undefined) as NiveauPratique | undefined,
    niveauTravail: (r.niveau_travail ?? undefined) as NiveauTravail | undefined,
    frequenceTravail: (r.frequence_travail ?? undefined) as FrequenceTravail | undefined,
    objectifs: r.objectifs ?? undefined,
    sante: r.sante ?? {},
    gestion: r.gestion ?? {},
    concours: r.concours ?? [],
  };
}

function chevalToRowPatch(c: Partial<Cheval>): Partial<ChevalRow> {
  const patch: Partial<ChevalRow> = {};
  if (c.nom !== undefined)                     patch.nom = c.nom;
  if (c.type !== undefined)                    patch.type = c.type;
  if (c.race !== undefined)                    patch.race = c.race ?? null;
  if (c.robe !== undefined)                    patch.robe = c.robe ?? null;
  if (c.anneeNaissance !== undefined)          patch.annee_naissance = c.anneeNaissance ?? null;
  if (c.photoUrl !== undefined)                patch.photo_url = c.photoUrl ?? null;
  if (c.photoColor !== undefined)              patch.photo_color = c.photoColor ?? null;
  if (c.sexe !== undefined)                    patch.sexe = c.sexe ?? null;
  if (c.taille !== undefined)                  patch.taille = c.taille ?? null;
  if (c.numeroSire !== undefined)              patch.numero_sire = c.numeroSire ?? null;
  if (c.temperament !== undefined)             patch.temperament = c.temperament;
  if (c.comportementTransport !== undefined)   patch.comportement_transport = c.comportementTransport ?? null;
  if (c.habitudes !== undefined)               patch.habitudes = c.habitudes ?? null;
  if (c.sociabilite !== undefined)             patch.sociabilite = c.sociabilite ?? null;
  if (c.particularitesPhysiques !== undefined) patch.particularites_physiques = c.particularitesPhysiques ?? null;
  if (c.disciplines !== undefined)             patch.disciplines = c.disciplines;
  if (c.niveauPratique !== undefined)          patch.niveau_pratique = c.niveauPratique ?? null;
  if (c.niveauTravail !== undefined)           patch.niveau_travail = c.niveauTravail ?? null;
  if (c.frequenceTravail !== undefined)        patch.frequence_travail = c.frequenceTravail ?? null;
  if (c.objectifs !== undefined)               patch.objectifs = c.objectifs ?? null;
  if (c.sante !== undefined)                   patch.sante = c.sante ?? {};
  if (c.gestion !== undefined)                 patch.gestion = c.gestion ?? {};
  if (c.concours !== undefined)                patch.concours = c.concours ?? [];
  return patch;
}

interface ChevalResult {
  data: Cheval | null;
  error: string | null;
}

// ── Hook : tous les chevaux du user courant ────────────────────────────────
export function useMyChevaux() {
  const { profile } = useAuth();
  const channelId = useId();
  const [list, setList] = useState<Cheval[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!profile?.id) {
      setList([]);
      return;
    }
    setIsLoading(true);
    const { data, error: queryErr } = await supabase
      .from('chevaux')
      .select('*')
      .eq('proprietaire_id', profile.id)
      .order('created_at', { ascending: true });
    if (queryErr) {
      setError(queryErr.message);
      setList([]);
    } else {
      setError(null);
      setList(((data ?? []) as ChevalRow[]).map(rowToCheval));
    }
    setIsLoading(false);
  }, [profile?.id]);

  useEffect(() => {
    load();
  }, [load]);

  // Realtime sync sur les chevaux du user.
  useEffect(() => {
    if (!profile?.id) return;
    const channel = supabase
      .channel(`chevaux-${profile.id}-${channelId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'chevaux',
          filter: `proprietaire_id=eq.${profile.id}`,
        },
        () => load(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile?.id, load]);

  const createCheval = useCallback(
    async (initial?: Partial<Cheval>): Promise<ChevalResult> => {
      if (!profile?.id) return { data: null, error: 'Non authentifié' };
      const patch = chevalToRowPatch(initial ?? {});
      const { data, error: insertErr } = await supabase
        .from('chevaux')
        .insert({
          proprietaire_id: profile.id,
          nom: initial?.nom ?? 'Nouveau cheval',
          type: initial?.type ?? 'cheval',
          ...patch,
        })
        .select('*')
        .single();
      if (insertErr || !data) {
        return { data: null, error: insertErr?.message ?? 'Erreur création' };
      }
      // Optimistic : ajoute le cheval à la liste immédiatement (avant que le
      // realtime broadcast ne le fasse). Évite l'attente quand on revient sur
      // la page après création/validation. Dédup par id si broadcast arrive
      // en parallèle.
      const created = rowToCheval(data as ChevalRow);
      setList((curr) => (curr.some((c) => c.id === created.id) ? curr : [...curr, created]));
      return { data: created, error: null };
    },
    [profile?.id],
  );

  const updateCheval = useCallback(
    async (id: string, updates: Partial<Cheval>): Promise<ChevalResult> => {
      const patch = chevalToRowPatch(updates);
      const { data, error: updateErr } = await supabase
        .from('chevaux')
        .update(patch)
        .eq('id', id)
        .select('*')
        .single();
      if (updateErr || !data) {
        return { data: null, error: updateErr?.message ?? 'Erreur mise à jour' };
      }
      return { data: rowToCheval(data as ChevalRow), error: null };
    },
    [],
  );

  const deleteCheval = useCallback(async (id: string): Promise<{ error: string | null }> => {
    // Optimistic : on retire de la liste immédiatement pour une UX fluide.
    // Le realtime channel synchronisera de toute façon, mais on n'attend pas.
    let snapshot: Cheval[] = [];
    setList((curr) => {
      snapshot = curr;
      return curr.filter((c) => c.id !== id);
    });
    const { error: deleteErr } = await supabase.from('chevaux').delete().eq('id', id);
    if (deleteErr) {
      // Restore en cas d'échec (RLS, FK, etc.).
      setList(snapshot);
      return { error: deleteErr.message };
    }
    return { error: null };
  }, []);

  return {
    chevaux: list,
    isLoading,
    error,
    createCheval,
    updateCheval,
    deleteCheval,
    reload: load,
  };
}

// ── Hook : un cheval par id (pour l'écran détail) ──────────────────────────
export function useCheval(id?: string) {
  const channelId = useId();
  const [cheval, setCheval] = useState<Cheval | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) {
      setCheval(null);
      return;
    }
    setIsLoading(true);
    const { data, error: queryErr } = await supabase
      .from('chevaux')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (queryErr) {
      setError(queryErr.message);
      setCheval(null);
    } else {
      setError(null);
      setCheval(data ? rowToCheval(data as ChevalRow) : null);
    }
    setIsLoading(false);
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!id) return;
    const channel = supabase
      .channel(`cheval-${id}-${channelId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'chevaux',
          filter: `id=eq.${id}`,
        },
        () => load(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [id, load]);

  const update = useCallback(
    async (updates: Partial<Cheval>): Promise<ChevalResult> => {
      if (!id) return { data: null, error: 'id manquant' };
      const patch = chevalToRowPatch(updates);
      const { data, error: updateErr } = await supabase
        .from('chevaux')
        .update(patch)
        .eq('id', id)
        .select('*')
        .single();
      if (updateErr || !data) {
        return { data: null, error: updateErr?.message ?? 'Erreur mise à jour' };
      }
      return { data: rowToCheval(data as ChevalRow), error: null };
    },
    [id],
  );

  const remove = useCallback(async (): Promise<{ error: string | null }> => {
    if (!id) return { error: 'id manquant' };
    const { error: deleteErr } = await supabase.from('chevaux').delete().eq('id', id);
    return { error: deleteErr?.message ?? null };
  }, [id]);

  return {
    cheval,
    isLoading,
    error,
    update,
    remove,
    reload: load,
  };
}

// ── Hook : count mes chevaux (lightweight) ─────────────────────────────────
export function useMyChevauxCount() {
  const { profile } = useAuth();
  const channelId = useId();
  const [count, setCount] = useState(0);

  const load = useCallback(async () => {
    if (!profile?.id) {
      setCount(0);
      return;
    }
    const { count: c, error } = await supabase
      .from('chevaux')
      .select('id', { count: 'exact', head: true })
      .eq('proprietaire_id', profile.id);
    if (error) {
      setCount(0);
    } else {
      setCount(c ?? 0);
    }
  }, [profile?.id]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!profile?.id) return;
    const channel = supabase
      .channel(`chevaux-count-${profile.id}-${channelId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'chevaux',
          filter: `proprietaire_id=eq.${profile.id}`,
        },
        () => load(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile?.id, load]);

  return count;
}
