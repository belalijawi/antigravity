import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { TahajjudJournal } from './tahajjudJournal';
import { subDays } from 'date-fns';
import { localDateStr } from './localDate';

// Inlined to avoid the Tracker.tsx → weeklyDigest.ts → Tracker.tsx cycle.
// Same logic as `calculateStreak` in components/Tracker.tsx.
type PrayerHistory = Record<string, string[]>;
function emptyHistory(): PrayerHistory {
    return { fajr: [], dhuhr: [], asr: [], maghrib: [], isha: [], tahajjud: [] };
}
function calculateStreak(dates: string[]): number {
    if (dates.length === 0) return 0;
    const today = localDateStr(new Date());
    const ydayDate = new Date();
    ydayDate.setDate(ydayDate.getDate() - 1);
    const yesterday = localDateStr(ydayDate);
    const has = (s: string) => dates.some(d => localDateStr(d) === s);
    const hasToday = has(today);
    const hasYesterday = has(yesterday);
    if (!hasToday && !hasYesterday) return 0;
    let count = 0;
    let check = hasToday ? new Date() : ydayDate;
    while (true) {
        const str = localDateStr(check);
        if (!has(str)) break;
        count++;
        check.setDate(check.getDate() - 1);
    }
    return count;
}

/**
 * Weekly digest — fires every Friday at 09:00 local time with a summary of
 * the user's Tahajjud week. Pulls counts from the prayer tracker and journal
 * directly so the message is fresh at delivery time.
 *
 * Scheduling uses Expo's calendar trigger so it auto-repeats. We persist the
 * scheduled ID so we can cancel cleanly if the user disables it.
 */

const TRACKER_KEY = 'prayer-tracker-v2';
const DIGEST_NOTIF_ID_KEY = 'weekly-digest-notif-id';
const DIGEST_ENABLED_KEY = 'weekly-digest-enabled';

export async function getWeeklyDigestEnabled(): Promise<boolean> {
    const v = await AsyncStorage.getItem(DIGEST_ENABLED_KEY);
    return v === null ? true : v === 'true'; // default ON
}

export async function setWeeklyDigestEnabled(enabled: boolean): Promise<void> {
    await AsyncStorage.setItem(DIGEST_ENABLED_KEY, enabled ? 'true' : 'false');
    if (enabled) await scheduleWeeklyDigest();
    else await cancelWeeklyDigest();
}

/**
 * Computes the digest body for the past 7 days. Done at schedule time so the
 * message reflects the week leading up to the notification.
 */
export async function buildDigestMessage(): Promise<{ title: string; body: string }> {
    try {
        const raw = await AsyncStorage.getItem(TRACKER_KEY);
        const history: PrayerHistory = raw ? { ...emptyHistory(), ...JSON.parse(raw) } : emptyHistory();

        // Count Tahajjud nights in past 7 days
        const today = new Date();
        const last7 = new Set<string>();
        for (let i = 0; i < 7; i++) {
            last7.add(localDateStr(subDays(today, i)));
        }
        const nightsThisWeek = history.tahajjud
            .map(d => localDateStr(d))
            .filter(d => last7.has(d)).length;

        const streak = calculateStreak(history.tahajjud);
        const journalEntries = await TahajjudJournal.getAll();
        const journalCount = journalEntries.filter(e => last7.has(e.date)).length;

        // Tone the message based on the week's outcome
        let title: string;
        let body: string;

        if (nightsThisWeek === 0) {
            title = 'A new week begins';
            body = `This week is yours. The Lord descends every night — return when you can.`;
        } else if (nightsThisWeek >= 5) {
            title = `MashaAllah — ${nightsThisWeek} nights this week`;
            body = `Streak: ${streak} day${streak === 1 ? '' : 's'}. ${journalCount} reflection${journalCount === 1 ? '' : 's'} written. Keep going.`;
        } else {
            title = `${nightsThisWeek} Tahajjud night${nightsThisWeek === 1 ? '' : 's'} this week`;
            body = `Streak: ${streak} day${streak === 1 ? '' : 's'}. Tonight, the door is open again.`;
        }
        return { title, body };
    } catch {
        return {
            title: 'Your week in Tahajjud',
            body: 'Open the app to see your reflections.',
        };
    }
}

/** Schedules — or re-schedules — the recurring Friday 9am notification. */
export async function scheduleWeeklyDigest(): Promise<void> {
    await cancelWeeklyDigest(); // clear any existing schedule first

    // Build message NOW (Expo doesn't support dynamic content at fire time on iOS).
    // The user will see this week's stats next Friday — close enough for a digest.
    const { title, body } = await buildDigestMessage();

    const id = await Notifications.scheduleNotificationAsync({
        content: { title, body, sound: 'default' },
        // Friday = 6 in iOS Calendar Trigger (Sunday = 1, Saturday = 7)
        trigger: {
            type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
            weekday: 6,
            hour: 9,
            minute: 0,
        } as any,
    });

    await AsyncStorage.setItem(DIGEST_NOTIF_ID_KEY, id);
}

export async function cancelWeeklyDigest(): Promise<void> {
    const id = await AsyncStorage.getItem(DIGEST_NOTIF_ID_KEY);
    if (id) {
        await Notifications.cancelScheduledNotificationAsync(id).catch(() => {});
        await AsyncStorage.removeItem(DIGEST_NOTIF_ID_KEY);
    }
}

/**
 * Refresh the digest schedule — call after every Tahajjud log so the
 * message text incorporates the latest activity. Cheap.
 */
export async function refreshWeeklyDigest(): Promise<void> {
    const enabled = await getWeeklyDigestEnabled();
    if (enabled) await scheduleWeeklyDigest();
}
