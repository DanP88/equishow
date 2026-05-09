import { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, SafeAreaView, Platform,
  ActivityIndicator,
} from 'react-native';
import { Colors } from '../../constants/colors';
import { Spacing, Radius, FontSize, FontWeight, Shadow } from '../../constants/theme';
import { concoursCsvStore } from '../../data/store';
import { ConcoursCSV, ImportBatch, ImportError } from '../../types/concours';

// ── CSV Parser ──────────────────────────────────────────────────────────────

function parseCSVText(text: string): { headers: string[]; rows: Record<string, string>[] } {
  // Normalize line endings
  const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  // Split into raw lines, handling quoted newlines
  const rawLines: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < normalized.length; i++) {
    const ch = normalized[i];
    if (ch === '"') {
      if (inQuotes && normalized[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === '\n' && !inQuotes) {
      rawLines.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  if (current.trim()) rawLines.push(current);

  // Parse each line into fields
  function parseLine(line: string): string[] {
    const fields: string[] = [];
    let field = '';
    let inQ = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQ && line[i + 1] === '"') { field += '"'; i++; }
        else inQ = !inQ;
      } else if (ch === ',' && !inQ) {
        fields.push(field.trim());
        field = '';
      } else {
        field += ch;
      }
    }
    fields.push(field.trim());
    return fields;
  }

  const nonEmpty = rawLines.filter(l => l.trim() !== '');
  if (nonEmpty.length === 0) return { headers: [], rows: [] };

  const headers = parseLine(nonEmpty[0]).map(h => h.trim());
  const rows: Record<string, string>[] = [];

  for (let i = 1; i < nonEmpty.length; i++) {
    const fields = parseLine(nonEmpty[i]);
    if (fields.every(f => f === '')) continue;
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => {
      row[h] = (fields[idx] ?? '').trim();
    });
    rows.push(row);
  }

  return { headers, rows };
}

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
  'Département': 'departement',
  'departement': 'departement',
  'CRE': 'cre',
  'cre': 'cre',
  'Numéro de concours': 'numero_concours',
  'numero_concours': 'numero_concours',
  'Etat': 'etat',
  'etat': 'etat',
  'Épreuve': 'epreuves_raw',
  'Epreuve': 'epreuves_raw',
  'epreuves': 'epreuves_raw',
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
  nom_concours_direct?: string;
  adresse?: string;
}

function mapRow(raw: Record<string, string>): ConcoursCSVRaw {
  const mapped: ConcoursCSVRaw = {};
  for (const [key, value] of Object.entries(raw)) {
    const field = HEADER_MAP[key];
    if (field) (mapped as any)[field] = value || undefined;
  }
  return mapped;
}

function parseEpreuves(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(/[;\n]/)
    .map(e => e.trim())
    .filter(Boolean);
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
  existingNumeros: Set<string>
): ParseResult {
  const result: ParseResult = { valid: [], errors: [], skipped: 0 };
  const seenInBatch = new Set<string>();

  rows.forEach((raw, idx) => {
    const rowNum = idx + 2; // +1 for header, +1 for 1-based
    const mapped = mapRow(raw);

    // Validation
    if (!mapped.date_debut) {
      result.errors.push({ row: rowNum, data: JSON.stringify(raw), message: 'date_debut manquante' });
      return;
    }
    if (!mapped.date_fin) {
      result.errors.push({ row: rowNum, data: JSON.stringify(raw), message: 'date_fin manquante' });
      return;
    }
    if (!mapped.lieu && !mapped.nom_concours_direct) {
      result.errors.push({ row: rowNum, data: JSON.stringify(raw), message: 'lieu manquant' });
      return;
    }
    if (!isValidDate(mapped.date_debut)) {
      result.errors.push({ row: rowNum, data: JSON.stringify(raw), message: `date_debut invalide: "${mapped.date_debut}"` });
      return;
    }
    if (!isValidDate(mapped.date_fin)) {
      result.errors.push({ row: rowNum, data: JSON.stringify(raw), message: `date_fin invalide: "${mapped.date_fin}"` });
      return;
    }
    if (new Date(mapped.date_debut!) > new Date(mapped.date_fin!)) {
      result.errors.push({ row: rowNum, data: JSON.stringify(raw), message: 'date_debut > date_fin' });
      return;
    }

    const numero = mapped.numero_concours || buildNomConcours(mapped);

    // Duplicate check
    if (existingNumeros.has(numero) || seenInBatch.has(numero)) {
      result.skipped++;
      return;
    }

    seenInBatch.add(numero);

    result.valid.push({
      id: `csv_${Date.now()}_${rowNum}`,
      nom_concours: buildNomConcours(mapped),
      date_debut: mapped.date_debut || null,
      date_fin: mapped.date_fin || null,
      date_cloture: mapped.date_cloture || null,
      organisateur_terrain: mapped.organisateur_terrain || null,
      organisateur_financier: mapped.organisateur_financier || null,
      lieu: mapped.lieu || null,
      type_concours: mapped.type_concours || null,
      departement: mapped.departement || null,
      cre: mapped.cre || null,
      numero_concours: mapped.numero_concours || null,
      etat: mapped.etat || null,
      liste_epreuves: parseEpreuves(mapped.epreuves_raw),
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
        const text = e.target?.result as string;
        const { headers: hdrs, rows } = parseCSVText(text);
        setHeaders(hdrs);

        const batchId = `batch_${Date.now()}`;
        const existingNumeros = new Set(
          concoursCsvStore.list.map(c => c.numero_concours || c.nom_concours)
        );

        const result = processCSVRows(rows, batchId, existingNumeros);
        setParseResult(result);
        setLoading(false);
        setViewMode('preview');
      };

      reader.onerror = () => {
        setLoading(false);
        alert('Erreur lors de la lecture du fichier.');
      };

      reader.readAsText(file, 'UTF-8');
    };

    input.click();
  }

  function handleImport() {
    if (!parseResult || parseResult.valid.length === 0) return;
    setLoading(true);

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

    setTimeout(() => {
      setLoading(false);
      setImported(true);
      refresh();
    }, 400);
  }

  function handleReset() {
    setViewMode('upload');
    setFilename('');
    setHeaders([]);
    setParseResult(null);
    setImported(false);
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
                Formats supportés : FFE standard, CSV générique{'\n'}
                Séparateur : virgule · Encodage : UTF-8
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

            {/* Import success banner */}
            {imported && (
              <View style={s.successBanner}>
                <Text style={s.successText}>
                  ✅ {parseResult.valid.length} concours importés avec succès !
                </Text>
              </View>
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

            {/* Total imported */}
            {concoursCsvStore.list.length > 0 && (
              <View style={s.totalCard}>
                <Text style={s.totalText}>
                  📊 Total : {concoursCsvStore.list.length} concours en base
                </Text>
              </View>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Styles ──────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },

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
