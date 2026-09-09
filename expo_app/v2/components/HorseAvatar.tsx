// HorseAvatar — photo du cheval (chevaux.photo_url) sinon pastille couleur + initiale.
import { View, Text, Image, StyleSheet } from 'react-native';
import { BL } from '../ui/blush';

export function HorseAvatar({
  photoUrl, couleur, nom, size = 34,
}: {
  photoUrl?: string;
  couleur?: string;
  nom?: string;
  size?: number;
}) {
  const r = Math.round(size * 0.35);
  if (photoUrl) {
    return <Image source={{ uri: photoUrl }} style={{ width: size, height: size, borderRadius: r, backgroundColor: BL.neutralSoft }} />;
  }
  return (
    <View style={[s.dot, { width: size, height: size, borderRadius: r, backgroundColor: couleur || BL.accent }]}>
      <Text style={[s.init, { fontSize: size * 0.4 }]}>{(nom || '?').slice(0, 1).toUpperCase()}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  dot: { alignItems: 'center', justifyContent: 'center' },
  init: { color: '#fff', fontWeight: '800' },
});
