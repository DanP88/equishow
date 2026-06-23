// ─────────────────────────────────────────────────────────────────────────────
// useMyReservationsSummary — récap APLATI des réservations de l'utilisateur côté
// ACHETEUR (cavalier), pour l'onglet Accueil. Réutilise les hooks de réservation
// existants (transport/box/stage/cours) et résout les noms vendeurs.
// Conventions de montant alignées sur cavalier-agenda (transport/box = TTC,
// stage/cours = prix seller). Lecture seule, défensif.
// ─────────────────────────────────────────────────────────────────────────────
import { useMemo } from 'react';
import { userStore } from '../data/store';
import { useMyTransportReservations } from './useTransports';
import { useMyBoxReservations } from './useBoxes';
import { useMyStageReservations } from './useStages';
import { useMyCourseDemands } from './useCourseDemands';
import { useUsersByIds } from './useUsersByIds';

export type ResaModule = 'box' | 'transport' | 'coach' | 'stage';

export interface ResaSummaryItem {
  id: string;               // = reservation id (deep-link agenda ?pay=<id>)
  module: ResaModule;
  titre: string;
  vendeur: string;
  montant: number;
  statut: string;
  needsPayment: boolean;    // « à régler »
  dateDebut: Date;
}

// « À régler » = paiement dû. awaiting_payment partout ; accepted en plus pour
// coach/stage (paiement différé après acceptation).
function needsPay(module: ResaModule, statut: string): boolean {
  if (statut === 'awaiting_payment') return true;
  if ((module === 'coach' || module === 'stage') && statut === 'accepted') return true;
  return false;
}

export function useMyReservationsSummary() {
  const uid = userStore.id;
  const { reservations: transportR, isLoading: tL } = useMyTransportReservations();
  const { reservations: boxR, isLoading: bL } = useMyBoxReservations();
  const { reservations: stageR, isLoading: sL } = useMyStageReservations();
  const { demands: courseR, isLoading: cL } = useMyCourseDemands();

  const myTransport = useMemo(() => transportR.filter((r) => r.buyerId === uid), [transportR, uid]);
  const myBox = useMemo(() => boxR.filter((r) => r.buyerId === uid), [boxR, uid]);
  const myStage = useMemo(() => stageR.filter((r) => r.cavalierUserId === uid), [stageR, uid]);
  const myCourse = useMemo(() => courseR.filter((r) => r.cavalierUserId === uid), [courseR, uid]);

  // Noms vendeurs : transport/box (sellerId) + stage (coachId, coachNom vide).
  const usersById = useUsersByIds([
    ...myTransport.map((r) => r.sellerId),
    ...myBox.map((r) => r.sellerId),
    ...myStage.map((r) => r.coachId),
  ]);
  const nameOf = (id: string) => {
    const u = usersById.get(id);
    return u ? `${u.prenom} ${u.nom}`.trim() : '';
  };

  const items: ResaSummaryItem[] = useMemo(() => {
    const out: ResaSummaryItem[] = [];
    myTransport.forEach((r) => out.push({
      id: r.id, module: 'transport', titre: `${r.villeDepart} → ${r.villeArrivee}`,
      vendeur: nameOf(r.sellerId), montant: r.prixTotalTTC, statut: r.statut,
      needsPayment: needsPay('transport', r.statut), dateDebut: r.dateTrajet ?? r.dateCreation,
    }));
    myBox.forEach((r) => out.push({
      id: r.id, module: 'box', titre: r.titre, vendeur: nameOf(r.sellerId) || r.lieu,
      montant: r.prixTotalTTC, statut: r.statut, needsPayment: needsPay('box', r.statut),
      dateDebut: r.dateDebut,
    }));
    myStage.forEach((r) => out.push({
      id: r.id, module: 'stage', titre: r.stageTitre, vendeur: nameOf(r.coachId),
      montant: r.prixSeller, statut: r.statut, needsPayment: needsPay('stage', r.statut),
      dateDebut: r.dateReservation,
    }));
    myCourse.forEach((r) => out.push({
      id: r.id, module: 'coach', titre: r.annonceTitre, vendeur: r.coachNom,
      montant: r.prix, statut: r.statut, needsPayment: needsPay('coach', r.statut),
      dateDebut: r.dateDebut,
    }));
    // À régler d'abord, puis par date de début croissante.
    out.sort((a, b) => {
      if (a.needsPayment !== b.needsPayment) return a.needsPayment ? -1 : 1;
      return a.dateDebut.getTime() - b.dateDebut.getTime();
    });
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myTransport, myBox, myStage, myCourse, usersById]);

  return {
    items,
    toPay: items.filter((i) => i.needsPayment),
    isLoading: tL || bL || sL || cL,
  };
}
