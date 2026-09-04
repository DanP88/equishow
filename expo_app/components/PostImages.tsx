// ─────────────────────────────────────────────────────────────────────────────
// PostImages — grille de photos d'un post communauté (feed).
// Layouts type réseau social pour 1 à 10 photos ; au plus 6 tuiles affichées,
// la 6e porte « +X » quand il y en a plus. Tap → visionneuse plein écran.
// Proportions respectées (aspectRatio fixe + cover), jamais de débordement.
// ─────────────────────────────────────────────────────────────────────────────
import React, { useMemo, useState } from 'react';
import { View, Image, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Radius } from '../constants/theme';
import { communityPhotoUrl } from '../lib/communityPhotos';
import { ImageViewerModal } from './ImageViewerModal';

const GAP = 2;
const MAX_TILES = 6;

export function PostImages({ paths }: { paths: string[] }) {
  const urls = useMemo(() => (paths ?? []).map(communityPhotoUrl).filter(Boolean), [paths]);
  const [viewer, setViewer] = useState<{ open: boolean; index: number }>({ open: false, index: 0 });

  if (urls.length === 0) return null;

  const open = (i: number) => setViewer({ open: true, index: i });
  const n = urls.length;
  const shown = Math.min(n, MAX_TILES);
  const extra = n - shown; // > 0 seulement quand n > 6

  const Tile = ({ i, style }: { i: number; style?: any }) => (
    <TouchableOpacity activeOpacity={0.9} onPress={() => open(i)} style={[s.tile, style]}>
      <Image source={{ uri: urls[i] }} style={s.img} resizeMode="cover" />
      {i === shown - 1 && extra > 0 && (
        <View style={s.moreOverlay}>
          <Text style={s.moreTxt}>+{extra}</Text>
        </View>
      )}
    </TouchableOpacity>
  );

  return (
    <View style={s.wrap}>
      {n === 1 && (
        <View style={[s.row, { aspectRatio: 4 / 3 }]}>
          <Tile i={0} style={{ flex: 1 }} />
        </View>
      )}

      {n === 2 && (
        <View style={[s.row, { aspectRatio: 2 }]}>
          <Tile i={0} style={{ flex: 1 }} />
          <Tile i={1} style={{ flex: 1, marginLeft: GAP }} />
        </View>
      )}

      {n === 3 && (
        <View style={[s.row, { aspectRatio: 3 / 2 }]}>
          <Tile i={0} style={{ flex: 2 }} />
          <View style={{ flex: 1, marginLeft: GAP }}>
            <Tile i={1} style={{ flex: 1 }} />
            <Tile i={2} style={{ flex: 1, marginTop: GAP }} />
          </View>
        </View>
      )}

      {n === 4 && (
        <View style={s.grid2}>
          {[0, 1, 2, 3].map((i) => (
            <View key={i} style={s.cell2}><Tile i={i} style={{ flex: 1 }} /></View>
          ))}
        </View>
      )}

      {n >= 5 && (
        <View style={s.grid3}>
          {Array.from({ length: shown }).map((_, i) => (
            <View key={i} style={s.cell3}><Tile i={i} style={{ flex: 1 }} /></View>
          ))}
        </View>
      )}

      <ImageViewerModal
        visible={viewer.open}
        urls={urls}
        initialIndex={viewer.index}
        onClose={() => setViewer((v) => ({ ...v, open: false }))}
      />
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { borderRadius: Radius.md, overflow: 'hidden', marginBottom: 12 },
  row: { flexDirection: 'row', width: '100%' },
  tile: { backgroundColor: '#EEE', overflow: 'hidden' },
  img: { width: '100%', height: '100%' },
  grid2: { flexDirection: 'row', flexWrap: 'wrap' },
  cell2: { width: '50%', aspectRatio: 1, padding: GAP / 2 },
  grid3: { flexDirection: 'row', flexWrap: 'wrap' },
  cell3: { width: '33.333%', aspectRatio: 1, padding: GAP / 2 },
  moreOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center',
  },
  moreTxt: { color: '#FFF', fontSize: 22, fontWeight: '800' },
});
