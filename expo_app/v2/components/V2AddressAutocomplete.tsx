// ─────────────────────────────────────────────────────────────────────────────
// V2AddressAutocomplete — champ texte + suggestions de VILLES ou d'ADRESSES.
//
// Source : Base Adresse Nationale (api-adresse.data.gouv.fr) — service public
// FR officiel, sans clé, CORS ouvert. Conçu pour l'autocomplétion :
//   kind="city"    → « nîm » → Nîmes ;  « nio » → Niort ;  « nic » → Nice…
//   kind="address" → « 2 rue du clos girard issy » → adresse complète + CP
//
// Min. 3 caractères (contrainte BAN). L'utilisateur peut toujours saisir
// librement — une valeur hors suggestions reste acceptée. FRONT-ONLY.
// ─────────────────────────────────────────────────────────────────────────────
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, ScrollView, Platform,
} from 'react-native';
import { Colors } from '../../constants/colors';
import { BL } from '../ui/blush';
import { Spacing, Radius, FontSize } from '../../constants/theme';

const createPortal: ((node: React.ReactNode, container: Element) => React.ReactNode) | null =
  Platform.OS === 'web' ? require('react-dom').createPortal : null;

const MIN_CHARS = 3;
const BAN = 'https://api-adresse.data.gouv.fr/search/';

export interface PlaceSuggestion {
  label: string;
  lat: number;
  lng: number;
  city: string;
}

const _cache = new Map<string, PlaceSuggestion[]>();

async function search(query: string, kind: 'city' | 'address'): Promise<PlaceSuggestion[]> {
  const q = query.trim();
  if (q.length < MIN_CHARS) return [];
  const key = `${kind}:${q.toLowerCase()}`;
  if (_cache.has(key)) return _cache.get(key)!;

  const params =
    `q=${encodeURIComponent(q)}&limit=7&autocomplete=1` +
    (kind === 'city' ? '&type=municipality' : '');
  try {
    const resp = await fetch(`${BAN}?${params}`);
    if (!resp.ok) { _cache.set(key, []); return []; }
    const json = await resp.json();
    const feats: any[] = Array.isArray(json?.features) ? json.features : [];
    const out: PlaceSuggestion[] = feats.map((f) => {
      const p = f.properties ?? {};
      const [lng, lat] = (f.geometry?.coordinates ?? [0, 0]) as [number, number];
      const dept = (p.context ?? '').split(',')[0].trim();
      const city = p.city ?? p.name ?? '';
      const label =
        kind === 'city'
          ? (city ? (dept ? `${city} (${dept})` : city) : p.label)
          : (p.label as string);
      return { label, lat, lng, city };
    }).filter((s) => s.label);
    _cache.set(key, out);
    return out;
  } catch {
    _cache.set(key, []);
    return [];
  }
}

interface Props {
  value: string;
  onChangeText: (v: string) => void;
  /** Appelé quand une suggestion est choisie (coords utiles au calcul km). */
  onPick?: (label: string, coords: { lat: number; lng: number }, city: string) => void;
  placeholder?: string;
  kind?: 'city' | 'address';
  style?: object;
}

export function V2AddressAutocomplete({
  value, onChangeText, onPick, placeholder, kind = 'city', style,
}: Props) {
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [rect, setRect] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const wrapRef = useRef<View>(null);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const measure = useCallback(() => {
    if (Platform.OS !== 'web') return;
    wrapRef.current?.measure((_a, _b, width, height, px, py) => setRect({ x: px, y: py, width, height }));
  }, []);

  useEffect(() => {
    if (Platform.OS !== 'web' || !open) return;
    const close = () => { setOpen(false); setSuggestions([]); };
    const t = setTimeout(() => document.addEventListener('mousedown', close), 0);
    return () => { clearTimeout(t); document.removeEventListener('mousedown', close); };
  }, [open]);

  const handleChange = useCallback((text: string) => {
    onChangeText(text);
    setOpen(false);
    setSuggestions([]);
    if (debounce.current) clearTimeout(debounce.current);
    if (text.trim().length < MIN_CHARS) return;
    debounce.current = setTimeout(async () => {
      setLoading(true);
      measure();
      const res = await search(text, kind);
      setSuggestions(res);
      if (res.length) { measure(); setOpen(true); }
      setLoading(false);
    }, 300);
  }, [onChangeText, kind, measure]);

  const pick = useCallback((s: PlaceSuggestion) => {
    onChangeText(s.label);
    onPick?.(s.label, { lat: s.lat, lng: s.lng }, s.city);
    setSuggestions([]);
    setOpen(false);
  }, [onChangeText, onPick]);

  const list = open && suggestions.length > 0 ? (
    <ScrollView keyboardShouldPersistTaps="handled" nestedScrollEnabled style={{ maxHeight: 220 }}>
      {suggestions.map((s2, i) => (
        <TouchableOpacity
          key={i}
          style={[st.item, i < suggestions.length - 1 && st.itemBorder]}
          onPress={() => pick(s2)}
          activeOpacity={0.7}
        >
          <Text style={st.itemTxt} numberOfLines={2}>{s2.label}</Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  ) : null;

  const webDropdown = Platform.OS === 'web' && createPortal && open && suggestions.length > 0 && rect
    ? createPortal(
        <View
          // @ts-ignore — props CSS web-only
          onMouseDown={(e: any) => e.stopPropagation()}
          style={{
            position: 'fixed',
            top: rect.y + rect.height + 4,
            left: rect.x,
            width: rect.width,
            backgroundColor: Colors.surface,
            borderWidth: 1,
            borderColor: Colors.border,
            borderRadius: Radius.md,
            maxHeight: 220,
            zIndex: 99999,
            boxShadow: '0 4px 16px rgba(0,0,0,0.18)',
            overflow: 'hidden',
          } as any}
        >
          {list}
        </View>,
        document.body,
      )
    : null;

  const nativeDropdown = Platform.OS !== 'web' && open && suggestions.length > 0
    ? <View style={st.dropdown}>{list}</View>
    : null;

  return (
    <View ref={wrapRef} style={[st.wrap, style]} onLayout={measure}>
      <View style={st.row}>
        <TextInput
          style={st.input}
          value={value}
          onChangeText={handleChange}
          placeholder={placeholder ?? (kind === 'city' ? 'Ville / commune' : 'Numéro et voie, ville')}
          placeholderTextColor={Colors.textTertiary}
          autoCorrect={false}
        />
        {loading && <View style={st.loader}><ActivityIndicator size="small" color={BL.accent} /></View>}
      </View>
      {nativeDropdown}
      {webDropdown}
    </View>
  );
}

const st = StyleSheet.create({
  wrap: { position: 'relative' },
  row: { flexDirection: 'row', alignItems: 'center' },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 3,
    fontSize: FontSize.base,
    color: Colors.textPrimary,
    backgroundColor: Colors.surface,
  },
  loader: { position: 'absolute', right: Spacing.md },
  dropdown: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    marginTop: 4,
    maxHeight: 220,
    elevation: 8,
    zIndex: 50,
  },
  item: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm + 2 },
  itemBorder: { borderBottomWidth: 1, borderBottomColor: Colors.border },
  itemTxt: { fontSize: FontSize.sm, color: Colors.textPrimary, lineHeight: 18 },
});
