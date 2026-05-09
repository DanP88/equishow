import { useState, useRef, useCallback, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, ScrollView, Platform,
} from 'react-native';
import { Colors } from '../constants/colors';
import { Spacing, Radius, FontSize, FontWeight } from '../constants/theme';

// Portal uniquement sur web
const createPortal: ((node: React.ReactNode, container: Element) => React.ReactNode) | null =
  Platform.OS === 'web' ? require('react-dom').createPortal : null;

interface Suggestion {
  label: string;
  lat: number;
  lng: number;
}

interface InputRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface Props {
  value: string;
  onChange: (address: string, lat?: number, lng?: number) => void;
  placeholder?: string;
  disabled?: boolean;
  style?: object;
}

async function searchAddresses(query: string): Promise<Suggestion[]> {
  if (query.trim().length < 3) return [];
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=5&countrycodes=fr&addressdetails=1`;
  const resp = await fetch(url, {
    headers: { 'Accept-Language': 'fr', 'User-Agent': 'Equishow/1.0' },
  });
  if (!resp.ok) return [];
  const data: any[] = await resp.json();
  return data.map((item) => ({
    label: item.display_name as string,
    lat: parseFloat(item.lat),
    lng: parseFloat(item.lon),
  }));
}

export function AddressAutocomplete({ value, onChange, placeholder, disabled, style }: Props) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [inputRect, setInputRect] = useState<InputRect | null>(null);
  const wrapperRef = useRef<View>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function measureWrapper() {
    if (Platform.OS !== 'web') return;
    wrapperRef.current?.measure((_fx, _fy, width, height, px, py) => {
      setInputRect({ x: px, y: py, width, height });
    });
  }

  // Fermer si clic en dehors (web)
  useEffect(() => {
    if (Platform.OS !== 'web' || !open) return;
    function handleOutside() {
      setOpen(false);
      setSuggestions([]);
    }
    // Délai pour laisser le clic sur une suggestion se traiter d'abord
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleOutside);
    }, 0);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handleOutside);
    };
  }, [open]);

  const handleChange = useCallback((text: string) => {
    onChange(text);
    setOpen(false);
    setSuggestions([]);

    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (text.trim().length < 3) return;

    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      measureWrapper();
      try {
        const results = await searchAddresses(text);
        setSuggestions(results);
        if (results.length > 0) {
          measureWrapper();
          setOpen(true);
        }
      } catch {
        setSuggestions([]);
      } finally {
        setLoading(false);
      }
    }, 400);
  }, [onChange]);

  const handleSelect = useCallback((s: Suggestion) => {
    onChange(s.label, s.lat, s.lng);
    setSuggestions([]);
    setOpen(false);
  }, [onChange]);

  const dropdownContent = open && suggestions.length > 0 ? (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      nestedScrollEnabled
      style={{ maxHeight: 220 }}
    >
      {suggestions.map((s2, idx) => (
        <TouchableOpacity
          key={idx}
          style={[s.suggestionItem, idx < suggestions.length - 1 && s.suggestionBorder]}
          onPress={() => handleSelect(s2)}
          activeOpacity={0.7}
        >
          <Text style={s.suggestionText} numberOfLines={2}>{s2.label}</Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  ) : null;

  // Sur web : portal dans document.body avec position fixed
  const webDropdown = Platform.OS === 'web' && createPortal && open && suggestions.length > 0 && inputRect
    ? createPortal(
        <View
          // @ts-ignore
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
            maxHeight: 220,
            zIndex: 99999,
            boxShadow: '0 4px 16px rgba(0,0,0,0.18)',
            overflow: 'hidden',
          }}
        >
          {dropdownContent}
        </View>,
        document.body
      )
    : null;

  // Sur mobile : dropdown absolu classique
  const nativeDropdown = Platform.OS !== 'web' && open && suggestions.length > 0
    ? (
        <View style={s.dropdown}>
          {dropdownContent}
        </View>
      )
    : null;

  return (
    <View
      ref={wrapperRef}
      style={[s.wrapper, style]}
      onLayout={measureWrapper}
    >
      <View style={s.inputRow}>
        <TextInput
          style={[s.input, !!value && s.inputFilled, disabled && s.inputDisabled]}
          value={value}
          onChangeText={handleChange}
          placeholder={placeholder ?? 'Ex: 12 rue du Moulin, 38000 Grenoble'}
          placeholderTextColor={Colors.textTertiary}
          editable={!disabled}
          autoCorrect={false}
        />
        {loading && (
          <View style={s.loader}>
            <ActivityIndicator size="small" color={Colors.primary} />
          </View>
        )}
      </View>

      {nativeDropdown}
      {webDropdown}
    </View>
  );
}

const s = StyleSheet.create({
  wrapper: {
    position: 'relative',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 4,
    fontSize: FontSize.base,
    color: Colors.textPrimary,
    backgroundColor: Colors.surface,
  },
  inputFilled: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primaryLight,
  },
  inputDisabled: {
    borderColor: Colors.success,
    backgroundColor: '#F0FDF4',
    color: Colors.textSecondary,
  },
  loader: {
    position: 'absolute',
    right: Spacing.md,
  },
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
  },
  suggestionItem: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 2,
  },
  suggestionBorder: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  suggestionText: {
    fontSize: FontSize.sm,
    color: Colors.textPrimary,
    lineHeight: 18,
  },
});
