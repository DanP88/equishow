import { useState, useCallback, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet, SafeAreaView, TouchableOpacity, Modal, TextInput, Alert } from 'react-native';
import { useFocusEffect, router } from 'expo-router';
import { Colors } from '../../constants/colors';
import { Spacing, Radius, FontSize, FontWeight, Shadow } from '../../constants/theme';
import { userStore } from '../../data/store';
import { useTransportAnnonces, useMyTransportReservations } from '../../hooks/useTransports';
import { useMyBoxReservations } from '../../hooks/useBoxes';
import { createNotification } from '../../hooks/useNotifications';
import { sendReservationEmail } from '../../utils/sendReservationEmail';
import { useMyStageReservations, useStages } from '../../hooks/useStages';
import { useMyCourseDemands } from '../../hooks/useCourseDemands';
import { getUserById } from '../../data/mockUsers';
import { useUsersByIds } from '../../hooks/useUsersByIds';
import { useAvis, useMyAvisRefs, AvisType } from '../../hooks/useAvis';
import { useMyEscrowPayments } from '../../hooks/useMyEscrowPayments';
import { useEscrowActions } from '../../hooks/useEscrowActions';
import { ConfirmModal } from '../../components/ConfirmModal';
import { AlertModal } from '../../components/AlertModal';

// Libellé + style du statut séquestre (escrow) côté acheteur.
function escrowBadge(p: { transferState: string; disputeStatus: string | null; releaseBlockedReason: string | null }) {
  if (p.disputeStatus === 'open' || p.releaseBlockedReason === 'dispute' || p.releaseBlockedReason === 'chargeback') {
    return { label: '⚠️ Litige en cours', bg: '#FEE2E2', border: '#EF4444', color: '#991B1B' };
  }
  // États « en attente » neutres (jamais « litige ») : vendeur non configuré, ou
  // versement temporairement bloqué côté Stripe.
  if (p.releaseBlockedReason === 'seller_not_onboarded') {
    return { label: '⏳ En attente vendeur', bg: '#F3F4F6', border: '#9CA3AF', color: '#374151' };
  }
  if (p.releaseBlockedReason === 'transfer_blocked') {
    return { label: '⏳ Versement en attente', bg: '#F3F4F6', border: '#9CA3AF', color: '#374151' };
  }
  switch (p.transferState) {
    case 'held':
      return { label: '🔒 Fonds sécurisés', bg: '#EFF6FF', border: '#3B82F6', color: '#1E40AF' };
    case 'releasing':
      return { label: '⏳ Versement en cours', bg: '#EFF6FF', border: '#3B82F6', color: '#1E40AF' };
    case 'released':
      return { label: '✅ Versé au vendeur', bg: '#ECFDF5', border: '#10B981', color: '#065F46' };
    case 'reversed':
      return { label: '↩️ Remboursé', bg: '#F3F4F6', border: '#9CA3AF', color: '#374151' };
    case 'failed':
      return { label: '❌ Échec versement', bg: '#FEE2E2', border: '#EF4444', color: '#991B1B' };
    default:
      return null;
  }
}

type AgendaItem = {
  id: string;
  type: 'transport_buyer' | 'transport_seller' | 'box_buyer' | 'box_seller' | 'stage' | 'cours';
  titre: string;
  sous_titre: string;
  dateDebut: Date;
  dateFin?: Date;
  montant: number;
  statut: string;
  autrePartieId: string;
  autrePartieNom: string;
  autrePartiePseudo: string;
  autrePartieInitiales: string;
  autrePartieCouleur: string;
};

function statutStyle(statut: string) {
  if (statut === 'paid') return { label: '● Réservé', bg: '#ECFDF5', border: '#10B981' };
  if (statut === 'accepted') return { label: '● Confirmé', bg: '#ECFDF5', border: '#10B981' };
  if (statut === 'pending') return { label: '● En attente', bg: '#FFF7ED', border: '#F59E0B' };
  if (statut === 'rejected') return { label: '● Refusé', bg: '#FEE2E2', border: '#EF4444' };
  if (statut === 'cancelled') return { label: '● Annulé', bg: Colors.surfaceVariant, border: '#9CA3AF' };
  if (statut === 'completed') return { label: '● Terminé', bg: '#ECFDF5', border: '#10B981' };
  return { label: statut, bg: Colors.surfaceVariant, border: Colors.border };
}

function typeEmoji(type: AgendaItem['type']) {
  if (type.startsWith('transport')) return '🚐';
  if (type.startsWith('box')) return '🏠';
  if (type === 'stage') return '📚';
  return '🎓';
}

function typeLabel(type: AgendaItem['type']) {
  if (type === 'transport_buyer') return 'Transport réservé';
  if (type === 'transport_seller') return 'Transport proposé';
  if (type === 'box_buyer') return 'Box réservé';
  if (type === 'box_seller') return 'Box loué';
  if (type === 'stage') return 'Stage';
  return 'Cours';
}

function roleOf(type: AgendaItem['type']) {
  if (type === 'transport_seller' || type === 'box_seller') return 'Locataire';
  if (type === 'transport_buyer') return 'Conducteur';
  if (type === 'box_buyer') return 'Propriétaire';
  if (type === 'stage' || type === 'cours') return 'Coach';
  return 'Autre partie';
}

function formatDate(d: Date) {
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
}

type AvisModal = { destId: string; destNom: string; type: AgendaItem['type']; refId: string } | null;

function avisTypeFromAgenda(t: AgendaItem['type']): AvisType {
  if (t === 'transport_buyer' || t === 'transport_seller') return 'transport';
  if (t === 'box_buyer' || t === 'box_seller') return 'box';
  if (t === 'stage') return 'stage';
  return 'coach';
}

export default function CavalierAgendaScreen() {
  const [items, setItems] = useState<AgendaItem[]>([]);
  const { transports } = useTransportAnnonces();
  const { reservations: transportReservations } = useMyTransportReservations();
  const { reservations: boxReservations, updateStatut: updateBoxStatut } = useMyBoxReservations();
  const { reservations: stageReservations } = useMyStageReservations();
  const { stages: allStages } = useStages();
  const { demands: courseDemands } = useMyCourseDemands();
  const [tick, setTick] = useState(0);
  const [avisModal, setAvisModal] = useState<AvisModal>(null);
  const [avisNote, setAvisNote] = useState(5);
  const [avisComment, setAvisComment] = useState('');
  const [avisSubmitting, setAvisSubmitting] = useState(false);
  const { createAvis } = useAvis();
  const myAvisRefs = useMyAvisRefs();
  const { byReservation: escrowByResa, reload: reloadEscrow } = useMyEscrowPayments();
  const { releasePayment, openDispute, loading: escrowLoading } = useEscrowActions();
  // Modales escrow stylées (cohérentes avec le reste de l'app) au lieu des
  // window.confirm/alert natifs du navigateur.
  const [escrowConfirm, setEscrowConfirm] = useState<{ kind: 'release' | 'dispute'; paymentId: string } | null>(null);
  const [escrowAlert, setEscrowAlert] = useState<{ title: string; message: string; variant: 'success' | 'error' | 'info' } | null>(null);

  // Les boutons escrow ouvrent une modale de confirmation stylée ; l'appel réseau
  // ne part qu'après confirmation (runEscrowAction).
  const onConfirmPrestation = useCallback((paymentId: string) => {
    if (escrowLoading) return;
    setEscrowConfirm({ kind: 'release', paymentId });
  }, [escrowLoading]);

  const onOpenDispute = useCallback((paymentId: string) => {
    if (escrowLoading) return;
    setEscrowConfirm({ kind: 'dispute', paymentId });
  }, [escrowLoading]);

  // Exécute l'action confirmée, puis affiche le résultat dans une modale stylée.
  const runEscrowAction = useCallback(async () => {
    if (!escrowConfirm) return;
    const { kind, paymentId } = escrowConfirm;
    setEscrowConfirm(null);
    const res = kind === 'release'
      ? await releasePayment(paymentId)
      : await openDispute(paymentId);
    if (res.ok) {
      reloadEscrow();
      setEscrowAlert(kind === 'release'
        ? { title: 'Paiement libéré', message: 'Le vendeur va recevoir son versement. Merci !', variant: 'success' }
        : { title: 'Litige ouvert', message: 'Le versement est bloqué. Un administrateur va examiner votre signalement.', variant: 'success' });
    } else {
      // On reload aussi en erreur : si l'Edge a écrit release_blocked_reason
      // (ex. seller_not_onboarded), la card doit basculer en « En attente
      // vendeur » et masquer le bouton « Libérer » pour éviter une boucle.
      reloadEscrow();
      const message = res.code === 'no_token'
        ? 'Session expirée, veuillez vous reconnecter.'
        : res.code === 'network'
          ? 'Une erreur réseau est survenue.'
          : res.code === 'too_early'
            ? 'Vous pourrez confirmer une fois la prestation terminée.'
            : res.code === 'blocked' || res.code === 'seller_not_onboarded'
              ? 'Le vendeur n’a pas encore finalisé son onboarding paiement. Le versement reste sécurisé et sera libéré dès qu’il aura configuré son compte.'
              : res.code === 'not_held' || res.code === 'not_held_or_in_progress'
                ? 'Ce versement est déjà en cours de libération ou a déjà été versé.'
                : kind === 'release'
                  ? `Le versement n’a pas pu être libéré (${res.code}).`
                  : `Le litige n’a pas pu être ouvert (${res.code}).`;
      setEscrowAlert({ title: 'Action impossible', message, variant: 'error' });
    }
  }, [escrowConfirm, releasePayment, openDispute, reloadEscrow]);

  function openAvis(item: AgendaItem) {
    setAvisNote(5);
    setAvisComment('');
    setAvisModal({ destId: item.autrePartieId, destNom: item.autrePartieNom, type: item.type, refId: item.id });
  }

  // Accept/Reject inline depuis l'agenda pour les box_seller pending. id agenda
  // pour box_seller = `${r.id}_s`, on strip le suffixe pour retrouver la résa.
  const acceptBoxFromAgenda = useCallback(async (item: AgendaItem) => {
    const resaId = item.id.endsWith('_s') ? item.id.slice(0, -2) : item.id;
    const { error } = await updateBoxStatut(resaId, 'accepted');
    if (error) { Alert.alert('Erreur', error); return; }
    await createNotification({
      destinataireId: item.autrePartieId,
      type: 'reservation_request',
      titre: '✅ Votre réservation de box a été acceptée!',
      message: `Votre réservation pour "${item.titre}" a été acceptée. Vous pouvez maintenant procéder au paiement.`,
      status: 'accepted',
      actionUrl: '/pending-box-payments',
      donnees: { titre: item.titre, prix: item.montant },
    });
    await sendReservationEmail('box', resaId);
    Alert.alert('✅ Réservation acceptée', 'Le cavalier a été notifié et peut maintenant payer.');
  }, [updateBoxStatut]);

  const rejectBoxFromAgenda = useCallback(async (item: AgendaItem) => {
    const resaId = item.id.endsWith('_s') ? item.id.slice(0, -2) : item.id;
    const { error } = await updateBoxStatut(resaId, 'rejected');
    if (error) { Alert.alert('Erreur', error); return; }
    await createNotification({
      destinataireId: item.autrePartieId,
      type: 'reservation_request',
      titre: '❌ Votre réservation de box a été refusée',
      message: `Votre réservation pour "${item.titre}" a été refusée.`,
      status: 'rejected',
    });
    Alert.alert('Réservation refusée', 'Le cavalier a été notifié du refus.');
  }, [updateBoxStatut]);

  async function submitAvis() {
    if (!avisModal || avisSubmitting) return;
    setAvisSubmitting(true);
    try {
      const { error } = await createAvis(
        avisModal.destId,
        avisNote,
        avisComment,
        avisTypeFromAgenda(avisModal.type),
        avisModal.refId,
      );
      if (error) {
        Alert.alert('Erreur', error);
        return;
      }
      setAvisModal(null);
      Alert.alert('Merci !', 'Votre avis a bien été enregistré.');
    } finally {
      setAvisSubmitting(false);
    }
  }

  useFocusEffect(useCallback(() => {
    setTick((t) => t + 1);
    reloadEscrow();
  }, [reloadEscrow]));

  // Résout en lot tous les UUID (buyers/sellers/coaches) vers users_public,
  // pour remplacer l'UUID brut par le nom dans l'agenda (bug #1).
  const allIds = [
    ...transportReservations.flatMap((r) => [r.sellerId, r.buyerId]),
    ...boxReservations.flatMap((r) => [r.sellerId, r.buyerId]),
    ...stageReservations.map((r) => r.coachId),
    ...courseDemands.map((r) => r.coachId),
  ];
  const usersById = useUsersByIds(allIds);
  const resolveUser = useCallback((id: string) => {
    const u = usersById.get(id);
    if (u) {
      return {
        id: u.id,
        prenom: u.prenom,
        nom: u.nom,
        pseudo: u.pseudo,
        initiales: u.initiales,
        avatarColor: u.avatar_color,
      };
    }
    return getUserById(id);
  }, [usersById]);

  useEffect(() => {
    const uid = userStore.id;
    const all: AgendaItem[] = [];

    // ── Transports acheteur ──
    transportReservations
      .filter(r => r.buyerId === uid)
      .forEach(r => {
        const annonce = transports.find(t => t.id === r.transportId);
        const seller = resolveUser(r.sellerId) ?? {
          id: r.sellerId, prenom: annonce?.auteurNom?.split(' ')[0] ?? '?', nom: annonce?.auteurNom?.split(' ')[1] ?? '',
          pseudo: annonce?.auteurPseudo ?? '?', initiales: annonce?.auteurInitiales ?? '?',
          avatarColor: annonce?.auteurCouleur ?? Colors.primary,
          role: 'cavalier', disciplines: [], region: '',
        };
        all.push({
          id: r.id,
          type: 'transport_buyer',
          titre: `${r.villeDepart} → ${r.villeArrivee}`,
          sous_titre: `${r.nbPlaces} place(s)`,
          dateDebut: annonce?.dateTrajet ?? r.dateCreation,
          dateFin: annonce?.dateRetour ?? undefined,
          montant: r.prixTotalTTC,
          statut: r.statut,
          autrePartieId: r.sellerId,
          autrePartieNom: `${seller.prenom} ${seller.nom}`.trim(),
          autrePartiePseudo: seller.pseudo,
          autrePartieInitiales: seller.initiales,
          autrePartieCouleur: seller.avatarColor,
        });
      });

    // ── Transports vendeur ──
    transportReservations
      .filter(r => r.sellerId === uid)
      .forEach(r => {
        const annonce = transports.find(t => t.id === r.transportId);
        const buyer = resolveUser(r.buyerId) ?? {
          id: r.buyerId, prenom: '?', nom: '', pseudo: '?', initiales: '?',
          avatarColor: Colors.primary, role: 'cavalier', disciplines: [], region: '',
        };
        all.push({
          id: r.id + '_s',
          type: 'transport_seller',
          titre: `${r.villeDepart} → ${r.villeArrivee}`,
          sous_titre: `${r.nbPlaces} place(s)`,
          dateDebut: annonce?.dateTrajet ?? r.dateCreation,
          dateFin: annonce?.dateRetour ?? undefined,
          montant: r.prixTotalTTC,
          statut: r.statut,
          autrePartieId: r.buyerId,
          autrePartieNom: `${buyer.prenom} ${buyer.nom}`.trim(),
          autrePartiePseudo: buyer.pseudo,
          autrePartieInitiales: buyer.initiales,
          autrePartieCouleur: buyer.avatarColor,
        });
      });

    // ── Box acheteur ──
    boxReservations
      .filter(r => r.buyerId === uid)
      .forEach(r => {
        const seller = resolveUser(r.sellerId);
        all.push({
          id: r.id,
          type: 'box_buyer',
          titre: r.titre,
          sous_titre: `${r.nbNuits} nuit(s) · ${r.lieu}`,
          dateDebut: r.dateDebut,
          dateFin: r.dateFin,
          montant: r.prixTotalTTC,
          statut: r.statut,
          autrePartieId: r.sellerId,
          autrePartieNom: seller ? `${seller.prenom} ${seller.nom}` : r.sellerId,
          autrePartiePseudo: seller?.pseudo ?? '?',
          autrePartieInitiales: seller?.initiales ?? '?',
          autrePartieCouleur: seller?.avatarColor ?? Colors.primary,
        });
      });

    // ── Box vendeur ──
    boxReservations
      .filter(r => r.sellerId === uid)
      .forEach(r => {
        const buyer = resolveUser(r.buyerId);
        all.push({
          id: r.id + '_s',
          type: 'box_seller',
          titre: r.titre,
          sous_titre: `${r.nbNuits} nuit(s) · ${r.lieu}`,
          dateDebut: r.dateDebut,
          dateFin: r.dateFin,
          montant: r.prixTotalTTC,
          statut: r.statut,
          autrePartieId: r.buyerId,
          autrePartieNom: buyer ? `${buyer.prenom} ${buyer.nom}` : r.buyerId,
          autrePartiePseudo: buyer?.pseudo ?? '?',
          autrePartieInitiales: buyer?.initiales ?? '?',
          autrePartieCouleur: buyer?.avatarColor ?? Colors.primary,
        });
      });

    // ── Stages ──
    stageReservations
      .filter(r => r.cavalierUserId === uid)
      .forEach(r => {
        const stage = allStages.find(s => s.id === r.stageId);
        const coach = resolveUser(r.coachId);
        all.push({
          id: r.id,
          type: 'stage',
          titre: r.stageTitre,
          sous_titre: r.coachNom,
          dateDebut: stage?.dateDebut ?? r.dateReservation,
          dateFin: stage?.dateFin,
          montant: r.prixTotal,
          statut: r.statut,
          autrePartieId: r.coachId,
          autrePartieNom: r.coachNom,
          autrePartiePseudo: coach?.pseudo ?? r.coachNom,
          autrePartieInitiales: coach?.initiales ?? r.coachNom.slice(0, 2).toUpperCase(),
          autrePartieCouleur: coach?.avatarColor ?? '#7C3AED',
        });
      });

    // ── Cours ──
    courseDemands
      .filter(r => r.cavalierUserId === uid)
      .forEach(r => {
        const coach = resolveUser(r.coachId);
        all.push({
          id: r.id,
          type: 'cours',
          titre: r.annonceTitre,
          sous_titre: `${r.discipline} · ${r.niveau}`,
          dateDebut: r.dateDebut,
          dateFin: r.dateFin,
          montant: r.prix,
          statut: r.statut,
          autrePartieId: r.coachId,
          autrePartieNom: r.coachNom,
          autrePartiePseudo: coach?.pseudo ?? r.coachNom,
          autrePartieInitiales: coach?.initiales ?? r.coachNom.slice(0, 2).toUpperCase(),
          autrePartieCouleur: coach?.avatarColor ?? '#7C3AED',
        });
      });

    all.sort((a, b) => a.dateDebut.getTime() - b.dateDebut.getTime());
    setItems(all);
  }, [tick, transports, transportReservations, boxReservations, stageReservations, allStages, courseDemands, resolveUser]);

  // Grouper par date
  const byDate = new Map<string, AgendaItem[]>();
  items.forEach(item => {
    const raw = item.dateDebut.toLocaleDateString('fr-FR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
    const key = raw.charAt(0).toUpperCase() + raw.slice(1);
    if (!byDate.has(key)) byDate.set(key, []);
    byDate.get(key)!.push(item);
  });

  return (
    <SafeAreaView style={s.root}>
      <View style={s.header}>
        <Text style={s.headerTitle}>Mon agenda</Text>
        {items.length > 0 && <Text style={s.countBadge}>{items.length}</Text>}
      </View>

      <ScrollView contentContainerStyle={s.container} scrollEnabled>
        {items.length === 0 ? (
          <View style={s.empty}>
            <Text style={s.emptyIcon}>📅</Text>
            <Text style={s.emptyTitle}>Aucune réservation</Text>
            <Text style={s.emptyText}>Vos réservations de transport, box, stages et cours apparaîtront ici.</Text>
          </View>
        ) : (
          Array.from(byDate.entries()).map(([dateStr, dateItems]) => (
            <View key={dateStr}>
              <Text style={s.dateHeader}>{dateStr}</Text>
              {dateItems.map(item => {
                const st = statutStyle(item.statut);
                return (
                  <View key={item.id} style={s.card}>
                    {/* Top : type + statut */}
                    <View style={s.cardTop}>
                      <View style={s.typeTag}>
                        <Text style={s.typeEmoji}>{typeEmoji(item.type)}</Text>
                        <Text style={s.typeLabel}>{typeLabel(item.type)}</Text>
                      </View>
                      <View style={[s.statutBadge, { backgroundColor: st.bg, borderColor: st.border }]}>
                        <Text style={s.statutText}>{st.label}</Text>
                      </View>
                    </View>

                    {/* Titre */}
                    <Text style={s.titre}>{item.titre}</Text>
                    <Text style={s.sousTitre}>{item.sous_titre}</Text>

                    {/* Dates */}
                    <View style={s.datesRow}>
                      <Text style={s.dateLabel}>📅 Début</Text>
                      <Text style={s.dateVal}>{formatDate(item.dateDebut)}</Text>
                      {item.dateFin && (
                        <>
                          <Text style={s.dateSep}>→</Text>
                          <Text style={s.dateLabel}>Fin</Text>
                          <Text style={s.dateVal}>{formatDate(item.dateFin)}</Text>
                        </>
                      )}
                    </View>

                    {/* Autre partie cliquable */}
                    <TouchableOpacity
                      style={s.autrePartie}
                      onPress={() => router.push({
                        pathname: '/messagerie',
                        params: {
                          otherId: item.autrePartieId,
                          otherNom: item.autrePartieNom,
                          otherPseudo: item.autrePartiePseudo,
                          otherCouleur: item.autrePartieCouleur,
                          otherInitiales: item.autrePartieInitiales,
                          sujet: `${typeEmoji(item.type)} ${item.titre}`,
                        },
                      } as any)}
                      activeOpacity={0.75}
                    >
                      <View style={[s.miniAvatar, { backgroundColor: item.autrePartieCouleur }]}>
                        <Text style={s.miniAvatarText}>{item.autrePartieInitiales}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={s.autrePartieRole}>{roleOf(item.type)}</Text>
                        <Text style={s.autrePartieNom}>{item.autrePartieNom}</Text>
                        <Text style={s.autrePartiePseudo}>@{item.autrePartiePseudo}</Text>
                      </View>
                      <Text style={s.chevronMsg}>💬</Text>
                    </TouchableOpacity>

                    {/* Accept/Reject inline pour box_seller pending */}
                    {item.type === 'box_seller' && item.statut === 'pending' && (
                      <View style={s.actionRow}>
                        <TouchableOpacity
                          style={[s.actionBtn, s.rejectBtn]}
                          onPress={() => rejectBoxFromAgenda(item)}
                          activeOpacity={0.85}
                        >
                          <Text style={s.rejectBtnText}>❌ Refuser</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[s.actionBtn, s.acceptBtn]}
                          onPress={() => acceptBoxFromAgenda(item)}
                          activeOpacity={0.85}
                        >
                          <Text style={s.acceptBtnText}>✅ Accepter</Text>
                        </TouchableOpacity>
                      </View>
                    )}

                    {/* Payer maintenant inline pour items accepted côté buyer
                        (cours/stage/box). Sinon le cavalier devait passer par
                        la notif → écran cible. La card agenda devient un
                        2e point d'entrée payment (utile si la notif a été
                        supprimée). */}
                    {item.statut === 'accepted' && (item.type === 'cours' || item.type === 'stage' || item.type === 'box_buyer') && (
                      <View style={s.actionRow}>
                        <TouchableOpacity
                          style={[s.actionBtn, s.acceptBtn]}
                          onPress={() => {
                            const url = item.type === 'box_buyer' ? '/pending-box-payments' : '/pending-payments';
                            router.push(url as any);
                          }}
                          activeOpacity={0.85}
                        >
                          <Text style={s.acceptBtnText}>💳 Payer maintenant</Text>
                        </TouchableOpacity>
                      </View>
                    )}

                    {/* Montant + Avis */}
                    <View style={s.cardBottom}>
                      <Text style={s.montant}>{item.montant.toFixed(2)}€ TTC</Text>
                      {(item.statut === 'paid' || item.statut === 'accepted') && (
                        myAvisRefs.has(item.id) ? (
                          <View style={s.avisDoneBadge}>
                            <Text style={s.avisDoneText}>⭐ Avis déposé</Text>
                          </View>
                        ) : (
                          <TouchableOpacity style={s.avisBtn} onPress={() => openAvis(item)}>
                            <Text style={s.avisBtnText}>⭐ Laisser un avis</Text>
                          </TouchableOpacity>
                        )
                      )}
                    </View>

                    {/* Séquestre (escrow) — acheteur uniquement, si paiement séquestre.
                        Étendu à cours et stage : useMyEscrowPayments renvoie le
                        payment via course_demand_id / stage_reservation_id, mais
                        l'UI gate ne couvrait que box_buyer → cavalier ne pouvait
                        ni libérer ni signaler le paiement après prestation. */}
                    {(item.type === 'box_buyer' || item.type === 'cours' || item.type === 'stage') && escrowByResa[item.id] && (() => {
                      const ep = escrowByResa[item.id];
                      const badge = escrowBadge(ep);
                      if (!badge) return null;
                      const isDispute = ep.disputeStatus === 'open' || ep.releaseBlockedReason === 'dispute' || ep.releaseBlockedReason === 'chargeback';
                      const isSellerPending = ep.releaseBlockedReason === 'seller_not_onboarded';
                      const isTransferBlocked = ep.releaseBlockedReason === 'transfer_blocked';
                      const blocked = isDispute || !!ep.releaseBlockedReason;
                      const canAct = ep.transferState === 'held' && !blocked;
                      return (
                        <View style={s.escrowBox}>
                          <View style={s.escrowTop}>
                            <View style={[s.escrowBadge, { backgroundColor: badge.bg, borderColor: badge.border }]}>
                              <Text style={[s.escrowBadgeText, { color: badge.color }]}>{badge.label}</Text>
                            </View>
                          </View>
                          {ep.transferState === 'held' && !blocked && (
                            <Text style={s.escrowHint}>
                              Votre paiement est conservé en sécurité. Il sera versé au vendeur automatiquement
                              après la prestation, ou dès que vous confirmez l'avoir reçue.
                            </Text>
                          )}
                          {isDispute && (
                            <Text style={s.escrowHint}>
                              Versement bloqué : un administrateur examine le litige.
                            </Text>
                          )}
                          {isSellerPending && (
                            <Text style={s.escrowHint}>
                              Versement en attente de la configuration du compte vendeur.
                            </Text>
                          )}
                          {isTransferBlocked && (
                            <Text style={s.escrowHint}>
                              Versement temporairement en attente, il sera réessayé automatiquement.
                            </Text>
                          )}
                          {canAct && (
                            <View style={s.escrowActions}>
                              <TouchableOpacity
                                style={[s.escrowBtnPrimary, escrowLoading && s.escrowBtnDisabled]}
                                disabled={escrowLoading}
                                onPress={() => onConfirmPrestation(ep.id)}
                                activeOpacity={0.8}
                              >
                                <Text style={s.escrowBtnPrimaryText}>✅ J'ai reçu la prestation — libérer</Text>
                              </TouchableOpacity>
                              <TouchableOpacity
                                style={[s.escrowBtnGhost, escrowLoading && s.escrowBtnDisabled]}
                                disabled={escrowLoading}
                                onPress={() => onOpenDispute(ep.id)}
                                activeOpacity={0.8}
                              >
                                <Text style={s.escrowBtnGhostText}>⚠️ Signaler un problème</Text>
                              </TouchableOpacity>
                            </View>
                          )}
                        </View>
                      );
                    })()}
                  </View>
                );
              })}
            </View>
          ))
        )}
        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Modal Avis */}
      <Modal visible={!!avisModal} transparent animationType="slide">
        <View style={s.modalBackdrop}>
          <View style={s.modalSheet}>
            <Text style={s.modalTitle}>Laisser un avis</Text>
            {avisModal && (
              <Text style={s.modalSubtitle}>Pour {avisModal.destNom}</Text>
            )}
            <Text style={s.modalLabel}>Note</Text>
            <View style={s.starsRow}>
              {[1, 2, 3, 4, 5].map(star => (
                <TouchableOpacity key={star} onPress={() => setAvisNote(star)} style={s.starBtn}>
                  <Text style={s.starIcon}>{star <= avisNote ? '⭐' : '☆'}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={s.modalLabel}>Commentaire (optionnel)</Text>
            <TextInput
              style={s.commentInput}
              placeholder="Partagez votre expérience..."
              placeholderTextColor={Colors.textTertiary}
              value={avisComment}
              onChangeText={setAvisComment}
              multiline
              numberOfLines={3}
            />
            <View style={s.modalActions}>
              <TouchableOpacity style={s.cancelBtn} onPress={() => setAvisModal(null)}>
                <Text style={s.cancelText}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.submitBtn, avisSubmitting && { opacity: 0.6 }]}
                onPress={submitAvis}
                disabled={avisSubmitting}
              >
                <Text style={s.submitText}>{avisSubmitting ? 'Envoi…' : 'Envoyer'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Confirmation escrow (libérer / signaler) — modale stylée app */}
      <ConfirmModal
        visible={!!escrowConfirm}
        title={escrowConfirm?.kind === 'dispute' ? 'Signaler un problème' : 'Libérer le paiement'}
        message={escrowConfirm?.kind === 'dispute'
          ? "Un litige sera ouvert et le versement au vendeur bloqué, le temps qu'un administrateur vérifie la situation. Continuer ?"
          : 'Confirmez-vous avoir bien reçu la prestation ? Les fonds seront versés au vendeur. Cette action est définitive.'}
        confirmLabel={escrowConfirm?.kind === 'dispute' ? 'Ouvrir un litige' : 'Oui, libérer'}
        destructive={escrowConfirm?.kind === 'dispute'}
        onCancel={() => setEscrowConfirm(null)}
        onConfirm={runEscrowAction}
      />

      {/* Résultat escrow — modale stylée app */}
      <AlertModal
        visible={!!escrowAlert}
        title={escrowAlert?.title ?? ''}
        message={escrowAlert?.message}
        variant={escrowAlert?.variant ?? 'info'}
        onClose={() => setEscrowAlert(null)}
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: Spacing.lg, borderBottomWidth: 1, borderBottomColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  headerTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  countBadge: {
    fontSize: FontSize.sm, fontWeight: FontWeight.bold,
    backgroundColor: Colors.primary, color: Colors.textInverse,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs, borderRadius: Radius.lg,
  },
  container: { padding: Spacing.lg, gap: Spacing.sm, paddingBottom: Spacing.xl },
  empty: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60, gap: Spacing.md },
  emptyIcon: { fontSize: 48 },
  emptyTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  emptyText: { fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: 'center', paddingHorizontal: Spacing.xl },
  dateHeader: {
    fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: Colors.textSecondary,
    marginTop: Spacing.lg, marginBottom: Spacing.sm, textTransform: 'capitalize',
  },
  card: {
    backgroundColor: Colors.surface, borderRadius: Radius.xl, padding: Spacing.lg,
    borderWidth: 1, borderColor: Colors.border, ...Shadow.card, gap: Spacing.sm, marginBottom: Spacing.sm,
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  typeTag: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  typeEmoji: { fontSize: 16 },
  typeLabel: { fontSize: FontSize.xs, fontWeight: FontWeight.bold, color: Colors.textTertiary, textTransform: 'uppercase', letterSpacing: 0.5 },
  statutBadge: { paddingHorizontal: Spacing.sm, paddingVertical: 3, borderRadius: Radius.md, borderWidth: 1 },
  statutText: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold, color: Colors.textPrimary },
  titre: { fontSize: FontSize.base, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  sousTitre: { fontSize: FontSize.sm, color: Colors.textSecondary },
  datesRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  dateLabel: { fontSize: FontSize.sm, color: Colors.textTertiary, fontWeight: FontWeight.semibold },
  dateVal: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  dateSep: { fontSize: FontSize.base, color: Colors.textTertiary, marginHorizontal: 4 },
  autrePartie: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    backgroundColor: Colors.background, borderRadius: Radius.md,
    padding: Spacing.md, borderWidth: 1, borderColor: Colors.border,
  },
  miniAvatar: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  miniAvatarText: { fontSize: FontSize.sm, fontWeight: FontWeight.extrabold, color: '#fff' },
  autrePartieRole: { fontSize: FontSize.xs, color: Colors.textTertiary, fontWeight: FontWeight.semibold, textTransform: 'uppercase', letterSpacing: 0.4 },
  autrePartieNom: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  autrePartiePseudo: { fontSize: FontSize.xs, color: Colors.primary },
  chevronMsg: { fontSize: 20 },
  cardBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: Spacing.sm, marginTop: 4 },
  actionRow: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.sm },
  actionBtn: { flex: 1, paddingVertical: Spacing.sm + 2, borderRadius: Radius.md, alignItems: 'center', borderWidth: 1 },
  rejectBtn: { backgroundColor: Colors.background, borderColor: '#EF4444' },
  rejectBtnText: { color: '#EF4444', fontWeight: FontWeight.bold, fontSize: FontSize.sm },
  acceptBtn: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  acceptBtnText: { color: Colors.textInverse, fontWeight: FontWeight.bold, fontSize: FontSize.sm },
  montant: { fontSize: FontSize.base, fontWeight: FontWeight.extrabold, color: Colors.primary },
  avisBtn: { backgroundColor: '#FEF3C7', borderRadius: Radius.md, paddingHorizontal: Spacing.md, paddingVertical: 5, borderWidth: 1, borderColor: '#FCD34D' },
  avisBtnText: { fontSize: FontSize.xs, fontWeight: FontWeight.bold, color: '#92400E' },
  avisDoneBadge: { backgroundColor: Colors.surfaceVariant, borderRadius: Radius.md, paddingHorizontal: Spacing.md, paddingVertical: 5 },
  avisDoneText: { fontSize: FontSize.xs, color: Colors.textTertiary, fontWeight: FontWeight.semibold },
  escrowBox: { marginTop: Spacing.sm, borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: Spacing.sm, gap: 6 },
  escrowTop: { flexDirection: 'row' },
  escrowBadge: { borderRadius: Radius.md, paddingHorizontal: Spacing.md, paddingVertical: 4, borderWidth: 1 },
  escrowBadgeText: { fontSize: FontSize.xs, fontWeight: FontWeight.bold },
  escrowHint: { fontSize: FontSize.xs, color: Colors.textSecondary, lineHeight: 16 },
  escrowActions: { flexDirection: 'row', gap: Spacing.sm, marginTop: 4, flexWrap: 'wrap' },
  escrowBtnPrimary: { backgroundColor: Colors.primary, borderRadius: Radius.md, paddingHorizontal: Spacing.md, paddingVertical: 8, flexGrow: 1, alignItems: 'center' },
  escrowBtnPrimaryText: { fontSize: FontSize.xs, fontWeight: FontWeight.bold, color: '#FFFFFF' },
  escrowBtnGhost: { backgroundColor: Colors.surface, borderRadius: Radius.md, paddingHorizontal: Spacing.md, paddingVertical: 8, borderWidth: 1, borderColor: '#FCD34D', alignItems: 'center' },
  escrowBtnGhostText: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold, color: '#92400E' },
  escrowBtnDisabled: { opacity: 0.5 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: Colors.surface, borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl, padding: Spacing.xl, paddingBottom: 40 },
  modalTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.extrabold, color: Colors.textPrimary, textAlign: 'center', marginBottom: 4 },
  modalSubtitle: { fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: 'center', marginBottom: Spacing.lg },
  modalLabel: { fontSize: FontSize.xs, fontWeight: FontWeight.bold, color: Colors.textTertiary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: Spacing.sm, marginTop: Spacing.md },
  starsRow: { flexDirection: 'row', justifyContent: 'center', gap: Spacing.md, marginBottom: Spacing.md },
  starBtn: { padding: 8 },
  starIcon: { fontSize: 28 },
  commentInput: { borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, padding: Spacing.md, fontSize: FontSize.base, color: Colors.textPrimary, backgroundColor: Colors.surfaceVariant, height: 90, textAlignVertical: 'top', marginBottom: Spacing.lg },
  modalActions: { flexDirection: 'row', gap: Spacing.sm, marginTop: 4 },
  cancelBtn: { flex: 1, borderWidth: 1, borderColor: Colors.borderMedium, borderRadius: Radius.md, paddingVertical: Spacing.md, alignItems: 'center' },
  cancelText: { color: Colors.textSecondary, fontWeight: FontWeight.semibold },
  submitBtn: { flex: 1, backgroundColor: Colors.primary, borderRadius: Radius.md, paddingVertical: Spacing.md, alignItems: 'center' },
  submitText: { color: '#fff', fontWeight: FontWeight.bold },
});
