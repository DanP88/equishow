// ─────────────────────────────────────────────────────────────────────────────
// v2/ui/Sticker — petite pastille ronde « étiquette » (thème Blush + fun).
// 8 px, gras, coins pleins, légère rotation alternée. 1 par carte maximum.
// ─────────────────────────────────────────────────────────────────────────────
import { View, Text, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { BL, FONT, STICKER_TONE, StickerTone } from './blush';

export function Sticker({
  label,
  tone = 'accent',
  tilt = 3,
  style,
}: {
  label: string;
  tone?: StickerTone;
  /** rotation en degrés (alterner +3 / −3). */
  tilt?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const c = STICKER_TONE[tone];
  return (
    <View style={[s.pill, { backgroundColor: c.bg, transform: [{ rotate: `${tilt}deg` }] }, style]}>
      <Text style={[s.txt, { color: c.fg }]} numberOfLines={1}>{label}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  pill: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 3,
  },
  txt: {
    fontFamily: FONT.body,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
});
