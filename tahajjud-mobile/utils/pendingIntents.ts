import { NativeModules, DeviceEventEmitter } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { localDateStr } from './localDate';
import { logTahajjudToMap, MAP_WINDOW_MS } from './tahajjudMap';
import { track } from './analytics';
import { checkAchievements } from './achievements';
import { AccountabilityPartner } from './accountabilityPartner';
import { TahajjudChallenge } from './tahajjudChallenge';
import { refreshWeeklyDigest } from './weeklyDigest';

/**
 * Drains pending prayer-log intents written outside the JS app — the
 * widget's "Log" button on both platforms (ios/TahajjudWidget/LogPrayerIntent.swift,
 * android/.../widget/LogPrayerAction.kt), picked up on next app launch or
 * foreground and merged into the local tracker.
 *
 * The native side writes entries like "fajr|2026-05-10T03:48:00Z" to shared
 * storage under a pending-logs key (see PendingIntentsBridge on each platform).
 */

const { PendingIntentsBridge } = NativeModules;

const TRACKER_KEY = 'prayer-tracker-v2';

interface PendingLog {
    prayer: string;
    iso: string;
}

export async function drainPendingPrayerLogs(): Promise<number> {
    if (!PendingIntentsBridge) return 0;

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
                track('prayer_logged', { prayer: e.prayer, source: 'widget' });
                if (e.prayer === 'tahajjud') {
                    // A widget-tap Tahajjud log is just as real as one logged
                    // in-app, so it should count on the global map too — but only
                    // if it's still recent enough to fall in the map's rolling
                    // window. An older one (e.g. phone was offline for days) would
                    // misrepresent a past night as happening right now.
                    if (Date.now() - new Date(e.iso).getTime() <= MAP_WINDOW_MS) {
                        logTahajjudToMap().catch(() => {});
                    }
                    checkAchievements('prayer', (history.tahajjud as string[]).length).catch(() => {});
                    AccountabilityPartner.logTahajjudForPartner().catch(() => {});
                    import('./streakReminder').then(m => m.cancelStreakAtRisk()).catch(() => {});
                    refreshWeeklyDigest().catch(() => {});
                    TahajjudChallenge.recordTahajjudToday().catch(() => {});
                    import('./liveActivity').then(m => m.LiveActivity.endAll()).catch(() => {});
                    // Leaderboard: every other Tahajjud-logging path (in-app,
                    // notification action) syncs this — a widget-tap log,
                    // drained here on next launch, was the one gap left.
                    import('./leaderboard').then(m => m.Leaderboard.syncDelta('tahajjud', 1)).catch(() => {});
                }
            }
        }
        await AsyncStorage.setItem(TRACKER_KEY, JSON.stringify(history));
        if (merged > 0) {
            DeviceEventEmitter.emit('prayerLogged');
            // Refresh the widget so a drained widget-tap log doesn't leave
            // it showing the pre-tap "Log X" state until an unrelated
            // NightCalculator refresh happens to run.
            import('./widgetBridge').then(async m => {
                const times = await m.loadCachedPrayerTimes();
                if (times) await m.updateWidget(times);
            }).catch(() => {});
        }
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
