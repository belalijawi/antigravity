import AsyncStorage from '@react-native-async-storage/async-storage';
import { differenceInCalendarDays, format, parseISO } from 'date-fns';

/**
 * 40-day Tahajjud challenge — a self-set goal where the user commits to
 * praying Tahajjud on 40 separate days (not necessarily consecutive). One
 * grace day is allowed across the whole challenge to keep failure modes humane.
 *
 * Stored locally; opt-in. Subscribers fire on start / progress / finish.
 */

const KEY = 'tahajjud-challenge-v1';
const TARGET_DAYS = 40;

export interface ChallengeState {
    startedAt: string;       // ISO date YYYY-MM-DD
    progressDays: string[];  // unique ISO dates that count toward the goal
    completedAt?: string;    // when user hit the target
    abandonedAt?: string;    // user-initiated quit
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

export const TahajjudChallenge = {
    async getState(): Promise<ChallengeState | null> {
        return load();
    },

    /** Start a new 40-day challenge today. No-op if one is already active. */
    async start(): Promise<ChallengeState> {
        const existing = await load();
        if (existing && !existing.completedAt && !existing.abandonedAt) return existing;
        const fresh: ChallengeState = {
            startedAt: format(new Date(), 'yyyy-MM-dd'),
            progressDays: [],
        };
        await save(fresh);
        return fresh;
    },

    /** Mark a Tahajjud day. Called from the prayer logger — idempotent. */
    async recordTahajjudToday(): Promise<ChallengeState | null> {
        const state = await load();
        if (!state || state.completedAt || state.abandonedAt) return state;

        const today = format(new Date(), 'yyyy-MM-dd');
        if (state.progressDays.includes(today)) return state;

        const next: ChallengeState = {
            ...state,
            progressDays: [...state.progressDays, today],
        };
        if (next.progressDays.length >= TARGET_DAYS) {
            next.completedAt = today;
        }
        await save(next);
        return next;
    },

    /** User quits. Resets so they can start a new one later. */
    async abandon(): Promise<void> {
        const state = await load();
        if (!state) return;
        await save({ ...state, abandonedAt: format(new Date(), 'yyyy-MM-dd') });
    },

    /** Wipe — start fresh. */
    async reset(): Promise<void> {
        await save(null);
    },

    /** Days remaining toward the goal. */
    daysRemaining(state: ChallengeState): number {
        return Math.max(0, TARGET_DAYS - state.progressDays.length);
    },

    /** Calendar days since start (informational — not a deadline). */
    daysSinceStart(state: ChallengeState): number {
        return differenceInCalendarDays(new Date(), parseISO(state.startedAt));
    },

    /** Percent complete 0-100. */
    progressPercent(state: ChallengeState): number {
        return Math.min(100, Math.round((state.progressDays.length / TARGET_DAYS) * 100));
    },

    subscribe(l: Listener): () => void {
        listeners.add(l);
        return () => { listeners.delete(l); };
    },

    TARGET_DAYS,
};
