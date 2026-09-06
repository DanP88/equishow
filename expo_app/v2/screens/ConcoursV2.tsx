// ─────────────────────────────────────────────────────────────────────────────
// ConcoursV2 — onglet 🏆. Sous-onglets : Découvrir · Suivis · Organisés (ORG).
// FAB « ＋ Créer » visible si capacité organisateur.
// F2 = structure. Découverte = liste réelle (lecture seule useConcoursList).
// Suivis = état local simulé. Organisés = lecture réelle (useMyConcours).
// ─────────────────────────────────────────────────────────────────────────────
import { useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Colors } from '../../constants/colors';
import { Spacing, Radius, FontSize, FontWeight, Shadow } from '../../constants/theme';
import { Screen, H1, Segment, Row, RowGroup, Chip, EmptyState, Placeholder } from '../ui/kit';
import { useCapabilities } from '../capabilities';
import { useConcoursList, useMyConcours } from '../../hooks/useConcours';
import { useConcoursLocal } from '../state/concoursLocal';

function isUpcoming(c: { date_fin: string | null; date_debut: string | null }) {
  const d = c.date_fin ?? c.date_debut;
  if (!d) return true;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  return new Date(`${d}T00:00:00`).getTime() >= today.getTime();
}

export function ConcoursV2() {
  const params = useLocalSearchParams<{ tab?: string }>();
  const caps = useCapabilities();
  const { concours } = useConcoursList();
  const local = useConcoursLocal();
  const { concours: mine } = useMyConcours();

  const tabs = [
    { key: 'decouvrir', label: 'Découvrir' },
    { key: 'suivis', label: 'Suivis' },
    ...(caps.has('organisateur') ? [{ key: 'organises', label: 'Organisés' }] : []),
  ];
  const [tab, setTab] = useState<string>(
    params.tab && tabs.some((t) => t.key === params.tab) ? params.tab! : 'decouvrir',
  );
  const [when, setWhen] = useState<'avenir' | 'passes'>('avenir');

  const list = useMemo(() => {
    const base = when === 'avenir' ? concours.filter(isUpcoming) : concours.filter((c) => !isUpcoming(c));
    if (tab === 'suivis') return base.filter((c) => local.followingIds.includes(c.id) || local.goingIds.includes(c.id));
    return base;
  }, [concours, tab, when, local.followingIds, local.goingIds]);

  return (
    <Screen>
      <View style={s.head}>
        <H1>Concours</H1>
        {caps.has('organisateur') && (
          <TouchableOpacity style={s.fab} onPress={() => router.push('/(v2)/concours/creer' as any)}>
            <Text style={s.fabTxt}>＋ Créer</Text>
          </TouchableOpacity>
        )}
      </View>

      <Segment options={tabs} value={tab} onChange={setTab} />

      {tab !== 'organises' && (
        <View style={s.filterRow}>
          <Chip label="À venir" on={when === 'avenir'} onPress={() => setWhen('avenir')} />
          <Chip label="Passés" on={when === 'passes'} onPress={() => setWhen('passes')} />
        </View>
      )}

      {tab === 'organises' ? (
        <OrganisesTab mine={mine} />
      ) : list.length === 0 ? (
        <EmptyState
          icon="🏆"
          title={tab === 'suivis' ? 'Aucun concours suivi' : 'Aucun concours'}
          body={tab === 'suivis' ? 'Ouvre une fiche concours et appuie sur « Suivre » ou « J’y serai ».' : 'Essaie d’élargir les filtres.'}
        />
      ) : (
        <RowGroup>
          {list.slice(0, 40).map((c) => (
            <Row
              key={c.id}
              icon="🏆"
              label={c.nom}
              sub={[c.dateLabel, c.lieu].filter(Boolean).join(' · ') || undefined}
              onPress={() => router.push(`/(v2)/concours/${c.id}` as any)}
            />
          ))}
        </RowGroup>
      )}

      {tab === 'decouvrir' && (
        <Placeholder note="filtres discipline / région / dates et cartes détaillées = design F11" />
      )}
    </Screen>
  );
}

function OrganisesTab({ mine }: { mine: { id: string; nom: string; statut: string; dateLabel: string }[] }) {
  const [f, setF] = useState<'publie' | 'brouillon' | 'archive'>('publie');
  const shown = mine.filter((c) => c.statut === f);
  return (
    <View style={{ gap: Spacing.sm }}>
      <View style={s.filterRow}>
        {(['publie', 'brouillon', 'archive'] as const).map((k) => (
          <Chip key={k} label={k === 'publie' ? 'Publiés' : k === 'brouillon' ? 'Brouillons' : 'Archivés'} on={f === k} onPress={() => setF(k)} />
        ))}
      </View>
      {shown.length === 0 ? (
        <EmptyState icon="🏟" title="Rien ici" body="Vos concours créés apparaîtront ici. Utilisez « ＋ Créer »." />
      ) : (
        shown.map((c) => (
          <View key={c.id} style={s.orgCard}>
            <Text style={s.orgName}>🏟 {c.nom}</Text>
            <Text style={s.orgMeta}>{c.dateLabel} · {c.statut}</Text>
            <View style={s.orgActions}>
              <TouchableOpacity onPress={() => router.push(`/(v2)/concours/${c.id}` as any)}><Text style={s.orgAction}>📊 Radar / Fiche</Text></TouchableOpacity>
              <TouchableOpacity onPress={() => router.push(`/(v2)/concours/${c.id}` as any)}><Text style={s.orgAction}>✏️ Éditer</Text></TouchableOpacity>
            </View>
          </View>
        ))
      )}
      <Placeholder note="création / édition / publication rebranchées au lot org" v1Path="/(tabs)/org-concours" v1Label="gestion concours actuelle" />
    </View>
  );
}

const s = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  fab: { backgroundColor: Colors.primary, borderRadius: 999, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, ...Shadow.fab },
  fabTxt: { color: Colors.textInverse, fontWeight: FontWeight.extrabold, fontSize: FontSize.sm },
  filterRow: { flexDirection: 'row', gap: Spacing.sm, flexWrap: 'wrap' },
  orgCard: { backgroundColor: Colors.surface, borderRadius: 16, borderWidth: 1, borderColor: '#ECEBE7', padding: Spacing.lg, gap: 4 },
  orgName: { fontSize: FontSize.base, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  orgMeta: { fontSize: FontSize.sm, color: Colors.textSecondary },
  orgActions: { flexDirection: 'row', gap: Spacing.lg, marginTop: 8 },
  orgAction: { fontSize: FontSize.sm, color: Colors.primary, fontWeight: FontWeight.bold },
});
