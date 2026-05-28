import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export interface EscrowPayment {
  id: string;
  transferState: string;          // held | releasing | released | reversed | failed
  disputeStatus: string | null;   // open | resolved_* | null
  releaseBlockedReason: string | null; // dispute | chargeback | seller_not_onboarded | transfer_blocked
  releaseDueAt: string | null;
}

// Map réservation/demande → paiement séquestre. RLS limite aux lignes du user
// (buyer OU seller). On ignore le legacy (transfer_state='not_applicable') →
// l'UI escrow n'apparaît QUE pour les vrais paiements séquestre.
export function useMyEscrowPayments() {
  const [byReservation, setByReservation] = useState<Record<string, EscrowPayment>>({});

  const reload = useCallback(async () => {
    const { data, error } = await supabase
      .from('payments')
      .select(
        'id, transfer_state, dispute_status, release_blocked_reason, release_due_at, ' +
          'box_reservation_id, course_demand_id, stage_reservation_id, transport_reservation_id',
      )
      .neq('transfer_state', 'not_applicable');
    if (error || !data) return;
    const map: Record<string, EscrowPayment> = {};
    for (const r of data as any[]) {
      const ep: EscrowPayment = {
        id: r.id,
        transferState: r.transfer_state,
        disputeStatus: r.dispute_status,
        releaseBlockedReason: r.release_blocked_reason,
        releaseDueAt: r.release_due_at,
      };
      for (const key of [
        r.box_reservation_id,
        r.course_demand_id,
        r.stage_reservation_id,
        r.transport_reservation_id,
      ]) {
        if (key) map[key as string] = ep;
      }
    }
    setByReservation(map);
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  return { byReservation, reload };
}
