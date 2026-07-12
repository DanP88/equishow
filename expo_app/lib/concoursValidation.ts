// ─────────────────────────────────────────────────────────────────────────────
// concoursValidation — validation métier PARTAGÉE du formulaire concours.
//
// Extraite de `creer-concours.tsx` (PR2-B) pour être réutilisée par :
//   - la création (creer-concours, mode création) ;
//   - l'édition (creer-concours, mode édition) ;
//   - la pré-publication (org-concours : « ne pas publier un brouillon incomplet »).
//
// Fonction PURE (aucune dépendance React/Supabase) → testable en isolation.
// La logique reproduit à l'identique les règles de PR2-B (0 changement de
// comportement en création).
// ─────────────────────────────────────────────────────────────────────────────

export interface ConcoursFormFields {
  nom: string;
  dateDebut?: Date;
  dateFin?: Date;
  lieu: string;
  discipline: string;
  nbPlaces: string; // saisie brute (le champ est un TextInput)
  prix: string;     // saisie brute, optionnelle
}

export interface ValidationError {
  title: string;
  message: string;
}

/**
 * Valide les champs obligatoires + cohérence dates/nombres.
 * @param opts.allowPastDate  autorise une date de début passée (publication d'un
 *   brouillon existant : on contrôle la présence des champs, pas la fraîcheur).
 * @returns la première erreur rencontrée, ou `null` si tout est valide.
 */
export function validateConcoursForm(
  f: ConcoursFormFields,
  opts?: { allowPastDate?: boolean },
): ValidationError | null {
  if (!f.nom.trim()) return { title: 'Nom manquant', message: 'Indiquez le nom du concours.' };
  if (!f.dateDebut) return { title: 'Date de début manquante', message: 'Sélectionnez la date de début du concours.' };
  if (!f.dateFin) return { title: 'Date de fin manquante', message: 'Sélectionnez la date de fin du concours.' };
  if (f.dateFin.getTime() < f.dateDebut.getTime()) {
    return {
      title: 'Dates incohérentes',
      message: `La date de fin (${f.dateFin.toLocaleDateString('fr-FR')}) doit être égale ou postérieure à la date de début (${f.dateDebut.toLocaleDateString('fr-FR')}).`,
    };
  }
  if (!opts?.allowPastDate) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (f.dateDebut.getTime() < today.getTime()) {
      return {
        title: 'Date dans le passé',
        message: `La date de début (${f.dateDebut.toLocaleDateString('fr-FR')}) est antérieure à aujourd'hui. Choisissez une date future.`,
      };
    }
  }
  if (!f.lieu.trim()) return { title: 'Lieu manquant', message: 'Indiquez le lieu où se déroule le concours.' };
  if (!f.discipline) return { title: 'Discipline manquante', message: 'Sélectionnez la discipline du concours.' };
  if (!f.nbPlaces) return { title: 'Places manquantes', message: 'Indiquez le nombre de places disponibles.' };
  const placesNum = parseInt(f.nbPlaces, 10);
  if (Number.isNaN(placesNum) || placesNum <= 0) {
    return { title: 'Places invalides', message: 'Le nombre de places doit être un nombre supérieur à 0.' };
  }
  if (f.prix) {
    const prixNum = parseInt(f.prix, 10);
    if (Number.isNaN(prixNum) || prixNum < 0) {
      return { title: 'Prix invalide', message: "Le prix d'inscription doit être un nombre positif." };
    }
  }
  return null;
}

// Row brut (concours + infos jsonb) → champs de formulaire, pour valider une
// publication sans réafficher le formulaire. Reflète le mapping de `createConcours`.
export interface ConcoursRowForValidation {
  nom?: string | null;
  date_debut?: string | null;
  date_fin?: string | null;
  lieu?: string | null;
  type_concours?: string | null;
  infos?: { nb_places?: number | null; prix?: number | null } | null;
}

export function rowToFormFields(row: ConcoursRowForValidation): ConcoursFormFields {
  const infos = row.infos ?? {};
  return {
    nom: row.nom ?? '',
    dateDebut: row.date_debut ? new Date(row.date_debut) : undefined,
    dateFin: row.date_fin ? new Date(row.date_fin) : undefined,
    lieu: row.lieu ?? '',
    discipline: row.type_concours ?? '',
    nbPlaces: infos.nb_places != null ? String(infos.nb_places) : '',
    prix: infos.prix != null ? String(infos.prix) : '',
  };
}
