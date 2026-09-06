// ─────────────────────────────────────────────────────────────────────────────
// v2/adapters/agenda — useV2Agenda()
//
// F3 : agrège l'agenda RÉEL de la personne (lecture seule) à partir des hooks V1
// déjà unifiés par user id — AUCUNE écriture, AUCUN backend nouveau :
//   • transport réservé (acheteur)          → capacité 'cavalier'
//   • box réservé (acheteur)                 → 'cavalier'
//   • coaching réservé (cavalier)            → 'cavalier'
//   • coaching à animer (coach, accepté)     → 'coach'
//   • stage réservé (cavalier)               → 'cavalier'
//   • concours suivi / "J'y serai" (local)   → 'concours'
//
// Si RIEN de réel (prototype non connecté / compte vide) → repli sur MOCK_AGENDA,
// clairement signalé (`demo: true`).
// ─────────────────────────────────────────────────────────────────────────────
import { useMemo } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useMyTransportReservations } from '../../hooks/useTransports';
import { useMyBoxReservations } from '../../hooks/useBoxes';
import { useMyCourseDemands } from '../../hooks/useCourseDemands';
import { useMyStageReservations } from '../../hooks/useStages';
import { useConcoursList } from '../../hooks/useConcours';
import { useConcoursLocal } from '../state/concoursLocal';
import { dayKey, dayLabel, timeLabel } from '../lib/dates';
import { MOCK_AGENDA } from '../mocks/f2';
import type { Capability } from '../capabilities';

export interface V2AgendaEvent {
  id: string;
  when: Date;
  time: string;
  icon: string;
  label: string;
  sub?: string;
  cap: Capability | 'concours';
}
export interface V2AgendaDay { key: number; label: string; events: V2AgendaEvent[] }

const DEAD = new Set(['cancelled', 'rejected', 'payment_expired']);

export function useV2Agenda() {
  const { profile } = useAuth();
  const me = (profile as any)?.id as string | undefined;
  const { reservations: transport } = useMyTransportReservations();
  const { reservations: box } = useMyBoxReservations();
  const { demands: course } = useMyCourseDemands();
  const { reservations: stage } = useMyStageReservations();
  const { concours } = useConcoursList();
  const local = useConcoursLocal();

  return useMemo(() => {
    const ev: V2AgendaEvent[] = [];

    for (const t of transport) {
      if (me && t.buyerId !== me) continue;
      if (DEAD.has(String(t.statut))) continue;
      const d = t.dateTrajet ?? t.dateCreation;
      if (d) ev.push({ id: `t-${t.id}`, when: d, time: timeLabel(d), icon: '🚚', label: `Transport — ${t.titre || t.villeArrivee || 'trajet'}`, sub: t.villeDepart && t.villeArrivee ? `${t.villeDepart} → ${t.villeArrivee}` : undefined, cap: 'cavalier' });
    }
    for (const b of box) {
      if (me && b.buyerId !== me) continue;
      if (DEAD.has(String(b.statut))) continue;
      if (b.dateDebut) ev.push({ id: `b-${b.id}`, when: b.dateDebut, time: timeLabel(b.dateDebut), icon: '🏠', label: `Box — ${b.titre || b.lieu || 'hébergement'}`, sub: b.lieu || undefined, cap: 'cavalier' });
    }
    for (const c of course) {
      if (DEAD.has(String(c.statut))) continue;
      const asCoach = !!me && c.coachId === me;
      const asRider = !!me && c.cavalierUserId === me;
      if (!asCoach && !asRider) continue;
      const d = c.dateDebut;
      if (!d) continue;
      ev.push(asCoach
        ? { id: `c-${c.id}`, when: d, time: timeLabel(d), icon: '🎓', label: `Coaching — ${c.cavalierNom || 'cavalier'}${c.cheval ? ` / ${c.cheval}` : ''}`, sub: c.concoursNom || c.annonceTitre, cap: 'coach' }
        : { id: `c-${c.id}`, when: d, time: timeLabel(d), icon: '🎓', label: `Coaching avec ${c.coachNom || 'coach'}`, sub: c.concoursNom || c.annonceTitre, cap: 'cavalier' });
    }
    for (const s of stage) {
      const st = s as any;
      const d: Date | undefined = st.dateDebut instanceof Date ? st.dateDebut : (st.date_debut ? new Date(st.date_debut) : undefined);
      if (!d || DEAD.has(String(st.statut ?? st.status))) continue;
      ev.push({ id: `s-${st.id}`, when: d, time: timeLabel(d), icon: '📚', label: `Stage — ${st.titre ?? st.title ?? 'stage'}`, cap: 'cavalier' });
    }
    // Concours suivis / "J'y serai"
    const followed = new Set([...local.followingIds, ...local.goingIds]);
    for (const cc of concours) {
      if (!followed.has(cc.id) || !cc.date_debut) continue;
      const d = new Date(`${cc.date_debut}T00:00:00`);
      ev.push({ id: `k-${cc.id}`, when: d, time: 'journée', icon: '🏆', label: cc.nom, sub: cc.lieu || undefined, cap: 'concours' });
    }

    const demo = ev.length === 0;
    const source: V2AgendaEvent[] = demo
      ? MOCK_AGENDA.map((m) => ({
          id: m.id,
          when: new Date(2026, 8, m.day.includes('12') ? 12 : 13, m.time === 'journée' ? 0 : Number(m.time.slice(0, 2)), m.time === 'journée' ? 0 : Number(m.time.slice(3))),
          time: m.time, icon: m.icon, label: m.label, sub: m.concours, cap: m.cap,
        }))
      : ev;

    const byDay = new Map<number, V2AgendaDay>();
    for (const e of [...source].sort((a, b) => a.when.getTime() - b.when.getTime())) {
      const k = dayKey(e.when);
      if (!byDay.has(k)) byDay.set(k, { key: k, label: dayLabel(e.when), events: [] });
      byDay.get(k)!.events.push(e);
    }
    const days = [...byDay.values()].sort((a, b) => a.key - b.key);
    const pendingCount = ev.filter((e) => e.cap === 'coach').length; // demandes à traiter côté coach (indicatif)

    return { days, demo, pendingCount, hasSession: !!me };
  }, [me, transport, box, course, stage, concours, local.followingIds, local.goingIds]);
}
