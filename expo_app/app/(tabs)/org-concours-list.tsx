import { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, SafeAreaView } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Colors } from '../../constants/colors';
import { Spacing, Radius, FontSize, FontWeight, CommonStyles } from '../../constants/theme';

const EN_COURS = [
  { id: '1', nom: 'Grand Prix de Lyon', date: '2026-04-15', cavaliers: 45 },
  { id: '2', nom: 'Championnat Dressage', date: '2026-04-22', cavaliers: 32 },
];

const PASSE = [
  { id: 'p1', nom: 'Trophée CCE Automne', date: '2025-10-15', cavaliers: 67 },
  { id: 'p2', nom: 'Critérium CSO Été', date: '2025-08-20', cavaliers: 54 },
  { id: 'p3', nom: 'Challenge Dressage', date: '2025-07-10', cavaliers: 41 },
  { id: 'p4', nom: 'Open CSO Printemps', date: '2025-05-25', cavaliers: 78 },
  { id: 'p5', nom: 'Coupe Régionale', date: '2025-04-12', cavaliers: 89 },
  { id: 'p6', nom: 'Grand Critérium', date: '2025-03-08', cavaliers: 95 },
  { id: 'p7', nom: 'Challenge Hiver', date: '2025-02-20', cavaliers: 52 },
  { id: 'p8', nom: 'Championnat Régional', date: '2024-12-10', cavaliers: 110 },
  { id: 'p9', nom: 'Open Automne', date: '2024-11-05', cavaliers: 63 },
  { id: 'p10', nom: 'Coupe d\'Automne', date: '2024-10-20', cavaliers: 71 },
  { id: 'p11', nom: 'Challenge d\'Été', date: '2024-09-15', cavaliers: 58 },
  { id: 'p12', nom: 'Trophée Printemps', date: '2024-05-30', cavaliers: 82 },
  { id: 'p13', nom: 'Open Hiver', date: '2024-01-15', cavaliers: 46 },
  { id: 'p14', nom: 'Championnat National', date: '2023-11-20', cavaliers: 156 },
  { id: 'p15', nom: 'Grand Open d\'Été', date: '2023-08-10', cavaliers: 89 },
  { id: 'p16', nom: 'Coupe Nationale', date: '2023-06-25', cavaliers: 102 },
];

export default function OrgConcoursListScreen() {
  const { tab } = useLocalSearchParams<{ tab?: string }>();
  const isCurrent = (tab || 'en_cours') === 'en_cours';
  const data = isCurrent ? EN_COURS : PASSE;

  return (
    <SafeAreaView style={styles.root}>
      <ScrollView contentContainerStyle={styles.container}>
        {/* Header */}
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backBtn}>← Retour</Text>
        </TouchableOpacity>

        {/* Tabs */}
        <View style={styles.tabs}>
          <TouchableOpacity
            style={[styles.tab, isCurrent && styles.tabActive]}
            onPress={() => router.push('/(tabs)/org-concours-list?tab=en_cours')}
          >
            <Text style={[styles.tabText, isCurrent && styles.tabTextActive]}>En cours</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, !isCurrent && styles.tabActive]}
            onPress={() => router.push('/(tabs)/org-concours-list?tab=passe')}
          >
            <Text style={[styles.tabText, !isCurrent && styles.tabTextActive]}>Passé</Text>
          </TouchableOpacity>
        </View>

        {/* Stats */}
        <View style={styles.statsBox}>
          <View style={styles.stat}>
            <Text style={styles.statValue}>{data.length}</Text>
            <Text style={styles.statLabel}>{isCurrent ? 'En cours' : 'Organisés'}</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.stat}>
            <Text style={styles.statValue}>{data.reduce((sum, c) => sum + c.cavaliers, 0)}</Text>
            <Text style={styles.statLabel}>Cavaliers total</Text>
          </View>
        </View>

        {/* List */}
        <View style={styles.listContainer}>
          {data.map((concours, idx) => (
            <View key={concours.id}>
              <View style={styles.concoursCard}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.concoursName}>{concours.nom}</Text>
                  <View style={styles.details}>
                    <Text style={styles.detail}>📅 {new Date(concours.date).toLocaleDateString('fr-FR')}</Text>
                    <Text style={styles.detail}>🐴 {concours.cavaliers} cavaliers</Text>
                  </View>
                </View>
              </View>
              {idx < data.length - 1 && <View style={styles.separator} />}
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  container: { padding: Spacing.lg, paddingBottom: 100 },

  backBtn: { fontSize: FontSize.base, fontWeight: FontWeight.semibold, color: Colors.primary, marginBottom: Spacing.lg },

  tabs: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.lg },
  tab: { flex: 1, paddingVertical: Spacing.md, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: Colors.border },
  tabActive: { borderBottomColor: Colors.primary },
  tabText: { fontSize: FontSize.base, fontWeight: FontWeight.semibold, color: Colors.textSecondary },
  tabTextActive: { color: Colors.primary },

  statsBox: { flexDirection: 'row', gap: Spacing.md, marginBottom: Spacing.lg, backgroundColor: Colors.surface, padding: Spacing.lg, borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.border },
  stat: { flex: 1, alignItems: 'center' },
  statValue: { fontSize: FontSize.xxl, fontWeight: FontWeight.bold, color: Colors.primary },
  statLabel: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: Spacing.xs },
  divider: { width: 1, backgroundColor: Colors.border },

  listContainer: { ...CommonStyles.card, overflow: 'hidden' },
  concoursCard: { padding: Spacing.lg, flexDirection: 'row' },
  concoursName: { fontSize: FontSize.base, fontWeight: FontWeight.bold, color: Colors.textPrimary, marginBottom: Spacing.xs },
  details: { gap: Spacing.sm },
  detail: { fontSize: FontSize.sm, color: Colors.textSecondary },
  separator: { height: 1, backgroundColor: Colors.border, marginHorizontal: Spacing.lg },
});
