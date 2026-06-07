/**
 * Feature Discovery engine.
 *
 * One source of truth for "what has this user discovered / used?" — drives:
 *   1. Contextual prompt cards (surface a feature at the right moment)
 *   2. First-run spotlight tour
 *   3. Nav/card badges (the red dot)
 *   4. Empty states
 *   5. Feature-nudge notifications
 *   6. "What's New" modal
 *
 * Premium features carry `premium: true`. The UI decides whether tapping a
 * discovery surface opens the feature (premium user) or the paywall (free user).
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

export type FeatureId =
    | 'mosque_timetable'
    | 'accountability_partner'
    | 'hifz_mode'
    | 'tasbeeh_stats'
    | 'prayer_analytics'
    | 'dua_wall'
    | 'global_map'
    | 'qibla'
    | 'challenges'
    | 'testimonies'
    | 'night_journal';

export interface FeatureMeta {
    id: FeatureId;
    label: string;
    blurb: string;       // one-line "why you'd care"
    premium: boolean;
}

export const FEATURES: Record<FeatureId, FeatureMeta> = {
    mosque_timetable: {
        id: 'mosque_timetable',
        label: 'Mosque Timetable',
        blurb: 'Photograph your mosque\'s timetable — the app reads every prayer time automatically.',
        premium: true,
    },
    accountability_partner: {
        id: 'accountability_partner',
        label: 'Accountability Partner',
        blurb: 'Pray Tahajjud with a friend — see when they pray, send wake-up calls.',
        premium: true,
    },
    hifz_mode: {
        id: 'hifz_mode',
        label: 'Hifz Mode',
        blurb: 'Memorise the Quran with structured, spaced repetition.',
        premium: true,
    },
    tasbeeh_stats: {
        id: 'tasbeeh_stats',
        label: 'Dhikr Stats',
        blurb: 'Track your all-time dhikr count, daily streak, and weekly chart.',
        premium: true,
    },
    prayer_analytics: {
        id: 'prayer_analytics',
        label: 'Prayer Analytics',
        blurb: 'See your consistency, strongest and weakest prayers, and trends.',
        premium: true,
    },
    dua_wall: {
        id: 'dua_wall',
        label: 'Dua Wall',
        blurb: 'Post a dua anonymously — thousands of Muslims will say Ameen.',
        premium: false,
    },
    global_map: {
        id: 'global_map',
        label: 'Global Tahajjud Map',
        blurb: 'See Muslims praying Tahajjud across the world right now.',
        premium: false,
    },
    qibla: {
        id: 'qibla',
        label: 'Qibla Compass',
        blurb: 'Find the direction of the Kaaba from anywhere.',
        premium: false,
    },
    challenges: {
        id: 'challenges',
        label: 'Tahajjud Challenge',
        blurb: 'Commit to 40 nights and transform your relationship with the night.',
        premium: false,
    },
    testimonies: {
        id: 'testimonies',
        label: 'Share Your Story',
        blurb: 'Read how Tahajjud changed others — and share your own story with the ummah.',
        premium: false,
    },
    night_journal: {
        id: 'night_journal',
        label: 'Night Journal',
        blurb: 'Reflect after every Tahajjud — a private record of your nights with Allah.',
        premium: true,
    },
};

const USED_KEY = 'feature-used-v1';        // JSON: { [id]: true }
const WHATSNEW_KEY = 'whatsnew-seen-version-v1';

let usedCache: Record<string, boolean> | null = null;

async function loadUsed(): Promise<Record<string, boolean>> {
    if (usedCache) return usedCache;
    try {
        const raw = await AsyncStorage.getItem(USED_KEY);
        usedCache = raw ? JSON.parse(raw) : {};
        return usedCache!;
    } catch {
        // Don't poison the cache on a transient failure — return a throwaway
        // empty object so the next call retries the read instead of caching {}.
        return {};
    }
}

/** Mark a feature as used — call when the user actually engages with it. */
export async function markFeatureUsed(id: FeatureId): Promise<void> {
    const used = await loadUsed();
    if (used[id]) return;
    used[id] = true;
    usedCache = used;
    try { await AsyncStorage.setItem(USED_KEY, JSON.stringify(used)); } catch { /* ignore */ }
}

export async function hasUsedFeature(id: FeatureId): Promise<boolean> {
    const used = await loadUsed();
    return !!used[id];
}

/** All features the user has never engaged with. */
export async function unusedFeatures(): Promise<FeatureMeta[]> {
    const used = await loadUsed();
    return (Object.keys(FEATURES) as FeatureId[])
        .filter(id => !used[id])
        .map(id => FEATURES[id]);
}

// ── Discover card rotation ──────────────────────────────────────────────────
// Shows a DIFFERENT feature each time the card is rendered, cycling through the
// features the user hasn't tried yet. A stored pointer advances on every call so
// it never shows the same one twice in a row.
const ROTATION_KEY = 'feature-rotation-ptr-v1';

export async function getNextDiscoverFeature(): Promise<FeatureMeta | null> {
    const unused = await unusedFeatures();
    if (unused.length === 0) return null; // they've discovered everything 🎉

    let ptr = 0;
    try {
        const raw = await AsyncStorage.getItem(ROTATION_KEY);
        ptr = raw ? parseInt(raw, 10) : 0;
    } catch { /* default 0 */ }

    const pick = unused[ptr % unused.length];

    // Advance the pointer for next time
    try { await AsyncStorage.setItem(ROTATION_KEY, String((ptr + 1) % 1000000)); } catch { /* ignore */ }

    return pick;
}

// ── Feature nudge notification ──────────────────────────────────────────────
const NUDGE_KEY = 'feature-nudge-last-v1';
const NUDGE_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000; // at most one feature nudge / week

/**
 * Schedules a gentle local notification pointing at an unused feature, ~2 days
 * out. Throttled to once a week. Safe to call on every app open. Skips premium
 * features for premium users isn't needed — discovering them is still useful.
 */
export async function maybeScheduleFeatureNudge(): Promise<void> {
    try {
        const Notifications = await import('expo-notifications');
        const { status } = await Notifications.getPermissionsAsync();
        if (status !== 'granted') return;

        const lastRaw = await AsyncStorage.getItem(NUDGE_KEY);
        const last = lastRaw ? parseInt(lastRaw, 10) : 0;
        if (Date.now() - last < NUDGE_COOLDOWN_MS) return;

        const unused = await unusedFeatures();
        if (unused.length === 0) return; // they've tried everything

        // Pick one at random for variety
        const pick = unused[Math.floor(Math.random() * unused.length)];

        const fireDate = new Date();
        fireDate.setDate(fireDate.getDate() + 2);
        fireDate.setHours(19, 0, 0, 0); // early evening

        const { Platform } = await import('react-native');
        await Notifications.scheduleNotificationAsync({
            content: {
                title: `Have you tried ${pick.label}?`,
                body: pick.blurb,
                sound: 'default',
                data: { type: 'feature_nudge', featureId: pick.id },
            },
            trigger: {
                type: Notifications.SchedulableTriggerInputTypes.DATE,
                date: fireDate,
                ...(Platform.OS === 'android' && { channelId: 'prayers' }),
            } as any,
        });

        await AsyncStorage.setItem(NUDGE_KEY, String(Date.now()));
    } catch { /* never block app open */ }
}

// ── What's New ──────────────────────────────────────────────────────────────
export async function shouldShowWhatsNew(currentVersion: string): Promise<boolean> {
    try {
        const seen = await AsyncStorage.getItem(WHATSNEW_KEY);
        return seen !== currentVersion;
    } catch { return false; }
}
export async function markWhatsNewSeen(currentVersion: string): Promise<void> {
    try { await AsyncStorage.setItem(WHATSNEW_KEY, currentVersion); } catch { /* ignore */ }
}
