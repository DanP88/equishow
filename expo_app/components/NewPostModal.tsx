// ─────────────────────────────────────────────────────────────────────────────
// NewPostModal — modale « Nouveau post » PARTAGÉE par les 3 fils communauté.
// Texte + 0 à 10 photos (sélection multiple, compteur X/10, aperçus, ✕ par
// photo). À la publication : upload sécurisé → création du post. En cas d'échec
// (upload ou insert) : nettoyage des images, aucun post partiel, message clair.
// ─────────────────────────────────────────────────────────────────────────────
import React, { useCallback, useState } from 'react';
import {
  Modal, View, Text, TextInput, TouchableOpacity, StyleSheet, Image,
  ScrollView, ActivityIndicator, KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import { Colors } from '../constants/colors';
import { Spacing, Radius, FontSize, FontWeight, Shadow } from '../constants/theme';
import {
  pickPostPhotos, uploadPostPhotos, MAX_POST_PHOTOS, type PickedPhoto,
} from '../lib/communityPhotos';

interface Props {
  visible: boolean;
  onClose: () => void;
  title: string;
  placeholder?: string;
  userId: string | undefined;
  createPost: (contenu: string, imagePaths?: string[]) => Promise<{ data: unknown; error: string | null }>;
  onCreated?: () => void;
}

function notify(msg: string) {
  if (Platform.OS === 'web' && typeof window !== 'undefined' && typeof window.alert === 'function') window.alert(msg);
  else Alert.alert('Publication', msg);
}

export function NewPostModal({ visible, onClose, title, placeholder, userId, createPost, onCreated }: Props) {
  const [text, setText] = useState('');
  const [photos, setPhotos] = useState<PickedPhoto[]>([]);
  const [busy, setBusy] = useState(false);

  const reset = useCallback(() => { setText(''); setPhotos([]); setBusy(false); }, []);
  const close = useCallback(() => { if (!busy) { reset(); onClose(); } }, [busy, reset, onClose]);

  const addPhotos = useCallback(async () => {
    const remaining = MAX_POST_PHOTOS - photos.length;
    if (remaining <= 0) return;
    const res = await pickPostPhotos(remaining);
    if ('error' in res) { notify(res.error); return; }
    if ('canceled' in res) return;
    setPhotos((cur) => [...cur, ...res.photos].slice(0, MAX_POST_PHOTOS));
  }, [photos.length]);

  const removePhoto = useCallback((idx: number) => {
    setPhotos((cur) => cur.filter((_, i) => i !== idx));
  }, []);

  const canPublish = !busy && (text.trim().length > 0 || photos.length > 0);

  const publish = useCallback(async () => {
    if (!canPublish) return;
    setBusy(true);
    try {
      let paths: string[] = [];
      if (photos.length > 0) {
        if (!userId) { notify('Non authentifié.'); setBusy(false); return; }
        const up = await uploadPostPhotos({ userId, photos });
        if (up.error) { notify(up.error); setBusy(false); return; } // images déjà nettoyées
        paths = up.paths;
      }
      const { error } = await createPost(text.trim(), paths);
      if (error) { notify(`Erreur : ${error}`); setBusy(false); return; } // hook nettoie les images
      reset();
      onClose();
      onCreated?.();
    } catch (e) {
      notify(e instanceof Error ? e.message : 'Erreur inattendue.');
      setBusy(false);
    }
  }, [canPublish, photos, userId, text, createPost, reset, onClose, onCreated]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={close}>
      <KeyboardAvoidingView style={s.overlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={s.modal}>
          <Text style={s.title}>{title}</Text>

          <TextInput
            style={s.input}
            value={text}
            onChangeText={setText}
            placeholder={placeholder ?? 'Partagez quelque chose...'}
            placeholderTextColor={Colors.textTertiary}
            multiline
            numberOfLines={4}
            editable={!busy}
            autoFocus
          />

          {/* Aperçus des photos sélectionnées */}
          {photos.length > 0 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.previews} contentContainerStyle={{ gap: Spacing.sm }}>
              {photos.map((p, i) => (
                <View key={`${i}-${p.uri.slice(-16)}`} style={s.previewItem}>
                  <Image source={{ uri: p.uri }} style={s.previewImg} resizeMode="cover" />
                  {!busy && (
                    <TouchableOpacity style={s.previewRemove} onPress={() => removePhoto(i)} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                      <Text style={s.previewRemoveTxt}>✕</Text>
                    </TouchableOpacity>
                  )}
                </View>
              ))}
            </ScrollView>
          )}

          {/* Ajouter des photos + compteur */}
          <View style={s.photoRow}>
            <TouchableOpacity
              style={[s.photoBtn, (busy || photos.length >= MAX_POST_PHOTOS) && s.photoBtnDisabled]}
              onPress={addPhotos}
              disabled={busy || photos.length >= MAX_POST_PHOTOS}
              activeOpacity={0.8}
            >
              <Text style={s.photoBtnTxt}>📷 Ajouter des photos</Text>
            </TouchableOpacity>
            <Text style={s.counter}>{photos.length}/{MAX_POST_PHOTOS}</Text>
          </View>

          <View style={s.actions}>
            <TouchableOpacity style={s.cancel} onPress={close} disabled={busy}>
              <Text style={s.cancelTxt}>Annuler</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.confirm, !canPublish && s.confirmDisabled]}
              onPress={publish}
              disabled={!canPublish}
              activeOpacity={0.85}
            >
              {busy
                ? <View style={s.busyRow}><ActivityIndicator size="small" color={Colors.textInverse} /><Text style={s.confirmTxt}>Envoi…</Text></View>
                : <Text style={s.confirmTxt}>Publier</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center', padding: Spacing.lg },
  modal: { backgroundColor: Colors.surface, borderRadius: Radius.xxl, padding: Spacing.xl, width: '100%', maxWidth: 480, ...Shadow.modal },
  title: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.textPrimary, marginBottom: Spacing.lg },
  input: {
    borderWidth: 1, borderColor: Colors.borderMedium, borderRadius: Radius.md, padding: Spacing.md,
    fontSize: FontSize.base, color: Colors.textPrimary, minHeight: 100, textAlignVertical: 'top', marginBottom: Spacing.md,
  },
  previews: { marginBottom: Spacing.md },
  previewItem: { width: 84, height: 84, borderRadius: Radius.md, overflow: 'hidden', backgroundColor: Colors.surfaceVariant },
  previewImg: { width: '100%', height: '100%' },
  previewRemove: {
    position: 'absolute', top: 3, right: 3, width: 22, height: 22, borderRadius: 11,
    backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center',
  },
  previewRemoveTxt: { color: '#FFF', fontSize: 12, fontWeight: '700' },
  photoRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.lg },
  photoBtn: {
    borderWidth: 1, borderColor: Colors.primaryBorder, backgroundColor: Colors.primaryLight,
    borderRadius: Radius.md, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
  },
  photoBtnDisabled: { opacity: 0.45 },
  photoBtnTxt: { color: Colors.primary, fontWeight: FontWeight.semibold, fontSize: FontSize.sm },
  counter: { color: Colors.textSecondary, fontSize: FontSize.sm, fontWeight: FontWeight.semibold },
  actions: { flexDirection: 'row', gap: Spacing.sm },
  cancel: { flex: 1, borderWidth: 1, borderColor: Colors.borderMedium, borderRadius: Radius.md, paddingVertical: Spacing.md, alignItems: 'center' },
  cancelTxt: { color: Colors.textSecondary, fontWeight: FontWeight.semibold },
  confirm: { flex: 1, backgroundColor: Colors.primary, borderRadius: Radius.md, paddingVertical: Spacing.md, alignItems: 'center' },
  confirmDisabled: { opacity: 0.5 },
  confirmTxt: { color: Colors.textInverse, fontWeight: FontWeight.bold },
  busyRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});
