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
 *
 * `pending` is also persisted to AsyncStorage and only cleared once
 * Leaderboard.syncDelta() confirms the write actually landed — a flush that
 * fires right as the app backgrounds (see App.tsx) races the OS suspending
 * the process before the Firestore round-trip completes, and a flush can
 * also fail outright (offline, a cold-start auth race, the anti-cheat cap
 * rejecting a legitimate burst). Earlier this counter zeroed itself the
 * instant a flush was ATTEMPTED, not when it actually succeeded, so any of
 * those cases silently and permanently dropped real taps — exactly the "I
 * did dhikr but my count didn't go up" reports this fixes.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Leaderboard } from './leaderboard';

const FLUSH_DELAY_MS = 3000;
const PENDING_KEY = 'pending-dhikr-taps';

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
    const ok = await Leaderboard.syncDelta('dhikr', toSync);
    if (ok) {
        // Subtract rather than zero — a tap that landed while this flush was
        // already in flight (pending grew past toSync) must survive.
        pending = Math.max(0, pending - toSync);
        persistPending();
    }
    // On failure, `pending` is deliberately left untouched (and still on
    // disk) — the next tap's debounce, or the next background/foreground
    // flush, retries the same total instead of losing it.
}

/** Call once per dhikr tap. No-ops harmlessly if not opted in — same
 * contract as Leaderboard.syncDelta. */
export function recordDhikrTap(n: number = 1): void {
    pending += n;
    persistPending();
    if (flushTimer) clearTimeout(flushTimer);
    flushTimer = setTimeout(flush, FLUSH_DELAY_MS);
}

/** Flush immediately, bypassing the debounce — call when the app is about
 * to background/close so the last few seconds of taps aren't lost to a
 * timer that never gets to fire. */
export function flushDhikrNow(): void {
    if (flushTimer) { clearTimeout(flushTimer); flushTimer = null; }
    flush().catch(() => {});
}

/** Call once at app startup (alongside drainPendingPrayerLogs) to recover a
 * count stranded by a hard kill that happened before any flush — background
 * or debounced — ever got to run. Immediately attempts to sync it; if that
 * also fails, it stays on disk and simply gets picked up on the next
 * startup or the next real tap, same retry story as any other flush. */
export async function hydrateDhikrPending(): Promise<void> {
    if (hydrated) return;
    hydrated = true;
    try {
        const raw = await AsyncStorage.getItem(PENDING_KEY);
        const stranded = raw ? parseInt(raw, 10) : 0;
        if (stranded > 0) pending += stranded;
    } catch { /* worst case: that stranded count stays lost, same as before this fix */ }
    if (pending > 0) flushDhikrNow();
}
