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

import { NativeModules, DeviceEventEmitter } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Leaderboard } from './leaderboard';

const { DhikrIntentsBridge } = NativeModules;

// Mirrors components/TasbeehCard.tsx's getBuiltIn() id → transliteration —
// that file keys its Stats breakdown (DHIKR_TOTALS_KEY) by transliteration
// label, not id, and duplicating the map here (rather than importing a
// whole React component into a background utility) matches this codebase's
// existing convention of duplicating small, stable constants like this
// across files (e.g. prayer-tracker-v2's key literal). Keep in sync with
// both TasbeehCard.tsx AND DhikrChoice in ios/TahajjudWidget/TapDhikrIntent.swift
// if the built-in dhikr list ever changes.
const DHIKR_ID_TO_LABEL: Record<string, string> = {
    subhan:    'SubhanAllah',
    hamd:      'Alhamdulillah',
    akbar:     'Allahu Akbar',
    istighfar: 'Astaghfirullah',
    tahleel:   'La ilaha illallah',
    salawat:   "Allahuma Salli 'ala Muhammad",
};

// TasbeehCard.tsx's own lifetime-totals keys — duplicated here rather than
// exported from a component file. Written to directly (not through React
// state, since this runs at app startup/foreground, often before
// TasbeehCard ever mounts) — see the 'dhikrWidgetTapsDrained' event below
// for how an already-mounted TasbeehCard picks up the change immediately
// instead of waiting for its next mount.
const TASBEEH_ALLTIME_TOTAL_KEY = 'tasbeeh-alltime-total';
const TASBEEH_DHIKR_TOTALS_KEY  = 'tasbeeh-dhikr-totals';

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

/**
 * Drains taps made on the Lock Screen dhikr widget (iOS 17+ — see
 * ios/TahajjudWidget/TapDhikrIntent.swift) into BOTH this file's debounced,
 * durable leaderboard sync AND TasbeehCard.tsx's own Stats totals (all-time
 * + per-dhikr breakdown). The widget's App Intent runs outside the JS
 * engine, so it can't call recordDhikrTap() or touch AsyncStorage-backed
 * React state directly — taps accumulate per-dhikr in the shared App Group
 * instead, and this reads + clears that via DhikrIntentsBridge (native) on
 * the app's next launch or foreground.
 *
 * Acks (clears) the native side BEFORE crediting anything locally — not
 * after. Crediting-then-ack looks safer at first (don't clear native state
 * until the amount is durably captured locally) but actually risks
 * DOUBLE-COUNTING: if ackPendingDhikrTaps() itself fails or the app dies in
 * the gap, the native pending counts are untouched, so the next drain
 * re-reads and re-credits the SAME taps a second time — inflating a shared
 * leaderboard (and a user's own lifetime stats) is a worse failure than
 * losing one. Ack first instead: everything after it is synchronous,
 * non-throwing, in-memory/AsyncStorage work, so the only way to lose taps
 * this way is the process dying mid-write, an essentially negligible risk
 * next to double-crediting.
 *
 * No-ops harmlessly on Android or a binary predating the widget/bridge
 * (DhikrIntentsBridge undefined) — this offer is iOS Lock Screen only for
 * now, same as TapDhikrIntent.swift's own `@available(iOS 17.0, *)` gate.
 */
export async function drainPendingWidgetDhikrTaps(): Promise<void> {
    if (!DhikrIntentsBridge) return;
    try {
        // { [dhikrId]: count } — only ids with a nonzero pending count are
        // included (see DhikrIntentsBridge.swift).
        const byId: Record<string, number> = await DhikrIntentsBridge.consumePendingDhikrTaps();
        const ids = Object.keys(byId).filter(id => byId[id] > 0);
        if (ids.length === 0) return;
        await DhikrIntentsBridge.ackPendingDhikrTaps(byId);

        const total = ids.reduce((sum, id) => sum + byId[id], 0);
        // Leaderboard: same debounced, durable pipeline a normal in-app tap
        // uses — it doesn't care which specific dhikr contributed, just the
        // total.
        recordDhikrTap(total);

        // TasbeehCard.tsx's Stats — all-time total, plus each dhikr's own
        // breakdown, keyed by transliteration label (see DHIKR_ID_TO_LABEL).
        try {
            const [rawTotal, rawTotals] = await Promise.all([
                AsyncStorage.getItem(TASBEEH_ALLTIME_TOTAL_KEY),
                AsyncStorage.getItem(TASBEEH_DHIKR_TOTALS_KEY),
            ]);
            const newTotal = (rawTotal ? parseInt(rawTotal, 10) || 0 : 0) + total;
            const totals: Record<string, number> = rawTotals ? JSON.parse(rawTotals) : {};
            for (const id of ids) {
                const label = DHIKR_ID_TO_LABEL[id];
                if (!label) continue; // unknown/future id — leaderboard credit above still applies
                totals[label] = (totals[label] || 0) + byId[id];
            }
            await Promise.all([
                AsyncStorage.setItem(TASBEEH_ALLTIME_TOTAL_KEY, String(newTotal)),
                AsyncStorage.setItem(TASBEEH_DHIKR_TOTALS_KEY, JSON.stringify(totals)),
            ]);
            // Lets an already-mounted TasbeehCard (e.g. app was open on the
            // Tasbeeh tab, backgrounded, widget tapped, foregrounded again)
            // pick up the new totals immediately instead of only on its next
            // mount — same "event tells a live screen to reload" pattern as
            // 'prayerLogged' elsewhere in this app.
            DeviceEventEmitter.emit('dhikrWidgetTapsDrained');
        } catch {
            // The native side is already acked at this point, so an
            // AsyncStorage failure here (rare — local disk I/O, no network)
            // isn't retried on the next drain the way the rest of this
            // function's failures are. The leaderboard credit above is safe
            // regardless (it went through recordDhikrTap()'s own durable
            // pending counter before this block ever ran) — only this
            // batch's Stats all-time-total/breakdown credit would be missed.
        }
    } catch { /* not consumed/acked — the same counts are simply re-read next launch/foreground */ }
}
