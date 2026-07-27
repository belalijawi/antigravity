/**
 * Local counter feeding the dhikr leaderboard metric.
 *
 * Previously the leaderboard only synced on saveSession() — which only fires
 * when a full round completes (hits dhikr.target) or the user explicitly
 * resets/switches dhikr. Any in-progress count (e.g. 20 taps into a 33
 * target) that the user never "finished" — closed the app, backgrounded it,
 * switched tabs mid-round — was silently never synced at all, not even
 * delayed. Every real tap now feeds this debounced counter instead, so
 * progress is never lost to an unfinished round.
 *
 * Debounced the same way Quran ayah completions collapse into one Firestore
 * write per burst rather than one per tap (see quranReadingTracker.ts).
 */

import { Leaderboard } from './leaderboard';

const FLUSH_DELAY_MS = 3000;

let pending = 0;
let flushTimer: ReturnType<typeof setTimeout> | null = null;

function flush(): void {
    flushTimer = null;
    if (pending <= 0) return;
    const toSync = pending;
    pending = 0;
    Leaderboard.syncDelta('dhikr', toSync).catch(() => {});
}

/** Call once per dhikr tap. No-ops harmlessly if not opted in — same
 * contract as Leaderboard.syncDelta. */
export function recordDhikrTap(n: number = 1): void {
    pending += n;
    if (flushTimer) clearTimeout(flushTimer);
    flushTimer = setTimeout(flush, FLUSH_DELAY_MS);
}

/** Flush immediately, bypassing the debounce — call when the app is about
 * to background/close so the last few seconds of taps aren't lost to a
 * timer that never gets to fire. */
export function flushDhikrNow(): void {
    if (flushTimer) { clearTimeout(flushTimer); flushTimer = null; }
    flush();
}
