/**
 * Dhikr & Quran-reading leaderboard — opt-in only.
 *
 * Nobody appears here unless they deliberately choose a nickname (see
 * `optIn`). Opting out deletes the document entirely — no lingering hidden
 * record, no field-visibility puzzle. This mirrors the Dua Wall's opt-in
 * map-pin pattern rather than the app's usual fully-anonymous default,
 * because a leaderboard is meaningless without SOME persistent identity to
 * rank — but that identity is a user-chosen nickname, never tied to any
 * other part of the app.
 *
 * Anti-cheat: Firestore rules cap how much a score can increase per elapsed
 * real time (see firestore.rules `leaderboard/{uid}`), not just how often
 * you can write — the `rate-limits` pattern used elsewhere in this app only
 * bounds write FREQUENCY, which does nothing to stop someone submitting
 * "+999999" in a single write. `updatedAt` is stamped in the same batch as
 * any count change, and rules verify the delta against the elapsed time
 * since that stamp.
 */

import {
    collection, doc, getDoc, setDoc, updateDoc, deleteDoc, getDocs,
    query, where, orderBy, limit, getCountFromServer, getAggregateFromServer, sum,
    serverTimestamp, increment, writeBatch, runTransaction, Timestamp,
} from 'firebase/firestore';
import { getISOWeek, getISOWeekYear } from 'date-fns';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getFirebaseAuth, getFirebaseDb, ensureSignedIn } from './firebase';
import RevenueCatService from '../services/revenueCat';

export type LeaderboardMetric = 'dhikr' | 'quranAyahs' | 'tahajjud';
export type LeaderboardWindow = 'week' | 'allTime';

// Rank tiers worth telling someone about, best (lowest number) to loosest —
// crossing INTO one is a celebration, crossing OUT of one is "you got
// overtaken." Chosen to be meaningful at very different community sizes:
// #1 and Top 3 still mean something once the board has hundreds of people,
// while Top 10/Top 50 give newer/smaller boards a milestone to reach for
// too, rather than only ever mattering once someone's already near the top.
const RANK_TIERS = [1, 3, 10, 50];

// Guards checkRankMilestones against overlapping calls for the same metric.
// getMyRank always does a fresh, uncached Firestore round-trip (getDoc +
// getCountFromServer) — if two syncDelta calls for the same metric land close
// together (e.g. a debounced flush racing another sync trigger), each would
// independently query mid-flight and could see different transient states,
// producing flapping "climbed"/"dropped" notifications for the same
// metric+window a few seconds apart even though nothing really changed.
// Coalescing means the second call is a no-op — safe, because syncDelta
// always writes its own Firestore update BEFORE calling this, so whichever
// call actually runs already sees both increments.
const rankCheckInFlight = new Set<LeaderboardMetric>();

// Second layer of defense on top of rankCheckInFlight above. Keyed by METRIC
// alone, not metric+window: checkRankMilestones checks 'week' then 'allTime'
// back-to-back for the same metric, and a real, busy leaderboard can easily
// have one window's rank climb while the other's drops in the same instant
// (someone else's concurrent write landing between the two independent
// getMyRank round-trips). That reads as flatly contradictory spam to the
// user ("climbed all-time" + "dropped weekly" a second apart) even though
// each individual number is technically accurate — so only the first
// tier-change notification for a metric gets through per cooldown window,
// regardless of which window it came from.
const lastTierNotifyAt = new Map<LeaderboardMetric, number>();
const TIER_NOTIFY_COOLDOWN_MS = 30_000;

function tierFor(rank: number): number {
    for (const tier of RANK_TIERS) if (rank <= tier) return tier;
    return Infinity;
}
const METRIC_LABELS: Record<LeaderboardMetric, string> = {
    dhikr: 'Dhikr', quranAyahs: "Qur'an reading", tahajjud: 'Tahajjud',
};

const MAX_NICKNAME_LENGTH = 24;
const REPORT_THRESHOLD = 5;

// Same word-boundary tokenize + Set lookup convention as duaWall.ts/comments.ts
// — each feature keeps its own short list rather than sharing one module.
const FORBIDDEN_WORDS = [
    'fuck', 'shit', 'bitch', 'cunt', 'dick', 'pussy', 'asshole',
    'kill', 'murder', 'suicide', 'rape',
];

export interface LeaderboardEntry {
    uid: string;
    nickname: string;
    country?: string; // ISO alpha-2, e.g. "US" — self-reported, see utils/countries.ts
    value: number;
    // Quiet supporter mark, same visual as the Dua Wall's comment badge —
    // unlike that one this is refreshed on every opt-in/count sync rather
    // than frozen at post time, since a leaderboard row is long-lived and
    // should reflect current status, not a snapshot from whenever someone
    // first opted in.
    isPremium?: boolean;
}

export interface LeaderboardStatus {
    optedIn: boolean;
    nickname?: string;
    country?: string;
    // Raw per-metric values from the SAME doc read this status came from —
    // free, since getStatus() already fetches the whole leaderboard/{uid}
    // doc. Lets getMyRank skip its own redundant getDoc when a fresh status
    // is already in hand (see Leaderboard.tsx's board-load effect).
    values?: Record<LeaderboardMetric, { week: number; allTime: number }>;
}

/** Full row shape for the admin moderation panel — everything a moderator
 * needs to judge a nickname/entry, not just the public ranking fields. */
export interface LeaderboardAdminEntry {
    uid: string;
    nickname: string;
    country?: string;
    reportCount: number;
    hidden: boolean;
    dhikrAllTime: number;
    quranAllTime: number;
    tahajjudAllTime: number;
}

function currentWeekKey(): string {
    const now = new Date();
    // getISOWeek can return 1 while getISOWeekYear still reports the prior
    // year in the last days of December — pairing them is what makes this a
    // correct, sortable-enough key (never actually sorted on, just compared
    // for equality to detect rollover).
    return `${getISOWeekYear(now)}-W${String(getISOWeek(now)).padStart(2, '0')}`;
}

function validateNickname(raw: string): { ok: boolean; error?: 'too-short' | 'too-long' | 'profanity' } {
    const trimmed = raw.trim();
    if (trimmed.length === 0) return { ok: false, error: 'too-short' };
    if (trimmed.length > MAX_NICKNAME_LENGTH) return { ok: false, error: 'too-long' };
    const tokens = trimmed.toLowerCase().split(/[^a-z']+/).filter(Boolean);
    const tokenSet = new Set(tokens);
    for (const w of FORBIDDEN_WORDS) {
        if (tokenSet.has(w)) return { ok: false, error: 'profanity' };
    }
    return { ok: true };
}

export const Leaderboard = {
    MAX_NICKNAME_LENGTH,

    /** Local-only: has this device opted in, and with what nickname?
     * Cheap cached read (AsyncStorage-free — just reads the user's own doc,
     * which is fine since it's a single small doc, not a list). */
    async getStatus(): Promise<LeaderboardStatus> {
        try {
            await ensureSignedIn();
            const user = getFirebaseAuth()?.currentUser;
            if (!user) return { optedIn: false };
            const db = getFirebaseDb();
            const snap = await getDoc(doc(db, 'leaderboard', user.uid));
            if (!snap.exists()) return { optedIn: false };
            const data = snap.data() as any;
            return {
                optedIn: true, nickname: data.nickname, country: data.country,
                values: {
                    dhikr: { week: data.dhikr?.week ?? 0, allTime: data.dhikr?.allTime ?? 0 },
                    quranAyahs: { week: data.quranAyahs?.week ?? 0, allTime: data.quranAyahs?.allTime ?? 0 },
                    tahajjud: { week: data.tahajjud?.week ?? 0, allTime: data.tahajjud?.allTime ?? 0 },
                },
            };
        } catch { return { optedIn: false }; }
    },

    /** Opt in (or change nickname/country while already in) — creates/
     * overwrites this device's leaderboard doc. Starts every counter at 0;
     * existing local tallies get folded in on the next periodic sync, same
     * as any other delta. Country is optional and self-reported — never
     * derived from GPS (see utils/countries.ts for why). */
    async optIn(nickname: string, country?: string | null): Promise<{ ok: boolean; error?: string }> {
        const v = validateNickname(nickname);
        if (!v.ok) return { ok: false, error: v.error };
        const countryCode = country ? country.toUpperCase() : null;
        try {
            await ensureSignedIn();
            const user = getFirebaseAuth()?.currentUser;
            if (!user) return { ok: false, error: 'not-signed-in' };
            const db = getFirebaseDb();
            const ref = doc(db, 'leaderboard', user.uid);
            const existing = await getDoc(ref);
            // Best-effort — a failed RevenueCat call shouldn't block opting in;
            // worst case the badge is just missing until the next sync.
            const isPremium = await RevenueCatService.checkPremiumStatus().catch(() => false);
            if (existing.exists()) {
                // Renaming/re-flagging — leave counts untouched.
                await updateDoc(ref, {
                    nickname: nickname.trim(),
                    ...(countryCode ? { country: countryCode } : {}),
                    isPremium,
                });
            } else {
                await setDoc(ref, {
                    nickname: nickname.trim(),
                    ...(countryCode ? { country: countryCode } : {}),
                    weekKey: currentWeekKey(),
                    dhikr: { week: 0, allTime: 0 },
                    quranAyahs: { week: 0, allTime: 0 },
                    tahajjud: { week: 0, allTime: 0 },
                    reportCount: 0,
                    hidden: false,
                    isPremium,
                    updatedAt: serverTimestamp(),
                });
            }
            return { ok: true };
        } catch (e) {
            console.error('[Leaderboard] optIn error', e);
            return { ok: false, error: 'firestore-error' };
        }
    },

    /**
     * Refresh just the premium badge flag — call with a value the caller
     * ALREADY has in hand (usePurchases()'s isPremium), never fetches its
     * own RevenueCat status. Deliberately kept separate from syncDelta:
     * that function is fired from the dhikr/Quran debounced flush at the
     * exact moment the app is backgrounding (see App.tsx), which already
     * races iOS suspending the process — adding another async round-trip
     * there would only make that worse. The Leaderboard screen already
     * knows isPremium for free, so it calls this on open instead. Silently
     * no-ops if not opted in (no doc to update) or if the value hasn't
     * actually changed since the last write.
     */
    async updatePremiumFlag(isPremium: boolean): Promise<void> {
        try {
            await ensureSignedIn();
            const user = getFirebaseAuth()?.currentUser;
            if (!user) return;
            const db = getFirebaseDb();
            const ref = doc(db, 'leaderboard', user.uid);
            const snap = await getDoc(ref);
            if (!snap.exists()) return;
            if ((snap.data() as any).isPremium === isPremium) return; // already current
            await updateDoc(ref, { isPremium });
        } catch { /* best-effort — badge staleness isn't worth surfacing an error over */ }
    },

    /** Opt out — deletes the doc entirely. Nothing lingers. */
    async optOut(): Promise<boolean> {
        try {
            await ensureSignedIn();
            const user = getFirebaseAuth()?.currentUser;
            if (!user) return false;
            const db = getFirebaseDb();
            await deleteDoc(doc(db, 'leaderboard', user.uid));
            return true;
        } catch (e) {
            console.error('[Leaderboard] optOut error', e);
            return false;
        }
    },

    /**
     * Push a delta (e.g. +12 dhikr since the last sync) for one metric.
     * No-ops silently if the user hasn't opted in — callers don't need to
     * check status first. Handles the weekly rollover client-side (no
     * Cloud Functions exist in this app): if the stored weekKey is stale,
     * `week` resets to just this delta instead of accumulating.
     */
    async syncDelta(metric: LeaderboardMetric, delta: number): Promise<void> {
        if (delta <= 0) return;
        try {
            await ensureSignedIn();
            const user = getFirebaseAuth()?.currentUser;
            if (!user) return;
            const db = getFirebaseDb();
            const ref = doc(db, 'leaderboard', user.uid);

            // A Firestore TRANSACTION, not a plain getDoc()+writeBatch(). This
            // metric's write depends on a decision (has the week rolled over?)
            // made from a value read a moment earlier — a plain read-then-write
            // has a window where a second sync for a DIFFERENT metric on this
            // same doc (dhikr/quranAyahs/tahajjud all share one `weekKey`) can
            // land in between, based on the same stale "not yet rolled over"
            // read. Whichever write commits second would then overwrite the
            // week figure with just ITS OWN delta instead of adding to what the
            // first write already contributed — the leaderboard equivalent of
            // the local dhikr-count bug already fixed in TasbeehCard.tsx,
            // just on the server side instead of in a React closure. A
            // transaction retries automatically with a fresh read if the doc
            // changed since it was read, so this can't happen regardless of
            // how many syncs land close together.
            await runTransaction(db, async (tx) => {
                const snap = await tx.get(ref);
                if (!snap.exists()) return; // not opted in — nothing to sync
                const data = snap.data() as any;
                const isNewWeek = data.weekKey !== currentWeekKey();
                const priorWeek = (data[metric]?.week ?? 0) as number;
                const priorAllTime = (data[metric]?.allTime ?? 0) as number;
                tx.update(ref, {
                    weekKey: currentWeekKey(),
                    [`${metric}.allTime`]: priorAllTime + delta,
                    // A genuine rollover REPLACES the weekly figure (rules
                    // allow this specific case even though it's a
                    // "decrease"); a same-week sync adds to it like allTime.
                    // Both computed from THIS transaction's own read, so a
                    // retry always adds on top of whatever is truly there.
                    [`${metric}.week`]: isNewWeek ? delta : priorWeek + delta,
                    updatedAt: serverTimestamp(),
                });
            });
            // Fire-and-forget: did this sync move the rank across a
            // meaningful tier (Top 1/3/10/50) for either window? Every
            // periodic count sync goes through this one function regardless
            // of caller (TasbeehCard, Quran reading, Tahajjud logging), so
            // this is the one place that needs to know about it — no need to
            // duplicate the check at each sync call site.
            this.checkRankMilestones(metric).catch(() => {});
        } catch (e: any) {
            // permission-denied here means the anti-cheat delta cap rejected
            // this update (implausibly large for the elapsed time) — that's
            // the rule working as intended, not an error to surface loudly.
            if (e?.code !== 'permission-denied') {
                console.error('[Leaderboard] syncDelta error', e);
            }
        }
    },

    /** Check both windows' rank for one metric and notify locally if either
     * crossed a meaningful tier boundary since the last check. */
    async checkRankMilestones(metric: LeaderboardMetric): Promise<void> {
        if (rankCheckInFlight.has(metric)) return;
        rankCheckInFlight.add(metric);
        try {
            for (const window of ['week', 'allTime'] as LeaderboardWindow[]) {
                const rank = await this.getMyRank(metric, window);
                if (rank) await this.trackRank(metric, window, rank.rank);
            }
        } finally {
            rankCheckInFlight.delete(metric);
        }
    },

    /**
     * Single source of truth for "what was this rank last time we checked" —
     * used by BOTH the Leaderboard screen's own up/down rank-change arrow
     * AND the tier-crossing notification below, so there's only ever one
     * read-then-write of the stored previous rank (having two independent
     * places update the same AsyncStorage key would race: whichever ran
     * second would compare against a value the first one had already
     * advanced to the current rank moments earlier).
     *
     * Returns the same {direction, delta} shape the UI's rank-change
     * indicator needs, so Leaderboard.tsx can call this directly instead of
     * keeping its own copy of this logic.
     */
    async trackRank(
        metric: LeaderboardMetric, window: LeaderboardWindow, currentRank: number,
    ): Promise<{ direction: 'up' | 'down'; delta: number } | null> {
        const key = `leaderboard-prev-rank-${metric}-${window}`;
        try {
            const prevRaw = await AsyncStorage.getItem(key);
            await AsyncStorage.setItem(key, String(currentRank));
            if (!prevRaw) return null;
            const prevRank = parseInt(prevRaw, 10);
            if (prevRank === currentRank) return null;
            this.maybeNotifyTierChange(metric, window, prevRank, currentRank).catch(() => {});
            // Lower rank number is better — moving from #12 to #9 is an
            // improvement ("up"), not a decrease in value.
            return { direction: currentRank < prevRank ? 'up' : 'down', delta: Math.abs(prevRank - currentRank) };
        } catch { return null; }
    },

    /** Fires a local notification only when a rank change actually crosses
     * one of RANK_TIERS' boundaries — a rank moving from #47 to #45 isn't
     * worth a push, but #11 → #9 (entering the Top 10) is. */
    async maybeNotifyTierChange(
        metric: LeaderboardMetric, window: LeaderboardWindow, prevRank: number, newRank: number,
    ): Promise<void> {
        const prevTier = tierFor(prevRank);
        const newTier = tierFor(newRank);
        if (newTier === prevTier) return;
        const lastAt = lastTierNotifyAt.get(metric) ?? 0;
        if (Date.now() - lastAt < TIER_NOTIFY_COOLDOWN_MS) return;
        lastTierNotifyAt.set(metric, Date.now());
        const metricLabel = METRIC_LABELS[metric];
        const windowLabel = window === 'week' ? 'this week' : 'all-time';
        const { notifyNow } = await import('./notifications');
        if (newTier < prevTier) {
            const title = newTier === 1 ? `🥇 You're #1 in ${metricLabel}!` : `🏆 Top ${newTier} in ${metricLabel}!`;
            await notifyNow(title,
                `You just climbed into the Top ${newTier} for ${metricLabel} (${windowLabel}) — keep it up!`,
                { type: 'leaderboard_rank', metric, window });
        } else {
            await notifyNow('Someone passed you',
                `You dropped out of the Top ${prevTier} for ${metricLabel} (${windowLabel}). Tap to reclaim your spot.`,
                { type: 'leaderboard_rank', metric, window });
        }
    },

    /** Top N for one metric+window, optionally scoped to a single country
     * (the "My Country" view — same doc set, just filtered).
     *
     * Excludes zero scorers for THIS metric — every opted-in user has all
     * three metric fields on their one doc (a dhikr-only person still has
     * quranAyahs: 0), so without this filter every board would list every
     * opted-in user, just padded with 0s at the bottom. That's exactly the
     * "same people show up on every board" problem — filtering to value > 0
     * means the Quran board only ever shows people who've actually read
     * Quran, not the whole dhikr crowd sitting at zero. The inequality is on
     * the same field already being sorted, so this needs no new index. */
    async getTopN(metric: LeaderboardMetric, window: LeaderboardWindow, limitN = 50, countryFilter?: string | null): Promise<LeaderboardEntry[]> {
        try {
            await ensureSignedIn();
            const db = getFirebaseDb();
            const field = `${metric}.${window}`;
            const constraints = [where('hidden', '==', false), where(field, '>', 0)];
            if (countryFilter) constraints.push(where('country', '==', countryFilter));
            const snap = await getDocs(query(
                collection(db, 'leaderboard'),
                ...constraints,
                orderBy(field, 'desc'),
                limit(limitN),
            ));
            return snap.docs.map(d => ({
                uid: d.id,
                nickname: (d.data() as any).nickname ?? 'Anonymous',
                country: (d.data() as any).country,
                value: (d.data() as any)[metric]?.[window] ?? 0,
                isPremium: (d.data() as any).isPremium ?? false,
            }));
        } catch (e) {
            console.error('[Leaderboard] getTopN error', e);
            return [];
        }
    },

    /** Combined total for a metric+window across every opted-in member —
     * "the community said N dhikr this week," not just the top-50 you can
     * see. Uses Firestore's server-side sum() aggregation (no per-doc reads,
     * same cost class as getCountFromServer) so this scales the same way
     * regardless of how many people are on the board. Reflects opted-in
     * leaderboard members only, not every app user — this app has no
     * separate whole-app counter for dhikr/Quran reading independent of
     * leaderboard opt-in (unlike the Tahajjud map's anonymous dot count). */
    async getCommunityTotal(metric: LeaderboardMetric, window: LeaderboardWindow): Promise<number> {
        try {
            await ensureSignedIn();
            const db = getFirebaseDb();
            const field = `${metric}.${window}`;
            const snap = await getAggregateFromServer(
                query(collection(db, 'leaderboard'), where('hidden', '==', false)),
                { total: sum(field) },
            );
            return snap.data().total ?? 0;
        } catch (e) {
            console.error('[Leaderboard] getCommunityTotal error', e);
            return 0;
        }
    },

    /** This user's rank (1-based) and the total participant count for a
     * metric+window, optionally scoped to a single country. Uses
     * getCountFromServer (aggregation-only, no document reads) — same
     * pattern as the Home card's daily total.
     *
     * `preloadedValue` lets a caller that already has a fresh
     * leaderboard/{uid} read in hand (getStatus() fetches the exact same
     * doc, usually already in flight in parallel) skip this function's own
     * getDoc entirely — collapsing it from two sequential round-trips
     * (read my doc, THEN run the two counts) down to one, matching
     * getTopN/getCommunityTotal's single round-trip. This was the actual
     * remaining reason the leaderboard felt slow to load even after the
     * outer status/board waterfall was fixed — getMyRank alone was still
     * twice as slow as its siblings inside the same Promise.all. */
    async getMyRank(metric: LeaderboardMetric, window: LeaderboardWindow, countryFilter?: string | null, preloadedValue?: number): Promise<{ rank: number; total: number; value: number } | null> {
        try {
            await ensureSignedIn();
            const user = getFirebaseAuth()?.currentUser;
            if (!user) return null;
            const db = getFirebaseDb();
            let myValue: number;
            if (preloadedValue !== undefined) {
                myValue = preloadedValue;
            } else {
                const mySnap = await getDoc(doc(db, 'leaderboard', user.uid));
                if (!mySnap.exists()) return null;
                myValue = (mySnap.data() as any)[metric]?.[window] ?? 0;
            }

            const field = `${metric}.${window}`;
            const baseConstraints = [where('hidden', '==', false)];
            if (countryFilter) baseConstraints.push(where('country', '==', countryFilter));
            const [aboveSnap, totalSnap] = await Promise.all([
                getCountFromServer(query(
                    collection(db, 'leaderboard'),
                    ...baseConstraints,
                    where(field, '>', myValue),
                )),
                // Total participants for THIS metric — matches getTopN's own
                // value > 0 filter, so "rank X of Y" always corresponds to Y
                // people who actually appear in the list above, not every
                // opted-in user regardless of whether they've done anything
                // for this specific metric.
                getCountFromServer(query(
                    collection(db, 'leaderboard'),
                    ...baseConstraints,
                    where(field, '>', 0),
                )),
            ]);
            return {
                rank: aboveSnap.data().count + 1,
                total: totalSnap.data().count,
                value: myValue,
            };
        } catch (e) {
            console.error('[Leaderboard] getMyRank error', e);
            return null;
        }
    },

    /**
     * The N closest entries above and below the given value — "who am I
     * actually racing," not the (likely unreachable) top of the board.
     * Reuses the SAME indexes as getMyRank's count queries (ascending AND
     * descending order on each metric field were both already deployed for
     * that), so this needed no new Firestore indexes.
     *
     * Returned in natural top-to-bottom rank order: highest value first.
     * `myValue` is passed in rather than re-read, since callers already have
     * it from getMyRank in the same load.
     */
    async getNearbyEntries(
        metric: LeaderboardMetric, window: LeaderboardWindow, myValue: number,
        aboveCount = 5, belowCount = 5, countryFilter?: string | null,
    ): Promise<{ above: LeaderboardEntry[]; below: LeaderboardEntry[] }> {
        try {
            await ensureSignedIn();
            const db = getFirebaseDb();
            const field = `${metric}.${window}`;
            const toEntry = (d: any): LeaderboardEntry => ({
                uid: d.id,
                nickname: (d.data() as any).nickname ?? 'Anonymous',
                country: (d.data() as any).country,
                value: (d.data() as any)[metric]?.[window] ?? 0,
                isPremium: (d.data() as any).isPremium ?? false,
            });
            const [aboveSnap, belowSnap] = await Promise.all([
                // Closest above me: smallest values that still beat mine,
                // ascending — index [0] is the nearest, not the furthest.
                getDocs(query(
                    collection(db, 'leaderboard'),
                    where('hidden', '==', false),
                    ...(countryFilter ? [where('country', '==', countryFilter)] : []),
                    where(field, '>', myValue),
                    orderBy(field, 'asc'),
                    limit(aboveCount),
                )),
                // Closest below me: largest values still under mine,
                // descending — index [0] is the nearest, matching the
                // top-to-bottom order this list is displayed in. Also
                // excludes 0 (same reason as getTopN) — otherwise someone
                // who's never touched this metric shows up as "just below
                // you" purely because 0 is technically less than your value.
                getDocs(query(
                    collection(db, 'leaderboard'),
                    where('hidden', '==', false),
                    ...(countryFilter ? [where('country', '==', countryFilter)] : []),
                    where(field, '>', 0),
                    where(field, '<', myValue),
                    orderBy(field, 'desc'),
                    limit(belowCount),
                )),
            ]);
            // Reversed so the row directly above "me" is the closest match,
            // and the row furthest above (best rank of the fetched set) is
            // at the very top — natural descending order for display.
            return {
                above: aboveSnap.docs.map(toEntry).reverse(),
                below: belowSnap.docs.map(toEntry),
            };
        } catch (e) {
            console.error('[Leaderboard] getNearbyEntries error', e);
            return { above: [], below: [] };
        }
    },

    /** Report a leaderboard entry's nickname — same idempotent-marker +
     * auto-hide-at-threshold convention as duas/comments. */
    async report(uid: string): Promise<boolean> {
        try {
            await ensureSignedIn();
            const user = getFirebaseAuth()?.currentUser;
            if (!user) return false;
            const db = getFirebaseDb();
            const reportId = `${user.uid}_${uid}`;
            const reportRef = doc(db, 'leaderboard-reports', reportId);
            const [existingSnap, targetSnap] = await Promise.all([
                getDoc(reportRef),
                getDoc(doc(db, 'leaderboard', uid)),
            ]);
            if (existingSnap.exists()) return true; // already reported — idempotent
            const currentCount = targetSnap.exists() ? ((targetSnap.data() as any).reportCount ?? 0) : 0;
            const willHide = (currentCount + 1) >= REPORT_THRESHOLD;

            const batch = writeBatch(db);
            batch.set(reportRef, { userId: user.uid, targetUid: uid, createdAt: serverTimestamp() });
            batch.update(doc(db, 'leaderboard', uid),
                willHide
                    ? { reportCount: increment(1), hidden: true }
                    : { reportCount: increment(1) }
            );
            await batch.commit();
            return true;
        } catch (e) {
            console.error('[Leaderboard] report error', e);
            return false;
        }
    },

    /** Admin: list every leaderboard entry, most-reported first then by
     * nickname — same "reported first" convention as DuaWall.adminListAll.
     * No orderBy in the query itself (there's no createdAt on this doc to
     * order by), so this just reads the whole collection and sorts client
     * side; fine at the scale a leaderboard realistically reaches. */
    async adminListAll(limitN: number = 500): Promise<LeaderboardAdminEntry[]> {
        try {
            const db = getFirebaseDb();
            const snap = await getDocs(query(collection(db, 'leaderboard'), limit(limitN)));
            const out: LeaderboardAdminEntry[] = [];
            snap.forEach(d => {
                const data = d.data() as any;
                out.push({
                    uid: d.id,
                    nickname: data.nickname ?? 'Anonymous',
                    country: data.country,
                    reportCount: data.reportCount ?? 0,
                    hidden: data.hidden ?? false,
                    dhikrAllTime: data.dhikr?.allTime ?? 0,
                    quranAllTime: data.quranAyahs?.allTime ?? 0,
                    tahajjudAllTime: data.tahajjud?.allTime ?? 0,
                });
            });
            out.sort((a, b) => {
                if (b.reportCount !== a.reportCount) return b.reportCount - a.reportCount;
                return a.nickname.localeCompare(b.nickname);
            });
            return out;
        } catch (e) {
            console.error('[Leaderboard] adminListAll error', e);
            return [];
        }
    },

    /** Admin: flip hidden on a leaderboard entry (removes it from rankings
     * without deleting their synced counts). Server enforces admin UID. */
    async adminSetHidden(uid: string, hidden: boolean): Promise<boolean> {
        try {
            const db = getFirebaseDb();
            await updateDoc(doc(db, 'leaderboard', uid), { hidden });
            return true;
        } catch (e) {
            console.error('[Leaderboard] adminSetHidden error', e);
            return false;
        }
    },

    /** Admin: permanently remove a leaderboard entry (opts them out). */
    async adminDelete(uid: string): Promise<boolean> {
        try {
            const db = getFirebaseDb();
            await deleteDoc(doc(db, 'leaderboard', uid));
            return true;
        } catch (e) {
            console.error('[Leaderboard] adminDelete error', e);
            return false;
        }
    },
};
