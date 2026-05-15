// ─────────────────────────────────────────────────────────────────────────────
// Analytics maison — events fire-and-forget vers Supabase `user_events`.
//
// Design :
// - `session_id` persisté en localStorage (web) ou en mémoire (natif). Permet
//   le chaînage des events d'une session unique.
// - Insert non bloquant (`void`) : un échec analytics ne casse jamais l'UX.
// - `metadata` libre (jsonb côté DB) pour extensibilité sans migration.
// - userId caché en mémoire et mis à jour via onAuthStateChange — AUCUN appel
//   `supabase.auth.getSession()` dans trackEvent (sinon lock contention avec
//   les opérations auth concurrentes type signInWithPassword).
// ─────────────────────────────────────────────────────────────────────────────

import { supabase } from './supabase';

let _cachedUserId: string | null = null;

// Sync userId via onAuthStateChange (1 seul subscriber pour tout le module).
// Lazy : ne s'enregistre qu'au premier trackEvent pour éviter d'init Supabase
// trop tôt.
let _authSubscribed = false;
function ensureAuthSubscribed() {
  if (_authSubscribed) return;
  _authSubscribed = true;
  // Pas d'await — on récupère la session courante en parallèle.
  supabase.auth.getSession().then(({ data }) => {
    _cachedUserId = data.session?.user?.id ?? null;
  }).catch(() => { /* silent */ });
  supabase.auth.onAuthStateChange((_event, session) => {
    _cachedUserId = session?.user?.id ?? null;
  });
}

type EventType = 'page_view' | 'page_leave' | 'cta_click' | 'funnel_step' | 'error' | 'custom';

interface TrackParams {
  event_type: EventType;
  screen?: string;
  action?: string;
  duration_ms?: number;
  metadata?: Record<string, unknown>;
}

let _sessionId: string | null = null;
const SESSION_KEY = 'eq_session_id';
const SESSION_TS_KEY = 'eq_session_ts';
const SESSION_MAX_MS = 30 * 60 * 1000; // 30 min inactivité → nouvelle session

function uuid(): string {
  // crypto.randomUUID disponible sur web modernes + Hermes récents.
  // Fallback simple si absent.
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

function isLocalStorageAvailable(): boolean {
  try {
    return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
  } catch {
    return false;
  }
}

function getSessionId(): string {
  // Rotation session si inactivité > 30 min (web seulement, on a le timestamp)
  if (isLocalStorageAvailable()) {
    const stored = window.localStorage.getItem(SESSION_KEY);
    const tsStr = window.localStorage.getItem(SESSION_TS_KEY);
    const ts = tsStr ? parseInt(tsStr, 10) : 0;
    const now = Date.now();
    if (stored && now - ts < SESSION_MAX_MS) {
      window.localStorage.setItem(SESSION_TS_KEY, String(now));
      _sessionId = stored;
      return stored;
    }
    const fresh = uuid();
    window.localStorage.setItem(SESSION_KEY, fresh);
    window.localStorage.setItem(SESSION_TS_KEY, String(now));
    _sessionId = fresh;
    return fresh;
  }
  if (!_sessionId) _sessionId = uuid();
  return _sessionId;
}

export function resetSession(): void {
  _sessionId = null;
  if (isLocalStorageAvailable()) {
    window.localStorage.removeItem(SESSION_KEY);
    window.localStorage.removeItem(SESSION_TS_KEY);
  }
}

export function trackEvent(params: TrackParams): void {
  ensureAuthSubscribed();
  // Fire-and-forget. Pas d'await pour ne jamais bloquer l'UI. Pas d'appel
  // supabase.auth.* ici — l'userId vient du cache mis à jour via
  // onAuthStateChange (évite la lock contention avec signInWithPassword).
  void (async () => {
    try {
      await supabase.from('user_events').insert({
        user_id: _cachedUserId,
        session_id: getSessionId(),
        event_type: params.event_type,
        screen: params.screen ?? null,
        action: params.action ?? null,
        duration_ms: params.duration_ms ?? null,
        metadata: params.metadata ?? {},
      });
    } catch (e) {
      // Ne jamais throw depuis analytics.
      if (typeof __DEV__ !== 'undefined' && __DEV__) {
        // eslint-disable-next-line no-console
        console.warn('[analytics] trackEvent failed:', e);
      }
    }
  })();
}

// ─── Helpers spécifiques ────────────────────────────────────────────────────

export function trackPageView(screen: string, metadata?: Record<string, unknown>): void {
  trackEvent({ event_type: 'page_view', screen, metadata });
}

export function trackPageLeave(screen: string, duration_ms: number): void {
  trackEvent({ event_type: 'page_leave', screen, duration_ms });
}

export function trackCta(screen: string, action: string, metadata?: Record<string, unknown>): void {
  trackEvent({ event_type: 'cta_click', screen, action, metadata });
}

export function trackFunnel(funnel: string, step: string, metadata?: Record<string, unknown>): void {
  trackEvent({
    event_type: 'funnel_step',
    action: step,
    metadata: { ...metadata, funnel },
  });
}

export function trackError(screen: string, error: unknown, action?: string): void {
  const msg = error instanceof Error ? error.message : String(error);
  const stack = error instanceof Error ? error.stack : undefined;
  trackEvent({
    event_type: 'error',
    screen,
    action,
    metadata: { message: msg, stack: stack?.slice(0, 2000) },
  });
}
