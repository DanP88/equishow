// ─────────────────────────────────────────────────────────────────────────────
// useCoachProfiles — Lecture/écriture de public.coach_profiles (P24 phase 4).
//
// Profil étendu d'un coach (bio, disciplines, tarif horaire, etc.).
// 1-1 avec public.users.id (un user a au max un profil coach).
//
// Hooks exposés :
// - useCoachProfiles()        — marketplace (tous les coachs avec profil)
// - useCoachProfile(userId)   — un profil par user_id (pour view-coach)
// - useMyCoachProfile()       — mon profil + upsert/delete
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useId, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './useAuth';
import { CoachProfil } from '../types/service';
import { isFeaturedCoach } from '../lib/planLimits';

interface CoachProfileRow {
  user_id: string;
  bio: string | null;
  disciplines: string[];
  niveaux: string[];
  specialites: string[];
  region: string | null;
  tarif_heure: number | null;
  disponible: boolean;
  photo_url: string | null;
  created_at: string;
  updated_at: string;
}

interface UserRow {
  id: string;
  prenom: string;
  nom: string;
  pseudo: string | null;
  avatar_color: string | null;
  plan: string | null;
  plan_id: string | null;
}

function rowToProfile(coach: CoachProfileRow, user?: UserRow | null): CoachProfil {
  const initiales = user
    ? `${(user.prenom?.[0] ?? '').toUpperCase()}${(user.nom?.[0] ?? '').toUpperCase()}`
    : '';
  return {
    id: coach.user_id,
    auteurId: coach.user_id,
    nom: user?.nom ?? '',
    prenom: user?.prenom ?? '',
    pseudo: user?.pseudo ?? '',
    initiales,
    couleur: user?.avatar_color ?? '#7C3AED',
    disciplines: coach.disciplines ?? [],
    niveaux: coach.niveaux ?? [],
    region: coach.region ?? '',
    tarifHeure: Number(coach.tarif_heure ?? 0),
    bio: coach.bio ?? '',
    nbAvis: 0,
    note: 0,
    disponible: coach.disponible,
    specialites: coach.specialites ?? [],
    featured: isFeaturedCoach(user?.plan_id ?? null, user?.plan ?? null),
  };
}

export interface CoachProfileInput {
  bio?: string;
  disciplines?: string[];
  niveaux?: string[];
  specialites?: string[];
  region?: string;
  tarifHeure?: number;
  disponible?: boolean;
  photoUrl?: string;
}

interface CoachResult {
  data: CoachProfil | null;
  error: string | null;
}

function patchToRow(p: CoachProfileInput): Partial<CoachProfileRow> {
  const out: Partial<CoachProfileRow> = {};
  if (p.bio !== undefined)         out.bio = p.bio;
  if (p.disciplines !== undefined) out.disciplines = p.disciplines;
  if (p.niveaux !== undefined)     out.niveaux = p.niveaux;
  if (p.specialites !== undefined) out.specialites = p.specialites;
  if (p.region !== undefined)      out.region = p.region;
  if (p.tarifHeure !== undefined)  out.tarif_heure = p.tarifHeure;
  if (p.disponible !== undefined)  out.disponible = p.disponible;
  if (p.photoUrl !== undefined)    out.photo_url = p.photoUrl;
  return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// useCoachProfiles — marketplace (tous les profils coach + leur user)
// ─────────────────────────────────────────────────────────────────────────────
export function useCoachProfiles() {
  const channelId = useId();
  const [list, setList] = useState<CoachProfil[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const load = useCallback(async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from('coach_profiles')
      .select('*, user:users!coach_profiles_user_id_fkey(id,prenom,nom,pseudo,avatar_color,plan,plan_id)');
    if (!error && data) {
      const rows = data as (CoachProfileRow & { user: UserRow | null })[];
      setList(rows.map((r) => rowToProfile(r, r.user)));
    }
    setIsLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const channel = supabase
      .channel(`coach-profiles-all-${channelId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'coach_profiles' }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [load, channelId]);

  return { coaches: list, isLoading, reload: load };
}

// ─────────────────────────────────────────────────────────────────────────────
// useCoachProfile — un profil par user_id
// ─────────────────────────────────────────────────────────────────────────────
export function useCoachProfile(userId?: string) {
  const channelId = useId();
  const [coach, setCoach] = useState<CoachProfil | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const load = useCallback(async () => {
    if (!userId) { setCoach(null); return; }
    setIsLoading(true);
    const { data, error } = await supabase
      .from('coach_profiles')
      .select('*, user:users!coach_profiles_user_id_fkey(id,prenom,nom,pseudo,avatar_color,plan,plan_id)')
      .eq('user_id', userId)
      .maybeSingle();
    if (!error && data) {
      const row = data as CoachProfileRow & { user: UserRow | null };
      setCoach(rowToProfile(row, row.user));
    } else {
      setCoach(null);
    }
    setIsLoading(false);
  }, [userId]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`coach-profile-${userId}-${channelId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'coach_profiles', filter: `user_id=eq.${userId}` }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [userId, load, channelId]);

  return { coach, isLoading, reload: load };
}

// ─────────────────────────────────────────────────────────────────────────────
// useMyCoachProfile — mon profil + upsert
// ─────────────────────────────────────────────────────────────────────────────
export function useMyCoachProfile() {
  const { profile } = useAuth();
  const { coach, isLoading, reload } = useCoachProfile(profile?.id);

  const upsert = useCallback(async (input: CoachProfileInput): Promise<CoachResult> => {
    if (!profile?.id) return { data: null, error: 'Non authentifié' };
    const patch = patchToRow(input);
    const { data, error } = await supabase
      .from('coach_profiles')
      .upsert({ user_id: profile.id, ...patch }, { onConflict: 'user_id' })
      .select('*')
      .single();
    if (error || !data) return { data: null, error: error?.message ?? 'Erreur sauvegarde' };
    // Re-fetch avec user join pour récupérer les infos cohérentes
    await reload();
    return { data: rowToProfile(data as CoachProfileRow, null), error: null };
  }, [profile?.id, reload]);

  const remove = useCallback(async (): Promise<{ error: string | null }> => {
    if (!profile?.id) return { error: 'Non authentifié' };
    const { error } = await supabase.from('coach_profiles').delete().eq('user_id', profile.id);
    if (!error) await reload();
    return { error: error?.message ?? null };
  }, [profile?.id, reload]);

  return { coach, isLoading, upsert, remove, reload };
}
