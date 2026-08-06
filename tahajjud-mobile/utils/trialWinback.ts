/**
 * Cancellation win-back nudge — covers BOTH a cancelled free trial (never
 * charged) and a cancelled PAID subscription (converted, then cancelled
 * later). One nudge, one scheduling path: the same discount offer already
 * applies to both segments in-app (see trialWinbackEligible in
 * PurchasesContext.tsx, which has covered both since it started reading
 * from `.all` instead of just the active trial state), so the push that
 * drives people back to it shouldn't be narrower than the offer itself.
 *
 * Apple's Win-Back Offers require ≥1 month of PAID history, so they can never
 * reach someone who cancels during the free trial and is never charged (see
 * services/revenueCat.ts). For that segment (and, for consistency, the paid
 * one too) we use a Promotional Offer instead — Apple doesn't auto-surface
 * those, so the app has to decide both when to notify and when to show the
 * discount.
 *
 * Scheduling is driven entirely by RevenueCat's CustomerInfo, not by a guess
 * made at purchase time: PurchasesContext.updateTrialState() calls
 * scheduleTrialWinbackNudge(expiresAt) every time the entitlement is active
 * with auto-renew off — trial or paid — and cancelTrialWinbackNudge() the
 * moment that's no longer true (re-enabled, or fully lapsed already). That
 * self-corrects on every app open/CustomerInfo refresh, so the notification
 * always tracks the real expiration date and is never left dangling for
 * someone who's already paying.
 *
 * The copy deliberately doesn't name a specific discount percentage or
 * billing period — a monthly-plan cancellation and an annual-plan
 * cancellation get genuinely different discounts (see Paywall.tsx's
 * percentOff computation, which reads each user's own store pricing), and
 * this notification is scheduled well before the user reopens the app to
 * see the real number, so baking in a specific figure here risks it being
 * wrong by the time they actually see the paywall.
 */

import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { t } from './i18n';

const STORED_ID_KEY = 'trial-winback-nudge-id-v1';
// The expirationDate this notification was scheduled against — lets repeated
// calls with the same date no-op instead of cancel-and-reschedule every time.
const STORED_FOR_KEY = 'trial-winback-nudge-for-v1';

/** Schedule (or reschedule) the win-back nudge for one day after `expiresAt`. */
export async function scheduleTrialWinbackNudge(expiresAt: Date): Promise<void> {
    try {
        const { status } = await Notifications.getPermissionsAsync();
        if (status !== 'granted') return;

        const key = expiresAt.toISOString();
        const scheduledFor = await AsyncStorage.getItem(STORED_FOR_KEY);
        if (scheduledFor === key) return; // already scheduled for this exact expiration

        const fireDate = new Date(expiresAt.getTime() + 24 * 60 * 60 * 1000);
        if (fireDate.getTime() <= Date.now()) return; // expiration already passed — don't schedule into the past

        await cancelTrialWinbackNudge();

        const id = await Notifications.scheduleNotificationAsync({
            content: {
                title: t('trialWinback.title'),
                body: t('trialWinback.body'),
                sound: 'default',
                data: { type: 'trial_winback' },
            },
            trigger: {
                type: Notifications.SchedulableTriggerInputTypes.DATE,
                date: fireDate,
                // 'prayers_adhan' is the only prayer-related channel the app
                // still creates (see utils/notifications.ts) — the old
                // 'prayers' id is never created on a fresh install, so
                // pointing here at it left this notification on a channel
                // that may not exist.
                ...(Platform.OS === 'android' && { channelId: 'prayers_adhan' }),
            },
        });
        await AsyncStorage.setItem(STORED_ID_KEY, id);
        await AsyncStorage.setItem(STORED_FOR_KEY, key);
    } catch { /* never block the CustomerInfo refresh over a notification */ }
}

/** Cancel the pending nudge, if any (trial renewed, converted, or fully lapsed already). */
export async function cancelTrialWinbackNudge(): Promise<void> {
    try {
        const id = await AsyncStorage.getItem(STORED_ID_KEY);
        if (id) {
            await Notifications.cancelScheduledNotificationAsync(id).catch(() => {});
        }
        await AsyncStorage.removeItem(STORED_ID_KEY);
        await AsyncStorage.removeItem(STORED_FOR_KEY);
    } catch { /* ignore */ }
}
