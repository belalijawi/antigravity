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
import { startOfWeek, endOfWeek, startOfMonth, endOfMonth, isWithinInterval } from 'date-fns';
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
const ISTIGHFAR_KEY = 'istighfar_count_v1';

// ── Challenge pool ─────────────────────────────────────────────────────
// Rotate one per week / per month. We avoid randomness so users on the
// same device see the same challenge until the period rolls over.

const WEEKLY_POOL: ChallengeDef[] = [
    {
        id: 'w-tahajjud-3',
        kind: 'weekly', metric: 'tahajjud', target: 3,
        title: 'Three Nights',
        body: 'Pray Tahajjud on 3 different nights this week.',
        reward: 'Three nights of standing — barakah upon barakah.',
    },
    {
        id: 'w-tahajjud-5',
        kind: 'weekly', metric: 'tahajjud', target: 5,
        title: 'Five Nights',
        body: 'Pray Tahajjud on 5 different nights this week. The middle path.',
        reward: 'Five nights — you stood when most of the world slept.',
    },
    {
        id: 'w-fajr-7',
        kind: 'weekly', metric: 'fajr', target: 7,
        title: 'Fajr Every Day',
        body: 'Catch Fajr every single day this week — not a single one missed.',
        reward: 'Seven Fajrs in a row. Allah loves the consistent.',
    },
    {
        id: 'w-all-five-5',
        kind: 'weekly', metric: 'all-five', target: 5,
        title: 'Full Days',
        body: 'Pray all five daily prayers on 5 separate days this week.',
        reward: 'Five complete days of the five pillars. Mā shāʾ Allāh.',
    },
    {
        id: 'w-istighfar-700',
        kind: 'weekly', metric: 'istighfar', target: 700,
        title: '700 Astaghfirullah',
        body: '100× Astaghfirullah every day — 700 across the week.',
        reward: 'Your tongue has been busy with repentance. It shows.',
    },
];

const MONTHLY_POOL: ChallengeDef[] = [
    {
        id: 'm-tahajjud-15',
        kind: 'monthly', metric: 'tahajjud', target: 15,
        title: 'Half the Month',
        body: 'Pray Tahajjud on at least 15 nights this month.',
        reward: '15 nights of standing. Halfway to a new habit.',
    },
    {
        id: 'm-tahajjud-21',
        kind: 'monthly', metric: 'tahajjud', target: 21,
        title: 'Three Weeks Strong',
        body: 'Pray Tahajjud on 21 different nights this month.',
        reward: '21 nights. Research says you have built a habit. Don\'t lose it.',
    },
    {
        id: 'm-fajr-25',
        kind: 'monthly', metric: 'fajr', target: 25,
        title: 'Fajr Almost Every Day',
        body: 'Catch Fajr on at least 25 days this month.',
        reward: 'Fajr 25 times in a month. You\'ve out-disciplined most of humanity.',
    },
    {
        id: 'm-istighfar-3000',
        kind: 'monthly', metric: 'istighfar', target: 3000,
        title: '3000 Astaghfirullah',
        body: '100× Astaghfirullah daily across the month. Reach 3000.',
        reward: 'Three thousand repentances. May Allah accept and forgive.',
    },
];

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

/** Currently-active weekly challenge (rotates every week). */
export function currentWeekly(now: Date = new Date()): ChallengeDef {
    return pickFromPool(WEEKLY_POOL, isoWeekNumber(now));
}

/** Currently-active monthly challenge (rotates every month). */
export function currentMonthly(now: Date = new Date()): ChallengeDef {
    const monthsSinceEpoch = now.getFullYear() * 12 + now.getMonth();
    return pickFromPool(MONTHLY_POOL, monthsSinceEpoch);
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

async function loadIstighfarCount(): Promise<number> {
    try {
        const raw = await AsyncStorage.getItem(ISTIGHFAR_KEY);
        if (raw) {
            const j = JSON.parse(raw);
            if (typeof j === 'number') return j;
            // Detailed-by-date map — sum all daily counts
            if (typeof j === 'object' && j) {
                return Object.values(j as Record<string, number>).reduce((s, v) => s + (typeof v === 'number' ? v : 0), 0);
            }
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

/** Returns { current, target, percent } for the given challenge. */
export async function progressFor(c: ChallengeDef, now: Date = new Date()): Promise<{ current: number; target: number; percent: number; complete: boolean }> {
    const range = c.kind === 'weekly'
        ? { start: startOfWeek(now, { weekStartsOn: 1 }), end: endOfWeek(now, { weekStartsOn: 1 }) }
        : { start: startOfMonth(now), end: endOfMonth(now) };

    let current = 0;
    if (c.metric === 'tahajjud') {
        const h = await loadHistory();
        current = uniqueDays(h.tahajjud, range);
    } else if (c.metric === 'fajr') {
        const h = await loadHistory();
        current = uniqueDays(h.fajr, range);
    } else if (c.metric === 'all-five') {
        const h = await loadHistory();
        // Count days where ALL 5 daily prayers were logged
        const daysCount: Record<string, Set<string>> = {};
        const buckets: Array<[keyof History, string]> = [
            ['fajr', 'fajr'], ['dhuhr', 'dhuhr'], ['asr', 'asr'], ['maghrib', 'maghrib'], ['isha', 'isha'],
        ];
        for (const [key, label] of buckets) {
            for (const ts of h[key]) {
                const d = new Date(ts);
                if (!isWithinInterval(d, range)) continue;
                const day = localDateStr(new Date(ts));
                if (!daysCount[day]) daysCount[day] = new Set();
                daysCount[day].add(label);
            }
        }
        current = Object.values(daysCount).filter(s => s.size === 5).length;
    } else if (c.metric === 'istighfar') {
        // istighfar tracker is a simple count; we approximate by reading
        // total count (best-effort — perfect period filtering requires
        // a per-day count which we don't store)
        const total = await loadIstighfarCount();
        current = typeof total === 'number' ? total : 0;
    }

    const percent = c.target > 0 ? Math.min(1, current / c.target) : 0;
    return { current, target: c.target, percent, complete: current >= c.target };
}
