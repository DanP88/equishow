// ─────────────────────────────────────────────────────────────────────────────
// <LevelInfoModal /> — Popup explicative quand on tape sur une cocarde
//
// Affiche :
//   - Cocarde en grand (size lg)
//   - Nom du niveau + seuil de points
//   - Description claire (à quoi ça correspond)
//   - Pour le user courant : barre de progression + points actuels
//   - Liste de tous les niveaux (mini-cocarde + seuil)
// ─────────────────────────────────────────────────────────────────────────────

import React from 'react';
import { View, Text, Modal, TouchableOpacity, StyleSheet, ScrollView, Platform } from 'react-native';
import { Colors } from '../constants/colors';
import { Spacing, Radius, FontSize, FontWeight } from '../constants/theme';
import { LEVEL_STYLE, LEVELS_ORDER, UserLevel } from '../lib/badges';
import { LevelMedal } from './LevelMedal';

const LEVEL_DESCRIPTION: Record<UserLevel, string> = {
  debutant:
    "Tu commences l'aventure Equishow ! Réserve un coach, participe à des concours, écris dans la communauté pour gagner tes premiers points et grimper au niveau Passionné.",
  passionne:
    "Cavalier passionné, tu fais déjà partie de la communauté active. Continue à réserver, laisser des avis et participer pour atteindre Confirmé.",
  confirme:
    "Cavalier confirmé — tu accumules les expériences sur Equishow : réservations, concours, échanges. Ton parcours commence à compter !",
  expert:
    "Cavalier expert. Ton activité te place parmi les utilisateurs les plus impliqués. Réservations, concours, communauté — tu rayonnes.",
  elite:
    "Élite Equishow — le sommet. Tu fais partie des cavaliers les plus actifs de la plateforme. Bravo, ta présence inspire la communauté.",
};

interface Props {
  visible: boolean;
  level: UserLevel;
  points?: number;        // points du user qu'on regarde
  isCurrentUser?: boolean; // si oui, on affiche la barre de progression
  onClose: () => void;
}

export function LevelInfoModal({ visible, level, points = 0, isCurrentUser, onClose }: Props) {
  const style = LEVEL_STYLE[level];
  const idx = LEVELS_ORDER.indexOf(level);
  const nextLevel = LEVELS_ORDER[idx + 1] ?? null;
  const nextStyle = nextLevel ? LEVEL_STYLE[nextLevel] : null;
  const pointsToNext = nextStyle ? Math.max(0, nextStyle.minPoints - points) : 0;
  const progressPct = nextStyle
    ? Math.min(1, Math.max(0, (points - style.minPoints) / Math.max(1, nextStyle.minPoints - style.minPoints)))
    : 1;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={s.backdrop} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity activeOpacity={1} onPress={(e) => e.stopPropagation()}>
          <View style={s.card}>
            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Médaille géante */}
              <View style={s.heroMedal}>
                <LevelMedal level={level} size="lg" />
              </View>

              <Text style={s.title}>{style.label}</Text>
              <Text style={s.subtitle}>
                Niveau {idx + 1} / {LEVELS_ORDER.length}
                {style.minPoints > 0 && ` · Seuil ${style.minPoints} pts`}
              </Text>

              <Text style={s.description}>{LEVEL_DESCRIPTION[level]}</Text>

              {/* Barre de progression (seulement pour user courant) */}
              {isCurrentUser && nextStyle && (
                <View style={s.progressBlock}>
                  <View style={s.progressHeader}>
                    <Text style={s.progressLabel}>Vers {nextStyle.label}</Text>
                    <Text style={s.progressPts}>{points} / {nextStyle.minPoints} pts</Text>
                  </View>
                  <View style={s.progressBg}>
                    <View style={[s.progressFill, { width: `${Math.round(progressPct * 100)}%`, backgroundColor: nextStyle.fg }]} />
                  </View>
                  <Text style={s.progressFooter}>
                    Encore {pointsToNext} pts pour atteindre {nextStyle.label}.
                  </Text>
                </View>
              )}

              {isCurrentUser && !nextStyle && (
                <Text style={s.maxReached}>🏆 Niveau maximum atteint !</Text>
              )}

              {/* Liste complète des niveaux */}
              <View style={s.divider} />
              <Text style={s.allLevelsTitle}>Tous les niveaux</Text>
              {LEVELS_ORDER.map((lvl) => {
                const lv = LEVEL_STYLE[lvl];
                const isCurrent = lvl === level;
                return (
                  <View key={lvl} style={[s.levelRow, isCurrent && s.levelRowActive]}>
                    <LevelMedal level={lvl} size="sm" />
                    <View style={{ flex: 1 }}>
                      <Text style={[s.levelName, isCurrent && { color: lv.fg }]}>
                        {lv.label}{isCurrent ? ' ✓' : ''}
                      </Text>
                      <Text style={s.levelPoints}>
                        {lv.minPoints === 0 ? 'Dès l\'inscription' : `À partir de ${lv.minPoints} pts`}
                      </Text>
                    </View>
                  </View>
                );
              })}

              {/* Note explicative */}
              <Text style={s.note}>
                Les points s'obtiennent en réservant un coach, en participant à des concours,
                en publiant dans la communauté ou en laissant des avis.
              </Text>
            </ScrollView>

            <TouchableOpacity style={s.closeBtn} onPress={onClose} activeOpacity={0.7}>
              <Text style={s.closeBtnText}>Fermer</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center', justifyContent: 'center', padding: Spacing.lg,
  },
  card: {
    width: Platform.OS === 'web' ? 420 : '100%',
    maxWidth: 420, maxHeight: '88%',
    backgroundColor: Colors.surface, borderRadius: Radius.lg, padding: Spacing.lg,
  },
  heroMedal: { alignItems: 'center', marginBottom: Spacing.md },
  title: { fontSize: 24, fontWeight: FontWeight.extrabold, color: Colors.textPrimary, textAlign: 'center' },
  subtitle: { fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: 'center', marginTop: 4, marginBottom: Spacing.md },
  description: { fontSize: FontSize.base, color: Colors.textPrimary, lineHeight: 22, textAlign: 'center' },

  progressBlock: { marginTop: Spacing.lg, backgroundColor: Colors.surfaceVariant, borderRadius: Radius.md, padding: Spacing.md },
  progressHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  progressLabel: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: Colors.textPrimary },
  progressPts: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: Colors.textSecondary },
  progressBg: { height: 8, borderRadius: 4, backgroundColor: Colors.border, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 4 },
  progressFooter: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 6 },
  maxReached: { fontSize: FontSize.base, color: Colors.gold, textAlign: 'center', marginTop: Spacing.md, fontWeight: FontWeight.bold },

  divider: { height: 1, backgroundColor: Colors.border, marginVertical: Spacing.lg },
  allLevelsTitle: { fontSize: FontSize.base, fontWeight: FontWeight.bold, color: Colors.textPrimary, marginBottom: Spacing.sm },
  levelRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingVertical: Spacing.sm, paddingHorizontal: Spacing.xs, borderRadius: Radius.sm },
  levelRowActive: { backgroundColor: Colors.surfaceVariant },
  levelName: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: Colors.textPrimary },
  levelPoints: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 2 },

  note: { fontSize: FontSize.xs, color: Colors.textTertiary, fontStyle: 'italic', marginTop: Spacing.lg, lineHeight: 16, textAlign: 'center' },

  closeBtn: { marginTop: Spacing.md, paddingVertical: Spacing.md, backgroundColor: Colors.primary, borderRadius: Radius.md, alignItems: 'center' },
  closeBtnText: { color: '#fff', fontSize: FontSize.base, fontWeight: FontWeight.bold },
});
