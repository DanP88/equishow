// ─────────────────────────────────────────────────────────────────────────────
// Mentions de concours — format de jeton PARTAGÉ (discussions concours + futur
// réemploi communauté générale). Fonctions pures, sans dépendance RN/Supabase.
//
// Jeton persistant dans le texte du message :  @[Nom du concours](concours:UUID)
//   - le Nom est le libellé affiché (cliquable) ;
//   - l'UUID est la cible → fiche /concours/[id] (robuste au renommage du concours).
//
// Côté composer, l'utilisateur saisit « @Nom » en clair (lisible) ; à l'envoi,
// serializeConcoursMentions() convertit ces « @Nom » en jetons. Au rendu,
// parseConcoursMentions() reconstruit les segments texte / mention.
//
// ARCHITECTURE NOTIFICATIONS (préparée, NON implémentée ici) : le concours_id
// étant capturé dès la saisie et persité dans le texte, un futur lot pourra soit
// parser les jetons (extractConcoursMentionIds) dans un trigger, soit alimenter
// une table de liaison concours_message_mentions(message_id, concours_id).
// ─────────────────────────────────────────────────────────────────────────────

const UUID = '[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}';
// Source réutilisable (on recrée un RegExp à chaque usage pour éviter le piège
// d'état partagé de lastIndex sur un littéral global).
const MENTION_SRC = `@\\[([^\\]]+)\\]\\(concours:(${UUID})\\)`;

export interface ConcoursMentionRef {
  label: string;
  concoursId: string;
}

export type MentionSegment =
  | { type: 'text'; value: string }
  | { type: 'mention'; label: string; concoursId: string };

// Construit un jeton. Le libellé est nettoyé des crochets pour ne pas casser le
// format (les ] fermeraient prématurément le groupe).
export function buildConcoursMention(label: string, concoursId: string): string {
  const safe = label.replace(/[[\]]/g, '').trim();
  return `@[${safe}](concours:${concoursId})`;
}

// Découpe le texte en segments (texte brut / mention) pour le rendu.
export function parseConcoursMentions(text: string): MentionSegment[] {
  const out: MentionSegment[] = [];
  const re = new RegExp(MENTION_SRC, 'g');
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) out.push({ type: 'text', value: text.slice(last, m.index) });
    out.push({ type: 'mention', label: m[1], concoursId: m[2] });
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push({ type: 'text', value: text.slice(last) });
  return out;
}

// Échappe les métacaractères regex d'un libellé.
function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Convertit les « @Nom » saisis en clair en jetons, à l'envoi. Les libellés les
// plus longs d'abord pour éviter les substitutions partielles ; comme un jeton
// commence par « @[ », un « @Nom » (Nom ne commençant pas par « [ ») ne peut pas
// matcher à l'intérieur d'un jeton déjà construit → pas de double-encodage.
export function serializeConcoursMentions(text: string, mentions: ConcoursMentionRef[]): string {
  let out = text;
  const sorted = [...mentions].sort((a, b) => b.label.length - a.label.length);
  for (const men of sorted) {
    if (!men.label) continue;
    const token = buildConcoursMention(men.label, men.concoursId);
    out = out.replace(new RegExp(`@${escapeRe(men.label)}`, 'g'), token);
  }
  return out;
}

// Liste des concours_id mentionnés dans un texte (utile au futur lot notifications).
export function extractConcoursMentionIds(text: string): string[] {
  const re = new RegExp(MENTION_SRC, 'g');
  const ids: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (!ids.includes(m[2])) ids.push(m[2]);
  }
  return ids;
}

// Détecte une mention « @requête » active en fin de saisie (pas d'espace après
// le @, donc une seule "parole" en cours). Renvoie la requête (éventuellement
// vide juste après « @ ») ou null. Insensible à la position du curseur (MVP :
// on suppose la saisie en fin de champ, cas dominant).
export function activeMentionQuery(text: string): string | null {
  const m = /(^|\s)@([^\s@]*)$/.exec(text);
  return m ? m[2] : null;
}

// Remplace la « @requête » active de fin par « @Libellé » en clair (+ espace),
// en préservant l'éventuel séparateur de tête.
export function replaceActiveMention(text: string, label: string): string {
  return text.replace(/(^|\s)@([^\s@]*)$/, (_full, lead) => `${lead}@${label} `);
}
