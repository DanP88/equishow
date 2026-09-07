// ─────────────────────────────────────────────────────────────────────────────
// ServiceV2 — shim de redirection Transport / Box / Coach.
//
// La structure générique F2 a été remplacée par les parcours dédiés :
//   F5 Transport → /(v2)/transport   ·   F6 Box → /(v2)/box   ·   F7 Coach → /(v2)/coach
// Cet écran ne fait plus que router `/(v2)/service/[kind]?…` vers le bon parcours
// en conservant le contexte (concours / face / cheval).
// ─────────────────────────────────────────────────────────────────────────────
import { useLocalSearchParams, Redirect } from 'expo-router';

type Kind = 'transport' | 'box' | 'coach';

const DEST: Record<Kind, string> = {
  transport: '/(v2)/transport',
  box: '/(v2)/box',
  coach: '/(v2)/coach',
};

export function ServiceV2() {
  const { kind, concoursId, face, chevalId } = useLocalSearchParams<{ kind: Kind; concoursId?: string; face?: string; chevalId?: string }>();
  const k: Kind = (kind === 'box' || kind === 'coach') ? kind : 'transport';

  const q = new URLSearchParams();
  if (concoursId) q.set('concoursId', concoursId);
  if (face) q.set('face', face);
  if (chevalId) q.set('chevalId', chevalId);

  return <Redirect href={`${DEST[k]}${q.toString() ? `?${q.toString()}` : ''}` as any} />;
}
