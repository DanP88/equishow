import { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, SafeAreaView, Switch,
} from 'react-native';
import { router } from 'expo-router';
import { Colors } from '../constants/colors';
import { Spacing, Radius, FontSize, FontWeight, Shadow } from '../constants/theme';

type NotifSetting = { id: string; icon: string; label: string; desc: string; enabled: boolean };

const SECTIONS: { title: string; items: NotifSetting[] }[] = [
  {
    title: 'Concours',
    items: [
      { id: 'heure_passage', icon: '⏰', label: 'Heure de passage', desc: 'Rappel 30 min avant votre passage', enabled: true },
      { id: 'resultats', icon: '🏆', label: 'Résultats en temps réel', desc: 'Notifié dès vos résultats disponibles', enabled: true },
      { id: 'modif_horaire', icon: '📋', label: 'Modification d\'horaire', desc: 'Si votre passage est modifié', enabled: true },
      { id: 'concours_region', icon: '🗺', label: 'Nouveaux concours', desc: 'Concours dans votre région et discipline', enabled: false },
    ],
  },
  {
    title: 'Services',
    items: [
      { id: 'new_transport', icon: '🚐', label: 'Transport disponible', desc: 'Nouvelles annonces de co-transport', enabled: false },
      { id: 'new_box', icon: '🏠', label: 'Box disponible', desc: 'Nouvelles annonces de box sur site', enabled: true },
      { id: 'new_coach', icon: '🎓', label: 'Coach disponible', desc: 'Coach disponible sur un de vos concours', enabled: true },
      { id: 'reservation', icon: '✅', label: 'Confirmation réservation', desc: 'Confirmation et rappels de réservation', enabled: true },
    ],
  },
  {
    title: 'Messagerie',
    items: [
      { id: 'new_message', icon: '💬', label: 'Nouveau message', desc: 'Notification dès réception d\'un message', enabled: true },
      { id: 'paiement', icon: '💳', label: 'Paiement reçu', desc: 'Confirmation de paiement Stripe', enabled: true },
    ],
  },
  {
    title: 'Communauté',
    items: [
      { id: 'likes', icon: '❤️', label: 'Likes sur mes posts', desc: 'Quand quelqu\'un aime votre publication', enabled: false },
      { id: 'commentaires', icon: '💬', label: 'Commentaires', desc: 'Réponses à vos publications', enabled: true },
    ],
  },
];

export default function NotificationsScreen() {
  const [settings, setSettings] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    SECTIONS.forEach((s) => s.items.forEach((item) => { init[item.id] = item.enabled; }));
    return init;
  });

  function toggle(id: string) {
    setSettings((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  const activeCount = Object.values(settings).filter(Boolean).length;

  return (
    <SafeAreaView style={s.root}>
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
          <Text style={s.backIcon}>‹</Text>
        </TouchableOpacity>
        <Text style={s.headerTitle}>Notifications</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={s.container}>
        <View style={s.summaryCard}>
          <Text style={s.summaryIcon}>🔔</Text>
          <Text style={s.summaryText}>{activeCount} notifications activées</Text>
        </View>

        {SECTIONS.map((section) => (
          <View key={section.title} style={s.section}>
            <Text style={s.sectionTitle}>{section.title}</Text>
            <View style={s.sectionCard}>
              {section.items.map((item, i) => (
                <View key={item.id} style={[s.row, i < section.items.length - 1 && s.rowBorder]}>
                  <Text style={s.rowIcon}>{item.icon}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={s.rowLabel}>{item.label}</Text>
                    <Text style={s.rowDesc}>{item.desc}</Text>
                  </View>
                  <Switch
                    value={settings[item.id]}
                    onValueChange={() => toggle(item.id)}
                    trackColor={{ false: Colors.border, true: Colors.primary }}
                    thumbColor={Colors.textInverse}
                  />
                </View>
              ))}
            </View>
          </View>
        ))}
        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: Spacing.lg, borderBottomWidth: 1, borderBottomColor: Colors.border, backgroundColor: Colors.surface },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.surfaceVariant, alignItems: 'center', justifyContent: 'center' },
  backIcon: { fontSize: 24, color: Colors.textPrimary, lineHeight: 28 },
  headerTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  container: { padding: Spacing.lg, gap: Spacing.lg },
  summaryCard: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, backgroundColor: Colors.primaryLight, borderRadius: Radius.xl, padding: Spacing.lg, borderWidth: 1, borderColor: Colors.primaryBorder },
  summaryIcon: { fontSize: 24 },
  summaryText: { fontSize: FontSize.base, fontWeight: FontWeight.semibold, color: Colors.primary },
  section: { gap: Spacing.sm },
  sectionTitle: { fontSize: FontSize.xs, fontWeight: FontWeight.bold, color: Colors.textTertiary, textTransform: 'uppercase', letterSpacing: 0.8, paddingHorizontal: Spacing.xs },
  sectionCard: { backgroundColor: Colors.surface, borderRadius: Radius.xl, borderWidth: 1, borderColor: Colors.border, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, padding: Spacing.lg },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: Colors.border },
  rowIcon: { fontSize: 20, width: 28 },
  rowLabel: { fontSize: FontSize.base, fontWeight: FontWeight.semibold, color: Colors.textPrimary },
  rowDesc: { fontSize: FontSize.xs, color: Colors.textTertiary, marginTop: 2 },
});
