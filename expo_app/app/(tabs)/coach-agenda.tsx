import { View, Text, ScrollView, StyleSheet, SafeAreaView, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { Colors } from '../../constants/colors';
import { Spacing, Radius, FontSize, FontWeight, Shadow } from '../../constants/theme';
import { userStore } from '../../data/store';
import { CoachAgendaEvent } from '../../types/service';
import { useMyCourseDemands } from '../../hooks/useCourseDemands';
import { useMyStageReservations, useStages } from '../../hooks/useStages';

export default function CoachAgendaScreen() {
  const { demands: courseDemands } = useMyCourseDemands();
  const { reservations: stageReservations } = useMyStageReservations();
  const { stages } = useStages();

  // Dérive l'agenda coach depuis les demandes/réservations acceptées ou
  // payées (statut accepted/paid). Un événement par jour pour les cours
  // multi-jours.
  const uid = userStore.id;
  const events: CoachAgendaEvent[] = [];

  courseDemands
    .filter(d => d.coachId === uid && (d.statut === 'accepted' || d.statut === 'paid' || d.statut === 'awaiting_payment'))
    .forEach(d => {
      const current = new Date(d.dateDebut);
      const end = new Date(d.dateFin);
      let i = 0;
      while (current <= end) {
        events.push({
          id: `${d.id}_${i++}`,
          coachId: uid,
          type: 'course',
          titre: d.annonceTitre,
          cavalierNom: d.cavalierNom,
          cavalierPseudo: d.cavalierPseudo,
          cavalierCouleur: d.cavalierCouleur,
          discipline: d.discipline,
          niveau: d.niveau,
          date: new Date(current),
          concours: d.concoursNom,
          description: d.message,
          prix: d.prix,
        });
        current.setDate(current.getDate() + 1);
      }
    });

  stageReservations
    .filter(r => r.coachId === uid && (r.statut === 'accepted' || r.statut === 'paid' || r.statut === 'awaiting_payment'))
    .forEach(r => {
      const stage = stages.find(s => s.id === r.stageId);
      events.push({
        id: r.id,
        coachId: uid,
        type: 'stage',
        titre: r.stageTitre,
        cavalierNom: r.cavalierNom,
        cavalierPseudo: r.cavalierPseudo,
        cavalierCouleur: r.cavalierCouleur,
        discipline: stage?.disciplines.join(', ') ?? '',
        niveau: stage?.niveaux.join(', ') ?? '',
        date: stage?.dateDebut ?? r.dateReservation,
        concours: undefined,
        description: r.message,
        prix: r.prixTotal,
      });
    });

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
