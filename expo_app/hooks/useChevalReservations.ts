// ─────────────────────────────────────────────────────────────────────────────
// useChevalConcours — vue « Réservations & concours » de la fiche cheval (078).
// Regroupe PAR CONCOURS les réservations rattachées à un cheval (cheval_id) :
//   - ce qui est réservé (module + statut),
//   - les autres services DISPONIBLES sur ce concours (cross-sell, bulles vertes).
// Lecture seule, défensif. Tri : à venir d'abord (plus proche en tête), puis
// passés (le plus récent passé en tête).
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export type CModuleKey = 'box' | 'transport' | 'coach' | 'stage';

export interface ReservedItem {
  module: CModuleKey;
  label: string;        // ex. « Box », « Transport · trajet »
  icon: string;
  status: string | null;
}

export interface ChevalConcours {
  key: string;                 // concoursId ou id de résa si pas de concours
  concoursId: string | null;
  concoursNom: string | null;
  dateFin: string | null;
  past: boolean;
  reserved: ReservedItem[];
  available: Record<CModuleKey, number>; // offres dispo par module sur le concours
  // P6 hero : lieu du concours + prix mini réel par module (preuve sociale).
  // Optionnels (back-compat / mocks dev). Renseignés par le hook depuis la DB.
  lieu?: string | null;
  departement?: string | null;
  availableFrom?: Record<CModuleKey, number | null>;
}

// Colonne de prix réelle par module (lecture seule, aucune logique métier).
const PRICE_COL: Record<CModuleKey, { table: string; col: string }> = {
  box: { table: 'box_annonces', col: 'prix_nuit_ht' },
  transport: { table: 'transport_annonces', col: 'prix_ht' },
  coach: { table: 'coach_annonces', col: 'prix_heure_ttc' },
  stage: { table: 'stages', col: 'prix_jour' },
};

const today = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };

const MODULE_META: Record<CModuleKey, { icon: string; label: string }> = {
  box: { icon: '📦', label: 'Box' },
  transport: { icon: '🚐', label: 'Transport' },
  coach: { icon: '🎓', label: 'Coach' },
  stage: { icon: '🏕️', label: 'Stage' },
};

const firstConcours = (annonce: any): { id: string | null; nom: string | null; dateFin: string | null; lieu: string | null; departement: string | null } => {
  const a = Array.isArray(annonce) ? annonce[0] : annonce;
  const c = a?.concours;
  const cc = Array.isArray(c) ? c[0] : c;
  return {
    id: cc?.id ?? null, nom: cc?.nom ?? null, dateFin: cc?.date_fin ?? cc?.date_debut ?? null,
    lieu: cc?.lieu ?? null, departement: cc?.departement ?? null,
  };
};

// Accepte un cheval (fiche cheval) OU plusieurs (accueil « Tous » = récap de
// l'ensemble des chevaux). On agrège alors les réservations de tous les chevaux,
// regroupées par concours.
export function useChevalConcours(chevalId?: string | string[]) {
  const [items, setItems] = useState<ChevalConcours[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  // Clé effectivement chargée : permet de savoir SYNCHRONEMENT (sans attendre
  // l'effet async) qu'un rechargement est dû quand la liste de chevaux change
  // (évite le flash « état vide » pendant que les chevaux arrivent).
  const [loadedKey, setLoadedKey] = useState<string | null>(null);

  // Clé stable pour les deps (un tableau change d'identité à chaque rendu).
  const idsKey = (Array.isArray(chevalId) ? chevalId : chevalId ? [chevalId] : []).join(',');

  const load = useCallback(async () => {
    const chevalIds = idsKey ? idsKey.split(',') : [];
    if (chevalIds.length === 0) { setItems([]); setIsLoading(false); setLoadedKey(idsKey); return; }
    setIsLoading(true);

    type Raw = { resaKey: string; concoursId: string | null; concoursNom: string | null; dateFin: string | null; lieu: string | null; departement: string | null; reserved: ReservedItem };
    const raws: Raw[] = [];
    const safe = async (fn: () => Promise<void>) => { try { await fn(); } catch { /* défensif */ } };

    await Promise.all([
      safe(async () => {
        const { data } = await supabase.from('box_reservations')
          .select('id, status, box_annonces(concours(id, nom, date_fin, lieu, departement))').in('cheval_id', chevalIds);
        (data ?? []).forEach((r: any) => { const c = firstConcours(r.box_annonces); raws.push({
          resaKey: `box-${r.id}`, concoursId: c.id, concoursNom: c.nom, dateFin: c.dateFin, lieu: c.lieu, departement: c.departement,
          reserved: { module: 'box', label: MODULE_META.box.label, icon: MODULE_META.box.icon, status: r.status ?? null },
        }); });
      }),
      safe(async () => {
        const { data } = await supabase.from('transport_reservations')
          .select('id, statut, transport_annonces(type_transport, concours(id, nom, date_fin, lieu, departement))').in('cheval_id', chevalIds);
        (data ?? []).forEach((r: any) => {
          const a = Array.isArray(r.transport_annonces) ? r.transport_annonces[0] : r.transport_annonces;
          const label = a?.type_transport === 'trajet' ? 'Transport · trajet' : 'Transport · van seul';
          const c = firstConcours(r.transport_annonces);
          raws.push({ resaKey: `transport-${r.id}`, concoursId: c.id, concoursNom: c.nom, dateFin: c.dateFin, lieu: c.lieu, departement: c.departement,
            reserved: { module: 'transport', label, icon: MODULE_META.transport.icon, status: r.statut ?? null } });
        });
      }),
      safe(async () => {
        const { data } = await supabase.from('course_demands')
          .select('id, status, coach_annonces(concours(id, nom, date_fin, lieu, departement))').in('cheval_id', chevalIds);
        (data ?? []).forEach((r: any) => { const c = firstConcours(r.coach_annonces); raws.push({
          resaKey: `coach-${r.id}`, concoursId: c.id, concoursNom: c.nom, dateFin: c.dateFin, lieu: c.lieu, departement: c.departement,
          reserved: { module: 'coach', label: MODULE_META.coach.label, icon: MODULE_META.coach.icon, status: r.status ?? null },
        }); });
      }),
      safe(async () => {
        const { data } = await supabase.from('stage_reservations')
          .select('id, status, stages(concours(id, nom, date_fin, lieu, departement))').in('cheval_id', chevalIds);
        (data ?? []).forEach((r: any) => { const c = firstConcours(r.stages); raws.push({
          resaKey: `stage-${r.id}`, concoursId: c.id, concoursNom: c.nom, dateFin: c.dateFin, lieu: c.lieu, departement: c.departement,
          reserved: { module: 'stage', label: MODULE_META.stage.label, icon: MODULE_META.stage.icon, status: r.status ?? null },
        }); });
      }),
    ]);

    // Regroupement par concours (ou par résa si aucun concours lié).
    const groups = new Map<string, ChevalConcours>();
    for (const r of raws) {
      const key = r.concoursId ?? r.resaKey;
      let g = groups.get(key);
      if (!g) {
        g = {
          key, concoursId: r.concoursId, concoursNom: r.concoursNom, dateFin: r.dateFin,
          lieu: r.lieu, departement: r.departement,
          past: r.dateFin ? new Date(`${r.dateFin}T00:00:00`) < today() : false,
          reserved: [], available: { box: 0, transport: 0, coach: 0, stage: 0 },
          availableFrom: { box: null, transport: null, coach: null, stage: null },
        };
        groups.set(key, g);
      }
      g.reserved.push(r.reserved);
    }

    // Offres disponibles par module pour chaque concours (cross-sell bulles vertes).
    await Promise.all(Array.from(groups.values())
      .filter((g) => g.concoursId)
      .map((g) => safe(async () => {
        const cid = g.concoursId!;
        const [box, transport, coach, stage] = await Promise.all([
          supabase.from('box_annonces').select('id', { count: 'exact', head: true }).eq('concours_id', cid),
          supabase.from('transport_annonces').select('id', { count: 'exact', head: true }).eq('concours_id', cid),
          supabase.from('coach_annonces').select('id', { count: 'exact', head: true }).eq('concours_id', cid),
          supabase.from('stages').select('id', { count: 'exact', head: true }).eq('concours_id', cid),
        ]);
        g.available = { box: box.count ?? 0, transport: transport.count ?? 0, coach: coach.count ?? 0, stage: stage.count ?? 0 };

        // Prix mini réel par module (preuve sociale « dès X € » du hero P6).
        // Lecture seule : on lit le prix le plus bas des annonces de CE concours.
        const minPrice = async (m: CModuleKey): Promise<number | null> => {
          const { table, col } = PRICE_COL[m];
          const { data } = await supabase.from(table).select(col)
            .eq('concours_id', cid).not(col, 'is', null)
            .order(col, { ascending: true }).limit(1);
          const v = (data?.[0] as any)?.[col];
          return typeof v === 'number' && v > 0 ? v : null;
        };
        const [bp, tp, cp] = await Promise.all([minPrice('box'), minPrice('transport'), minPrice('coach')]);
        g.availableFrom = { box: bp, transport: tp, coach: cp, stage: null };
      })));

    const out = Array.from(groups.values());
    // Tri : à venir d'abord (date la plus proche en premier = ASC), puis passés
    // (le plus récent passé en premier = DESC). Sans concours en fin.
    out.sort((a, b) => {
      if (!!a.concoursId !== !!b.concoursId) return a.concoursId ? -1 : 1;
      if (!a.concoursId) return 0;
      if (a.past !== b.past) return a.past ? 1 : -1;
      const ka = a.dateFin ?? ''; const kb = b.dateFin ?? '';
      return a.past ? kb.localeCompare(ka) : ka.localeCompare(kb);
    });

    setItems(out);
    setIsLoading(false);
    setLoadedKey(idsKey);
  }, [idsKey]);

  useEffect(() => { load(); }, [load]);
  // `isLoading` sans "trou" : vrai tant que la clé courante n'a pas été chargée.
  return { items, isLoading: isLoading || loadedKey !== idsKey, reload: load };
}
