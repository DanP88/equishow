// ─────────────────────────────────────────────────────────────────────────────
// DevCapabilitiesPanel — outil DEV pour tester les combinaisons de capacités.
//
// Permet de forcer n'importe quel set de capacités SANS toucher au vrai
// `users.role` (aucun change_user_role, aucune écriture PROD). Sert de banc
// d'essai à toutes les surfaces V2 des LOTS suivants.
//
// 7 presets = les 7 combinaisons demandées. Toggles individuels + simulation de
// l'approbation organisateur + reset vers le vrai rôle.
// ─────────────────────────────────────────────────────────────────────────────
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, SafeAreaView } from 'react-native';
import { Colors } from '../../constants/colors';
import { Spacing, Radius, FontSize, FontWeight, Shadow } from '../../constants/theme';
import {
  ALL_CAPABILITIES, CAPABILITY_COLOR, CAPABILITY_LABEL, CAPABILITY_PRESETS, useCapabilities,
} from '../capabilities';

export function DevCapabilitiesPanel() {
  const c = useCapabilities();

  const activeKey = CAPABILITY_PRESETS.find(
    (p) => p.caps.length === c.held.length && p.caps.every((x) => c.held.includes(x)),
  )?.key;

  return (
    <SafeAreaView style={s.root}>
      <ScrollView contentContainerStyle={s.body}>
        <Text style={s.kicker}>DEV · Capacités V2</Text>
        <Text style={s.title}>Banc d’essai omni-activités</Text>

        {/* État courant */}
        <View style={s.stateCard}>
          <Row k="Vrai rôle backend" v={c.realRole} sub="lecture seule — jamais modifié" />
          <Row k="Source de l’état" v={c.source} />
          <Row k="Capacités actives" v={c.capabilities.map((x) => CAPABILITY_LABEL[x]).join(' · ') || '—'} />
          <Row
            k="En attente"
            v={ALL_CAPABILITIES.filter((x) => c.isPending(x)).map((x) => CAPABILITY_LABEL[x]).join(' · ') || '—'}
          />
          <Row k="Multi-capacité ?" v={c.isMultiCapability ? 'oui' : 'non'} />
          <Row k="Hydraté ?" v={c.ready ? 'oui' : '…'} />
        </View>

        {/* Presets */}
        <Text style={s.section}>Les 7 combinaisons</Text>
        <View style={s.presetGrid}>
          {CAPABILITY_PRESETS.map((p) => {
            const on = p.key === activeKey;
            return (
              <TouchableOpacity
                key={p.key}
                style={[s.preset, on && s.presetOn]}
                onPress={() => c.setExact(p.caps)}
                activeOpacity={0.85}
              >
                <Text style={[s.presetTxt, on && s.presetTxtOn]}>{p.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Toggles individuels */}
        <Text style={s.section}>Toggles individuels</Text>
        {ALL_CAPABILITIES.map((cap) => {
          const st = c.status(cap);
          return (
            <View key={cap} style={s.toggleRow}>
              <View style={[s.dot, { backgroundColor: CAPABILITY_COLOR[cap] }]} />
              <Text style={s.toggleLabel}>{CAPABILITY_LABEL[cap]}</Text>
              <Text style={s.toggleStatus}>{st ?? '—'}</Text>
              {st ? (
                <TouchableOpacity style={s.miniBtn} onPress={() => c.remove(cap)}>
                  <Text style={s.miniBtnTxt}>Retirer</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity style={s.miniBtn} onPress={() => c.request(cap)}>
                  <Text style={s.miniBtnTxt}>Ajouter</Text>
                </TouchableOpacity>
              )}
            </View>
          );
        })}

        {/* Actions */}
        <Text style={s.section}>Actions simulées</Text>
        <TouchableOpacity style={s.actionBtn} onPress={c.approveOrganisateur} disabled={!c.isPending('organisateur')}>
          <Text style={[s.actionTxt, !c.isPending('organisateur') && s.actionTxtOff]}>
            ✓ Simuler l’approbation admin « Organisateur »
          </Text>
        </TouchableOpacity>
        <TouchableOpacity style={[s.actionBtn, s.actionBtnDanger]} onPress={c.resetToReal}>
          <Text style={[s.actionTxt, { color: Colors.urgent }]}>↩︎ Reset — revenir au vrai rôle backend</Text>
        </TouchableOpacity>

        <Text style={s.footNote}>
          Aucun de ces boutons n’écrit en base : la simulation vit dans
          AsyncStorage (clé « v2:capabilities »), propre à cet appareil.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function Row({ k, v, sub }: { k: string; v: string; sub?: string }) {
  return (
    <View style={s.row}>
      <Text style={s.rowK}>{k}</Text>
      <View style={{ flex: 1, alignItems: 'flex-end' }}>
        <Text style={s.rowV}>{v}</Text>
        {sub ? <Text style={s.rowSub}>{sub}</Text> : null}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  body: { padding: Spacing.lg, gap: Spacing.md, paddingBottom: 60 },
  kicker: { fontSize: FontSize.xs, fontWeight: FontWeight.bold, color: Colors.urgent, textTransform: 'uppercase', letterSpacing: 0.5 },
  title: { fontSize: FontSize.xxl, fontWeight: FontWeight.extrabold, color: Colors.textPrimary },
  stateCard: { backgroundColor: Colors.surface, borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.border, padding: Spacing.md, ...Shadow.card },
  row: { flexDirection: 'row', gap: Spacing.md, paddingVertical: Spacing.xs + 2, borderBottomWidth: 1, borderBottomColor: Colors.border },
  rowK: { fontSize: FontSize.sm, color: Colors.textTertiary, fontWeight: FontWeight.semibold, width: 130 },
  rowV: { fontSize: FontSize.sm, color: Colors.textPrimary, fontWeight: FontWeight.bold },
  rowSub: { fontSize: FontSize.xs, color: Colors.textTertiary },
  section: { fontSize: FontSize.xs, fontWeight: FontWeight.bold, color: Colors.textTertiary, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: Spacing.sm },
  presetGrid: { gap: Spacing.sm },
  preset: { borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, paddingVertical: Spacing.md, paddingHorizontal: Spacing.md, backgroundColor: Colors.surface },
  presetOn: { borderColor: Colors.primary, backgroundColor: Colors.primaryLight, borderWidth: 2 },
  presetTxt: { fontSize: FontSize.base, fontWeight: FontWeight.semibold, color: Colors.textSecondary },
  presetTxtOn: { color: Colors.primary, fontWeight: FontWeight.bold },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, backgroundColor: Colors.surface, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border, paddingVertical: Spacing.sm + 2, paddingHorizontal: Spacing.md },
  dot: { width: 10, height: 10, borderRadius: 5 },
  toggleLabel: { fontSize: FontSize.base, fontWeight: FontWeight.semibold, color: Colors.textPrimary, flex: 1 },
  toggleStatus: { fontSize: FontSize.xs, color: Colors.textTertiary, fontWeight: FontWeight.semibold, marginRight: Spacing.sm },
  miniBtn: { borderWidth: 1, borderColor: Colors.primary, borderRadius: Radius.sm, paddingHorizontal: Spacing.sm, paddingVertical: 4 },
  miniBtnTxt: { fontSize: FontSize.xs, color: Colors.primary, fontWeight: FontWeight.bold },
  actionBtn: { borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, padding: Spacing.md, backgroundColor: Colors.surface },
  actionBtnDanger: { borderColor: Colors.urgentBorder, backgroundColor: Colors.urgentBg },
  actionTxt: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: Colors.primary },
  actionTxtOff: { color: Colors.textTertiary },
  footNote: { fontSize: FontSize.xs, color: Colors.textTertiary, fontStyle: 'italic', lineHeight: 17, marginTop: Spacing.sm },
});
