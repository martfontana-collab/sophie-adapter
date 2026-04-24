// Tracks call state across webhook events to dedup emails.
//
// Retell doesn't guarantee ordering between call_ended and call_analyzed
// (observed in prod: call_analyzed arrived BEFORE call_ended, breaking the
// naive cancel-on-analyze logic → double email). This store handles both
// orderings:
//
//   - call_analyzed first: markCallAnalyzed() sets analyzedAt. When
//     call_ended arrives after, schedulePendingCall() sees analyzedAt and
//     skips the timer entirely.
//   - call_ended first: schedulePendingCall() arms the timer. When
//     call_analyzed arrives after, markCallAnalyzed() clears the timer.
//
// State is in-memory only: a service restart drops all pending timers.
// See logStateOnBoot() — called from index.ts at startup for visibility.

const TIMEOUT_MS = 45_000;
const RETENTION_MS = 10 * 60_000; // keep entries 10 min for dedup / debugging
const CLEANUP_INTERVAL_MS = 5 * 60_000;

interface CallState {
  timer?: NodeJS.Timeout;
  analyzedAt?: number;
  createdAt: number;
}

const calls = new Map<string, CallState>();

function getOrCreate(callId: string): CallState {
  let state = calls.get(callId);
  if (!state) {
    state = { createdAt: Date.now() };
    calls.set(callId, state);
  }
  return state;
}

export function schedulePendingCall(
  callId: string,
  onTimeout: () => Promise<void>,
): void {
  const state = getOrCreate(callId);

  // Already analyzed → no timer needed (out-of-order: analyzed came first).
  if (state.analyzedAt) {
    console.log(
      `[call-state] Skip timer for ${callId} — call_analyzed already processed ${Date.now() - state.analyzedAt}ms ago`,
    );
    return;
  }

  if (state.timer) {
    clearTimeout(state.timer);
  }

  const timer = setTimeout(() => {
    const current = calls.get(callId);
    if (current) current.timer = undefined;
    onTimeout().catch((err) =>
      console.error('[call-state] timeout handler failed:', err),
    );
  }, TIMEOUT_MS);

  state.timer = timer;
  console.log(`[call-state] Scheduled fallback timer for ${callId} (${TIMEOUT_MS}ms)`);
}

export function markCallAnalyzed(callId: string): void {
  const state = getOrCreate(callId);

  if (state.timer) {
    clearTimeout(state.timer);
    state.timer = undefined;
    console.log(`[call-state] Cancelled fallback timer for ${callId} (call_analyzed arrived in time)`);
  }

  state.analyzedAt = Date.now();
}

export function isCallAnalyzed(callId: string): boolean {
  return Boolean(calls.get(callId)?.analyzedAt);
}

export function getPendingCount(): number {
  let n = 0;
  for (const s of calls.values()) if (s.timer) n++;
  return n;
}

export function logStateOnBoot(): void {
  console.warn(
    '[call-state] Service started — any pending call timers from previous instance are lost. ' +
      "Recent call_ids won't receive interrupted email if their call_analyzed never arrived before restart.",
  );
}

// Periodic cleanup of old completed states — keep map bounded.
setInterval(() => {
  const cutoff = Date.now() - RETENTION_MS;
  for (const [id, state] of calls) {
    if (!state.timer && state.createdAt < cutoff) {
      calls.delete(id);
    }
  }
}, CLEANUP_INTERVAL_MS).unref?.();
