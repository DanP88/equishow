import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export interface Post {
  id: string;
  auteur_id: string;
  auteur_nom: string;
  titre: string;
  contenu: string;
  image_url?: string;
  nb_likes: number;
  nb_commentaires: number;
  created_at: string;
  updated_at: string;
}

export interface Comment {
  id: string;
  post_id: string;
  auteur_id: string;
  auteur_nom: string;
  contenu: string;
  created_at: string;
  updated_at: string;
}

type PostType = 'community' | 'coach' | 'organisateur';

interface UsePostsReturn {
  posts: Post[];
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

interface UseCommentsReturn {
  comments: Comment[];
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

interface CreatePostParams {
  titre: string;
  contenu: string;
  image_url?: string;
}

interface CreateCommentParams {
  contenu: string;
}

interface UpdatePostParams {
  titre?: string;
  contenu?: string;
  image_url?: string;
}

interface UpdateCommentParams {
  contenu: string;
}

// Hook to fetch posts by type
export function usePosts(type: PostType): UsePostsReturn {
  const [posts, setPosts] = useState<Post[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const tableName = `posts_${type}`;

  const fetchPosts = async () => {
    try {
      setIsLoading(true);
      const { data, error: err } = await supabase
        .from(tableName)
        .select('*')
        .order('created_at', { ascending: false });

      if (err) throw err;
      setPosts(data || []);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Erreur lors du chargement des posts');
      setPosts([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPosts();

    // Subscribe to real-time updates
    const channel = supabase
      .channel(`posts:${type}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: tableName,
        },
        (payload: any) => {
          if (payload.eventType === 'INSERT') {
            setPosts((prev) => [payload.new as Post, ...prev]);
          } else if (payload.eventType === 'UPDATE') {
            setPosts((prev) =>
              prev.map((p) => (p.id === payload.new.id ? (payload.new as Post) : p))
            );
          } else if (payload.eventType === 'DELETE') {
            setPosts((prev) => prev.filter((p) => p.id !== payload.old.id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [tableName, type]);

  return { posts, isLoading, error, refresh: fetchPosts };
}

// Hook to fetch comments for a specific post
export function useComments(postId: string, type: PostType): UseCommentsReturn {
  const [comments, setComments] = useState<Comment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const tableName = `com_posts_${type}`;

  const fetchComments = async () => {
    try {
      setIsLoading(true);
      const { data, error: err } = await supabase
        .from(tableName)
        .select('*')
        .eq('post_id', postId)
        .order('created_at', { ascending: true });

      if (err) throw err;
      setComments(data || []);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Erreur lors du chargement des commentaires');
      setComments([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!postId) return;

    fetchComments();

    // Subscribe to real-time updates
    const channel = supabase
      .channel(`comments:${postId}:${type}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: tableName,
          filter: `post_id=eq.${postId}`,
        },
        (payload: any) => {
          if (payload.eventType === 'INSERT') {
            setComments((prev) => [...prev, payload.new as Comment]);
          } else if (payload.eventType === 'UPDATE') {
            setComments((prev) =>
              prev.map((c) => (c.id === payload.new.id ? (payload.new as Comment) : c))
            );
          } else if (payload.eventType === 'DELETE') {
            setComments((prev) => prev.filter((c) => c.id !== payload.old.id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [postId, tableName, type]);

  return { comments, isLoading, error, refresh: fetchComments };
}

// Hook to create/update/delete posts
export function usePostMutations(type: PostType) {
  const [isCreating, setIsCreating] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const tableName = `posts_${type}`;

  const createPost = async (params: CreatePostParams) => {
    try {
      setIsCreating(true);
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;

      if (!userId) throw new Error('User not authenticated');

      const { data: userProfile } = await supabase
        .from('users')
        .select('prenom, nom')
        .eq('id', userId)
        .single();

      const auteur_nom = userProfile ? `${userProfile.prenom} ${userProfile.nom}` : 'Anonyme';

      const { data, error } = await supabase
        .from(tableName)
        .insert([
          {
            auteur_id: userId,
            auteur_nom,
            titre: params.titre,
            contenu: params.contenu,
            image_url: params.image_url,
            nb_likes: 0,
            nb_commentaires: 0,
          },
        ])
        .select()
        .single();

      if (error) throw error;
      return { data, error: null };
    } catch (err: any) {
      return { data: null, error: err.message || 'Erreur lors de la création' };
    } finally {
      setIsCreating(false);
    }
  };

  const updatePost = async (postId: string, params: UpdatePostParams) => {
    try {
      setIsUpdating(true);
      const { data, error } = await supabase
        .from(tableName)
        .update({
          titre: params.titre,
          contenu: params.contenu,
          image_url: params.image_url,
          updated_at: new Date().toISOString(),
        })
        .eq('id', postId)
        .select()
        .single();

      if (error) throw error;
      return { data, error: null };
    } catch (err: any) {
      return { data: null, error: err.message || 'Erreur lors de la modification' };
    } finally {
      setIsUpdating(false);
    }
  };

  const deletePost = async (postId: string) => {
    try {
      setIsDeleting(true);
      const { error } = await supabase.from(tableName).delete().eq('id', postId);

      if (error) throw error;
      return { error: null };
    } catch (err: any) {
      return { error: err.message || 'Erreur lors de la suppression' };
    } finally {
      setIsDeleting(false);
    }
  };

  return { createPost, updatePost, deletePost, isCreating, isUpdating, isDeleting };
}

// Hook to create/update/delete comments
export function useCommentMutations(type: PostType) {
  const [isCreating, setIsCreating] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const tableName = `com_posts_${type}`;

  const createComment = async (postId: string, params: CreateCommentParams) => {
    try {
      setIsCreating(true);
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;

      if (!userId) throw new Error('User not authenticated');

      const { data: userProfile } = await supabase
        .from('users')
        .select('prenom, nom')
        .eq('id', userId)
        .single();

      const auteur_nom = userProfile ? `${userProfile.prenom} ${userProfile.nom}` : 'Anonyme';

      const { data, error } = await supabase
        .from(tableName)
        .insert([
          {
            post_id: postId,
            auteur_id: userId,
            auteur_nom,
            contenu: params.contenu,
          },
        ])
        .select()
        .single();

      if (error) throw error;
      return { data, error: null };
    } catch (err: any) {
      return { data: null, error: err.message || 'Erreur lors de la création du commentaire' };
    } finally {
      setIsCreating(false);
    }
  };

  const updateComment = async (commentId: string, params: UpdateCommentParams) => {
    try {
      const { data, error } = await supabase
        .from(tableName)
        .update({
          contenu: params.contenu,
          updated_at: new Date().toISOString(),
        })
        .eq('id', commentId)
        .select()
        .single();

      if (error) throw error;
      return { data, error: null };
    } catch (err: any) {
      return { data: null, error: err.message || 'Erreur lors de la modification' };
    }
  };

  const deleteComment = async (commentId: string) => {
    try {
      setIsDeleting(true);
      const { error } = await supabase.from(tableName).delete().eq('id', commentId);

      if (error) throw error;
      return { error: null };
    } catch (err: any) {
      return { error: err.message || 'Erreur lors de la suppression' };
    } finally {
      setIsDeleting(false);
    }
  };

  return { createComment, updateComment, deleteComment, isCreating, isUpdating, isDeleting };
}
