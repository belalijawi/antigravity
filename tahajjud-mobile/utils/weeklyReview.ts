/**
 * Weekly in-app review prompt.
 *
 * Two paths:
 *  1. Native popup (requestReview) — Apple's SKStoreReviewController.
 *     Fires at most 3x/year per user (Apple's limit). Submits rating directly.
 *  2. Direct App Store link (openAppStoreReview) — always works, bypasses
 *     Apple's throttle. Used for the manual "Rate the App" button in Settings.
 *
 * Automatic rules:
 *  - At least 7 days since last prompt
 *  - User has logged at least 3 prayers total
 *  - iOS only
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as StoreReview from 'expo-store-review';
import { Platform, Linking } from 'react-native';

const LAST_PROMPTED_KEY  = 'review-weekly-last-v1';
const MIN_INTERVAL_MS    = 7 * 24 * 60 * 60 * 1000; // 7 days
const MIN_PRAYER_COUNT   = 3;
const ITUNES_ITEM_ID     = '6759176533';

/** Direct App Store write-review URL — always works, bypasses Apple's throttle. */
export const APP_STORE_REVIEW_URL =
    `itms-apps://apps.apple.com/app/id${ITUNES_ITEM_ID}?action=write-review`;

/** Fallback web URL if the App Store deep link fails. */
const APP_STORE_WEB_URL =
    `https://apps.apple.com/app/id${ITUNES_ITEM_ID}?action=write-review`;

/**
 * Opens the App Store directly to the Write a Review page.
 * Use this for the manual "Rate the App" button — always works regardless
 * of how many times Apple has shown the native popup.
 */
export async function openAppStoreReview(): Promise<void> {
    try {
        const canOpen = await Linking.canOpenURL(APP_STORE_REVIEW_URL);
        if (canOpen) {
            await Linking.openURL(APP_STORE_REVIEW_URL);
        } else {
            await Linking.openURL(APP_STORE_WEB_URL);
        }
    } catch {
        // Last resort fallback
        await Linking.openURL(APP_STORE_WEB_URL).catch(() => {});
    }
}

/**
 * Automatic weekly review prompt — shows Apple's native star-rating dialog.
 * Called after every prayer log. Fires at most once per 7 days.
 * Apple further limits this to 3x per year per device — use openAppStoreReview
 * for a guaranteed path.
 */
export async function maybeRequestWeeklyReview(totalPrayersLogged: number): Promise<void> {
    try {
        if (Platform.OS !== 'ios') return;
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
    } catch { /* never crash the app over a review prompt */ }
}
