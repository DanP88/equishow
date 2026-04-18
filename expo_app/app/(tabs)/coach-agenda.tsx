import { useState, useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet, SafeAreaView, TouchableOpacity } from 'react-native';
import { useFocusEffect, router } from 'expo-router';
import { Colors } from '../../constants/colors';
import { Spacing, Radius, FontSize, FontWeight, Shadow } from '../../constants/theme';
import { coachAgendaStore, userStore } from '../../data/store';
import { CoachAgendaEvent } from '../../types/service';

export default function CoachAgendaScreen() {
  const [events, setEvents] = useState<CoachAgendaEvent[]>(coachAgendaStore.list);

  // Refresh quand on revient sur l'écran
  useFocusEffect(useCallback(() => {
    setEvents(coachAgendaStore.list.filter(e => e.coachId === userStore.id));
  }, []));

  // Trier les événements par date
  const sortedEvents = [...events].sort((a, b) => a.date.getTime() - b.date.getTime());

  // Grouper par date
  const eventsByDate: Map<string, CoachAgendaEvent[]> = new Map();
  sortedEvents.forEach(event => {
    const dateStr = event.date.toLocaleDateString('fr-FR', { weekday: 'short', day: '2-digit', month: 'short' }).charAt(0).toUpperCase() + event.date.toLocaleDateString('fr-FR', { weekday: 'short', day: '2-digit', month: 'short' }).slice(1);
    if (!eventsByDate.has(dateStr)) {
      eventsByDate.set(dateStr, []);
    }
    eventsByDate.get(dateStr)?.push(event);
  });

  return (
    <SafeAreaView style={s.root}>
      <View style={s.header}>
        <Text style={s.headerTitle}>Mon agenda</Text>
        {events.length > 0 && <Text style={s.eventCount}>{events.length}</Text>}
      </View>

      <ScrollView contentContainerStyle={s.container} scrollEnabled={true}>
        {events.length === 0 ? (
          <View style={s.emptyContainer}>
            <Text style={s.emptyIcon}>📅</Text>
            <Text style={s.emptyText}>Aucun événement planifié</Text>
          </View>
        ) : (
          Array.from(eventsByDate.entries()).map(([dateStr, dateEvents]) => (
            <View key={dateStr}>
              <Text style={s.dateHeader}>{dateStr}</Text>
              {dateEvents.map((event) => (
                <View key={event.id} style={s.eventCard}>
                  <View style={s.eventContent}>
                    <View style={s.eventHeader}>
                      <View style={[s.avatar, { backgroundColor: event.cavalierCouleur }]}>
                        <Text style={s.avatarText}>{event.cavalierNom.charAt(0)}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={s.eventTitle}>@{event.cavalierPseudo}</Text>
                        <Text style={s.eventSubtitle}>{event.titre}</Text>
                      </View>
                    </View>

                    {event.discipline && (
                      <Text style={s.detailText}>🎯 {event.discipline} · {event.niveau}</Text>
                    )}
                  </View>

                  <View style={s.footerSection}>
                    {event.concours && (
                      <Text style={s.concoursText}>🏆 {event.concours}</Text>
                    )}
                    <TouchableOpacity
                      style={s.contactBtnSmall}
                      activeOpacity={0.8}
                      onPress={() => router.push({
                        pathname: '/messagerie',
                        params: {
                          cavalierNom: event.cavalierNom,
                          cavalierPseudo: event.cavalierPseudo,
                          cavalierCouleur: event.cavalierCouleur,
                          titre: event.titre,
                        }
                      } as any)}
                    >
                      <Text style={s.contactBtnSmallText}>💬 Contacter</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  header: { padding: Spacing.lg, borderBottomWidth: 1, borderBottomColor: Colors.border, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  eventCount: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, backgroundColor: Colors.primary, color: Colors.textInverse, paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs, borderRadius: Radius.lg },
  container: { padding: Spacing.lg, gap: Spacing.md, paddingBottom: Spacing.xl },
  emptyContainer: { alignItems: 'center', justifyContent: 'center', paddingVertical: Spacing.xl },
  emptyIcon: { fontSize: 48, marginBottom: Spacing.md },
  emptyText: { fontSize: FontSize.base, color: Colors.textSecondary },

  dateHeader: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: Colors.textPrimary, marginBottom: Spacing.md, marginTop: Spacing.lg, textTransform: 'capitalize' },

  eventCard: { backgroundColor: Colors.surface, borderRadius: Radius.xl, padding: Spacing.lg, borderWidth: 1, borderColor: Colors.border, ...Shadow.card, gap: Spacing.md },
  eventContent: { gap: Spacing.sm },
  eventHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.md },
  avatar: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: FontSize.base, fontWeight: FontWeight.bold, color: Colors.textInverse },
  eventTitle: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  eventSubtitle: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: Spacing.xs },
  detailText: { fontSize: FontSize.sm, color: Colors.textSecondary },
  footerSection: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.sm, marginTop: Spacing.sm },
  concoursText: { fontSize: FontSize.sm, color: Colors.textSecondary, flex: 1 },
  contactBtnSmall: { backgroundColor: Colors.primary, borderRadius: Radius.lg, paddingVertical: Spacing.sm, paddingHorizontal: Spacing.md, alignItems: 'center' },
  contactBtnSmallText: { fontSize: FontSize.xs, fontWeight: FontWeight.bold, color: Colors.textInverse },
});
