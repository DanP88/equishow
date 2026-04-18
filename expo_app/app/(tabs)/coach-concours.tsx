import { useState, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, SafeAreaView, Alert } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Colors } from '../../constants/colors';
import { Spacing, Radius, FontSize, FontWeight, Shadow } from '../../constants/theme';
import { concoursStore, coachAnnoncesStore, userStore, courseDemandesStore, notificationsStore } from '../../data/store';
import { Concours } from '../../types/concours';

type Tab = 'disponibles' | 'mesAnnonces';

export default function CoachConcoursScreen() {
  const [tab, setTab] = useState<Tab>('disponibles');
  const [concours, setConcours] = useState<Concours[]>(
    concoursStore.list.filter(c => c.statut !== 'brouillon')
  );
  const [mesAnnonces, setMesAnnonces] = useState(
    coachAnnoncesStore.list.filter(a => a.auteurId === userStore.id)
  );

  useFocusEffect(useCallback(() => {
    setConcours(concoursStore.list.filter(c => c.statut !== 'brouillon'));
    setMesAnnonces(coachAnnoncesStore.list.filter(a => a.auteurId === userStore.id));
  }, []));

  const handleCreateAnnouncement = (concoursId: string) => {
    router.push(`/proposer-coach-annonce?concoursId=${concoursId}`);
  };

  const handleDeleteAnnonce = (annonceId: string) => {
    // Mettre à jour l'état d'abord
    const updated = mesAnnonces.filter(a => a.id !== annonceId);
    setMesAnnonces(updated);

    // Supprimer du store
    coachAnnoncesStore.list = coachAnnoncesStore.list.filter(a => a.id !== annonceId);

    // Supprimer les demandes associées
    courseDemandesStore.list = courseDemandesStore.list.filter(d => d.annonceId !== annonceId);

    // Supprimer les notifications associées
    notificationsStore.list = notificationsStore.list.filter(n =>
      !(n.donnees?.annonceId === annonceId)
    );
  };

  return (
    <SafeAreaView style={s.root}>
      <View style={s.header}>
        <Text style={s.headerTitle}>Concours</Text>
        <View style={s.tabs}>
          <TouchableOpacity
            style={[s.tab, tab === 'disponibles' && s.tabActive]}
            onPress={() => setTab('disponibles')}
          >
            <Text style={[s.tabText, tab === 'disponibles' && s.tabTextActive]}>Disponibles</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.tab, tab === 'mesAnnonces' && s.tabActive]}
            onPress={() => setTab('mesAnnonces')}
          >
            <Text style={[s.tabText, tab === 'mesAnnonces' && s.tabTextActive]}>Mes annonces ({mesAnnonces.length})</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView contentContainerStyle={s.container}>
        {tab === 'disponibles' ? (
          // Onglet Concours disponibles
          concours.length === 0 ? (
            <Text style={s.emptyText}>Aucun concours disponible pour le moment</Text>
          ) : (
            concours.map((c) => {
            const dateStr = `${c.dateDebut.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}-${c.dateFin.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}`;
            return (
              <View key={c.id} style={s.concoursCard}>
                <View style={s.concoursHeader}>
                  <Text style={s.concoursName}>{c.nom}</Text>
                  <View style={[s.statutBadge, { backgroundColor: Colors.successBg }]}>
                    <Text style={[s.statutText, { color: Colors.success }]}>
                      ● Ouvert
                    </Text>
                  </View>
                </View>
                <Text style={s.concoursDate}>📅 {dateStr} — {c.lieu}</Text>
                <Text style={s.concoursDetail}>{c.disciplines.join(', ')} • {c.typesCavaliers.join(', ')}</Text>

                {c.horaireDebut && (
                  <Text style={s.concoursHoraire}>🕐 {c.horaireDebut} - {c.horaireFin || '?'}</Text>
                )}

                <View style={s.concoursStats}>
                  <StatBadge label="Inscrits" value={`${c.nbInscrits}/${c.nbPlaces}`} />
                  {c.prix && <StatBadge label="Prix" value={`${c.prix}€`} />}
                </View>

                <TouchableOpacity
                  style={s.createBtn}
                  onPress={() => handleCreateAnnouncement(c.id)}
                  activeOpacity={0.8}
                >
                  <Text style={s.createBtnText}>Créer une annonce pour ce concours</Text>
                  <Text style={s.createArrow}>→</Text>
                </TouchableOpacity>
              </View>
            );
            })
          )
        ) : (
          // Onglet Mes annonces
          mesAnnonces.length === 0 ? (
            <Text style={s.emptyText}>Vous n'avez pas encore d'annonces publiées</Text>
          ) : (
            mesAnnonces.map((annonce) => (
              <View key={annonce.id} style={s.concoursCard}>
                <View style={s.concoursHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.concoursName}>{annonce.titre}</Text>
                    {annonce.concours && (
                      <Text style={s.concoursDate}>🏆 {annonce.concours}</Text>
                    )}
                  </View>
                </View>
                <Text style={s.concoursDetail}>{annonce.discipline} • {annonce.niveau}</Text>
                <Text style={s.concoursDate}>
                  📅 {annonce.dateDebut.toLocaleDateString('fr-FR')} - {annonce.dateFin.toLocaleDateString('fr-FR')}
                </Text>
                <Text style={s.concoursHoraire}>💰 {annonce.prixHeure}€ / heure</Text>
                {annonce.description && (
                  <Text style={s.concoursDetail} numberOfLines={2}>{annonce.description}</Text>
                )}

                <View style={s.actionButtons}>
                  <TouchableOpacity
                    style={[s.actionBtn, s.actionBtnEdit]}
                    onPress={() => router.push(`/proposer-coach-annonce?editAnnonceId=${annonce.id}`)}
                    activeOpacity={0.8}
                  >
                    <Text style={s.actionBtnText}>✏️ Modifier</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[s.actionBtn, s.actionBtnDelete]}
                    onPress={() => handleDeleteAnnonce(annonce.id)}
                    activeOpacity={0.8}
                  >
                    <Text style={s.actionBtnText}>🗑 Supprimer</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function StatBadge({ label, value }: { label: string; value: string }) {
  return (
    <View style={s.statBadge}>
      <Text style={s.statLabel}>{label}</Text>
      <Text style={s.statValue}>{value}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  header: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.lg, borderBottomWidth: 1, borderBottomColor: Colors.border },
  headerTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.textPrimary, marginBottom: Spacing.md },
  tabs: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.lg },
  tab: { flex: 1, paddingVertical: Spacing.sm, paddingHorizontal: Spacing.md, borderBottomWidth: 2, borderBottomColor: Colors.border, alignItems: 'center' },
  tabActive: { borderBottomColor: Colors.primary },
  tabText: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: Colors.textSecondary },
  tabTextActive: { color: Colors.primary },
  container: { padding: Spacing.lg, gap: Spacing.md },
  concoursCard: { backgroundColor: Colors.surface, borderRadius: Radius.xl, padding: Spacing.lg, borderWidth: 1, borderColor: Colors.border, ...Shadow.card },
  concoursHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: Spacing.sm },
  concoursName: { fontSize: FontSize.base, fontWeight: FontWeight.bold, color: Colors.textPrimary, flex: 1 },
  statutBadge: { borderRadius: Radius.xs, paddingHorizontal: Spacing.sm, paddingVertical: 3 },
  statutText: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold },
  concoursDate: { fontSize: FontSize.sm, color: Colors.textSecondary, marginBottom: Spacing.xs },
  concoursDetail: { fontSize: FontSize.sm, color: Colors.textTertiary, marginBottom: Spacing.md },
  concoursHoraire: { fontSize: FontSize.sm, color: Colors.textSecondary, marginBottom: Spacing.md },
  concoursStats: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.md },
  statBadge: { backgroundColor: Colors.surfaceVariant, borderRadius: Radius.sm, paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs },
  statLabel: { fontSize: FontSize.xs, color: Colors.textTertiary },
  statValue: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  createBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.primaryLight, borderRadius: Radius.lg, padding: Spacing.md, borderWidth: 1, borderColor: Colors.primaryBorder, gap: Spacing.md, justifyContent: 'space-between' },
  createBtnText: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: Colors.primary, flex: 1 },
  createArrow: { fontSize: 18, color: Colors.primary, fontWeight: FontWeight.bold },
  actionButtons: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.md },
  actionBtn: { flex: 1, paddingVertical: Spacing.sm + 2, borderRadius: Radius.md, alignItems: 'center' },
  actionBtnEdit: { backgroundColor: Colors.primaryLight, borderWidth: 1, borderColor: Colors.primary },
  actionBtnDelete: { backgroundColor: '#FEE2E2', borderWidth: 1, borderColor: '#FECACA' },
  actionBtnText: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold },
  emptyText: { fontSize: FontSize.sm, color: Colors.textTertiary, textAlign: 'center', marginTop: Spacing.xl },
});
