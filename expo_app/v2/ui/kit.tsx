// ─────────────────────────────────────────────────────────────────────────────
// v2/ui/kit — primitives d'interface partagées par les écrans V2.
//
// Passe de PROPRETÉ visuelle (avant F11) : cartes légères, moins de bordures,
// orange réservé au CTA, encarts « prototype » réduits à une note discrète.
// Le polish final (iconographie, tokens, densité) reste le LOT F11.
// ─────────────────────────────────────────────────────────────────────────────
import React from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, SafeAreaView,
} from 'react-native';
import { router } from 'expo-router';
import { Colors } from '../../constants/colors';
import { Spacing, Radius, FontSize, FontWeight, Shadow } from '../../constants/theme';

export const V2 = { Colors, Spacing, Radius, FontSize, FontWeight, Shadow };

// Palette locale : neutres calmes + orange uniquement pour l'action primaire.
const C = {
  bg: Colors.background,
  card: Colors.surface,
  line: '#ECEBE7',        // hairline très douce
  ink: Colors.textPrimary,
  sub: Colors.textSecondary,
  faint: Colors.textTertiary,
  cta: Colors.primary,
  ctaSoft: Colors.primaryLight,
  ctaLine: Colors.primaryBorder,
};

export function Screen({ children, scroll = true }: { children: React.ReactNode; scroll?: boolean }) {
  const inner = <View style={k.screenInner}>{children}</View>;
  return (
    <SafeAreaView style={k.screen}>
      {scroll ? <ScrollView contentContainerStyle={k.scrollPad} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>{inner}</ScrollView> : inner}
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
        {action ? <TouchableOpacity onPress={onAction} hitSlop={8}><Text style={k.sectionAction}>{action}</Text></TouchableOpacity> : null}
      </View>
      {children}
    </View>
  );
}

export function Card({ children, onPress, hero, pad = true }: { children: React.ReactNode; onPress?: () => void; hero?: boolean; pad?: boolean }) {
  const Body = onPress ? TouchableOpacity : View;
  return <Body style={[k.card, pad && k.cardPad, hero && k.cardHero]} onPress={onPress} activeOpacity={0.9}>{children}</Body>;
}

// Groupe de lignes dans UNE carte (au lieu d'une bordure par ligne).
export function RowGroup({ children }: { children: React.ReactNode }) {
  const items = React.Children.toArray(children).filter(Boolean);
  return (
    <View style={k.card}>
      {items.map((c, i) => (
        <View key={i} style={i > 0 ? k.rowDivider : undefined}>{c}</View>
      ))}
    </View>
  );
}

export function Row({
  icon, label, value, onPress, right, danger, sub,
}: { icon?: string; label: string; value?: string; onPress?: () => void; right?: React.ReactNode; danger?: boolean; sub?: string }) {
  const Body = onPress ? TouchableOpacity : View;
  return (
    <Body style={k.row} onPress={onPress} activeOpacity={0.6}>
      {icon ? <Text style={k.rowIcon}>{icon}</Text> : null}
      <View style={{ flex: 1 }}>
        <Text style={[k.rowLabel, danger && { color: Colors.urgent }]}>{label}</Text>
        {sub ? <Text style={k.rowSub}>{sub}</Text> : null}
      </View>
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
          <Text style={[k.segTxt, value === o.key && k.segTxtOn]} numberOfLines={1}>{o.label}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

export function Tile({ icon, title, sub, onPress }: { icon: string; title: string; sub?: string; onPress?: () => void }) {
  return (
    <TouchableOpacity style={k.tile} onPress={onPress} activeOpacity={0.9}>
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
      {ctaLabel ? <TouchableOpacity style={k.btn} onPress={onCta} activeOpacity={0.9}><Text style={k.btnTxt}>{ctaLabel}</Text></TouchableOpacity> : null}
    </View>
  );
}

// Note discrète « donnée simulée / à venir au lot Fx » — plus d'encart jaune.
export function Placeholder({ note, v1Path, v1Label }: { note: string; v1Path?: string; v1Label?: string }) {
  return (
    <View style={k.ph}>
      <Text style={k.phNote}>
        <Text style={k.phDot}>· </Text>{note}
        {v1Path ? (
          <Text style={k.phLink} onPress={() => router.push(v1Path as any)}>{`  ${v1Label ?? 'voir la version actuelle'} ›`}</Text>
        ) : null}
      </Text>
    </View>
  );
}

export function PrimaryButton({ label, onPress, disabled }: { label: string; onPress?: () => void; disabled?: boolean }) {
  return (
    <TouchableOpacity style={[k.btn, disabled && k.btnOff]} onPress={onPress} disabled={disabled} activeOpacity={0.9}>
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
  screen: { flex: 1, backgroundColor: C.bg },
  screenInner: { flex: 1 },
  scrollPad: { padding: Spacing.lg, paddingBottom: 44, gap: Spacing.md },
  h1: { fontSize: 26, fontWeight: FontWeight.extrabold, color: C.ink, letterSpacing: -0.4 },

  section: { gap: Spacing.sm, marginTop: Spacing.xl },
  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionTitle: { fontSize: 11, fontWeight: FontWeight.bold, color: C.faint, textTransform: 'uppercase', letterSpacing: 0.8 },
  sectionAction: { fontSize: FontSize.sm, color: C.cta, fontWeight: FontWeight.semibold },

  card: { backgroundColor: C.card, borderRadius: 16, borderWidth: 1, borderColor: C.line },
  cardPad: { padding: Spacing.lg, gap: Spacing.sm },
  cardHero: { borderColor: C.ctaLine, backgroundColor: C.ctaSoft },

  rowDivider: { borderTopWidth: 1, borderTopColor: C.line },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.md, paddingHorizontal: Spacing.lg },
  rowIcon: { fontSize: 16, width: 22, textAlign: 'center' },
  rowLabel: { fontSize: FontSize.base, color: C.ink, fontWeight: FontWeight.semibold },
  rowSub: { fontSize: FontSize.xs, color: C.faint, marginTop: 1 },
  rowValue: { fontSize: FontSize.sm, color: C.sub },
  chev: { fontSize: 18, color: C.faint, marginLeft: 2 },

  chip: { paddingVertical: 7, paddingHorizontal: Spacing.md, borderRadius: 999, borderWidth: 1, borderColor: C.line, backgroundColor: C.card },
  chipOn: { backgroundColor: C.ctaSoft, borderColor: C.ctaLine },
  chipTxt: { fontSize: FontSize.sm, color: C.sub, fontWeight: FontWeight.semibold },
  chipTxtOn: { color: Colors.primaryDark },

  segment: { flexDirection: 'row', backgroundColor: C.bg, borderRadius: 12, padding: 3, borderWidth: 1, borderColor: C.line },
  segBtn: { flex: 1, paddingVertical: 9, borderRadius: 9, alignItems: 'center' },
  segBtnOn: { backgroundColor: C.card, ...Shadow.card },
  segTxt: { fontSize: FontSize.sm, color: C.sub, fontWeight: FontWeight.semibold },
  segTxtOn: { color: C.ink, fontWeight: FontWeight.bold },

  tile: { flex: 1, backgroundColor: C.card, borderRadius: 14, borderWidth: 1, borderColor: C.line, padding: Spacing.md, gap: 3 },
  tileIcon: { fontSize: 18 },
  tileTitle: { fontSize: FontSize.base, fontWeight: FontWeight.bold, color: C.ink },
  tileSub: { fontSize: FontSize.xs, color: C.sub },

  empty: { alignItems: 'center', gap: 6, backgroundColor: C.card, borderRadius: 16, borderWidth: 1, borderColor: C.line, paddingVertical: Spacing.xl, paddingHorizontal: Spacing.lg },
  emptyIcon: { fontSize: 26, opacity: 0.7 },
  emptyTitle: { fontSize: FontSize.base, fontWeight: FontWeight.bold, color: C.ink, textAlign: 'center' },
  emptyBody: { fontSize: FontSize.sm, color: C.sub, textAlign: 'center', lineHeight: 19 },

  ph: { paddingHorizontal: 2, paddingTop: 2 },
  phNote: { fontSize: FontSize.xs, color: C.faint, lineHeight: 16, fontStyle: 'italic' },
  phDot: { color: C.faint },
  phLink: { color: C.cta, fontStyle: 'normal', fontWeight: FontWeight.semibold },

  btn: { backgroundColor: C.cta, borderRadius: 14, paddingVertical: Spacing.md + 2, alignItems: 'center', paddingHorizontal: Spacing.lg },
  btnOff: { backgroundColor: '#E7E5E1' },
  btnTxt: { color: Colors.textInverse, fontWeight: FontWeight.extrabold, fontSize: FontSize.base },
  btnGhost: { borderRadius: 14, borderWidth: 1, borderColor: C.line, paddingVertical: Spacing.md + 2, alignItems: 'center', backgroundColor: C.card },
  btnGhostTxt: { color: C.sub, fontWeight: FontWeight.bold, fontSize: FontSize.base },
});
