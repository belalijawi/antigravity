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

const OPEN_COUNT_KEY        = 'app-open-count-v1';
const COFFEE_LAST_SHOWN_KEY = 'coffee-prompt-last-v1';

const COFFEE_MS = 10 * 24 * 60 * 60 * 1000; // coffee cadence: every 10 days

const MIN_OPENS_BEFORE_FIRST = 3;             // let them use it a few times first
let coffeeShownThisSession = false;

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

// NOTE: the scheduled free-user paywall ("weekly paywall" / scheduled_5day)
// was retired 2026-07-14 — 60% of paywall impressions at 0.7% conversion vs
// 2% for feature gates. Contextual gates are now the only paywall triggers.

/**
 * Returns true if the coffee/support prompt should be shown right now.
 * Shown to premium users (who won't see the paywall) on a 10-day cadence.
 * Caller should already have confirmed the user IS premium.
 */
export async function shouldShowCoffeePrompt(): Promise<boolean> {
    try {
        if (coffeeShownThisSession) return false;

        const [openRaw, lastRaw] = await Promise.all([
            AsyncStorage.getItem(OPEN_COUNT_KEY),
            AsyncStorage.getItem(COFFEE_LAST_SHOWN_KEY),
        ]);

        const opens = openRaw ? parseInt(openRaw, 10) : 0;
        if (opens < MIN_OPENS_BEFORE_FIRST) return false;

        const last = lastRaw ? parseInt(lastRaw, 10) : 0;
        if (Date.now() - last < COFFEE_MS) return false;

        return true;
    } catch {
        return false;
    }
}

/** Mark the coffee prompt as shown (call right after showing it). */
export async function markCoffeePromptShown(): Promise<void> {
    coffeeShownThisSession = true;
    try {
        await AsyncStorage.setItem(COFFEE_LAST_SHOWN_KEY, String(Date.now()));
    } catch { /* ignore */ }
}
