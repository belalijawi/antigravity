import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'hifz_progress_v1';
const STREAK_KEY = 'hifz_streak_v1';
const DAILY_GOAL_KEY = 'hifz_daily_goal_v1';
const DAILY_PROGRESS_KEY = 'hifz_daily_progress_v1';
const SESSION_RESUME_PREFIX = 'hifz_session_resume_v1_';

export type HifzRating = 'forgot' | 'hard' | 'good' | 'easy';

export interface HifzAyah {
    surahNumber: number;
    ayahNumber: number;
    level: 0 | 1 | 2 | 3 | 4 | 5;
    nextReview: string; // ISO date string
    reviewCount: number;
    forgotCount: number; // lifetime total of 'forgot' ratings — used for hardest ayahs view
    lastReviewed: string; // ISO date string

    // ── Adaptive spaced-repetition (SM-2 derived) ─────────────────────
    // These drive the *schedule*. `level` (above) is kept separate and only
    // drives the visual word-hiding difficulty (HIDE_FRACTION). Older entries
    // created before this upgrade won't have these fields — computeSrs() seeds
    // sensible defaults from `level` on the first review, so nothing breaks.
    ease?: number;     // ease factor — grows with "easy", shrinks with "hard"/"forgot". [1.3, 2.7]
    interval?: number; // current scheduling interval in days
    reps?: number;     // consecutive successful (non-forgot) reviews
    lapses?: number;   // lifetime count of "forgot" lapses
}

export interface SavedSession {
    surahNumber: number;
    queue: any[]; // QueueItem[]
    queuePos: number;
    sessionResults: any[];
    savedAt: string; // ISO date
}

export interface StreakData {
    lastPracticeDate: string; // YYYY-MM-DD
    currentStreak: number;
    longestStreak: number;
}

// How many words are hidden at each level (fraction of total words)
export const HIDE_FRACTION: Record<number, number> = {
    0: 0,    // All visible — just introduced
    1: 0.2,  // 20% hidden
    2: 0.4,  // 40% hidden
    3: 0.6,  // 60% hidden
    4: 0.8,  // 80% hidden
    5: 1.0,  // All hidden — full recall
};

function todayStr(): string {
    return new Date().toISOString().slice(0, 10);
}

// ── Adaptive scheduling constants (SM-2 derived) ────────────────────
const DEFAULT_EASE = 2.5;
const MIN_EASE = 1.3;
const MAX_EASE = 2.7;
const MAX_INTERVAL = 365; // cap so intervals don't run away to years

function clampEase(e: number): number {
    return Math.min(MAX_EASE, Math.max(MIN_EASE, e));
}

// Legacy fixed-table fallback — used to seed `interval` for ayahs created
// before adaptive scheduling existed, so their first adaptive review starts
// from a schedule comparable to what they had before.
function legacyIntervalForLevel(level: number): number {
    const intervals = [1, 3, 5, 7, 14, 21];
    return intervals[level] ?? 21;
}

export interface SrsState {
    ease: number;
    interval: number; // days
    reps: number;
    lapses: number;
    nextReview: string; // ISO date string
}

/**
 * Adaptive spaced-repetition schedule (SM-2 derived, tuned for Quran hifz).
 *
 * Unlike the old fixed lookup table, the interval here grows by the ayah's
 * *own* ease factor, so an ayah a user finds easy stretches out fast while a
 * stubborn one stays tight — each ayah gets its own personalized schedule.
 *
 *   forgot → lapse: reset reps, review tomorrow, drop ease
 *   hard   → grow slowly (×1.2), drop ease a little
 *   good   → grow by ease, ease unchanged
 *   easy   → grow by ease with a bonus, raise ease
 *
 * Back-compat: `prev` may lack ease/interval/reps (entries from before this
 * upgrade) — we seed them from the legacy `level` so the transition is smooth.
 */
export function computeSrs(
    prev: { ease?: number; interval?: number; reps?: number; lapses?: number; level?: number },
    rating: HifzRating,
    now: Date = new Date(),
): SrsState {
    const ease0 = prev.ease ?? DEFAULT_EASE;
    const reps0 = prev.reps ?? (prev.level ?? 0); // legacy level ≈ successful reps
    const interval0 = prev.interval ?? legacyIntervalForLevel(prev.level ?? 0);
    const lapses0 = prev.lapses ?? 0;

    let ease = ease0;
    let reps: number;
    let lapses = lapses0;
    let interval: number;

    if (rating === 'forgot') {
        ease = clampEase(ease - 0.20);
        reps = 0;
        lapses = lapses0 + 1;
        interval = 1; // relearn tomorrow
    } else {
        if (rating === 'hard') ease = clampEase(ease - 0.15);
        else if (rating === 'easy') ease = clampEase(ease + 0.15);
        // 'good' leaves ease unchanged

        reps = reps0 + 1;
        if (reps === 1) {
            interval = 1;
        } else if (reps === 2) {
            interval = rating === 'easy' ? 4 : 3;
        } else {
            const base = Math.max(1, interval0);
            const mult = rating === 'hard' ? 1.2 : rating === 'easy' ? ease * 1.3 : ease;
            interval = Math.round(base * mult);
        }
        interval = Math.min(MAX_INTERVAL, Math.max(1, interval));
    }

    return { ease, interval, reps, lapses, nextReview: addDays(now, interval).toISOString() };
}

/**
 * How many days until the next review if the user rates this ayah `rating`.
 * Drives the live preview under each rating button. Uses the ayah's actual
 * stored SRS state so the preview reflects the real adaptive schedule.
 */
export function previewIntervalDays(
    prev: { ease?: number; interval?: number; reps?: number; lapses?: number; level?: number } | null | undefined,
    rating: HifzRating,
): number {
    return computeSrs(prev ?? {}, rating).interval;
}

// Days until next review based on rating and current level.
// DEPRECATED: kept for back-compat. New code should use computeSrs /
// previewIntervalDays, which schedule per-ayah by ease factor rather than a
// one-size-fits-all table.
export function nextIntervalDays(level: number, rating: HifzRating): number {
    if (rating === 'forgot') return 1;
    if (rating === 'hard') return 1;
    if (rating === 'good') {
        const intervals = [1, 3, 5, 7, 14, 21];
        return intervals[level] ?? 21;
    }
    // easy
    const intervals = [3, 7, 14, 21, 30, 60];
    return intervals[level] ?? 60;
}

export function newLevel(current: number, rating: HifzRating): HifzAyah['level'] {
    if (rating === 'forgot') return Math.max(0, current - 1) as HifzAyah['level'];
    if (rating === 'hard') return current as HifzAyah['level'];
    if (rating === 'good') return Math.min(5, current + 1) as HifzAyah['level'];
    return Math.min(5, current + 2) as HifzAyah['level'];
}

function addDays(date: Date, days: number): Date {
    const d = new Date(date);
    d.setDate(d.getDate() + days);
    return d;
}

// ── Core hifz data ─────────────────────────────────────────────────

export async function getAllHifzData(): Promise<Record<string, HifzAyah>> {
    try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (!raw) return {};
        return JSON.parse(raw);
    } catch {
        return {};
    }
}

function ayahKey(surahNumber: number, ayahNumber: number): string {
    return `${surahNumber}:${ayahNumber}`;
}

/**
 * Distinct surahs with any memorisation progress. Used by the free tier:
 * the FIRST surah is free (try-before-trial), the second hits the paywall.
 */
export async function getStartedSurahNumbers(): Promise<number[]> {
    const all = await getAllHifzData();
    return [...new Set(Object.values(all).map(a => a.surahNumber))];
}

export async function getAyahHifz(surahNumber: number, ayahNumber: number): Promise<HifzAyah | null> {
    const all = await getAllHifzData();
    return all[ayahKey(surahNumber, ayahNumber)] ?? null;
}

export async function initAyah(surahNumber: number, ayahNumber: number): Promise<HifzAyah> {
    const all = await getAllHifzData();
    const key = ayahKey(surahNumber, ayahNumber);
    if (all[key]) return all[key];

    const entry: HifzAyah = {
        surahNumber,
        ayahNumber,
        level: 0,
        nextReview: new Date().toISOString(),
        reviewCount: 0,
        forgotCount: 0,
        lastReviewed: new Date().toISOString(),
    };
    all[key] = entry;
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(all));
    return entry;
}

export async function recordReview(
    surahNumber: number,
    ayahNumber: number,
    rating: HifzRating
): Promise<HifzAyah> {
    const all = await getAllHifzData();
    const key = ayahKey(surahNumber, ayahNumber);
    const existing = all[key] ?? {
        surahNumber,
        ayahNumber,
        level: 0,
        reviewCount: 0,
        forgotCount: 0,
        lastReviewed: new Date().toISOString(),
        nextReview: new Date().toISOString(),
    };

    const updatedLevel = newLevel(existing.level, rating);
    // Schedule adaptively by this ayah's own ease/interval (SM-2 derived),
    // not a fixed table. `level` still advances independently to drive the
    // visual word-hiding difficulty.
    const srs = computeSrs(existing, rating);

    const updated: HifzAyah = {
        ...existing,
        level: updatedLevel,
        nextReview: srs.nextReview,
        ease: srs.ease,
        interval: srs.interval,
        reps: srs.reps,
        lapses: srs.lapses,
        reviewCount: existing.reviewCount + 1,
        forgotCount: (existing.forgotCount ?? 0) + (rating === 'forgot' ? 1 : 0),
        lastReviewed: new Date().toISOString(),
    };

    all[key] = updated;
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(all));
    return updated;
}

export async function getDueReviewsForSurah(surahNumber: number): Promise<HifzAyah[]> {
    const all = await getAllHifzData();
    const now = new Date();
    return Object.values(all).filter(
        a => a.surahNumber === surahNumber && new Date(a.nextReview) <= now
    ).sort((a, b) => a.ayahNumber - b.ayahNumber);
}

export async function getSurahHifzProgress(surahNumber: number): Promise<{
    total: number;
    started: number;
    mastered: number;
}> {
    const all = await getAllHifzData();
    const entries = Object.values(all).filter(a => a.surahNumber === surahNumber);
    return {
        total: entries.length,
        started: entries.filter(a => a.level > 0).length,
        mastered: entries.filter(a => a.level === 5).length,
    };
}

export async function setAyahHifz(entry: HifzAyah): Promise<void> {
    const all = await getAllHifzData();
    all[ayahKey(entry.surahNumber, entry.ayahNumber)] = entry;
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(all));
}

export async function removeAyahHifz(surahNumber: number, ayahNumber: number): Promise<void> {
    const all = await getAllHifzData();
    delete all[ayahKey(surahNumber, ayahNumber)];
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(all));
}

// ── Streak ─────────────────────────────────────────────────────────

export async function getStreakData(): Promise<StreakData> {
    try {
        const raw = await AsyncStorage.getItem(STREAK_KEY);
        if (raw) return JSON.parse(raw);
    } catch {}
    return { lastPracticeDate: '', currentStreak: 0, longestStreak: 0 };
}

export async function recordPracticeDay(): Promise<StreakData> {
    const today = todayStr();
    const prev = await getStreakData();
    if (prev.lastPracticeDate === today) return prev;

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yStr = yesterday.toISOString().slice(0, 10);

    const newStreak = prev.lastPracticeDate === yStr ? prev.currentStreak + 1 : 1;
    const updated: StreakData = {
        lastPracticeDate: today,
        currentStreak: newStreak,
        longestStreak: Math.max(newStreak, prev.longestStreak),
    };
    await AsyncStorage.setItem(STREAK_KEY, JSON.stringify(updated));
    return updated;
}

// ── Daily goal ─────────────────────────────────────────────────────

export async function getDailyGoal(): Promise<number> {
    try {
        const raw = await AsyncStorage.getItem(DAILY_GOAL_KEY);
        if (raw) return parseInt(raw, 10);
    } catch {}
    return 5;
}

export async function setDailyGoal(n: number): Promise<void> {
    await AsyncStorage.setItem(DAILY_GOAL_KEY, n.toString());
}

export async function getTodayProgress(): Promise<number> {
    try {
        const raw = await AsyncStorage.getItem(DAILY_PROGRESS_KEY);
        if (raw) {
            const p = JSON.parse(raw);
            if (p.date === todayStr()) return p.count;
        }
    } catch {}
    return 0;
}

// ── Session resume ─────────────────────────────────────────────────

export async function saveSession(surahNumber: number, session: Omit<SavedSession, 'surahNumber' | 'savedAt'>): Promise<void> {
    const data: SavedSession = { ...session, surahNumber, savedAt: new Date().toISOString() };
    await AsyncStorage.setItem(`${SESSION_RESUME_PREFIX}${surahNumber}`, JSON.stringify(data));
}

export async function loadSession(surahNumber: number): Promise<SavedSession | null> {
    try {
        const raw = await AsyncStorage.getItem(`${SESSION_RESUME_PREFIX}${surahNumber}`);
        if (!raw) return null;
        const session: SavedSession = JSON.parse(raw);
        // Discard sessions older than 24 hours
        const age = Date.now() - new Date(session.savedAt).getTime();
        if (age > 24 * 60 * 60 * 1000) {
            await AsyncStorage.removeItem(`${SESSION_RESUME_PREFIX}${surahNumber}`);
            return null;
        }
        return session;
    } catch {
        return null;
    }
}

export async function clearSession(surahNumber: number): Promise<void> {
    await AsyncStorage.removeItem(`${SESSION_RESUME_PREFIX}${surahNumber}`);
}

// ── Hardest ayahs ──────────────────────────────────────────────────

export async function getHardestAyahs(surahNumber: number, limit = 5): Promise<HifzAyah[]> {
    const all = await getAllHifzData();
    return Object.values(all)
        .filter(a => a.surahNumber === surahNumber && (a.forgotCount ?? 0) > 0)
        .sort((a, b) => (b.forgotCount ?? 0) - (a.forgotCount ?? 0))
        .slice(0, limit);
}

export async function addTodayProgress(n: number): Promise<number> {
    const today = todayStr();
    let count = 0;
    try {
        const raw = await AsyncStorage.getItem(DAILY_PROGRESS_KEY);
        if (raw) {
            const p = JSON.parse(raw);
            if (p.date === today) count = p.count;
        }
    } catch {}
    count += n;
    await AsyncStorage.setItem(DAILY_PROGRESS_KEY, JSON.stringify({ date: today, count }));
    return count;
}
