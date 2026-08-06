/**
 * Background-safe prayer logging — the subset of components/Tracker.tsx's
 * logPrayer() that's safe to run with no screen to show UI on (a notification
 * action tap, or a pending log drained from a widget tap).
 *
 * Deliberately skips: the achievement Alert popups and the milestone
 * celebration modal. Those unlocks still get recorded (checkAchievements
 * still runs), they just aren't celebrated at this exact instant — there's
 * nowhere to show them from a background action.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DeviceEventEmitter } from 'react-native';
import { localDateStr } from './localDate';
import { track } from './analytics';
import { checkAchievements } from './achievements';
import { AccountabilityPartner } from './accountabilityPartner';
import { logTahajjudToMap } from './tahajjudMap';
import { TahajjudChallenge } from './tahajjudChallenge';
import { refreshWeeklyDigest } from './weeklyDigest';

const TRACKER_KEY = 'prayer-tracker-v2';

export type PrayerKey = 'fajr' | 'dhuhr' | 'asr' | 'maghrib' | 'isha' | 'tahajjud';

type PrayerHistory = Record<PrayerKey, string[]>;

function emptyHistory(): PrayerHistory {
    return { fajr: [], dhuhr: [], asr: [], maghrib: [], isha: [], tahajjud: [] };
}

/**
 * Logs `key` for today if not already logged. Returns true if a new log was
 * written, false if it was already logged (or the write failed).
 */
export async function quickLogPrayer(key: PrayerKey, source: 'notification' | 'widget'): Promise<boolean> {
    let history: PrayerHistory;
    try {
        const raw = await AsyncStorage.getItem(TRACKER_KEY);
        history = raw ? { ...emptyHistory(), ...JSON.parse(raw) } : emptyHistory();
    } catch {
        return false;
    }

    const today = localDateStr(new Date());
    const alreadyLoggedToday = history[key].some(d => localDateStr(d) === today);
    if (alreadyLoggedToday) return false;

    const updated: PrayerHistory = { ...history, [key]: [...history[key], new Date().toISOString()] };
    try {
        await AsyncStorage.setItem(TRACKER_KEY, JSON.stringify(updated));
    } catch {
        return false;
    }

    track('prayer_logged', { prayer: key, source });

    if (key === 'tahajjud') {
        checkAchievements('prayer', updated.tahajjud.length).catch(() => {});
        AccountabilityPartner.logTahajjudForPartner().catch(() => {});
        import('./streakReminder').then(m => m.cancelStreakAtRisk()).catch(() => {});
        logTahajjudToMap().catch(() => {});
        refreshWeeklyDigest().catch(() => {});
        TahajjudChallenge.recordTahajjudToday().catch(() => {});
        import('./liveActivity').then(m => m.LiveActivity.endAll()).catch(() => {});
        // Leaderboard: one Tahajjud night = +1 (alreadyLoggedToday above
        // guards this to at most once per day). This was the actual gap a
        // user reported as "Tahajjud not tracked properly on the
        // leaderboard" — logging via the widget or a notification tap goes
        // through THIS function, not Tracker.tsx's logPrayer(), and every
        // other side effect here was already mirrored except this one.
        import('./leaderboard').then(m => m.Leaderboard.syncDelta('tahajjud', 1)).catch(() => {});
    }
    DeviceEventEmitter.emit('prayerLogged');

    // Refresh the home-screen widget so its "Log X" button and streak
    // reflect this log immediately, instead of staying stale until some
    // unrelated NightCalculator refresh happens to run.
    import('./widgetBridge').then(async m => {
        const times = await m.loadCachedPrayerTimes();
        if (times) await m.updateWidget(times);
    }).catch(() => {});

    return true;
}
