// ─────────────────────────────────────────────────────────────────────────────
// PreparerV2 — « Préparer mon concours » (LOT F4).
//
// PAS un formulaire : 5 CARTES indépendantes (Cheval · Épreuves · Transport ·
// Box · Coach), chacune montre son état et se complète sur place. Le compteur
// de préparation évolue en direct. Tout est LOCAL (useConcoursLocal) — AUCUNE
// écriture PROD, aucune inscription FFE fabriquée.
// ─────────────────────────────────────────────────────────────────────────────
import { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Colors } from '../../constants/colors';
import { Spacing, Radius, FontSize, FontWeight } from '../../constants/theme';
import { Screen, Card, Chip, PrimaryButton, GhostButton } from '../ui/kit';
import { PrepBar, StatePill } from '../ui/prep';
import { useConcours } from '../../hooks/useConcours';
import { useMyChevaux } from '../../hooks/useChevaux';
import { useCapabilities } from '../capabilities';
import { useConcoursLocal, NeedChoice, needStatus, NEED_LABEL } from '../state/concoursLocal';

// Options d'état par service. 'offering' conditionnel (cf. plus bas).
const BASE_STATES: NeedChoice[] = ['done', 'searching', 'offering', 'unset', 'none'];

export function PreparerV2() {
  const { id, focus } = useLocalSearchParams<{ id: string; focus?: string }>();
  const { concours } = useConcours(id);
  const { chevaux } = useMyChevaux();
  const caps = useCapabilities();
  const { entry, prep, update } = useConcoursLocal(id);
  const [epreuve, setEpreuve] = useState('');

  const openService = (kind: 'transport' | 'box' | 'coach', face: 'cherche' | 'propose') => {
    const q = new URLSearchParams({ concoursId: id, face });
    if (entry.chevalId) q.set('chevalId', entry.chevalId);
    // Transport (F5) = parcours dédié ; box/coach = écran service générique (F6/F7).
    const path = kind === 'transport' ? '/(v2)/transport' : `/(v2)/service/${kind}`;
    router.push(`${path}?${q.toString()}` as any);
  };

  // Libellés d'action exacts par service.
  const CHERCHE_LABEL: Record<'transport' | 'box' | 'coach', string> = {
    transport: '🔎  Ouvrir la recherche de transport',
    box: '🔎  Ouvrir la recherche de box',
    coach: "🔎  Ouvrir la recherche d'un coach",
  };
  const PROPOSE_LABEL: Record<'transport' | 'box' | 'coach', string> = {
    transport: '📣  Proposer des places dans mon van',
    box: '📣  Proposer un box',
    coach: '📣  Proposer du coaching',
  };

  const ServiceCard = ({
    kind, icon, title, field,
  }: { kind: 'transport' | 'box' | 'coach'; icon: string; title: string; field: 'needTransport' | 'needBox' | 'needCoach' }) => {
    const val = entry[field];
    // « Je propose du coaching » réservé aux détenteurs de l'activité Coach.
    const states = BASE_STATES.filter((st) => !(st === 'offering' && kind === 'coach' && !caps.has('coach')));
    const doneLabel = kind === 'coach' ? 'Coach prévu' : 'Organisé';
    return (
      <Card>
        <View style={s.cardHead}>
          <Text style={s.cardTitle}>{icon}  {title}</Text>
          <StatePill status={needStatus(val)} />
        </View>
        <View style={s.opts}>
          {states.map((st) => (
            <Chip key={st} label={st === 'done' ? doneLabel : NEED_LABEL[st]} on={val === st} onPress={() => update({ [field]: st } as any)} />
          ))}
        </View>
        {/* Bouton d'action — apparaît IMMÉDIATEMENT au choix (état local réactif). */}
        {val === 'searching' && (
          <PrimaryButton label={CHERCHE_LABEL[kind]} onPress={() => openService(kind, 'cherche')} />
        )}
        {val === 'offering' && (
          <PrimaryButton label={PROPOSE_LABEL[kind]} onPress={() => openService(kind, 'propose')} />
        )}
      </Card>
    );
  };

  return (
    <Screen>
      <TouchableOpacity onPress={() => router.replace(`/(v2)/concours/${id}` as any)} hitSlop={8}>
        <Text style={s.back}>← {concours?.nom ?? 'Concours'}</Text>
      </TouchableOpacity>
      <Text style={s.h1}>Préparer mon concours</Text>
      <Text style={s.sub}>Complète ce que tu veux, dans l'ordre que tu veux. {focus ? '' : ''}</Text>

      <Card><PrepBar score={prep.score} total={prep.total} /></Card>

      {/* 🐴 CHEVAL */}
      <Card>
        <View style={s.cardHead}>
          <Text style={s.cardTitle}>🐴  Cheval</Text>
          <StatePill status={entry.chevalId ? 'ready' : 'todo'} />
        </View>
        {chevaux.length === 0 ? (
          <View style={s.empty}>
            <Text style={s.emptyTxt}>Tu n'as pas encore de cheval.</Text>
            <GhostButton label="Ajouter un cheval" onPress={() => router.push('/(v2)/chevaux/nouveau' as any)} />
          </View>
        ) : (
          <View style={s.opts}>
            {chevaux.map((c) => (
              <Chip key={c.id} label={c.nom} on={entry.chevalId === c.id} onPress={() => update({ chevalId: entry.chevalId === c.id ? null : c.id })} />
            ))}
          </View>
        )}
      </Card>

      {/* 📝 ÉPREUVES */}
      <Card>
        <View style={s.cardHead}>
          <Text style={s.cardTitle}>📝  Épreuves</Text>
          <StatePill status={entry.epreuves.length ? 'ready' : 'todo'} />
        </View>
        <Text style={s.hint}>Saisie libre — Equishow n'accède pas aux engagements FFE.</Text>
        {entry.epreuves.length > 0 && (
          <View style={s.opts}>
            {entry.epreuves.map((e) => (
              <Chip key={e} label={`${e}  ✕`} on onPress={() => update({ epreuves: entry.epreuves.filter((x) => x !== e) })} />
            ))}
          </View>
        )}
        <View style={s.addRow}>
          <TextInput style={s.input} value={epreuve} onChangeText={setEpreuve} placeholder="Ex. Amateur 1" placeholderTextColor={Colors.textTertiary} onSubmitEditing={() => { if (epreuve.trim()) { update({ epreuves: [...entry.epreuves, epreuve.trim()] }); setEpreuve(''); } }} />
          <GhostButton label="Ajouter" onPress={() => { if (epreuve.trim()) { update({ epreuves: [...entry.epreuves, epreuve.trim()] }); setEpreuve(''); } }} />
        </View>
        {concours && concours.liste_epreuves.length > 0 && (
          <>
            <Text style={s.hint}>Épreuves du concours (référence) :</Text>
            <View style={s.opts}>
              {concours.liste_epreuves.slice(0, 8).map((e) => (
                <Chip key={e} label={e} on={entry.epreuves.includes(e)} onPress={() => update({ epreuves: entry.epreuves.includes(e) ? entry.epreuves.filter((x) => x !== e) : [...entry.epreuves, e] })} />
              ))}
            </View>
          </>
        )}
      </Card>

      <ServiceCard kind="transport" icon="🚚" title="Transport" field="needTransport" />
      <ServiceCard kind="box" icon="🏠" title="Box" field="needBox" />
      <ServiceCard kind="coach" icon="🎓" title="Coach" field="needCoach" />

      <PrimaryButton label={prep.score === prep.total ? 'Terminé — retour à la fiche' : 'Enregistrer et revenir'} onPress={() => router.replace(`/(v2)/concours/${id}` as any)} />
    </Screen>
  );
}

const s = StyleSheet.create({
  back: { fontSize: FontSize.sm, color: Colors.primary, fontWeight: FontWeight.bold },
  h1: { fontSize: 22, fontWeight: FontWeight.extrabold, color: Colors.textPrimary, marginTop: 4 },
  sub: { fontSize: FontSize.sm, color: Colors.textSecondary },
  cardHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardTitle: { fontSize: FontSize.base, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  opts: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  hint: { fontSize: FontSize.xs, color: Colors.textTertiary, fontStyle: 'italic' },
  empty: { gap: Spacing.sm },
  emptyTxt: { fontSize: FontSize.sm, color: Colors.textSecondary },
  addRow: { flexDirection: 'row', gap: Spacing.sm, alignItems: 'center' },
  input: { flex: 1, borderWidth: 1, borderColor: '#ECEBE7', borderRadius: Radius.md, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm + 2, fontSize: FontSize.base, color: Colors.textPrimary, backgroundColor: Colors.surface },
});
