/**
 * Streak-at-risk reminder.
 *
 * If the user has an active Tahajjud streak and hasn't prayed yet tonight, we
 * remind them in the evening so they don't break it. Loss aversion is the
 * strongest retention lever — nobody wants to lose a streak they've built.
 *
 * - Fires at 9:30 PM (before sleep, ahead of the last third)
 * - Only when streak >= 2 (a streak worth protecting)
 * - Cancelled the moment they log Tahajjud
 * - Rescheduled each day as the streak is recalculated
 */

import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { t } from './i18n';

const STORED_ID_KEY = 'streak-risk-notif-id-v1';
const MIN_STREAK = 2;
const REMIND_HOUR = 21;   // 9 PM
const REMIND_MIN = 30;

/**
 * Schedule (or refresh) the at-risk reminder for tonight.
 * Call after recalculating the streak when today's Tahajjud is NOT yet logged.
 */
export async function scheduleStreakAtRisk(streak: number): Promise<void> {
    try {
        // Always clear any previous one first so we never stack duplicates
        await cancelStreakAtRisk();
        if (streak < MIN_STREAK) return;

        const { status } = await Notifications.getPermissionsAsync();
        if (status !== 'granted') return;

        const fire = new Date();
        fire.setHours(REMIND_HOUR, REMIND_MIN, 0, 0);
        // If it's already past the reminder time tonight, don't fire at all
        // (the Tahajjud window is imminent; the normal alarm covers it).
        if (fire.getTime() <= Date.now()) return;

        const id = await Notifications.scheduleNotificationAsync({
            content: {
                title: t('streakRisk.title', { n: streak }),
                body: t('streakRisk.body', { n: streak }),
                sound: 'default',
                data: { type: 'streak_at_risk' },
            },
            trigger: {
                type: Notifications.SchedulableTriggerInputTypes.DATE,
                date: fire,
                ...(Platform.OS === 'android' && { channelId: 'prayers' }),
            },
        });
        await AsyncStorage.setItem(STORED_ID_KEY, id);
    } catch { /* never block on a reminder */ }
}

/** Cancel tonight's at-risk reminder — call when the user logs Tahajjud. */
export async function cancelStreakAtRisk(): Promise<void> {
    try {
        const id = await AsyncStorage.getItem(STORED_ID_KEY);
        if (id) {
            await Notifications.cancelScheduledNotificationAsync(id).catch(() => {});
            await AsyncStorage.removeItem(STORED_ID_KEY);
        }
    } catch { /* ignore */ }
}
