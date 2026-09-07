// ─────────────────────────────────────────────────────────────────────────────
// PreparerV2 — « Préparer mon concours » (F4 · F8 · F14).
//
// 5 cartes indépendantes, ordre FIXE : Cheval → Épreuves → Transport → Box → Coach
// (Transport/Box/Coach dépendent des chevaux choisis dans « Cheval »).
// Tout est LOCAL (useConcoursLocal) — AUCUNE écriture PROD.
//
// F14 :
//   · Épreuves = multi-sélection depuis les épreuves du concours (ou liste type
//     si le concours n'a rien publié — clairement marquée « simulation »).
//   · Transport/Box/Coach : défaut « À organiser » (jamais « Organisé ») +
//     sous-bloc « Pour quel(s) cheval(aux) ? » (sous-ensemble de la sélection).
//   · Le compteur X/5 ne monte que sur de vraies décisions.
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Colors } from '../../constants/colors';
import { Spacing, Radius, FontSize, FontWeight } from '../../constants/theme';
import { Screen, Card, Chip, PrimaryButton, GhostButton } from '../ui/kit';
import { PrepBar, StatePill } from '../ui/prep';
import { useConcours } from '../../hooks/useConcours';
import { useCapabilities } from '../capabilities';
import { useConcoursLocal, NeedChoice, NeedModule, needStatus, NEED_LABEL } from '../state/concoursLocal';
import { useV2AllHorses, useV2ContestHorses, horseSubtitle } from '../state/contestHorses';
import { epreuveOptions } from '../lib/epreuves';

// « À organiser » en premier — c'est l'état par défaut.
const BASE_STATES: NeedChoice[] = ['unset', 'searching', 'offering', 'done', 'none'];
const POSITIVE = new Set<NeedChoice>(['searching', 'offering', 'done']);

export function PreparerV2() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { concours } = useConcours(id);
  const caps = useCapabilities();
  const { entry, prep, update, toggleHorse, toggleModuleHorse, setModuleHorses } = useConcoursLocal(id);
  const pool = useV2AllHorses();
  const ch = useV2ContestHorses(id);

  const epr = epreuveOptions(concours);

  const openService = (kind: NeedModule, face: 'cherche' | 'propose') => {
    const q = new URLSearchParams({ concoursId: id, face });
    if (entry.chevalId) q.set('chevalId', entry.chevalId);
    const path = kind === 'transport' ? '/(v2)/transport' : kind === 'box' ? '/(v2)/box' : '/(v2)/coach';
    router.push(`${path}?${q.toString()}` as any);
  };

  const CHERCHE_LABEL: Record<NeedModule, string> = {
    transport: 'Ouvrir la recherche de transport',
    box: 'Ouvrir la recherche de box',
    coach: "Ouvrir la recherche d'un coach",
  };
  const PROPOSE_LABEL: Record<NeedModule, string> = {
    transport: 'Proposer des places dans mon van',
    box: 'Proposer un box',
    coach: 'Proposer du coaching',
  };

  const toggleEpreuve = (e: string) =>
    update({ epreuves: entry.epreuves.includes(e) ? entry.epreuves.filter((x) => x !== e) : [...entry.epreuves, e] });

  return (
    <Screen>
      <TouchableOpacity onPress={() => router.replace(`/(v2)/concours/${id}` as any)} hitSlop={8}>
        <Text style={s.back}>← {concours?.nom ?? 'Concours'}</Text>
      </TouchableOpacity>
      <Text style={s.h1}>Préparer mon concours</Text>
      <Text style={s.sub}>Complète ce que tu veux, dans l'ordre que tu veux.</Text>

      <Card><PrepBar score={prep.score} total={prep.total} /></Card>

      {/* 1 — CHEVAL (choix multi) */}
      <Card>
        <View style={s.cardHead}>
          <Text style={s.cardTitle}>🐴  Cheval</Text>
          <StatePill status={ch.hasSelection ? 'ready' : 'todo'} />
        </View>
        <Text style={s.hint}>Quels chevaux emmènes-tu à ce concours ? Plusieurs possibles — Transport, Box et Coach s'appuieront sur ce choix.</Text>
        {pool.all.length === 0 ? (
          <View style={s.empty}>
            <Text style={s.emptyTxt}>Tu n'as pas encore de cheval.</Text>
            <GhostButton label="Ajouter un cheval" onPress={() => router.push('/(v2)/chevaux/nouveau' as any)} />
          </View>
        ) : (
          <>
            <View style={{ gap: Spacing.sm }}>
              {pool.all.map((h) => {
                const on = ch.ids.includes(h.id);
                const sub = horseSubtitle(h);
                return (
                  <TouchableOpacity key={h.id} style={[s.checkRow, on && s.checkRowOn]} activeOpacity={0.85} onPress={() => toggleHorse(h.id)}>
                    <Text style={s.check}>{on ? '☑' : '☐'}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={s.checkName}>{h.nom}{h.src === 'local' ? '  · local' : ''}</Text>
                      {!!sub && <Text style={s.checkSub}>{sub}</Text>}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
            {ch.hasSelection && <Text style={s.selSummary}>✅ {ch.summary}</Text>}
            <GhostButton label="＋ Ajouter un cheval" onPress={() => router.push('/(v2)/chevaux/nouveau' as any)} />
          </>
        )}
      </Card>

      {/* 2 — ÉPREUVES (multi-sélection) */}
      <Card>
        <View style={s.cardHead}>
          <Text style={s.cardTitle}>📝  Épreuves</Text>
          <StatePill status={entry.epreuves.length ? 'ready' : 'todo'} />
        </View>
        <Text style={s.hint}>
          {epr.source === 'concours'
            ? `Épreuves proposées par ce concours${epr.discipline ? ` · ${epr.discipline}` : ''} — coche celles que tu prépares.`
            : `Ce concours n'a pas publié ses épreuves — liste type${epr.discipline ? ` (${epr.discipline})` : ''}, à confirmer sur la FFE.`}
        </Text>
        {epr.source === 'type' && <Text style={s.simTag}>simulation — pas les vraies épreuves du concours</Text>}

        {entry.epreuves.length > 0 && (
          <View style={s.opts}>
            {entry.epreuves.map((e) => (
              <Chip key={e} label={`${e}  ✕`} on onPress={() => toggleEpreuve(e)} />
            ))}
          </View>
        )}

        <View style={{ gap: 6, marginTop: Spacing.sm }}>
          {epr.list.map((e) => {
            const on = entry.epreuves.includes(e);
            return (
              <TouchableOpacity key={e} style={[s.checkRow, on && s.checkRowOn]} activeOpacity={0.85} onPress={() => toggleEpreuve(e)}>
                <Text style={s.check}>{on ? '☑' : '☐'}</Text>
                <Text style={s.checkName}>{e}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </Card>

      {/* 3·4·5 — TRANSPORT / BOX / COACH */}
      <ServiceCard kind="transport" icon="🚚" title="Transport" field="needTransport"
        entry={entry} ch={ch} caps={caps} update={update}
        toggleModuleHorse={toggleModuleHorse} setModuleHorses={setModuleHorses}
        onAction={openService} chercheLabel={CHERCHE_LABEL.transport} proposeLabel={PROPOSE_LABEL.transport} />
      <ServiceCard kind="box" icon="🏠" title="Box" field="needBox"
        entry={entry} ch={ch} caps={caps} update={update}
        toggleModuleHorse={toggleModuleHorse} setModuleHorses={setModuleHorses}
        onAction={openService} chercheLabel={CHERCHE_LABEL.box} proposeLabel={PROPOSE_LABEL.box} />
      <ServiceCard kind="coach" icon="🎓" title="Coach" field="needCoach"
        entry={entry} ch={ch} caps={caps} update={update}
        toggleModuleHorse={toggleModuleHorse} setModuleHorses={setModuleHorses}
        onAction={openService} chercheLabel={CHERCHE_LABEL.coach} proposeLabel={PROPOSE_LABEL.coach} />

      <PrimaryButton label={prep.score === prep.total ? 'Terminé — retour à la fiche' : 'Enregistrer et revenir'} onPress={() => router.replace(`/(v2)/concours/${id}` as any)} />
    </Screen>
  );
}

// ── Carte service (Transport / Box / Coach) ─────────────────────────────────
function ServiceCard({
  kind, icon, title, field, entry, ch, caps, update, toggleModuleHorse, setModuleHorses,
  onAction, chercheLabel, proposeLabel,
}: {
  kind: NeedModule;
  icon: string;
  title: string;
  field: 'needTransport' | 'needBox' | 'needCoach';
  entry: any;
  ch: ReturnType<typeof useV2ContestHorses>;
  caps: ReturnType<typeof useCapabilities>;
  update: (patch: any) => void;
  toggleModuleHorse: (m: NeedModule, horseId: string) => void;
  setModuleHorses: (m: NeedModule, ids: string[]) => void;
  onAction: (m: NeedModule, face: 'cherche' | 'propose') => void;
  chercheLabel: string;
  proposeLabel: string;
}) {
  const val: NeedChoice = entry[field];
  const states = BASE_STATES.filter((st) => !(st === 'offering' && kind === 'coach' && !caps.has('coach')));
  const doneLabel = kind === 'coach' ? 'Coach prévu' : 'Organisé';
  const moduleIds: string[] = entry.horsesByNeed?.[kind] ?? [];
  const needsHorsePick = POSITIVE.has(val) && ch.count > 0;

  // Un seul cheval au concours → pré-sélectionné pour le module (F14).
  useEffect(() => {
    if (needsHorsePick && ch.count === 1 && moduleIds.length === 0) {
      setModuleHorses(kind, [ch.ids[0]]);
    }
  }, [needsHorsePick, ch.count, ch.ids, moduleIds.length, kind, setModuleHorses]);

  return (
    <Card>
      <View style={s.cardHead}>
        <Text style={s.cardTitle}>{icon}  {title}</Text>
        <StatePill status={needStatus(val)} />
      </View>

      <View style={s.opts}>
        {states.map((st) => (
          <Chip key={st} label={st === 'done' ? doneLabel : NEED_LABEL[st]} on={val === st} onPress={() => update({ [field]: st })} />
        ))}
      </View>

      {ch.count === 0 && POSITIVE.has(val) && (
        <Text style={s.hint}>Sélectionne d'abord le ou les chevaux concernés par ce concours (bloc « Cheval »).</Text>
      )}

      {needsHorsePick && (
        <View style={s.horsePick}>
          <Text style={s.horsePickTitle}>Pour quel(s) cheval(aux) ?</Text>
          {ch.horses.map((h) => {
            const on = moduleIds.includes(h.id);
            return (
              <TouchableOpacity key={h.id} style={[s.checkRow, on && s.checkRowOn]} activeOpacity={0.85} onPress={() => toggleModuleHorse(kind, h.id)}>
                <Text style={s.check}>{on ? '☑' : '☐'}</Text>
                <Text style={s.checkName}>{h.nom}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      {val === 'searching' && (
        <PrimaryButton label={`🔎  ${chercheLabel}`} onPress={() => onAction(kind, 'cherche')} />
      )}
      {val === 'offering' && (
        <PrimaryButton label={`📣  ${proposeLabel}`} onPress={() => onAction(kind, 'propose')} />
      )}
    </Card>
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
  simTag: { fontSize: FontSize.xs, color: Colors.warning, fontWeight: FontWeight.bold },
  empty: { gap: Spacing.sm },
  emptyTxt: { fontSize: FontSize.sm, color: Colors.textSecondary },

  checkRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm + 2, backgroundColor: Colors.surface },
  checkRowOn: { borderColor: Colors.primaryBorder, backgroundColor: Colors.primaryLight },
  check: { fontSize: 18, color: Colors.primary },
  checkName: { fontSize: FontSize.base, fontWeight: FontWeight.semibold, color: Colors.textPrimary },
  checkSub: { fontSize: FontSize.xs, color: Colors.textTertiary, marginTop: 1 },
  selSummary: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: Colors.success },

  horsePick: { gap: 6, marginTop: Spacing.sm, borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: Spacing.sm },
  horsePickTitle: { fontSize: 11, fontWeight: FontWeight.bold, color: Colors.textTertiary, textTransform: 'uppercase', letterSpacing: 0.5 },
});
