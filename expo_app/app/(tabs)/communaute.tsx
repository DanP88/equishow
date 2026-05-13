import { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, SafeAreaView,
  TextInput, Modal, KeyboardAvoidingView, Platform, Linking, Alert,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Colors } from '../../constants/colors';
import { Spacing, Radius, FontSize, FontWeight, CommonStyles, Shadow } from '../../constants/theme';
import { postsStore, userStore, concoursCsvStore, concoursStore, CommunautePost } from '../../data/store';
import { createNotification } from '../../hooks/useNotifications';
import { getUserById } from '../../data/mockUsers';
import { ConcoursCSV } from '../../types/concours';

function timeAgo(date: Date): string {
  const diff = Date.now() - date.getTime();
  const h = Math.floor(diff / 3600000);
  if (h < 1) return "À l'instant";
  if (h < 24) return `Il y a ${h}h`;
  return `Il y a ${Math.floor(h / 24)}j`;
}

function getUserInitiales(): string {
  return (userStore.prenom.charAt(0) + userStore.nom.charAt(0)).toUpperCase();
}

type MainTab = 'communaute' | 'concours' | 'contact-concours';
type SortMode = 'date_asc' | 'date_desc' | 'region_asc';

export default function CommunauteScreen() {
  const [mainTab, setMainTab] = useState<MainTab>('communaute');
  const [posts, setPosts] = useState<CommunautePost[]>([...postsStore.list]);
  const [showNew, setShowNew] = useState(false);
  const [newText, setNewText] = useState('');
  const [openComments, setOpenComments] = useState<string | null>(null);
  const [commentText, setCommentText] = useState('');
  const [concoursList, setConcoursList] = useState([...concoursCsvStore.list]);
  const [concoursSearch, setConcoursSearch] = useState('');
  const [selectedConcours, setSelectedConcours] = useState<ConcoursCSV | null>(null);
  const [sortMode, setSortMode] = useState<SortMode>('date_asc');
  const [filterRegion, setFilterRegion] = useState('');
  const [filterEpreuve, setFilterEpreuve] = useState('');
  const [filterType, setFilterType] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  useFocusEffect(
    useCallback(() => {
      setPosts([...postsStore.list]);
      setConcoursList([...concoursCsvStore.list]);
    }, [])
  );

  function refresh() {
    setPosts([...postsStore.list]);
  }

  async function toggleLike(postId: string) {
    const uid = userStore.id;
    const post = postsStore.list.find(p => p.id === postId);
    if (!post) return;

    const alreadyLiked = post.likedBy.includes(uid);
    if (alreadyLiked) {
      post.likedBy = post.likedBy.filter(id => id !== uid);
      post.likes = Math.max(0, post.likes - 1);
      refresh();
    } else {
      post.likedBy = [...post.likedBy, uid];
      post.likes = post.likes + 1;
      refresh();
      if (post.auteurId !== uid) {
        await createNotification({
          destinataireId: post.auteurId,
          type: 'like',
          titre: `❤️ @${userStore.pseudo} a aimé votre post`,
          message: post.contenu.length > 60 ? post.contenu.slice(0, 60) + '…' : post.contenu,
          donnees: { postId },
        });
      }
    }
  }

  function handlePost() {
    if (!newText.trim()) return;
    const post: CommunautePost = {
      id: `post_${Date.now()}`,
      auteurId: userStore.id,
      auteur: `${userStore.prenom} ${userStore.nom}`,
      initiales: getUserInitiales(),
      couleur: userStore.avatarColor,
      contenu: newText.trim(),
      date: new Date(),
      likes: 0,
      likedBy: [],
      commentaires: [],
    };
    postsStore.list = [post, ...postsStore.list];
    setNewText('');
    setShowNew(false);
    refresh();
  }

  async function addComment(postId: string) {
    if (!commentText.trim()) return;
    const uid = userStore.id;
    const post = postsStore.list.find(p => p.id === postId);
    if (!post) return;

    const trimmed = commentText.trim();
    const comment = {
      id: `cmt_${Date.now()}`,
      auteurId: uid,
      auteur: `${userStore.prenom} ${userStore.nom}`,
      initiales: getUserInitiales(),
      couleur: userStore.avatarColor,
      texte: trimmed,
      date: "À l'instant",
      likes: 0,
      likedBy: [] as string[],
    };
    post.commentaires = [...post.commentaires, comment];
    setCommentText('');
    refresh();

    if (post.auteurId !== uid) {
      await createNotification({
        destinataireId: post.auteurId,
        type: 'comment',
        titre: `💬 @${userStore.pseudo} a commenté votre post`,
        message: trimmed.length > 60 ? trimmed.slice(0, 60) + '…' : trimmed,
        donnees: { postId },
      });
    }
  }

  async function toggleCommentLike(postId: string, commentId: string) {
    const uid = userStore.id;
    const post = postsStore.list.find(p => p.id === postId);
    if (!post) return;
    const comment = post.commentaires.find(c => c.id === commentId);
    if (!comment) return;

    const alreadyLiked = comment.likedBy.includes(uid);
    if (alreadyLiked) {
      comment.likedBy = comment.likedBy.filter(id => id !== uid);
      comment.likes = Math.max(0, comment.likes - 1);
      refresh();
    } else {
      comment.likedBy = [...comment.likedBy, uid];
      comment.likes = comment.likes + 1;
      refresh();
      if (comment.auteurId !== uid) {
        await createNotification({
          destinataireId: comment.auteurId,
          type: 'like',
          titre: `❤️ @${userStore.pseudo} a aimé votre commentaire`,
          message: comment.texte.length > 60 ? comment.texte.slice(0, 60) + '…' : comment.texte,
          donnees: { postId },
        });
      }
    }
  }

  // Lire directement depuis le store pour avoir les données à jour dans le modal
  const activePost = openComments ? postsStore.list.find((p) => p.id === openComments) ?? null : null;

  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Communauté</Text>
        <Text style={styles.headerSub}>Échangez avec la communauté équestre</Text>
      </View>

      {/* Onglets principaux */}
      <View style={styles.mainTabBar}>
        <TouchableOpacity
          style={[styles.mainTabBtn, mainTab === 'communaute' && styles.mainTabBtnActive]}
          onPress={() => setMainTab('communaute')}
          activeOpacity={0.8}
        >
          <Text style={[styles.mainTabLabel, mainTab === 'communaute' && styles.mainTabLabelActive]}>
            💬 Communauté
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.mainTabBtn, mainTab === 'concours' && styles.mainTabBtnActive]}
          onPress={() => setMainTab('concours')}
          activeOpacity={0.8}
        >
          <Text style={[styles.mainTabLabel, mainTab === 'concours' && styles.mainTabLabelActive]}>
            Info concours
          </Text>
          {concoursList.length > 0 && (
            <View style={[styles.mainTabBadge, mainTab === 'concours' && styles.mainTabBadgeActive]}>
              <Text style={[styles.mainTabBadgeText, mainTab === 'concours' && styles.mainTabBadgeTextActive]}>
                {concoursList.length}
              </Text>
            </View>
          )}
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.mainTabBtn, mainTab === 'contact-concours' && styles.mainTabBtnActive]}
          onPress={() => setMainTab('contact-concours')}
          activeOpacity={0.8}
        >
          <Text style={[styles.mainTabLabel, mainTab === 'contact-concours' && styles.mainTabLabelActive]}>
            📬 Contact concours
          </Text>
        </TouchableOpacity>
      </View>

      {/* ── ONGLET CONTACT CONCOURS ──────────────────────────────── */}
      {mainTab === 'contact-concours' && (() => {
        const upcoming = concoursStore.list.filter(c => c.statut !== 'brouillon' && c.statut !== 'termine');
        if (upcoming.length === 0) {
          return (
            <View style={styles.contactEmpty}>
              <Text style={styles.contactEmptyIcon}>🏟️</Text>
              <Text style={styles.contactEmptyText}>Aucun concours à venir pour le moment.</Text>
            </View>
          );
        }
        return (
          <ScrollView contentContainerStyle={styles.contactList}>
            <Text style={styles.contactSectionTitle}>🏟️ Concours à venir</Text>
            {upcoming.map((concours) => {
              const org = getUserById(concours.organisateurId);
              return (
                <View key={concours.id} style={styles.contactCard}>
                  <Text style={styles.contactName}>{concours.nom}</Text>
                  <Text style={styles.contactMeta}>
                    📅 {concours.dateDebut.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })} · {concours.lieu}
                  </Text>
                  <Text style={styles.contactMeta}>🎯 {concours.disciplines.join(', ')}</Text>
                  <Text style={styles.contactMeta}>Niveaux : {concours.typesCavaliers.join(', ')}</Text>
                  {concours.prix ? <Text style={styles.contactMeta}>💰 {concours.prix}€</Text> : null}
                  <Text style={styles.contactMeta}>👤 {concours.organisateurNom}</Text>
                  {org && (
                    <TouchableOpacity
                      style={styles.contactBtn}
                      onPress={() => router.push({
                        pathname: '/messagerie',
                        params: {
                          otherId: org.id,
                          otherNom: org.prenom + ' ' + org.nom,
                          otherPseudo: org.pseudo,
                          otherCouleur: org.avatarColor,
                          otherInitiales: org.initiales,
                          sujet: `🏆 ${concours.nom}`,
                        },
                      } as any)}
                    >
                      <Text style={styles.contactBtnText}>💬 Contacter l'organisateur</Text>
                    </TouchableOpacity>
                  )}
                </View>
              );
            })}
          </ScrollView>
        );
      })()}

      {/* ── ONGLET INFO CONCOURS ─────────────────────────────────── */}
      {mainTab === 'concours' && (() => {
        // Listes dédupliquées pour les dropdowns
        const allRegions = [...new Set(concoursList.map(c => c.cre ?? '').filter(Boolean))].sort();
        const allEpreuves = [...new Set(concoursList.flatMap(c => c.liste_epreuves))].sort();
        const allTypes = [...new Set(concoursList.map(c => c.type_concours ?? '').filter(Boolean))].sort();

        // Filtrage
        const search = concoursSearch.toLowerCase();
        let filtered = concoursList.filter(c => {
          if (search && !(
            c.nom_concours.toLowerCase().includes(search) ||
            (c.lieu ?? '').toLowerCase().includes(search) ||
            (c.departement ?? '').toLowerCase().includes(search) ||
            (c.type_concours ?? '').toLowerCase().includes(search) ||
            (c.cre ?? '').toLowerCase().includes(search)
          )) return false;
          if (filterRegion && c.cre !== filterRegion) return false;
          if (filterEpreuve && !c.liste_epreuves.includes(filterEpreuve)) return false;
          if (filterType && c.type_concours !== filterType) return false;
          return true;
        });

        // Tri
        if (sortMode === 'date_asc') filtered = [...filtered].sort((a, b) => (a.date_debut ?? '').localeCompare(b.date_debut ?? ''));
        if (sortMode === 'date_desc') filtered = [...filtered].sort((a, b) => (b.date_debut ?? '').localeCompare(a.date_debut ?? ''));
        if (sortMode === 'region_asc') filtered = [...filtered].sort((a, b) => (a.cre ?? '').localeCompare(b.cre ?? ''));

        const hasFilters = filterRegion || filterEpreuve || filterType || sortMode !== 'date_asc';

        return (
          <>
            {/* Barre recherche + bouton filtres */}
            <View style={styles.csvSearchRow}>
              <Text style={styles.csvSearchIcon}>🔍</Text>
              <TextInput
                style={styles.csvSearchInput}
                value={concoursSearch}
                onChangeText={setConcoursSearch}
                placeholder="Rechercher un concours..."
                placeholderTextColor={Colors.textTertiary}
              />
              {concoursSearch.length > 0 && (
                <TouchableOpacity onPress={() => setConcoursSearch('')}>
                  <Text style={styles.csvSearchClear}>✕</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={[styles.filterToggleBtn, hasFilters && styles.filterToggleBtnActive]}
                onPress={() => setShowFilters(v => !v)}
              >
                <Text style={styles.filterToggleIcon}>⚙️</Text>
                {hasFilters && <View style={styles.filterDot} />}
              </TouchableOpacity>
            </View>

            {/* Panel filtres */}
            {showFilters && (
              <View style={styles.filterPanel}>
                {/* Tri */}
                <Text style={styles.filterSectionLabel}>TRI</Text>
                <View style={styles.filterChips}>
                  {([
                    ['date_asc', '📅 Date ↑'],
                    ['date_desc', '📅 Date ↓'],
                    ['region_asc', '📍 Région A→Z'],
                  ] as [SortMode, string][]).map(([mode, label]) => (
                    <TouchableOpacity
                      key={mode}
                      style={[styles.chip, sortMode === mode && styles.chipActive]}
                      onPress={() => setSortMode(mode)}
                    >
                      <Text style={[styles.chipText, sortMode === mode && styles.chipTextActive]}>{label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Type */}
                <Text style={styles.filterSectionLabel}>TYPE DE CONCOURS</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: Spacing.sm }}>
                  <View style={styles.filterChips}>
                    <TouchableOpacity
                      style={[styles.chip, !filterType && styles.chipActive]}
                      onPress={() => setFilterType('')}
                    >
                      <Text style={[styles.chipText, !filterType && styles.chipTextActive]}>Tous</Text>
                    </TouchableOpacity>
                    {allTypes.map(t => (
                      <TouchableOpacity
                        key={t}
                        style={[styles.chip, filterType === t && styles.chipActive]}
                        onPress={() => setFilterType(filterType === t ? '' : t)}
                      >
                        <Text style={[styles.chipText, filterType === t && styles.chipTextActive]}>{t}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </ScrollView>

                {/* Région */}
                <Text style={styles.filterSectionLabel}>RÉGION</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: Spacing.sm }}>
                  <View style={styles.filterChips}>
                    <TouchableOpacity
                      style={[styles.chip, !filterRegion && styles.chipActive]}
                      onPress={() => setFilterRegion('')}
                    >
                      <Text style={[styles.chipText, !filterRegion && styles.chipTextActive]}>Toutes</Text>
                    </TouchableOpacity>
                    {allRegions.map(r => (
                      <TouchableOpacity
                        key={r}
                        style={[styles.chip, filterRegion === r && styles.chipActive]}
                        onPress={() => setFilterRegion(filterRegion === r ? '' : r)}
                      >
                        <Text style={[styles.chipText, filterRegion === r && styles.chipTextActive]}>{r.replace('CRE ', '')}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </ScrollView>

                {/* Épreuve */}
                <Text style={styles.filterSectionLabel}>ÉPREUVE</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: Spacing.xs }}>
                  <View style={styles.filterChips}>
                    <TouchableOpacity
                      style={[styles.chip, !filterEpreuve && styles.chipActive]}
                      onPress={() => setFilterEpreuve('')}
                    >
                      <Text style={[styles.chipText, !filterEpreuve && styles.chipTextActive]}>Toutes</Text>
                    </TouchableOpacity>
                    {allEpreuves.map(e => (
                      <TouchableOpacity
                        key={e}
                        style={[styles.chip, filterEpreuve === e && styles.chipActive]}
                        onPress={() => setFilterEpreuve(filterEpreuve === e ? '' : e)}
                      >
                        <Text style={[styles.chipText, filterEpreuve === e && styles.chipTextActive]}>{e}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </ScrollView>

                {hasFilters && (
                  <TouchableOpacity onPress={() => { setSortMode('date_asc'); setFilterRegion(''); setFilterEpreuve(''); setFilterType(''); }}>
                    <Text style={styles.filterReset}>Réinitialiser les filtres</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}

            <ScrollView contentContainerStyle={[styles.list, { paddingTop: Spacing.sm }]}>
              {concoursList.length === 0 ? (
                <View style={styles.csvEmpty}>
                  <Text style={styles.csvEmptyIcon}>📋</Text>
                  <Text style={styles.csvEmptyTitle}>Aucun concours disponible</Text>
                  <Text style={styles.csvEmptyText}>Les concours importés par l'administrateur apparaîtront ici.</Text>
                </View>
              ) : (
                <>
                  <Text style={styles.csvCount}>
                    {filtered.length} concours{concoursSearch || hasFilters ? ' trouvés' : ' disponibles'}
                  </Text>
                  {filtered.length === 0 && (
                    <Text style={styles.csvNoResult}>Aucun résultat pour ces filtres</Text>
                  )}
                  {filtered.map((c) => (
                    <TouchableOpacity key={c.id} style={styles.csvCard} onPress={() => setSelectedConcours(c)} activeOpacity={0.85}>
                      <View style={styles.csvCardTop}>
                        <View style={styles.csvCardTitleRow}>
                          <Text style={styles.csvCardName}>{c.nom_concours}</Text>
                          {c.etat && (
                            <View style={[styles.csvEtatBadge, c.etat.toLowerCase().includes('ouvert') && styles.csvEtatOuvert]}>
                              <Text style={styles.csvEtatText}>{c.etat}</Text>
                            </View>
                          )}
                        </View>
                        {c.type_concours && <Text style={styles.csvType}>{c.type_concours}</Text>}
                      </View>
                      <View style={styles.csvMeta}>
                        {(c.date_debut || c.date_fin) && (
                          <Text style={styles.csvMetaItem}>📅 {c.date_debut ?? '?'} → {c.date_fin ?? '?'}</Text>
                        )}
                        {c.lieu && (
                          <Text style={styles.csvMetaItem}>📍 {c.lieu}{c.departement ? ` (${c.departement})` : ''}</Text>
                        )}
                        {c.cre && (
                          <Text style={styles.csvMetaItem}>🗺️ {c.cre.replace('CRE ', '')}</Text>
                        )}
                      </View>
                      {c.liste_epreuves.length > 0 && (
                        <View style={styles.csvEpreuves}>
                          <Text style={styles.csvEpreuvesText}>{c.liste_epreuves.join(' · ')}</Text>
                        </View>
                      )}
                      <Text style={styles.csvCta}>Voir les détails →</Text>
                    </TouchableOpacity>
                  ))}
                  <View style={{ height: 100 }} />
                </>
              )}
            </ScrollView>
          </>
        );
      })()}

      {/* ── ONGLET COMMUNAUTÉ ────────────────────────────────────── */}
      {mainTab === 'communaute' && (
      <ScrollView contentContainerStyle={styles.list}>
        {posts.map((post) => {
          const liked = post.likedBy.includes(userStore.id);
          return (
            <View key={post.id} style={styles.card}>
              <TouchableOpacity
                style={styles.postHeader}
                onPress={() => router.push(`/user-profile/${post.auteur}`)}
                activeOpacity={0.7}
              >
                <View style={[styles.avatar, { backgroundColor: post.couleur }]}>
                  <Text style={styles.avatarText}>{post.initiales}</Text>
                </View>
                <View style={styles.postMeta}>
                  <Text style={styles.auteur}>{post.auteur}</Text>
                  <Text style={styles.date}>{timeAgo(post.date)}</Text>
                </View>
              </TouchableOpacity>
              <Text style={styles.contenu}>{post.contenu}</Text>
              <View style={styles.actions}>
                <TouchableOpacity style={styles.actionBtn} onPress={() => toggleLike(post.id)}>
                  <Text style={[styles.actionIcon, liked && { color: Colors.urgent }]}>
                    {liked ? '❤️' : '🤍'}
                  </Text>
                  <Text style={[styles.actionText, liked && { color: Colors.urgent }]}>{post.likes}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.actionBtn} onPress={() => { setOpenComments(post.id); setCommentText(''); }}>
                  <Text style={styles.actionIcon}>💬</Text>
                  <Text style={styles.actionText}>{post.commentaires.length}</Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        })}
        <View style={{ height: 100 }} />
      </ScrollView>
      )} {/* fin mainTab === 'communaute' */}

      {/* FAB nouveau post */}
      <TouchableOpacity style={styles.fab} onPress={() => setShowNew(true)} activeOpacity={0.85}>
        <Text style={styles.fabText}>+ Publier</Text>
      </TouchableOpacity>

      {/* Modal nouveau post */}
      <Modal visible={showNew} transparent animationType="fade">
        <View style={styles.overlay}>
          <View style={styles.newPostModal}>
            <Text style={styles.modalTitle}>Nouveau post</Text>
            <TextInput
              style={styles.modalInput}
              value={newText}
              onChangeText={setNewText}
              placeholder="Partagez quelque chose..."
              placeholderTextColor={Colors.textTertiary}
              multiline
              numberOfLines={4}
              autoFocus
            />
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalCancel} onPress={() => setShowNew(false)}>
                <Text style={styles.modalCancelText}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalConfirm} onPress={handlePost}>
                <Text style={styles.modalConfirmText}>Publier</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal commentaires */}
      <Modal visible={!!openComments} transparent animationType="slide">
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <TouchableOpacity style={styles.commentsBackdrop} activeOpacity={1} onPress={() => setOpenComments(null)}>
            <TouchableOpacity activeOpacity={1} style={styles.commentsSheet}>
              <View style={styles.commentsHandle} />
              <Text style={styles.commentsTitle}>
                Commentaires{activePost ? ` (${activePost.commentaires.length})` : ''}
              </Text>
              <ScrollView style={styles.commentsList}>
                {activePost?.commentaires.map((c) => {
                  const cmtLiked = c.likedBy.includes(userStore.id);
                  return (
                  <View key={c.id} style={styles.commentRow}>
                    <TouchableOpacity
                      onPress={() => {
                        setOpenComments(null);
                        router.push(`/user-profile/${c.auteur}`);
                      }}
                      activeOpacity={0.7}
                    >
                      <View style={[styles.commentAvatar, { backgroundColor: c.couleur }]}>
                        <Text style={styles.commentAvatarText}>{c.initiales}</Text>
                      </View>
                    </TouchableOpacity>
                    <View style={styles.commentBubble}>
                      <View style={styles.commentBubbleTop}>
                        <Text style={styles.commentAuteur}>{c.auteur}</Text>
                        <Text style={styles.commentDate}>{c.date}</Text>
                      </View>
                      <Text style={styles.commentTexte}>{c.texte}</Text>
                      <TouchableOpacity
                        style={styles.commentLikeBtn}
                        onPress={() => openComments && toggleCommentLike(openComments, c.id)}
                        activeOpacity={0.7}
                      >
                        <Text style={[styles.commentLikeIcon, cmtLiked && { color: Colors.urgent }]}>
                          {cmtLiked ? '❤️' : '🤍'}
                        </Text>
                        {c.likes > 0 && (
                          <Text style={[styles.commentLikeCount, cmtLiked && { color: Colors.urgent }]}>
                            {c.likes}
                          </Text>
                        )}
                      </TouchableOpacity>
                    </View>
                  </View>
                  );
                })}
                {activePost?.commentaires.length === 0 && (
                  <Text style={styles.noComments}>Soyez le premier à commenter ✨</Text>
                )}
              </ScrollView>
              <View style={styles.commentInputRow}>
                <View style={[styles.commentAvatar, { backgroundColor: userStore.avatarColor }]}>
                  <Text style={styles.commentAvatarText}>{getUserInitiales()}</Text>
                </View>
                <TextInput
                  style={styles.commentInput}
                  value={commentText}
                  onChangeText={setCommentText}
                  placeholder="Ajouter un commentaire..."
                  placeholderTextColor={Colors.textTertiary}
                  multiline
                />
                <TouchableOpacity
                  style={[styles.commentSendBtn, !commentText.trim() && styles.commentSendBtnDisabled]}
                  onPress={() => openComments && addComment(openComments)}
                  disabled={!commentText.trim()}
                >
                  <Text style={styles.commentSendIcon}>➤</Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </Modal>
      {/* Modal détail concours */}
      <Modal visible={!!selectedConcours} transparent animationType="slide" onRequestClose={() => setSelectedConcours(null)}>
        <TouchableOpacity style={styles.detailBackdrop} activeOpacity={1} onPress={() => setSelectedConcours(null)}>
          <TouchableOpacity activeOpacity={1} style={styles.detailSheet}>
            {selectedConcours && <ConcoursDetail concours={selectedConcours} onClose={() => setSelectedConcours(null)} />}
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

// ── Composant détail concours ───────────────────────────────────────────────

function ConcoursDetail({ concours: c, onClose }: { concours: ConcoursCSV; onClose: () => void }) {
  const ffeUrl = c.numero_concours
    ? `https://www.ffe.com/competitions/Calendrier/Show/${c.numero_concours}`
    : 'https://www.ffe.com/competitions/Calendrier';

  function openFFE() {
    Linking.openURL(ffeUrl).catch(() => Alert.alert('Erreur', "Impossible d'ouvrir le lien FFE."));
  }

  return (
    <>
      <View style={styles.detailHandle} />
      <View style={styles.detailHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.detailTitle}>{c.nom_concours}</Text>
          {c.type_concours && <Text style={styles.detailType}>{c.type_concours}</Text>}
        </View>
        <TouchableOpacity style={styles.detailCloseBtn} onPress={onClose}>
          <Text style={styles.detailCloseIcon}>✕</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.detailContent} showsVerticalScrollIndicator={false}>
        {c.etat && (
          <View style={[styles.detailEtatBadge, c.etat.toLowerCase().includes('ouvert') && styles.detailEtatOuvert]}>
            <Text style={[styles.detailEtatText, c.etat.toLowerCase().includes('ouvert') && styles.detailEtatTextOuvert]}>{c.etat}</Text>
          </View>
        )}

        <View style={styles.detailSection}>
          <Text style={styles.detailSectionTitle}>📅 DATES</Text>
          <View style={styles.detailRow}><Text style={styles.detailLabel}>Début</Text><Text style={styles.detailValue}>{c.date_debut ?? '—'}</Text></View>
          <View style={styles.detailRow}><Text style={styles.detailLabel}>Fin</Text><Text style={styles.detailValue}>{c.date_fin ?? '—'}</Text></View>
          {c.date_cloture && <View style={styles.detailRow}><Text style={styles.detailLabel}>Clôture inscriptions</Text><Text style={[styles.detailValue, { color: Colors.urgent }]}>{c.date_cloture}</Text></View>}
        </View>

        <View style={styles.detailSection}>
          <Text style={styles.detailSectionTitle}>📍 LIEU</Text>
          {c.lieu && <View style={styles.detailRow}><Text style={styles.detailLabel}>Lieu</Text><Text style={styles.detailValue}>{c.lieu}</Text></View>}
          {c.adresse && <View style={styles.detailRow}><Text style={styles.detailLabel}>Adresse</Text><Text style={styles.detailValue}>{c.adresse}</Text></View>}
          {c.departement && <View style={styles.detailRow}><Text style={styles.detailLabel}>Département</Text><Text style={styles.detailValue}>{c.departement}</Text></View>}
          {c.cre && <View style={styles.detailRow}><Text style={styles.detailLabel}>Comité régional</Text><Text style={styles.detailValue}>{c.cre}</Text></View>}
        </View>

        {(c.organisateur_terrain || c.organisateur_financier) && (
          <View style={styles.detailSection}>
            <Text style={styles.detailSectionTitle}>👤 ORGANISATEURS</Text>
            {c.organisateur_terrain && <View style={styles.detailRow}><Text style={styles.detailLabel}>Terrain</Text><Text style={styles.detailValue}>{c.organisateur_terrain}</Text></View>}
            {c.organisateur_financier && <View style={styles.detailRow}><Text style={styles.detailLabel}>Financier</Text><Text style={styles.detailValue}>{c.organisateur_financier}</Text></View>}
          </View>
        )}

        {c.numero_concours && (
          <View style={styles.detailSection}>
            <Text style={styles.detailSectionTitle}>🏆 CONCOURS</Text>
            <View style={styles.detailRow}><Text style={styles.detailLabel}>Numéro</Text><Text style={styles.detailValue}>{c.numero_concours}</Text></View>
          </View>
        )}

        {c.liste_epreuves.length > 0 && (
          <View style={styles.detailSection}>
            <Text style={styles.detailSectionTitle}>🏇 ÉPREUVES ({c.liste_epreuves.length})</Text>
            {c.liste_epreuves.map((ep, i) => (
              <View key={i} style={styles.detailEpreuveRow}>
                <View style={styles.detailEpreuveDot} />
                <Text style={styles.detailEpreuveText}>{ep}</Text>
              </View>
            ))}
          </View>
        )}

        <View style={styles.detailFfeBox}>
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={styles.detailFfeTitle}>S'inscrire via la FFE</Text>
            <Text style={styles.detailFfeUrl} numberOfLines={1}>{ffeUrl}</Text>
          </View>
          <TouchableOpacity style={styles.detailFfeBtn} onPress={openFFE} activeOpacity={0.8}>
            <Text style={styles.detailFfeBtnText}>Ouvrir ↗</Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: 16 }} />
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  header: { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, backgroundColor: Colors.surface, borderBottomWidth: 1, borderBottomColor: Colors.border },
  headerTitle: { fontSize: FontSize.xl, fontWeight: FontWeight.extrabold, color: Colors.textPrimary },
  headerSub: { fontSize: FontSize.sm, color: Colors.textTertiary, marginTop: 2 },
  list: { padding: Spacing.lg, gap: Spacing.md },
  card: { ...CommonStyles.card, padding: Spacing.lg },
  postHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, marginBottom: Spacing.md },
  avatar: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: Colors.textInverse, fontWeight: FontWeight.bold, fontSize: FontSize.sm },
  postMeta: {},
  auteur: { fontSize: FontSize.base, fontWeight: FontWeight.semibold, color: Colors.textPrimary },
  date: { fontSize: FontSize.xs, color: Colors.textTertiary },
  contenu: { fontSize: FontSize.base, color: Colors.textPrimary, lineHeight: 22, marginBottom: Spacing.md },
  actions: { flexDirection: 'row', gap: Spacing.lg, borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: Spacing.sm },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, paddingVertical: Spacing.xs },
  actionIcon: { fontSize: 18 },
  actionText: { fontSize: FontSize.sm, color: Colors.textSecondary, fontWeight: FontWeight.semibold },
  fab: { position: 'absolute', bottom: 100, right: Spacing.lg, backgroundColor: Colors.primary, borderRadius: 28, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, ...Shadow.fab },
  fabText: { color: Colors.textInverse, fontWeight: FontWeight.bold, fontSize: FontSize.base },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center', padding: Spacing.lg },
  newPostModal: { backgroundColor: Colors.surface, borderRadius: Radius.xxl, padding: Spacing.xl, width: '100%', ...Shadow.modal },
  modalTitle: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.textPrimary, marginBottom: Spacing.lg },
  modalInput: { borderWidth: 1, borderColor: Colors.borderMedium, borderRadius: Radius.md, padding: Spacing.md, fontSize: FontSize.base, color: Colors.textPrimary, minHeight: 100, textAlignVertical: 'top', marginBottom: Spacing.lg },
  modalActions: { flexDirection: 'row', gap: Spacing.sm },
  modalCancel: { flex: 1, borderWidth: 1, borderColor: Colors.borderMedium, borderRadius: Radius.md, paddingVertical: Spacing.md, alignItems: 'center' },
  modalCancelText: { color: Colors.textSecondary, fontWeight: FontWeight.semibold },
  modalConfirm: { flex: 1, backgroundColor: Colors.primary, borderRadius: Radius.md, paddingVertical: Spacing.md, alignItems: 'center' },
  modalConfirmText: { color: Colors.textInverse, fontWeight: FontWeight.bold },

  commentsBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  commentsSheet: { backgroundColor: Colors.surface, borderTopLeftRadius: Radius.xxl, borderTopRightRadius: Radius.xxl, paddingTop: Spacing.md, maxHeight: '80%' },
  commentsHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: Colors.borderMedium, alignSelf: 'center', marginBottom: Spacing.md },
  commentsTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.textPrimary, paddingHorizontal: Spacing.xl, marginBottom: Spacing.md },
  commentsList: { maxHeight: 320, paddingHorizontal: Spacing.lg },
  commentRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.md, alignItems: 'flex-start' },
  commentAvatar: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  commentAvatarText: { color: Colors.textInverse, fontSize: FontSize.xs, fontWeight: FontWeight.bold },
  commentBubble: { flex: 1, backgroundColor: Colors.surfaceVariant, borderRadius: Radius.lg, padding: Spacing.sm + 2, borderWidth: 1, borderColor: Colors.border },
  commentBubbleTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 3 },
  commentAuteur: { fontSize: FontSize.xs, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  commentDate: { fontSize: 10, color: Colors.textTertiary },
  commentTexte: { fontSize: FontSize.sm, color: Colors.textPrimary, lineHeight: 18 },
  commentLikeBtn: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 4, alignSelf: 'flex-start' },
  commentLikeIcon: { fontSize: 13 },
  commentLikeCount: { fontSize: 11, color: Colors.textTertiary, fontWeight: FontWeight.semibold },
  noComments: { textAlign: 'center', color: Colors.textTertiary, fontSize: FontSize.sm, paddingVertical: Spacing.xl },
  commentInputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: Spacing.sm, padding: Spacing.lg, borderTopWidth: 1, borderTopColor: Colors.border },
  commentInput: { flex: 1, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.xl, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, fontSize: FontSize.base, color: Colors.textPrimary, backgroundColor: Colors.surfaceVariant, maxHeight: 80 },
  commentSendBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
  commentSendBtnDisabled: { backgroundColor: Colors.borderMedium },
  commentSendIcon: { color: Colors.textInverse, fontSize: 16 },

  // Onglets principaux
  mainTabBar: { flexDirection: 'row', backgroundColor: Colors.surface, borderBottomWidth: 1, borderBottomColor: Colors.border, paddingHorizontal: Spacing.lg, gap: Spacing.sm },
  contactList: { padding: Spacing.lg, gap: Spacing.md, paddingBottom: 120 },
  contactSectionTitle: { fontSize: FontSize.base, fontWeight: FontWeight.bold, color: Colors.textPrimary, marginBottom: Spacing.sm },
  contactCard: { ...CommonStyles.card, padding: Spacing.lg, gap: 4 },
  contactName: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.textPrimary, marginBottom: Spacing.xs },
  contactMeta: { fontSize: FontSize.sm, color: Colors.textSecondary },
  contactBtn: { marginTop: Spacing.sm, paddingVertical: Spacing.sm, paddingHorizontal: Spacing.md, borderRadius: Radius.md, backgroundColor: '#EFF6FF', borderWidth: 1, borderColor: '#93C5FD', alignItems: 'center' },
  contactBtnText: { color: '#1D4ED8', fontWeight: FontWeight.semibold, fontSize: FontSize.sm },
  contactEmpty: { alignItems: 'center', justifyContent: 'center', padding: Spacing.xxl, gap: Spacing.md },
  contactEmptyIcon: { fontSize: 48 },
  contactEmptyText: { fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: 'center' },
  mainTabBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: Spacing.md, paddingHorizontal: Spacing.sm, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  mainTabBtnActive: { borderBottomColor: Colors.primary },
  mainTabLabel: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: Colors.textSecondary },
  mainTabLabelActive: { color: Colors.primary },
  mainTabBadge: { backgroundColor: Colors.border, borderRadius: 10, minWidth: 22, paddingHorizontal: 6, paddingVertical: 2, alignItems: 'center' },
  mainTabBadgeActive: { backgroundColor: Colors.primaryLight },
  mainTabBadgeText: { fontSize: 10, fontWeight: FontWeight.bold, color: Colors.textSecondary },
  mainTabBadgeTextActive: { color: Colors.primary },

  // CSV Concours
  csvSearchRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surface, borderBottomWidth: 1, borderBottomColor: Colors.border, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm, gap: Spacing.sm },
  csvSearchIcon: { fontSize: 14, color: Colors.textTertiary },
  csvSearchInput: { flex: 1, paddingVertical: Spacing.sm, fontSize: FontSize.base, color: Colors.textPrimary },
  csvSearchClear: { fontSize: 14, color: Colors.textTertiary, paddingHorizontal: 4 },
  filterToggleBtn: { padding: 6, borderRadius: Radius.md, backgroundColor: Colors.surfaceVariant, position: 'relative' },
  filterToggleBtnActive: { backgroundColor: Colors.primary + '22' },
  filterToggleIcon: { fontSize: 16 },
  filterDot: { position: 'absolute', top: 2, right: 2, width: 7, height: 7, borderRadius: 4, backgroundColor: Colors.primary },
  filterPanel: { backgroundColor: Colors.surface, borderBottomWidth: 1, borderBottomColor: Colors.border, paddingHorizontal: Spacing.lg, paddingTop: Spacing.md, paddingBottom: Spacing.sm },
  filterSectionLabel: { fontSize: FontSize.xs, fontWeight: FontWeight.bold, color: Colors.textTertiary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: Spacing.xs, marginTop: Spacing.sm },
  filterChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingRight: Spacing.lg },
  chip: { paddingHorizontal: Spacing.md, paddingVertical: 5, borderRadius: Radius.lg, backgroundColor: Colors.surfaceVariant, borderWidth: 1, borderColor: Colors.border },
  chipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  chipText: { fontSize: FontSize.xs, color: Colors.textSecondary, fontWeight: FontWeight.semibold },
  chipTextActive: { color: '#fff' },
  filterReset: { fontSize: FontSize.xs, color: Colors.urgent, fontWeight: FontWeight.semibold, textAlign: 'center', paddingVertical: Spacing.sm },
  csvEmpty: { alignItems: 'center', paddingVertical: 60, gap: Spacing.md },
  csvEmptyIcon: { fontSize: 48 },
  csvEmptyTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  csvEmptyText: { fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: 'center' },
  csvCount: { fontSize: FontSize.sm, color: Colors.textTertiary, marginBottom: 4 },
  csvNoResult: { textAlign: 'center', color: Colors.textTertiary, fontSize: FontSize.sm, paddingVertical: 20 },
  csvCard: { backgroundColor: Colors.surface, borderRadius: Radius.xl, padding: Spacing.lg, borderWidth: 1, borderColor: Colors.border, gap: Spacing.sm, ...Shadow.card },
  csvCardTop: { gap: 4 },
  csvCardTitleRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: Spacing.sm },
  csvCardName: { fontSize: FontSize.base, fontWeight: FontWeight.bold, color: Colors.textPrimary, flex: 1 },
  csvType: { fontSize: FontSize.xs, color: Colors.primary, fontWeight: FontWeight.semibold },
  csvEtatBadge: { backgroundColor: Colors.surfaceVariant, borderRadius: Radius.sm, paddingHorizontal: 8, paddingVertical: 2 },
  csvEtatOuvert: { backgroundColor: '#DCFCE7' },
  csvEtatText: { fontSize: 10, fontWeight: FontWeight.bold, color: Colors.textSecondary },
  csvMeta: { gap: 3 },
  csvMetaItem: { fontSize: FontSize.sm, color: Colors.textSecondary },
  csvEpreuves: { backgroundColor: Colors.surfaceVariant, borderRadius: Radius.md, padding: Spacing.sm },
  csvEpreuvesText: { fontSize: FontSize.xs, color: Colors.textSecondary, lineHeight: 16 },
  csvCta: { fontSize: FontSize.xs, color: Colors.primary, fontWeight: FontWeight.semibold, textAlign: 'right', marginTop: 2 },

  // Modal détail
  detailBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  detailSheet: { backgroundColor: Colors.background, borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '88%' },
  detailHandle: { width: 40, height: 5, borderRadius: 3, backgroundColor: Colors.borderMedium, alignSelf: 'center', marginTop: 10, marginBottom: 4 },
  detailHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.md, paddingHorizontal: Spacing.lg, paddingTop: Spacing.md, paddingBottom: Spacing.sm, borderBottomWidth: 1, borderBottomColor: Colors.border },
  detailTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.textPrimary, lineHeight: 24 },
  detailType: { fontSize: FontSize.sm, color: Colors.primary, fontWeight: FontWeight.semibold, marginTop: 2 },
  detailCloseBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: Colors.surfaceVariant, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  detailCloseIcon: { fontSize: 14, color: Colors.textSecondary, fontWeight: FontWeight.bold },
  detailContent: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.md, gap: Spacing.md },
  detailEtatBadge: { alignSelf: 'flex-start', backgroundColor: Colors.surfaceVariant, borderRadius: Radius.md, paddingHorizontal: Spacing.md, paddingVertical: 4 },
  detailEtatOuvert: { backgroundColor: '#DCFCE7' },
  detailEtatText: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: Colors.textSecondary },
  detailEtatTextOuvert: { color: '#16A34A' },
  detailSection: { backgroundColor: Colors.surface, borderRadius: Radius.xl, padding: Spacing.md, borderWidth: 1, borderColor: Colors.border, gap: Spacing.sm },
  detailSectionTitle: { fontSize: FontSize.xs, fontWeight: FontWeight.extrabold, color: Colors.textTertiary, letterSpacing: 0.8, marginBottom: 2 },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: Spacing.sm },
  detailLabel: { fontSize: FontSize.sm, color: Colors.textSecondary, flex: 1 },
  detailValue: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: Colors.textPrimary, flex: 2, textAlign: 'right' },
  detailEpreuveRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  detailEpreuveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.primary, flexShrink: 0 },
  detailEpreuveText: { fontSize: FontSize.sm, color: Colors.textPrimary, flex: 1 },
  detailFfeBox: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, backgroundColor: '#EFF6FF', borderRadius: Radius.xl, padding: Spacing.lg, borderWidth: 1, borderColor: '#93C5FD' },
  detailFfeTitle: { fontSize: FontSize.base, fontWeight: FontWeight.bold, color: '#1D4ED8' },
  detailFfeUrl: { fontSize: FontSize.xs, color: '#3B82F6' },
  detailFfeBtn: { backgroundColor: '#1D4ED8', borderRadius: Radius.lg, paddingVertical: Spacing.sm + 2, paddingHorizontal: Spacing.lg },
  detailFfeBtnText: { color: '#fff', fontWeight: FontWeight.bold, fontSize: FontSize.sm },
});
