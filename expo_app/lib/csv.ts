// ─────────────────────────────────────────────────────────────────────────────
// csv — parseur CSV robuste (RFC 4180), SINGLE-PASS.
//
// Pourquoi : l'ancien parseur de l'import concours faisait DEUX passes — la 1ère
// (reconstruction des lignes) supprimait les guillemets, la 2e (découpe en champs)
// n'avait donc plus de guillemets à respecter et splittait sur TOUTES les virgules,
// y compris celles internes aux décimales « (1,05 m) ». Résultat : le champ
// « Épreuve » (1 714 chars, ~47 épreuves) était tronqué à son 1er caractère-avant-
// virgule (« …au chrono (1 », 53 chars) et stocké comme 1 seule pseudo-épreuve.
//
// Ce parseur gère en une passe :
//   - guillemets de champ (champs quotés)
//   - virgules internes à un champ quoté (décimales « 1,05 », listes)
//   - retours à la ligne internes à un champ quoté
//   - guillemets échappés ("" → ")
//   - BOM UTF-8 en tête de fichier
//   - fins de ligne \n / \r\n / \r
// Aucune dépendance React Native → testable en isolation.
// ─────────────────────────────────────────────────────────────────────────────

export interface ParsedCSV {
  headers: string[];
  rows: Record<string, string>[];
}

/**
 * Parse un texte CSV en { headers, rows }. Les valeurs sont trimées.
 * Les enregistrements entièrement vides (lignes blanches) sont ignorés.
 */
export function parseCSV(input: string): ParsedCSV {
  // Retire le BOM UTF-8 éventuel (sinon le 1er header devient « ﻿Date… »).
  const text = input.charCodeAt(0) === 0xfeff ? input.slice(1) : input;

  const records: string[][] = [];
  let record: string[] = [];
  let field = '';
  let inQuotes = false;
  let i = 0;
  const n = text.length;

  const endField = () => { record.push(field); field = ''; };
  const endRecord = () => { endField(); records.push(record); record = []; };

  while (i < n) {
    const ch = text[i];

    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i += 2; continue; } // "" échappé
        inQuotes = false; i++; continue;                              // fin de quote
      }
      field += ch; i++; continue; // tout (y compris , et \n) appartient au champ
    }

    if (ch === '"') { inQuotes = true; i++; continue; }
    if (ch === ',') { endField(); i++; continue; }
    if (ch === '\n') { endRecord(); i++; continue; }
    if (ch === '\r') {
      endRecord();
      if (text[i + 1] === '\n') i++; // \r\n compté comme une seule fin de ligne
      i++; continue;
    }
    field += ch; i++;
  }
  // Dernier champ / dernier enregistrement (fichier sans newline final).
  endRecord();

  // Ignore les enregistrements totalement vides.
  const nonEmpty = records.filter((r) => !(r.length === 1 && r[0].trim() === ''));
  if (nonEmpty.length === 0) return { headers: [], rows: [] };

  const headers = nonEmpty[0].map((h) => h.trim());
  const rows: Record<string, string>[] = [];
  for (let r = 1; r < nonEmpty.length; r++) {
    const fields = nonEmpty[r];
    if (fields.every((f) => f.trim() === '')) continue;
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => { row[h] = (fields[idx] ?? '').trim(); });
    rows.push(row);
  }
  return { headers, rows };
}
