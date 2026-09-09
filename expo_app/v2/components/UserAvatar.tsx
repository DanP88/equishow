// ─────────────────────────────────────────────────────────────────────────────
// UserAvatar — avatar utilisateur : photo (users.avatar_url) sinon initiales.
// Affichage seul. L'édition est dans ProfilV2 (via changeMyAvatar).
// ─────────────────────────────────────────────────────────────────────────────
import { View, Text, Image, StyleSheet, ActivityIndicator } from 'react-native';
import { BL } from '../ui/blush';

export function UserAvatar({
  url, initials, size = 40, busy = false, ring = false,
}: {
  url?: string | null;
  initials: string;
  size?: number;
  busy?: boolean;
  ring?: boolean;
}) {
  const r = size / 2;
  return (
    <View style={[
      s.wrap,
      { width: size, height: size, borderRadius: r },
      ring && { borderWidth: 2, borderColor: BL.accentSoft },
    ]}>
      {url
        ? <Image source={{ uri: url }} style={{ width: size, height: size, borderRadius: r }} />
        : <Text style={[s.txt, { fontSize: size * 0.38 }]}>{initials}</Text>}
      {busy && (
        <View style={[s.busy, { borderRadius: r }]}>
          <ActivityIndicator size="small" color="#fff" />
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { backgroundColor: BL.accent, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  txt: { color: BL.accentInk, fontWeight: '800' },
  busy: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.35)', alignItems: 'center', justifyContent: 'center' },
});
