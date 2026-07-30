/**
 * Age assurance.
 *
 * Tahajjud+ carries user-generated content visible to other people — the Dua
 * Wall, Tahajjud Stories, replies, dua pins on the global map and Leaderboard
 * nicknames. App Store Review Guideline 1.2 (and COPPA in the US) means an app
 * hosting UGC must not be available to children under 13, so onboarding asks
 * for the user's age (via a slider) before any of those surfaces can be reached.
 *
 * The age is NEVER PERSISTED. It exists only in component state for the
 * moment it takes to compare against the age floor; what gets written to disk
 * is a single yes/no result ('ok' or 'under'), which is not the user's age and
 * cannot be turned back into it. That is a deliberate promise the onboarding
 * copy makes to the user, so it must stay true — do not "helpfully" start
 * storing the age here for analytics or personalisation.
 *
 * Nothing here is ever written to Firestore, attached to a dua, a reply or a
 * leaderboard entry, or sent off the device in any form.
 *
 * The screen also avoids a stark "you must be 13+ to use this app" gate-
 * keeping framing — the passing threshold is disclosed only as a soft privacy
 * reassurance ("we only check you're old enough, we don't keep the number"),
 * not as a blocking requirement. A bare yes/no "are you over 13?" would be
 * worse still — it tells a child exactly which single answer unlocks the app —
 * which is what Apple's guidance on age gates warns against.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

/** Stores only the OUTCOME of the check, never the age behind it. */
const AGE_STATUS_KEY = 'community-age-status-v1';
type AgeStatus = 'ok' | 'under';

/** Apple/COPPA floor for an app that hosts user-generated content. */
export const MIN_COMMUNITY_AGE = 13;

/** Slider bounds shown in onboarding. */
export const MAX_AGE_SLIDER = 99;

/** Whether a directly-entered age clears the floor. */
export function meetsCommunityAge(age: number): boolean {
    return age >= MIN_COMMUNITY_AGE;
}

/** Record only the pass/fail result — see the note above about the age. */
export async function setAgeStatus(passed: boolean): Promise<void> {
    try { await AsyncStorage.setItem(AGE_STATUS_KEY, passed ? 'ok' : 'under'); } catch { /* ignore */ }
}

export async function getAgeStatus(): Promise<AgeStatus | null> {
    try {
        const raw = await AsyncStorage.getItem(AGE_STATUS_KEY);
        return raw === 'ok' || raw === 'under' ? raw : null;
    } catch { return null; }
}

/**
 * Whether this device may use the community features.
 *
 * Passes when no answer is stored: installs predating this gate never saw the
 * question and have no way to answer it, and retroactively cutting them off
 * from the Dua Wall on an app update would be worse than the risk it guards.
 * New installs always pass through onboarding, so they always have a value.
 */
export async function canUseCommunity(): Promise<boolean> {
    return (await getAgeStatus()) !== 'under';
}
