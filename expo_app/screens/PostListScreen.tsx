import { useState } from 'react';
import {
  View,
  FlatList,
  StyleSheet,
  Text,
  SafeAreaView,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { usePosts, usePostMutations } from '../hooks/usePosts';
import { Colors } from '../constants/colors';
import { Spacing, Radius, FontSize, FontWeight } from '../constants/theme';
import PostCard from '../components/PostCard';

type PostType = 'community' | 'coach' | 'organisateur';

interface PostListScreenProps {
  type: PostType;
  title: string;
}

export default function PostListScreen({ type, title }: PostListScreenProps) {
  const { posts, isLoading, error, refresh } = usePosts(type);
  const { createPost, isCreating } = usePostMutations(type);
  const [showNewPost, setShowNewPost] = useState(false);
  const [titre, setTitre] = useState('');
  const [contenu, setContenu] = useState('');

  const handleCreatePost = async () => {
    if (!titre.trim() || !contenu.trim()) {
      Alert.alert('Erreur', 'Veuillez remplir le titre et le contenu');
      return;
    }

    const { data, error: createError } = await createPost({
      titre: titre.trim(),
      contenu: contenu.trim(),
    });

    if (createError) {
      Alert.alert('Erreur', createError);
    } else {
      Alert.alert('Succès', 'Post créé avec succès!');
      setTitre('');
      setContenu('');
      setShowNewPost(false);
    }
  };

  if (isLoading) {
    return (
      <SafeAreaView style={s.root}>
        <View style={s.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.root}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        {/* Header */}
        <View style={s.header}>
          <Text style={s.title}>{title}</Text>
          <TouchableOpacity
            style={s.newPostBtn}
            onPress={() => setShowNewPost(!showNewPost)}
          >
            <Text style={s.newPostBtnText}>+ Nouveau post</Text>
          </TouchableOpacity>
        </View>

        {/* New Post Form */}
        {showNewPost && (
          <View style={s.formContainer}>
            <TextInput
              style={s.input}
              placeholder="Titre du post"
              value={titre}
              onChangeText={setTitre}
              editable={!isCreating}
            />
            <TextInput
              style={[s.input, s.textArea]}
              placeholder="Votre message..."
              value={contenu}
              onChangeText={setContenu}
              multiline
              editable={!isCreating}
            />
            <View style={s.formButtons}>
              <TouchableOpacity
                style={[s.button, s.cancelBtn]}
                onPress={() => setShowNewPost(false)}
              >
                <Text style={s.cancelBtnText}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.button, s.submitBtn, isCreating && s.submitBtnDisabled]}
                onPress={handleCreatePost}
                disabled={isCreating}
              >
                {isCreating ? (
                  <ActivityIndicator color={Colors.textInverse} size="small" />
                ) : (
                  <Text style={s.submitBtnText}>Publier</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Error */}
        {error && (
          <View style={s.errorBox}>
            <Text style={s.errorText}>❌ {error}</Text>
          </View>
        )}

        {/* Posts List */}
        {posts.length === 0 ? (
          <View style={s.emptyContainer}>
            <Text style={s.emptyText}>Aucun post pour le moment</Text>
            <Text style={s.emptySubtext}>Soyez le premier à poster!</Text>
          </View>
        ) : (
          <FlatList
            data={posts}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <PostCard post={item} type={type} onRefresh={refresh} />
            )}
            scrollEnabled={true}
            contentContainerStyle={s.listContent}
            showsVerticalScrollIndicator={false}
          />
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  title: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
  },
  newPostBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.md,
  },
  newPostBtnText: {
    color: Colors.textInverse,
    fontWeight: FontWeight.bold,
    fontSize: FontSize.sm,
  },
  formContainer: {
    backgroundColor: Colors.surface,
    padding: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    gap: Spacing.md,
  },
  input: {
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    fontSize: FontSize.base,
    color: Colors.textPrimary,
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  formButtons: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  button: {
    flex: 1,
    paddingVertical: Spacing.md,
    borderRadius: Radius.md,
    alignItems: 'center',
  },
  cancelBtn: {
    backgroundColor: Colors.border,
  },
  cancelBtnText: {
    color: Colors.textPrimary,
    fontWeight: FontWeight.bold,
  },
  submitBtn: {
    backgroundColor: Colors.primary,
  },
  submitBtnDisabled: {
    opacity: 0.6,
  },
  submitBtnText: {
    color: Colors.textInverse,
    fontWeight: FontWeight.bold,
  },
  errorBox: {
    backgroundColor: '#FFE5E5',
    borderRadius: Radius.md,
    padding: Spacing.md,
    marginHorizontal: Spacing.lg,
    marginVertical: Spacing.md,
    borderLeftWidth: 4,
    borderLeftColor: '#FF4444',
  },
  errorText: {
    fontSize: FontSize.sm,
    color: '#CC0000',
    fontWeight: FontWeight.semibold,
  },
  listContent: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    gap: Spacing.md,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
  },
  emptyText: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
    marginBottom: Spacing.sm,
  },
  emptySubtext: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
  },
});
