// ─────────────────────────────────────────────────────────────────────────────
// ConcoursWeatherCard — V1. Affiche la météo de la fiche concours (1 ligne/jour).
// Isolé et réutilisable : prend l'objet concours, gère seul loading/erreur/fallback.
// Ne casse jamais la fiche : tout état non-'ok' rend un message discret.
// ─────────────────────────────────────────────────────────────────────────────

import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { Colors } from '../constants/colors';
import { Spacing, Radius, FontSize, FontWeight, Shadow } from '../constants/theme';
import { useConcoursWeather, WeatherDay } from '../hooks/useConcoursWeather';

interface Props {
  concours?: {
    lieu?: string | null;
    departement?: string | null;
    nom?: string | null;
    date_debut?: string | null;
    date_fin?: string | null;
  } | null;
}

// Code météo WMO → emoji + libellé court (Open-Meteo weather_code).
function wmo(code: number): { icon: string; label: string } {
  if (code === 0) return { icon: '☀️', label: 'Dégagé' };
  if (code <= 2) return { icon: '🌤️', label: 'Peu nuageux' };
  if (code === 3) return { icon: '☁️', label: 'Couvert' };
  if (code <= 48) return { icon: '🌫️', label: 'Brouillard' };
  if (code <= 57) return { icon: '🌦️', label: 'Bruine' };
  if (code <= 67) return { icon: '🌧️', label: 'Pluie' };
  if (code <= 77) return { icon: '🌨️', label: 'Neige' };
  if (code <= 82) return { icon: '🌧️', label: 'Averses' };
  if (code <= 86) return { icon: '🌨️', label: 'Averses de neige' };
  if (code <= 99) return { icon: '⛈️', label: 'Orage' };
  return { icon: '🌡️', label: '—' };
}

function dayLabel(iso: string): string {
  try {
    return new Date(`${iso}T00:00:00`).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
  } catch { return iso; }
}

const t = (v: number | null) => (v == null ? '—' : `${Math.round(v)}°`);

function Row({ d }: { d: WeatherDay }) {
  const w = wmo(d.code);
  return (
    <View style={s.row}>
      <Text style={s.rowDate}>{dayLabel(d.date)}</Text>
      <Text style={s.rowIcon}>{w.icon}</Text>
      <View style={s.rowTemps}>
        <Text style={s.rowMax}>{t(d.tMax)}</Text>
        <Text style={s.rowMin}>{t(d.tMin)}</Text>
      </View>
      <View style={s.rowExtra}>
        {d.precip != null && d.precip > 0 && <Text style={s.rowExtraTxt}>💧 {d.precip.toFixed(d.precip < 1 ? 1 : 0)} mm</Text>}
        {d.wind != null && <Text style={s.rowExtraTxt}>💨 {Math.round(d.wind)} km/h</Text>}
      </View>
    </View>
  );
}

export function ConcoursWeatherCard({ concours }: Props) {
  const { loading, reason, days, place } = useConcoursWeather(concours);

  // Fallbacks discrets — ne jamais bloquer la fiche.
  const fallback =
    reason === 'no_location' ? 'Météo indisponible (lieu non localisé).'
    : reason === 'past' ? 'Concours passé — météo non disponible.'
    : reason === 'too_far' ? "Prévisions disponibles à l'approche du concours (≈ 15 jours avant)."
    : reason === 'error' ? 'Météo indisponible pour le moment.'
    : null;

  return (
    <View style={s.card}>
      <View style={s.head}>
        <Text style={s.title}>🌦️ Météo du concours</Text>
        {!!place && !loading && reason === 'ok' && <Text style={s.place} numberOfLines={1}>{place}</Text>}
      </View>

      {loading ? (
        <View style={s.center}><ActivityIndicator color={Colors.primary} /></View>
      ) : reason === 'ok' && days.length > 0 ? (
        <View>
          {days.map((d) => <Row key={d.date} d={d} />)}
          <Text style={s.src}>Source : Open-Meteo</Text>
        </View>
      ) : (
        <Text style={s.fallback}>{fallback ?? 'Météo indisponible.'}</Text>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  card: { backgroundColor: Colors.surface, borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.border, padding: Spacing.lg, marginTop: Spacing.md, ...Shadow.card },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.sm, gap: Spacing.sm },
  title: { fontSize: FontSize.base, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  place: { fontSize: FontSize.xs, color: Colors.textTertiary, flexShrink: 1, textAlign: 'right' },
  center: { paddingVertical: Spacing.lg, alignItems: 'center' },
  fallback: { fontSize: FontSize.sm, color: Colors.textTertiary, fontStyle: 'italic' },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.sm, borderTopWidth: 1, borderTopColor: Colors.border },
  rowDate: { fontSize: FontSize.sm, color: Colors.textPrimary, width: 96, textTransform: 'capitalize' },
  rowIcon: { fontSize: 20, width: 28, textAlign: 'center' },
  rowTemps: { flexDirection: 'row', alignItems: 'baseline', gap: 6, width: 76 },
  rowMax: { fontSize: FontSize.base, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  rowMin: { fontSize: FontSize.sm, color: Colors.textTertiary },
  rowExtra: { flex: 1, alignItems: 'flex-end', gap: 1 },
  rowExtraTxt: { fontSize: FontSize.xs, color: Colors.textSecondary },
  src: { fontSize: FontSize.xs, color: Colors.textTertiary, marginTop: Spacing.sm, textAlign: 'right' },
});
