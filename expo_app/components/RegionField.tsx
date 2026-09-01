import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Platform,
} from 'react-native';
import { Colors } from '../constants/colors';
import { Spacing, Radius, FontSize, FontWeight } from '../constants/theme';
import { REGION_SECTIONS } from '../lib/regions';

// Portal sur web (le dropdown doit échapper à l'overflow du ScrollView du form).
const createPortal: ((node: React.ReactNode, container: Element) => React.ReactNode) | null =
  Platform.OS === 'web' ? require('react-dom').createPortal : null;

interface Props {
  label?: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
}

interface InputRect { x: number; y: number; width: number; height: number }

const norm = (s: string) =>
  (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

export function RegionField({ label = 'Région', value, onChangeText, placeholder }: Props) {
  const [open, setOpen] = useState(false);
  const [inputRect, setInputRect] = useState<InputRect | null>(null);
  const wrapperRef = useRef<View>(null);

  // Filtrage dynamique : chaque section garde ses entrées qui matchent la saisie.
  const sections = useMemo(() => {
    const q = norm(value);
    // Saisie vide OU égale à une valeur exacte → on montre tout.
    const showAll = !q || REGION_SECTIONS.some((sec) => sec.items.some((i) => norm(i) === q));
    return REGION_SECTIONS
      .map((sec) => ({
        title: sec.title,
        items: showAll ? sec.items : sec.items.filter((i) => norm(i).includes(q)),
      }))
      .filter((sec) => sec.items.length > 0);
  }, [value]);

  function measureWrapper() {
    if (Platform.OS !== 'web') return;
    wrapperRef.current?.measure((_fx, _fy, width, height, px, py) => {
      setInputRect({ x: px, y: py, width, height });
    });
  }

  useEffect(() => {
    if (Platform.OS !== 'web' || !open) return;
    function handleOutside() { setOpen(false); }
    const timer = setTimeout(() => document.addEventListener('mousedown', handleOutside), 0);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handleOutside);
    };
  }, [open]);

  // Valeurs héritées où la région vide était stockée comme « Non défini » :
  // on les remet à vide pour retrouver la liste complète.
  useEffect(() => {
    if (value === 'Non défini' || value === 'Non renseigné') onChangeText('');
  }, [value, onChangeText]);

  const handleChange = useCallback((text: string) => {
    onChangeText(text);
    measureWrapper();
    setOpen(true);
  }, [onChangeText]);

  const select = useCallback((v: string) => {
    onChangeText(v);
    setOpen(false);
  }, [onChangeText]);

  const rows = (
    <ScrollView keyboardShouldPersistTaps="handled" nestedScrollEnabled style={{ maxHeight: 260 }}>
      {!!value && (
        <TouchableOpacity style={s.item} onPress={() => select('')} activeOpacity={0.7}>
          <Text style={[s.itemText, s.itemNone]}>— Effacer</Text>
        </TouchableOpacity>
      )}
      {sections.map((sec) => (
        <View key={sec.title}>
          <Text style={s.sectionHeader}>{sec.title}</Text>
          {sec.items.map((it) => {
            const active = norm(value) === norm(it);
            return (
              <TouchableOpacity
                key={it}
                style={[s.item, s.itemBorder, active && s.itemActive]}
                onPress={() => select(it)}
                activeOpacity={0.7}
              >
                <Text style={[s.itemText, active && s.itemTextActive]}>{it}</Text>
                {active && <Text style={s.check}>✓</Text>}
              </TouchableOpacity>
            );
          })}
        </View>
      ))}
      {sections.length === 0 && (
        <View style={s.item}>
          <Text style={s.itemSub}>
            {value.trim()
              ? `« ${value.trim()} » sera enregistré tel quel.`
              : 'Commencez à taper…'}
          </Text>
        </View>
      )}
    </ScrollView>
  );

  const webDropdown = Platform.OS === 'web' && createPortal && open && inputRect
    ? createPortal(
        <View
          // @ts-ignore — props CSS web-only, code gated Platform.OS === 'web'
          onMouseDown={(e: any) => e.stopPropagation()}
          style={{
            position: 'fixed',
            top: inputRect.y + inputRect.height + 4,
            left: inputRect.x,
            width: inputRect.width,
            backgroundColor: Colors.surface,
            borderWidth: 1,
            borderColor: Colors.border,
            borderRadius: Radius.md,
            maxHeight: 260,
            zIndex: 99999,
            boxShadow: '0 4px 16px rgba(0,0,0,0.18)',
            overflow: 'hidden',
          } as any}
        >
          {rows}
        </View>,
        document.body,
      )
    : null;

  const nativeDropdown = Platform.OS !== 'web' && open
    ? <View style={s.dropdown}>{rows}</View>
    : null;

  return (
    <View ref={wrapperRef} style={s.wrapper} onLayout={measureWrapper}>
      {!!label && <Text style={s.label}>{label}</Text>}
      <TextInput
        style={[s.input, !!value && s.inputFilled]}
        value={value}
        onChangeText={handleChange}
        onFocus={() => { measureWrapper(); setOpen(true); }}
        placeholder={placeholder ?? 'Choisissez ou tapez une région / un pays…'}
        placeholderTextColor={Colors.textTertiary}
        autoCorrect={false}
      />
      {nativeDropdown}
      {webDropdown}
    </View>
  );
}

const s = StyleSheet.create({
  wrapper: { position: 'relative', marginBottom: Spacing.md },
  label: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold, color: Colors.textSecondary, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  input: {
    borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm + 4,
    fontSize: FontSize.base, color: Colors.textPrimary, backgroundColor: Colors.surface,
  },
  inputFilled: { borderColor: Colors.primary, backgroundColor: Colors.primaryLight },
  dropdown: {
    position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4,
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radius.md, maxHeight: 260, elevation: 8, zIndex: 50,
  },
  sectionHeader: {
    fontSize: FontSize.xs, fontWeight: FontWeight.bold, color: Colors.textTertiary,
    textTransform: 'uppercase', letterSpacing: 0.5,
    paddingHorizontal: Spacing.md, paddingTop: Spacing.sm, paddingBottom: 4,
    backgroundColor: Colors.surfaceVariant,
  },
  item: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm + 2 },
  itemBorder: { borderTopWidth: 1, borderTopColor: Colors.border },
  itemActive: { backgroundColor: Colors.primaryLight },
  itemText: { fontSize: FontSize.base, color: Colors.textPrimary, flex: 1 },
  itemTextActive: { color: Colors.primary, fontWeight: FontWeight.semibold },
  itemNone: { color: Colors.textTertiary, fontStyle: 'italic' },
  itemSub: { fontSize: FontSize.xs, color: Colors.textTertiary },
  check: { fontSize: FontSize.base, color: Colors.primary, fontWeight: FontWeight.bold },
});
