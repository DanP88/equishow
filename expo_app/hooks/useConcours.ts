// ─────────────────────────────────────────────────────────────────────────────
// useConcours — LOT 1 (Concours hub). Lecture de la table public.concours
// (créée par la migration 074, NON encore appliquée en prod au moment du LOT 1).
//
// ⚠️ SHIM PRÉ-MIGRATION : tant que la table `concours` n'existe pas (074 non
// appliquée), les requêtes Supabase renvoient une erreur "relation does not
// exist". En __DEV__ on retombe alors sur les données mock (mockProto) pour que
// les écrans rendent localement. Dès que 074 est appliquée, les données réelles
// prennent le relais SANS changement de code.
//
// Hooks :
// - useConcoursList()    — liste des concours (découverte)
// - useConcours(id)      — un concours par id
// - useConcoursCounts(id)— compteurs box/transport/coach rattachés (concours_id)
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { PROTO_CONCOURS, ProtoConcours } from '../data/mockProto';

// Forme normalisée consommée par les écrans (indépendante du shim mock/DB).
export interface ConcoursHub {
  id: string;
  numero_ffe: string | null;
  nom: string;
  date_debut: string | null;
  date_fin: string | null;
  dateLabel: string;
  lieu: string | null;
  departement: string | null;
  type_concours: string | null; // discipline
  lien_ffe: string | null;
  etat: string | null;
}

export interface ConcoursCounts {
  box: number;
  transport: number;
  coach: number;
}

// Row brut de la table public.concours (post-074)
interface ConcoursRow {
  id: string;
  numero_ffe: string | null;
  nom: string;
  date_debut: string | null;
  date_fin: string | null;
  lieu: string | null;
  departement: string | null;
  type_concours: string | null;
  lien_ffe: string | null;
  etat: string | null;
}

// ── helpers ───────────────────────────────────────────────────────────────────

function fmtDateLabel(debut: string | null, fin: string | null): string {
  if (!debut) return '';
  const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long' };
  try {
    const d = new Date(debut).toLocaleDateString('fr-FR', opts);
    if (!fin || fin === debut) return d;
    const f = new Date(fin).toLocaleDateString('fr-FR', { ...opts, year: 'numeric' });
    return `${d} – ${f}`;
  } catch {
    return debut;
  }
}

function rowToHub(r: ConcoursRow): ConcoursHub {
  return {
    id: r.id,
    numero_ffe: r.numero_ffe,
    nom: r.nom,
    date_debut: r.date_debut,
    date_fin: r.date_fin,
    dateLabel: fmtDateLabel(r.date_debut, r.date_fin),
    lieu: r.lieu,
    departement: r.departement,
    type_concours: r.type_concours,
    lien_ffe: r.lien_ffe,
    etat: r.etat,
  };
}

// Fallback dev : mockProto → ConcoursHub
function protoToHub(p: ProtoConcours): ConcoursHub {
  return {
    id: p.id,
    numero_ffe: p.numeroFFE,
    nom: p.nom,
    date_debut: null,
    date_fin: null,
    dateLabel: p.dateLabel,
    lieu: p.lieu,
    departement: p.departement,
    type_concours: p.discipline,
    lien_ffe: p.lienFFE,
    etat: 'ouvert',
  };
}

// Détecte "table absente" (074 non appliquée) → autorise le fallback mock.
function isMissingTable(error: any): boolean {
  if (!error) return false;
  return error.code === '42P01' || /does not exist|relation .* does not exist/i.test(error.message ?? '');
}

const MOCK_HUBS = PROTO_CONCOURS.map(protoToHub);
const MOCK_COUNTS: Record<string, ConcoursCounts> = Object.fromEntries(
  PROTO_CONCOURS.map((p) => [p.id, { box: p.nbBoxes, transport: p.nbTransports, coach: p.nbCoachs }]),
);

// ── hooks ───────────────────────────────────────────────────────────────────

export function useConcoursList() {
  const [list, setList] = useState<ConcoursHub[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [usingMock, setUsingMock] = useState(false);

  const load = useCallback(async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from('concours')
      .select('id,numero_ffe,nom,date_debut,date_fin,lieu,departement,type_concours,lien_ffe,etat')
      .order('date_debut', { ascending: true });

    if (error) {
      if (__DEV__ && isMissingTable(error)) {
        // 074 non appliquée → shim mock pour visualisation locale.
        setList(MOCK_HUBS);
        setUsingMock(true);
      } else {
        setList([]);
      }
    } else {
      const rows = (data as ConcoursRow[]).map(rowToHub);
      // Table vide en dev → on montre quand même le mock pour démo.
      if (__DEV__ && rows.length === 0) {
        setList(MOCK_HUBS);
        setUsingMock(true);
      } else {
        setList(rows);
        setUsingMock(false);
      }
    }
    setIsLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);
  return { concours: list, isLoading, usingMock, reload: load };
}

export function useConcours(id?: string) {
  const [concours, setConcours] = useState<ConcoursHub | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const load = useCallback(async () => {
    if (!id) { setConcours(null); setIsLoading(false); return; }
    setIsLoading(true);
    const { data, error } = await supabase
      .from('concours')
      .select('id,numero_ffe,nom,date_debut,date_fin,lieu,departement,type_concours,lien_ffe,etat')
      .eq('id', id)
      .maybeSingle();

    if (error || !data) {
      if (__DEV__) setConcours(MOCK_HUBS.find((c) => c.id === id) ?? null);
      else setConcours(null);
    } else {
      setConcours(rowToHub(data as ConcoursRow));
    }
    setIsLoading(false);
  }, [id]);

  useEffect(() => { load(); }, [load]);
  return { concours, isLoading, reload: load };
}

export function useConcoursCounts(id?: string) {
  const [counts, setCounts] = useState<ConcoursCounts>({ box: 0, transport: 0, coach: 0 });
  const [isLoading, setIsLoading] = useState(true);

  const load = useCallback(async () => {
    if (!id) { setIsLoading(false); return; }
    setIsLoading(true);

    // 3 COUNT read-only sur concours_id (head:true => pas de payload, juste count).
    const q = (table: string) =>
      supabase.from(table).select('id', { count: 'exact', head: true }).eq('concours_id', id);

    const [box, transport, coach] = await Promise.all([
      q('box_annonces'), q('transport_annonces'), q('coach_annonces'),
    ]);

    if (isMissingTable(box.error) || isMissingTable(transport.error) || isMissingTable(coach.error)) {
      // colonne/table absente (074 non appliquée) → fallback mock en dev.
      if (__DEV__ && MOCK_COUNTS[id]) setCounts(MOCK_COUNTS[id]);
    } else {
      setCounts({
        box: box.count ?? 0,
        transport: transport.count ?? 0,
        coach: coach.count ?? 0,
      });
    }
    setIsLoading(false);
  }, [id]);

  useEffect(() => { load(); }, [load]);
  return { counts, isLoading, reload: load };
}
