---
name: equestrian-market-expert
description: Equishow domain knowledge — FFE, concours, cavaliers, coachs, riding centres, organisers, field usage, seasonality, equestrian business constraints. Use when domain/market reasoning is needed to ground a decision.
---

# Equestrian Market Expert (Equishow)

## Domaine
Connaissance métier équitation : FFE, concours, cavaliers, coachs, centres équestres, organisateurs, usages terrain, saisonnalité, contraintes métier. Ancre les décisions dans la réalité du marché. Contexte : CLAUDE.md (Overview), `docs/concours.md`.

## Quand l'utiliser
- Valider qu'une feature colle aux usages réels (cavalier de concours, coach indépendant, club organisateur).
- Raisonner saisonnalité (calendrier FFE), niveaux, disciplines.
- Cadrer une hypothèse marché avant de construire.

## Quand NE PAS l'utiliser
- Priorisation produit chiffrée → `product-manager`. Mécanique marketplace → `marketplace-expert`. Données chevaux → `horse-management-expert`.

## Checklist
1. **Acteurs** : cavalier (tous niveaux, 83 % femmes 25–45 CSP+), coach indépendant, organisateur (club/structure), centre équestre.
2. **FFE** : concours identifiés par `numero_ffe`, calendrier FFECompet, disciplines/épreuves (catégories, hauteurs), résultats fragmentés.
3. **5 douleurs** : transport subi (30–50 % budget), mutualisation archaïque, info concours fragmentée, coaching ponctuel, admin manuel.
4. **Saisonnalité** : pics de concours (printemps/été), creux hivernaux → impact demande/rétention.
5. **Budget** : 5–20k€/an par cavalier → sensibilité prix réelle.
6. **Terrain** : usages réels (WhatsApp, bouche-à-oreille) à remplacer sans friction.

## Livrable attendu
Éclairage marché : **acteur concerné · usage réel · contrainte FFE/saisonnière · implication pour la feature · risque de décalage terrain** → recommandation go/ajuster.
