import { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, SafeAreaView, Platform,
  ActivityIndicator,
} from 'react-native';
import { Colors } from '../../constants/colors';
import { Spacing, Radius, FontSize, FontWeight, Shadow } from '../../constants/theme';
import { concoursCsvStore } from '../../data/store';
import { supabase } from '../../lib/supabase';
import { parseCSV } from '../../lib/csv';
import { decodeImportedText } from '../../lib/encoding';
import { parseEpreuves } from '../../lib/epreuves';
import { parseCategories } from '../../lib/categories';
import { ConcoursCSV, ImportBatch, ImportError } from '../../types/concours';

// LOT 1 — Persistance des concours importés vers la table public.concours
// (upsert sur numero_ffe = idempotent au ré-import). Tolère l'absence de table
// (migration 074 non encore appliquée) : log only, le store mock reste la source
// de visualisation tant que 074 n'est pas en place.
// 084 — réplique les catégories d'un lot de concours dans concours_categories.
// Sémantique « replace » idempotente : on efface les catégories existantes des
// concours concernés puis on réinsère la liste fraîche (un ré-import qui retire
// une catégorie la supprime aussi). Best-effort : tolère l'absence de la table
// 084 (non appliquée) et n'interrompt JAMAIS l'import des concours.
async function persistCategories(
  rows: ConcoursCSV[],
  numeroToId: Map<string, string>,
): Promise<{ written: number; error: string | null }> {
  // (concours_id, categorie) à écrire, en s'appuyant sur l'id réel post-upsert.
  const catRows: { concours_id: string; categorie: string }[] = [];
  const concoursIds = new Set<string>();
  for (const r of rows) {
    const id = r.numero_concours ? numeroToId.get(r.numero_concours) : undefined;
    if (!id) continue;
    concoursIds.add(id);
    for (const categorie of r.categories) catRows.push({ concours_id: id, categorie });
  }
  if (concoursIds.size === 0) return { written: 0, error: null };

  try {
    // Replace : on purge les catégories des concours ré-importés…
    const { error: delErr } = await supabase
      .from('concours_categories').delete().in('concours_id', [...concoursIds]);
    if (delErr) return { written: 0, error: delErr.message };
    // …puis on réinsère la liste fraîche (dédup déjà faite côté parseCategories).
    if (catRows.length === 0) return { written: 0, error: null };
    const { error: insErr } = await supabase
      .from('concours_categories').insert(catRows);
    if (insErr) return { written: 0, error: insErr.message };
    return { written: catRows.length, error: null };
  } catch (e: any) {
    return { written: 0, error: e?.message ?? String(e) };
  }
}

async function persistConcoursToDb(rows: ConcoursCSV[]): Promise<{ written: number; doublonsBase: number; categoriesWritten: number; categoriesError: string | null; error: string | null }> {
  const payload = rows
    .filter((r) => r.numero_concours) // skip lignes sans numéro (clé d'upsert)
    .map((r) => ({
      numero_ffe: r.numero_concours,
      nom: r.nom_concours,
      date_debut: r.date_debut,
      date_fin: r.date_fin,
      date_cloture: r.date_cloture,
      lieu: r.lieu,
      adresse: r.adresse,
      departement: r.departement,
      type_concours: r.type_concours,
      cre: r.cre,
      organisateur_terrain: r.organisateur_terrain,
      organisateur_financier: r.organisateur_financier,
      liste_epreuves: r.liste_epreuves,
      etat: r.etat,
      source_import: 'csv',
      import_batch_id: r.import_batch_id,
    }));
  if (payload.length === 0) return { written: 0, doublonsBase: 0, categoriesWritten: 0, categoriesError: null, error: null };
  try {
    // Dédup contre la BASE : quels numero_ffe existent déjà ?
    const numeros = payload.map((p) => p.numero_ffe).filter(Boolean) as string[];
    const { data: existing, error: exErr } = await supabase
      .from('concours').select('numero_ffe').in('numero_ffe', numeros);
    if (exErr) {
      console.warn('[import-concours] lecture doublons base échouée:', exErr.message);
      return { written: 0, doublonsBase: 0, categoriesWritten: 0, categoriesError: null, error: exErr.message };
    }
    const existingSet = new Set((existing ?? []).map((e: any) => e.numero_ffe));
    const doublonsBase = payload.filter((p) => existingSet.has(p.numero_ffe)).length;

    // Upsert (insère les nouveaux, met à jour les existants). On récupère `id`
    // (en plus de numero_ffe) pour rattacher les catégories (FK concours_id).
    const { data, error } = await supabase
      .from('concours').upsert(payload, { onConflict: 'numero_ffe' }).select('id, numero_ffe');
    if (error) {
      console.warn('[import-concours] upsert concours échoué:', error.message);
      return { written: 0, doublonsBase: 0, categoriesWritten: 0, categoriesError: null, error: error.message };
    }
    const affected = data?.length ?? 0;

    // 084 — catégories : best-effort, n'impacte pas le statut d'import des concours.
    const numeroToId = new Map<string, string>(
      (data ?? []).map((d: any) => [d.numero_ffe as string, d.id as string]),
    );
    const cat = await persistCategories(rows, numeroToId);
    if (cat.error) console.warn('[import-concours] catégories non écrites:', cat.error);

    // écrits en base = nouveaux insérés (affectés − déjà présents).
    return {
      written: Math.max(affected - doublonsBase, 0),
      doublonsBase,
      categoriesWritten: cat.written,
      categoriesError: cat.error,
      error: null,
    };
  } catch (e: any) {
    const msg = e?.message ?? String(e);
    console.warn('[import-concours] persistance concours indisponible:', msg);
    return { written: 0, doublonsBase: 0, categoriesWritten: 0, categoriesError: null, error: msg };
  }
}

// ── CSV Parser ──────────────────────────────────────────────────────────────
// Parseur RFC 4180 single-pass extrait dans lib/csv.ts (gère guillemets, virgules
// internes « 1,05 », newlines internes, "" échappés, BOM). Voir lib/csv.ts.

// ── Column mapping (FFE format + demo format) ───────────────────────────────

const HEADER_MAP: Record<string, keyof ConcoursCSVRaw> = {
  'Date de début': 'date_debut',
  'date_debut': 'date_debut',
  'Date de fin': 'date_fin',
  'date_fin': 'date_fin',
  'Date de clôture': 'date_cloture',
  'date_cloture': 'date_cloture',
  'Organisateur terrain': 'organisateur_terrain',
  'organisateur_terrain': 'organisateur_terrain',
  'Organisateur financier': 'organisateur_financier',
  'organisateur_financier': 'organisateur_financier',
  'Lieu': 'lieu',
  'lieu': 'lieu',
  'Type de concours': 'type_concours',
  'type_concours': 'type_concours',
  // Format « fusion canonique » : la discipline (CCE/CSO/Dressage…) est dans sa
  // propre colonne, type_concours y est souvent vide → on l'alimente aussi.
  'discipline': 'type_concours',
  'Discipline': 'type_concours',
  'Département': 'departement',
  'departement': 'departement',
  'CRE': 'cre',
  'cre': 'cre',
  // Format « fusion canonique » : la région (CRE) est dans la colonne « region ».
  'region': 'cre',
  'Région': 'cre',
  'Numéro de concours': 'numero_concours',
  'numero_concours': 'numero_concours',
  'Etat': 'etat',
  'etat': 'etat',
  'Épreuve': 'epreuves_raw',
  'Epreuve': 'epreuves_raw',
  'epreuves': 'epreuves_raw',
  // 084 — catégories FFE (liste séparée par virgules), découpées à l'import.
  'categories': 'categories_raw',
  'Catégories': 'categories_raw',
  'Categories': 'categories_raw',
  'nom_concours': 'nom_concours_direct',
  'adresse': 'adresse',
};

interface ConcoursCSVRaw {
  date_debut?: string;
  date_fin?: string;
  date_cloture?: string;
  organisateur_terrain?: string;
  organisateur_financier?: string;
  lieu?: string;
  type_concours?: string;
  departement?: string;
  cre?: string;
  numero_concours?: string;
  etat?: string;
  epreuves_raw?: string;
  categories_raw?: string;
  nom_concours_direct?: string;
  adresse?: string;
}

function mapRow(raw: Record<string, string>): ConcoursCSVRaw {
  const mapped: ConcoursCSVRaw = {};
  for (const [key, value] of Object.entries(raw)) {
    const field = HEADER_MAP[key];
    // On ignore les valeurs vides : sinon une colonne `type_concours` vide
    // écraserait la `discipline` déjà mappée sur le même champ (fusion canonique).
    if (field && value) (mapped as any)[field] = value;
  }
  return mapped;
}

// Normalise une date en ISO (YYYY-MM-DD). Gère :
//   - ISO déjà conforme (« 2026-04-28 ») → inchangé (format historique préservé)
//   - FFE « fusion canonique » au format « DD/MM/YYYY » (« 23/08/2026 ») → ISO
// Retourne undefined si non interprétable (ex « 17/08 » sans année).
function normalizeDate(s: string | undefined): string | undefined {
  if (!s) return undefined;
  const t = s.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t;                 // déjà ISO
  const m = t.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);            // DD/MM/YYYY
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  return undefined;
}

function isValidDate(s: string | undefined): boolean {
  if (!s) return false;
  const d = new Date(s);
  return !isNaN(d.getTime());
}

function buildNomConcours(row: ConcoursCSVRaw): string {
  if (row.nom_concours_direct) return row.nom_concours_direct;
  const parts = [row.lieu, row.type_concours, row.numero_concours].filter(Boolean);
  return parts.join(' — ') || 'Concours sans nom';
}

// ── Validation & parsing ────────────────────────────────────────────────────

interface ParseResult {
  valid: ConcoursCSV[];
  errors: { row: number; data: string; message: string }[];
  skipped: number;
}

function processCSVRows(
  rows: Record<string, string>[],
  batchId: string,
): ParseResult {
  // Dédoublonnage UNIQUEMENT intra-fichier ici. La déduplication contre la BASE
  // (numero_ffe déjà présents) est faite au moment de l'écriture (persistConcoursToDb),
  // pour ne pas dépendre du store mémoire (qui pouvait être pollué par un import raté).
  const result: ParseResult = { valid: [], errors: [], skipped: 0 };
  const seenInBatch = new Set<string>();

  rows.forEach((raw, idx) => {
    const rowNum = idx + 2; // +1 for header, +1 for 1-based
    const mapped = mapRow(raw);

    // Normalisation des dates (ISO passthrough ou DD/MM/YYYY → ISO).
    // date_fin absente (cas « fusion canonique ») → repli sur date_debut.
    const dDebut = normalizeDate(mapped.date_debut);
    const dFin = normalizeDate(mapped.date_fin) || dDebut;
    const dCloture = normalizeDate(mapped.date_cloture);

    // Validation
    if (!mapped.date_debut) {
      result.errors.push({ row: rowNum, data: JSON.stringify(raw), message: 'date_debut manquante' });
      return;
    }
    if (!mapped.lieu && !mapped.nom_concours_direct) {
      result.errors.push({ row: rowNum, data: JSON.stringify(raw), message: 'lieu manquant' });
      return;
    }
    if (!isValidDate(dDebut)) {
      result.errors.push({ row: rowNum, data: JSON.stringify(raw), message: `date_debut invalide: "${mapped.date_debut}"` });
      return;
    }
    if (!isValidDate(dFin)) {
      result.errors.push({ row: rowNum, data: JSON.stringify(raw), message: `date_fin invalide: "${mapped.date_fin}"` });
      return;
    }
    if (new Date(dDebut!) > new Date(dFin!)) {
      result.errors.push({ row: rowNum, data: JSON.stringify(raw), message: 'date_debut > date_fin' });
      return;
    }

    const numero = mapped.numero_concours || buildNomConcours(mapped);

    // Doublon intra-fichier (même numéro répété dans le CSV) → skip.
    if (seenInBatch.has(numero)) {
      result.skipped++;
      return;
    }

    seenInBatch.add(numero);

    result.valid.push({
      id: `csv_${Date.now()}_${rowNum}`,
      nom_concours: buildNomConcours(mapped),
      date_debut: dDebut || null,
      date_fin: dFin || null,
      date_cloture: dCloture || null,
      organisateur_terrain: mapped.organisateur_terrain || null,
      organisateur_financier: mapped.organisateur_financier || null,
      lieu: mapped.lieu || null,
      type_concours: mapped.type_concours || null,
      departement: mapped.departement || null,
      cre: mapped.cre || null,
      numero_concours: mapped.numero_concours || null,
      etat: mapped.etat || null,
      liste_epreuves: parseEpreuves(mapped.epreuves_raw),
      categories: parseCategories(mapped.categories_raw),
      adresse: mapped.adresse || null,
      source_import: 'csv',
      import_batch_id: batchId,
      created_at: new Date().toISOString(),
    });
  });

  return result;
}

// ── Screen ──────────────────────────────────────────────────────────────────

type ViewMode = 'upload' | 'preview' | 'history';

export default function ImportConcoursScreen() {
  const [viewMode, setViewMode] = useState<ViewMode>('upload');
  const [loading, setLoading] = useState(false);
  const [filename, setFilename] = useState('');
  const [headers, setHeaders] = useState<string[]>([]);
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [imported, setImported] = useState(false);
  const [dbResult, setDbResult] = useState<{ written: number; doublonsBase: number; categoriesWritten: number; categoriesError: string | null; error: string | null } | null>(null);
  const [tick, setTick] = useState(0);

  function refresh() { setTick(t => t + 1); }

  function handlePickFile() {
    if (Platform.OS !== 'web') return;

    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.csv,text/csv,text/plain';

    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return;

      setLoading(true);
      setFilename(file.name);
      setImported(false);
      setParseResult(null);

      const reader = new FileReader();
      reader.onload = (e) => {
        // Lecture à l'OCTET puis décodage robuste (UTF-8 / Windows-1252 / double-encodage)
        // pour éviter le mojibake « PrÃ©paratoire/AnnulÃ© » sur les exports FFE/Excel.
        const buffer = e.target?.result as ArrayBuffer;
        const text = decodeImportedText(buffer);
        const { headers: hdrs, rows } = parseCSV(text);
        setHeaders(hdrs);

        const batchId = `batch_${Date.now()}`;
        const result = processCSVRows(rows, batchId);
        setParseResult(result);
        setLoading(false);
        setViewMode('preview');
      };

      reader.onerror = () => {
        setLoading(false);
        alert('Erreur lors de la lecture du fichier.');
      };

      reader.readAsArrayBuffer(file);
    };

    input.click();
  }

  async function handleImport() {
    if (!parseResult || parseResult.valid.length === 0) return;
    setLoading(true);
    setDbResult(null);

    const batchId = parseResult.valid[0].import_batch_id!;
    const batch: ImportBatch = {
      id: batchId,
      filename,
      imported_at: new Date().toISOString(),
      total_rows: parseResult.valid.length + parseResult.errors.length + parseResult.skipped,
      imported_count: parseResult.valid.length,
      error_count: parseResult.errors.length,
      skipped_count: parseResult.skipped,
    };

    // Persistance DB RÉELLE d'abord : on ne touche au store mémoire QUE si l'écriture réussit.
    const res = await persistConcoursToDb(parseResult.valid);
    setDbResult(res);

    if (!res.error) {
      // Succès : on reflète dans le store + l'historique (sinon, on ne pollue rien).
      concoursCsvStore.list.push(...parseResult.valid);
      concoursCsvStore.batches.unshift(batch);
      parseResult.errors.forEach((e, idx) => {
        concoursCsvStore.errors.push({
          id: `err_${batchId}_${idx}`,
          batch_id: batchId,
          row_number: e.row,
          raw_data: e.data,
          error_message: e.message,
        });
      });
    }

    setLoading(false);
    setImported(true);
    refresh();
  }

  function handleReset() {
    setViewMode('upload');
    setFilename('');
    setHeaders([]);
    setParseResult(null);
    setImported(false);
  }

  // Vide le cache d'import en mémoire (store mock + historique + erreurs). Sert au
  // diagnostic : le dédoublonnage réel se fait désormais contre la BASE, mais ce
  // cache alimente l'historique/aperçu local et peut rester pollué par d'anciens essais.
  function handleClearImportCache() {
    concoursCsvStore.list.length = 0;
    concoursCsvStore.batches.length = 0;
    concoursCsvStore.errors.length = 0;
    setParseResult(null);
    setImported(false);
    setDbResult(null);
    setFilename('');
    setHeaders([]);
    refresh();
  }

  const batches = concoursCsvStore.batches;

  return (
    <SafeAreaView style={s.root}>
      {/* Header */}
      <View style={s.header}>
        <Text style={s.headerTitle}>📋 Upload concours</Text>
        <Text style={s.headerSub}>Importer des concours via fichier CSV</Text>
      </View>

      {/* View toggle */}
      <View style={s.toggleBar}>
        <TouchableOpacity
          style={[s.toggleBtn, viewMode !== 'history' && s.toggleBtnActive]}
          onPress={() => setViewMode(imported ? 'preview' : 'upload')}
        >
          <Text style={[s.toggleLabel, viewMode !== 'history' && s.toggleLabelActive]}>
            📤 Import
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[s.toggleBtn, viewMode === 'history' && s.toggleBtnActive]}
          onPress={() => setViewMode('history')}
        >
          <Text style={[s.toggleLabel, viewMode === 'history' && s.toggleLabelActive]}>
            🕓 Historique {batches.length > 0 ? `(${batches.length})` : ''}
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={s.content}>

        {/* ── UPLOAD VIEW ─────────────────────────────────────────── */}
        {viewMode === 'upload' && (
          <>
            <View style={s.uploadZone}>
              <Text style={s.uploadIcon}>📂</Text>
              <Text style={s.uploadTitle}>Sélectionner un fichier CSV</Text>
              <Text style={s.uploadHint}>
                Formats supportés : FFE standard, fusion canonique, CSV générique{'\n'}
                Séparateur : , ou ; (auto) · Encodage : UTF-8
              </Text>

              {Platform.OS === 'web' ? (
                <TouchableOpacity style={s.uploadBtn} onPress={handlePickFile} activeOpacity={0.8}>
                  <Text style={s.uploadBtnText}>Choisir un fichier</Text>
                </TouchableOpacity>
              ) : (
                <View style={s.mobileNote}>
                  <Text style={s.mobileNoteText}>
                    L'import CSV est disponible sur la version web de l'application.
                  </Text>
                </View>
              )}
            </View>

            {/* Colonnes attendues */}
            <View style={s.infoCard}>
              <Text style={s.infoCardTitle}>Colonnes reconnues</Text>
              <View style={s.colList}>
                {[
                  ['Date de début', 'date_debut', '✅ Obligatoire'],
                  ['Date de fin', 'date_fin', '✅ Obligatoire'],
                  ['Lieu', 'lieu', '✅ Obligatoire'],
                  ['Type de concours', 'type_concours', 'Optionnel'],
                  ['Département', 'departement', 'Optionnel'],
                  ['Numéro de concours', 'numero_concours', 'Dédoublonnage'],
                  ['Épreuve / epreuves', 'liste_epreuves', 'Séparateur ;'],
                  ['categories', 'concours_categories', 'Séparateur ,'],
                  ['Discipline / region', 'type_concours / cre', 'Optionnel'],
                  ['Date de clôture', 'date_cloture', 'Optionnel'],
                  ['Organisateur terrain', 'organisateur_terrain', 'Optionnel'],
                  ['Organisateur financier', 'organisateur_financier', 'Optionnel'],
                  ['CRE', 'cre', 'Optionnel'],
                  ['Etat', 'etat', 'Optionnel'],
                ].map(([col, field, note]) => (
                  <View key={field} style={s.colRow}>
                    <Text style={s.colName}>{col}</Text>
                    <Text style={s.colField}>→ {field}</Text>
                    <Text style={[s.colNote, note?.startsWith('✅') && s.colNoteRequired]}>{note}</Text>
                  </View>
                ))}
              </View>
            </View>
          </>
        )}

        {/* ── PREVIEW VIEW ────────────────────────────────────────── */}
        {viewMode === 'preview' && parseResult && (
          <>
            {/* Summary */}
            <View style={s.summaryRow}>
              <View style={[s.summaryCard, { borderColor: '#22C55E' }]}>
                <Text style={[s.summaryNum, { color: '#22C55E' }]}>{parseResult.valid.length}</Text>
                <Text style={s.summaryLabel}>Valides</Text>
              </View>
              <View style={[s.summaryCard, { borderColor: Colors.urgent }]}>
                <Text style={[s.summaryNum, { color: Colors.urgent }]}>{parseResult.errors.length}</Text>
                <Text style={s.summaryLabel}>Erreurs</Text>
              </View>
              <View style={[s.summaryCard, { borderColor: Colors.gold }]}>
                <Text style={[s.summaryNum, { color: Colors.gold }]}>{parseResult.skipped}</Text>
                <Text style={s.summaryLabel}>Doublons</Text>
              </View>
            </View>

            {/* File info */}
            <View style={s.fileTag}>
              <Text style={s.fileTagIcon}>📄</Text>
              <Text style={s.fileTagName}>{filename}</Text>
            </View>

            {/* Detected headers */}
            {headers.length > 0 && (
              <View style={s.headersBox}>
                <Text style={s.headersTitle}>Colonnes détectées ({headers.length})</Text>
                <Text style={s.headersText}>{headers.join(' · ')}</Text>
              </View>
            )}

            {/* Import result banner — reflète le RÉEL écrit en base (pas un faux succès).
                Compteurs séparés : écrits en base · doublons base · erreurs. */}
            {imported && dbResult && (
              dbResult.error ? (
                <View style={[s.successBanner, { backgroundColor: '#FEE2E2', borderColor: '#FCA5A5' }]}>
                  <Text style={[s.successText, { color: '#B91C1C' }]}>
                    ❌ Échec de l'enregistrement en base : 0 concours écrit.
                  </Text>
                  <Text style={{ color: '#B91C1C', fontSize: 12, marginTop: 4 }}>{dbResult.error}</Text>
                </View>
              ) : (
                <View style={[s.successBanner, dbResult.written === 0 && { backgroundColor: '#FEF3C7', borderColor: '#FCD34D' }]}>
                  <Text style={[s.successText, dbResult.written === 0 && { color: '#92400E' }]}>
                    ✅ {dbResult.written} écrits en base · ⏭ {dbResult.doublonsBase} doublons (déjà en base) · ⚠️ {parseResult.errors.length} erreurs
                  </Text>
                  <Text style={{ color: '#475569', fontSize: 12, marginTop: 4, textAlign: 'center' }}>
                    {dbResult.categoriesError
                      ? `🏷 Catégories non écrites (table 084 absente ?)`
                      : `🏷 ${dbResult.categoriesWritten} catégories rattachées`}
                  </Text>
                </View>
              )
            )}

            {/* Preview list */}
            {parseResult.valid.length > 0 && !imported && (
              <>
                <Text style={s.sectionTitle}>Aperçu des concours valides</Text>
                {parseResult.valid.slice(0, 5).map((c, i) => (
                  <View key={c.id} style={s.previewCard}>
                    <View style={s.previewRow}>
                      <Text style={s.previewNum}>#{i + 1}</Text>
                      <Text style={s.previewName}>{c.nom_concours}</Text>
                    </View>
                    <Text style={s.previewMeta}>
                      📅 {c.date_debut} → {c.date_fin}
                      {c.lieu ? `  📍 ${c.lieu}` : ''}
                      {c.departement ? `  (${c.departement})` : ''}
                    </Text>
                    {c.liste_epreuves.length > 0 && (
                      <Text style={s.previewEpreuves}>
                        🏇 {c.liste_epreuves.join(', ')}
                      </Text>
                    )}
                  </View>
                ))}
                {parseResult.valid.length > 5 && (
                  <Text style={s.moreHint}>… et {parseResult.valid.length - 5} autres concours</Text>
                )}
              </>
            )}

            {/* Errors */}
            {parseResult.errors.length > 0 && (
              <>
                <Text style={[s.sectionTitle, { color: Colors.urgent }]}>Erreurs de validation</Text>
                {parseResult.errors.map((e, i) => (
                  <View key={i} style={s.errorCard}>
                    <Text style={s.errorRow}>Ligne {e.row}</Text>
                    <Text style={s.errorMsg}>{e.message}</Text>
                  </View>
                ))}
              </>
            )}

            {/* Actions */}
            <View style={s.actionsRow}>
              <TouchableOpacity style={s.cancelBtn} onPress={handleReset} activeOpacity={0.8}>
                <Text style={s.cancelBtnText}>← Retour</Text>
              </TouchableOpacity>
              {!imported && parseResult.valid.length > 0 && (
                <TouchableOpacity
                  style={s.importBtn}
                  onPress={handleImport}
                  activeOpacity={0.8}
                  disabled={loading}
                >
                  {loading
                    ? <ActivityIndicator color="#fff" size="small" />
                    : <Text style={s.importBtnText}>Importer {parseResult.valid.length} concours</Text>
                  }
                </TouchableOpacity>
              )}
              {imported && (
                <TouchableOpacity style={s.importBtn} onPress={handleReset} activeOpacity={0.8}>
                  <Text style={s.importBtnText}>Importer un autre fichier</Text>
                </TouchableOpacity>
              )}
            </View>
          </>
        )}

        {/* ── HISTORY VIEW ────────────────────────────────────────── */}
        {viewMode === 'history' && (
          <>
            {batches.length === 0 ? (
              <View style={s.emptyState}>
                <Text style={s.emptyIcon}>🕓</Text>
                <Text style={s.emptyTitle}>Aucun import</Text>
                <Text style={s.emptyText}>L'historique des imports apparaîtra ici.</Text>
              </View>
            ) : (
              batches.map((batch) => (
                <View key={batch.id} style={s.batchCard}>
                  <View style={s.batchHeader}>
                    <Text style={s.batchFilename}>📄 {batch.filename}</Text>
                    <Text style={s.batchDate}>
                      {new Date(batch.imported_at).toLocaleDateString('fr-FR', {
                        day: '2-digit', month: 'short', year: 'numeric',
                        hour: '2-digit', minute: '2-digit',
                      })}
                    </Text>
                  </View>
                  <View style={s.batchStats}>
                    <Text style={[s.batchStat, { color: '#22C55E' }]}>✅ {batch.imported_count} importés</Text>
                    {batch.error_count > 0 && (
                      <Text style={[s.batchStat, { color: Colors.urgent }]}>❌ {batch.error_count} erreurs</Text>
                    )}
                    {batch.skipped_count > 0 && (
                      <Text style={[s.batchStat, { color: Colors.gold }]}>⏭ {batch.skipped_count} doublons</Text>
                    )}
                  </View>
                </View>
              ))
            )}

            {/* Total imported (cache local mémoire) */}
            {concoursCsvStore.list.length > 0 && (
              <View style={s.totalCard}>
                <Text style={s.totalText}>
                  📊 Cache local : {concoursCsvStore.list.length} concours
                </Text>
              </View>
            )}

            {/* Diagnostic : vider le cache d'import en mémoire */}
            <TouchableOpacity style={s.clearCacheBtn} onPress={handleClearImportCache} activeOpacity={0.85}>
              <Text style={s.clearCacheTxt}>🧹 Vider le cache import concours</Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Styles ──────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  clearCacheBtn: { marginTop: 16, alignSelf: 'center', backgroundColor: '#FEE2E2', borderWidth: 1, borderColor: '#FCA5A5', borderRadius: 10, paddingVertical: 10, paddingHorizontal: 16 },
  clearCacheTxt: { color: '#B91C1C', fontWeight: '700', fontSize: 13 },

  header: {
    padding: Spacing.lg,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerTitle: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  headerSub: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 2 },

  toggleBar: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    paddingHorizontal: Spacing.lg,
    gap: Spacing.sm,
  },
  toggleBtn: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  toggleBtnActive: { borderBottomColor: Colors.primary },
  toggleLabel: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: Colors.textSecondary },
  toggleLabelActive: { color: Colors.primary },

  content: { padding: Spacing.lg, gap: Spacing.md },

  // Upload zone
  uploadZone: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    borderWidth: 2,
    borderColor: Colors.border,
    borderStyle: 'dashed',
    alignItems: 'center',
    padding: Spacing.xl,
    gap: Spacing.md,
  } as any,
  uploadIcon: { fontSize: 48 },
  uploadTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  uploadHint: { fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: 'center', lineHeight: 20 },
  uploadBtn: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.lg,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xl,
  },
  uploadBtnText: { color: '#fff', fontWeight: FontWeight.bold, fontSize: FontSize.base },

  mobileNote: {
    backgroundColor: Colors.surfaceVariant,
    borderRadius: Radius.md,
    padding: Spacing.md,
  },
  mobileNoteText: { fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: 'center' },

  // Info card
  infoCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  infoCardTitle: { fontSize: FontSize.base, fontWeight: FontWeight.bold, color: Colors.textPrimary, marginBottom: Spacing.md },
  colList: { gap: 6 },
  colRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  colName: { fontSize: FontSize.xs, color: Colors.textPrimary, width: 160 },
  colField: { fontSize: FontSize.xs, color: Colors.primary, flex: 1 },
  colNote: { fontSize: FontSize.xs, color: Colors.textTertiary },
  colNoteRequired: { color: '#22C55E', fontWeight: FontWeight.semibold },

  // Summary
  summaryRow: { flexDirection: 'row', gap: Spacing.md },
  summaryCard: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    borderWidth: 2,
    padding: Spacing.md,
    alignItems: 'center',
    gap: 4,
  },
  summaryNum: { fontSize: FontSize.xxl, fontWeight: FontWeight.extrabold },
  summaryLabel: { fontSize: FontSize.xs, color: Colors.textSecondary, fontWeight: FontWeight.semibold },

  fileTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.surfaceVariant,
    borderRadius: Radius.md,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
  },
  fileTagIcon: { fontSize: 16 },
  fileTagName: { fontSize: FontSize.sm, color: Colors.textSecondary, flex: 1 },

  headersBox: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  headersTitle: { fontSize: FontSize.xs, fontWeight: FontWeight.bold, color: Colors.textTertiary, marginBottom: 4 },
  headersText: { fontSize: FontSize.xs, color: Colors.textSecondary, lineHeight: 18 },

  successBanner: {
    backgroundColor: '#F0FDF4',
    borderRadius: Radius.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: '#86EFAC',
  },
  successText: { fontSize: FontSize.base, fontWeight: FontWeight.semibold, color: '#16A34A', textAlign: 'center' },

  sectionTitle: { fontSize: FontSize.base, fontWeight: FontWeight.bold, color: Colors.textPrimary },

  previewCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 4,
  },
  previewRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  previewNum: { fontSize: FontSize.xs, color: Colors.textTertiary, fontWeight: FontWeight.bold, width: 24 },
  previewName: { fontSize: FontSize.base, fontWeight: FontWeight.semibold, color: Colors.textPrimary, flex: 1 },
  previewMeta: { fontSize: FontSize.sm, color: Colors.textSecondary },
  previewEpreuves: { fontSize: FontSize.xs, color: Colors.primary },
  moreHint: { fontSize: FontSize.sm, color: Colors.textTertiary, textAlign: 'center', fontStyle: 'italic' },

  errorCard: {
    backgroundColor: '#FFF5F5',
    borderRadius: Radius.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: '#FCA5A5',
    gap: 2,
  },
  errorRow: { fontSize: FontSize.xs, fontWeight: FontWeight.bold, color: Colors.urgent },
  errorMsg: { fontSize: FontSize.sm, color: Colors.urgent },

  actionsRow: { flexDirection: 'row', gap: Spacing.md, marginTop: Spacing.sm },
  cancelBtn: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cancelBtnText: { fontSize: FontSize.base, color: Colors.textSecondary, fontWeight: FontWeight.semibold },
  importBtn: {
    flex: 2,
    backgroundColor: Colors.primary,
    borderRadius: Radius.lg,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  importBtnText: { fontSize: FontSize.base, color: '#fff', fontWeight: FontWeight.bold },

  // History
  batchCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: Spacing.sm,
    ...Shadow.card,
  },
  batchHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  batchFilename: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: Colors.textPrimary, flex: 1 },
  batchDate: { fontSize: FontSize.xs, color: Colors.textTertiary },
  batchStats: { flexDirection: 'row', gap: Spacing.md, flexWrap: 'wrap' },
  batchStat: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold },

  totalCard: {
    backgroundColor: Colors.primaryLight,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    alignItems: 'center',
  },
  totalText: { fontSize: FontSize.base, fontWeight: FontWeight.bold, color: Colors.primary },

  emptyState: { alignItems: 'center', paddingVertical: 60, gap: Spacing.md },
  emptyIcon: { fontSize: 48 },
  emptyTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  emptyText: { fontSize: FontSize.sm, color: Colors.textSecondary },
});
