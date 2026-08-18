/**
 * +1-per-night sync for the Tahajjud leaderboard metric, retried on failure
 * instead of silently dropped.
 *
 * Unlike the dhikr/Quran leaderboard trackers, this doesn't need a debounced
 * local counter — every call site (HomeTab, Tracker, HistoryCalendar) already
 * gates itself to at most once per night via its own "already logged today"
 * check, so there's never a burst to coalesce. What it's missing is the same
 * thing dhikr/Quran were missing: Leaderboard.syncDelta() can fail (offline,
 * a cold-start auth race, the anti-cheat cap) and every call site just fired
 * it with `.catch(() => {})`, discarding the result — so a transient failure
 * silently cost that night's +1 forever, with the user's own prayer log
 * (written separately, straight to AsyncStorage) none the wiser.
 *
 * A failed attempt is stashed as a persisted count and folded into the next
 * attempt — either the next night's call, or hydrateTahajjudPending() at the
 * next app launch — rather than lost the moment the promise resolves false.
 *
 * flushPending's read-modify-write of PENDING_KEY is serialized through
 * `lock` below — without it, two overlapping calls (e.g. rapidly toggling
 * several past days on HistoryCalendar, or a fresh syncTahajjudNight() firing
 * while hydrateTahajjudPending() is still mid-read at launch) can both read
 * the same stale pending count before either writes, so if both then fail,
 * the second write clobbers the first instead of accumulating — silently
 * losing part of the retry queue. Serializing makes that structurally
 * impossible: each call's read only ever happens after the previous call's
 * write has fully landed.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Leaderboard } from './leaderboard';

const PENDING_KEY = 'pending-tahajjud-leaderboard-syncs';

// Chained onto for every flushPending() call so they run strictly one after
// another, regardless of how close together they're triggered.
let lock: Promise<void> = Promise.resolve();

function flushPending(extra: number): Promise<void> {
    const run = async () => {
        let carried = 0;
        try {
            const raw = await AsyncStorage.getItem(PENDING_KEY);
            carried = raw ? parseInt(raw, 10) || 0 : 0;
        } catch { /* worst case: a prior stranded count is lost, same as before this fix */ }
        const toSync = carried + extra;
        if (toSync <= 0) return;
        const ok = await Leaderboard.syncDelta('tahajjud', toSync);
        if (ok) {
            AsyncStorage.removeItem(PENDING_KEY).catch(() => {});
        } else {
            // Leave it pending — the next night's call, or the next app launch's
            // hydrateTahajjudPending(), retries this same total instead of
            // losing it.
            AsyncStorage.setItem(PENDING_KEY, String(toSync)).catch(() => {});
        }
    };
    // Queue behind whatever's already running, and swallow a prior failure
    // so one rejected link doesn't wedge the chain for every call after it.
    const next = lock.catch(() => {}).then(run);
    lock = next.catch(() => {});
    return next;
}

/** Call once per Tahajjud night logged. No-ops harmlessly if not opted in —
 * same contract as Leaderboard.syncDelta. */
export async function syncTahajjudNight(): Promise<void> {
    await flushPending(1);
}

/** Call once at app startup (alongside the dhikr/Quran hydrators) to retry
 * any sync stranded by a failure — or a hard kill — before this session
 * ever calls syncTahajjudNight() again. */
export async function hydrateTahajjudPending(): Promise<void> {
    await flushPending(0);
}
