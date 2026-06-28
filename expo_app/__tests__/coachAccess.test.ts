/**
 * Test Suite — essai gratuit Coach « 3 premières séances payées » (lib/coachAccess).
 * Couvre : comptage payments-authoritative (held/refund/cancel/litige/stage exclus),
 * logique d'accès (0→2 gratuit, 3 sans abo = bloqué, 3 + abo = ok), détection Pro.
 */
import {
  FREE_TRIAL_SESSIONS,
  PaymentRowForTrial,
  countPaidCoachSessions,
  coachHasPro,
  computeCoachAccess,
} from '../lib/coachAccess';

const row = (over: Partial<PaymentRowForTrial>): PaymentRowForTrial => ({
  type: 'course',
  transfer_state: 'released',
  payment_status: 'succeeded',
  refunded_at: null,
  dispute_status: null,
  ...over,
});
const paid = (n: number) => Array.from({ length: n }, () => row({}));

describe('countPaidCoachSessions', () => {
  test('séance terminée + fonds libérés → compte', () => {
    expect(countPaidCoachSessions(paid(2))).toBe(2);
  });
  test('paiement held (en attente) → ne compte pas', () => {
    expect(countPaidCoachSessions([row({ transfer_state: 'held' })])).toBe(0);
  });
  test('remboursée (refunded_at) → ne compte pas', () => {
    expect(countPaidCoachSessions([row({ refunded_at: '2026-01-01' })])).toBe(0);
  });
  test('payment_status refunded/cancelled → ne compte pas', () => {
    expect(countPaidCoachSessions([row({ payment_status: 'refunded' }), row({ payment_status: 'cancelled' })])).toBe(0);
  });
  test('litige ouvert / resolved_refund → ne compte pas', () => {
    expect(countPaidCoachSessions([row({ dispute_status: 'open' }), row({ dispute_status: 'resolved_refund' })])).toBe(0);
  });
  test('dispute resolved_release (fonds gardés) → compte', () => {
    expect(countPaidCoachSessions([row({ dispute_status: 'resolved_release' })])).toBe(1);
  });
  test('type stage → ne compte pas (coaching uniquement)', () => {
    expect(countPaidCoachSessions([row({ type: 'stage' })])).toBe(0);
  });
});

describe('computeCoachAccess', () => {
  test('0 séance → essai actif, accès Pro gratuit', () => {
    const a = computeCoachAccess({ paidSessions: 0, hasPro: false });
    expect(a.canAcceptNew).toBe(true);
    expect(a.trialActive).toBe(true);
    expect(a.remaining).toBe(FREE_TRIAL_SESSIONS);
  });
  test.each([
    [1, 2],
    [2, 1],
  ])('%i séance(s) payée(s) → gratuit, %i restante(s)', (n, remaining) => {
    const a = computeCoachAccess({ paidSessions: n, hasPro: false });
    expect(a.canAcceptNew).toBe(true);
    expect(a.remaining).toBe(remaining);
  });
  test('3 séances sans abo → blocage doux', () => {
    const a = computeCoachAccess({ paidSessions: 3, hasPro: false });
    expect(a.canAcceptNew).toBe(false);
    expect(a.trialActive).toBe(false);
  });
  test('3 séances + abo Pro → accès complet', () => {
    expect(computeCoachAccess({ paidSessions: 3, hasPro: true }).canAcceptNew).toBe(true);
  });
});

describe('coachHasPro', () => {
  test('plans coach payants → Pro', () => {
    expect(coachHasPro('coach-mensuel', null)).toBe(true);
    expect(coachHasPro('coach-annuel', null)).toBe(true);
  });
  test('gratuit / null → pas Pro', () => {
    expect(coachHasPro('gratuit', 'Gratuit')).toBe(false);
    expect(coachHasPro(null, null)).toBe(false);
    expect(coachHasPro(null, 'Gratuit')).toBe(false);
  });
});
