/**
 * Age assurance.
 *
 * Tahajjud+ carries user-generated content that is visible to other people —
 * the Dua Wall, Tahajjud Stories, replies, dua pins on the global map and
 * Leaderboard nicknames. App Store Review Guideline 1.2 (and COPPA in the US)
 * means an app hosting UGC must not be made available to children under 13, so
 * the app asks for a birth year once, during onboarding, before any of those
 * surfaces can be reached.
 *
 * Deliberate design choices:
 *
 * - The question is NEUTRAL ("which year were you born?") rather than "are you
 *   over 13?". A yes/no question telegraphs the answer that unlocks the app,
 *   which is exactly what Apple's guidance on age gates warns against.
 * - Birth YEAR only, not a full date. It is the least personal data that still
 *   answers the question, and there is no reason to collect a child's exact
 *   date of birth to decide whether to let them in.
 * - Stored on-device only. It is never written to Firestore, never attached to
 *   a dua, a reply or a leaderboard entry, and never leaves the phone.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const BIRTH_YEAR_KEY = 'user-birth-year-v1';

/** Apple/COPPA floor for an app that hosts user-generated content. */
export const MIN_COMMUNITY_AGE = 13;

/** Oldest birth year offered in the picker — a generous 100-year range. */
export const OLDEST_BIRTH_YEAR_OFFSET = 100;

/**
 * Age implied by a birth year.
 *
 * Year-only input can't know whether this year's birthday has happened yet, so
 * this returns the age the person turns during the current year — the
 * MAXIMUM possible age. Using the minimum instead would lock out genuine
 * 13-year-olds for up to a year, and the guideline is about excluding under-13s
 * rather than about being precise to the day.
 */
export function ageFromBirthYear(birthYear: number, now: Date = new Date()): number {
    return now.getFullYear() - birthYear;
}

export function meetsCommunityAge(birthYear: number, now: Date = new Date()): boolean {
    return ageFromBirthYear(birthYear, now) >= MIN_COMMUNITY_AGE;
}

export async function setBirthYear(year: number): Promise<void> {
    try { await AsyncStorage.setItem(BIRTH_YEAR_KEY, String(year)); } catch { /* ignore */ }
}

export async function getBirthYear(): Promise<number | null> {
    try {
        const raw = await AsyncStorage.getItem(BIRTH_YEAR_KEY);
        if (!raw) return null;
        const n = parseInt(raw, 10);
        return Number.isFinite(n) ? n : null;
    } catch { return null; }
}

/**
 * Whether this device may use the community features.
 *
 * Returns true when a birth year has been recorded and it clears the age
 * floor. Note that it also returns true when NO birth year is stored — every
 * install that predates this gate has no stored year, and retroactively
 * locking existing users out of the Dua Wall on an app update (with no way to
 * answer the question, since onboarding has long since been completed) would
 * be worse than the thing it protects against. New installs always pass
 * through onboarding, so they always have a value.
 */
export async function canUseCommunity(): Promise<boolean> {
    const year = await getBirthYear();
    if (year === null) return true;
    return meetsCommunityAge(year);
}

/** Selectable birth years, most recent first. */
export function birthYearOptions(now: Date = new Date()): number[] {
    const current = now.getFullYear();
    const years: number[] = [];
    for (let y = current; y >= current - OLDEST_BIRTH_YEAR_OFFSET; y--) years.push(y);
    return years;
}
