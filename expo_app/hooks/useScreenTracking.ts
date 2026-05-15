// ─────────────────────────────────────────────────────────────────────────────
// Auto-instrumentation : appelle trackPageView au mount, trackPageLeave au
// unmount avec la durée passée sur l'écran. Idempotent — un seul mount par
// instance.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useRef } from 'react';
import { trackPageView, trackPageLeave } from '../lib/analytics';

export function useScreenTracking(screen: string, metadata?: Record<string, unknown>): void {
  const enteredAt = useRef<number>(0);

  useEffect(() => {
    enteredAt.current = Date.now();
    trackPageView(screen, metadata);
    return () => {
      const elapsed = Date.now() - enteredAt.current;
      // Ignore < 200ms (probable unmount immédiat / strict mode double-render)
      if (elapsed >= 200) trackPageLeave(screen, elapsed);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen]);
}
