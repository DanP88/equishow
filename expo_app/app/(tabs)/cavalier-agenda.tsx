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

type AgendaItem = {
  id: string;
  type: 'transport_buyer' | 'transport_seller' | 'box_buyer' | 'box_seller' | 'stage' | 'cours';
  titre: string;
  sous_titre: string;
  date: Date;
  dateFin?: Date;
  montant: number;
  statut: string;
  autrePartieNom?: string;
  autrePartiePseudo?: string;
};

function statutLabel(statut: string) {
  if (statut === 'paid') return { label: '● Réservé', bg: '#ECFDF5', border: '#10B981' };
  if (statut === 'accepted') return { label: '● Confirmé', bg: '#ECFDF5', border: '#10B981' };
  if (statut === 'pending') return { label: '● En attente', bg: '#FFF7ED', border: '#F59E0B' };
  if (statut === 'rejected') return { label: '● Refusé', bg: '#FEE2E2', border: '#EF4444' };
  return { label: statut, bg: Colors.surfaceVariant, border: Colors.border };
}

function typeEmoji(type: AgendaItem['type']) {
  if (type === 'transport_buyer' || type === 'transport_seller') return '🚐';
  if (type === 'box_buyer' || type === 'box_seller') return '🏠';
  if (type === 'stage') return '📚';
  if (type === 'cours') return '🎓';
  return '📅';
}

function typeLabel(type: AgendaItem['type']) {
  if (type === 'transport_buyer') return 'Transport réservé';
  if (type === 'transport_seller') return 'Transport proposé';
  if (type === 'box_buyer') return 'Box réservé';
  if (type === 'box_seller') return 'Box loué';
  if (type === 'stage') return 'Stage';
  if (type === 'cours') return 'Cours';
  return '';
}

export default function CavalierAgendaScreen() {
  const [items, setItems] = useState<AgendaItem[]>([]);

  useFocusEffect(useCallback(() => {
    const uid = userStore.id;
    const all: AgendaItem[] = [];

    // Transports où je suis l'acheteur
    transportReservationsStore.list
      .filter(r => r.buyerId === uid)
      .forEach(r => {
        const annonce = transportsStore.list.find(t => t.id === r.transportId);
        all.push({
          id: r.id,
          type: 'transport_buyer',
          titre: `${r.villeDepart} → ${r.villeArrivee}`,
          sous_titre: `${r.nbPlaces} place(s)`,
          date: annonce?.dateTrajet ?? r.dateCreation,
          montant: r.prixTotalTTC,
          statut: r.statut,
        });
      });

    // Transports où je suis le vendeur
    transportReservationsStore.list
      .filter(r => r.sellerId === uid)
      .forEach(r => {
        const annonce = transportsStore.list.find(t => t.id === r.transportId);
        all.push({
          id: r.id + '_seller',
          type: 'transport_seller',
          titre: `${r.villeDepart} → ${r.villeArrivee}`,
          sous_titre: `${r.nbPlaces} place(s)`,
          date: annonce?.dateTrajet ?? r.dateCreation,
          montant: r.prixTotalTTC,
          statut: r.statut,
        });
      });

    // Box où je suis l'acheteur
    boxReservationsStore.list
      .filter(r => r.buyerId === uid)
      .forEach(r => {
        all.push({
          id: r.id,
          type: 'box_buyer',
          titre: r.titre,
          sous_titre: `${r.nbNuits} nuit(s) · ${r.lieu}`,
          date: r.dateDebut,
          dateFin: r.dateFin,
          montant: r.prixTotalTTC,
          statut: r.statut,
        });
      });

    // Box où je suis le vendeur
    boxReservationsStore.list
      .filter(r => r.sellerId === uid)
      .forEach(r => {
        all.push({
          id: r.id + '_seller',
          type: 'box_seller',
          titre: r.titre,
          sous_titre: `${r.nbNuits} nuit(s) · ${r.lieu}`,
          date: r.dateDebut,
          dateFin: r.dateFin,
          montant: r.prixTotalTTC,
          statut: r.statut,
        });
      });

    // Stages réservés
    stageReservationsStore.list
      .filter(r => r.cavalierUserId === uid)
      .forEach(r => {
        const stage = coachStagesStore.list.find(s => s.id === r.stageId);
        all.push({
          id: r.id,
          type: 'stage',
          titre: r.stageTitre,
          sous_titre: `Coach : ${r.coachNom}`,
          date: stage?.dateDebut ?? r.dateReservation,
          dateFin: stage?.dateFin,
          montant: r.prixTotal,
          statut: r.statut,
        });
      });

    // Cours demandés
    courseDemandesStore.list
      .filter(r => r.cavalierUserId === uid)
      .forEach(r => {
        all.push({
          id: r.id,
          type: 'cours',
          titre: r.annonceTitre,
          sous_titre: `Coach : ${r.coachNom} · ${r.discipline} ${r.niveau}`,
          date: r.dateDebut,
          dateFin: r.dateFin,
          montant: r.prix,
          statut: r.statut,
        });
      });

    // Trier par date croissante
    all.sort((a, b) => a.date.getTime() - b.date.getTime());
    setItems(all);
  }, []));

  // Grouper par date
  const byDate = new Map<string, AgendaItem[]>();
  items.forEach(item => {
    const key = item.date.toLocaleDateString('fr-FR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
    const cap = key.charAt(0).toUpperCase() + key.slice(1);
    if (!byDate.has(cap)) byDate.set(cap, []);
    byDate.get(cap)!.push(item);
  });

  return (
    <SafeAreaView style={s.root}>
      <View style={s.header}>
        <Text style={s.headerTitle}>Mon agenda</Text>
        {items.length > 0 && (
          <Text style={s.countBadge}>{items.length}</Text>
        )}
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
                const st = statutLabel(item.statut);
                return (
                  <View key={item.id} style={s.card}>
                    <View style={s.cardTop}>
                      <View style={s.typeTag}>
                        <Text style={s.typeEmoji}>{typeEmoji(item.type)}</Text>
                        <Text style={s.typeLabel}>{typeLabel(item.type)}</Text>
                      </View>
                      <View style={[s.statutBadge, { backgroundColor: st.bg, borderColor: st.border }]}>
                        <Text style={s.statutText}>{st.label}</Text>
                      </View>
                    </View>

                    <Text style={s.titre}>{item.titre}</Text>
                    <Text style={s.sousTitre}>{item.sous_titre}</Text>

                    {item.dateFin && item.dateFin.getTime() !== item.date.getTime() && (
                      <Text style={s.dateRange}>
                        📅 {item.date.toLocaleDateString('fr-FR')} → {item.dateFin.toLocaleDateString('fr-FR')}
                      </Text>
                    )}

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
    borderWidth: 1, borderColor: Colors.border, ...Shadow.card, gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  typeTag: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  typeEmoji: { fontSize: 16 },
  typeLabel: { fontSize: FontSize.xs, fontWeight: FontWeight.bold, color: Colors.textTertiary, textTransform: 'uppercase', letterSpacing: 0.5 },
  statutBadge: { paddingHorizontal: Spacing.sm, paddingVertical: 3, borderRadius: Radius.md, borderWidth: 1 },
  statutText: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold, color: Colors.textPrimary },
  titre: { fontSize: FontSize.base, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  sousTitre: { fontSize: FontSize.sm, color: Colors.textSecondary },
  dateRange: { fontSize: FontSize.xs, color: Colors.textTertiary },
  cardBottom: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 4 },
  montant: { fontSize: FontSize.base, fontWeight: FontWeight.extrabold, color: Colors.primary },
});
