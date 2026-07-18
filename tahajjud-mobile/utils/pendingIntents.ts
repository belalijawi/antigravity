import { NativeModules, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { localDateStr } from './localDate';
import { logTahajjudToMap, MAP_WINDOW_MS } from './tahajjudMap';

/**
 * Drains pending prayer-log intents from the iOS shared App Group.
 * Called on app launch — picks up logs that Siri/Shortcuts wrote while the
 * app was closed and merges them into the local tracker.
 *
 * The native side (TahajjudAppIntents.swift) writes entries like
 * "fajr|2026-05-10T03:48:00Z" to UserDefaults under "pending-prayer-logs".
 *
 * On Android this is a no-op (App Intents are iOS-specific).
 */

const { PendingIntentsBridge } = NativeModules;

const TRACKER_KEY = 'prayer-tracker-v2';

interface PendingLog {
    prayer: string;
    iso: string;
}

export async function drainPendingPrayerLogs(): Promise<number> {
    if (Platform.OS !== 'ios' || !PendingIntentsBridge) return 0;

    let entries: string[] = [];
    try {
        entries = await PendingIntentsBridge.consumePendingLogs();
    } catch {
        return 0;
    }
    if (!entries || entries.length === 0) return 0;

    const parsed: PendingLog[] = entries
        .map(e => {
            const [prayer, iso] = e.split('|');
            return prayer && iso ? { prayer: prayer.toLowerCase(), iso } : null;
        })
        .filter((x): x is PendingLog => !!x);

    // Merge into tracker. If this fails, we DON'T ack — entries remain on
    // the native side so we'll retry on next launch.
    let merged = 0;
    try {
        const raw = await AsyncStorage.getItem(TRACKER_KEY);
        const history = raw
            ? JSON.parse(raw)
            : { fajr: [], dhuhr: [], asr: [], maghrib: [], isha: [], tahajjud: [] };
        for (const e of parsed) {
            if (!history[e.prayer]) continue;
            const day = localDateStr(e.iso);
            const already = (history[e.prayer] as string[]).some(d => localDateStr(d) === day);
            if (!already) {
                (history[e.prayer] as string[]).push(e.iso);
                merged++;
                // A Siri/Shortcuts Tahajjud log is just as real as one logged
                // in-app, so it should count on the global map too — but only
                // if it's still recent enough to fall in the map's rolling
                // window. An older one (e.g. phone was offline for days) would
                // misrepresent a past night as happening right now.
                if (e.prayer === 'tahajjud' && Date.now() - new Date(e.iso).getTime() <= MAP_WINDOW_MS) {
                    logTahajjudToMap().catch(() => {});
                }
            }
        }
        await AsyncStorage.setItem(TRACKER_KEY, JSON.stringify(history));
    } catch {
        return 0; // don't ack — try again next launch
    }

    // Successful merge — tell native side to drop these specific entries.
    // New Siri logs that arrive between consume and ack are preserved.
    try {
        if (PendingIntentsBridge.ackPendingLogs) {
            await PendingIntentsBridge.ackPendingLogs(entries);
        }
    } catch { /* worst case: we'll re-merge next launch — already-logged check makes that safe */ }

    return merged;
}
