// ─────────────────────────────────────────────────────────────────────────────
// useCourseDemands — Lecture/écriture de public.course_demands (P24 phase 2).
//
// course_demands = demande d'un cavalier pour des cours auprès d'un coach
// (rattachée à une annonce coach_annonces).
//
// Hooks exposés :
// - useMyCourseDemands() — mes demandes (cavalier OU coach) + updateStatus
//
// L'INSERT initial reste fait dans reserver-coach.tsx (flow Stripe wired).
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useId, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAutoRefresh } from './useAutoRefresh';
import { useAuth } from './useAuth';
import { CourseDemande } from '../types/service';

interface CourseDemandRow {
  id: string;
  annonce_id: string;
  coach_id: string;
  cavalier_id: string;
  title: string;
  discipline: string | null;
  level: string | null;
  horse_name: string | null;
  message: string | null;
  date_debut: string;
  date_fin: string;
  nb_jours: number | null;
  price_per_day_ttc: number;
  total_amount_ht: number;
  platform_commission: number;
  total_amount_ttc: number;
  status: 'pending' | 'accepted' | 'rejected' | 'awaiting_payment' | 'paid';
  concours_nom: string | null;
  created_at: string;
  updated_at: string;
}

// Identité d'affichage récupérée via la vue public.users_public (mig 007) :
// la RLS de `users` est self-only, donc on ne peut pas joindre directement.
interface PublicUser {
  prenom: string | null;
  nom: string | null;
  pseudo: string | null;
  initiales: string | null;
  avatar_color: string | null;
}

function fullName(u?: PublicUser): string {
  if (!u) return '';
  return `${u.prenom ?? ''} ${u.nom ?? ''}`.trim();
}

function rowToDemand(
  r: CourseDemandRow,
  users: Map<string, PublicUser>,
  annonceRegion: Map<string, string | null>,
): CourseDemande {
  // Montants en EUROS (le trigger serveur mig 036 stocke des euros décimaux).
  // Surtout PAS de /100 — sinon 218€ s'afficherait 2,18€.
  const prixParJour = Number(r.price_per_day_ttc);
  const prix = Number(r.total_amount_ttc);
  const cavalier = users.get(r.cavalier_id);
  const coach = users.get(r.coach_id);
  return {
    id: r.id,
    annonceId: r.annonce_id,
    annonceTitre: r.title,
    concoursNom: r.concours_nom ?? undefined,
    lieu: annonceRegion.get(r.annonce_id) ?? undefined,
    coachId: r.coach_id,
    coachNom: fullName(coach),
    cavalierNom: fullName(cavalier),
    cavalierPseudo: cavalier?.pseudo ?? '',
    cavalierInitiales: cavalier?.initiales ?? '',
    cavalierCouleur: cavalier?.avatar_color ?? '#0369A1',
    cavalierUserId: r.cavalier_id,
    discipline: r.discipline ?? '',
    niveau: r.level ?? '',
    dateDebut: new Date(r.date_debut),
    dateFin: new Date(r.date_fin),
    nbJours: r.nb_jours ?? 1,
    cheval: r.horse_name ?? '',
    message: r.message ?? '',
    prixParJour,
    prix,
    statut: r.status,
    dateCreation: new Date(r.created_at),
  };
}

export function useMyCourseDemands() {
  const { profile } = useAuth();
  const channelId = useId();
  const [list, setList] = useState<CourseDemande[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const load = useCallback(async () => {
    if (!profile?.id) { setList([]); return; }
    setIsLoading(true);
    const { data, error } = await supabase
      .from('course_demands')
      .select('*')
      .or(`cavalier_id.eq.${profile.id},coach_id.eq.${profile.id}`)
      .order('created_at', { ascending: false });
    if (error || !data) { setIsLoading(false); return; }
    const rows = data as CourseDemandRow[];

    // Lookups identité (users_public, RLS self-only sur users) + lieu (région
    // de l'annonce). En parallèle, dédupliqués.
    const userIds = [...new Set(rows.flatMap((r) => [r.cavalier_id, r.coach_id]))];
    const annonceIds = [...new Set(rows.map((r) => r.annonce_id))];
    const [usersRes, annoncesRes] = await Promise.all([
      userIds.length
        ? supabase.from('users_public').select('id,prenom,nom,pseudo,initiales,avatar_color').in('id', userIds)
        : Promise.resolve({ data: [] as any[] }),
      annonceIds.length
        ? supabase.from('coach_annonces').select('id,region').in('id', annonceIds)
        : Promise.resolve({ data: [] as any[] }),
    ]);

    const users = new Map<string, PublicUser>();
    (usersRes.data ?? []).forEach((u: any) => users.set(u.id, u));
    const annonceRegion = new Map<string, string | null>();
    (annoncesRes.data ?? []).forEach((a: any) => annonceRegion.set(a.id, a.region ?? null));

    setList(rows.map((r) => rowToDemand(r, users, annonceRegion)));
    setIsLoading(false);
  }, [profile?.id]);

  useAutoRefresh(load);

  useEffect(() => {
    if (!profile?.id) return;
    const channel = supabase
      .channel(`course-demands-${profile.id}-${channelId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'course_demands' }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [profile?.id, load, channelId]);

  const updateStatus = useCallback(
    async (id: string, status: CourseDemandRow['status']): Promise<{ error: string | null }> => {
      const { error } = await supabase.from('course_demands').update({ status }).eq('id', id);
      return { error: error?.message ?? null };
    },
    [],
  );

  return { demands: list, isLoading, updateStatus, reload: load };
}
