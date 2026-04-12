import React, { useState } from 'react';
import { View, Text, Modal, TouchableOpacity, StyleSheet } from 'react-native';
import { Colors } from '../constants/colors';
import { Spacing, Radius, FontSize, FontWeight, Shadow } from '../constants/theme';

const COLORS = [
  '#F97316', '#EA580C', '#B45309', '#92400E',
  '#16A34A', '#0369A1', '#7C3AED', '#DB2777',
  '#1F2937', '#6B7280', '#C9A84C', '#DC2626',
];

const EMOJIS = [
  '🐴', '🦄', '🐎', '🏇', '🎠', '🌾',
  '⭐', '🌟', '🏆', '🥇', '🎖️', '👑',
  '🔥', '💎', '⚡', '🌊', '🌿', '🍀',
  '🌸', '🌺', '🦋', '🕊️', '🦅', '🌙',
];

export function PhotoAvatar({ color, emoji, size = 72, onEdit }: {
  color?: string;
  emoji?: string;
  size?: number;
  onEdit?: (color: string, emoji: string) => void;
}) {
  const [showPicker, setShowPicker] = useState(false);
  const [selColor, setSelColor] = useState(color ?? Colors.primary);
  const [selEmoji, setSelEmoji] = useState(emoji ?? '🐴');

  function confirm() {
    onEdit?.(selColor, selEmoji);
    setShowPicker(false);
  }

  return (
    <>
      <TouchableOpacity
        style={[s.avatar, { width: size, height: size, borderRadius: size / 2, backgroundColor: selColor }]}
        onPress={() => onEdit && setShowPicker(true)}
        activeOpacity={onEdit ? 0.8 : 1}
      >
        <Text style={{ fontSize: size * 0.45 }}>{selEmoji}</Text>
        {onEdit && (
          <View style={s.editBadge}>
            <Text style={s.editBadgeText}>✏️</Text>
          </View>
        )}
      </TouchableOpacity>

      {onEdit && (
        <Modal visible={showPicker} transparent animationType="fade">
          <TouchableOpacity style={s.backdrop} activeOpacity={1} onPress={() => setShowPicker(false)}>
            <TouchableOpacity activeOpacity={1} style={s.card}>
              <Text style={s.title}>Personnaliser l'avatar</Text>

              {/* Preview */}
              <View style={[s.preview, { backgroundColor: selColor }]}>
                <Text style={{ fontSize: 48 }}>{selEmoji}</Text>
              </View>

              {/* Couleurs */}
              <Text style={s.sectionLabel}>Couleur</Text>
              <View style={s.colorGrid}>
                {COLORS.map((c) => (
                  <TouchableOpacity
                    key={c}
                    style={[s.colorDot, { backgroundColor: c }, selColor === c && s.colorDotActive]}
                    onPress={() => setSelColor(c)}
                  >
                    {selColor === c && <Text style={s.colorCheck}>✓</Text>}
                  </TouchableOpacity>
                ))}
              </View>

              {/* Emojis */}
              <Text style={s.sectionLabel}>Icône</Text>
              <View style={s.emojiGrid}>
                {EMOJIS.map((e) => (
                  <TouchableOpacity
                    key={e}
                    style={[s.emojiBtn, selEmoji === e && s.emojiBtnActive]}
                    onPress={() => setSelEmoji(e)}
                  >
                    <Text style={{ fontSize: 24 }}>{e}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={s.actions}>
                <TouchableOpacity style={s.cancelBtn} onPress={() => setShowPicker(false)}>
                  <Text style={s.cancelText}>Annuler</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.confirmBtn} onPress={confirm}>
                  <Text style={s.confirmText}>Valider</Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          </TouchableOpacity>
        </Modal>
      )}
    </>
  );
}

const s = StyleSheet.create({
  avatar: { alignItems: 'center', justifyContent: 'center' },
  editBadge: { position: 'absolute', bottom: 0, right: 0, backgroundColor: Colors.surface, borderRadius: 12, width: 24, height: 24, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: Colors.border },
  editBadgeText: { fontSize: 10 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: Spacing.lg },
  card: { backgroundColor: Colors.surface, borderRadius: Radius.xxl, width: '100%', maxWidth: 360, padding: Spacing.xl, ...Shadow.modal },
  title: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.textPrimary, marginBottom: Spacing.lg, textAlign: 'center' },
  preview: { width: 80, height: 80, borderRadius: 40, alignSelf: 'center', alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.lg },
  sectionLabel: { fontSize: FontSize.xs, fontWeight: FontWeight.bold, color: Colors.textTertiary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: Spacing.sm },
  colorGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginBottom: Spacing.lg },
  colorDot: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  colorDotActive: { borderWidth: 3, borderColor: Colors.textPrimary },
  colorCheck: { color: Colors.textInverse, fontSize: 14, fontWeight: FontWeight.bold },
  emojiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginBottom: Spacing.lg },
  emojiBtn: { width: 48, height: 48, borderRadius: Radius.sm, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.surfaceVariant },
  emojiBtnActive: { borderColor: Colors.primary, backgroundColor: Colors.primaryLight, borderWidth: 2 },
  actions: { flexDirection: 'row', gap: Spacing.sm },
  cancelBtn: { flex: 1, borderWidth: 1, borderColor: Colors.borderMedium, borderRadius: Radius.md, paddingVertical: Spacing.md, alignItems: 'center' },
  cancelText: { color: Colors.textSecondary, fontWeight: FontWeight.semibold },
  confirmBtn: { flex: 1, backgroundColor: Colors.primary, borderRadius: Radius.md, paddingVertical: Spacing.md, alignItems: 'center' },
  confirmText: { color: Colors.textInverse, fontWeight: FontWeight.bold },
});
