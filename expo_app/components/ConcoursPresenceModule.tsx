// ─────────────────────────────────────────────────────────────────────────────
// ConcoursPresenceModule — module « Présence » de la fiche concours.
//
// Hiérarchie (validée) :
//   ① Compteurs : 👥 X participants · 🐴 Y chevaux
//   ② « Vous » (si inscrit) avec mon cheval, mis en avant
//   ③ Que vous connaissez — cheval-forward (nom du cheval plus visible)
//   ④ « Voir tous les participants (N) » → écran liste complète
//   Cold start : micro-invite « Soyez le premier à dire que vous y serez 🐴 ».
//
// Réutilise l'existant (useConcoursPresence / useConcoursKnownAttendees /
// useChevauxByIds). Supersède ConcoursKnownAttendeesCard. Robuste si non connecté
// ou données 089 absentes (available=false → masqué). 0 payments/escrow/Stripe.
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { Colors } from '../constants/colors';
import { Spacing, Radius, FontSize, FontWeight, Shadow } from '../constants/theme';
import {
  useConcoursPresence,
  useConcoursPresenceSummary,
  useConcoursKnownAttendees,
  KnownAttendee,
} from '../hooks/useConcoursPresence';
import { useChevauxByIds } from '../hooks/useChevauxByIds';
import { PresenceRow } from './PresenceRow';
import { trackCta } from '../lib/analytics';

const PREVIEW = 3;

function relationLabel(a: KnownAttendee): string {
  if (a.role === 'coach') return '🎓 Coach';
  if (a.role === 'organisateur') return '🏟️ Organisateur';
  if (a.relation === 'club') return '🏟️ Club';
  if (a.relation === 'booked') return '🤝 Réservé';
  if (a.relation === 'messaged') return '💬 Échangé';
  return '⭐ Suivi';
}

function displayName(a: KnownAttendee): string {
  return a.pseudo?.trim() || a.prenom?.trim() || 'Cavalier';
}

export function ConcoursPresenceModule({ concoursId }: { concoursId: string }) {
  // countsOk = compteurs fiables. Ils sont un BONUS d'affichage : ils ne
  // conditionnent JAMAIS le rendu du module (robustesse — cf. incident présence).
  const { participants, horses, ok: countsOk, reload } = useConcoursPresenceSummary(concoursId);
  // La disponibilité du module dépend de MA présence (089), pas des compteurs.
  const { present, chevalId, canDeclare, isReady: presReady, available: presAvailable } = useConcoursPresence(concoursId);
  const { attendees: known } = useConcoursKnownAttendees(concoursId);
  const myCheval = useChevauxByIds([chevalId]);
  const tracked = useRef(false);

  // Recharge les compteurs quand ma présence change (déclare/retire au-dessus).
  useEffect(() => { reload(); }, [present, chevalId, reload]);

  useEffect(() => {
    if (countsOk && participants > 0 && !tracked.current) {
      tracked.current = true;
      trackCta('concours-fiche', 'presence_hero_view', { concours_id: concoursId, count: participants });
    }
  }, [countsOk, participants, concoursId]);

  // Gate = état de MA présence (évite le flash ; 089 absente / non connecté → masqué).
  // Les compteurs peuvent échouer sans faire disparaître le module.
  if (!presReady) return null;
  if (!presAvailable) return null;

  const shownKnown = known.slice(0, PREVIEW);
  const myChevalNom = chevalId ? myCheval.get(chevalId) : null;

  // Contenu = je suis présent, OU je connais des présents, OU des compteurs fiables > 0.
  const hasContent = present || shownKnown.length > 0 || (countsOk && participants > 0);
  if (!hasContent) {
    if (!canDeclare) return null; // visiteur non éligible → rien
    return (
      <View style={s.card}>
        <Text style={s.coldTxt}>Soyez le premier à dire que vous y serez 🐴</Text>
      </View>
    );
  }

  const shownCount = (present ? 1 : 0) + shownKnown.length;
  // « Voir tous » seulement si les compteurs sont fiables et qu'il reste des gens.
  const showSeeAll = countsOk && participants > shownCount;

  const openProfile = (a: KnownAttendee) => {
    trackCta('concours-fiche', 'presence_avatar_tap', { concours_id: concoursId, target: a.user_id });
    router.push(`/user-profile/${a.user_id}` as any);
  };

  const openAll = () => {
    trackCta('concours-fiche', 'presence_seeall_tap', { concours_id: concoursId, count: participants });
    router.push(`/concours/${concoursId}/participants` as any);
  };

  return (
    <View style={s.card}>
      {/* ① Compteurs — affichés seulement si fiables (jamais bloquants) */}
      {countsOk && (
        <Text style={s.counters}>
          👥 <Text style={s.countHi}>{participants}</Text> participant{participants > 1 ? 's' : ''}
          {'   ·   '}
          🐴 <Text style={s.countHi}>{horses}</Text> cheval{horses > 1 ? 'aux' : ''}
        </Text>
      )}

      {/* ② Vous */}
      {present && (
        <View style={s.vous}>
          <View style={s.vousAv}><Text style={s.vousAvTxt}>🐴</Text></View>
          <View style={{ flex: 1 }}>
            {myChevalNom
              ? <Text style={s.vousHorse} numberOfLines={1}>{myChevalNom}</Text>
              : <Text style={s.vousName}>Vous y serez</Text>}
            <Text style={s.vousSub}>{myChevalNom ? 'Votre cheval pour ce concours' : 'cheval non précisé'}</Text>
          </View>
          <Text style={s.vousPin}>VOUS</Text>
        </View>
      )}

      {/* ③ Que vous connaissez (cheval-forward) — sinon teaser léger */}
      {shownKnown.length > 0 ? (
        <>
          <Text style={s.sectionLabel}>Que vous connaissez · {known.length}</Text>
          <View style={s.list}>
            {shownKnown.map((a) => (
              <PresenceRow
                key={a.user_id}
                initiales={a.initiales || displayName(a).slice(0, 2)}
                avatarColor={a.avatar_color || '#7C3AED'}
                riderName={displayName(a)}
                chevalNom={a.cheval_nom}
                relationLabel={relationLabel(a)}
                onPress={() => openProfile(a)}
              />
            ))}
          </View>
        </>
      ) : (
        <Text style={s.teaser}>Découvrez qui vient et avec quel cheval.</Text>
      )}

      {/* ④ Voir tous les participants */}
      {showSeeAll && (
        <TouchableOpacity onPress={openAll} activeOpacity={0.7}>
          <Text style={s.seeAll}>Voir tous les participants ({participants}) ›</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.lg,
    marginTop: Spacing.md,
    ...Shadow.card,
  },
  counters: { fontSize: FontSize.base, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  countHi: { color: Colors.primaryDark, fontWeight: FontWeight.extrabold },

  vous: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    backgroundColor: Colors.primaryLight, borderWidth: 1, borderColor: Colors.primaryBorder,
    borderRadius: Radius.md, padding: Spacing.md, marginTop: Spacing.md,
  },
  vousAv: {
    width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.primaryDark, borderWidth: 2, borderColor: Colors.surface,
  },
  vousAvTxt: { fontSize: 16 },
  vousHorse: { fontSize: FontSize.base, fontWeight: FontWeight.extrabold, color: Colors.textPrimary },
  vousName: { fontSize: FontSize.base, fontWeight: FontWeight.extrabold, color: Colors.textPrimary },
  vousSub: { fontSize: FontSize.xs, color: Colors.primaryDark, fontWeight: FontWeight.semibold, marginTop: 1 },
  vousPin: {
    fontSize: FontSize.xs, fontWeight: FontWeight.extrabold, color: Colors.primaryDark,
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.primaryBorder,
    borderRadius: 20, paddingHorizontal: Spacing.sm, paddingVertical: 2,
  },

  sectionLabel: {
    fontSize: FontSize.xs, letterSpacing: 0.5, textTransform: 'uppercase',
    color: Colors.textTertiary, fontWeight: FontWeight.bold, marginTop: Spacing.md, marginBottom: Spacing.xs,
  },
  list: { },
  teaser: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: Spacing.md },

  seeAll: {
    marginTop: Spacing.md, paddingTop: Spacing.md, borderTopWidth: 1, borderTopColor: Colors.border,
    color: Colors.primary, fontWeight: FontWeight.bold, fontSize: FontSize.sm, textAlign: 'center',
  },
  coldTxt: { fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: 'center', fontWeight: FontWeight.semibold },
});
