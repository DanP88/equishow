// ─────────────────────────────────────────────────────────────────────────────
// ChercheProposeHub — routeurs « Je cherche » / « Je propose » (depuis l'Accueil).
// 3 services de poids égal. Rattachement concours OPTIONNEL, jamais par défaut.
// Depuis une FICHE CONCOURS, on saute ce hub (ouverture directe avec ?concoursId=).
//
// F14.1 : « Lié à un concours » = menu déroulant (concours à venir réels) +
// « Autre » → saisie libre. Valeur initiale : AUCUN concours.
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { Colors } from '../../constants/colors';
import { Spacing, FontSize, FontWeight } from '../../constants/theme';
import { Screen, Card } from '../ui/kit';
import { V2SelectField } from '../components/V2SelectField';
import { V2HorsePicker } from '../components/V2HorsePicker';
import { useConcoursList } from '../../hooks/useConcours';
import { useConcoursLocal } from '../state/concoursLocal';
import { useV2AllHorses } from '../state/contestHorses';
import { useCapabilities } from '../capabilities';

const isUpcoming = (c: { date_fin: string | null; date_debut: string | null }) => {
  const d = c.date_fin ?? c.date_debut;
  if (!d) return true;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  return new Date(`${d}T00:00:00`).getTime() >= today.getTime();
};

export function ChercheProposeHub({ mode }: { mode: 'cherche' | 'propose' }) {
  const isCherche = mode === 'cherche';
  const { concours } = useConcoursList();
  const local = useConcoursLocal();
  const caps = useCapabilities();

  // Sélection concours : '' = aucun · un id = concours réel · texte libre = « Autre ».
  const [concoursSel, setConcoursSel] = useState('');

  const options = useMemo(() => {
    const up = concours.filter(isUpcoming);
    const followed = concours.filter((c) => local.followingIds.includes(c.id) || local.goingIds.includes(c.id));
    const seen = new Set<string>();
    return [...followed, ...up]
      .filter((c) => (seen.has(c.id) ? false : (seen.add(c.id), true)))
      .slice(0, 25)
      .map((c) => ({ value: c.id, label: c.nom }));
  }, [concours, local.followingIds, local.goingIds]);
  const knownIds = useMemo(() => new Set(options.map((o) => o.value)), [options]);
  const linkedConcoursId = concoursSel && knownIds.has(concoursSel) ? concoursSel : undefined;

  // ── Chevaux concernés par CETTE recherche (« Je cherche » uniquement) ──────
  const pool = useV2AllHorses();
  const prep = useConcoursLocal(linkedConcoursId);
  const [horseIds, setHorseIds] = useState<string[]>([]);
  const horsesTouched = useRef(false);

  useEffect(() => { horsesTouched.current = false; }, [concoursSel]);
  useEffect(() => {
    if (!isCherche || horsesTouched.current || !pool.ready) return;
    const valid = (l: string[]) => l.filter((id) => pool.byId(id));
    let next: string[] = [];
    if (linkedConcoursId && prep.ready) next = valid(prep.entry.selectedHorseIds ?? []);
    // sans concours : présélection SEULEMENT si un unique cheval au compte
    if (!next.length && !linkedConcoursId && pool.all.length === 1) next = [pool.all[0].id];
    setHorseIds(next);
  }, [isCherche, concoursSel, linkedConcoursId, prep.ready, pool.ready]);

  const go = (kind: 'transport' | 'box' | 'coach') => {
    if (!isCherche && kind === 'coach' && !caps.has('coach')) {
      router.push('/(v2)/coach-optin' as any);
      return;
    }
    const q = new URLSearchParams({ face: isCherche ? 'cherche' : 'propose' });
    if (concoursSel) {
      if (knownIds.has(concoursSel)) q.set('concoursId', concoursSel);
      else q.set('concoursNom', concoursSel);
    }
    if (isCherche && horseIds.length) q.set('chevalIds', horseIds.join(','));
    const path = kind === 'transport' ? '/(v2)/transport' : kind === 'box' ? '/(v2)/box' : '/(v2)/coach';
    router.push(`${path}?${q.toString()}` as any);
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

  const selLabel = concoursSel
    ? (options.find((o) => o.value === concoursSel)?.label ?? concoursSel)
    : null;

  return (
    <Screen>
      <TouchableOpacity onPress={() => router.back()}><Text style={s.back}>← Retour</Text></TouchableOpacity>
      <Text style={s.h1}>{isCherche ? 'Je cherche…' : 'Je propose…'}</Text>

      <Text style={s.section}>{isCherche ? 'Lié à un concours ?' : 'Rattacher à un concours ?'}</Text>
      <V2SelectField
        label="Concours (facultatif)"
        value={concoursSel}
        onChange={setConcoursSel}
        options={options}
        placeholder="Aucun concours"
        allowOther
        otherLabel="Autre concours (saisir le nom)"
      />
      {selLabel && <Text style={s.hint}>Destination et dates seront préremplies depuis « {selLabel} » quand elles sont connues.</Text>}

      {isCherche && (
        <>
          <Text style={[s.section, { marginTop: Spacing.lg }]}>Pour quel(s) cheval(aux) ?</Text>
          <V2HorsePicker
            value={horseIds}
            onChange={(v) => { horsesTouched.current = true; setHorseIds(v); }}
            title={null}
            hint={linkedConcoursId
              ? 'Chevaux de « Préparer mon concours » — ajuste pour cette recherche.'
              : 'Sélectionne le ou les chevaux concernés par cette recherche.'}
          />
        </>
      )}

      <Text style={[s.section, { marginTop: Spacing.lg }]}>{isCherche ? 'Que cherches-tu ?' : 'Que proposes-tu ?'}</Text>
      {services.map((sv) => (
        <Card key={sv.kind} onPress={() => go(sv.kind)}>
          <Text style={s.title}>{sv.icon}  {sv.title}</Text>
          <Text style={s.sub}>{sv.sub}</Text>
        </Card>
      ))}
    </Screen>
  );
}

const s = StyleSheet.create({
  back: { fontSize: FontSize.sm, color: Colors.primary, fontWeight: FontWeight.bold },
  h1: { fontSize: FontSize.xxl, fontWeight: FontWeight.extrabold, color: Colors.textPrimary },
  title: { fontSize: FontSize.base, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  sub: { fontSize: FontSize.sm, color: Colors.textSecondary },
  section: { fontSize: FontSize.xs, fontWeight: FontWeight.bold, color: Colors.textTertiary, textTransform: 'uppercase', letterSpacing: 0.6, marginTop: Spacing.lg },
  hint: { fontSize: FontSize.xs, color: Colors.textSecondary, fontStyle: 'italic', marginTop: 4 },
});
