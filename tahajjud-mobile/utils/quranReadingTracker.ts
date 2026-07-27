/**
 * Local counter feeding the Quran-reading leaderboard metric. Volume-based,
 * not coverage-based — every completed ayah adds +1, including repeats (see
 * utils/leaderboard.ts for why: a "distinct ayahs" cap would freeze anyone
 * who'd finished the Quran once, permanently, on every future weekly board).
 *
 * An ayah counts as completed from two independent call sites
 * (components/SurahReader.tsx):
 *   - its audio recitation played through naturally (position reached ~its
 *     duration) — a skip/seek away never reaches that point, so it can't
 *     fire, no separate "was this a skip" check needed
 *   - it was the active/in-view ayah for a minimum dwell time, for silent
 *     readers (gated off whenever audio is playing, so the two paths never
 *     double-count the same ayah)
 *
 * Debounced the same way a burst of dhikr taps collapses into one Firestore
 * write — rapid short-ayah completions during playback shouldn't turn into
 * one write per ayah.
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
    Leaderboard.syncDelta('quranAyahs', toSync).catch(() => {});
}

/** Call once per ayah completion (audio finished naturally, or dwell-time
 * elapsed for silent reading). No-ops harmlessly if not opted in — same
 * contract as Leaderboard.syncDelta. */
export function recordAyahRead(): void {
    pending += 1;
    if (flushTimer) clearTimeout(flushTimer);
    flushTimer = setTimeout(flush, FLUSH_DELAY_MS);
}

/** Flush immediately, bypassing the debounce — call when the app is about
 * to background/close so the last few seconds of reading aren't lost to a
 * timer that never gets to fire. */
export function flushQuranNow(): void {
    if (flushTimer) { clearTimeout(flushTimer); flushTimer = null; }
    flush();
}
