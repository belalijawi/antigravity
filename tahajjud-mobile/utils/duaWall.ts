import {
    collection, doc, addDoc, getDoc, getDocFromServer, setDoc, getDocs, updateDoc, deleteDoc,
    query, orderBy, limit, where, serverTimestamp, increment, writeBatch, startAfter,
    onSnapshot, QuerySnapshot, QueryDocumentSnapshot, DocumentData,
} from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DeviceEventEmitter } from 'react-native';
import { getFirebaseAuth, getFirebaseDb, ensureSignedIn } from './firebase';
import { format } from 'date-fns';
import { isValidCountryCode, countryName } from './countries';
import { isCurrentUserAdmin } from './admins';

/**
 * Anonymous dua wall — community feature where users can opt-in to publish
 * a dua anonymously. Other users tap "Ameen" to add a count.
 *
 * Firestore structure:
 *   public-duas/{id} {
 *     text: string,
 *     ameenCount: number,
 *     reportCount: number,
 *     authorId: string (anonymous user id, never displayed),
 *     createdAt: Timestamp,
 *     hidden: boolean,
 *   }
 *   ameens/{userId}_{duaId}  // who said ameen, prevents double-counting
 *   reports/{userId}_{duaId} // who reported, prevents duplicate reports
 *
 * Privacy:
 *   - Author's id is stored only to prevent abuse (rate limit + moderation).
 *     It is NEVER shown to other users.
 *   - Duas with >= 5 reports auto-hide pending review.
 *   - One publish per user per 24 hours.
 *   - Min 5 words, max 280 chars.
 */

const RATE_LIMIT_KEY = 'dua-wall-last-publish-v1';
// Duas THIS device pinned to the map. authorId is server-only and never sent
// to the client (that's what keeps the map anonymous) — so "is this my pin?"
// can't be answered from the doc itself. Instead we just remember locally,
// right after a successful publish, which ids were ours. Capped small since
// pins expire off the map within 24h anyway.
const OWN_MAP_DUAS_KEY = 'dua-wall-own-map-duas-v1';
const OWN_MAP_DUAS_CAP = 20;
// EVERY dua this device has ever published (pinned or not) — powers "My
// Duas", so an author can find and mark answered a dua that has long since
// scrolled off the wall's most-recent-50 feed. Same client-only trust model:
// no account system exists, so this is device-local, same as everything else
// here (Ameen history, map-pin tracking). A cap generous enough that it
// won't matter in practice — even at premium's 3/day ceiling, 200 entries
// is over two months of daily posting at the max rate.
const OWN_DUAS_KEY = 'dua-wall-own-duas-v1';
const OWN_DUAS_CAP = 200;
const RATE_LIMIT_MS = 24 * 60 * 60 * 1000; // 24h rolling window
const FREE_DAILY_LIMIT = 1;
const PREMIUM_DAILY_LIMIT = 3;
const MAX_LENGTH = 280;
const MIN_WORDS = 5;
const MAX_NAME_LENGTH = 30;
const REPORT_THRESHOLD = 5;

/** RATE_LIMIT_KEY holds a JSON array of recent publish timestamps (client-only
 * count, same trust model as every other premium gate here — the server
 * backstop in firestore.rules only bounds spacing, not a per-tier count).
 * Pre-existing installs have a single plain-number string from before this
 * was a rolling count — JSON.parse of "1732650000000" already returns that
 * number correctly, so it's handled as a one-entry legacy history for free. */
function parseRateLimitTimestamps(raw: string | null): number[] {
    if (!raw) return [];
    try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed.filter((n): n is number => typeof n === 'number');
        if (typeof parsed === 'number') return [parsed];
    } catch { /* ignore malformed value */ }
    return [];
}

// Basic profanity / abuse word list. Conservative — we'd rather false-flag
// than let through harmful content. Includes common English/transliterated.
const FORBIDDEN_WORDS = [
    'fuck', 'shit', 'bitch', 'cunt', 'dick', 'pussy', 'asshole',
    'kill', 'murder', 'suicide', 'rape',
    // Anti-Islam slurs (we don't list them here for review hygiene; the report
    // mechanism + community moderation catches edge cases)
];

export interface PublicDua {
    id: string;
    /** Anonymous author uid. NEVER displayed — carried only so the viewer can
     *  block this person's content locally (see utils/blockedUsers.ts). */
    authorId?: string;
    text: string;
    displayName?: string;   // optional first name; 'Anonymous' if not given
    country?: string;       // optional ISO country code, shown as "Name, Country"
    // Quiet supporter mark, same as CommentThread's — snapshotted at publish
    // time (like displayName/country above), not a live join against current
    // subscription status.
    authorPremium?: boolean;
    answered?: boolean;     // author marked this dua answered (one-way)
    answeredAt?: Date;
    ameenCount: number;
    prayCount?: number;     // "I'm praying for you" reaction count
    replyCount?: number;    // denormalised count of visible comments
    reportCount: number;
    createdAt: Date;
    hidden: boolean;
}

/** "Name" or "Name, Country" — one shared formatter so every surface that
 * shows a dua's author (the Wall, the Answered Duas list, the map) renders
 * it identically. */
export function formatDuaAuthor(dua: Pick<PublicDua, 'displayName' | 'country'>): string {
    const name = dua.displayName ?? 'Anonymous';
    return dua.country ? `${name}, ${countryName(dua.country)}` : name;
}

export interface PublishResult {
    ok: boolean;
    error?: 'too-short' | 'too-long' | 'rate-limited' | 'profanity' | 'not-signed-in' | 'firestore-error';
    duaId?: string;
}

export const DuaWall = {
    /** Record that this device published `duaId` with a map pin — lets the
     * map highlight "this is your dua" without ever exposing authorId. */
    async recordOwnMapDua(duaId: string): Promise<void> {
        try {
            const raw = await AsyncStorage.getItem(OWN_MAP_DUAS_KEY);
            const ids: string[] = raw ? JSON.parse(raw) : [];
            ids.push(duaId);
            // Keep only the most recent — pins expire off the map within 24h
            // anyway, so this never needs to grow large.
            await AsyncStorage.setItem(OWN_MAP_DUAS_KEY, JSON.stringify(ids.slice(-OWN_MAP_DUAS_CAP)));
        } catch {}
    },

    /** Ids of this device's own map-pinned duas (client-side only). */
    async getOwnMapDuaIds(): Promise<Set<string>> {
        try {
            const raw = await AsyncStorage.getItem(OWN_MAP_DUAS_KEY);
            return raw ? new Set(JSON.parse(raw) as string[]) : new Set();
        } catch { return new Set(); }
    },

    /** Record that this device published `duaId` — powers "My Duas". Called
     * on every successful publish, pinned or not. */
    async recordOwnDua(duaId: string): Promise<void> {
        try {
            const raw = await AsyncStorage.getItem(OWN_DUAS_KEY);
            const ids: string[] = raw ? JSON.parse(raw) : [];
            ids.push(duaId);
            await AsyncStorage.setItem(OWN_DUAS_KEY, JSON.stringify(ids.slice(-OWN_DUAS_CAP)));
        } catch {}
    },

    /** This device's own dua ids, most recently published first. */
    async getOwnDuaIds(): Promise<string[]> {
        try {
            const raw = await AsyncStorage.getItem(OWN_DUAS_KEY);
            const ids: string[] = raw ? JSON.parse(raw) : [];
            return ids.slice().reverse();
        } catch { return []; }
    },

    /** Drop `duaId` from both local "mine" caches — called after a
     * successful self-delete so it stops showing up in "My Duas" or as
     * "your pin" on the map, without waiting for anything server-side. */
    async forgetOwnDua(duaId: string): Promise<void> {
        try {
            const raw = await AsyncStorage.getItem(OWN_DUAS_KEY);
            const ids: string[] = raw ? JSON.parse(raw) : [];
            await AsyncStorage.setItem(OWN_DUAS_KEY, JSON.stringify(ids.filter(id => id !== duaId)));
        } catch {}
        try {
            const raw = await AsyncStorage.getItem(OWN_MAP_DUAS_KEY);
            const ids: string[] = raw ? JSON.parse(raw) : [];
            await AsyncStorage.setItem(OWN_MAP_DUAS_KEY, JSON.stringify(ids.filter(id => id !== duaId)));
        } catch {}
    },

    /**
     * Author deletes their own dua — pulls it off the wall AND the map (a
     * map pin is the same public-duas doc with onMap:true, so a plain
     * deleteDoc removes it from both at once; every screen showing the map
     * or wall is on a live onSnapshot listener, so it disappears there
     * immediately with no extra wiring — see subscribeWall/subscribeMapDuas).
     * Server enforces authorId == the caller (see firestore.rules) so this
     * can't be used to delete someone else's dua by guessing an id.
     */
    async deleteMine(duaId: string): Promise<boolean> {
        try {
            const db = getFirebaseDb();
            await deleteDoc(doc(db, 'public-duas', duaId));
            this.forgetOwnDua(duaId).catch(() => {});
            DeviceEventEmitter.emit('duaDeleted', { duaId });
            return true;
        } catch (e) {
            console.error('[DuaWall] deleteMine error', e);
            return false;
        }
    },

    /** Fetch several duas by id (for "My Duas"). Silently drops any that no
     * longer exist (e.g. admin-deleted) rather than failing the whole list. */
    async getMany(ids: string[]): Promise<PublicDua[]> {
        const results = await Promise.all(ids.map(id => this.getById(id)));
        return results.filter((d): d is PublicDua => d !== null);
    },

    /**
     * Author marks their own dua as answered — one-way (rules reject
     * un-marking). Shows on the wall card, the map pin, and "My Duas" as a
     * ✨ badge. Also notifies everyone who said Ameen — closing the loop so
     * "I tapped a button once" becomes "I found out my prayer mattered."
     *
     * Marking answered can happen from three different, independently-
     * mounted UIs (the Dua Wall list, the map pin detail, "My Duas") that
     * each keep their OWN local copy of the dua rather than sharing one
     * state tree — patching just the caller's local state (as "My Duas" and
     * the map pin already did) left the OTHER two screens showing stale
     * "not answered" until their own Firestore listener happened to re-fire
     * for an unrelated reason (e.g. someone tapping Ameen). Emitting this
     * event lets every currently-mounted screen patch its own copy
     * immediately, the same DeviceEventEmitter cross-screen-sync pattern
     * already used for `prayerLogged` elsewhere in this app — not dependent
     * on a listener round-trip at all.
     */
    async markAnswered(duaId: string): Promise<boolean> {
        try {
            const db = getFirebaseDb();
            await updateDoc(doc(db, 'public-duas', duaId), {
                answered: true,
                answeredAt: serverTimestamp(),
            });
            DeviceEventEmitter.emit('duaAnswered', { duaId });
            this.notifyAmeenSayers(duaId).catch(() => {});
            return true;
        } catch (e) {
            console.error('[DuaWall] markAnswered error', e);
            return false;
        }
    },

    /**
     * Tell everyone who said Ameen that this dua was answered. Only the
     * dua's own author can enumerate its Ameen markers (see the ameens read
     * rule) — nobody else can browse "who said Ameen to what" for a dua they
     * don't own, so this stays a one-time, author-triggered fan-out, not a
     * general capability. Capped well above anything this app will
     * realistically hit, same spirit as every other generous-but-bounded
     * cap in this codebase (MAP_DUA_LIMIT, comment thread limit, etc.) —
     * bounds worst-case push volume for a viral dua without affecting the
     * vast majority of real ones.
     */
    async notifyAmeenSayers(duaId: string): Promise<void> {
        const FANOUT_LIMIT = 100;
        try {
            await ensureSignedIn();
            const user = getFirebaseAuth()?.currentUser;
            if (!user) return;
            const db = getFirebaseDb();
            const snap = await getDocs(query(
                collection(db, 'ameens'),
                where('duaId', '==', duaId),
                limit(FANOUT_LIMIT),
            ));
            const targets = new Set<string>();
            snap.forEach(d => {
                const uid = (d.data() as any).userId;
                if (uid && uid !== user.uid) targets.add(uid);
            });
            if (targets.size === 0) return;

            const { sendMilestonePush } = await import('./communityNotify');
            await Promise.all([...targets].map(uid =>
                sendMilestonePush(
                    uid,
                    'A dua you prayed for was answered',
                    'Alhamdulillah — someone you said Ameen for saw their prayer answered 🤲',
                    'dua_answered',
                    { parentId: duaId },
                )
            ));
        } catch (e) {
            console.error('[DuaWall] notifyAmeenSayers error', e);
        }
    },

    /** Local-only check — free: 1 post per rolling 24h. Premium: up to 3.
     * Admin: no cap at all (rules also bypass the 6h server spacing for
     * admin — see firestore.rules — so this is genuinely unlimited, not
     * just a looser client-side count). */
    async canPublishNow(isPremium: boolean = false): Promise<{ ok: boolean; nextAt?: Date }> {
        if (__DEV__ || isCurrentUserAdmin()) return { ok: true };
        const limit = isPremium ? PREMIUM_DAILY_LIMIT : FREE_DAILY_LIMIT;
        const timestamps = parseRateLimitTimestamps(await AsyncStorage.getItem(RATE_LIMIT_KEY));
        const cutoff = Date.now() - RATE_LIMIT_MS;
        const recent = timestamps.filter(t => t > cutoff);
        if (recent.length < limit) return { ok: true };
        // Next slot opens 24h after the oldest post still inside the window.
        const oldest = Math.min(...recent);
        return { ok: false, nextAt: new Date(oldest + RATE_LIMIT_MS) };
    },

    /**
     * Validate text: length + word count + word-boundary profanity filter.
     *
     * Uses word boundaries so legitimate words like "skill" or "Dickens"
     * don't match the substring "kill" or "dick". Punctuation and quotes are
     * stripped so things like "kill," still get caught.
     */
    validate(text: string): PublishResult {
        const trimmed = text.trim();
        if (trimmed.length === 0) return { ok: false, error: 'too-short' };
        if (trimmed.length > MAX_LENGTH) return { ok: false, error: 'too-long' };
        const words = trimmed.split(/\s+/).filter(Boolean);
        if (words.length < MIN_WORDS) return { ok: false, error: 'too-short' };

        // Tokenize on word boundaries so we match whole words only
        const tokens = trimmed.toLowerCase().split(/[^a-z']+/).filter(Boolean);
        const tokenSet = new Set(tokens);
        for (const w of FORBIDDEN_WORDS) {
            if (tokenSet.has(w)) return { ok: false, error: 'profanity' };
        }
        return { ok: true };
    },

    async publish(
        text: string,
        opts?: {
            location?: { lat: number; lng: number } | null;
            displayName?: string;
            country?: string;
            isPremium?: boolean;
        },
    ): Promise<PublishResult> {
        const v = this.validate(text);
        if (!v.ok) return v;

        const rate = await this.canPublishNow(opts?.isPremium ?? false);
        if (!rate.ok) return { ok: false, error: 'rate-limited' };

        await ensureSignedIn();
        const user = getFirebaseAuth()?.currentUser;
        if (!user) return { ok: false, error: 'not-signed-in' };

        try {
            const db = getFirebaseDb();
            // Batched with the rate-limit stamp: rules REQUIRE the stamp (via
            // getAfter) and enforce 6h spacing server-side — a backstop under
            // the client's real per-tier count (free 1/day, premium 3/day),
            // never bites a normal posting cadence.
            const ref = doc(collection(db, 'public-duas'));
            const batch = writeBatch(db);
            batch.set(ref, {
                text: text.trim(),
                // Same optional-name pattern as comments: always a non-empty
                // string, defaulting to 'Anonymous' — never left unset.
                displayName: (opts?.displayName ?? '').trim().slice(0, MAX_NAME_LENGTH) || 'Anonymous',
                authorPremium: opts?.isPremium ?? false,
                ameenCount: 0,
                reportCount: 0,
                authorId: user.uid, // server-only field
                createdAt: serverTimestamp(),
                hidden: false,
                // Optional country, shown as "Name, Country" — a snapshot at
                // publish time, same as displayName, not a live join against
                // CommunityProfileStore (which can change independently later).
                ...(opts?.country && isValidCountryCode(opts.country) ? { country: opts.country } : {}),
                // Opt-in map pin: city-level coords (~11km grid, same privacy
                // rounding as tahajjud_map dots). Author chose this in compose.
                ...(opts?.location ? {
                    onMap: true,
                    lat: opts.location.lat,
                    lng: opts.location.lng,
                } : {}),
            });
            // Dev builds skip the cooldown stamp so repeat test publishes
            // aren't rejected by the 6h server spacing. Production always
            // stamps — that's what lets the rules re-enable the getAfter
            // requirement once pre-stamp builds age out.
            if (!__DEV__) {
                batch.set(doc(db, 'rate-limits', user.uid),
                    { lastDuaAt: serverTimestamp() }, { merge: true });
            }
            await batch.commit();
            const priorTimestamps = parseRateLimitTimestamps(await AsyncStorage.getItem(RATE_LIMIT_KEY));
            const cutoff = Date.now() - RATE_LIMIT_MS;
            const updatedTimestamps = [...priorTimestamps.filter(t => t > cutoff), Date.now()]
                .slice(-PREMIUM_DAILY_LIMIT); // bounded even if premium later lapses
            await AsyncStorage.setItem(RATE_LIMIT_KEY, JSON.stringify(updatedTimestamps));
            this.recordOwnDua(ref.id).catch(() => {});
            if (opts?.location) this.recordOwnMapDua(ref.id).catch(() => {});
            return { ok: true, duaId: ref.id };
        } catch (e: any) {
            // permission-denied = the server-side 6h stamp was rejected
            // (local limit was wiped by a reinstall) — same daily-limit message.
            if (e?.code === 'permission-denied') {
                return { ok: false, error: 'rate-limited' };
            }
            console.error('[DuaWall] publish error', e);
            return { ok: false, error: 'firestore-error' };
        }
    },

    /**
     * Subscribe to the most recent N non-hidden duas.
     *
     * `fromCache` tells the caller whether this snapshot came from Firestore's
     * local cache (which is empty/stale on a cold start) or is server-confirmed.
     * Without it the very first callback — an empty cache result — looks like a
     * final "no live duas" state, so the wall renders seeds-only until the
     * server snapshot lands a moment later.
     */
    subscribeWall(maxItems: number, cb: (duas: PublicDua[], fromCache: boolean) => void): () => void {
        const db = getFirebaseDb();
        if (!db) { cb([], false); return () => {}; }

        // Firestore rules require auth to read this collection. A
        // permission-denied error permanently closes an onSnapshot listener,
        // and on a cold start the anonymous sign-in may still be in flight —
        // attaching before it resolves left the wall stuck on "Loading
        // tonight's duas…" forever. Wait for auth first (matches
        // subscribeTahajjudMap's fix for the same failure mode).
        let cancelled = false;
        let unsubSnap: (() => void) | null = null;
        ensureSignedIn().finally(() => {
            if (cancelled) return;
            const q = query(
                collection(db, 'public-duas'),
                where('hidden', '==', false),
                orderBy('createdAt', 'desc'),
                limit(maxItems),
            );
            // includeMetadataChanges: when the cache already matches the server
            // (typical warm reopen), the server-sync event is metadata-only and
            // suppressed by default — fromCache would never flip to false, so
            // the "Loading tonight's duas…" state lingered until a real write.
            unsubSnap = onSnapshot(q, { includeMetadataChanges: true }, (snap: QuerySnapshot<DocumentData>) => {
                const list: PublicDua[] = [];
                snap.forEach(d => {
                    const data = d.data() as any;
                    list.push({
                        id: d.id,
                        text: data.text ?? '',
                        displayName: data.displayName ?? 'Anonymous',
                authorPremium: data.authorPremium ?? false,
                        country: data.country ?? undefined,
                        answered: data.answered ?? false,
                        answeredAt: data.answeredAt?.toDate?.() ?? undefined,
                        ameenCount: data.ameenCount ?? 0,
                        prayCount: data.prayCount ?? 0,
                        replyCount: data.replyCount ?? 0,
                        reportCount: data.reportCount ?? 0,
                        createdAt: data.createdAt?.toDate?.() ?? new Date(),
                        hidden: data.hidden ?? false,
                        authorId: data.authorId,
                    });
                });
                cb(list, snap.metadata.fromCache);
            }, err => {
                console.error('[DuaWall] subscribe error', err);
                // Surface the error as a settled (non-cache) empty result so the UI
                // stops showing a perpetual spinner and falls back to seed duas.
                cb([], false);
            });
        });
        return () => { cancelled = true; unsubSnap?.(); };
    },

    /** Admin-only: look up a dua's authorId so the "you were chosen" push can
     * be sent. Never exposed on the PublicDua shape returned elsewhere. */
    async adminGetAuthorId(duaId: string): Promise<string | null> {
        try {
            const db = getFirebaseDb();
            const snap = await getDoc(doc(db, 'public-duas', duaId));
            if (!snap.exists()) return null;
            return (snap.data() as any).authorId ?? null;
        } catch {
            return null;
        }
    },

    /** Fetch a single dua by id — used to render the admin-picked "Top Dua of
     * the Day", which may not be among the most-recent 50 shown by subscribeWall. */
    async getById(duaId: string): Promise<PublicDua | null> {
        try {
            const db = getFirebaseDb();
            const snap = await getDoc(doc(db, 'public-duas', duaId));
            if (!snap.exists()) return null;
            const data = snap.data() as any;
            if (data.hidden) return null;
            return {
                id: snap.id,
                text: data.text ?? '',
                displayName: data.displayName ?? 'Anonymous',
                authorPremium: data.authorPremium ?? false,
                country: data.country ?? undefined,
                answered: data.answered ?? false,
                answeredAt: data.answeredAt?.toDate?.() ?? undefined,
                ameenCount: data.ameenCount ?? 0,
                prayCount: data.prayCount ?? 0,
                replyCount: data.replyCount ?? 0,
                reportCount: data.reportCount ?? 0,
                createdAt: data.createdAt?.toDate?.() ?? new Date(),
                hidden: data.hidden ?? false,
                authorId: data.authorId,
            };
        } catch (e) {
            console.error('[DuaWall] getById error', e);
            return null;
        }
    },

    /**
     * Paginated feed of every answered dua, most recently answered first —
     * powers the standalone "Answered Duas" screen. Separate from the main
     * wall (most-recent-50 by createdAt) and the map (rolling 24h window):
     * without this, an answered prayer just quietly ages out of both before
     * anyone but the original Ameen-sayers (who get a push) ever sees it.
     * Pass the previous call's `nextCursor` to fetch the next page.
     */
    async getAnsweredDuas(
        pageSize: number = 20,
        cursor?: QueryDocumentSnapshot<DocumentData> | null,
    ): Promise<{ items: PublicDua[]; nextCursor: QueryDocumentSnapshot<DocumentData> | null }> {
        try {
            const db = getFirebaseDb();
            const snap = await getDocs(query(
                collection(db, 'public-duas'),
                where('hidden', '==', false),
                where('answered', '==', true),
                orderBy('answeredAt', 'desc'),
                ...(cursor ? [startAfter(cursor)] : []),
                limit(pageSize),
            ));
            const items: PublicDua[] = [];
            snap.forEach(d => {
                const data = d.data() as any;
                items.push({
                    id: d.id,
                    text: data.text ?? '',
                    displayName: data.displayName ?? 'Anonymous',
                authorPremium: data.authorPremium ?? false,
                    country: data.country ?? undefined,
                    answered: true,
                    answeredAt: data.answeredAt?.toDate?.() ?? undefined,
                    ameenCount: data.ameenCount ?? 0,
                    prayCount: data.prayCount ?? 0,
                    replyCount: data.replyCount ?? 0,
                    reportCount: data.reportCount ?? 0,
                    createdAt: data.createdAt?.toDate?.() ?? new Date(),
                    hidden: data.hidden ?? false,
                    authorId: data.authorId,
                });
            });
            return { items, nextCursor: snap.docs.length > 0 ? snap.docs[snap.docs.length - 1] : null };
        } catch (e) {
            console.error('[DuaWall] getAnsweredDuas error', e);
            return { items: [], nextCursor: null };
        }
    },

    /**
     * Tap Ameen — idempotent per (user, dua). We store the marker doc with
     * a deterministic id `${uid}_${duaId}` so re-taps from the same user are
     * a no-op. A single getDoc check protects against duplicate increments.
     */
    /** Is this dua the current user's own? Self-reactions must NOT touch the
     * server counter: a self-Ameen at count 0 would land on milestone 1 with
     * no push (never notify self), so the author's real "first Ameen" moment
     * from another person (count 2) would silently never fire. */
    async _isOwnDua(duaId: string, uid: string): Promise<boolean> {
        try {
            const db = getFirebaseDb();
            const snap = await getDoc(doc(db, 'public-duas', duaId));
            return snap.exists() && (snap.data() as any).authorId === uid;
        } catch { return false; }
    },

    async ameen(duaId: string): Promise<boolean> {
        await ensureSignedIn();
        const user = getFirebaseAuth()?.currentUser;
        if (!user) return false;
        const db = getFirebaseDb();
        const ameenId = `${user.uid}_${duaId}`;
        try {
            const ameenRef = doc(db, 'ameens', ameenId);
            const [existing, isOwn] = await Promise.all([
                getDoc(ameenRef),
                this._isOwnDua(duaId, user.uid),
            ]);
            if (existing.exists()) return true; // already counted — idempotent
            // Own dua: marker only (keeps the local heart consistent across
            // devices) — no counter bump, no milestone check. See _isOwnDua.
            await Promise.all([
                setDoc(ameenRef, {
                    userId: user.uid,
                    duaId,
                    createdAt: serverTimestamp(),
                }),
                ...(isOwn ? [] : [updateDoc(doc(db, 'public-duas', duaId), {
                    ameenCount: increment(1),
                })]),
            ]);
            // Milestone notification to the dua's author (client-side, free-plan)
            if (!isOwn) this.maybeNotifyDuaMilestone(duaId, 'ameen').catch(() => {});
            return true;
        } catch (e) {
            console.error('[DuaWall] ameen error', e);
            return false;
        }
    },

    /**
     * After an Ameen/pray increment, notify the author if the count just hit
     * a milestone (1, 10, 25, 50, 100, 250, 500). This keeps notifications
     * meaningful — the author feels the milestone moments without being spammed
     * on every single reaction. Uses getDoc (server-fresh) to avoid reading a
     * stale count from Firestore's local cache.
     */
    async maybeNotifyDuaMilestone(duaId: string, kind: 'ameen' | 'pray'): Promise<void> {
        try {
            const db = getFirebaseDb();
            // Force a direct server read — bypasses the Firestore local cache
            // which may still show the pre-increment count immediately after
            // the updateDoc. getDocFromServer guarantees we see the committed value.
            const snap = await getDocFromServer(doc(db, 'public-duas', duaId));
            if (!snap.exists()) return;
            const d = snap.data() as any;
            const authorId = d.authorId;
            if (!authorId) return;

            const { isMilestone, sendMilestonePush } = await import('./communityNotify');
            if (kind === 'ameen') {
                const c = d.ameenCount ?? 0;
                if (!isMilestone(c)) return;
                const body = c === 1
                    ? 'Someone said Ameen to your dua 🤲'
                    : `${c} people have said Ameen to your dua 🤲`;
                await sendMilestonePush(authorId, 'Your dua is being heard', body, 'dua_milestone');
            } else {
                const c = d.prayCount ?? 0;
                if (!isMilestone(c)) return;
                const body = c === 1
                    ? 'Someone is praying for you 🤲'
                    : `${c} people are praying for you 🤲`;
                await sendMilestonePush(authorId, 'You are in their prayers', body, 'dua_milestone');
            }
        } catch { /* never block the reaction over a notification */ }
    },

    /**
     * "I'm praying for you" — second reaction type beyond Ameen. Same
     * idempotency pattern: doc id `${uid}_${duaId}` in the `prays` collection.
     * A user can mark BOTH Ameen and Praying on the same dua (they're separate
     * intentions — Ameen affirms the dua, Praying signals personal effort).
     */
    async prayingFor(duaId: string): Promise<boolean> {
        await ensureSignedIn();
        const user = getFirebaseAuth()?.currentUser;
        if (!user) return false;
        const db = getFirebaseDb();
        const prayId = `${user.uid}_${duaId}`;
        try {
            const prayRef = doc(db, 'prays', prayId);
            const [existing, isOwn] = await Promise.all([
                getDoc(prayRef),
                this._isOwnDua(duaId, user.uid),
            ]);
            if (existing.exists()) return true; // already counted — idempotent
            // Own dua: marker only — no counter bump, no milestone (see _isOwnDua).
            await Promise.all([
                setDoc(prayRef, {
                    userId: user.uid,
                    duaId,
                    createdAt: serverTimestamp(),
                }),
                ...(isOwn ? [] : [updateDoc(doc(db, 'public-duas', duaId), {
                    prayCount: increment(1),
                })]),
            ]);
            // Milestone notification to the dua's author (client-side, free-plan)
            if (!isOwn) this.maybeNotifyDuaMilestone(duaId, 'pray').catch(() => {});
            return true;
        } catch (e) {
            console.error('[DuaWall] prayingFor error', e);
            return false;
        }
    },

    /** Undo an Ameen — delete the marker and decrement the count. */
    async unameen(duaId: string): Promise<boolean> {
        await ensureSignedIn();
        const user = getFirebaseAuth()?.currentUser;
        if (!user) return false;
        const db = getFirebaseDb();
        const ameenRef = doc(db, 'ameens', `${user.uid}_${duaId}`);
        try {
            const [existing, isOwn] = await Promise.all([
                getDoc(ameenRef),
                this._isOwnDua(duaId, user.uid),
            ]);
            if (!existing.exists()) return true; // nothing to undo — already idempotent
            // Own dua never incremented the counter, so don't decrement either.
            await Promise.all([
                deleteDoc(ameenRef),
                ...(isOwn ? [] : [updateDoc(doc(db, 'public-duas', duaId), { ameenCount: increment(-1) })]),
            ]);
            return true;
        } catch (e) {
            console.error('[DuaWall] unameen error', e);
            return false;
        }
    },

    /** Undo a "praying for" — delete the marker and decrement the count. */
    async unpray(duaId: string): Promise<boolean> {
        await ensureSignedIn();
        const user = getFirebaseAuth()?.currentUser;
        if (!user) return false;
        const db = getFirebaseDb();
        const prayRef = doc(db, 'prays', `${user.uid}_${duaId}`);
        try {
            const [existing, isOwn] = await Promise.all([
                getDoc(prayRef),
                this._isOwnDua(duaId, user.uid),
            ]);
            if (!existing.exists()) return true;
            // Own dua never incremented the counter, so don't decrement either.
            await Promise.all([
                deleteDoc(prayRef),
                ...(isOwn ? [] : [updateDoc(doc(db, 'public-duas', duaId), { prayCount: increment(-1) })]),
            ]);
            return true;
        } catch (e) {
            console.error('[DuaWall] unpray error', e);
            return false;
        }
    },

    /**
     * Report a dua — idempotent per (user, dua). When the report count
     * reaches REPORT_THRESHOLD the dua is auto-hidden client-side (no Cloud
     * Function needed — the Firestore rule permits a reportCount+hidden update
     * when the pre-update count is already at threshold - 1).
     */
    async report(duaId: string, reason: string = 'inappropriate'): Promise<boolean> {
        await ensureSignedIn();
        const user = getFirebaseAuth()?.currentUser;
        if (!user) return false;
        const db = getFirebaseDb();
        const reportId = `${user.uid}_${duaId}`;
        try {
            const reportRef = doc(db, 'reports', reportId);
            const [existingSnap, duaSnap] = await Promise.all([
                getDoc(reportRef),
                getDoc(doc(db, 'public-duas', duaId)),
            ]);
            if (existingSnap.exists()) return true; // already reported — idempotent

            const currentCount = duaSnap.exists()
                ? ((duaSnap.data() as any).reportCount ?? 0)
                : 0;
            const willHide = (currentCount + 1) >= REPORT_THRESHOLD;

            await Promise.all([
                setDoc(reportRef, {
                    userId: user.uid,
                    duaId,
                    reason,
                    createdAt: serverTimestamp(),
                }),
                updateDoc(doc(db, 'public-duas', duaId),
                    willHide
                        ? { reportCount: increment(1), hidden: true }
                        : { reportCount: increment(1) }
                ),
            ]);
            return true;
        } catch (e) {
            console.error('[DuaWall] report error', e);
            return false;
        }
    },

    /**
     * Admin: list ALL duas including hidden ones, sorted with most-reported
     * first, then newest. Used by the moderation modal. Server-side rules
     * enforce that only signed-in users can read; the moderation UI is
     * additionally gated to admin UIDs in the app shell.
     */
    async adminListAll(limitN: number = 100): Promise<PublicDua[]> {
        try {
            const db = getFirebaseDb();
            // Two queries: hidden first (priority), then visible.
            // Avoids needing a composite index on (reportCount, createdAt).
            const snap = await getDocs(query(
                collection(db, 'public-duas'),
                orderBy('createdAt', 'desc'),
                limit(limitN),
            ));
            const out: PublicDua[] = [];
            snap.forEach(d => {
                const data = d.data() as any;
                out.push({
                    id: d.id,
                    text: data.text ?? '',
                    displayName: data.displayName ?? 'Anonymous',
                authorPremium: data.authorPremium ?? false,
                    country: data.country ?? undefined,
                    answered: data.answered ?? false,
                    answeredAt: data.answeredAt?.toDate?.() ?? undefined,
                    ameenCount: data.ameenCount ?? 0,
                    reportCount: data.reportCount ?? 0,
                    createdAt: data.createdAt?.toDate?.() ?? new Date(),
                    hidden: data.hidden ?? false,
                    authorId: data.authorId,
                });
            });
            // Sort: reported first (desc reportCount), then by recency
            out.sort((a, b) => {
                if (b.reportCount !== a.reportCount) return b.reportCount - a.reportCount;
                return b.createdAt.getTime() - a.createdAt.getTime();
            });
            return out;
        } catch (e) {
            console.error('[DuaWall] adminListAll error', e);
            return [];
        }
    },

    /** Admin: flip hidden on a dua. Server enforces admin UID. */
    async adminSetHidden(duaId: string, hidden: boolean): Promise<boolean> {
        try {
            const db = getFirebaseDb();
            await updateDoc(doc(db, 'public-duas', duaId), {
                hidden,
                hiddenAt: hidden ? serverTimestamp() : null,
                hiddenReason: hidden ? 'admin-manual' : null,
            });
            return true;
        } catch (e) {
            console.error('[DuaWall] adminSetHidden error', e);
            return false;
        }
    },

    /** Admin: permanently delete a dua. */
    async adminDelete(duaId: string): Promise<boolean> {
        try {
            const db = getFirebaseDb();
            await deleteDoc(doc(db, 'public-duas', duaId));
            return true;
        } catch (e) {
            console.error('[DuaWall] adminDelete error', e);
            return false;
        }
    },

    REPORT_THRESHOLD,
    MAX_LENGTH,
    MIN_WORDS,
    MAX_NAME_LENGTH,
};
