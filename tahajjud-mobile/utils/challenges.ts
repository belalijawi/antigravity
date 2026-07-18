/**
 * Auto-rotating weekly and monthly challenges.
 *
 * Each challenge has a target ("pray Tahajjud N times this week") and a
 * derivation function that computes current progress from the local
 * prayer-tracker AsyncStorage. Storage shape is the same as Tracker —
 * we don't duplicate state.
 *
 * Challenge metadata is rotated by week/month so users always have
 * something fresh to work on without us shipping a new build.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
    startOfWeek, endOfWeek, startOfMonth, endOfMonth, isWithinInterval,
    subWeeks, getDaysInMonth,
} from 'date-fns';
import { localDateStr } from './localDate';

export type ChallengeKind = 'weekly' | 'monthly';
export type ChallengeMetric = 'tahajjud' | 'fajr' | 'all-five' | 'istighfar';

export interface ChallengeDef {
    id: string;
    kind: ChallengeKind;
    metric: ChallengeMetric;
    target: number;
    title: string;
    body: string;
    reward: string;     // a short congrats line shown on completion
}

const TRACKER_KEY = 'prayer-tracker-v2';
const SESSIONS_KEY = 'tasbeeh-sessions';

// ── Period helpers ─────────────────────────────────────────────────────

function isoWeekNumber(date: Date): number {
    // Simple ISO-ish week number (close enough for rotation, not for calendar use)
    const start = new Date(date.getFullYear(), 0, 1);
    const diffMs = date.getTime() - start.getTime();
    return Math.floor(diffMs / (7 * 24 * 60 * 60 * 1000));
}

function pickFromPool<T>(pool: T[], seed: number): T {
    return pool[((seed % pool.length) + pool.length) % pool.length];
}

// ── Progress derivation ────────────────────────────────────────────────

interface History {
    fajr: string[]; dhuhr: string[]; asr: string[]; maghrib: string[]; isha: string[]; tahajjud: string[];
}

async function loadHistory(): Promise<History> {
    try {
        const raw = await AsyncStorage.getItem(TRACKER_KEY);
        if (raw) return JSON.parse(raw);
    } catch { /* ignore */ }
    return { fajr: [], dhuhr: [], asr: [], maghrib: [], isha: [], tahajjud: [] };
}

async function loadIstighfarCount(range: { start: Date; end: Date }): Promise<number> {
    try {
        const raw = await AsyncStorage.getItem(SESSIONS_KEY);
        if (raw) {
            const sessions: Array<{ dhikrId: string; count: number; date: string }> = JSON.parse(raw);
            return sessions
                .filter(s => s.dhikrId === 'istighfar' && isWithinInterval(new Date(s.date), range))
                .reduce((sum, s) => sum + s.count, 0);
        }
    } catch { /* ignore */ }
    return 0;
}

function uniqueDays(timestamps: string[], range: { start: Date; end: Date }): number {
    const days = new Set<string>();
    for (const ts of timestamps) {
        const d = new Date(ts);
        if (isWithinInterval(d, range)) days.add(localDateStr(d));
    }
    return days.size;
}

/**
 * How many qualifying days a day-based metric scored in a date range.
 * Shared by live progress AND the trailing-average personalization so the
 * two never drift apart. Istighfar is count-based and handled separately.
 */
function activeDaysForMetric(h: History, metric: ChallengeMetric, range: { start: Date; end: Date }): number {
    if (metric === 'tahajjud') return uniqueDays(h.tahajjud, range);
    if (metric === 'fajr') return uniqueDays(h.fajr, range);
    if (metric === 'all-five') {
        // Count days where ALL 5 daily prayers were logged
        const daysCount: Record<string, Set<string>> = {};
        const buckets: Array<[keyof History, string]> = [
            ['fajr', 'fajr'], ['dhuhr', 'dhuhr'], ['asr', 'asr'], ['maghrib', 'maghrib'], ['isha', 'isha'],
        ];
        for (const [key, label] of buckets) {
            for (const ts of h[key]) {
                const d = new Date(ts);
                if (!isWithinInterval(d, range)) continue;
                const day = localDateStr(d);
                if (!daysCount[day]) daysCount[day] = new Set();
                daysCount[day].add(label);
            }
        }
        return Object.values(daysCount).filter(s => s.size === 5).length;
    }
    return 0;
}

/** Returns { current, target, percent } for the given challenge. */
export async function progressFor(c: ChallengeDef, now: Date = new Date()): Promise<{ current: number; target: number; percent: number; complete: boolean }> {
    const range = c.kind === 'weekly'
        ? { start: startOfWeek(now, { weekStartsOn: 1 }), end: endOfWeek(now, { weekStartsOn: 1 }) }
        : { start: startOfMonth(now), end: endOfMonth(now) };

    const current = c.metric === 'istighfar'
        ? await loadIstighfarCount(range)
        : activeDaysForMetric(await loadHistory(), c.metric, range);

    const percent = c.target > 0 ? Math.min(1, current / c.target) : 0;
    return { current, target: c.target, percent, complete: current >= c.target };
}

// ── Adaptive personalization ───────────────────────────────────────────
// Instead of showing everyone the same fixed target, set each challenge's
// target from the user's own trailing 4-week average — a gentle "just out of
// reach" stretch. Someone averaging 2 Tahajjud nights gets challenged to 3;
// someone averaging 6 gets pushed to 7. New users get an achievable floor.

const TRAILING_WEEKS = 4;

/** Trailing average of qualifying days per week, over the last N COMPLETE weeks. */
async function trailingAvgDaysPerWeek(metric: ChallengeMetric, now: Date, weeks = TRAILING_WEEKS): Promise<number> {
    const h = await loadHistory();
    let total = 0;
    for (let i = 1; i <= weeks; i++) {
        const ref = subWeeks(now, i);
        const range = { start: startOfWeek(ref, { weekStartsOn: 1 }), end: endOfWeek(ref, { weekStartsOn: 1 }) };
        total += activeDaysForMetric(h, metric, range);
    }
    return total / weeks;
}

/** Trailing average istighfar count per week, over the last N COMPLETE weeks. */
async function trailingAvgIstighfarPerWeek(now: Date, weeks = TRAILING_WEEKS): Promise<number> {
    let total = 0;
    for (let i = 1; i <= weeks; i++) {
        const ref = subWeeks(now, i);
        const range = { start: startOfWeek(ref, { weekStartsOn: 1 }), end: endOfWeek(ref, { weekStartsOn: 1 }) };
        total += await loadIstighfarCount(range);
    }
    return total / weeks;
}

function clamp(n: number, lo: number, hi: number): number {
    return Math.min(hi, Math.max(lo, n));
}

function roundTo100(n: number): number {
    return Math.max(100, Math.round(n / 100) * 100);
}

interface AdaptiveMeta {
    metric: ChallengeMetric;
    title: string;
    reward: string;
    floor: number; // smallest weekly target we'll ever show (keeps it achievable)
    cap: number;   // largest weekly target (7 days max for day-based)
    body: (target: number, avg: number) => string;
}

// Day-based weekly metrics rotated for variety. Istighfar is handled on its
// own track below because it's count-based, not day-based.
const ADAPTIVE_WEEKLY: AdaptiveMeta[] = [
    {
        metric: 'tahajjud', title: 'Night Stand', floor: 2, cap: 7,
        reward: 'You stood when most of the world slept. Barakah upon barakah.',
        body: (t, avg) => avg <= 0
            ? `Start strong: pray Tahajjud on ${t} nights this week.`
            : `You've averaged ${Math.round(avg)} night${Math.round(avg) === 1 ? '' : 's'}/week lately — reach for ${t} this week.`,
    },
    {
        metric: 'fajr', title: 'Dawn Catcher', floor: 3, cap: 7,
        reward: 'Fajr in congregation with the dawn. Allah loves the consistent.',
        body: (t, avg) => avg <= 0
            ? `Catch Fajr on ${t} days this week.`
            : `Lately ${Math.round(avg)} Fajr${Math.round(avg) === 1 ? '' : 's'}/week — push to ${t} this week.`,
    },
    {
        metric: 'all-five', title: 'Full Days', floor: 2, cap: 7,
        reward: 'Complete days of the five pillars. Mā shāʾ Allāh.',
        body: (t, avg) => avg <= 0
            ? `Pray all five daily prayers on ${t} days this week.`
            : `You complete ~${Math.round(avg)} full day${Math.round(avg) === 1 ? '' : 's'}/week — aim for ${t}.`,
    },
];

const ADAPTIVE_ISTIGHFAR_WEEKLY: AdaptiveMeta = {
    metric: 'istighfar', title: 'Tongue of Repentance', floor: 300, cap: 1400,
    reward: 'Your tongue stayed busy with repentance. It shows.',
    body: (t, avg) => avg <= 0
        ? `Say Astaghfirullah ${t}× this week — about ${Math.round(t / 7)} a day.`
        : `You've been saying ~${roundTo100(avg)}/week — reach ${t} this week.`,
};

/**
 * Currently-active weekly challenge, personalized to the user's recent pace.
 * Rotates which metric is featured (by week) for variety, then sets the target
 * from that metric's trailing average. Returns a ready-to-render ChallengeDef.
 */
export async function currentWeeklyAdaptive(now: Date = new Date()): Promise<ChallengeDef> {
    // Rotate through the day-based metrics most weeks; surface istighfar every
    // 4th week so the dhikr goal still appears without dominating.
    const wk = isoWeekNumber(now);
    const useIstighfar = wk % 4 === 3;

    if (useIstighfar) {
        const avg = await trailingAvgIstighfarPerWeek(now);
        const target = avg <= 0 ? 700 : clamp(roundTo100(avg * 1.15), ADAPTIVE_ISTIGHFAR_WEEKLY.floor, ADAPTIVE_ISTIGHFAR_WEEKLY.cap);
        const m = ADAPTIVE_ISTIGHFAR_WEEKLY;
        return { id: `w-adaptive-istighfar-${wk}-${target}`, kind: 'weekly', metric: m.metric, target, title: m.title, body: m.body(target, avg), reward: m.reward };
    }

    const m = pickFromPool(ADAPTIVE_WEEKLY, wk);
    const avg = await trailingAvgDaysPerWeek(m.metric, now);
    const target = clamp(Math.round(avg) + 1, m.floor, m.cap);
    return { id: `w-adaptive-${m.metric}-${wk}-${target}`, kind: 'weekly', metric: m.metric, target, title: m.title, body: m.body(target, avg), reward: m.reward };
}

/**
 * Currently-active monthly challenge, personalized. Projects the user's weekly
 * average across the month (avg/week × weeks) plus a small stretch.
 */
export async function currentMonthlyAdaptive(now: Date = new Date()): Promise<ChallengeDef> {
    const monthsSinceEpoch = now.getFullYear() * 12 + now.getMonth();
    const daysInMonth = getDaysInMonth(now);
    const weeksInMonth = daysInMonth / 7;

    // Rotate istighfar in every 3rd month; day-based metrics otherwise.
    const useIstighfar = monthsSinceEpoch % 3 === 2;

    if (useIstighfar) {
        const avgWeek = await trailingAvgIstighfarPerWeek(now);
        const target = avgWeek <= 0 ? 3000 : clamp(roundTo100(avgWeek * weeksInMonth * 1.1), 1500, 9000);
        return {
            id: `m-adaptive-istighfar-${monthsSinceEpoch}-${target}`, kind: 'monthly', metric: 'istighfar', target,
            title: 'A Month of Repentance',
            body: avgWeek <= 0
                ? `Say Astaghfirullah ${target}× this month — about ${Math.round(target / daysInMonth)} a day.`
                : `Build on your pace — reach ${target} Astaghfirullah this month.`,
            reward: 'A month soaked in repentance. May Allah accept and forgive.',
        };
    }

    const m = pickFromPool(ADAPTIVE_WEEKLY, monthsSinceEpoch);
    const avgWeek = await trailingAvgDaysPerWeek(m.metric, now);
    const projected = Math.round(avgWeek * weeksInMonth);
    const floorMonthly = Math.max(m.floor * 3, 6);
    const target = clamp(projected + 2, floorMonthly, daysInMonth - 1);
    const metricNoun = m.metric === 'tahajjud' ? 'nights of Tahajjud'
        : m.metric === 'fajr' ? 'days catching Fajr'
        : 'full five-prayer days';
    return {
        id: `m-adaptive-${m.metric}-${monthsSinceEpoch}-${target}`, kind: 'monthly', metric: m.metric, target,
        title: m.metric === 'tahajjud' ? 'The Long Haul' : m.metric === 'fajr' ? 'A Month of Dawns' : 'A Month Complete',
        body: avgWeek <= 0
            ? `Aim for ${target} ${metricNoun} this month.`
            : `At your pace that's ~${projected} this month — stretch for ${target} ${metricNoun}.`,
        reward: m.reward,
    };
}
