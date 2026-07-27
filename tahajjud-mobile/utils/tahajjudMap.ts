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

import { collection, addDoc, query, where, limit, orderBy, getCountFromServer,
         onSnapshot, Timestamp, serverTimestamp } from 'firebase/firestore';
import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getFirebaseDb, getFirebaseAuth, ensureSignedIn } from './firebase';
import { track } from './analytics';

// Hard cap so a large collection can never blow the Firestore read quota
// fetching individual documents for the live map. Exported so the map modal
// can tell when its dot count is capped (and thus NOT the true total).
// Raised from 500 as real usage grew — the map's own render-time viewport
// culling (see GlobalTahajjudMap.tsx) is what actually bounds on-screen
// overlay count regardless of this number, so this only controls the SIZE
// OF THE POOL the client picks visible dots from, not how many get drawn at
// once. A bigger pool means better geographic coverage/accuracy at any
// given zoom without any extra rendering cost.
export const MAP_DOT_LIMIT = 3000;   // dots rendered on the live map
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

/**
 * City-level position (~11km grid) or null. Never prompts for permission by
 * default — pass allowPrompt ONLY from an explicit user action (e.g. the
 * "show on map" compose toggle), per this app's permission policy.
 */
export async function getRoundedLocation(
    allowPrompt = false,
): Promise<{ lat: number; lng: number } | null> {
    try {
        let pos = await Location.getLastKnownPositionAsync({});
        if (!pos) {
            let { status } = await Location.getForegroundPermissionsAsync();
            if (status !== 'granted' && allowPrompt) {
                ({ status } = await Location.requestForegroundPermissionsAsync());
            }
            if (status !== 'granted') return null;
            pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Lowest });
        }
        if (!pos) return null;
        return {
            lat: Math.round(pos.coords.latitude * 10) / 10,
            lng: Math.round(pos.coords.longitude * 10) / 10,
        };
    } catch { return null; }
}

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
                // Without an explicit order, Firestore defaults a range-filtered
                // query to ascending order on the filtered field — so limit()
                // would keep the OLDEST 500 in the window, not the newest. Once
                // a busy night exceeds the cap, that silently hid brand-new
                // submissions until an older one aged out. Order descending so
                // a capped result is always "the 500 most recent," matching what
                // "live map" implies.
                const q = query(collection(db, COLLECTION), where('ts', '>=', cutoff), orderBy('ts', 'desc'), limit(MAP_DOT_LIMIT));

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
                    track('map_dots_listener_failed', { error_code: e?.code ?? String(e) });
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
        // Fires once per subscription so PostHog can compare the actual observed
        // count across platforms/devices — the only way to tell "her count is
        // genuinely low" apart from "her fetch is silently failing" without logs.
        let hasTrackedFirstValue = false;
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
                        if (!hasTrackedFirstValue) {
                            hasTrackedFirstValue = true;
                            track('map_daily_total_observed', { count, card_visible: count >= 50 });
                        }
                    })
                    .catch(e => {
                        // Keep the previous value, but retry with backoff instead
                        // of waiting the full 5 minutes.
                        console.error('[tahajjudMap] subscribeDailyTotal refresh failed', e);
                        track('map_daily_total_fetch_failed', {
                            error_code: e?.code ?? String(e),
                            has_auth_user: !!getFirebaseAuth().currentUser,
                        });
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

// ── Dua pins ────────────────────────────────────────────────────────────────
// Wall duas whose authors opted in to "show on tonight's map". Same rolling
// 24h window as the dots; the dua itself lives on (and is moderated by) the
// Dua Wall — a pin is just a second surface for the same document.

export interface MapDua {
    id: string;
    lat: number;
    lng: number;
    text: string;
    displayName: string;    // 'Anonymous' if the author didn't give a name
    answered: boolean;
    ameenCount: number;
    createdAt: Date;
}

// Raised alongside MAP_DOT_LIMIT for the same reason — the map now culls/
// caps dua pins by viewport too (see GlobalTahajjudMap.tsx), so a bigger
// pool here improves geographic coverage without extra rendering cost.
const MAP_DUA_LIMIT = 400;

/** Subscribe to duas pinned to the map in the last 24h. */
export function subscribeMapDuas(
    onUpdate: (duas: MapDua[]) => void,
): () => void {
    try {
        const db = getFirebaseDb();
        if (!db) { onUpdate([]); return () => {}; }

        // Same cold-start protection the dots listener above has, and for the
        // exact same reason — this listener not having it is what made dua
        // pins "disappear".
        //
        // Firestore rules require auth to read public-duas, and a
        // permission-denied error PERMANENTLY closes an onSnapshot listener.
        // On a cold start the anonymous sign-in may still be in flight, so if
        // this listener loses that race (or hits any transient network error)
        // it used to log, call onUpdate([]) — blanking every pin on the map —
        // and then stay dead for the entire lifetime of the screen, since
        // nothing ever re-attached it. The dots listener recovered from the
        // identical race via retry/backoff, which is why dots would render
        // while pins silently never appeared, and why closing and reopening
        // the map (a fresh listener) "fixed" it.
        //
        // Note this failure had nothing to do with zoom or with how pins are
        // rendered — it just tended to be noticed while zooming in on a pin.
        let cancelled = false;
        let unsubSnap: (() => void) | null = null;
        let retryTimer: ReturnType<typeof setTimeout> | undefined;
        let retryDelay = 5 * 1000;
        const attach = () => {
            // ensureSignedIn resolves instantly once a session exists, and
            // re-attempts sign-in if the previous attempt failed.
            ensureSignedIn().finally(() => {
                if (cancelled) return;
                const cutoff = Timestamp.fromMillis(Date.now() - MAP_WINDOW_MS);
                const q = query(
                    collection(db, 'public-duas'),
                    where('onMap', '==', true),
                    where('createdAt', '>=', cutoff),
                    orderBy('createdAt', 'desc'),
                    limit(MAP_DUA_LIMIT),
                );
                unsubSnap = onSnapshot(q, snap => {
                    retryDelay = 5 * 1000; // healthy again — reset backoff
                    const out: MapDua[] = [];
                    snap.forEach(d => {
                        const data = d.data() as any;
                        // hidden filtered client-side — the pin count is tiny and
                        // this avoids another composite index.
                        if (data.hidden) return;
                        if (typeof data.lat !== 'number' || typeof data.lng !== 'number') return;
                        out.push({
                            id: d.id,
                            lat: data.lat,
                            lng: data.lng,
                            text: data.text ?? '',
                            displayName: data.displayName ?? 'Anonymous',
                            answered: data.answered ?? false,
                            ameenCount: data.ameenCount ?? 0,
                            createdAt: data.createdAt?.toDate?.() ?? new Date(),
                        });
                    });
                    onUpdate(out);
                }, e => {
                    // Deliberately does NOT call onUpdate([]) — keep whatever
                    // pins are already on screen rather than blanking them for
                    // what is usually a transient error, then re-attach.
                    console.error('[tahajjudMap] dua pins listener failed, retrying', e);
                    track('map_pins_listener_failed', { error_code: (e as any)?.code ?? String(e) });
                    if (cancelled) return;
                    unsubSnap?.(); unsubSnap = null;
                    retryTimer = setTimeout(attach, retryDelay);
                    retryDelay = Math.min(retryDelay * 2, 2 * 60 * 1000);
                });
            });
        };
        attach();
        return () => { cancelled = true; unsubSnap?.(); if (retryTimer) clearTimeout(retryTimer); };
    } catch { onUpdate([]); return () => {}; }
}
