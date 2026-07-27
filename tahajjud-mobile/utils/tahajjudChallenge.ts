import AsyncStorage from '@react-native-async-storage/async-storage';
import { differenceInCalendarDays, parseISO, isValid } from 'date-fns';
import { localDateStr } from './localDate';

/**
 * 40-day Tahajjud challenge — a self-set goal where the user commits to
 * praying Tahajjud on 40 separate days (not necessarily consecutive).
 *
 * Progress is DERIVED from the real prayer log (`prayer-tracker-v2`), not a
 * separate counter. An earlier version kept its own append-only `progressDays`
 * list that was only updated at log-time and only while a challenge was active.
 * That drifted from reality in two ways:
 *   1. A Tahajjud prayed before "Start" (incl. one already logged earlier the
 *      same day) was never counted — an off-by-one on the very first night.
 *   2. Any missed/failed record call permanently desynced the counter from the
 *      actual prayer history.
 * Reconciling from the canonical log on every read/record makes the count
 * self-healing and always consistent with the tracker.
 *
 * Stored locally; opt-in. Subscribers fire on start / progress / finish.
 */

const KEY = 'tahajjud-challenge-v1';
const TRACKER_KEY = 'prayer-tracker-v2'; // canonical prayer history (see Tracker.tsx)
const BASE_TARGET = 40;
const TARGET_INCREMENT = 10;
// How many challenges this device has ever completed — persisted separately
// from ChallengeState itself, since `reset`/`start` fully replace that
// record. This is the one thing that has to survive across challenge
// cycles for the target to actually escalate (40, 50, 60, ...) instead of
// resetting to 40 every time someone starts a new one.
const COMPLETED_COUNT_KEY = 'tahajjud-challenge-completed-count-v1';

export interface ChallengeState {
    startedAt: string;       // ISO date YYYY-MM-DD
    progressDays: string[];  // unique ISO dates that count toward the goal (derived)
    target: number;          // this cycle's night goal — escalates after each completion
    completedAt?: string;    // when user hit the target
    abandonedAt?: string;    // user-initiated quit
}

async function getCompletedCount(): Promise<number> {
    try {
        const raw = await AsyncStorage.getItem(COMPLETED_COUNT_KEY);
        const n = raw ? parseInt(raw, 10) : 0;
        return Number.isFinite(n) && n >= 0 ? n : 0;
    } catch { return 0; }
}

async function incrementCompletedCount(): Promise<void> {
    const n = await getCompletedCount();
    try { await AsyncStorage.setItem(COMPLETED_COUNT_KEY, String(n + 1)); } catch { /* non-fatal */ }
}

type Listener = (state: ChallengeState | null) => void;
const listeners = new Set<Listener>();

async function load(): Promise<ChallengeState | null> {
    try {
        const raw = await AsyncStorage.getItem(KEY);
        return raw ? JSON.parse(raw) : null;
    } catch { return null; }
}

async function save(state: ChallengeState | null): Promise<void> {
    if (state === null) await AsyncStorage.removeItem(KEY);
    else await AsyncStorage.setItem(KEY, JSON.stringify(state));
    listeners.forEach(l => { try { l(state); } catch { /* ignore */ } });
}

/**
 * Unique local-date strings (YYYY-MM-DD) on or after `startedAt` on which the
 * user logged Tahajjud, read straight from the canonical prayer history. This
 * is the single source of truth for challenge progress.
 */
async function tahajjudDaysSince(startedAt: string): Promise<string[]> {
    try {
        const raw = await AsyncStorage.getItem(TRACKER_KEY);
        if (!raw) return [];
        const hist = JSON.parse(raw);
        const dates: unknown = hist?.tahajjud;
        if (!Array.isArray(dates)) return [];
        const days = new Set<string>();
        for (const iso of dates) {
            if (typeof iso !== 'string') continue;
            const day = localDateStr(iso);
            // YYYY-MM-DD is fixed-width & zero-padded, so string compare == date compare.
            if (day >= startedAt) days.add(day);
        }
        return [...days].sort();
    } catch { return []; }
}

/**
 * Recompute progressDays from the real Tahajjud log and persist if anything
 * changed. Completion is sticky — once reached it never reverts, and a
 * completed/abandoned challenge is frozen (no further reconciliation).
 */
async function reconcile(state: ChallengeState): Promise<ChallengeState> {
    if (state.completedAt || state.abandonedAt) return state;

    // Older persisted states were written before `target` existed — treat
    // them as the original 40, rather than crashing/NaN-ing on a missing field.
    const target = state.target ?? BASE_TARGET;

    const days = await tahajjudDaysSince(state.startedAt);
    const changed = days.length !== state.progressDays.length
        || days.some((d, i) => d !== state.progressDays[i])
        || state.target == null; // normalize legacy records missing `target`

    let next = changed ? { ...state, progressDays: days, target } : state;
    if (!next.completedAt && next.progressDays.length >= target) {
        next = { ...next, target, completedAt: next.progressDays[target - 1] ?? localDateStr(new Date()) };
        // First time crossing the line for THIS challenge — bump the tally
        // that makes the next one harder. Guarded by the outer `if
        // (state.completedAt) return state` above, so this only ever runs
        // once per completion, not on every subsequent reconcile() call.
        await incrementCompletedCount();
    }
    if (next !== state) await save(next);
    return next;
}

export const TahajjudChallenge = {
    async getState(): Promise<ChallengeState | null> {
        const state = await load();
        if (!state) return null;
        // Self-heal on every read so the card always reflects the real log.
        return reconcile(state);
    },

    /** Start a new challenge today. No-op if one is already active. Target
     * escalates by TARGET_INCREMENT for every challenge this device has
     * previously completed — the first is 40 nights, the next 50, then 60,
     * and so on, so finishing one is a real step up rather than the same
     * goal on repeat. */
    async start(): Promise<ChallengeState> {
        const existing = await load();
        if (existing && !existing.completedAt && !existing.abandonedAt) return existing;
        const target = BASE_TARGET + (await getCompletedCount()) * TARGET_INCREMENT;
        const fresh: ChallengeState = {
            startedAt: localDateStr(new Date()),
            progressDays: [],
            target,
        };
        await save(fresh);
        // Backfill any Tahajjud already logged today (e.g. prayed, then committed).
        return reconcile(fresh);
    },

    /** What the next challenge's target will be, without starting one —
     * lets the UI preview "60 nights" etc. before the user commits. */
    async getNextTarget(): Promise<number> {
        return BASE_TARGET + (await getCompletedCount()) * TARGET_INCREMENT;
    },

    /** Mark a Tahajjud day. Called from the prayer logger — idempotent. */
    async recordTahajjudToday(): Promise<ChallengeState | null> {
        const state = await load();
        if (!state || state.completedAt || state.abandonedAt) return state;
        // The prayer history is written before this is called, so reconcile sees it.
        return reconcile(state);
    },

    /** User quits. Resets so they can start a new one later. */
    async abandon(): Promise<void> {
        const state = await load();
        if (!state) return;
        await save({ ...state, abandonedAt: localDateStr(new Date()) });
    },

    /** Wipe — start fresh. */
    async reset(): Promise<void> {
        await save(null);
    },

    /** Days remaining toward the goal. */
    daysRemaining(state: ChallengeState): number {
        return Math.max(0, (state.target ?? BASE_TARGET) - state.progressDays.length);
    },

    /** Calendar days since start (informational — not a deadline). */
    daysSinceStart(state: ChallengeState): number {
        const started = parseISO(state.startedAt);
        return isValid(started) ? differenceInCalendarDays(new Date(), started) : 0;
    },

    /** Percent complete 0-100. */
    progressPercent(state: ChallengeState): number {
        const target = state.target ?? BASE_TARGET;
        return Math.min(100, Math.round((state.progressDays.length / target) * 100));
    },

    subscribe(l: Listener): () => void {
        listeners.add(l);
        return () => { listeners.delete(l); };
    },

    BASE_TARGET,
    TARGET_INCREMENT,
};
