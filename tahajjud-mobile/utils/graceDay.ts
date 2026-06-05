import AsyncStorage from '@react-native-async-storage/async-storage';
import { subDays, format, getISOWeek, getISOWeekYear } from 'date-fns';
import { localDateStr } from './localDate';

/**
 * Streak freeze — gives the user 1 "miss" per ISO week before their Tahajjud
 * streak resets. Auto-consumed when they miss a night and a freeze is
 * available. Used by `calculateStreakWithGrace`.
 *
 * Stored as ISO date strings (YYYY-MM-DD). At most one freeze used per ISO
 * week. The week is `getISOWeekYear-Www`, so it's stable across DST and the
 * year boundary.
 */

const KEY = 'streak-grace-days-v1';

interface GraceState {
    /** ISO dates (YYYY-MM-DD) of freezes consumed, one per ISO week max. */
    used: string[];
}

function weekKey(d: Date): string {
    return `${getISOWeekYear(d)}-W${String(getISOWeek(d)).padStart(2, '0')}`;
}

async function load(): Promise<GraceState> {
    try {
        const raw = await AsyncStorage.getItem(KEY);
        if (!raw) return { used: [] };
        return JSON.parse(raw);
    } catch {
        return { used: [] };
    }
}

async function save(state: GraceState): Promise<void> {
    await AsyncStorage.setItem(KEY, JSON.stringify(state));
}

/** Has the user used a freeze in the same ISO week as `today`? */
export async function freezeUsedThisWeek(today: Date = new Date()): Promise<boolean> {
    const state = await load();
    if (state.used.length === 0) return false;
    const wk = weekKey(today);
    return state.used.some(d => weekKey(new Date(d)) === wk);
}

/** Mark `date` as forgiven. Idempotent — won't double-record the same day. */
export async function consumeGrace(date: Date): Promise<void> {
    const dayStr = format(date, 'yyyy-MM-dd');
    const state = await load();
    if (state.used.includes(dayStr)) return;
    state.used.push(dayStr);
    await save(state);
}

/** True if `date` was forgiven (i.e. should be treated as "logged" for streak purposes). */
export async function isDateForgiven(date: Date): Promise<boolean> {
    const dayStr = format(date, 'yyyy-MM-dd');
    const state = await load();
    return state.used.includes(dayStr);
}

/**
 * Streak calculator that respects the weekly-freeze allowance.
 *
 * Free users get 1 freeze per ISO week. Premium users get 2.
 * If yesterday wasn't logged but a freeze is available, we automatically
 * forgive yesterday so the streak survives. The forgiven day is persisted.
 */
export async function calculateStreakWithGrace(
    dates: string[],
    today: Date = new Date(),
    maxFreezesPerWeek: number = 1,
): Promise<{ streak: number; graceUsedToday: boolean; freezeAvailable: boolean }> {
    const state = await load();
    const forgiven = new Set(state.used);
    const currentWeek = weekKey(today);
    const usedThisWeek = state.used.filter(d => weekKey(new Date(d)) === currentWeek).length;
    const freezeAvailableNow = usedThisWeek < maxFreezesPerWeek;

    if (dates.length === 0) {
        return { streak: 0, graceUsedToday: false, freezeAvailable: freezeAvailableNow };
    }

    const todayStr = format(today, 'yyyy-MM-dd');
    const ydayStr = format(subDays(today, 1), 'yyyy-MM-dd');

    const has = (s: string) => dates.some(d => localDateStr(d) === s) || forgiven.has(s);
    const hasToday = has(todayStr);
    const hasYesterday = has(ydayStr);

    let graceUsedToday = false;
    let freezeAvailable = freezeAvailableNow;

    // If neither today nor yesterday is accounted for, but the user hasn't
    // used a freeze this week, forgive yesterday so the streak survives.
    // Only consume the freeze if there is actually a prior streak to protect —
    // forgiving yesterday when there's nothing before it would waste the freeze.
    if (!hasToday && !hasYesterday) {
        if (freezeAvailableNow) {
            // Peek one day before yesterday to check if a streak exists worth protecting
            const dayBeforeYdayStr = format(subDays(today, 2), 'yyyy-MM-dd');
            const hasPriorStreak = has(dayBeforeYdayStr);
            if (!hasPriorStreak) {
                return { streak: 0, graceUsedToday: false, freezeAvailable: freezeAvailableNow };
            }
            await consumeGrace(subDays(today, 1));
            forgiven.add(ydayStr);
            graceUsedToday = true;
            // Still available if premium user has more freezes remaining this week
            freezeAvailable = (usedThisWeek + 1) < maxFreezesPerWeek;
        } else {
            return { streak: 0, graceUsedToday: false, freezeAvailable: false };
        }
    }

    // Walk back from today (or yesterday if today not logged), counting consecutive days.
    let count = 0;
    let cursor = (hasToday) ? today : subDays(today, 1);
    while (true) {
        const s = format(cursor, 'yyyy-MM-dd');
        if (!has(s)) break;
        count++;
        cursor = subDays(cursor, 1);
    }
    return { streak: count, graceUsedToday, freezeAvailable };
}
