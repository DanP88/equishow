// ─────────────────────────────────────────────────────────────────────────────
// v2/ui/kit — primitives d'interface partagées par les écrans V2 (F2).
//
// Objectif : des écrans courts, cohérents, mobile-first. Design intermédiaire
// (polish final = F11). Réutilise les tokens V1 (constants/colors, theme).
// ─────────────────────────────────────────────────────────────────────────────
import React from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, SafeAreaView,
} from 'react-native';
import { router } from 'expo-router';
import { Colors } from '../../constants/colors';
import { Spacing, Radius, FontSize, FontWeight, Shadow } from '../../constants/theme';

export const V2 = { Colors, Spacing, Radius, FontSize, FontWeight, Shadow };

// Enveloppe d'écran (scroll + safe area + padding bas pour la bottom bar).
export function Screen({ children, scroll = true }: { children: React.ReactNode; scroll?: boolean }) {
  const inner = <View style={k.screenInner}>{children}</View>;
  return (
    <SafeAreaView style={k.screen}>
      {scroll ? <ScrollView contentContainerStyle={k.scrollPad} keyboardShouldPersistTaps="handled">{inner}</ScrollView> : inner}
    </SafeAreaView>
  );
}

export function H1({ children }: { children: React.ReactNode }) {
  return <Text style={k.h1}>{children}</Text>;
}

export function Section({
  title, action, onAction, children, tight,
}: { title: string; action?: string; onAction?: () => void; children?: React.ReactNode; tight?: boolean }) {
  return (
    <View style={[k.section, tight && { marginTop: Spacing.md }]}>
      <View style={k.sectionHead}>
        <Text style={k.sectionTitle}>{title}</Text>
        {action ? <TouchableOpacity onPress={onAction}><Text style={k.sectionAction}>{action}</Text></TouchableOpacity> : null}
      </View>
      {children}
    </View>
  );
}

export function Card({ children, onPress, hero }: { children: React.ReactNode; onPress?: () => void; hero?: boolean }) {
  const Body = onPress ? TouchableOpacity : View;
  return <Body style={[k.card, hero && k.cardHero]} onPress={onPress} activeOpacity={0.85}>{children}</Body>;
}

export function Row({
  icon, label, value, onPress, right, danger,
}: { icon?: string; label: string; value?: string; onPress?: () => void; right?: React.ReactNode; danger?: boolean }) {
  const Body = onPress ? TouchableOpacity : View;
  return (
    <Body style={k.row} onPress={onPress} activeOpacity={0.7}>
      {icon ? <Text style={k.rowIcon}>{icon}</Text> : null}
      <Text style={[k.rowLabel, danger && { color: Colors.urgent }]}>{label}</Text>
      <View style={{ flex: 1 }} />
      {value ? <Text style={k.rowValue}>{value}</Text> : null}
      {right}
      {onPress ? <Text style={k.chev}>›</Text> : null}
    </Body>
  );
}

export function Chip({ label, on, onPress }: { label: string; on?: boolean; onPress?: () => void }) {
  return (
    <TouchableOpacity style={[k.chip, on && k.chipOn]} onPress={onPress} activeOpacity={0.8} disabled={!onPress}>
      <Text style={[k.chipTxt, on && k.chipTxtOn]}>{label}</Text>
    </TouchableOpacity>
  );
}

export function Segment({
  options, value, onChange,
}: { options: { key: string; label: string }[]; value: string; onChange: (k: string) => void }) {
  return (
    <View style={k.segment}>
      {options.map((o) => (
        <TouchableOpacity key={o.key} style={[k.segBtn, value === o.key && k.segBtnOn]} onPress={() => onChange(o.key)} activeOpacity={0.85}>
          <Text style={[k.segTxt, value === o.key && k.segTxtOn]}>{o.label}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

export function Tile({ icon, title, sub, onPress }: { icon: string; title: string; sub?: string; onPress?: () => void }) {
  return (
    <TouchableOpacity style={k.tile} onPress={onPress} activeOpacity={0.85}>
      <Text style={k.tileIcon}>{icon}</Text>
      <Text style={k.tileTitle}>{title}</Text>
      {sub ? <Text style={k.tileSub}>{sub}</Text> : null}
    </TouchableOpacity>
  );
}

export function EmptyState({ icon, title, body, ctaLabel, onCta }: { icon: string; title: string; body?: string; ctaLabel?: string; onCta?: () => void }) {
  return (
    <View style={k.empty}>
      <Text style={k.emptyIcon}>{icon}</Text>
      <Text style={k.emptyTitle}>{title}</Text>
      {body ? <Text style={k.emptyBody}>{body}</Text> : null}
      {ctaLabel ? <TouchableOpacity style={k.btn} onPress={onCta}><Text style={k.btnTxt}>{ctaLabel}</Text></TouchableOpacity> : null}
    </View>
  );
}

// Encart « cette partie sera détaillée au LOT Fx » + lien vers l'écran V1.
export function Placeholder({ note, v1Path, v1Label }: { note: string; v1Path?: string; v1Label?: string }) {
  return (
    <View style={k.ph}>
      <Text style={k.phTag}>PROTOTYPE F2 — structure</Text>
      <Text style={k.phNote}>{note}</Text>
      {v1Path ? (
        <TouchableOpacity style={k.phLink} onPress={() => router.push(v1Path as any)}>
          <Text style={k.phLinkTxt}>↗ {v1Label ?? 'Voir l’écran actuel (V1)'}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

export function PrimaryButton({ label, onPress, disabled }: { label: string; onPress?: () => void; disabled?: boolean }) {
  return (
    <TouchableOpacity style={[k.btn, disabled && k.btnOff]} onPress={onPress} disabled={disabled} activeOpacity={0.85}>
      <Text style={k.btnTxt}>{label}</Text>
    </TouchableOpacity>
  );
}
export function GhostButton({ label, onPress }: { label: string; onPress?: () => void }) {
  return (
    <TouchableOpacity style={k.btnGhost} onPress={onPress} activeOpacity={0.85}>
      <Text style={k.btnGhostTxt}>{label}</Text>
    </TouchableOpacity>
  );
}

const k = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.background },
  screenInner: { flex: 1 },
  scrollPad: { padding: Spacing.lg, paddingBottom: Spacing.xxxl, gap: Spacing.md },
  h1: { fontSize: FontSize.xxxl, fontWeight: FontWeight.extrabold, color: Colors.textPrimary },
  section: { gap: Spacing.sm, marginTop: Spacing.lg },
  sectionHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  sectionTitle: { fontSize: FontSize.xs, fontWeight: FontWeight.bold, color: Colors.textTertiary, textTransform: 'uppercase', letterSpacing: 0.6 },
  sectionAction: { fontSize: FontSize.sm, color: Colors.primary, fontWeight: FontWeight.bold },
  card: { backgroundColor: Colors.surface, borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.border, padding: Spacing.lg, gap: Spacing.sm, ...Shadow.card },
  cardHero: { borderColor: Colors.primaryBorder, backgroundColor: Colors.primaryLight },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, backgroundColor: Colors.surface, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border, paddingVertical: Spacing.sm + 4, paddingHorizontal: Spacing.md },
  rowIcon: { fontSize: 16 },
  rowLabel: { fontSize: FontSize.base, color: Colors.textPrimary, fontWeight: FontWeight.semibold },
  rowValue: { fontSize: FontSize.sm, color: Colors.textSecondary, fontWeight: FontWeight.semibold },
  chev: { fontSize: 20, color: Colors.textTertiary, marginLeft: 2 },
  chip: { paddingVertical: Spacing.xs + 2, paddingHorizontal: Spacing.md, borderRadius: 999, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.surface },
  chipOn: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  chipTxt: { fontSize: FontSize.sm, color: Colors.textSecondary, fontWeight: FontWeight.semibold },
  chipTxtOn: { color: Colors.textInverse },
  segment: { flexDirection: 'row', backgroundColor: Colors.surfaceVariant, borderRadius: Radius.md, padding: 3 },
  segBtn: { flex: 1, paddingVertical: Spacing.sm + 2, borderRadius: Radius.sm, alignItems: 'center' },
  segBtnOn: { backgroundColor: Colors.surface, ...Shadow.card },
  segTxt: { fontSize: FontSize.sm, color: Colors.textSecondary, fontWeight: FontWeight.semibold },
  segTxtOn: { color: Colors.textPrimary, fontWeight: FontWeight.bold },
  tile: { flex: 1, backgroundColor: Colors.surface, borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.border, padding: Spacing.md, gap: 3, ...Shadow.card },
  tileIcon: { fontSize: 20 },
  tileTitle: { fontSize: FontSize.base, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  tileSub: { fontSize: FontSize.xs, color: Colors.textSecondary },
  empty: { alignItems: 'center', gap: Spacing.sm, backgroundColor: Colors.surface, borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.border, borderStyle: 'dashed', padding: Spacing.xl },
  emptyIcon: { fontSize: 30 },
  emptyTitle: { fontSize: FontSize.base, fontWeight: FontWeight.bold, color: Colors.textPrimary, textAlign: 'center' },
  emptyBody: { fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: 'center', lineHeight: 19 },
  ph: { backgroundColor: Colors.warningBg, borderColor: Colors.warningBorder, borderWidth: 1, borderRadius: Radius.md, padding: Spacing.md, gap: 6 },
  phTag: { fontSize: FontSize.xs, fontWeight: FontWeight.bold, color: Colors.warning, letterSpacing: 0.5 },
  phNote: { fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 19 },
  phLink: { alignSelf: 'flex-start' },
  phLinkTxt: { fontSize: FontSize.sm, color: Colors.primary, fontWeight: FontWeight.bold },
  btn: { backgroundColor: Colors.primary, borderRadius: Radius.lg, paddingVertical: Spacing.md + 2, alignItems: 'center', paddingHorizontal: Spacing.lg },
  btnOff: { backgroundColor: Colors.borderMedium },
  btnTxt: { color: Colors.textInverse, fontWeight: FontWeight.extrabold, fontSize: FontSize.base },
  btnGhost: { borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.border, paddingVertical: Spacing.md + 2, alignItems: 'center' },
  btnGhostTxt: { color: Colors.textSecondary, fontWeight: FontWeight.bold, fontSize: FontSize.base },
});
