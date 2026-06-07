/**
 * Global Tahajjud Map — anonymously records and reads real-time Tahajjud logs
 * on a world map.
 *
 * Privacy:
 *  - Coordinates rounded to 1 decimal place (~11km grid, city-level only)
 *  - No user ID, no name, no device ID stored
 *  - Documents auto-filtered to the last 90 minutes (Tahajjud window)
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
import { getFirebaseDb } from './firebase';

// Hard caps so a large collection can never blow the Firestore read quota.
const MAP_DOT_LIMIT = 500;   // dots rendered on the live map
const COUNT_LIMIT = 1000;    // ceiling for the "today" counter
import * as Location from 'expo-location';

export interface MapDot {
    id: string;
    lat: number;
    lng: number;
}

const COLLECTION = 'tahajjud_map';

/** Call when user logs Tahajjud — writes a city-level dot anonymously. */
export async function logTahajjudToMap(): Promise<void> {
    try {
        const db = getFirebaseDb();
        if (!db) return;

        // Use last known position — no permission prompt, no delay
        const pos = await Location.getLastKnownPositionAsync({});
        if (!pos) return;

        // Round to 1dp for city-level anonymity (~11km)
        const lat = Math.round(pos.coords.latitude  * 10) / 10;
        const lng = Math.round(pos.coords.longitude * 10) / 10;

        await addDoc(collection(db, COLLECTION), { lat, lng, ts: serverTimestamp() });
    } catch { /* never block prayer logging */ }
}

/**
 * Subscribes to all Tahajjud logs from the last 90 minutes globally.
 * Returns an unsubscribe function.
 */
export function subscribeTahajjudMap(
    onUpdate: (dots: MapDot[], total: number) => void,
): () => void {
    try {
        const db = getFirebaseDb();
        if (!db) { onUpdate([], 0); return () => {}; }

        // Initial cutoff — also filtered client-side so the window stays accurate
        const cutoff = Timestamp.fromDate(new Date(Date.now() - 90 * 60 * 1000));
        const q = query(collection(db, COLLECTION), where('ts', '>=', cutoff), limit(MAP_DOT_LIMIT));

        return onSnapshot(q, snap => {
            const windowStart = Date.now() - 90 * 60 * 1000; // re-evaluated on each update
            const dots: MapDot[] = snap.docs
                .filter(d => d.data().ts?.toMillis() >= windowStart)
                .map(d => ({ id: d.id, lat: d.data().lat, lng: d.data().lng }))
                // Drop malformed docs — undefined/NaN coords crash react-native-maps
                .filter(dot => typeof dot.lat === 'number' && typeof dot.lng === 'number'
                    && !isNaN(dot.lat) && !isNaN(dot.lng));
            onUpdate(dots, dots.length);
        }, () => onUpdate([], 0));
    } catch {
        onUpdate([], 0);
        return () => {};
    }
}

/** Total Tahajjud logs in the last 24 hours (for the "last night" stat). */
export function subscribeDailyTotal(onUpdate: (total: number) => void): () => void {
    try {
        const db = getFirebaseDb();
        if (!db) { onUpdate(0); return () => {}; }

        const cutoff = Timestamp.fromDate(new Date(Date.now() - 24 * 60 * 60 * 1000));
        const q = query(collection(db, COLLECTION), where('ts', '>=', cutoff), limit(COUNT_LIMIT));

        // One-time server-side count instead of a permanent onSnapshot listener.
        // The map card is only a passive indicator (hidden until 50+), so a live
        // listener that re-renders the heavy Home screen on every change isn't
        // worth the cost. getCountFromServer is a single cheap aggregation query.
        let cancelled = false;
        getCountFromServer(q)
            .then(snap => { if (!cancelled) onUpdate(snap.data().count); })
            .catch(() => { if (!cancelled) onUpdate(0); });
        return () => { cancelled = true; };
    } catch { onUpdate(0); return () => {}; }
}
