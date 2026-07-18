/**
 * Trial-ending reminder.
 *
 * When a user starts a free trial we schedule a local notification to fire
 * 2 days before it ends, so they're never charged by surprise. This makes the
 * "we'll remind you" promise on the paywall genuinely true — which removes the
 * #1 fear that stops people starting trials.
 *
 * The body is re-personalized on later app opens (refreshTrialReminder) with
 * the user's actual nights-prayed count — "you've prayed 4 nights this week"
 * sells the subscription far better than a bare expiry warning.
 *
 * Only schedules for free-trial packages (not lifetime / direct purchases).
 */

import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { t } from './i18n';

const STORED_ID_KEY = 'trial-reminder-id-v1';
// Fire date + trial start + cadence, stored so the reminder body can be
// re-personalized on later app opens without moving its fire time.
const STORED_META_KEY = 'trial-reminder-meta-v1';

/** Count Tahajjud nights logged since the trial started. */
async function nightsPrayedSince(sinceMs: number): Promise<number> {
    try {
        const raw = await AsyncStorage.getItem('prayer-tracker-v2');
        if (!raw) return 0;
        const logs: string[] = JSON.parse(raw)?.tahajjud ?? [];
        return logs.filter((d) => new Date(d).getTime() >= sinceMs).length;
    } catch { return 0; }
}

function reminderBody(remindDaysBefore: number, nights: number): string {
    const value = nights >= 2 ? t('trialRem.value', { n: nights }) : '';
    return value + t('trialRem.base', { d: remindDaysBefore });
}

async function scheduleAt(fireDate: Date, remindDaysBefore: number, nights: number): Promise<string> {
    return Notifications.scheduleNotificationAsync({
        content: {
            title: t('trialRem.title'),
            body: reminderBody(remindDaysBefore, nights),
            sound: 'default',
            data: { type: 'trial_reminder' },
        },
        trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DATE,
            date: fireDate,
            ...(Platform.OS === 'android' && { channelId: 'prayers' }),
        },
    });
}

/**
 * Schedule a reminder to fire `remindDaysBefore` days before the trial ends.
 * @param trialDays   length of the free trial (e.g. 7)
 * @param remindDaysBefore  how many days before the end to remind (default 2)
 */
export async function scheduleTrialEndingReminder(
    trialDays: number,
    remindDaysBefore = 2,
): Promise<void> {
    try {
        const { status } = await Notifications.getPermissionsAsync();
        if (status !== 'granted') return;

        // Cancel any previous trial reminder first
        await cancelTrialEndingReminder();

        const daysUntilReminder = Math.max(trialDays - remindDaysBefore, 0);
        const fireDate = new Date();
        fireDate.setDate(fireDate.getDate() + daysUntilReminder);
        fireDate.setHours(11, 0, 0, 0); // mid-morning, a calm time

        // If that time has already passed today (edge: 0-day trial), push to +1h
        if (fireDate.getTime() <= Date.now()) {
            fireDate.setTime(Date.now() + 60 * 60 * 1000);
        }

        const id = await scheduleAt(fireDate, remindDaysBefore, 0);
        await AsyncStorage.setItem(STORED_ID_KEY, id);
        await AsyncStorage.setItem(STORED_META_KEY, JSON.stringify({
            fireAt: fireDate.getTime(),
            trialStartedAt: Date.now(),
            remindDaysBefore,
        }));
    } catch { /* never block the purchase flow */ }
}

/**
 * Re-personalize the pending reminder's body with the current nights-prayed
 * count. Call on app launch — cheap no-op when no reminder is pending.
 * Fire time never changes; only the message text is refreshed.
 */
export async function refreshTrialReminder(): Promise<void> {
    try {
        const [id, metaRaw] = await Promise.all([
            AsyncStorage.getItem(STORED_ID_KEY),
            AsyncStorage.getItem(STORED_META_KEY),
        ]);
        if (!id || !metaRaw) return;
        const meta = JSON.parse(metaRaw);
        if (!meta?.fireAt || meta.fireAt <= Date.now()) return; // already fired

        const nights = await nightsPrayedSince(meta.trialStartedAt ?? 0);
        if (nights < 2) return; // nothing better to say yet — keep current text

        await Notifications.cancelScheduledNotificationAsync(id).catch(() => {});
        const newId = await scheduleAt(new Date(meta.fireAt), meta.remindDaysBefore ?? 2, nights);
        await AsyncStorage.setItem(STORED_ID_KEY, newId);
    } catch { /* ignore — reminder keeps its previous text */ }
}

/** Cancel the scheduled trial reminder (e.g. user upgraded to lifetime, or cancelled). */
export async function cancelTrialEndingReminder(): Promise<void> {
    try {
        const id = await AsyncStorage.getItem(STORED_ID_KEY);
        if (id) {
            await Notifications.cancelScheduledNotificationAsync(id).catch(() => {});
            await AsyncStorage.removeItem(STORED_ID_KEY);
            await AsyncStorage.removeItem(STORED_META_KEY);
        }
    } catch { /* ignore */ }
}
