/**
 * Cloud backup for the prayer tracker — streaks and prayer history.
 *
 * Why this exists: the tracker (prayer logs, current/best streak, grace days)
 * lived ONLY in AsyncStorage. A lost phone or reinstall silently erased a
 * user's 100-night streak — maximal pain for exactly the most devoted users.
 * Duas and the journal already sync to Firestore; this closes the gap for the
 * app's most precious data.
 *
 * Model:
 *  - One doc per user: users/{uid}/appData/prayerTracker
 *  - `pushPrayerHistory()` — fire-and-forget upload after each local change.
 *  - `restorePrayerHistory()` — two-way merge on auth settle (app start):
 *    union of log timestamps per prayer + max(bestStreak). Handles the
 *    fresh-reinstall case (cloud → device) and the offline-logging case
 *    (device → cloud) with the same merge.
 *
 * Anonymous users have a Firebase uid too (anonymous auth on first launch),
 * so their data is also backed up — but only a signed-in account survives a
 * reinstall, which is what the streak-protect sign-in nudge is for.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { DeviceEventEmitter } from 'react-native';
import { getFirebaseAuth, getFirebaseDb } from './firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { logTahajjudToMap, MAP_WINDOW_MS } from './tahajjudMap';

const TRACKER_KEY = 'prayer-tracker-v2';
const BEST_STREAK_KEY = 'tahajjud-best-streak';

const PRAYER_KEYS = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha', 'tahajjud'] as const;

type History = Record<string, string[]>;

function trackerDocRef() {
    const auth = getFirebaseAuth();
    const db = getFirebaseDb();
    const uid = auth?.currentUser?.uid;
    if (!db || !uid) return null;
    return doc(db, 'users', uid, 'appData', 'prayerTracker');
}

async function loadLocal(): Promise<{ history: History; bestStreak: number }> {
    let history: History = {};
    let bestStreak = 0;
    try {
        const raw = await AsyncStorage.getItem(TRACKER_KEY);
        if (raw) history = JSON.parse(raw) ?? {};
    } catch { /* corrupt local data — treat as empty */ }
    try {
        const raw = await AsyncStorage.getItem(BEST_STREAK_KEY);
        if (raw) bestStreak = parseInt(raw, 10) || 0;
    } catch { /* ignore */ }
    for (const k of PRAYER_KEYS) if (!Array.isArray(history[k])) history[k] = [];
    return { history, bestStreak };
}

/** Union-merge two histories: every log timestamp from either side survives. */
function mergeHistories(a: History, b: History): { merged: History; changed: boolean } {
    const merged: History = {};
    let changed = false;
    for (const k of PRAYER_KEYS) {
        const setA = new Set(a[k] ?? []);
        const union = new Set([...(a[k] ?? []), ...(b[k] ?? [])]);
        merged[k] = [...union].sort();
        if (union.size !== setA.size) changed = true;
    }
    return { merged, changed };
}

/** Upload the local tracker state. Fire-and-forget — call after local saves. */
export async function pushPrayerHistory(): Promise<void> {
    try {
        const ref = trackerDocRef();
        if (!ref) return;
        const { history, bestStreak } = await loadLocal();
        await setDoc(ref, { history, bestStreak, updatedAt: new Date().toISOString() }, { merge: true });
    } catch { /* offline / rules / etc. — next push retries naturally */ }
}

/**
 * Two-way merge with the cloud copy. Call once auth settles at app start.
 * If the merge brought anything new down (e.g. fresh reinstall), local
 * storage is updated and 'prayerHistoryRestored' is emitted so Tracker
 * re-reads its state.
 */
export async function restorePrayerHistory(): Promise<void> {
    try {
        const ref = trackerDocRef();
        if (!ref) return;
        const [snap, local] = await Promise.all([getDoc(ref), loadLocal()]);
        const remote = snap.exists() ? (snap.data() as any) : null;

        const remoteHistory: History = remote?.history ?? {};
        const remoteBest: number = remote?.bestStreak ?? 0;

        const { merged, changed: localGained } = mergeHistories(local.history, remoteHistory);
        const bestStreak = Math.max(local.bestStreak, remoteBest);

        if (localGained || bestStreak > local.bestStreak) {
            await AsyncStorage.setItem(TRACKER_KEY, JSON.stringify(merged));
            await AsyncStorage.setItem(BEST_STREAK_KEY, String(bestStreak));
            DeviceEventEmitter.emit('prayerHistoryRestored');

            // A Tahajjud logged on another device is just as real as one
            // logged here — it should count on the global map too. Only
            // backfill entries the map's rolling window would still consider
            // "recent"; anything older would misrepresent a past night as
            // happening right now.
            const localTahajjud = new Set(local.history.tahajjud ?? []);
            for (const iso of remoteHistory.tahajjud ?? []) {
                if (localTahajjud.has(iso)) continue;
                if (Date.now() - new Date(iso).getTime() <= MAP_WINDOW_MS) {
                    logTahajjudToMap().catch(() => {});
                }
            }
        }

        // Push the merged result back up if the cloud was missing anything
        const { changed: remoteMissing } = mergeHistories(remoteHistory, local.history);
        if (!snap.exists() || remoteMissing || bestStreak > remoteBest) {
            await setDoc(ref, { history: merged, bestStreak, updatedAt: new Date().toISOString() }, { merge: true });
        }
    } catch { /* offline — nothing lost, local stays authoritative */ }
}
