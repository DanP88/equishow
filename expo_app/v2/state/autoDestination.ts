// ─────────────────────────────────────────────────────────────────────────────
// v2/state/autoDestination — hook « destination auto depuis le concours ».
//
// - concours lié      → pré-remplit + re-synchronise tant que l'utilisateur n'a
//                        pas édité ; recalcule si le concours change.
// - « Autre concours » / aucun concours → champ 100 % manuel (jamais forcé).
//
// FRONT-ONLY : lecture seule d'un complément de localisation (`adresse`, `infos`)
// non exposé par `ConcoursHub`. Aucune écriture, aucune migration, aucun Stripe.
// ─────────────────────────────────────────────────────────────────────────────
import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { buildDestination, ConcoursLoc, Destination } from '../lib/concoursDestination';

// ── Complément de localisation (lecture seule) ───────────────────────────────
// `ConcoursHub` (hook V1) n'expose que `lieu` + `departement`. On complète avec
// `adresse` + `infos.{ville,code_postal,region}` via une requête dédiée V2.
// Best-effort : toute erreur / table absente → `null` (on retombe sur le hub).

const _cache = new Map<string, ConcoursLoc | null>();

export function useConcoursLoc(concoursId?: string): { loc: ConcoursLoc | null; ready: boolean } {
  const [loc, setLoc] = useState<ConcoursLoc | null>(() => (concoursId ? _cache.get(concoursId) ?? null : null));
  const [ready, setReady] = useState(() => !concoursId || _cache.has(concoursId));

  useEffect(() => {
    let alive = true;
    if (!concoursId) { setLoc(null); setReady(true); return; }
    if (_cache.has(concoursId)) { setLoc(_cache.get(concoursId) ?? null); setReady(true); return; }
    setReady(false);
    (async () => {
      try {
        const { data, error } = await supabase
          .from('concours')
          .select('lieu,adresse,departement,infos')
          .eq('id', concoursId)
          .maybeSingle();
        if (!alive) return;
        if (error || !data) { _cache.set(concoursId, null); setLoc(null); setReady(true); return; }
        const infos = (data.infos ?? {}) as Record<string, any>;
        const next: ConcoursLoc = {
          lieu: data.lieu ?? null,
          adresse: data.adresse ?? null,
          departement: data.departement ?? null,
          ville: infos.ville ?? null,
          codePostal: infos.code_postal ?? null,
          region: infos.region ?? null,
        };
        _cache.set(concoursId, next);
        setLoc(next);
        setReady(true);
      } catch {
        if (!alive) return;
        _cache.set(concoursId, null);
        setLoc(null);
        setReady(true);
      }
    })();
    return () => { alive = false; };
  }, [concoursId]);

  return { loc, ready };
}

// ── Hook de champ « destination auto » ───────────────────────────────────────

export interface AutoDestination {
  value: string;
  onChange: (v: string) => void;
  /** Repose la valeur du concours (annule l'édition manuelle). */
  reset: () => void;
  /** true = la valeur affichée vient du concours (non éditée). */
  fromConcours: boolean;
  /** Destination calculée depuis le concours (indépendante de l'édition). */
  dest: Destination;
  ready: boolean;
  touched: boolean;
}

export function useAutoDestination(
  concoursId: string | undefined,
  hub?: { lieu?: string | null; departement?: string | null } | null,
): AutoDestination {
  const { loc, ready } = useConcoursLoc(concoursId);

  const merged: ConcoursLoc | null = concoursId
    ? {
        lieu: hub?.lieu ?? loc?.lieu ?? null,
        departement: hub?.departement ?? loc?.departement ?? null,
        adresse: loc?.adresse ?? null,
        ville: loc?.ville ?? null,
        codePostal: loc?.codePostal ?? null,
        region: loc?.region ?? null,
      }
    : null;
  const dest = buildDestination(merged);

  const [value, setValue] = useState('');
  const [touched, setTouched] = useState(false);
  const lastAuto = useRef('');

  // Changement de concours → on réarme le pré-remplissage.
  useEffect(() => {
    setTouched(false);
    lastAuto.current = '';
    setValue('');
  }, [concoursId]);

  // Pré-remplissage / re-synchro tant que non édité.
  useEffect(() => {
    if (!concoursId || touched) return;
    if (dest.text && dest.text !== lastAuto.current) {
      lastAuto.current = dest.text;
      setValue(dest.text);
    }
  }, [concoursId, dest.text, touched]);

  const onChange = useCallback((v: string) => {
    setTouched(true);
    setValue(v);
  }, []);

  const reset = useCallback(() => {
    setTouched(false);
    lastAuto.current = '';
    if (dest.text) setValue(dest.text);
  }, [dest.text]);

  return {
    value,
    onChange,
    reset,
    fromConcours: !!concoursId && !touched && !!dest.text && value === dest.text,
    dest,
    ready,
    touched,
  };
}
