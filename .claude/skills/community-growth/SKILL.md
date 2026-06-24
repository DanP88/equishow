---
name: community-growth
description: Equishow community engagement — discussions, likes, comments, mentions, retention, animating cavaliers/coachs/organisateurs. Use when designing engagement loops or community features.
---

# Community Growth (Equishow)

## Domaine
Engagement communautaire : discussions concours, posts par rôle, likes, commentaires, mentions, rétention par animation. Aide à décider quelle boucle d'engagement créer. Contexte : CLAUDE.md (modules Communauté/Concours), `docs/concours.md`.

## Quand l'utiliser
- Concevoir une boucle d'engagement (notif → retour → contribution).
- Travailler discussions concours, posts (`posts_*`/`com_posts_*`), likes/mentions.
- Animer un persona (cavalier/coach/org) autour d'un concours.

## Quand NE PAS l'utiliser
- Acquisition/referral/viralité → `growth-hacker`. Rétention churn/relance → `retention-expert`. Implémentation discussions technique → `concours-expert`. Mesure pure → `analytics-expert`.

## Checklist
1. **Boucle** : déclencheur (nouveau message, mention, réponse) → notif (`concours_reply`) → retour → contribution.
2. **Leviers** : tags implicites (#transport/#box/#coach/#stage), réponses, mentions `@concours`, CTA conversion « Voir les X dispo » → Services pré-filtré.
3. **Identité** : pseudo + couleur + initiales (pas de nom/club) ; tout user connecté écrit, lecture publique.
4. **Modération** : soft delete (auteur/org/admin) ; pas de hard delete.
5. **Mesure** : non-lus (`concours_thread_reads`), volume messages, taux de réponse — sans KPI fabriqué.
6. **Roadmap** : LOT2 (fil participants, @user, push, notif mention) non câblé.

## Livrable attendu
Reco engagement : **persona · boucle (trigger→action) · levier · risque de spam/modération · KPI · priorité P0–P3**.
