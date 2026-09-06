// v2/lib/dates — helpers de formatage (agenda / notifications V2).
const DAYS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
const MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

function cap(s: string) { return s.charAt(0).toUpperCase() + s.slice(1); }

/** "Samedi 12 septembre" */
export function dayLabel(d: Date): string {
  return `${cap(DAYS[d.getDay()])} ${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

/** clé de tri jour (YYYYMMDD) */
export function dayKey(d: Date): number {
  return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
}

/** "07:30" ou "journée" si minuit pile */
export function timeLabel(d: Date): string {
  if (d.getHours() === 0 && d.getMinutes() === 0) return 'journée';
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** "Aujourd'hui" / "Hier" / "12 sept." */
export function relativeDayLabel(d: Date): string {
  const now = new Date();
  const k = dayKey(d);
  const today = dayKey(now);
  const yest = dayKey(new Date(now.getTime() - 86400000));
  if (k === today) return "Aujourd'hui";
  if (k === yest) return 'Hier';
  return `${d.getDate()} ${MONTHS[d.getMonth()].slice(0, 4)}.`;
}
