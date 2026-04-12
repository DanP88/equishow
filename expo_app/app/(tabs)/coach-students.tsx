import { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, SafeAreaView } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Colors } from '../../constants/colors';
import { Spacing, Radius, FontSize, FontWeight, CommonStyles } from '../../constants/theme';

const COACHING_STUDENTS = [
  { id: '1', nom: 'Sophie Martin', discipline: 'CSO', niveau: 'Club' },
  { id: '2', nom: 'Pierre Dupont', discipline: 'Dressage', niveau: 'Amateur' },
  { id: '3', nom: 'Marie Laurent', discipline: 'CSO', niveau: 'Pro' },
  { id: '4', nom: 'Jean Moreau', discipline: 'Hunter', niveau: 'Club' },
  { id: '5', nom: 'Lisa Bernard', discipline: 'CCE', niveau: 'Amateur' },
];

const PAST_STUDENTS = [
  { id: 'p1', nom: 'Thomas Renard', discipline: 'CSO', fin: '2025-12-15' },
  { id: 'p2', nom: 'Nathalie Petit', discipline: 'Dressage', fin: '2025-11-20' },
  { id: 'p3', nom: 'Claude Rousseau', discipline: 'Hunter', fin: '2025-10-30' },
  { id: 'p4', nom: 'Florence Gaston', discipline: 'CCE', fin: '2025-09-15' },
  { id: 'p5', nom: 'Michel Henry', discipline: 'CSO', fin: '2025-08-20' },
  { id: 'p6', nom: 'Céline Rouget', discipline: 'Dressage', fin: '2025-07-10' },
  { id: 'p7', nom: 'Olivier Blanc', discipline: 'Hunter', fin: '2025-06-25' },
  { id: 'p8', nom: 'Martine Lefevre', discipline: 'CSO', fin: '2025-05-30' },
  { id: 'p9', nom: 'André Mercier', discipline: 'CCE', fin: '2025-04-15' },
  { id: 'p10', nom: 'Isabelle Caron', discipline: 'Dressage', fin: '2025-03-20' },
  { id: 'p11', nom: 'Patrick Durand', discipline: 'CSO', fin: '2025-02-10' },
  { id: 'p12', nom: 'Sylvie Gille', discipline: 'Hunter', fin: '2024-12-30' },
];

export default function CoachStudentsScreen() {
  const params = useLocalSearchParams<{ tab?: string }>();
  const tab = typeof params.tab === 'string' ? params.tab : 'coaching';
  const isCoaching = tab === 'coaching';
  const data = isCoaching ? COACHING_STUDENTS : PAST_STUDENTS;

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
            style={[styles.tab, isCoaching && styles.tabActive]}
            onPress={() => router.push('/(tabs)/coach-students?tab=coaching')}
          >
            <Text style={[styles.tabText, isCoaching && styles.tabTextActive]}>En coaching</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, !isCoaching && styles.tabActive]}
            onPress={() => router.push('/(tabs)/coach-students?tab=past')}
          >
            <Text style={[styles.tabText, !isCoaching && styles.tabTextActive]}>Passé</Text>
          </TouchableOpacity>
        </View>

        {/* List */}
        <View style={styles.listContainer}>
          {data.map((student, idx) => (
            <View key={student.id}>
              <View style={styles.studentCard}>
                <View>
                  <Text style={styles.studentName}>{student.nom}</Text>
                  <View style={styles.details}>
                    <Text style={styles.detail}>{student.discipline}</Text>
                    {isCoaching && <Text style={styles.detail}>{(student as any).niveau}</Text>}
                    {!isCoaching && <Text style={styles.detail}>Fin: {(student as any).fin}</Text>}
                  </View>
                </View>
              </View>
              {idx < data.length - 1 && <View style={styles.divider} />}
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

  listContainer: { ...CommonStyles.card, overflow: 'hidden' },
  studentCard: { padding: Spacing.lg, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  studentName: { fontSize: FontSize.base, fontWeight: FontWeight.bold, color: Colors.textPrimary, marginBottom: Spacing.xs },
  details: { flexDirection: 'row', gap: Spacing.md },
  detail: { fontSize: FontSize.sm, color: Colors.textSecondary },
  divider: { height: 1, backgroundColor: Colors.border, marginHorizontal: Spacing.lg },
});
