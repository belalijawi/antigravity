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
 *
 * `pending` is also persisted to AsyncStorage and only cleared once
 * Leaderboard.syncDelta() confirms the write actually landed — see
 * dhikrLeaderboardTracker.ts for why this matters (same counter shape, same
 * bug, same fix): a flush attempted right as the app backgrounds, or one
 * that fails outright, must not silently discard real progress.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Leaderboard } from './leaderboard';

const FLUSH_DELAY_MS = 3000;
const PENDING_KEY = 'pending-quran-ayahs';

let pending = 0;
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let hydrated = false;

function persistPending(): void {
    AsyncStorage.setItem(PENDING_KEY, String(pending)).catch(() => {});
}

async function flush(): Promise<void> {
    flushTimer = null;
    if (pending <= 0) return;
    const toSync = pending;
    const ok = await Leaderboard.syncDelta('quranAyahs', toSync);
    if (ok) {
        // Subtract rather than zero — an ayah that completed while this
        // flush was already in flight (pending grew past toSync) must survive.
        pending = Math.max(0, pending - toSync);
        persistPending();
    }
    // On failure, `pending` is deliberately left untouched (and still on
    // disk) — the next ayah's debounce, or the next background/foreground
    // flush, retries the same total instead of losing it.
}

/** Call once per ayah completion (audio finished naturally, or dwell-time
 * elapsed for silent reading). No-ops harmlessly if not opted in — same
 * contract as Leaderboard.syncDelta. */
export function recordAyahRead(): void {
    pending += 1;
    persistPending();
    if (flushTimer) clearTimeout(flushTimer);
    flushTimer = setTimeout(flush, FLUSH_DELAY_MS);
}

/** Flush immediately, bypassing the debounce — call when the app is about
 * to background/close so the last few seconds of reading aren't lost to a
 * timer that never gets to fire. */
export function flushQuranNow(): void {
    if (flushTimer) { clearTimeout(flushTimer); flushTimer = null; }
    flush().catch(() => {});
}

/** Call once at app startup (alongside drainPendingPrayerLogs) to recover a
 * count stranded by a hard kill that happened before any flush — background
 * or debounced — ever got to run. Immediately attempts to sync it; if that
 * also fails, it stays on disk and simply gets picked up on the next
 * startup or the next real ayah, same retry story as any other flush. */
export async function hydrateQuranPending(): Promise<void> {
    if (hydrated) return;
    hydrated = true;
    try {
        const raw = await AsyncStorage.getItem(PENDING_KEY);
        const stranded = raw ? parseInt(raw, 10) : 0;
        if (stranded > 0) pending += stranded;
    } catch { /* worst case: that stranded count stays lost, same as before this fix */ }
    if (pending > 0) flushQuranNow();
}
