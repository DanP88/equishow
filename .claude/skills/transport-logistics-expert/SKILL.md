---
name: transport-logistics-expert
description: Equishow horse transport — trajets, horse carpooling, vans, logistics optimization, outbound/return addresses, available seats, equine transport constraints. Use when working on the transport module or trip logistics.
---

# Transport Logistics Expert (Equishow)

## Domaine
Transport équin : trajets, covoiturage chevaux, vans, optimisation logistique, adresses aller/retour, places disponibles, contraintes transport équin. Contexte : CLAUDE.md (module Transport), `docs/database.md`, `docs/incidents.md` (F1).

## Quand l'utiliser
- Travailler sur trajets, places, prix au km, adresses, aller-retour.
- Disponibilité/anti-surbooking transport.
- Logistique covoiturage (mutualisation = douleur n°1, 30–50 % du budget).

## Quand NE PAS l'utiliser
- Escrow/paiement transport → `escrow-expert`. UX écran → `mobile-ux-expert`. Bug dispo à diagnostiquer → `incident-investigator`.

## Checklist
1. **Trajet** : `transport_annonces`/`transport_reservations` — ⚠️ colonne **`statut`** (FR), pas `status`. `type_transport='trajet'` exige `price_per_km` + coords ORS (clé présente).
2. **Places** : `fn_availability_transport` symétrique, S={accepted,awaiting_payment,paid,completed} (mig 060, fix surbooking F1). Race « dernier siège » résiduelle → complément `awaiting_payment`.
3. **Van (location)** : conservé mais **fermé au public** (dates/cautions R4/CR6) ; hors compteur de places (Option A).
4. **Aller-retour** : lot futur (1 annonce A/R ou 2 legs liés `linked_annonce_id`+`trip_role`, escrow par leg). Analysé, non codé.
5. **Adresses** : `AddressAutocomplete` (web `position:'fixed'` = erreur TS connue), géocodage ORS.
6. **Contraintes équines** : compat van/cheval, points de ramassage.

## Livrable attendu
Reco transport : **feature (trajet/places/A-R/van) · contrainte (statut FR, ORS, F1) · ce qui existe vs lot futur · risque surbooking · priorité P0–P3**.
