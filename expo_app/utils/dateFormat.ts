/**
 * Formate une Date en YYYY-MM-DD selon le fuseau LOCAL (pas UTC).
 *
 * Remplace `d.toISOString().slice(0, 10)` qui décale d'1 jour en France été
 * (UTC+2) quand l'utilisateur sélectionne une date locale via DatePicker :
 * `new Date(2026, 5, 12)` (local 06-12 00:00) devient en ISO
 * `2026-06-11T22:00:00.000Z` → slice = "2026-06-11" ❌.
 *
 * Bug observé : résa box stockée date_fin=06-11 alors que user a pickté 06-12,
 * tandis que nb_nuits et price restent corrects (calculés client-side avant
 * sérialisation) → incohérence affichée + libération escrow anticipée d'1j +
 * possible double-réservation côté inventaire.
 */
export function toLocalDateString(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
