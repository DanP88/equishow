// ─────────────────────────────────────────────────────────────────────────────
// ChercheProposeHub — routeurs « Je cherche » / « Je propose » (depuis l'Accueil).
// 3 services de poids égal. Rattachement concours optionnel.
// Depuis une FICHE CONCOURS, on saute ce hub (ouverture directe du service
// avec ?concoursId=…). Cf. FicheConcoursV2.openService().
// ─────────────────────────────────────────────────────────────────────────────
import { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { Colors } from '../../constants/colors';
import { Spacing, FontSize, FontWeight } from '../../constants/theme';
import { Screen, Card, Chip } from '../ui/kit';
import { useConcoursList } from '../../hooks/useConcours';
import { useConcoursLocal } from '../state/concoursLocal';
import { useCapabilities } from '../capabilities';

export function ChercheProposeHub({ mode }: { mode: 'cherche' | 'propose' }) {
  const isCherche = mode === 'cherche';
  const { concours } = useConcoursList();
  const local = useConcoursLocal();
  const caps = useCapabilities();
  const [concoursId, setConcoursId] = useState<string | null>(null);

  const suivis = concours.filter((c) => local.followingIds.includes(c.id) || local.goingIds.includes(c.id)).slice(0, 6);

  const go = (kind: 'transport' | 'box' | 'coach') => {
    // Coaching depuis « Je propose » sans capacité coach → opt-in explicite.
    if (!isCherche && kind === 'coach' && !caps.has('coach')) {
      router.push('/(v2)/coach-optin' as any);
      return;
    }
    const q = concoursId ? `?concoursId=${concoursId}&face=${isCherche ? 'cherche' : 'propose'}` : `?face=${isCherche ? 'cherche' : 'propose'}`;
    router.push(`/(v2)/service/${kind}${q}` as any);
  };

  const services: { kind: 'transport' | 'box' | 'coach'; icon: string; title: string; sub: string }[] = isCherche
    ? [
        { kind: 'transport', icon: '🚚', title: 'Un transport', sub: 'Une place pour mon cheval' },
        { kind: 'box', icon: '🏠', title: 'Un box', sub: 'Sur ou près d’un concours' },
        { kind: 'coach', icon: '🎓', title: 'Un coach', sub: 'Pour un concours ou en général' },
      ]
    : [
        { kind: 'transport', icon: '🚚', title: 'Des places dans mon van', sub: 'Un trajet vers un concours' },
        { kind: 'box', icon: '🏠', title: 'Un ou des box', sub: 'Que je n’utilise pas / que je loue' },
        { kind: 'coach', icon: '🎓', title: 'Du coaching', sub: caps.has('coach') ? 'Une annonce de coaching' : 'Nécessite d’activer l’activité Coach' },
      ];

  return (
    <Screen>
      <TouchableOpacity onPress={() => router.back()}><Text style={s.back}>← Retour</Text></TouchableOpacity>
      <Text style={s.h1}>{isCherche ? 'Je cherche…' : 'Je propose…'}</Text>

      {services.map((sv) => (
        <Card key={sv.kind} onPress={() => go(sv.kind)}>
          <Text style={s.title}>{sv.icon}  {sv.title}</Text>
          <Text style={s.sub}>{sv.sub}</Text>
        </Card>
      ))}

      <Text style={s.section}>{isCherche ? 'Lié à un concours ?' : 'Rattacher à un concours ?'}</Text>
      <View style={s.chips}>
        <Chip label="Non / libre" on={concoursId === null} onPress={() => setConcoursId(null)} />
        {suivis.map((c) => (
          <Chip key={c.id} label={c.nom.length > 22 ? c.nom.slice(0, 22) + '…' : c.nom} on={concoursId === c.id} onPress={() => setConcoursId(c.id)} />
        ))}
      </View>
      {concoursId && <Text style={s.hint}>Destination et dates seront préremplies depuis ce concours.</Text>}
    </Screen>
  );
}

const s = StyleSheet.create({
  back: { fontSize: FontSize.sm, color: Colors.primary, fontWeight: FontWeight.bold },
  h1: { fontSize: FontSize.xxl, fontWeight: FontWeight.extrabold, color: Colors.textPrimary },
  title: { fontSize: FontSize.base, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  sub: { fontSize: FontSize.sm, color: Colors.textSecondary },
  section: { fontSize: FontSize.xs, fontWeight: FontWeight.bold, color: Colors.textTertiary, textTransform: 'uppercase', letterSpacing: 0.6, marginTop: Spacing.lg },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  hint: { fontSize: FontSize.xs, color: Colors.textSecondary, fontStyle: 'italic' },
});
