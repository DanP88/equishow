// ─────────────────────────────────────────────────────────────────────────────
// OnboardingV2 — nouvel onboarding OMNI-ACTIVITÉS (prototype F1).
//
// « Comment utilisez-vous EquiShow ? » → sélection MULTIPLE (1 à 3) :
//   Cavalier · Coach · Organisateur   (capacités simultanées, PAS des modes)
//
// Onboarding ADAPTATIF : les infos communes sont demandées UNE SEULE FOIS, puis
// une étape par capacité sélectionnée. Aucune info n'est redemandée.
//
// PHASE 1 — FRONT-ONLY :
//  - la sélection alimente useCapabilities() (store local) ;
//  - les champs sont sauvegardés en brouillon local (`v2:onboarding:draft`) —
//    AUCUN envoi Supabase, AUCUNE écriture PROD ;
//  - « Organisateur » → statut 'pending' + pop-up « email envoyé à l'admin »
//    (validation SIMULÉE, aucun email réel).
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useMemo, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, SafeAreaView, TextInput,
} from 'react-native';
import { Colors } from '../../constants/colors';
import { Spacing, Radius, FontSize, FontWeight, Shadow } from '../../constants/theme';
import { DISCIPLINES } from '../../lib/discipline';
import { REGIONS_FR } from '../../lib/regions';
import { useAuth } from '../../hooks/useAuth';
import { loadJSON, saveJSON } from '../lib/persist';
import {
  ALL_CAPABILITIES, Capability, CAPABILITY_COLOR, CAPABILITY_LABEL, CAPABILITY_TAGLINE,
} from '../capabilities';
import { useCapabilities } from '../capabilities';
import { OrganisateurPendingModal } from '../components/OrganisateurPendingModal';

const COACH_LEVELS = ['Club', 'Amateur', 'Pro', 'Poney'];

type Draft = {
  caps: Capability[];
  prenom: string; nom: string; telephone: string;
  region: string; disciplines: string[];
  coachLevels: string[]; coachTarif: string;
  orgStructure: string;
};

const EMPTY_DRAFT: Draft = {
  caps: [], prenom: '', nom: '', telephone: '',
  region: '', disciplines: [], coachLevels: [], coachTarif: '', orgStructure: '',
};

export function OnboardingV2({ onDone }: { onDone?: () => void }) {
  const { profile } = useAuth();
  const caps = useCapabilities();
  const [d, setD] = useState<Draft>(EMPTY_DRAFT);
  const [step, setStep] = useState(0);
  const [showOrgModal, setShowOrgModal] = useState(false);
  const [finished, setFinished] = useState(false);

  // Pré-remplissage depuis le vrai profil (lecture seule) + brouillon local.
  useEffect(() => {
    void (async () => {
      const saved = await loadJSON<Draft | null>('onboarding:draft', null);
      setD({
        ...EMPTY_DRAFT,
        ...(saved ?? {}),
        prenom: saved?.prenom || (profile as any)?.prenom || '',
        nom: saved?.nom || (profile as any)?.nom || '',
        region: saved?.region || (profile as any)?.region || '',
        disciplines: saved?.disciplines?.length ? saved.disciplines : ((profile as any)?.disciplines ?? []),
        caps: saved?.caps?.length ? saved.caps : (caps.held.length ? caps.held : []),
      });
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile]);

  const patch = (p: Partial<Draft>) => setD((prev) => {
    const next = { ...prev, ...p };
    void saveJSON('onboarding:draft', next);
    return next;
  });

  const toggleCap = (c: Capability) =>
    patch({ caps: d.caps.includes(c) ? d.caps.filter((x) => x !== c) : [...ALL_CAPABILITIES].filter((x) => d.caps.includes(x) || x === c) });

  const toggleIn = (key: 'disciplines' | 'coachLevels', v: string) =>
    patch({ [key]: d[key].includes(v) ? d[key].filter((x) => x !== v) : [...d[key], v] } as any);

  // ── Étapes adaptatives ────────────────────────────────────────────────────
  const steps = useMemo(() => {
    const s: { key: string; title: string }[] = [{ key: 'caps', title: 'Vos activités' }];
    if (d.caps.length > 0) s.push({ key: 'identite', title: 'Vos informations' });
    if (d.caps.includes('cavalier') || d.caps.includes('coach') || d.caps.includes('organisateur'))
      s.push({ key: 'profilCommun', title: 'Discipline & région' });
    if (d.caps.includes('coach')) s.push({ key: 'coach', title: 'Votre coaching' });
    if (d.caps.includes('organisateur')) s.push({ key: 'org', title: 'Votre structure' });
    s.push({ key: 'recap', title: 'Récapitulatif' });
    return s;
  }, [d.caps]);

  const current = steps[Math.min(step, steps.length - 1)];
  const isLast = step >= steps.length - 1;
  const canNext =
    current.key === 'caps' ? d.caps.length >= 1 :
    current.key === 'identite' ? d.prenom.trim() !== '' && d.nom.trim() !== '' :
    true;

  const finish = () => {
    const { organisateurPending } = caps.applyOnboarding(d.caps);
    void saveJSON('onboarding:draft', { ...d, completedAt: new Date().toISOString() });
    setFinished(true);
    if (organisateurPending) setShowOrgModal(true);
    else onDone?.();
  };

  return (
    <SafeAreaView style={s.root}>
      <View style={s.header}>
        <Text style={s.headerKicker}>Onboarding V2 · prototype</Text>
        <Text style={s.headerTitle}>{current.title}</Text>
        <View style={s.progress}>
          {steps.map((st, i) => (
            <View key={st.key} style={[s.progressDot, i <= step && s.progressDotOn]} />
          ))}
        </View>
      </View>

      <ScrollView contentContainerStyle={s.body} keyboardShouldPersistTaps="handled">
        {/* ÉTAPE 1 — ACTIVITÉS ------------------------------------------------ */}
        {current.key === 'caps' && (
          <>
            <Text style={s.lead}>Comment utilisez-vous EquiShow ?</Text>
            <Text style={s.sub}>Sélectionnez une ou plusieurs activités. Elles coexisteront — jamais besoin de « changer de mode ».</Text>
            {ALL_CAPABILITIES.map((c) => {
              const on = d.caps.includes(c);
              return (
                <TouchableOpacity key={c} style={[s.card, on && { borderColor: CAPABILITY_COLOR[c], borderWidth: 2 }]} activeOpacity={0.85} onPress={() => toggleCap(c)}>
                  <View style={[s.check, on && { backgroundColor: CAPABILITY_COLOR[c], borderColor: CAPABILITY_COLOR[c] }]}>
                    {on && <Text style={s.checkMark}>✓</Text>}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[s.cardTitle, on && { color: CAPABILITY_COLOR[c] }]}>{CAPABILITY_LABEL[c]}</Text>
                    <Text style={s.cardDesc}>{CAPABILITY_TAGLINE[c]}</Text>
                  </View>
                </TouchableOpacity>
              );
            })}
            {d.caps.includes('organisateur') && (
              <View style={s.note}>
                <Text style={s.noteTxt}>
                  ⓘ Le compte Organisateur est validé par l’équipe EquiShow. Un email sera envoyé pour vérification — vous pourrez utiliser vos autres activités immédiatement.
                </Text>
              </View>
            )}
          </>
        )}

        {/* ÉTAPE — IDENTITÉ (commune, une seule fois) ----------------------- */}
        {current.key === 'identite' && (
          <>
            <Text style={s.sub}>Ces informations sont communes à toutes vos activités — demandées une seule fois.</Text>
            <Field label="Prénom"><TextInput style={s.input} value={d.prenom} onChangeText={(v) => patch({ prenom: v })} placeholder="Prénom" placeholderTextColor={Colors.textTertiary} /></Field>
            <Field label="Nom"><TextInput style={s.input} value={d.nom} onChangeText={(v) => patch({ nom: v })} placeholder="Nom" placeholderTextColor={Colors.textTertiary} /></Field>
            <Field label="Téléphone"><TextInput style={s.input} value={d.telephone} onChangeText={(v) => patch({ telephone: v })} placeholder="06 …" keyboardType="phone-pad" placeholderTextColor={Colors.textTertiary} /></Field>
            <Text style={s.hint}>Photo de profil : étape gérée plus tard (prototype).</Text>
          </>
        )}

        {/* ÉTAPE — DISCIPLINE & RÉGION (commune cavalier/coach/org) -------- */}
        {current.key === 'profilCommun' && (
          <>
            <Text style={s.sub}>
              {d.caps.includes('cavalier') && d.caps.includes('coach')
                ? 'Vos disciplines (pratiquées et enseignées) et votre région.'
                : 'Votre discipline principale et votre région.'}
            </Text>
            {(d.caps.includes('cavalier') || d.caps.includes('coach')) && (
              <Field label="Disciplines">
                <ChipRow options={DISCIPLINES as unknown as string[]} selected={d.disciplines} onToggle={(v) => toggleIn('disciplines', v)} />
              </Field>
            )}
            <Field label="Région">
              <ChipRow options={REGIONS_FR.slice(0, 14)} selected={d.region ? [d.region] : []} onToggle={(v) => patch({ region: d.region === v ? '' : v })} />
            </Field>
          </>
        )}

        {/* ÉTAPE — COACH (delta uniquement) -------------------------------- */}
        {current.key === 'coach' && (
          <>
            <Text style={s.sub}>Informations spécifiques à votre activité de coach (vos disciplines sont déjà renseignées).</Text>
            <Field label="Niveaux encadrés">
              <ChipRow options={COACH_LEVELS} selected={d.coachLevels} onToggle={(v) => toggleIn('coachLevels', v)} />
            </Field>
            <Field label="Tarif indicatif (€ / séance)">
              <TextInput style={s.input} value={d.coachTarif} onChangeText={(v) => patch({ coachTarif: v })} placeholder="Ex. 45" keyboardType="decimal-pad" placeholderTextColor={Colors.textTertiary} />
            </Field>
          </>
        )}

        {/* ÉTAPE — ORGANISATEUR ------------------------------------------- */}
        {current.key === 'org' && (
          <>
            <Text style={s.sub}>Informations spécifiques à votre activité d’organisateur.</Text>
            <Field label="Nom de la structure / club">
              <TextInput style={s.input} value={d.orgStructure} onChangeText={(v) => patch({ orgStructure: v })} placeholder="Ex. Haras de …" placeholderTextColor={Colors.textTertiary} />
            </Field>
            <View style={s.note}>
              <Text style={s.noteTxt}>ⓘ Après validation, un email sera envoyé à l’équipe EquiShow. Votre compte organisateur sera actif une fois vérifié.</Text>
            </View>
          </>
        )}

        {/* ÉTAPE — RÉCAP ------------------------------------------------- */}
        {current.key === 'recap' && (
          <>
            <Text style={s.sub}>Vérifiez avant de terminer.</Text>
            <RecapRow label="Activités" value={d.caps.map((c) => CAPABILITY_LABEL[c]).join(' · ') || '—'} />
            <RecapRow label="Identité" value={`${d.prenom} ${d.nom}`.trim() || '—'} />
            {d.telephone ? <RecapRow label="Téléphone" value={d.telephone} /> : null}
            {(d.caps.includes('cavalier') || d.caps.includes('coach')) && <RecapRow label="Disciplines" value={d.disciplines.join(', ') || '—'} />}
            <RecapRow label="Région" value={d.region || '—'} />
            {d.caps.includes('coach') && <RecapRow label="Coach — niveaux" value={d.coachLevels.join(', ') || '—'} />}
            {d.caps.includes('coach') && d.coachTarif ? <RecapRow label="Coach — tarif" value={`${d.coachTarif} €`} /> : null}
            {d.caps.includes('organisateur') && <RecapRow label="Structure" value={d.orgStructure || '—'} />}
            {d.caps.includes('organisateur') && (
              <View style={s.note}><Text style={s.noteTxt}>⏳ Le compte Organisateur passera « en attente de validation ».</Text></View>
            )}
            {finished && (
              <View style={[s.note, { borderColor: Colors.success, backgroundColor: Colors.successBg }]}>
                <Text style={[s.noteTxt, { color: Colors.success }]}>
                  ✓ Capacités appliquées : {caps.capabilities.map((c) => CAPABILITY_LABEL[c]).join(' · ') || '—'}
                  {caps.isPending('organisateur') ? '  (+ Organisateur en attente)' : ''}
                </Text>
              </View>
            )}
          </>
        )}
      </ScrollView>

      <View style={s.footer}>
        {step > 0 && (
          <TouchableOpacity style={s.btnGhost} onPress={() => setStep((n) => Math.max(0, n - 1))}>
            <Text style={s.btnGhostTxt}>Retour</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={[s.btn, !canNext && s.btnDisabled]}
          disabled={!canNext}
          onPress={() => (isLast ? finish() : setStep((n) => n + 1))}
        >
          <Text style={s.btnTxt}>{isLast ? (finished ? 'Fermer' : 'Terminer') : 'Continuer'}</Text>
        </TouchableOpacity>
      </View>

      <OrganisateurPendingModal
        visible={showOrgModal}
        structure={d.orgStructure}
        onClose={() => { setShowOrgModal(false); onDone?.(); }}
      />
    </SafeAreaView>
  );
}

// ── petits composants locaux ────────────────────────────────────────────────
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={s.field}>
      <Text style={s.fieldLabel}>{label}</Text>
      {children}
    </View>
  );
}
function ChipRow({ options, selected, onToggle }: { options: string[]; selected: string[]; onToggle: (v: string) => void }) {
  return (
    <View style={s.chipRow}>
      {options.map((o) => {
        const on = selected.includes(o);
        return (
          <TouchableOpacity key={o} style={[s.chip, on && s.chipOn]} onPress={() => onToggle(o)} activeOpacity={0.8}>
            <Text style={[s.chipTxt, on && s.chipTxtOn]}>{o}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}
function RecapRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={s.recapRow}>
      <Text style={s.recapLabel}>{label}</Text>
      <Text style={s.recapValue}>{value}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  header: { padding: Spacing.lg, backgroundColor: Colors.surface, borderBottomWidth: 1, borderBottomColor: Colors.border, gap: Spacing.sm },
  headerKicker: { fontSize: FontSize.xs, fontWeight: FontWeight.bold, color: Colors.primary, textTransform: 'uppercase', letterSpacing: 0.5 },
  headerTitle: { fontSize: FontSize.xxl, fontWeight: FontWeight.extrabold, color: Colors.textPrimary },
  progress: { flexDirection: 'row', gap: 6, marginTop: 4 },
  progressDot: { width: 22, height: 4, borderRadius: 2, backgroundColor: Colors.border },
  progressDotOn: { backgroundColor: Colors.primary },
  body: { padding: Spacing.lg, gap: Spacing.md, paddingBottom: 40 },
  lead: { fontSize: FontSize.xl, fontWeight: FontWeight.extrabold, color: Colors.textPrimary },
  sub: { fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 20 },
  hint: { fontSize: FontSize.xs, color: Colors.textTertiary, fontStyle: 'italic' },
  card: { flexDirection: 'row', gap: Spacing.md, alignItems: 'center', backgroundColor: Colors.surface, borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.border, padding: Spacing.lg, ...Shadow.card },
  check: { width: 24, height: 24, borderRadius: 7, borderWidth: 2, borderColor: Colors.borderMedium, alignItems: 'center', justifyContent: 'center' },
  checkMark: { color: '#fff', fontSize: 13, fontWeight: '800' },
  cardTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  cardDesc: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 2 },
  note: { backgroundColor: Colors.primaryLight, borderWidth: 1, borderColor: Colors.primaryBorder, borderRadius: Radius.md, padding: Spacing.md },
  noteTxt: { fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 19 },
  field: { gap: Spacing.xs },
  fieldLabel: { fontSize: FontSize.xs, fontWeight: FontWeight.bold, color: Colors.textTertiary, textTransform: 'uppercase', letterSpacing: 0.5 },
  input: { borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm + 4, fontSize: FontSize.base, color: Colors.textPrimary, backgroundColor: Colors.surface },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  chip: { paddingVertical: Spacing.sm, paddingHorizontal: Spacing.md, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.surface },
  chipOn: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  chipTxt: { fontSize: FontSize.sm, color: Colors.textSecondary, fontWeight: FontWeight.semibold },
  chipTxtOn: { color: Colors.textInverse },
  recapRow: { flexDirection: 'row', justifyContent: 'space-between', gap: Spacing.md, paddingVertical: Spacing.sm, borderBottomWidth: 1, borderBottomColor: Colors.border },
  recapLabel: { fontSize: FontSize.sm, color: Colors.textTertiary, fontWeight: FontWeight.semibold },
  recapValue: { fontSize: FontSize.sm, color: Colors.textPrimary, fontWeight: FontWeight.semibold, flexShrink: 1, textAlign: 'right' },
  footer: { flexDirection: 'row', gap: Spacing.md, padding: Spacing.lg, paddingBottom: 28, backgroundColor: Colors.surface, borderTopWidth: 1, borderTopColor: Colors.border },
  btn: { flex: 1, backgroundColor: Colors.primary, borderRadius: Radius.lg, paddingVertical: Spacing.md + 2, alignItems: 'center' },
  btnDisabled: { backgroundColor: Colors.borderMedium },
  btnTxt: { color: Colors.textInverse, fontWeight: FontWeight.extrabold, fontSize: FontSize.base },
  btnGhost: { paddingVertical: Spacing.md + 2, paddingHorizontal: Spacing.lg, borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.border, alignItems: 'center' },
  btnGhostTxt: { color: Colors.textSecondary, fontWeight: FontWeight.bold, fontSize: FontSize.base },
});
