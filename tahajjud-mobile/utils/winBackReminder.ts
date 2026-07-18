/**
 * Win-back reminder — brings back users who've gone quiet on Tahajjud.
 *
 * Two touchpoints, then silence, never a guilt trip:
 *  - 3 days after their last Tahajjud: a gentle nudge
 *  - 10 days after: one more, referencing their best streak
 *
 * Both are scheduled as one-time local notifications anchored to "last log
 * date + N days" — every time the user logs Tahajjud again, that anchor
 * moves forward and both get silently rescheduled further into the future,
 * so they only actually fire if the user really has gone quiet. No separate
 * "have I sent this already" tracking needed.
 *
 * Paused users (period/postpartum/illness/travel) are exempt — same
 * principle as the streak-at-risk reminder: there's no obligation to pray,
 * so nudging them to "come back" would be wrong.
 */

import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { t } from './i18n';

const STORED_ID_KEY_1 = 'winback-notif-id-1-v1';
const STORED_ID_KEY_2 = 'winback-notif-id-2-v1';
const DAY_MS = 24 * 60 * 60 * 1000;
const STAGE_1_DAYS = 3;
const STAGE_2_DAYS = 10;
const FIRE_HOUR = 20; // 8 PM local — evening, ahead of that night's Tahajjud window
const FIRE_MIN = 0;

async function cancelOne(key: string): Promise<void> {
    const id = await AsyncStorage.getItem(key);
    if (id) {
        await Notifications.cancelScheduledNotificationAsync(id).catch(() => {});
        await AsyncStorage.removeItem(key);
    }
}

/** Cancel both pending win-back reminders. */
export async function cancelWinBack(): Promise<void> {
    await Promise.all([cancelOne(STORED_ID_KEY_1), cancelOne(STORED_ID_KEY_2)]);
}

/**
 * Reschedule both touchpoints relative to the most recent Tahajjud log.
 * Call this alongside the streak-at-risk reminder, on every recalc — it's
 * idempotent and cheap; each call just cancels and re-arms both timers
 * against the current last-log date.
 */
export async function scheduleWinBack(tahajjudDates: string[], bestStreak: number, isPaused: boolean): Promise<void> {
    try {
        await cancelWinBack();
        if (isPaused) return; // no obligation to pray right now — don't nudge
        if (tahajjudDates.length === 0) return; // never prayed — a different flow (activation), not win-back

        const { status } = await Notifications.getPermissionsAsync();
        if (status !== 'granted') return;

        const lastMs = tahajjudDates.reduce((max, d) => {
            const ms = new Date(d).getTime();
            return ms > max ? ms : max;
        }, 0);

        const stage1Fire = new Date(lastMs + STAGE_1_DAYS * DAY_MS);
        stage1Fire.setHours(FIRE_HOUR, FIRE_MIN, 0, 0);
        if (stage1Fire.getTime() > Date.now()) {
            const id1 = await Notifications.scheduleNotificationAsync({
                content: {
                    title: t('winBack.stage1Title'),
                    body: t('winBack.stage1Body'),
                    sound: 'default',
                    data: { type: 'winback_1' },
                },
                trigger: {
                    type: Notifications.SchedulableTriggerInputTypes.DATE,
                    date: stage1Fire,
                    ...(Platform.OS === 'android' && { channelId: 'prayers' }),
                },
            });
            await AsyncStorage.setItem(STORED_ID_KEY_1, id1);
        }

        const stage2Fire = new Date(lastMs + STAGE_2_DAYS * DAY_MS);
        stage2Fire.setHours(FIRE_HOUR, FIRE_MIN, 0, 0);
        if (stage2Fire.getTime() > Date.now()) {
            // Only reference the streak if it's actually compelling — "you
            // once reached a 1-night streak" doesn't entice anyone back.
            const body = bestStreak >= 3
                ? t('winBack.stage2Body', { streak: bestStreak })
                : t('winBack.stage2BodyGeneric');
            const id2 = await Notifications.scheduleNotificationAsync({
                content: {
                    title: t('winBack.stage2Title'),
                    body,
                    sound: 'default',
                    data: { type: 'winback_2' },
                },
                trigger: {
                    type: Notifications.SchedulableTriggerInputTypes.DATE,
                    date: stage2Fire,
                    ...(Platform.OS === 'android' && { channelId: 'prayers' }),
                },
            });
            await AsyncStorage.setItem(STORED_ID_KEY_2, id2);
        }
    } catch { /* never block on a reminder */ }
}
