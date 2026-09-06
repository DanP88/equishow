// ─────────────────────────────────────────────────────────────────────────────
// v2/adapters/messaging — useV2Conversations()
//
// F3 : branche la messagerie RÉELLE (useConversations, V1) — déjà UNE seule
// messagerie par user id, realtime. LECTURE SEULE (pas d'envoi ici).
// Le contexte (Transport / Box / Coaching / Concours) vient de `annonce` /
// `annonceType` / `sujet` de la conversation — c'est une étiquette, jamais un
// changement d'identité. Repli sur un jeu de démo si aucune conversation.
// ─────────────────────────────────────────────────────────────────────────────
import { useMemo } from 'react';
import { useConversations } from '../../hooks/useMessaging';

export interface V2Conversation {
  id: string;
  name: string;
  initials: string;
  color: string;
  context: string;
  last: string;
  when: string;
  unread: boolean;
}

const CTX_ICON: Record<string, string> = {
  transport: '🚚 Transport', trajet: '🚚 Transport', location: '🚚 Van',
  box: '🏠 Box', coach: '🎓 Coaching', course: '🎓 Coaching', stage: '🎓 Stage',
  concours: '🏆 Concours',
};

function ago(d: Date | null): string {
  if (!d) return '';
  const m = Math.floor((Date.now() - d.getTime()) / 60000);
  if (m < 1) return 'à l’instant';
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} h`;
  const j = Math.floor(h / 24);
  return j < 7 ? `${j} j` : d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
}

const MOCK: V2Conversation[] = [
  { id: 'm1', name: 'Marc D.', initials: 'MD', color: '#0369A1', context: '🚚 Transport · La Baule', last: 'Départ 7h ça te va ?', when: '10 min', unread: true },
  { id: 'm2', name: 'Émilie L.', initials: 'EL', color: '#7C3AED', context: '🎓 Coaching · Amateur 1', last: 'Parfait, à samedi', when: 'hier', unread: false },
  { id: 'm3', name: 'Julie D.', initials: 'JD', color: '#16A34A', context: '🎓 Vous coachez · Tornado', last: 'Merci pour la séance !', when: '2 j', unread: false },
];

export function useV2Conversations() {
  const { conversations } = useConversations();

  return useMemo(() => {
    const real: V2Conversation[] = (conversations ?? []).map((c) => {
      const ctxKey = (c.annonceType ?? '').toLowerCase();
      const ctx = CTX_ICON[ctxKey] ?? c.sujet ?? '💬 Discussion';
      return {
        id: c.id,
        name: c.otherNom || 'Utilisateur',
        initials: c.otherInitiales || '?',
        color: c.otherCouleur || '#7C3AED',
        context: c.annonce ? `${ctx} · ${c.annonce}` : ctx,
        last: c.dernierMsg || '',
        when: ago(c.lastMessageAt),
        unread: c.unread,
      };
    });
    const demo = real.length === 0;
    const list = demo ? MOCK : real;
    return { conversations: list, demo, unreadCount: list.filter((c) => c.unread).length };
  }, [conversations]);
}
