/**
 * Paywall scheduler — decides when to proactively show the paywall to free users.
 *
 * The problem it solves: most paywall triggers are reactive (user taps a locked
 * feature). A casual user who never taps one only sees the paywall once, during
 * onboarding. This re-surfaces it on a gentle weekly cadence so engaged free
 * users are reminded of premium without being spammed.
 *
 * Rules:
 *  - Never on the user's first few sessions (let them fall in love with the app)
 *  - At most once every 7 days
 *  - Never twice in the same session
 *  - Caller is responsible for the isPremium check (we don't import that here)
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const OPEN_COUNT_KEY = 'app-open-count-v1';
const LAST_SHOWN_KEY = 'paywall-weekly-last-v1';

const MIN_OPENS_BEFORE_FIRST = 3;             // let them use it a few times first
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

let shownThisSession = false;

/** Call once per app launch to track engagement. Returns the new open count. */
export async function recordAppOpen(): Promise<number> {
    try {
        const raw = await AsyncStorage.getItem(OPEN_COUNT_KEY);
        const count = (raw ? parseInt(raw, 10) : 0) + 1;
        await AsyncStorage.setItem(OPEN_COUNT_KEY, String(count));
        return count;
    } catch {
        return 0;
    }
}

/**
 * Returns true if the weekly paywall should be shown right now.
 * Caller should already have confirmed the user is NOT premium.
 */
export async function shouldShowWeeklyPaywall(): Promise<boolean> {
    try {
        if (shownThisSession) return false;

        const [openRaw, lastRaw] = await Promise.all([
            AsyncStorage.getItem(OPEN_COUNT_KEY),
            AsyncStorage.getItem(LAST_SHOWN_KEY),
        ]);

        const opens = openRaw ? parseInt(openRaw, 10) : 0;
        if (opens < MIN_OPENS_BEFORE_FIRST) return false;

        const last = lastRaw ? parseInt(lastRaw, 10) : 0;
        if (Date.now() - last < WEEK_MS) return false;

        return true;
    } catch {
        return false;
    }
}

/** Mark the weekly paywall as shown (call right after showing it). */
export async function markWeeklyPaywallShown(): Promise<void> {
    shownThisSession = true;
    try {
        await AsyncStorage.setItem(LAST_SHOWN_KEY, String(Date.now()));
    } catch { /* ignore */ }
}
