// ─────────────────────────────────────────────────────────────────────────────
// useCommunautePosts — Hook pour les 3 espaces community posts (P26).
//
// Couvre :
// - posts_community (visible tous authentifiés)
// - posts_coach (visible coachs + admins, RLS DB)
// - posts_organisateur (visible orgs + admins, RLS DB)
//
// Mappe le shape DB (snake_case + snapshot auteur + liked_by uuid[]) vers
// CommunautePost (camelCase, commentaires inline) pour compat front existant.
// Les commentaires sont chargés à la demande via useCommunauteComments.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useId, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './useAuth';
import { CommunautePost, CommunauteComment } from '../data/store';

export type PostScope = 'community' | 'coach' | 'organisateur';

interface PostRow {
  id: string;
  auteur_id: string;
  auteur_nom: string | null;
  auteur_initiales: string | null;
  auteur_couleur: string | null;
  contenu: string;
  liked_by: string[];
  created_at: string;
  updated_at: string;
}

interface CommentRow {
  id: string;
  post_id: string;
  auteur_id: string;
  auteur_nom: string | null;
  auteur_initiales: string | null;
  auteur_couleur: string | null;
  texte: string;
  liked_by: string[];
  created_at: string;
  updated_at: string;
}

function rowToPost(r: PostRow, comments: CommunauteComment[] = []): CommunautePost {
  return {
    id: r.id,
    auteurId: r.auteur_id,
    auteur: r.auteur_nom ?? '',
    initiales: r.auteur_initiales ?? '',
    couleur: r.auteur_couleur ?? '#7C3AED',
    contenu: r.contenu,
    date: new Date(r.created_at),
    likes: (r.liked_by ?? []).length,
    likedBy: r.liked_by ?? [],
    commentaires: comments,
  };
}

function rowToComment(r: CommentRow): CommunauteComment {
  return {
    id: r.id,
    auteurId: r.auteur_id,
    auteur: r.auteur_nom ?? '',
    initiales: r.auteur_initiales ?? '',
    couleur: r.auteur_couleur ?? '#7C3AED',
    texte: r.texte,
    date: timeAgo(new Date(r.created_at)),
    likes: (r.liked_by ?? []).length,
    likedBy: r.liked_by ?? [],
  };
}

function timeAgo(date: Date): string {
  const diff = Date.now() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "À l'instant";
  if (minutes < 60) return `Il y a ${minutes}min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Il y a ${hours}h`;
  const days = Math.floor(hours / 24);
  return `Il y a ${days}j`;
}

// ─────────────────────────────────────────────────────────────────────────────
// useCommunautePosts — liste les posts d'un scope (avec leurs commentaires)
// ─────────────────────────────────────────────────────────────────────────────
export function useCommunautePosts(scope: PostScope) {
  const { profile } = useAuth();
  const channelId = useId();
  const [posts, setPosts] = useState<CommunautePost[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const postsTable = `posts_${scope}`;
  const commentsTable = `com_posts_${scope}`;

  const load = useCallback(async () => {
    setIsLoading(true);
    const [postsRes, commentsRes] = await Promise.all([
      supabase.from(postsTable).select('*').order('created_at', { ascending: false }),
      supabase.from(commentsTable).select('*').order('created_at', { ascending: true }),
    ]);
    if (postsRes.error) {
      console.error(`[useCommunautePosts] SELECT ${postsTable} error:`, postsRes.error);
    }
    if (commentsRes.error) {
      console.error(`[useCommunautePosts] SELECT ${commentsTable} error:`, commentsRes.error);
    }
    if (!postsRes.error && postsRes.data) {
      const commentsByPost = new Map<string, CommunauteComment[]>();
      ((commentsRes.data ?? []) as CommentRow[]).forEach((c) => {
        const list = commentsByPost.get(c.post_id) ?? [];
        list.push(rowToComment(c));
        commentsByPost.set(c.post_id, list);
      });
      setPosts((postsRes.data as PostRow[]).map((p) => rowToPost(p, commentsByPost.get(p.id) ?? [])));
    }
    setIsLoading(false);
  }, [postsTable, commentsTable]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const channel = supabase
      .channel(`${postsTable}-${channelId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: postsTable }, () => load())
      .on('postgres_changes', { event: '*', schema: 'public', table: commentsTable }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [postsTable, commentsTable, load, channelId]);

  const createPost = useCallback(async (contenu: string): Promise<{ data: CommunautePost | null; error: string | null }> => {
    if (!profile?.id) return { data: null, error: 'Non authentifié' };
    const auteur_nom = `${(profile as any).prenom ?? ''} ${(profile as any).nom ?? ''}`.trim();
    const auteur_initiales = `${((profile as any).prenom?.[0] ?? '').toUpperCase()}${((profile as any).nom?.[0] ?? '').toUpperCase()}`;
    const auteur_couleur = (profile as any).avatar_color ?? '#7C3AED';
    const { data, error } = await supabase
      .from(postsTable)
      .insert({
        auteur_id: profile.id,
        auteur_nom,
        auteur_initiales,
        auteur_couleur,
        contenu,
        liked_by: [],
      })
      .select('*')
      .single();
    if (error || !data) {
      console.error(`[useCommunautePosts] INSERT ${postsTable} error:`, error);
      return { data: null, error: error?.message ?? 'Erreur création' };
    }
    const created = rowToPost(data as PostRow);
    setPosts((curr) => (curr.some((p) => p.id === created.id) ? curr : [created, ...curr]));
    return { data: created, error: null };
  }, [profile?.id, (profile as any)?.prenom, (profile as any)?.nom, (profile as any)?.avatar_color, postsTable]);

  const deletePost = useCallback(async (id: string): Promise<{ error: string | null }> => {
    let snapshot: CommunautePost[] = [];
    setPosts((curr) => { snapshot = curr; return curr.filter((p) => p.id !== id); });
    const { error } = await supabase.from(postsTable).delete().eq('id', id);
    if (error) { setPosts(snapshot); return { error: error.message }; }
    return { error: null };
  }, [postsTable]);

  const toggleLike = useCallback(async (id: string): Promise<{ error: string | null }> => {
    if (!profile?.id) return { error: 'Non authentifié' };
    const post = posts.find((p) => p.id === id);
    if (!post) return { error: 'Post introuvable' };
    const hasLiked = post.likedBy.includes(profile.id);
    const newLikedBy = hasLiked
      ? post.likedBy.filter((u) => u !== profile.id)
      : [...post.likedBy, profile.id];
    // Optimistic
    setPosts((curr) => curr.map((p) => p.id === id
      ? { ...p, likedBy: newLikedBy, likes: newLikedBy.length }
      : p));
    // RPC bypasse RLS UPDATE (mig 026) — sinon update silencieusement bloqué sur posts d'autres users.
    const { data, error } = await supabase.rpc('toggle_post_like', { p_scope: scope, p_post_id: id });
    if (error) {
      load();
      return { error: error.message };
    }
    const serverLikedBy = (data as string[] | null) ?? newLikedBy;
    setPosts((curr) => curr.map((p) => p.id === id
      ? { ...p, likedBy: serverLikedBy, likes: serverLikedBy.length }
      : p));
    return { error: null };
  }, [posts, profile?.id, scope, load]);

  const addComment = useCallback(async (postId: string, texte: string): Promise<{ error: string | null }> => {
    if (!profile?.id) return { error: 'Non authentifié' };
    const auteur_nom = `${(profile as any).prenom ?? ''} ${(profile as any).nom ?? ''}`.trim();
    const auteur_initiales = `${((profile as any).prenom?.[0] ?? '').toUpperCase()}${((profile as any).nom?.[0] ?? '').toUpperCase()}`;
    const auteur_couleur = (profile as any).avatar_color ?? '#7C3AED';
    const { data, error } = await supabase
      .from(commentsTable)
      .insert({
        post_id: postId,
        auteur_id: profile.id,
        auteur_nom,
        auteur_initiales,
        auteur_couleur,
        texte,
        liked_by: [],
      })
      .select('*')
      .single();
    if (error || !data) return { error: error?.message ?? 'Insert KO' };
    // Optimistic : ajoute le commentaire à l'état local sans attendre realtime
    // (réseau realtime peut être indisponible — cf. mig 027 publication).
    const created = rowToComment(data as CommentRow);
    setPosts((curr) => curr.map((p) => p.id !== postId ? p : {
      ...p,
      commentaires: p.commentaires.some((c) => c.id === created.id)
        ? p.commentaires
        : [...p.commentaires, created],
    }));
    return { error: null };
  }, [profile?.id, (profile as any)?.prenom, (profile as any)?.nom, (profile as any)?.avatar_color, commentsTable]);

  const deleteComment = useCallback(async (commentId: string): Promise<{ error: string | null }> => {
    const { error } = await supabase.from(commentsTable).delete().eq('id', commentId);
    return { error: error?.message ?? null };
  }, [commentsTable]);

  const toggleCommentLike = useCallback(async (postId: string, commentId: string): Promise<{ error: string | null }> => {
    if (!profile?.id) return { error: 'Non authentifié' };
    const post = posts.find((p) => p.id === postId);
    const comment = post?.commentaires.find((c) => c.id === commentId);
    if (!comment) return { error: 'Commentaire introuvable' };
    const hasLiked = comment.likedBy.includes(profile.id);
    const newLikedBy = hasLiked
      ? comment.likedBy.filter((u) => u !== profile.id)
      : [...comment.likedBy, profile.id];
    // Optimistic
    setPosts((curr) => curr.map((p) => p.id !== postId ? p : {
      ...p,
      commentaires: p.commentaires.map((c) => c.id !== commentId ? c : {
        ...c,
        likedBy: newLikedBy,
        likes: newLikedBy.length,
      }),
    }));
    // RPC bypasse RLS UPDATE (mig 026).
    const { data, error } = await supabase.rpc('toggle_comment_like', { p_scope: scope, p_comment_id: commentId });
    if (error) {
      load();
      return { error: error.message };
    }
    const serverLikedBy = (data as string[] | null) ?? newLikedBy;
    setPosts((curr) => curr.map((p) => p.id !== postId ? p : {
      ...p,
      commentaires: p.commentaires.map((c) => c.id !== commentId ? c : {
        ...c,
        likedBy: serverLikedBy,
        likes: serverLikedBy.length,
      }),
    }));
    return { error: null };
  }, [posts, profile?.id, scope, load]);

  return {
    posts,
    isLoading,
    createPost,
    deletePost,
    toggleLike,
    addComment,
    deleteComment,
    toggleCommentLike,
    reload: load,
  };
}
