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

// Days until next review based on rating and current level
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
    const days = nextIntervalDays(existing.level, rating);
    const nextReview = addDays(new Date(), days).toISOString();

    const updated: HifzAyah = {
        ...existing,
        level: updatedLevel,
        nextReview,
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
