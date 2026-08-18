/**
 * Proactive nudge for lapsed PAID subscribers, timed to land inside Apple's/
 * Google's native win-back eligibility window — separate from
 * utils/trialWinback.ts (which fires immediately and promotes the app's own
 * Promotional Offer) and utils/winBackReminder.ts (activity-based "haven't
 * prayed" nudge, unrelated to subscription state).
 *
 * Apple's native win-back offer requires at least 1 month since the
 * subscription ended before it can ever be eligible (see
 * customerEligibilityTimeSinceLastSubscribedInMonths on the App Store
 * Connect offer) — a notification any earlier would just point someone at a
 * paywall with nothing to show. Two touchpoints, both past that minimum:
 *  - ~35 days after expiration (a few days' buffer past the 1-month floor)
 *  - ~90 days after, for anyone who missed or ignored the first
 *
 * Only scheduled for a PAID cancellation (isLapsingPaid in
 * PurchasesContext), not a trial cancellation — a trial-only lapse has no
 * paid history and can never be native-win-back eligible, so nudging that
 * segment here would just be noise on top of the trial-cancel nudge they
 * already get.
 */

import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { t } from './i18n';

const STORED_ID_KEY_1 = 'native-winback-notif-id-1-v1';
const STORED_ID_KEY_2 = 'native-winback-notif-id-2-v1';
const STORED_FOR_KEY = 'native-winback-notif-for-v1';
const DAY_MS = 24 * 60 * 60 * 1000;
const STAGE_1_DAYS = 35;
const STAGE_2_DAYS = 90;

async function cancelOne(key: string): Promise<void> {
    const id = await AsyncStorage.getItem(key);
    if (id) {
        await Notifications.cancelScheduledNotificationAsync(id).catch(() => {});
        await AsyncStorage.removeItem(key);
    }
}

/** Cancel both pending touchpoints (resubscribed, or lapse state no longer current). */
export async function cancelNativeWinbackReminder(): Promise<void> {
    await Promise.all([cancelOne(STORED_ID_KEY_1), cancelOne(STORED_ID_KEY_2)]);
    await AsyncStorage.removeItem(STORED_FOR_KEY);
}

/**
 * Schedule (or reschedule) both touchpoints relative to `expiresAt` — the
 * paid subscription's expiration date. Idempotent: a repeated call with the
 * same date no-ops instead of cancel-and-reschedule every time, same
 * pattern as scheduleTrialWinbackNudge.
 */
export async function scheduleNativeWinbackReminder(expiresAt: Date): Promise<void> {
    try {
        const { status } = await Notifications.getPermissionsAsync();
        if (status !== 'granted') return;

        const key = expiresAt.toISOString();
        const scheduledFor = await AsyncStorage.getItem(STORED_FOR_KEY);
        if (scheduledFor === key) return;

        await cancelNativeWinbackReminder();

        const stage1Fire = new Date(expiresAt.getTime() + STAGE_1_DAYS * DAY_MS);
        if (stage1Fire.getTime() > Date.now()) {
            const id1 = await Notifications.scheduleNotificationAsync({
                content: {
                    title: t('trialWinback.title'),
                    body: t('trialWinback.body'),
                    sound: 'default',
                    data: { type: 'sub_winback_1' },
                },
                trigger: {
                    type: Notifications.SchedulableTriggerInputTypes.DATE,
                    date: stage1Fire,
                    ...(Platform.OS === 'android' && { channelId: 'prayers_adhan' }),
                },
            });
            await AsyncStorage.setItem(STORED_ID_KEY_1, id1);
        }

        const stage2Fire = new Date(expiresAt.getTime() + STAGE_2_DAYS * DAY_MS);
        if (stage2Fire.getTime() > Date.now()) {
            const id2 = await Notifications.scheduleNotificationAsync({
                content: {
                    title: t('trialWinback.title'),
                    body: t('trialWinback.body'),
                    sound: 'default',
                    data: { type: 'sub_winback_2' },
                },
                trigger: {
                    type: Notifications.SchedulableTriggerInputTypes.DATE,
                    date: stage2Fire,
                    ...(Platform.OS === 'android' && { channelId: 'prayers_adhan' }),
                },
            });
            await AsyncStorage.setItem(STORED_ID_KEY_2, id2);
        }

        await AsyncStorage.setItem(STORED_FOR_KEY, key);
    } catch { /* never block the CustomerInfo refresh over a reminder */ }
}
