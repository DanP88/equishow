// Numéro de réservation lisible et STABLE, dérivé de l'identifiant de la
// réservation (jamais ré-attribué, aucune migration nécessaire).
//
//   EQ-<TYPE>-XXXXXXXX
//
// `typeLike` accepte les types agenda (cours, cours_coach, stage, stage_coach,
// transport_buyer, box_seller, …) ET les types paiement (course, stage,
// transport, box). On retire les suffixes agenda (_s, _coach) et les tirets de
// l'UUID pour ne garder que 8 caractères lisibles.
export function reservationNumber(typeLike: string, id: string): string {
  const t = (typeLike ?? '').toLowerCase();
  const prefix = t.startsWith('transport') ? 'TRANSP'
    : t.startsWith('box') ? 'BOX'
    : t.startsWith('stage') ? 'STAGE'
    : 'COURS'; // course / cours / cours_coach
  const base = (id ?? '').replace(/_coach$/, '').replace(/_s$/, '').replace(/-/g, '');
  return `EQ-${prefix}-${base.slice(0, 8).toUpperCase()}`;
}
