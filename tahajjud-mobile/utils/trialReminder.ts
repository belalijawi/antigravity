/**
 * Trial-ending reminder.
 *
 * When a user starts a free trial we schedule a local notification to fire
 * 2 days before it ends, so they're never charged by surprise. This makes the
 * "we'll remind you" promise on the paywall genuinely true — which removes the
 * #1 fear that stops people starting trials.
 *
 * Only schedules for free-trial packages (not lifetime / direct purchases).
 */

import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const STORED_ID_KEY = 'trial-reminder-id-v1';

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

        const id = await Notifications.scheduleNotificationAsync({
            content: {
                title: 'Your Tahajjud+ trial ends soon',
                body: `Your free trial ends in ${remindDaysBefore} days. Loving it? Do nothing. Not for you? Cancel anytime in Settings — no charge.`,
                sound: 'default',
                data: { type: 'trial_reminder' },
            },
            trigger: {
                type: Notifications.SchedulableTriggerInputTypes.DATE,
                date: fireDate,
                ...(Platform.OS === 'android' && { channelId: 'prayers' }),
            },
        });

        await AsyncStorage.setItem(STORED_ID_KEY, id);
    } catch { /* never block the purchase flow */ }
}

/** Cancel the scheduled trial reminder (e.g. user upgraded to lifetime, or cancelled). */
export async function cancelTrialEndingReminder(): Promise<void> {
    try {
        const id = await AsyncStorage.getItem(STORED_ID_KEY);
        if (id) {
            await Notifications.cancelScheduledNotificationAsync(id).catch(() => {});
            await AsyncStorage.removeItem(STORED_ID_KEY);
        }
    } catch { /* ignore */ }
}
