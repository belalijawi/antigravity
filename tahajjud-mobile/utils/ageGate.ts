/**
 * Age assurance.
 *
 * Tahajjud+ carries user-generated content visible to other people — the Dua
 * Wall, Tahajjud Stories, replies, dua pins on the global map and Leaderboard
 * nicknames. App Store Review Guideline 1.2 (and COPPA in the US) means an app
 * hosting UGC must not be available to children under 13, so onboarding asks
 * for a birth year before any of those surfaces can be reached.
 *
 * The birth year is NEVER PERSISTED. It exists only in component state for the
 * moment it takes to compare against the age floor; what gets written to disk
 * is a single yes/no result ('ok' or 'under'), which is not the user's age and
 * cannot be turned back into it. That is a deliberate promise the onboarding
 * copy makes to the user, so it must stay true — do not "helpfully" start
 * storing the year here for analytics or personalisation.
 *
 * Nothing here is ever written to Firestore, attached to a dua, a reply or a
 * leaderboard entry, or sent off the device in any form.
 *
 * The question is also NEUTRAL ("which year were you born?") rather than "are
 * you over 13?" — a yes/no question tells a child exactly which answer unlocks
 * the app, which is what Apple's guidance on age gates warns against.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

/** Stores only the OUTCOME of the check, never the age behind it. */
const AGE_STATUS_KEY = 'community-age-status-v1';
type AgeStatus = 'ok' | 'under';

/** Apple/COPPA floor for an app that hosts user-generated content. */
export const MIN_COMMUNITY_AGE = 13;

/** Oldest birth year offered in the picker — a generous 100-year range. */
export const OLDEST_BIRTH_YEAR_OFFSET = 100;

/**
 * Whether a birth year clears the floor.
 *
 * Year-only input can't know whether this year's birthday has happened yet, so
 * this uses the age the person turns during the current year — the maximum
 * possible. Taking the minimum instead would lock out genuine 13-year-olds for
 * up to a year, and the guideline is about excluding under-13s rather than
 * being precise to the day.
 */
export function meetsCommunityAge(birthYear: number, now: Date = new Date()): boolean {
    return now.getFullYear() - birthYear >= MIN_COMMUNITY_AGE;
}

/** Record only the pass/fail result — see the note above about the year. */
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

/** Selectable birth years, most recent first. */
export function birthYearOptions(now: Date = new Date()): number[] {
    const current = now.getFullYear();
    const years: number[] = [];
    for (let y = current; y >= current - OLDEST_BIRTH_YEAR_OFFSET; y--) years.push(y);
    return years;
}
