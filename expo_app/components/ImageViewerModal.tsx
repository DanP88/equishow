// ─────────────────────────────────────────────────────────────────────────────
// ImageViewerModal — visionneuse plein écran pour les photos d'un post.
// Swipe horizontal entre les photos, compteur « 4/10 », fond noir.
// Aucune dépendance (Modal + FlatList paginée RN).
// ─────────────────────────────────────────────────────────────────────────────
import React, { useCallback, useRef, useState } from 'react';
import {
  Modal, View, Text, Image, FlatList, TouchableOpacity, StyleSheet,
  useWindowDimensions, Platform,
} from 'react-native';

interface Props {
  visible: boolean;
  urls: string[];        // URLs publiques (déjà résolues)
  initialIndex?: number;
  onClose: () => void;
}

export function ImageViewerModal({ visible, urls, initialIndex = 0, onClose }: Props) {
  const { width, height } = useWindowDimensions();
  const [index, setIndex] = useState(initialIndex);
  const listRef = useRef<FlatList>(null);

  const onViewRef = useRef(({ viewableItems }: any) => {
    if (viewableItems?.length) setIndex(viewableItems[0].index ?? 0);
  });
  const viewConfigRef = useRef({ viewAreaCoveragePercentThreshold: 60 });

  const onShow = useCallback(() => {
    setIndex(initialIndex);
    // positionne sans animation à l'ouverture
    requestAnimationFrame(() => {
      listRef.current?.scrollToIndex({ index: initialIndex, animated: false });
    });
  }, [initialIndex]);

  if (!urls.length) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onShow={onShow} onRequestClose={onClose}>
      <View style={s.backdrop}>
        <FlatList
          ref={listRef}
          data={urls}
          keyExtractor={(u, i) => `${i}-${u}`}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          initialScrollIndex={initialIndex}
          getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
          onScrollToIndexFailed={({ index: i }) => {
            setTimeout(() => listRef.current?.scrollToIndex({ index: i, animated: false }), 50);
          }}
          onViewableItemsChanged={onViewRef.current}
          viewabilityConfig={viewConfigRef.current}
          renderItem={({ item }) => (
            <TouchableOpacity activeOpacity={1} onPress={onClose} style={{ width, height, alignItems: 'center', justifyContent: 'center' }}>
              <Image source={{ uri: item }} style={{ width, height: height * 0.85 }} resizeMode="contain" />
            </TouchableOpacity>
          )}
        />

        <View style={s.counterWrap} pointerEvents="none">
          <Text style={s.counter}>{index + 1}/{urls.length}</Text>
        </View>

        <TouchableOpacity style={s.close} onPress={onClose} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Text style={s.closeTxt}>✕</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: '#000' },
  counterWrap: {
    position: 'absolute', top: Platform.OS === 'ios' ? 60 : 24, alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 4,
  },
  counter: { color: '#FFF', fontSize: 13, fontWeight: '700' },
  close: {
    position: 'absolute', top: Platform.OS === 'ios' ? 56 : 20, right: 16,
    width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center', justifyContent: 'center',
  },
  closeTxt: { color: '#FFF', fontSize: 18, fontWeight: '700' },
});
