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

function rowToDemand(r: CourseDemandRow): CourseDemande {
  // price_per_day_ttc et total_amount_ttc sont stockés en centimes (× 100)
  // dans reserver-coach.tsx. On reconvertit en euros pour le front.
  const prixParJour = Number(r.price_per_day_ttc) / 100;
  const prix = Number(r.total_amount_ttc) / 100;
  return {
    id: r.id,
    annonceId: r.annonce_id,
    annonceTitre: r.title,
    concoursNom: r.concours_nom ?? undefined,
    coachId: r.coach_id,
    coachNom: '',
    cavalierNom: '',
    cavalierPseudo: '',
    cavalierInitiales: '',
    cavalierCouleur: '#0369A1',
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
    if (!error && data) setList((data as CourseDemandRow[]).map(rowToDemand));
    setIsLoading(false);
  }, [profile?.id]);

  useEffect(() => { load(); }, [load]);

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
