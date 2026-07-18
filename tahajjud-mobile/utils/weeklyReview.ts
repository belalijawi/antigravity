/**
 * Weekly in-app review prompt.
 *
 * Two paths:
 *  1. Native popup (requestReview) — SKStoreReviewController on iOS,
 *     Google Play In-App Review on Android. Both are throttled by the OS.
 *  2. Direct store link (openStoreReview) — always works, bypasses throttling.
 *     Used for the manual "Rate the App" button in Settings.
 *
 * Automatic rules:
 *  - At least 7 days since last prompt
 *  - User has logged at least 3 prayers total
 *  - expo-store-review must report the API as available
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as StoreReview from 'expo-store-review';
import { Platform, Linking } from 'react-native';

const LAST_PROMPTED_KEY  = 'review-weekly-last-v1';
const MIN_INTERVAL_MS    = 14 * 24 * 60 * 60 * 1000; // 14 days
const MIN_PRAYER_COUNT   = 3;

const APPLE_APP_ID       = '6759176533';
const ANDROID_PACKAGE    = 'com.tahajjudplus.app';

/** iOS: direct App Store write-review deep link */
const IOS_REVIEW_URL     = `itms-apps://apps.apple.com/app/id${APPLE_APP_ID}?action=write-review`;
const IOS_REVIEW_WEB_URL = `https://apps.apple.com/app/id${APPLE_APP_ID}?action=write-review`;

/** Android: Google Play listing — tapping "Rate this app" from here opens the in-app sheet */
const ANDROID_REVIEW_URL = `market://details?id=${ANDROID_PACKAGE}`;
const ANDROID_REVIEW_WEB = `https://play.google.com/store/apps/details?id=${ANDROID_PACKAGE}`;

/**
 * Opens the correct store page directly to leave a review.
 * Works on both iOS (App Store) and Android (Play Store), regardless of
 * how many times the native in-app dialog has been shown.
 */
export async function openStoreReview(): Promise<void> {
    import('./analytics').then(m => m.track('review_store_opened', { source: 'manual' })).catch(() => {});
    if (Platform.OS === 'android') {
        try {
            const canOpen = await Linking.canOpenURL(ANDROID_REVIEW_URL);
            await Linking.openURL(canOpen ? ANDROID_REVIEW_URL : ANDROID_REVIEW_WEB);
        } catch {
            await Linking.openURL(ANDROID_REVIEW_WEB).catch(() => {});
        }
    } else {
        try {
            const canOpen = await Linking.canOpenURL(IOS_REVIEW_URL);
            await Linking.openURL(canOpen ? IOS_REVIEW_URL : IOS_REVIEW_WEB_URL);
        } catch {
            await Linking.openURL(IOS_REVIEW_WEB_URL).catch(() => {});
        }
    }
}

/** @deprecated Use openStoreReview() — works on both iOS and Android. */
export const openAppStoreReview = openStoreReview;

/**
 * Review request at the emotional peak: fires when the user closes a streak
 * milestone celebration (7/30/100 nights). Someone who just completed a week
 * of Tahajjud is the most likely 5-star reviewer the app will ever meet —
 * far better timing than the old "any prayer log, every 14 days" trigger
 * (which converted 494 prompts into 10 store opens).
 */
export async function requestReviewAtMilestone(nights: number): Promise<void> {
    try {
        const available = await StoreReview.isAvailableAsync();
        if (!available) return;

        const raw = await AsyncStorage.getItem(LAST_PROMPTED_KEY);
        const lastShown = raw ? parseInt(raw, 10) : 0;
        if (Date.now() - lastShown < MIN_INTERVAL_MS) return;

        await StoreReview.requestReview();
        await AsyncStorage.setItem(LAST_PROMPTED_KEY, String(Date.now()));
        import('./analytics').then(m => m.track('review_prompt_shown', { trigger: 'streak_milestone', nights })).catch(() => {});
    } catch { /* never crash the app over a review prompt */ }
}

/**
 * Automatic weekly review prompt — shows the native in-app review dialog.
 * Retired as an automatic trigger (2026-07-14) in favour of the milestone
 * prompt above; kept for the manual Settings path compatibility.
 */
export async function maybeRequestWeeklyReview(totalPrayersLogged: number): Promise<void> {
    try {
        if (totalPrayersLogged < MIN_PRAYER_COUNT) return;

        const available = await StoreReview.isAvailableAsync();
        if (!available) return;

        const raw = await AsyncStorage.getItem(LAST_PROMPTED_KEY);
        const lastShown = raw ? parseInt(raw, 10) : 0;
        if (Date.now() - lastShown < MIN_INTERVAL_MS) return;

        await StoreReview.requestReview();
        // Save timestamp AFTER successful prompt — if requestReview throws,
        // the 7-day cooldown won't burn and we can retry next time
        await AsyncStorage.setItem(LAST_PROMPTED_KEY, String(Date.now()));

        // Note: the OS dialog itself is a black box — we can't know if the
        // user actually rated. This just tells us how often the prompt fires
        // and to whom (segmented by is_premium / app_version super properties).
        import('./analytics').then(m => m.track('review_prompt_shown', { totalPrayersLogged })).catch(() => {});
    } catch { /* never crash the app over a review prompt */ }
}
