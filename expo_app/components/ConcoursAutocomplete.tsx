import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Platform,
} from 'react-native';
import { Colors } from '../constants/colors';
import { Spacing, Radius, FontSize, FontWeight } from '../constants/theme';

// Portal uniquement sur web (sinon le dropdown est clippé par le ScrollView du form)
const createPortal: ((node: React.ReactNode, container: Element) => React.ReactNode) | null =
  Platform.OS === 'web' ? require('react-dom').createPortal : null;

export interface ConcoursOption {
  id: string;
  nom: string;
  sub?: string;
}

interface Props {
  /** Nom affiché (saisi ou sélectionné). */
  valueNom: string;
  /** id du concours si l'entrée correspond à un concours réel de la liste. */
  valueId?: string;
  options: ConcoursOption[];
  onChange: (sel: { nom: string; id?: string }) => void;
  placeholder?: string;
}

interface InputRect { x: number; y: number; width: number; height: number }

const norm = (s: string) =>
  (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

export function ConcoursAutocomplete({ valueNom, valueId, options, onChange, placeholder }: Props) {
  const [open, setOpen] = useState(false);
  const [inputRect, setInputRect] = useState<InputRect | null>(null);
  const wrapperRef = useRef<View>(null);

  const filtered = useMemo(() => {
    const q = norm(valueNom);
    // Champ vide OU champ == une sélection exacte → on propose toute la liste.
    const base = !q || options.some((o) => norm(o.nom) === q)
      ? options
      : options.filter((o) => norm(o.nom).includes(q));
    return base.slice(0, 8);
  }, [valueNom, options]);

  function measureWrapper() {
    if (Platform.OS !== 'web') return;
    wrapperRef.current?.measure((_fx, _fy, width, height, px, py) => {
      setInputRect({ x: px, y: py, width, height });
    });
  }

  // Fermer si clic en dehors (web)
  useEffect(() => {
    if (Platform.OS !== 'web' || !open) return;
    function handleOutside() { setOpen(false); }
    const timer = setTimeout(() => document.addEventListener('mousedown', handleOutside), 0);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handleOutside);
    };
  }, [open]);

  const handleChange = useCallback((text: string) => {
    // Saisie libre : nom renseigné, pas d'id tant qu'aucune suggestion choisie.
    onChange({ nom: text, id: undefined });
    measureWrapper();
    setOpen(true);
  }, [onChange]);

  const handleSelect = useCallback((opt: ConcoursOption) => {
    onChange({ nom: opt.nom, id: opt.id });
    setOpen(false);
  }, [onChange]);

  const clear = useCallback(() => {
    onChange({ nom: '', id: undefined });
    setOpen(false);
  }, [onChange]);

  const rows = (
    <ScrollView keyboardShouldPersistTaps="handled" nestedScrollEnabled style={{ maxHeight: 240 }}>
      <TouchableOpacity style={s.item} onPress={clear} activeOpacity={0.7}>
        <Text style={[s.itemText, s.itemNone]}>— Aucun concours</Text>
      </TouchableOpacity>
      {filtered.map((opt) => {
        const active = valueId ? valueId === opt.id : norm(valueNom) === norm(opt.nom);
        return (
          <TouchableOpacity
            key={opt.id}
            style={[s.item, s.itemBorder, active && s.itemActive]}
            onPress={() => handleSelect(opt)}
            activeOpacity={0.7}
          >
            <View style={{ flex: 1 }}>
              <Text style={[s.itemText, active && s.itemTextActive]} numberOfLines={1}>{opt.nom}</Text>
              {!!opt.sub && <Text style={s.itemSub} numberOfLines={1}>{opt.sub}</Text>}
            </View>
            {active && <Text style={s.check}>✓</Text>}
          </TouchableOpacity>
        );
      })}
      {filtered.length === 0 && (
        <View style={s.item}>
          <Text style={s.itemSub}>
            {valueNom.trim()
              ? `Aucun concours ne correspond — « ${valueNom.trim()} » sera enregistré tel quel.`
              : 'Aucun concours disponible.'}
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
            maxHeight: 240,
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
      <View style={s.inputRow}>
        <TextInput
          style={[s.input, !!valueNom && s.inputFilled]}
          value={valueNom}
          onChangeText={handleChange}
          onFocus={() => { measureWrapper(); setOpen(true); }}
          placeholder={placeholder ?? 'Tapez le nom du concours…'}
          placeholderTextColor={Colors.textTertiary}
          autoCorrect={false}
        />
        {!!valueNom && (
          <TouchableOpacity style={s.clearBtn} onPress={clear} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={s.clearTxt}>✕</Text>
          </TouchableOpacity>
        )}
      </View>
      {!!valueNom && !valueId && (
        <Text style={s.freeHint}>Concours libre (non rattaché à un concours de la liste)</Text>
      )}
      {nativeDropdown}
      {webDropdown}
    </View>
  );
}

const s = StyleSheet.create({
  wrapper: { position: 'relative' },
  inputRow: { flexDirection: 'row', alignItems: 'center' },
  input: {
    flex: 1, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm + 4,
    fontSize: FontSize.base, color: Colors.textPrimary, backgroundColor: Colors.surface,
  },
  inputFilled: { borderColor: Colors.primary, backgroundColor: Colors.primaryLight },
  clearBtn: { position: 'absolute', right: Spacing.sm, padding: Spacing.xs },
  clearTxt: { fontSize: FontSize.sm, color: Colors.textTertiary },
  freeHint: { fontSize: FontSize.xs, color: Colors.textTertiary, marginTop: 4, fontStyle: 'italic' },
  dropdown: {
    position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4,
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radius.md, maxHeight: 240, elevation: 8, zIndex: 50,
  },
  item: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm + 2 },
  itemBorder: { borderTopWidth: 1, borderTopColor: Colors.border },
  itemActive: { backgroundColor: Colors.primaryLight },
  itemText: { fontSize: FontSize.base, fontWeight: FontWeight.semibold, color: Colors.textPrimary },
  itemTextActive: { color: Colors.primary },
  itemNone: { color: Colors.textTertiary, fontStyle: 'italic', fontWeight: FontWeight.medium },
  itemSub: { fontSize: FontSize.xs, color: Colors.textTertiary, marginTop: 2 },
  check: { fontSize: FontSize.base, color: Colors.primary, fontWeight: FontWeight.bold },
});
