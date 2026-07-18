/**
 * Notification permission re-ask.
 *
 * If a user denies (or was never asked for) notification permission during
 * onboarding, every reminder feature in the app (streak-at-risk, weekly
 * digest, win-back, morning-after) is silently useless for them — and on
 * iOS, re-calling the request API after an explicit denial just returns
 * 'denied' again without showing the native dialog, so onboarding is the
 * ONLY unconditional chance unless we ask again deliberately.
 *
 * We re-ask exactly once, at a high-motivation moment: after the user has
 * logged 3 Tahajjud nights (the "early-riser" milestone) — real engagement,
 * not a cold ask on day one. Shown only if notifications are NOT already
 * granted; never repeated regardless of the outcome.
 */

import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SHOWN_KEY = 'notification-reask-shown-v1';
const TRACKER_KEY = 'prayer-tracker-v2';
const MIN_TAHAJJUD_COUNT = 3;

/** Current permission status, check-only — never prompts. */
export async function getNotificationPermissionStatus(): Promise<Notifications.PermissionStatus> {
    const { status } = await Notifications.getPermissionsAsync();
    return status;
}

async function getTahajjudCount(): Promise<number> {
    try {
        const raw = await AsyncStorage.getItem(TRACKER_KEY);
        const history = raw ? JSON.parse(raw) : null;
        return (history?.tahajjud?.length ?? 0) as number;
    } catch {
        return 0;
    }
}

/** Should the re-ask prompt show right now? */
export async function shouldShowNotificationReAsk(): Promise<boolean> {
    try {
        const alreadyShown = await AsyncStorage.getItem(SHOWN_KEY);
        if (alreadyShown) return false;

        const status = await getNotificationPermissionStatus();
        if (status === 'granted') return false;

        const tahajjudCount = await getTahajjudCount();
        return tahajjudCount >= MIN_TAHAJJUD_COUNT;
    } catch {
        return false;
    }
}

/** Nights of Tahajjud logged so far — used to personalize the re-ask copy. */
export async function getNotificationReAskCount(): Promise<number> {
    return getTahajjudCount();
}

/** Mark the prompt as shown — never ask again regardless of the outcome. */
export async function markNotificationReAskShown(): Promise<void> {
    try { await AsyncStorage.setItem(SHOWN_KEY, 'true'); } catch { /* ignore */ }
}
