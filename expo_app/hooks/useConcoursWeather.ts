// ─────────────────────────────────────────────────────────────────────────────
// useConcoursWeather — V1 météo de la fiche concours (Open-Meteo, sans clé/compte).
// 100 % front : aucune écriture DB, aucune persistance. Géocode le lieu du concours
// puis récupère les prévisions DAILY sur la fenêtre du concours, bornée à l'horizon
// de prévision (~15 j). Ne casse jamais la fiche : tout échec → reason + fallback.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useState } from 'react';

export interface WeatherDay {
  date: string;            // YYYY-MM-DD
  code: number;            // code météo WMO
  tMin: number | null;     // °C
  tMax: number | null;     // °C
  precip: number | null;   // mm
  wind: number | null;     // km/h (rafales max)
}

// 'ok' = données ; sinon raison du fallback (affichage discret côté composant).
export type WeatherReason = 'ok' | 'no_location' | 'past' | 'too_far' | 'error';

// Open-Meteo expose ~16 jours de prévision. Au-delà → pas de données fiables.
const FORECAST_HORIZON_DAYS = 15;

interface WeatherInput {
  lieu?: string | null;
  departement?: string | null;
  nom?: string | null;
  date_debut?: string | null;
  date_fin?: string | null;
}

const ymd = (d: Date) => {
  const m = `${d.getMonth() + 1}`.padStart(2, '0');
  const day = `${d.getDate()}`.padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
};

export function useConcoursWeather(concours?: WeatherInput | null) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reason, setReason] = useState<WeatherReason>('ok');
  const [days, setDays] = useState<WeatherDay[]>([]);
  const [place, setPlace] = useState<string | null>(null);

  const locQuery = (concours?.lieu || concours?.departement || '').trim();
  const start = concours?.date_debut ?? null;
  const end = concours?.date_fin ?? concours?.date_debut ?? null;

  useEffect(() => {
    let cancelled = false;
    const done = (r: WeatherReason, err: string | null = null) => {
      if (cancelled) return;
      setReason(r); setError(err); setLoading(false);
    };

    async function run() {
      setLoading(true); setError(null); setReason('ok'); setDays([]); setPlace(null);

      if (!locQuery) return done('no_location');
      if (!start) return done('error', 'Dates du concours manquantes');

      // Fenêtre exploitable : [aujourd'hui, aujourd'hui + horizon].
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const horizon = new Date(today); horizon.setDate(horizon.getDate() + FORECAST_HORIZON_DAYS);
      const cStart = new Date(`${start}T00:00:00`);
      const cEnd = new Date(`${end ?? start}T00:00:00`);
      if (isNaN(cStart.getTime())) return done('error', 'Date invalide');
      if (cEnd < today) return done('past');
      if (cStart > horizon) return done('too_far');

      try {
        // 1) Géocodage (lieu → lat/lon), priorité France.
        const gUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(locQuery)}&count=1&language=fr&format=json&countryCode=FR`;
        const gRes = await fetch(gUrl);
        if (!gRes.ok) throw new Error(`geocoding ${gRes.status}`);
        const gJson = await gRes.json();
        const hit = gJson?.results?.[0];
        if (!hit) return done('no_location');
        if (!cancelled) setPlace([hit.name, hit.admin1].filter(Boolean).join(', '));

        // 2) Prévisions daily, bornées à la fenêtre de prévision.
        const fStart = cStart < today ? today : cStart;
        const fEnd = cEnd > horizon ? horizon : cEnd;
        const fUrl = `https://api.open-meteo.com/v1/forecast?latitude=${hit.latitude}&longitude=${hit.longitude}`
          + `&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,wind_speed_10m_max`
          + `&timezone=Europe%2FParis&start_date=${ymd(fStart)}&end_date=${ymd(fEnd)}`;
        const fRes = await fetch(fUrl);
        if (!fRes.ok) throw new Error(`forecast ${fRes.status}`);
        const d = (await fRes.json())?.daily;
        if (!d?.time?.length) return done('too_far');

        const out: WeatherDay[] = d.time.map((t: string, i: number) => ({
          date: t,
          code: d.weather_code?.[i] ?? 0,
          tMax: d.temperature_2m_max?.[i] ?? null,
          tMin: d.temperature_2m_min?.[i] ?? null,
          precip: d.precipitation_sum?.[i] ?? null,
          wind: d.wind_speed_10m_max?.[i] ?? null,
        }));
        if (cancelled) return;
        setDays(out); setReason('ok'); setLoading(false);
      } catch (e: any) {
        done('error', e?.message ?? 'Erreur météo');
      }
    }

    run();
    return () => { cancelled = true; };
  }, [locQuery, start, end]);

  return { loading, error, reason, days, place };
}
