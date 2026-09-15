// ─────────────────────────────────────────────────────────────────────────────
// AdminImportConcoursV2 — reskin Blush de app/(tabs)/import-concours.tsx.
// Logique métier (parsing CSV, normalisation, persistance concours+catégories)
// REPRISE À L'IDENTIQUE — seul le rendu change. Même stores/libs partagés
// (lib/csv, lib/encoding, lib/epreuves, lib/categories, data/store). 0 nouvel
// objet backend. Web only (comme V1 — file picker natif indisponible mobile).
// ─────────────────────────────────────────────────────────────────────────────
import { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Platform, ActivityIndicator } from 'react-native';
import { BL, FONT } from '../../ui/blush';
import { Segment } from '../../ui/kit';
import { Spacing, FontSize, FontWeight } from '../../../constants/theme';
import { concoursCsvStore } from '../../../data/store';
import { supabase } from '../../../lib/supabase';
import { parseCSV } from '../../../lib/csv';
import { decodeImportedText } from '../../../lib/encoding';
import { parseEpreuves } from '../../../lib/epreuves';
import { parseCategories } from '../../../lib/categories';
import { ConcoursCSV, ImportBatch } from '../../../types/concours';

// ── Persistance (identique V1) ──────────────────────────────────────────────

async function persistCategories(rows: ConcoursCSV[], numeroToId: Map<string, string>): Promise<{ written: number; error: string | null }> {
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
    const { error: delErr } = await supabase.from('concours_categories').delete().in('concours_id', [...concoursIds]);
    if (delErr) return { written: 0, error: delErr.message };
    if (catRows.length === 0) return { written: 0, error: null };
    const { error: insErr } = await supabase.from('concours_categories').insert(catRows);
    if (insErr) return { written: 0, error: insErr.message };
    return { written: catRows.length, error: null };
  } catch (e: any) {
    return { written: 0, error: e?.message ?? String(e) };
  }
}

async function persistConcoursToDb(rows: ConcoursCSV[]): Promise<{ written: number; doublonsBase: number; categoriesWritten: number; categoriesError: string | null; error: string | null }> {
  const payload = rows
    .filter((r) => r.numero_concours)
    .map((r) => ({
      numero_ffe: r.numero_concours, nom: r.nom_concours, date_debut: r.date_debut, date_fin: r.date_fin,
      date_cloture: r.date_cloture, lieu: r.lieu, adresse: r.adresse, departement: r.departement,
      type_concours: r.type_concours, cre: r.cre, organisateur_terrain: r.organisateur_terrain,
      organisateur_financier: r.organisateur_financier, liste_epreuves: r.liste_epreuves, etat: r.etat,
      source_import: 'csv', import_batch_id: r.import_batch_id,
    }));
  if (payload.length === 0) return { written: 0, doublonsBase: 0, categoriesWritten: 0, categoriesError: null, error: null };
  try {
    const numeros = payload.map((p) => p.numero_ffe).filter(Boolean) as string[];
    const { data: existing, error: exErr } = await supabase.from('concours').select('numero_ffe').in('numero_ffe', numeros);
    if (exErr) return { written: 0, doublonsBase: 0, categoriesWritten: 0, categoriesError: null, error: exErr.message };
    const existingSet = new Set((existing ?? []).map((e: any) => e.numero_ffe));
    const doublonsBase = payload.filter((p) => existingSet.has(p.numero_ffe)).length;

    const { data, error } = await supabase.from('concours').upsert(payload, { onConflict: 'numero_ffe' }).select('id, numero_ffe');
    if (error) return { written: 0, doublonsBase: 0, categoriesWritten: 0, categoriesError: null, error: error.message };
    const affected = data?.length ?? 0;

    const numeroToId = new Map<string, string>((data ?? []).map((d: any) => [d.numero_ffe as string, d.id as string]));
    const cat = await persistCategories(rows, numeroToId);

    return { written: Math.max(affected - doublonsBase, 0), doublonsBase, categoriesWritten: cat.written, categoriesError: cat.error, error: null };
  } catch (e: any) {
    return { written: 0, doublonsBase: 0, categoriesWritten: 0, categoriesError: null, error: e?.message ?? String(e) };
  }
}

// ── Parsing (identique V1) ──────────────────────────────────────────────────

const HEADER_MAP: Record<string, keyof ConcoursCSVRaw> = {
  'Date de début': 'date_debut', 'date_debut': 'date_debut',
  'Date de fin': 'date_fin', 'date_fin': 'date_fin',
  'Date de clôture': 'date_cloture', 'date_cloture': 'date_cloture',
  'Organisateur terrain': 'organisateur_terrain', 'organisateur_terrain': 'organisateur_terrain',
  'Organisateur financier': 'organisateur_financier', 'organisateur_financier': 'organisateur_financier',
  'Lieu': 'lieu', 'lieu': 'lieu',
  'Type de concours': 'type_concours', 'type_concours': 'type_concours',
  'discipline': 'type_concours', 'Discipline': 'type_concours',
  'Département': 'departement', 'departement': 'departement',
  'CRE': 'cre', 'cre': 'cre', 'region': 'cre', 'Région': 'cre',
  'Numéro de concours': 'numero_concours', 'numero_concours': 'numero_concours',
  'Etat': 'etat', 'etat': 'etat',
  'Épreuve': 'epreuves_raw', 'Epreuve': 'epreuves_raw', 'epreuves': 'epreuves_raw',
  'categories': 'categories_raw', 'Catégories': 'categories_raw', 'Categories': 'categories_raw',
  'nom_concours': 'nom_concours_direct', 'adresse': 'adresse',
};

interface ConcoursCSVRaw {
  date_debut?: string; date_fin?: string; date_cloture?: string;
  organisateur_terrain?: string; organisateur_financier?: string; lieu?: string;
  type_concours?: string; departement?: string; cre?: string; numero_concours?: string;
  etat?: string; epreuves_raw?: string; categories_raw?: string; nom_concours_direct?: string; adresse?: string;
}

function mapRow(raw: Record<string, string>): ConcoursCSVRaw {
  const mapped: ConcoursCSVRaw = {};
  for (const [key, value] of Object.entries(raw)) {
    const field = HEADER_MAP[key];
    if (field && value) (mapped as any)[field] = value;
  }
  return mapped;
}

function normalizeDate(s: string | undefined): string | undefined {
  if (!s) return undefined;
  const t = s.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t;
  const m = t.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
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

interface ParseResult {
  valid: ConcoursCSV[];
  errors: { row: number; data: string; message: string }[];
  skipped: number;
}

function processCSVRows(rows: Record<string, string>[], batchId: string): ParseResult {
  const result: ParseResult = { valid: [], errors: [], skipped: 0 };
  const seenInBatch = new Set<string>();

  rows.forEach((raw, idx) => {
    const rowNum = idx + 2;
    const mapped = mapRow(raw);
    const dDebut = normalizeDate(mapped.date_debut);
    const dFin = normalizeDate(mapped.date_fin) || dDebut;
    const dCloture = normalizeDate(mapped.date_cloture);

    if (!mapped.date_debut) { result.errors.push({ row: rowNum, data: JSON.stringify(raw), message: 'date_debut manquante' }); return; }
    if (!mapped.lieu && !mapped.nom_concours_direct) { result.errors.push({ row: rowNum, data: JSON.stringify(raw), message: 'lieu manquant' }); return; }
    if (!isValidDate(dDebut)) { result.errors.push({ row: rowNum, data: JSON.stringify(raw), message: `date_debut invalide: "${mapped.date_debut}"` }); return; }
    if (!isValidDate(dFin)) { result.errors.push({ row: rowNum, data: JSON.stringify(raw), message: `date_fin invalide: "${mapped.date_fin}"` }); return; }
    if (new Date(dDebut!) > new Date(dFin!)) { result.errors.push({ row: rowNum, data: JSON.stringify(raw), message: 'date_debut > date_fin' }); return; }

    const numero = mapped.numero_concours || buildNomConcours(mapped);
    if (seenInBatch.has(numero)) { result.skipped++; return; }
    seenInBatch.add(numero);

    result.valid.push({
      id: `csv_${Date.now()}_${rowNum}`,
      nom_concours: buildNomConcours(mapped),
      date_debut: dDebut || null, date_fin: dFin || null, date_cloture: dCloture || null,
      organisateur_terrain: mapped.organisateur_terrain || null, organisateur_financier: mapped.organisateur_financier || null,
      lieu: mapped.lieu || null, type_concours: mapped.type_concours || null, departement: mapped.departement || null,
      cre: mapped.cre || null, numero_concours: mapped.numero_concours || null, etat: mapped.etat || null,
      liste_epreuves: parseEpreuves(mapped.epreuves_raw), categories: parseCategories(mapped.categories_raw),
      adresse: mapped.adresse || null, source_import: 'csv', import_batch_id: batchId, created_at: new Date().toISOString(),
    });
  });

  return result;
}

// ── Écran ────────────────────────────────────────────────────────────────────

type ViewMode = 'upload' | 'preview' | 'history';

export function AdminImportConcoursV2() {
  const [viewMode, setViewMode] = useState<ViewMode>('upload');
  const [loading, setLoading] = useState(false);
  const [filename, setFilename] = useState('');
  const [headers, setHeaders] = useState<string[]>([]);
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [imported, setImported] = useState(false);
  const [dbResult, setDbResult] = useState<{ written: number; doublonsBase: number; categoriesWritten: number; categoriesError: string | null; error: string | null } | null>(null);
  const [, setTick] = useState(0);
  function refresh() { setTick((t) => t + 1); }

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
      reader.onerror = () => { setLoading(false); alert('Erreur lors de la lecture du fichier.'); };
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
      id: batchId, filename, imported_at: new Date().toISOString(),
      total_rows: parseResult.valid.length + parseResult.errors.length + parseResult.skipped,
      imported_count: parseResult.valid.length, error_count: parseResult.errors.length, skipped_count: parseResult.skipped,
    };
    const res = await persistConcoursToDb(parseResult.valid);
    setDbResult(res);
    if (!res.error) {
      concoursCsvStore.list.push(...parseResult.valid);
      concoursCsvStore.batches.unshift(batch);
      parseResult.errors.forEach((e, idx) => {
        concoursCsvStore.errors.push({ id: `err_${batchId}_${idx}`, batch_id: batchId, row_number: e.row, raw_data: e.data, error_message: e.message });
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
    <View style={s.root}>
      <View style={s.header}>
        <Text style={s.h1}>Import concours</Text>
        <Text style={s.headerSub}>Importer des concours via fichier CSV (FFE)</Text>
        <Segment
          options={[{ key: 'import', label: '📤 Import' }, { key: 'history', label: `🕓 Historique ${batches.length > 0 ? `(${batches.length})` : ''}` }]}
          value={viewMode === 'history' ? 'history' : 'import'}
          onChange={(v) => setViewMode(v === 'history' ? 'history' : (imported ? 'preview' : 'upload'))}
        />
      </View>

      <ScrollView contentContainerStyle={s.content}>
        {viewMode === 'upload' && (
          <>
            <View style={s.uploadZone}>
              <Text style={s.uploadIcon}>📂</Text>
              <Text style={s.uploadTitle}>Sélectionner un fichier CSV</Text>
              <Text style={s.uploadHint}>Formats : FFE standard, fusion canonique, CSV générique{'\n'}Séparateur : , ou ; (auto) · Encodage : UTF-8 / Win-1252</Text>
              {Platform.OS === 'web' ? (
                <TouchableOpacity style={s.uploadBtn} onPress={handlePickFile} activeOpacity={0.9}>
                  <Text style={s.uploadBtnTxt}>Choisir un fichier</Text>
                </TouchableOpacity>
              ) : (
                <View style={s.mobileNote}><Text style={s.mobileNoteTxt}>L'import CSV est disponible sur la version web de l'application.</Text></View>
              )}
            </View>

            <View style={s.card}>
              <Text style={s.cardTitle}>Colonnes reconnues</Text>
              <View style={{ gap: 6 }}>
                {[
                  ['Date de début', 'date_debut', '✅ Obligatoire'], ['Date de fin', 'date_fin', '✅ Obligatoire'],
                  ['Lieu', 'lieu', '✅ Obligatoire'], ['Type de concours', 'type_concours', 'Optionnel'],
                  ['Département', 'departement', 'Optionnel'], ['Numéro de concours', 'numero_concours', 'Dédoublonnage'],
                  ['Épreuve / epreuves', 'liste_epreuves', 'Séparateur ;'], ['categories', 'concours_categories', 'Séparateur ,'],
                  ['Discipline / region', 'type_concours / cre', 'Optionnel'], ['Date de clôture', 'date_cloture', 'Optionnel'],
                  ['Organisateur terrain', 'organisateur_terrain', 'Optionnel'], ['Organisateur financier', 'organisateur_financier', 'Optionnel'],
                  ['CRE', 'cre', 'Optionnel'], ['Etat', 'etat', 'Optionnel'],
                ].map(([col, field, note]) => (
                  <View key={field} style={s.colRow}>
                    <Text style={s.colName}>{col}</Text>
                    <Text style={s.colField}>→ {field}</Text>
                    <Text style={[s.colNote, note?.startsWith('✅') && s.colNoteReq]}>{note}</Text>
                  </View>
                ))}
              </View>
            </View>
          </>
        )}

        {viewMode === 'preview' && parseResult && (
          <>
            <View style={s.summaryRow}>
              <View style={[s.summaryCard, { borderColor: BL.sage }]}><Text style={[s.summaryNum, { color: BL.sage }]}>{parseResult.valid.length}</Text><Text style={s.summaryLabel}>Valides</Text></View>
              <View style={[s.summaryCard, { borderColor: BL.berry }]}><Text style={[s.summaryNum, { color: BL.berry }]}>{parseResult.errors.length}</Text><Text style={s.summaryLabel}>Erreurs</Text></View>
              <View style={[s.summaryCard, { borderColor: BL.gold }]}><Text style={[s.summaryNum, { color: BL.gold }]}>{parseResult.skipped}</Text><Text style={s.summaryLabel}>Doublons</Text></View>
            </View>

            <View style={s.fileTag}><Text>📄</Text><Text style={s.fileTagName}>{filename}</Text></View>

            {headers.length > 0 && (
              <View style={s.card}><Text style={s.cardTitle}>Colonnes détectées ({headers.length})</Text><Text style={s.headersText}>{headers.join(' · ')}</Text></View>
            )}

            {imported && dbResult && (
              dbResult.error ? (
                <View style={[s.banner, { backgroundColor: '#FCE9EC', borderColor: BL.berry }]}>
                  <Text style={[s.bannerTxt, { color: BL.berry }]}>❌ Échec de l'enregistrement en base : 0 concours écrit.</Text>
                  <Text style={{ color: BL.berry, fontSize: 12, marginTop: 4 }}>{dbResult.error}</Text>
                </View>
              ) : (
                <View style={[s.banner, dbResult.written === 0 && { backgroundColor: BL.goldSoft, borderColor: BL.gold }]}>
                  <Text style={[s.bannerTxt, dbResult.written === 0 && { color: '#8A6A24' }]}>
                    ✅ {dbResult.written} écrits en base · ⏭ {dbResult.doublonsBase} doublons (déjà en base) · ⚠️ {parseResult.errors.length} erreurs
                  </Text>
                  <Text style={{ color: BL.sub, fontSize: 12, marginTop: 4, textAlign: 'center' }}>
                    {dbResult.categoriesError ? '🏷 Catégories non écrites (table 084 absente ?)' : `🏷 ${dbResult.categoriesWritten} catégories rattachées`}
                  </Text>
                </View>
              )
            )}

            {parseResult.valid.length > 0 && !imported && (
              <>
                <Text style={s.sectionTitle}>Aperçu des concours valides</Text>
                {parseResult.valid.slice(0, 5).map((c, i) => (
                  <View key={c.id} style={s.previewCard}>
                    <View style={{ flexDirection: 'row', gap: Spacing.sm }}>
                      <Text style={s.previewNum}>#{i + 1}</Text>
                      <Text style={s.previewName}>{c.nom_concours}</Text>
                    </View>
                    <Text style={s.previewMeta}>📅 {c.date_debut} → {c.date_fin}{c.lieu ? `  📍 ${c.lieu}` : ''}{c.departement ? `  (${c.departement})` : ''}</Text>
                    {c.liste_epreuves.length > 0 && <Text style={s.previewEpreuves}>🏇 {c.liste_epreuves.join(', ')}</Text>}
                  </View>
                ))}
                {parseResult.valid.length > 5 && <Text style={s.moreHint}>… et {parseResult.valid.length - 5} autres concours</Text>}
              </>
            )}

            {parseResult.errors.length > 0 && (
              <>
                <Text style={[s.sectionTitle, { color: BL.berry }]}>Erreurs de validation</Text>
                {parseResult.errors.map((e, i) => (
                  <View key={i} style={s.errorCard}><Text style={s.errorRow}>Ligne {e.row}</Text><Text style={s.errorMsg}>{e.message}</Text></View>
                ))}
              </>
            )}

            <View style={s.actionsRow}>
              <TouchableOpacity style={s.cancelBtn} onPress={handleReset} activeOpacity={0.85}><Text style={s.cancelBtnTxt}>← Retour</Text></TouchableOpacity>
              {!imported && parseResult.valid.length > 0 && (
                <TouchableOpacity style={s.importBtn} onPress={handleImport} activeOpacity={0.9} disabled={loading}>
                  {loading ? <ActivityIndicator color="#fff" size="small" /> : <Text style={s.importBtnTxt}>Importer {parseResult.valid.length} concours</Text>}
                </TouchableOpacity>
              )}
              {imported && (
                <TouchableOpacity style={s.importBtn} onPress={handleReset} activeOpacity={0.9}><Text style={s.importBtnTxt}>Importer un autre fichier</Text></TouchableOpacity>
              )}
            </View>
          </>
        )}

        {viewMode === 'history' && (
          <>
            {batches.length === 0 ? (
              <View style={s.empty}><Text style={s.emptyIcon}>🕓</Text><Text style={s.emptyTitle}>Aucun import</Text><Text style={s.emptyText}>L'historique des imports apparaîtra ici.</Text></View>
            ) : batches.map((batch) => (
              <View key={batch.id} style={s.card}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={s.batchFilename}>📄 {batch.filename}</Text>
                  <Text style={s.batchDate}>{new Date(batch.imported_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</Text>
                </View>
                <View style={{ flexDirection: 'row', gap: Spacing.md, flexWrap: 'wrap', marginTop: Spacing.xs }}>
                  <Text style={[s.batchStat, { color: BL.sage }]}>✅ {batch.imported_count} importés</Text>
                  {batch.error_count > 0 && <Text style={[s.batchStat, { color: BL.berry }]}>❌ {batch.error_count} erreurs</Text>}
                  {batch.skipped_count > 0 && <Text style={[s.batchStat, { color: BL.gold }]}>⏭ {batch.skipped_count} doublons</Text>}
                </View>
              </View>
            ))}
            {concoursCsvStore.list.length > 0 && (
              <View style={[s.card, { backgroundColor: BL.accentSoft, alignItems: 'center' }]}><Text style={{ color: BL.accent, fontWeight: '700' }}>📊 Cache local : {concoursCsvStore.list.length} concours</Text></View>
            )}
            <TouchableOpacity style={s.clearCacheBtn} onPress={handleClearImportCache} activeOpacity={0.85}>
              <Text style={s.clearCacheTxt}>🧹 Vider le cache import concours</Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: BL.bg },
  header: { padding: Spacing.lg, backgroundColor: BL.card, borderBottomWidth: 1, borderBottomColor: BL.line, gap: Spacing.sm },
  h1: { fontFamily: FONT.head, fontSize: 22, fontWeight: '700', color: BL.ink },
  headerSub: { fontSize: FontSize.sm, color: BL.sub, marginTop: -4 },
  content: { padding: Spacing.lg, gap: Spacing.md },

  uploadZone: { backgroundColor: BL.card, borderRadius: 20, borderWidth: 2, borderColor: BL.accentLine, borderStyle: 'dashed', alignItems: 'center', padding: Spacing.xl, gap: Spacing.md } as any,
  uploadIcon: { fontSize: 48 },
  uploadTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: BL.ink },
  uploadHint: { fontSize: FontSize.sm, color: BL.sub, textAlign: 'center', lineHeight: 20 },
  uploadBtn: { backgroundColor: BL.accent, borderRadius: 999, paddingVertical: Spacing.md, paddingHorizontal: Spacing.xl },
  uploadBtnTxt: { color: '#fff', fontWeight: FontWeight.bold, fontSize: FontSize.base },
  mobileNote: { backgroundColor: BL.bg, borderRadius: 10, padding: Spacing.md },
  mobileNoteTxt: { fontSize: FontSize.sm, color: BL.sub, textAlign: 'center' },

  card: { backgroundColor: BL.card, borderRadius: 16, padding: Spacing.lg, borderWidth: 1, borderColor: BL.line, gap: 4 },
  cardTitle: { fontSize: FontSize.base, fontWeight: FontWeight.bold, color: BL.ink, marginBottom: Spacing.sm },
  colRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  colName: { fontSize: FontSize.xs, color: BL.ink, width: 160 },
  colField: { fontSize: FontSize.xs, color: BL.accent, flex: 1 },
  colNote: { fontSize: FontSize.xs, color: BL.faint },
  colNoteReq: { color: BL.sage, fontWeight: FontWeight.semibold },

  summaryRow: { flexDirection: 'row', gap: Spacing.md },
  summaryCard: { flex: 1, backgroundColor: BL.card, borderRadius: 16, borderWidth: 2, padding: Spacing.md, alignItems: 'center', gap: 4 },
  summaryNum: { fontSize: FontSize.xxl, fontWeight: FontWeight.extrabold },
  summaryLabel: { fontSize: FontSize.xs, color: BL.sub, fontWeight: FontWeight.semibold },

  fileTag: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, backgroundColor: BL.bg, borderRadius: 10, paddingVertical: Spacing.sm, paddingHorizontal: Spacing.md },
  fileTagName: { fontSize: FontSize.sm, color: BL.sub, flex: 1 },
  headersText: { fontSize: FontSize.xs, color: BL.sub, lineHeight: 18 },

  banner: { backgroundColor: '#EAF3EC', borderRadius: 16, padding: Spacing.md, borderWidth: 1, borderColor: BL.sage },
  bannerTxt: { fontSize: FontSize.base, fontWeight: FontWeight.semibold, color: BL.sage, textAlign: 'center' },

  sectionTitle: { fontSize: FontSize.base, fontWeight: FontWeight.bold, color: BL.ink },
  previewCard: { backgroundColor: BL.card, borderRadius: 16, padding: Spacing.md, borderWidth: 1, borderColor: BL.line, gap: 4 },
  previewNum: { fontSize: FontSize.xs, color: BL.faint, fontWeight: FontWeight.bold, width: 24 },
  previewName: { fontSize: FontSize.base, fontWeight: FontWeight.semibold, color: BL.ink, flex: 1 },
  previewMeta: { fontSize: FontSize.sm, color: BL.sub },
  previewEpreuves: { fontSize: FontSize.xs, color: BL.accent },
  moreHint: { fontSize: FontSize.sm, color: BL.faint, textAlign: 'center', fontStyle: 'italic' },

  errorCard: { backgroundColor: '#FCE9EC', borderRadius: 10, padding: Spacing.md, borderWidth: 1, borderColor: '#F3C7CE', gap: 2 },
  errorRow: { fontSize: FontSize.xs, fontWeight: FontWeight.bold, color: BL.berry },
  errorMsg: { fontSize: FontSize.sm, color: BL.berry },

  actionsRow: { flexDirection: 'row', gap: Spacing.md, marginTop: Spacing.sm },
  cancelBtn: { flex: 1, backgroundColor: BL.card, borderRadius: 999, paddingVertical: Spacing.md, alignItems: 'center', borderWidth: 1, borderColor: BL.line },
  cancelBtnTxt: { fontSize: FontSize.base, color: BL.sub, fontWeight: FontWeight.semibold },
  importBtn: { flex: 2, backgroundColor: BL.accent, borderRadius: 999, paddingVertical: Spacing.md, alignItems: 'center', justifyContent: 'center' },
  importBtnTxt: { fontSize: FontSize.base, color: '#fff', fontWeight: FontWeight.bold },

  batchFilename: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: BL.ink, flex: 1 },
  batchDate: { fontSize: FontSize.xs, color: BL.faint },
  batchStat: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold },

  clearCacheBtn: { marginTop: 16, alignSelf: 'center', backgroundColor: '#FCE9EC', borderWidth: 1, borderColor: '#F3C7CE', borderRadius: 999, paddingVertical: 10, paddingHorizontal: 16 },
  clearCacheTxt: { color: BL.berry, fontWeight: '700', fontSize: 13 },

  empty: { alignItems: 'center', paddingVertical: 60, gap: Spacing.md },
  emptyIcon: { fontSize: 48 },
  emptyTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: BL.ink },
  emptyText: { fontSize: FontSize.sm, color: BL.sub },
});
