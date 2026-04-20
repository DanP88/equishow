import { useState, useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet, SafeAreaView, TouchableOpacity } from 'react-native';
import { useFocusEffect, router } from 'expo-router';
import { Colors } from '../../constants/colors';
import { Spacing, Radius, FontSize, FontWeight, Shadow } from '../../constants/theme';
import {
  userStore,
  transportReservationsStore,
  boxReservationsStore,
  stageReservationsStore,
  courseDemandesStore,
  transportsStore,
  coachStagesStore,
} from '../../data/store';
import { getUserById } from '../../data/mockUsers';

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

export default function CavalierAgendaScreen() {
  const [items, setItems] = useState<AgendaItem[]>([]);

  useFocusEffect(useCallback(() => {
    const uid = userStore.id;
    const all: AgendaItem[] = [];

    // ── Transports acheteur ──
    transportReservationsStore.list
      .filter(r => r.buyerId === uid)
      .forEach(r => {
        const annonce = transportsStore.list.find(t => t.id === r.transportId);
        const seller = getUserById(r.sellerId) ?? {
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
    transportReservationsStore.list
      .filter(r => r.sellerId === uid)
      .forEach(r => {
        const annonce = transportsStore.list.find(t => t.id === r.transportId);
        const buyer = getUserById(r.buyerId) ?? {
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
    boxReservationsStore.list
      .filter(r => r.buyerId === uid)
      .forEach(r => {
        const seller = getUserById(r.sellerId);
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
    boxReservationsStore.list
      .filter(r => r.sellerId === uid)
      .forEach(r => {
        const buyer = getUserById(r.buyerId);
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
    stageReservationsStore.list
      .filter(r => r.cavalierUserId === uid)
      .forEach(r => {
        const stage = coachStagesStore.list.find(s => s.id === r.stageId);
        const coach = getUserById(r.coachId);
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
    courseDemandesStore.list
      .filter(r => r.cavalierUserId === uid)
      .forEach(r => {
        const coach = getUserById(r.coachId);
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
  }, []));

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
                        pathname: '/cavalier/[id]',
                        params: { id: item.autrePartieId },
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
                      <Text style={s.chevron}>›</Text>
                    </TouchableOpacity>

                    {/* Montant */}
                    <View style={s.cardBottom}>
                      <Text style={s.montant}>{item.montant.toFixed(2)}€ TTC</Text>
                    </View>
                  </View>
                );
              })}
            </View>
          ))
        )}
        <View style={{ height: 40 }} />
      </ScrollView>
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
  dateLabel: { fontSize: FontSize.xs, color: Colors.textTertiary, fontWeight: FontWeight.semibold },
  dateVal: { fontSize: FontSize.xs, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  dateSep: { fontSize: FontSize.xs, color: Colors.textTertiary, marginHorizontal: 2 },
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
  chevron: { fontSize: 22, color: Colors.textTertiary, fontWeight: FontWeight.bold },
  cardBottom: { flexDirection: 'row', justifyContent: 'flex-end', borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: Spacing.sm, marginTop: 4 },
  montant: { fontSize: FontSize.base, fontWeight: FontWeight.extrabold, color: Colors.primary },
});
