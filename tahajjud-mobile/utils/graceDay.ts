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
const PAUSE_KEY = 'streak-pause-v1';

interface GraceState {
    /** ISO dates (YYYY-MM-DD) of freezes consumed, one per ISO week max. */
    used: string[];
}

// ── Streak pause (religious / life exemptions) ──────────────────────────
// Some days a user is genuinely *exempt* from praying — most importantly a
// woman during menstruation (ḥayḍ) or postnatal bleeding (nifās), who is not
// required to pray and does not make those prayers up. These days must NOT
// count as misses, and must NOT burn a weekly freeze — the streak simply
// *bridges* over them, as if they weren't on the calendar.
//
// This is deliberately separate from the freeze system: a freeze forgives a
// slip-up; a pause recognises there was no obligation in the first place.
//
// Privacy: stored ONLY on-device, never synced or shared. The reason is
// optional and exists only to tailor supportive copy — it is never required.

export type PauseReason = 'period' | 'postpartum' | 'illness' | 'travel' | 'unspecified';

export interface PausePeriod {
    start: string;        // YYYY-MM-DD (inclusive)
    end: string | null;   // YYYY-MM-DD (inclusive) — null while the pause is active
    reason?: PauseReason;
}

interface PauseState {
    ranges: PausePeriod[];
}

async function loadPause(): Promise<PauseState> {
    try {
        const raw = await AsyncStorage.getItem(PAUSE_KEY);
        if (raw) return JSON.parse(raw);
    } catch { /* ignore */ }
    return { ranges: [] };
}

async function savePause(state: PauseState): Promise<void> {
    await AsyncStorage.setItem(PAUSE_KEY, JSON.stringify(state));
}

/** The currently-active (open-ended) pause, or null if not paused. */
export async function getActivePause(): Promise<PausePeriod | null> {
    const s = await loadPause();
    return s.ranges.find(r => r.end === null) ?? null;
}

/** Is the streak paused right now? */
export async function isStreakPaused(): Promise<boolean> {
    return (await getActivePause()) !== null;
}

/** Begin a pause (idempotent — a no-op if already paused). */
export async function startStreakPause(reason: PauseReason = 'unspecified', today: Date = new Date()): Promise<void> {
    const s = await loadPause();
    if (s.ranges.some(r => r.end === null)) return; // already paused
    s.ranges.push({ start: format(today, 'yyyy-MM-dd'), end: null, reason });
    await savePause(s);
}

/**
 * End the active pause. Exemption covers `start` through *yesterday* — from
 * today onward the user can pray again, so today counts normally. A pause
 * started and ended the same day collapses to nothing (no harm).
 */
export async function endStreakPause(today: Date = new Date()): Promise<void> {
    const s = await loadPause();
    const active = s.ranges.find(r => r.end === null);
    if (!active) return;
    active.end = format(subDays(today, 1), 'yyyy-MM-dd');
    // Drop ranges that ended before they began (paused & resumed same day).
    s.ranges = s.ranges.filter(r => r.end === null || r.end >= r.start);
    await savePause(s);
}

/** Build a fast predicate: is a given date inside any exempt range? */
function buildExemptPredicate(pause: PauseState, today: Date): (d: Date) => boolean {
    const todayStr = format(today, 'yyyy-MM-dd');
    return (d: Date) => {
        const ds = format(d, 'yyyy-MM-dd');
        for (const r of pause.ranges) {
            const end = r.end ?? todayStr; // active pause extends through today
            if (r.start <= ds && ds <= end) return true;
        }
        return false;
    };
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

    const pause = await loadPause();
    const isExempt = buildExemptPredicate(pause, today);

    const has = (s: string) => dates.some(d => localDateStr(d) === s) || forgiven.has(s);

    if (dates.length === 0) {
        return { streak: 0, graceUsedToday: false, freezeAvailable: freezeAvailableNow };
    }

    // Walk backward from today. Three cases per day:
    //   • exempt (paused)  → bridge: skip silently, no count, no freeze spent
    //   • prayed/forgiven  → count it
    //   • genuine miss     → today is "in progress" (not a miss yet); an older
    //                        miss may be bridged by one weekly freeze if a
    //                        streak exists just beyond it, else the streak ends.
    let count = 0;
    let freezesUsedInWalk = 0;
    let cursor = new Date(today);
    let isToday = true;
    const freezesRemaining = () => maxFreezesPerWeek - usedThisWeek - freezesUsedInWalk;

    while (true) {
        const s = format(cursor, 'yyyy-MM-dd');

        if (isExempt(cursor)) {            // bridge exempt day
            cursor = subDays(cursor, 1); isToday = false; continue;
        }
        if (has(s)) {                       // prayed / already forgiven
            count++; cursor = subDays(cursor, 1); isToday = false; continue;
        }
        if (isToday) {                      // tonight not prayed yet — not a miss
            cursor = subDays(cursor, 1); isToday = false; continue;
        }

        // Genuine past miss. Spend a freeze to bridge it only if a streak exists
        // just beyond (older than) the gap — otherwise we'd waste the freeze.
        const older = subDays(cursor, 1);
        const olderQualifies = has(format(older, 'yyyy-MM-dd')) || isExempt(older);
        if (freezesRemaining() > 0 && olderQualifies) {
            await consumeGrace(cursor);
            forgiven.add(s);
            count++;
            freezesUsedInWalk++;
            cursor = older; isToday = false; continue;
        }
        break;
    }

    return {
        streak: count,
        graceUsedToday: freezesUsedInWalk > 0,
        freezeAvailable: freezesRemaining() > 0,
    };
}
