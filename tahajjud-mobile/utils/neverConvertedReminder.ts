/**
 * Proactive nudge for the engaged-but-never-subscribed segment (see
 * neverConvertedOffer.ts's eligibility rule) — previously this offer was
 * purely passive, only ever surfaced via a Home banner, Settings button, or
 * a paywall the user happened to open on their own. Anyone who qualified
 * without reopening the app right at that moment could go a long time
 * before ever seeing it.
 *
 * Two touchpoints, both fired relative to the moment eligibility is first
 * confirmed (not a subscription-expiration date — this segment never had
 * one):
 *  - shortly after first becoming eligible
 *  - a follow-up ~5 days later, for anyone who hasn't converted yet
 *
 * Scheduled once per device, ever — eligibility here doesn't have a
 * meaningful "changed date" to re-key off of the way a cancellation does,
 * so a simple one-time flag (not the cancel+reschedule pattern used
 * elsewhere) is enough.
 */

import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { t } from './i18n';

const STORED_ID_KEY_1 = 'never-converted-notif-id-1-v1';
const STORED_ID_KEY_2 = 'never-converted-notif-id-2-v1';
const SCHEDULED_KEY = 'never-converted-notif-scheduled-v1';
const DAY_MS = 24 * 60 * 60 * 1000;
const STAGE_1_DELAY_MS = 5 * 60 * 1000; // 5 minutes — near-immediate without firing mid-tap
const STAGE_2_DAYS = 5;

/** Cancel both pending touchpoints (e.g. the user converted before either fired). */
export async function cancelNeverConvertedReminder(): Promise<void> {
    for (const key of [STORED_ID_KEY_1, STORED_ID_KEY_2]) {
        const id = await AsyncStorage.getItem(key);
        if (id) {
            await Notifications.cancelScheduledNotificationAsync(id).catch(() => {});
            await AsyncStorage.removeItem(key);
        }
    }
}

/**
 * Call once, the moment neverConvertedOfferEligible first becomes true (and
 * the device isn't in the measurement holdout). No-ops on every subsequent
 * call — this only ever needs to schedule once per device.
 */
export async function scheduleNeverConvertedReminder(): Promise<void> {
    try {
        const already = await AsyncStorage.getItem(SCHEDULED_KEY);
        if (already) return;

        const { status } = await Notifications.getPermissionsAsync();
        if (status !== 'granted') return;

        await AsyncStorage.setItem(SCHEDULED_KEY, 'true');

        const id1 = await Notifications.scheduleNotificationAsync({
            content: {
                title: t('neverConvertedBanner.title'),
                body: t('neverConvertedBanner.body'),
                sound: 'default',
                data: { type: 'never_converted_1' },
            },
            trigger: {
                type: Notifications.SchedulableTriggerInputTypes.DATE,
                date: new Date(Date.now() + STAGE_1_DELAY_MS),
                ...(Platform.OS === 'android' && { channelId: 'prayers_adhan' }),
            },
        });
        await AsyncStorage.setItem(STORED_ID_KEY_1, id1);

        const id2 = await Notifications.scheduleNotificationAsync({
            content: {
                title: t('trialWinback.title'),
                body: t('trialWinback.body'),
                sound: 'default',
                data: { type: 'never_converted_2' },
            },
            trigger: {
                type: Notifications.SchedulableTriggerInputTypes.DATE,
                date: new Date(Date.now() + STAGE_2_DAYS * DAY_MS),
                ...(Platform.OS === 'android' && { channelId: 'prayers_adhan' }),
            },
        });
        await AsyncStorage.setItem(STORED_ID_KEY_2, id2);
    } catch { /* never block on a reminder */ }
}
