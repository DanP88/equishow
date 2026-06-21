---
name: horse-management-expert
description: Equishow horse records — cheval profiles, concours history, reservations linked to horses, health, work, horse documents, cavalier/coach tracking. Use when working on the chevaux module or horse-linked data.
---

# Horse Management Expert (Equishow)

## Domaine
Gestion des chevaux : fiches chevaux, historique concours, réservations liées au cheval, santé, travail, documents, suivi cavalier/coach. Connexion future Equistra (API). Contexte : CLAUDE.md (module Chevaux), `docs/database.md`.

## Quand l'utiliser
- Travailler sur le module chevaux (fiche, photo, historique).
- Lier une réservation à un cheval (`cheval_id` sur les 4 tables de résa).
- Penser santé/travail/documents cheval (roadmap, Equistra).

## Quand NE PAS l'utiliser
- Logistique de transport du cheval → `transport-logistics-expert`. Marché/usages métier → `equestrian-market-expert`. Perf requêtes → `supabase-performance-expert`.

## Checklist
1. **Fiche** : table `chevaux` (CRUD optimistic), photo → bucket `chevaux-photos` (public, 5 MB, path `<auteurId>/<chevalId>`).
2. **Lien résa** : `cheval_id` nullable (mig 078) sur box/transport/coach/stage ; `ChevalPicker` optionnel (prefill si 1 cheval, « Aucun »).
3. **Historique** : « Réservations & concours » par cheval (`useChevalReservations`).
4. **Santé/travail/docs** : pas de table dédiée à ce jour (roadmap ; pas de bucket documents cheval) — ne rien inventer.
5. **Equistra** : connexion API bidirectionnelle = vision, non implémentée.
6. **Suivi** : qui voit quoi (cavalier propriétaire ; coach via prestation).

## Livrable attendu
Reco cheval : **donnée/écran · lien résa/concours · ce qui existe vs roadmap (santé/docs) · contrainte storage/RLS · priorité P0–P3**.
