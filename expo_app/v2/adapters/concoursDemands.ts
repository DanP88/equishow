// ─────────────────────────────────────────────────────────────────────────────
// v2/adapters/concoursDemands — « Demandes en cours » sur un concours.
//
// Réunit, pour un concours donné :
//   · les demandes d'EXEMPLE (v2/mocks/demands — simulation, Phase 2 = table
//     partagée `transport_demandes` / `box_demandes` + demandes de coaching) ;
//   · pour Box/Coach uniquement : les recherches que l'utilisateur a LUI-MÊME
//     publiées (state local `v2:box` / `v2:coach`, status 'open') → « own ».
//
// Transport n'a plus de bloc « own » local (audit de nettoyage 2026-09-18,
// Lot C) : depuis le Lot 1, les recherches Transport sont réelles
// (transport_recherches) et le local `v2:transport` searches n'était plus
// jamais alimenté — retiré ici sans impact (0 écriture depuis le Lot 1).
// Box/Coach non migrés, inchangés.
//
// LECTURE SEULE. Aucune écriture. Les exemples s'affichent pour tous (le but est
// de montrer « la demande des autres » avant que le backend existe).
// ─────────────────────────────────────────────────────────────────────────────
import { useMemo } from 'react';
import { useBoxLocal } from '../state/boxLocal';
import { useCoachLocal } from '../state/coachLocal';
import { demoDemandsFor } from '../mocks/demands';

export type DemandKind = 'transport' | 'box' | 'coach';

export interface ConcoursDemand {
  id: string;
  kind: DemandKind;
  nom: string;
  initiales: string;
  cheval?: string;
  detail: string;
  own: boolean;
}

function fmtDate(d?: string) {
  if (!d) return '';
  const dt = new Date(d.length >= 10 ? d : `${d}T00:00:00`);
  return isNaN(dt.getTime()) ? '' : dt.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
}

export function useConcoursDemands(concoursId?: string) {
  const bl = useBoxLocal(concoursId);
  const kl = useCoachLocal(concoursId);

  return useMemo(() => {
    const demo = demoDemandsFor(concoursId);
    const mk = (kind: DemandKind, own: boolean) => (d: any): ConcoursDemand => ({
      id: `${kind}-${own ? 'me' : d.id}`, kind, own,
      nom: own ? 'Toi' : d.nom,
      initiales: own ? 'TO' : d.initiales,
      cheval: d.cheval || undefined,
      detail: d.detail,
    });

    // ── recherches publiées par l'utilisateur, rattachées à ce concours (Box/Coach uniquement) ──
    const ownB = (bl.searches ?? [])
      .filter((s) => s.concoursId === concoursId && s.status === 'open')
      .map((s) => ({ id: s.id, nom: 'Toi', initiales: 'TO', cheval: undefined as string | undefined,
        detail: [`${s.nbBox || 1} box`, s.dateDebut ? `${fmtDate(s.dateDebut)} → ${fmtDate(s.dateFin)}` : null,
          s.litiereIncluse ? 'litière souhaitée' : null].filter(Boolean).join(' · ') }))
      .map(mk('box', true));
    const ownC = (kl.searches ?? [])
      .filter((s) => s.concoursId === concoursId && s.status === 'open')
      .map((s) => ({ id: s.id, nom: 'Toi', initiales: 'TO', cheval: undefined as string | undefined,
        detail: [s.discipline, s.niveau, `${s.nbSeances || 1} séance${(s.nbSeances || 1) > 1 ? 's' : ''}`].filter(Boolean).join(' · ') }))
      .map(mk('coach', true));

    const transport = demo.transport.map(mk('transport', false));
    const box = [...ownB, ...demo.box.map(mk('box', false))];
    const coach = [...ownC, ...demo.coach.map(mk('coach', false))];
    const all = [...transport, ...box, ...coach];

    return {
      transport, box, coach, all,
      total: all.length,
      byKind: (k: DemandKind) => (k === 'transport' ? transport : k === 'box' ? box : coach),
      /** true si l'utilisateur a lui-même une demande ouverte sur ce module. */
      hasOwn: (k: DemandKind) => all.some((d) => d.kind === k && d.own),
    };
  }, [concoursId, bl.searches, kl.searches]);
}
