import { useMemo, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, SafeAreaView, ActivityIndicator, TextInput, Modal } from 'react-native';
import { router } from 'expo-router';
import { Colors } from '../../constants/colors';
import { Spacing, Radius, FontSize, FontWeight, Shadow } from '../../constants/theme';
import { useConcoursList, ConcoursHub } from '../../hooks/useConcours';
import { useConcoursModuleCounts } from '../../hooks/useConcoursModuleCounts';
import { deriveDiscipline, regionLabel, DISCIPLINES, Discipline } from '../../lib/discipline';
import { useScreenTracking } from '../../hooks/useScreenTracking';

const DISC_COLORS: Record<string, string> = {
  CSO: Colors.cso, Dressage: Colors.dressage, CCE: Colors.cce, Hunter: Colors.hunter,
};

// Concours passé = date de fin (ou début) antérieure à aujourd'hui.
function isPastConcours(c: { date_fin: string | null; date_debut: string | null }): boolean {
  const d = c.date_fin ?? c.date_debut;
  if (!d) return false;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  return new Date(`${d}T00:00:00`) < today;
}

/**
 * LOT découverte — Hub concours (source DB) avec recherche/filtres cavalier :
 * texte (nom/lieu), discipline (dérivée), département, région (CRE), et présence
 * de services (box / transport / coach). Date couverte par les onglets À venir/Passés.
 */
export default function ConcoursHubScreen() {
  useScreenTracking('concours-hub');
  const { concours, isLoading, usingMock } = useConcoursList();
  const { counts } = useConcoursModuleCounts();

  const [tab, setTab] = useState<'avenir' | 'passes'>('avenir');
  const [q, setQ] = useState('');
  const [disc, setDisc] = useState<Discipline | null>(null);
  const [dept, setDept] = useState<string | null>(null);
  const [region, setRegion] = useState<string | null>(null);
  const [mods, setMods] = useState({ box: false, transport: false, coach: false });
  const [picker, setPicker] = useState<null | 'dept' | 'region'>(null);

  // Facettes (valeurs distinctes réelles).
  const { depts, regions } = useMemo(() => {
    const ds = new Set<string>(); const rs = new Set<string>();
    for (const c of concours) {
      if (c.departement) ds.add(c.departement);
      if (c.cre) rs.add(c.cre);
    }
    return {
      depts: [...ds].sort((a, b) => a.localeCompare(b, 'fr', { numeric: true })),
      regions: [...rs].sort((a, b) => a.localeCompare(b, 'fr')),
    };
  }, [concours]);

  const hasFilter = !!q || !!disc || !!dept || !!region || mods.box || mods.transport || mods.coach;
  const resetAll = () => { setQ(''); setDisc(null); setDept(null); setRegion(null); setMods({ box: false, transport: false, coach: false }); };

  // Application des filtres PUIS découpage À venir / Passés (les compteurs d'onglets
  // reflètent le résultat filtré).
  const { avenir, passes } = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const filtered = concours.filter((c) => {
      if (needle && !(`${c.nom} ${c.lieu ?? ''}`.toLowerCase().includes(needle))) return false;
      if (disc && deriveDiscipline(c.type_concours, c.liste_epreuves) !== disc) return false;
      if (dept && c.departement !== dept) return false;
      if (region && c.cre !== region) return false;
      const mc = counts[c.id] ?? { box: 0, transport: 0, coach: 0 };
      if (mods.box && mc.box < 1) return false;
      if (mods.transport && mc.transport < 1) return false;
      if (mods.coach && mc.coach < 1) return false;
      return true;
    });
    const av: ConcoursHub[] = []; const pa: ConcoursHub[] = [];
    for (const c of filtered) (isPastConcours(c) ? pa : av).push(c);
    pa.reverse();
    return { avenir: av, passes: pa };
  }, [concours, counts, q, disc, dept, region, mods]);

  const shown = tab === 'passes' ? passes : avenir;
  const pickerItems = picker === 'dept' ? depts : regions;
  const pickerValue = picker === 'dept' ? dept : region;
  const setPickerValue = (v: string | null) => { if (picker === 'dept') setDept(v); else setRegion(v); setPicker(null); };

  return (
    <SafeAreaView style={s.root}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => { if (router.canGoBack()) router.back(); else router.replace('/(tabs)/services' as any); }} style={s.back}><Text style={s.backTxt}>←</Text></TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={s.title}>🏆 Concours</Text>
          <Text style={s.sub}>Trouve ton prochain concours</Text>
        </View>
      </View>

      {usingMock && (
        <View style={s.mockBanner}>
          <Text style={s.mockTxt}>⚙️ Données de démonstration (migration 074 non appliquée)</Text>
        </View>
      )}

      {/* Recherche + filtres */}
      {!isLoading && concours.length > 0 && (
        <View style={s.filters}>
          <TextInput
            style={s.search}
            value={q}
            onChangeText={setQ}
            placeholder="🔍 Rechercher un concours, un lieu…"
            placeholderTextColor={Colors.textTertiary}
            returnKeyType="search"
          />

          {/* Discipline (dérivée) */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chipsRow}>
            {DISCIPLINES.map((d) => (
              <Chip key={d} label={d} active={disc === d} onPress={() => setDisc(disc === d ? null : d)} />
            ))}
          </ScrollView>

          {/* Services présents + département/région */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chipsRow}>
            <Chip label="📦 Box" active={mods.box} onPress={() => setMods((m) => ({ ...m, box: !m.box }))} />
            <Chip label="🚐 Transport" active={mods.transport} onPress={() => setMods((m) => ({ ...m, transport: !m.transport }))} />
            <Chip label="🎓 Coach" active={mods.coach} onPress={() => setMods((m) => ({ ...m, coach: !m.coach }))} />
            <Chip label={dept ? `📍 Dépt ${dept}` : '📍 Département'} active={!!dept} onPress={() => setPicker('dept')} />
            <Chip label={region ? `🗺 ${regionLabel(region)}` : '🗺 Région'} active={!!region} onPress={() => setPicker('region')} />
          </ScrollView>

          {hasFilter && (
            <TouchableOpacity onPress={resetAll} activeOpacity={0.7}>
              <Text style={s.reset}>✕ Réinitialiser les filtres</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Onglets À venir / Concours passés */}
      {!isLoading && concours.length > 0 && (
        <View style={s.tabs}>
          <TouchableOpacity style={[s.tab, tab === 'avenir' && s.tabActive]} onPress={() => setTab('avenir')} activeOpacity={0.8}>
            <Text style={[s.tabTxt, tab === 'avenir' && s.tabTxtActive]}>À venir ({avenir.length})</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[s.tab, tab === 'passes' && s.tabActive]} onPress={() => setTab('passes')} activeOpacity={0.8}>
            <Text style={[s.tabTxt, tab === 'passes' && s.tabTxtActive]}>Passés ({passes.length})</Text>
          </TouchableOpacity>
        </View>
      )}

      {isLoading ? (
        <View style={s.loader}><ActivityIndicator size="large" color={Colors.primary} /></View>
      ) : concours.length === 0 ? (
        <View style={s.empty}>
          <Text style={s.emptyIcon}>🏆</Text>
          <Text style={s.emptyTitle}>Aucun concours pour l'instant</Text>
          <Text style={s.emptyTxt}>Les concours importés depuis la FFE apparaîtront ici.</Text>
        </View>
      ) : shown.length === 0 ? (
        <View style={s.empty}>
          <Text style={s.emptyIcon}>🔍</Text>
          <Text style={s.emptyTitle}>Aucun concours ne correspond</Text>
          <Text style={s.emptyTxt}>{hasFilter ? 'Essaie d\'élargir tes filtres.' : (tab === 'passes' ? 'Aucun concours passé.' : 'Aucun concours à venir.')}</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={s.list}>
          {shown.map((c) => {
            const color = DISC_COLORS[deriveDiscipline(c.type_concours, c.liste_epreuves)] ?? Colors.primary;
            const mc = counts[c.id] ?? { box: 0, transport: 0, coach: 0 };
            const hasServices = mc.box + mc.transport + mc.coach > 0;
            return (
              <TouchableOpacity
                key={c.id}
                style={s.card}
                activeOpacity={0.85}
                onPress={() => router.push(`/concours/${c.id}` as any)}
              >
                <View style={[s.band, { backgroundColor: color }]}>
                  <Text style={s.bandTxt}>{deriveDiscipline(c.type_concours, c.liste_epreuves)}{c.departement ? ` · Dépt ${c.departement}` : ''}</Text>
                </View>
                <View style={s.body}>
                  <Text style={s.nom}>🏆 {c.nom}</Text>
                  {!!c.dateLabel && <Text style={s.meta}>📅 {c.dateLabel}</Text>}
                  {!!c.lieu && <Text style={s.meta}>📍 {c.lieu}{c.cre ? ` · ${regionLabel(c.cre)}` : ''}</Text>}
                  {hasServices && (
                    <View style={s.svcRow}>
                      {mc.box > 0 && <Text style={s.svcPill}>📦 {mc.box}</Text>}
                      {mc.transport > 0 && <Text style={s.svcPill}>🚐 {mc.transport}</Text>}
                      {mc.coach > 0 && <Text style={s.svcPill}>🎓 {mc.coach}</Text>}
                    </View>
                  )}
                  <View style={s.footer}>
                    {c.followers_count > 0
                      ? <Text style={s.followers}>⭐ {c.followers_count} suivent</Text>
                      : <View />}
                    <View style={s.voirBtn}><Text style={s.voirTxt}>Voir →</Text></View>
                  </View>
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}

      {/* Picker département / région */}
      <Modal visible={picker !== null} transparent animationType="fade" onRequestClose={() => setPicker(null)}>
        <TouchableOpacity style={s.backdrop} activeOpacity={1} onPress={() => setPicker(null)}>
          <TouchableOpacity activeOpacity={1} style={s.sheet}>
            <Text style={s.sheetTitle}>{picker === 'dept' ? 'Département' : 'Région'}</Text>
            <ScrollView style={s.sheetList} showsVerticalScrollIndicator={false}>
              <TouchableOpacity style={s.sheetItem} onPress={() => setPickerValue(null)}>
                <Text style={[s.sheetItemTxt, { color: Colors.textTertiary, fontStyle: 'italic' }]}>— Tous</Text>
              </TouchableOpacity>
              {pickerItems.map((it) => (
                <TouchableOpacity key={it} style={s.sheetItem} onPress={() => setPickerValue(it)}>
                  <Text style={[s.sheetItemTxt, pickerValue === it && s.sheetItemActive]}>
                    {picker === 'region' ? regionLabel(it) : it}
                  </Text>
                  {pickerValue === it && <Text style={s.check}>✓</Text>}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity style={[s.chip, active && s.chipActive]} onPress={onPress} activeOpacity={0.8}>
      <Text style={[s.chipTxt, active && s.chipTxtActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, backgroundColor: Colors.surface, borderBottomWidth: 1, borderBottomColor: Colors.border },
  back: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.surfaceVariant },
  backTxt: { fontSize: 20, color: Colors.textPrimary },
  title: { fontSize: FontSize.xl, fontWeight: FontWeight.extrabold, color: Colors.textPrimary },
  sub: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 2 },

  filters: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.md, gap: Spacing.sm, backgroundColor: Colors.surface },
  search: { backgroundColor: Colors.surfaceVariant, borderRadius: Radius.md, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm + 2, fontSize: FontSize.sm, color: Colors.textPrimary, borderWidth: 1, borderColor: Colors.border },
  chipsRow: { gap: Spacing.sm, paddingVertical: 2 },
  chip: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs + 2, borderRadius: 20, backgroundColor: Colors.surfaceVariant, borderWidth: 1, borderColor: Colors.border },
  chipActive: { backgroundColor: Colors.primaryLight, borderColor: Colors.primaryBorder },
  chipTxt: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold, color: Colors.textSecondary },
  chipTxtActive: { color: Colors.primary, fontWeight: FontWeight.bold },
  reset: { fontSize: FontSize.xs, color: Colors.urgent, fontWeight: FontWeight.semibold, paddingVertical: 2 },

  tabs: { flexDirection: 'row', gap: Spacing.sm, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, backgroundColor: Colors.surface, borderBottomWidth: 1, borderBottomColor: Colors.border },
  tab: { flex: 1, paddingVertical: Spacing.sm, borderRadius: Radius.md, alignItems: 'center', backgroundColor: Colors.surfaceVariant, borderWidth: 1, borderColor: Colors.border },
  tabActive: { backgroundColor: Colors.primaryLight, borderColor: Colors.primaryBorder },
  tabTxt: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: Colors.textSecondary },
  tabTxtActive: { color: Colors.primary, fontWeight: FontWeight.bold },
  mockBanner: { backgroundColor: Colors.warningBg, borderBottomWidth: 1, borderBottomColor: Colors.warningBorder, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.xs },
  mockTxt: { fontSize: FontSize.xs, color: Colors.warning, fontWeight: FontWeight.semibold },
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.xxxl, gap: Spacing.sm },
  emptyIcon: { fontSize: 48 },
  emptyTitle: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  emptyTxt: { fontSize: FontSize.base, color: Colors.textSecondary, textAlign: 'center' },
  list: { padding: Spacing.lg, gap: Spacing.md, paddingBottom: 100 },
  card: { backgroundColor: Colors.surface, borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.border, overflow: 'hidden', ...Shadow.card },
  band: { paddingHorizontal: Spacing.lg, paddingVertical: 4 },
  bandTxt: { color: Colors.textInverse, fontSize: FontSize.xs, fontWeight: FontWeight.bold },
  body: { padding: Spacing.lg },
  nom: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.textPrimary, marginBottom: 6 },
  meta: { fontSize: FontSize.sm, color: Colors.textSecondary, marginBottom: 2 },
  svcRow: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.xs },
  svcPill: { fontSize: FontSize.xs, color: Colors.primary, backgroundColor: Colors.primaryLight, borderRadius: Radius.xs, paddingHorizontal: Spacing.sm, paddingVertical: 2, overflow: 'hidden', fontWeight: FontWeight.semibold },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: Spacing.md },
  followers: { fontSize: FontSize.xs, color: Colors.textTertiary, fontWeight: FontWeight.semibold },
  voirBtn: { backgroundColor: Colors.primary, borderRadius: Radius.md, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm },
  voirTxt: { color: Colors.textInverse, fontWeight: FontWeight.bold, fontSize: FontSize.sm },

  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: Colors.surface, borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl, padding: Spacing.lg, maxHeight: '70%' },
  sheetTitle: { fontSize: FontSize.base, fontWeight: FontWeight.bold, color: Colors.textPrimary, marginBottom: Spacing.sm },
  sheetList: { flexGrow: 0 },
  sheetItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: Spacing.sm + 2, borderBottomWidth: 1, borderBottomColor: Colors.border },
  sheetItemTxt: { fontSize: FontSize.sm, color: Colors.textPrimary },
  sheetItemActive: { color: Colors.primary, fontWeight: FontWeight.bold },
  check: { color: Colors.primary, fontWeight: FontWeight.bold },
});
