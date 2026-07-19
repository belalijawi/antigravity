/**
 * Global Tahajjud Map — anonymously records and reads real-time Tahajjud logs
 * on a world map.
 *
 * Privacy:
 *  - Coordinates rounded to 1 decimal place (~11km grid, city-level only)
 *  - No user ID, no name, no device ID stored
 *  - Documents auto-filtered to the last 24 hours (rolling Tahajjud window)
 *
 * Firestore structure:
 *   tahajjud_map/{auto-id} {
 *     lat:  number   (rounded to 1dp)
 *     lng:  number   (rounded to 1dp)
 *     ts:   Timestamp
 *   }
 */

import { collection, addDoc, query, where, limit, getCountFromServer,
         onSnapshot, Timestamp, serverTimestamp } from 'firebase/firestore';
import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getFirebaseDb, ensureSignedIn } from './firebase';

// Hard cap so a large collection can never blow the Firestore read quota
// fetching individual documents for the live map. Exported so the map modal
// can tell when its dot count is capped (and thus NOT the true total).
export const MAP_DOT_LIMIT = 500;   // dots rendered on the live map
// Rolling window for the map. Kept in sync with the home card's daily total
// (subscribeDailyTotal) so the dots on the map and the "X prayed in the last
// 24h" headline always describe the same set of people. Exported so callers
// backfilling a map entry for an already-logged prayer (Siri, cloud restore)
// can check the original prayer time is still within this window before
// logging it — logging an old prayer "now" would misrepresent it as current.
export const MAP_WINDOW_MS = 24 * 60 * 60 * 1000;
import * as Location from 'expo-location';

export interface MapDot {
    id: string;
    lat: number;
    lng: number;
}

const COLLECTION = 'tahajjud_map';

// Live subscribeDailyTotal instances register their refresh function here so
// a successful map write can bump the Home card count immediately instead of
// waiting up to 5 minutes for the next poll tick.
const activeCountRefreshers = new Set<() => void>();

/** Call when user logs Tahajjud — writes a city-level dot anonymously. */
export async function logTahajjudToMap(): Promise<void> {
    try {
        const db = getFirebaseDb();
        if (!db) return;

        // Prefer the last known position — no permission prompt, no delay.
        // Tahajjud is logged after hours of inactivity/sleep, so a lot of
        // phones won't have a recent cached fix; fall back to asking for a
        // fresh one rather than silently dropping a real submission. Never
        // request permission here — this fires from a background flow right
        // after logging a prayer, and popping an OS prompt at that moment
        // would be jarring and inconsistent with how this app always ties
        // permission requests to an explicit, user-initiated screen.
        let pos = await Location.getLastKnownPositionAsync({});
        if (!pos) {
            const { status } = await Location.getForegroundPermissionsAsync();
            if (status !== 'granted') return;
            pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Lowest });
        }
        if (!pos) return;

        // Round to 1dp for city-level anonymity (~11km)
        const lat = Math.round(pos.coords.latitude  * 10) / 10;
        const lng = Math.round(pos.coords.longitude * 10) / 10;

        await addDoc(collection(db, COLLECTION), { lat, lng, ts: serverTimestamp() });
        // The user just joined the count — refresh the Home card now so their
        // own prayer is reflected immediately.
        activeCountRefreshers.forEach(refresh => refresh());
    } catch { /* never block prayer logging */ }
}

/**
 * Subscribes to all Tahajjud logs from the last 24 hours globally.
 * Returns an unsubscribe function.
 */
export function subscribeTahajjudMap(
    onUpdate: (dots: MapDot[], total: number) => void,
): () => void {
    try {
        const db = getFirebaseDb();
        if (!db) { onUpdate([], 0); return () => {}; }

        // Firestore rules require auth to read this collection, and a
        // permission-denied error permanently closes an onSnapshot listener.
        // On a cold start the anonymous sign-in may still be in flight, so
        // wait for it before attaching — and if the listener errors anyway
        // (auth race lost, transient network), re-attach with backoff instead
        // of dying silently with an empty map.
        let cancelled = false;
        let unsubSnap: (() => void) | null = null;
        let retryTimer: ReturnType<typeof setTimeout> | undefined;
        let retryDelay = 5 * 1000;
        const attach = () => {
            // ensureSignedIn resolves instantly once a session exists, and
            // re-attempts sign-in if the previous attempt failed.
            ensureSignedIn().finally(() => {
                if (cancelled) return;
                // Initial cutoff — also filtered client-side so the window stays accurate
                const cutoff = Timestamp.fromDate(new Date(Date.now() - MAP_WINDOW_MS));
                const q = query(collection(db, COLLECTION), where('ts', '>=', cutoff), limit(MAP_DOT_LIMIT));

                unsubSnap = onSnapshot(q, snap => {
                    retryDelay = 5 * 1000; // healthy again — reset backoff
                    const windowStart = Date.now() - MAP_WINDOW_MS; // re-evaluated on each update
                    const dots: MapDot[] = snap.docs
                        .filter(d => d.data().ts?.toMillis() >= windowStart)
                        .map(d => ({ id: d.id, lat: d.data().lat, lng: d.data().lng }))
                        // Drop malformed docs — undefined/NaN coords crash react-native-maps
                        .filter(dot => typeof dot.lat === 'number' && typeof dot.lng === 'number'
                            && !isNaN(dot.lat) && !isNaN(dot.lng));
                    onUpdate(dots, dots.length);
                }, e => {
                    // Keep whatever the caller is already showing (don't zero it
                    // out — a transient error must never blank the map or, via
                    // onLiveTotal, hide the Home card) and re-attach.
                    console.error('[tahajjudMap] dots listener failed, retrying', e);
                    if (cancelled) return;
                    unsubSnap?.(); unsubSnap = null;
                    retryTimer = setTimeout(attach, retryDelay);
                    retryDelay = Math.min(retryDelay * 2, 2 * 60 * 1000);
                });
            });
        };
        attach();
        return () => { cancelled = true; unsubSnap?.(); if (retryTimer) clearTimeout(retryTimer); };
    } catch {
        onUpdate([], 0);
        return () => {};
    }
}

// Last count that successfully came back from the server — persisted so a
// fresh cold start can show the Home map card immediately instead of hiding
// it behind the >= 50 gate until the first network round-trip completes.
const DAILY_TOTAL_CACHE_KEY = 'tahajjud_map_daily_total_cache';

/** Total Tahajjud logs in the last 24 hours (for the "last night" stat). */
export function subscribeDailyTotal(onUpdate: (total: number) => void): () => void {
    try {
        const db = getFirebaseDb();
        if (!db) { onUpdate(0); return () => {}; }

        // Periodic server-side count instead of a permanent onSnapshot listener
        // (a live listener re-rendering the heavy Home screen on every write
        // isn't worth it — getCountFromServer is a single cheap aggregation).
        // It MUST re-count though: the 24h window is rolling, so a one-time
        // count goes stale while the Home tab stays mounted — the card was
        // showing more people than the map because aged-out logs were never
        // dropped from its number. The cutoff is recomputed on every tick.
        let cancelled = false;
        let hasFreshValue = false;
        let retryTimer: ReturnType<typeof setTimeout> | undefined;
        let retryDelay = 10 * 1000;

        // Seed with the last known count while the fresh one is in flight —
        // guarded so a slow cache read can never overwrite a fresh result.
        AsyncStorage.getItem(DAILY_TOTAL_CACHE_KEY).then(v => {
            const cached = v ? parseInt(v, 10) : NaN;
            if (!cancelled && !hasFreshValue && Number.isFinite(cached) && cached > 0) {
                onUpdate(cached);
            }
        }).catch(() => {});

        const refresh = () => {
            if (cancelled) return;
            // A pending retry is now superseded by this call — without
            // clearing it, a slow retry and the next 5-minute interval tick
            // could both land, double-firing getCountFromServer.
            if (retryTimer) { clearTimeout(retryTimer); retryTimer = undefined; }
            // Re-await sign-in on EVERY attempt: it's instant once a session
            // exists, and it re-triggers anonymous auth if a previous attempt
            // failed — otherwise one bad cold-start network window would leave
            // every count query permission-denied for the whole session.
            ensureSignedIn().finally(() => {
                if (cancelled) return;
                const cutoff = Timestamp.fromDate(new Date(Date.now() - MAP_WINDOW_MS));
                // No limit() — count() aggregations don't fetch documents, so
                // there's no read-quota reason to cap them.
                const q = query(collection(db, COLLECTION), where('ts', '>=', cutoff));
                getCountFromServer(q)
                    .then(snap => {
                        if (cancelled) return;
                        retryDelay = 10 * 1000;
                        hasFreshValue = true;
                        const count = snap.data().count;
                        onUpdate(count);
                        AsyncStorage.setItem(DAILY_TOTAL_CACHE_KEY, String(count)).catch(() => {});
                    })
                    .catch(e => {
                        // Keep the previous value, but retry with backoff instead
                        // of waiting the full 5 minutes.
                        console.error('[tahajjudMap] subscribeDailyTotal refresh failed', e);
                        if (cancelled) return;
                        retryTimer = setTimeout(refresh, retryDelay);
                        retryDelay = Math.min(retryDelay * 2, 5 * 60 * 1000);
                    });
            });
        };
        refresh();
        const interval = setInterval(refresh, 5 * 60 * 1000);
        // setInterval doesn't tick while the app is suspended — without this,
        // reopening the app after hours shows the pre-background count until
        // the next 5-minute tick. Refresh the moment we're foregrounded.
        const appStateSub = AppState.addEventListener('change', state => {
            if (state === 'active') refresh();
        });
        // Let logTahajjudToMap bump the count immediately after a write.
        activeCountRefreshers.add(refresh);
        return () => {
            cancelled = true;
            clearInterval(interval);
            if (retryTimer) clearTimeout(retryTimer);
            appStateSub.remove();
            activeCountRefreshers.delete(refresh);
        };
    } catch { onUpdate(0); return () => {}; }
}
