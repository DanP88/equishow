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
import { useAuth } from './useAuth';
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
  type_concours: string | null; // discipline brute (souvent 'nan' à l'import FFE)
  cre: string | null;            // région (CRE) — sert au filtre découverte
  lien_ffe: string | null;
  etat: string | null;
  followers_count: number;       // LOT 2B — dénormalisé (075). 0 si colonne/table absente.
  liste_epreuves: string[];      // 074 — épreuves importées (CSV FFE). [] si absent.
}

export interface ConcoursCounts {
  box: number;
  transport: number;
  coach: number;
}

// Row brut de la table public.concours (post-074 ; followers_count post-075)
interface ConcoursRow {
  id: string;
  numero_ffe: string | null;
  nom: string;
  date_debut: string | null;
  date_fin: string | null;
  lieu: string | null;
  departement: string | null;
  type_concours: string | null;
  cre: string | null;
  lien_ffe: string | null;
  etat: string | null;
  followers_count?: number | null; // absent tant que 075 non appliquée
  liste_epreuves?: string[] | null; // 074 — text[] (vide si non importé)
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

// Lien FFE officiel. La colonne `lien_ffe` n'existe pas en base (seul `numero_ffe`
// est importé) → on dérive l'URL canonique FFE depuis le numéro. Sans ce calcul,
// le bouton FFE de la fiche ne s'affichait jamais → l'analytics `click_ffe`
// (déjà câblée) n'émettait jamais → KPI « Clics FFE » figé à 0.
function ffeUrl(numeroFfe: string | null | undefined): string | null {
  const n = numeroFfe?.trim();
  return n ? `https://ffecompet.ffe.com/concours/${n}` : null;
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
    cre: r.cre,
    lien_ffe: r.lien_ffe ?? ffeUrl(r.numero_ffe),
    etat: r.etat,
    followers_count: r.followers_count ?? 0, // absent (075 non appliquée) → 0
    liste_epreuves: r.liste_epreuves ?? [],
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
    cre: null,
    lien_ffe: p.lienFFE ?? ffeUrl(p.numeroFFE),
    etat: 'ouvert',
    followers_count: p.followers,
    liste_epreuves: p.epreuves ?? [],
  };
}

// Détecte "table OU colonne absente" (074/075 non appliquées) → fallback mock.
// PostgREST ne renvoie pas le code Postgres brut :
//   - table absente   → code PGRST205, msg "Could not find the table ... in the schema cache"
//   - colonne absente → code 42703,    msg "column ... does not exist"
//   - (Postgres direct → 42P01 "relation ... does not exist")
function isMissingTable(error: any): boolean {
  if (!error) return false;
  const code = error.code ?? '';
  const msg = error.message ?? '';
  return (
    code === 'PGRST205' || code === '42P01' || code === '42703' ||
    /does not exist|could not find the table|schema cache/i.test(msg)
  );
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
    // select('*') : ramène followers_count si 075 appliquée, sinon colonne absente
    // → rowToHub applique `?? 0`. Évite l'erreur "column does not exist".
    const { data, error } = await supabase
      .from('concours')
      .select('*')
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
      .select('*')
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

    // COUNT read-only par concours_id (head:true => pas de payload, juste count).
    // LOT 2B : box/transport filtrés sur la dispo réelle ; coach = présence (statut
    // confirmé = LOT 3). Si concours_id absent (074 non appliquée), l'erreur
    // "column does not exist" déclenche le fallback mock plus bas.
    const [box, transport, coach] = await Promise.all([
      supabase.from('box_annonces').select('id', { count: 'exact', head: true })
        .eq('concours_id', id).gt('nb_boxes_disponibles', 0),
      supabase.from('transport_annonces').select('id', { count: 'exact', head: true })
        .eq('concours_id', id).gt('nb_places_disponibles', 0),
      supabase.from('coach_annonces').select('id', { count: 'exact', head: true })
        .eq('concours_id', id),
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

// ── useConcoursMyReservations — ce que LE cavalier a déjà réservé ici ──────────
// Sert au cross-sell « Mon déplacement » : après un paiement on revient sur la
// fiche pour montrer les modules réservés (✓) et pousser les manquants.
// Réservation → annonce → concours_id via embed PostgREST (FK existantes).
// Coach = course_demands OU stage_reservations. Exclut cancelled/rejected.
export interface ConcoursMyReservations { box: boolean; transport: boolean; coach: boolean }

export function useConcoursMyReservations(concoursId?: string) {
  const { profile } = useAuth();
  const userId = profile?.id;
  const [mine, setMine] = useState<ConcoursMyReservations>({ box: false, transport: false, coach: false });
  const [isLoading, setIsLoading] = useState(true);

  const load = useCallback(async () => {
    if (!concoursId || !userId) { setMine({ box: false, transport: false, coach: false }); setIsLoading(false); return; }
    setIsLoading(true);
    const exclude = '(cancelled,rejected)';
    const [box, transport, course, stage] = await Promise.all([
      supabase.from('box_reservations').select('id, box_annonces!inner(concours_id)', { count: 'exact', head: true })
        .eq('buyer_id', userId).eq('box_annonces.concours_id', concoursId).not('status', 'in', exclude),
      supabase.from('transport_reservations').select('id, transport_annonces!inner(concours_id)', { count: 'exact', head: true })
        .eq('buyer_id', userId).eq('transport_annonces.concours_id', concoursId).not('status', 'in', exclude),
      supabase.from('course_demands').select('id, coach_annonces!inner(concours_id)', { count: 'exact', head: true })
        .eq('cavalier_id', userId).eq('coach_annonces.concours_id', concoursId).not('status', 'in', exclude),
      supabase.from('stage_reservations').select('id, stages!inner(concours_id)', { count: 'exact', head: true })
        .eq('cavalier_id', userId).eq('stages.concours_id', concoursId).not('status', 'in', exclude),
    ]);
    // Si une colonne/table manque (074 non appliquée), on reste à false (pas de crash).
    setMine({
      box: (box.count ?? 0) > 0,
      transport: (transport.count ?? 0) > 0,
      coach: (course.count ?? 0) > 0 || (stage.count ?? 0) > 0,
    });
    setIsLoading(false);
  }, [concoursId, userId]);

  useEffect(() => { load(); }, [load]);
  return { mine, isLoading, reload: load };
}

// ── useConcoursFollow — Suivre / Désuivre (LOT 2A) ────────────────────────────
// Table public.concours_followers (075). Tolère son absence (075 non appliquée) :
// l'action est alors un no-op silencieux + warn dev, l'UI ne casse pas.
export function useConcoursFollow(concoursId?: string) {
  const { profile } = useAuth();
  const [isFollowing, setIsFollowing] = useState(false);
  const [isReady, setIsReady] = useState(false);  // false tant que l'état initial n'est pas lu
  const [available, setAvailable] = useState(true); // false si table 075 absente

  const userId = profile?.id;

  const load = useCallback(async () => {
    if (!concoursId || !userId) { setIsReady(true); return; }
    const { data, error } = await supabase
      .from('concours_followers')
      .select('user_id')
      .eq('concours_id', concoursId)
      .eq('user_id', userId)
      .maybeSingle();
    if (error) {
      if (isMissingTable(error)) setAvailable(false); // 075 non appliquée
      setIsFollowing(false);
    } else {
      setIsFollowing(!!data);
    }
    setIsReady(true);
  }, [concoursId, userId]);

  useEffect(() => { load(); }, [load]);

  const toggle = useCallback(async () => {
    if (!concoursId || !userId) return;
    const next = !isFollowing;
    setIsFollowing(next); // optimiste
    try {
      if (next) {
        const { error } = await supabase
          .from('concours_followers')
          .insert({ concours_id: concoursId, user_id: userId });
        if (error && !/duplicate key|already exists/i.test(error.message ?? '')) throw error;
      } else {
        const { error } = await supabase
          .from('concours_followers')
          .delete()
          .eq('concours_id', concoursId)
          .eq('user_id', userId);
        if (error) throw error;
      }
    } catch (e: any) {
      if (isMissingTable(e)) { setAvailable(false); if (__DEV__) console.warn('[follow] table 075 absente'); }
      else { setIsFollowing(!next); if (__DEV__) console.warn('[follow] échec:', e?.message ?? e); }
    }
  }, [concoursId, userId, isFollowing]);

  return { isFollowing, toggle, isReady, available, canFollow: !!userId };
}

// ── useConcoursCategories — catégories FFE d'un concours (084) ─────────────────
// Lecture read-only de public.concours_categories (select public). Tolère
// l'absence de la table (084 non appliquée) → liste vide, aucun crash.
export function useConcoursCategories(concoursId?: string) {
  const [categories, setCategories] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const load = useCallback(async () => {
    if (!concoursId) { setCategories([]); setIsLoading(false); return; }
    setIsLoading(true);
    const { data, error } = await supabase
      .from('concours_categories')
      .select('categorie')
      .eq('concours_id', concoursId)
      .order('categorie', { ascending: true });
    if (error || !data) {
      // Table 084 absente ou erreur → pas de catégories (section masquée).
      if (error && !isMissingTable(error) && __DEV__) {
        console.warn('[categories] lecture échouée:', error.message);
      }
      setCategories([]);
    } else {
      setCategories((data as { categorie: string }[]).map((r) => r.categorie));
    }
    setIsLoading(false);
  }, [concoursId]);

  useEffect(() => { load(); }, [load]);
  return { categories, isLoading, reload: load };
}
