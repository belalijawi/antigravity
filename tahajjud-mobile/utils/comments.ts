import {
    collection, doc, addDoc, getDoc, setDoc, getDocs, updateDoc, deleteDoc,
    query, orderBy, limit, where, serverTimestamp, increment, writeBatch,
    onSnapshot, QuerySnapshot, DocumentData,
} from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getFirebaseAuth, getFirebaseDb, ensureSignedIn } from './firebase';

/**
 * Shared comments (replies) for community content — Dua Wall today,
 * Testimonies next. One collection serves every parent type so the
 * moderation pipeline, rules, and UI stay identical across surfaces.
 *
 * Firestore structure:
 *   comments/{id} {
 *     parentType: 'dua' | 'testimony',
 *     parentId: string,
 *     text: string,
 *     displayName: string,   // "Anonymous" or user-chosen first name
 *     authorId: string,      // anonymous uid, never displayed
 *     createdAt: Timestamp,
 *     reportCount: number,
 *     hidden: boolean,
 *   }
 *   comment-reports/{userId}_{commentId}  // idempotent report markers
 *
 * Moderation model mirrors the Dua Wall exactly:
 *   - word-boundary profanity filter (text AND display name)
 *   - >= 5 reports auto-hides pending review (client-side rule trick,
 *     no Cloud Function — Spark plan)
 *   - admin list/hide/delete via the same Settings → Admin modal
 *
 * Premium gate: free users get 1 reply per rolling day (local check —
 *   same trust model as the Dua Wall's 24h publish limit). Premium is
 *   unlimited. The gate lives HERE (not just UI) so every entry point
 *   shares it.
 */

const MAX_LENGTH = 200;
const MAX_NAME_LENGTH = 30;
const REPORT_THRESHOLD = 5;
const FREE_REPLY_KEY = 'comment-free-replies-v1';    // JSON: { date: 'yyyy-MM-dd', count: number }
const FREE_REPLIES_PER_DAY = 1;
// Spam throttle for EVERYONE, premium included — the free-tier gate is a
// monetisation lever, not abuse control. Firestore rules can't see premium
// status (never synced server-side — see firestore.rules), so premium can't
// get a true bypass here without new sync infrastructure; shortened to 8s
// for everyone instead so premium doesn't feel throttled by a 30s wait,
// while a real spam burst is still blocked. Must match rate-limits'
// stampUpdateOk('lastCommentAt', ...) duration in firestore.rules.
const COOLDOWN_KEY = 'comment-last-posted-v1';
const COOLDOWN_MS = 8 * 1000;
// Local per-user "hide this reply" — the anonymous-community equivalent of
// blocking. Stored client-side only; the comment stays visible to others.
const HIDDEN_KEY = 'comment-hidden-ids-v1';
// Local cache of comment ids THIS device has liked — same trust model as
// the Dua Wall's Ameen cache (utils/duaWall.ts): a reinstall or new device
// could in theory double-like, but the idempotent comment-likes marker
// collection is the real server-side guard; this is just fast, offline-safe
// UI state for "is the heart already filled."
const LIKED_KEY = 'comment-liked-ids-v1';

// Same conservative list as duaWall.ts / testimonySubmission.ts.
const FORBIDDEN_WORDS = [
    'fuck', 'shit', 'bitch', 'cunt', 'dick', 'pussy', 'asshole',
    'kill', 'murder', 'suicide', 'rape',
];

export type CommentParentType = 'dua' | 'testimony';

export interface Comment {
    id: string;
    parentType: CommentParentType;
    parentId: string;
    text: string;
    displayName: string;
    /** Self-reported ISO alpha-2 country code, same convention as the Dua
     * Wall/Leaderboard/story submissions — optional, shown as a flag next
     * to displayName. */
    country?: string;
    createdAt: Date;
    reportCount: number;
    hidden: boolean;
    /** True when this reply was written by the parent dua/story's author.
     * Verified server-side (rules get() the parent doc) so it can't be faked. */
    isAuthor?: boolean;
    /** The parent's author hearted this reply. */
    authorLiked?: boolean;
    /** How many people (anyone, not just the parent's author) liked this
     * reply — separate from authorLiked's single "the OP appreciated this"
     * flag. */
    likeCount: number;
    /** Commenter was a premium subscriber at post time (client-attested —
     * same trust model as the rest of the free-plan stack). */
    authorPremium?: boolean;
    /** Did the CURRENT viewer write this reply? Computed client-side by
     * comparing the raw authorId (never itself exposed, per the anonymity
     * convention below) against the signed-in uid — used only to hide the
     * like button on your own reply. */
    isMine: boolean;
}

export interface PostCommentResult {
    ok: boolean;
    error?: 'too-short' | 'too-long' | 'profanity' | 'not-signed-in'
        | 'firestore-error' | 'free-limit' | 'cooldown';
    commentId?: string;
}

function todayKey(): string {
    const d = new Date();
    return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

function hasProfanity(s: string): boolean {
    const tokens = new Set(s.toLowerCase().split(/[^a-z']+/).filter(Boolean));
    for (const w of FORBIDDEN_WORDS) {
        if (tokens.has(w)) return true;
    }
    return false;
}

function docToComment(id: string, data: any, myUid?: string): Comment {
    return {
        id,
        parentType: data.parentType ?? 'dua',
        parentId: data.parentId ?? '',
        text: data.text ?? '',
        displayName: data.displayName ?? 'Anonymous',
        country: data.country ?? undefined,
        createdAt: data.createdAt?.toDate?.() ?? new Date(),
        reportCount: data.reportCount ?? 0,
        hidden: data.hidden ?? false,
        isAuthor: data.isAuthor ?? false,
        authorLiked: data.authorLiked ?? false,
        authorPremium: data.authorPremium ?? false,
        likeCount: data.likeCount ?? 0,
        isMine: !!myUid && data.authorId === myUid,
    };
}

export const Comments = {
    /**
     * How many free replies remain today. Premium callers shouldn't ask —
     * they're never limited. Resets at local midnight (matches the user's
     * mental model of "per day" better than a rolling 24h window).
     */
    async freeRepliesLeftToday(): Promise<number> {
        try {
            const raw = await AsyncStorage.getItem(FREE_REPLY_KEY);
            if (!raw) return FREE_REPLIES_PER_DAY;
            const { date, count } = JSON.parse(raw);
            if (date !== todayKey()) return FREE_REPLIES_PER_DAY;
            return Math.max(0, FREE_REPLIES_PER_DAY - count);
        } catch { return FREE_REPLIES_PER_DAY; }
    },

    async recordFreeReplyUsed(): Promise<void> {
        try {
            const raw = await AsyncStorage.getItem(FREE_REPLY_KEY);
            const today = todayKey();
            let count = 0;
            if (raw) {
                const parsed = JSON.parse(raw);
                if (parsed.date === today) count = parsed.count ?? 0;
            }
            await AsyncStorage.setItem(FREE_REPLY_KEY, JSON.stringify({ date: today, count: count + 1 }));
        } catch {}
    },

    /** Validate text + optional display name. Profanity check covers BOTH. */
    validate(text: string, displayName: string): PostCommentResult {
        const trimmed = text.trim();
        if (trimmed.length === 0) return { ok: false, error: 'too-short' };
        if (trimmed.length > MAX_LENGTH) return { ok: false, error: 'too-long' };
        if (displayName.trim().length > MAX_NAME_LENGTH) return { ok: false, error: 'too-long' };
        if (hasProfanity(trimmed) || hasProfanity(displayName)) {
            return { ok: false, error: 'profanity' };
        }
        return { ok: true };
    },

    /**
     * Post a reply. `isPremium` comes from the caller (PurchasesContext) —
     * free users burn their daily allowance; premium is unlimited.
     */
    async post(
        parentType: CommentParentType,
        parentId: string,
        text: string,
        displayName: string,
        isPremium: boolean,
        country?: string | null,
    ): Promise<PostCommentResult> {
        const v = this.validate(text, displayName);
        if (!v.ok) return v;

        // Spam cooldown applies to everyone, premium included.
        try {
            const lastRaw = await AsyncStorage.getItem(COOLDOWN_KEY);
            if (lastRaw && Date.now() - parseInt(lastRaw, 10) < COOLDOWN_MS) {
                return { ok: false, error: 'cooldown' };
            }
        } catch {}

        await ensureSignedIn();
        const user = getFirebaseAuth()?.currentUser;
        if (!user) return { ok: false, error: 'not-signed-in' };

        const db = getFirebaseDb();
        const parentCollectionName = parentType === 'dua' ? 'public-duas' : 'community';
        // Is this the parent's own author replying in their thread? Checked
        // BEFORE the free-limit gate below — replying to someone who replied
        // to YOUR OWN dua/story is just engaging with your own content, not
        // the same thing as replying to a stranger's post, so it shouldn't
        // burn the same daily allowance. Rules re-verify with a get() too, so
        // a forged flag is rejected server-side regardless of what this
        // client computes.
        let isAuthor = false;
        try {
            const parentSnap = await getDoc(doc(db, parentCollectionName, parentId));
            isAuthor = parentSnap.exists() && (parentSnap.data() as any).authorId === user.uid;
        } catch {}

        if (!isPremium && !isAuthor) {
            const left = await this.freeRepliesLeftToday();
            if (left <= 0) return { ok: false, error: 'free-limit' };
        }

        try {
            // Batched with the rate-limit stamp: rules REQUIRE the stamp (via
            // getAfter) and enforce 8s spacing on it server-side, so the
            // cooldown holds even against clients that bypass the app.
            const ref = doc(collection(db, 'comments'));
            const batch = writeBatch(db);
            batch.set(ref, {
                parentType,
                parentId,
                text: text.trim(),
                displayName: displayName.trim() || 'Anonymous',
                ...(country ? { country } : {}),
                authorId: user.uid, // server-only field
                createdAt: serverTimestamp(),
                reportCount: 0,
                hidden: false,
                isAuthor,
                authorPremium: isPremium,
                likeCount: 0,
            });
            batch.set(doc(db, 'rate-limits', user.uid),
                { lastCommentAt: serverTimestamp() }, { merge: true });
            await batch.commit();
            // Bump the denormalised counter on the parent so lists can show
            // "💬 N replies" without a comments listener per row. Best-effort:
            // the comment itself is the source of truth.
            const parentCollection = parentType === 'dua' ? 'public-duas' : 'community';
            updateDoc(doc(db, parentCollection, parentId), { replyCount: increment(1) }).catch(() => {});
            // Tell the parent's author — fire-and-forget.
            this.notifyParentAuthor(parentType, parentId).catch(() => {});
            this.notifyPreviousRepliers(parentType, parentId, ref.id).catch(() => {});
            AsyncStorage.setItem(COOLDOWN_KEY, String(Date.now())).catch(() => {});
            if (!isPremium && !isAuthor) await this.recordFreeReplyUsed();
            return { ok: true, commentId: ref.id };
        } catch (e: any) {
            // permission-denied here almost always means the server-side 8s
            // stamp was rejected (reinstall/bypass) — show the cooldown message.
            if (e?.code === 'permission-denied') {
                return { ok: false, error: 'cooldown' };
            }
            console.error('[Comments] post error', e);
            return { ok: false, error: 'firestore-error' };
        }
    },

    /**
     * Live-subscribe to the visible comments of one parent, oldest first
     * (conversation order). Same auth-before-attach pattern as the Dua Wall —
     * a permission-denied error permanently closes an onSnapshot listener.
     */
    subscribe(
        parentType: CommentParentType,
        parentId: string,
        cb: (comments: Comment[], fromCache: boolean) => void,
    ): () => void {
        const db = getFirebaseDb();
        if (!db) { cb([], false); return () => {}; }

        let cancelled = false;
        let unsubSnap: (() => void) | null = null;
        ensureSignedIn().finally(() => {
            if (cancelled) return;
            const q = query(
                collection(db, 'comments'),
                where('parentType', '==', parentType),
                where('parentId', '==', parentId),
                where('hidden', '==', false),
                orderBy('createdAt', 'asc'),
                // Ascending + limit caps this at the OLDEST N replies — past
                // this count, every NEWER reply silently stops appearing for
                // everyone, forever, with zero indication anything's missing
                // (same anti-pattern the map's dot listener had, fixed
                // earlier). Raised well past anything this app will hit in
                // practice; real pagination ("load earlier replies") is the
                // correct long-term fix if a thread ever approaches this.
                limit(500),
            );
            // includeMetadataChanges is REQUIRED here: for a thread with zero
            // replies, the empty cache snapshot and the empty server snapshot
            // are identical, and Firestore suppresses the second (metadata-only)
            // event by default — so `fromCache` would never turn false and the
            // UI would spin forever on every empty thread.
            const myUid = getFirebaseAuth()?.currentUser?.uid;
            unsubSnap = onSnapshot(q, { includeMetadataChanges: true }, (snap: QuerySnapshot<DocumentData>) => {
                const list: Comment[] = [];
                snap.forEach(d => list.push(docToComment(d.id, d.data(), myUid)));
                cb(list, snap.metadata.fromCache);
            }, err => {
                console.error('[Comments] subscribe error', err);
                cb([], false);
            });
        });
        return () => { cancelled = true; unsubSnap?.(); };
    },

    /** Is the current user the author of this parent dua/story? Used to show
     * the like affordance on replies. */
    async isParentAuthor(parentType: CommentParentType, parentId: string): Promise<boolean> {
        try {
            await ensureSignedIn();
            const user = getFirebaseAuth()?.currentUser;
            if (!user) return false;
            const db = getFirebaseDb();
            const parentCollection = parentType === 'dua' ? 'public-duas' : 'community';
            const snap = await getDoc(doc(db, parentCollection, parentId));
            return snap.exists() && (snap.data() as any).authorId === user.uid;
        } catch { return false; }
    },

    /** Parent author hearts (or un-hearts) a reply. Rules verify authorship.
     * A fresh like notifies the reply's writer (never on un-like, and the
     * 60s/author rate limit in communityNotify stops heart-toggling spam). */
    async setAuthorLiked(commentId: string, liked: boolean): Promise<boolean> {
        try {
            const db = getFirebaseDb();
            const snap = await getDoc(doc(db, 'comments', commentId));
            const data = snap.exists() ? (snap.data() as any) : null;
            await updateDoc(doc(db, 'comments', commentId), { authorLiked: liked });
            if (liked && data?.authorId && !(data.authorLiked ?? false)) {
                const { sendMilestonePush } = await import('./communityNotify');
                sendMilestonePush(
                    data.authorId,
                    'The author appreciated your reply',
                    'Your kind words reached them ❤️',
                    'reply_liked',
                    { parentId: data.parentId ?? '', parentType: data.parentType ?? 'dua' },
                ).catch(() => {});
            }
            return true;
        } catch (e) {
            console.error('[Comments] setAuthorLiked error', e);
            return false;
        }
    },

    /** Load the local set of comment ids THIS device has liked. */
    async getLikedLocally(): Promise<Set<string>> {
        try {
            const raw = await AsyncStorage.getItem(LIKED_KEY);
            return raw ? new Set(JSON.parse(raw) as string[]) : new Set();
        } catch { return new Set(); }
    },

    /**
     * Like a reply — anyone can do this (unlike authorLiked, which is
     * restricted to the parent's author). Idempotent per (user, comment) via
     * a comment-likes marker doc, same pattern as the Dua Wall's Ameen.
     * Notifies the comment's author only on the FIRST like (count 0 → 1),
     * never on every subsequent like — a popular reply shouldn't spam its
     * writer with a push per heart.
     */
    async like(commentId: string): Promise<boolean> {
        await ensureSignedIn();
        const user = getFirebaseAuth()?.currentUser;
        if (!user) return false;
        const db = getFirebaseDb();
        const likeId = `${user.uid}_${commentId}`;
        try {
            const likeRef = doc(db, 'comment-likes', likeId);
            const [existingSnap, commentSnap] = await Promise.all([
                getDoc(likeRef),
                getDoc(doc(db, 'comments', commentId)),
            ]);
            if (existingSnap.exists()) return true; // already liked — idempotent

            const commentData = commentSnap.exists() ? (commentSnap.data() as any) : null;
            const wasZero = (commentData?.likeCount ?? 0) === 0;

            const batch = writeBatch(db);
            batch.set(likeRef, { userId: user.uid, commentId, createdAt: serverTimestamp() });
            batch.update(doc(db, 'comments', commentId), { likeCount: increment(1) });
            await batch.commit();

            const set = await this.getLikedLocally();
            set.add(commentId);
            await AsyncStorage.setItem(LIKED_KEY, JSON.stringify([...set]));

            if (wasZero && commentData?.authorId && commentData.authorId !== user.uid) {
                const { sendMilestonePush } = await import('./communityNotify');
                sendMilestonePush(
                    commentData.authorId,
                    'Someone liked your reply',
                    'Your words meant something to someone ❤️',
                    'reply_liked',
                    { parentId: commentData.parentId ?? '', parentType: commentData.parentType ?? 'dua' },
                ).catch(() => {});
            }
            return true;
        } catch (e) {
            console.error('[Comments] like error', e);
            return false;
        }
    },

    /** Undo a like — delete the marker and decrement the count. */
    async unlike(commentId: string): Promise<boolean> {
        await ensureSignedIn();
        const user = getFirebaseAuth()?.currentUser;
        if (!user) return false;
        const db = getFirebaseDb();
        const likeRef = doc(db, 'comment-likes', `${user.uid}_${commentId}`);
        try {
            const existingSnap = await getDoc(likeRef);
            if (!existingSnap.exists()) return true; // already not liked

            const batch = writeBatch(db);
            batch.delete(likeRef);
            batch.update(doc(db, 'comments', commentId), { likeCount: increment(-1) });
            await batch.commit();

            const set = await this.getLikedLocally();
            set.delete(commentId);
            await AsyncStorage.setItem(LIKED_KEY, JSON.stringify([...set]));
            return true;
        } catch (e) {
            console.error('[Comments] unlike error', e);
            return false;
        }
    },

    /** Load the local set of comment ids this user chose to hide. */
    async getLocallyHidden(): Promise<Set<string>> {
        try {
            const raw = await AsyncStorage.getItem(HIDDEN_KEY);
            return raw ? new Set(JSON.parse(raw) as string[]) : new Set();
        } catch { return new Set(); }
    },

    /**
     * Hide a reply for THIS user only — the anonymous-community equivalent
     * of blocking (App Store Guideline 1.2). Client-side only.
     */
    async hideLocally(commentId: string): Promise<void> {
        try {
            const set = await this.getLocallyHidden();
            set.add(commentId);
            await AsyncStorage.setItem(HIDDEN_KEY, JSON.stringify([...set]));
        } catch {}
    },

    /**
     * Report a comment — idempotent per (user, comment); auto-hides at
     * REPORT_THRESHOLD via the same rules trick as public-duas.
     */
    async report(commentId: string, reason: string = 'inappropriate'): Promise<boolean> {
        await ensureSignedIn();
        const user = getFirebaseAuth()?.currentUser;
        if (!user) return false;
        const db = getFirebaseDb();
        const reportId = `${user.uid}_${commentId}`;
        try {
            const reportRef = doc(db, 'comment-reports', reportId);
            const [existingSnap, commentSnap] = await Promise.all([
                getDoc(reportRef),
                getDoc(doc(db, 'comments', commentId)),
            ]);
            if (existingSnap.exists()) return true; // already reported

            const commentData = commentSnap.exists() ? (commentSnap.data() as any) : null;
            const currentCount = commentData?.reportCount ?? 0;
            const willHide = (currentCount + 1) >= REPORT_THRESHOLD;

            await Promise.all([
                setDoc(reportRef, {
                    userId: user.uid,
                    commentId,
                    reason,
                    createdAt: serverTimestamp(),
                }),
                updateDoc(doc(db, 'comments', commentId),
                    willHide
                        ? { reportCount: increment(1), hidden: true }
                        : { reportCount: increment(1) }
                ),
            ]);
            // The auto-hidden comment no longer shows — keep the parent's
            // "💬 N replies" badge honest. Best-effort.
            if (willHide && commentData && !commentData.hidden) {
                const parentCollection = commentData.parentType === 'dua' ? 'public-duas' : 'community';
                updateDoc(doc(db, parentCollection, commentData.parentId), {
                    replyCount: increment(-1),
                }).catch(() => {});
            }
            return true;
        } catch (e) {
            console.error('[Comments] report error', e);
            return false;
        }
    },

    /** Admin: list ALL comments (incl. hidden), reported-first then newest. */
    async adminListAll(limitN: number = 100): Promise<Comment[]> {
        try {
            const db = getFirebaseDb();
            const snap = await getDocs(query(
                collection(db, 'comments'),
                orderBy('createdAt', 'desc'),
                limit(limitN),
            ));
            const out: Comment[] = [];
            snap.forEach(d => out.push(docToComment(d.id, d.data())));
            out.sort((a, b) => {
                if (b.reportCount !== a.reportCount) return b.reportCount - a.reportCount;
                return b.createdAt.getTime() - a.createdAt.getTime();
            });
            return out;
        } catch (e) {
            console.error('[Comments] adminListAll error', e);
            return [];
        }
    },

    /** Best-effort ±1 on the parent's replyCount badge when a comment's
     * visibility flips. Reads the comment first for its parent pointer. */
    async _adjustParentCount(commentData: any, delta: 1 | -1): Promise<void> {
        try {
            if (!commentData?.parentId) return;
            const db = getFirebaseDb();
            const parentCollection = commentData.parentType === 'dua' ? 'public-duas' : 'community';
            await updateDoc(doc(db, parentCollection, commentData.parentId), {
                replyCount: increment(delta),
            });
        } catch {}
    },

    /** Admin: flip hidden on a comment. Adjusts the parent's badge count. */
    async adminSetHidden(commentId: string, hidden: boolean): Promise<boolean> {
        try {
            const db = getFirebaseDb();
            const snap = await getDoc(doc(db, 'comments', commentId));
            const data = snap.exists() ? (snap.data() as any) : null;
            await updateDoc(doc(db, 'comments', commentId), {
                hidden,
                hiddenAt: hidden ? serverTimestamp() : null,
                hiddenReason: hidden ? 'admin-manual' : null,
            });
            // Only adjust when visibility actually flips.
            if (data && data.hidden !== hidden) {
                this._adjustParentCount(data, hidden ? -1 : 1).catch(() => {});
            }
            return true;
        } catch (e) {
            console.error('[Comments] adminSetHidden error', e);
            return false;
        }
    },

    /** Admin: permanently delete a comment. Adjusts the parent's badge count. */
    async adminDelete(commentId: string): Promise<boolean> {
        try {
            const db = getFirebaseDb();
            const snap = await getDoc(doc(db, 'comments', commentId));
            const data = snap.exists() ? (snap.data() as any) : null;
            await deleteDoc(doc(db, 'comments', commentId));
            // A hidden comment was already subtracted when it was hidden.
            if (data && !data.hidden) {
                this._adjustParentCount(data, -1).catch(() => {});
            }
            return true;
        } catch (e) {
            console.error('[Comments] adminDelete error', e);
            return false;
        }
    },

    /**
     * Notify the parent's author that someone replied. Fires on EVERY reply
     * (not milestone-gated — a reply is a direct response), still rate-limited
     * to one push per author per 60s inside sendMilestonePush's caller-side map.
     * Fire-and-forget; never blocks posting.
     */
    async notifyParentAuthor(parentType: CommentParentType, parentId: string): Promise<void> {
        try {
            const db = getFirebaseDb();
            const parentCollection = parentType === 'dua' ? 'public-duas' : 'community';
            const snap = await getDoc(doc(db, parentCollection, parentId));
            if (!snap.exists()) return;
            const authorId = (snap.data() as any).authorId;
            if (!authorId) return;
            const { sendMilestonePush } = await import('./communityNotify');
            // parentId rides along so a tap can deep-link straight to the thread.
            if (parentType === 'dua') {
                await sendMilestonePush(authorId, 'Someone replied to your dua',
                    'A brother or sister wrote you a reply 🤲', 'dua_reply', { parentId });
            } else {
                await sendMilestonePush(authorId, 'Someone replied to your story',
                    'A reader wrote you a reply ❤️', 'testimony_reply', { parentId });
            }
        } catch { /* never block posting over a notification */ }
    },

    /**
     * Notify OTHER people who already replied in this thread — not just the
     * parent's author. Someone who wrote "praying for you" earlier has no
     * way to know the conversation continued otherwise. Capped to the 2 most
     * recent unique repliers so a busy thread can't turn into a notification
     * storm; the parent's author is excluded since notifyParentAuthor already
     * covers them.
     */
    async notifyPreviousRepliers(
        parentType: CommentParentType,
        parentId: string,
        newCommentId: string,
    ): Promise<void> {
        try {
            const me = getFirebaseAuth()?.currentUser;
            if (!me) return;
            const db = getFirebaseDb();
            const parentCollection = parentType === 'dua' ? 'public-duas' : 'community';
            const parentSnap = await getDoc(doc(db, parentCollection, parentId));
            const parentAuthorId = parentSnap.exists() ? (parentSnap.data() as any).authorId : null;

            // Same query shape (and thus same composite index) as the live
            // thread subscription — just reversed and capped, since we only
            // need enough of the recent tail to find 2 unique other repliers.
            const q = query(
                collection(db, 'comments'),
                where('parentType', '==', parentType),
                where('parentId', '==', parentId),
                where('hidden', '==', false),
                orderBy('createdAt', 'desc'),
                limit(20),
            );
            const snap = await getDocs(q);
            const seen = new Set<string>();
            const targets: string[] = [];
            for (const d of snap.docs) {
                if (d.id === newCommentId) continue;
                const authorId = (d.data() as any).authorId;
                if (!authorId || authorId === me.uid || authorId === parentAuthorId) continue;
                if (seen.has(authorId)) continue;
                seen.add(authorId);
                targets.push(authorId);
                if (targets.length >= 2) break;
            }
            if (targets.length === 0) return;

            const { sendMilestonePush } = await import('./communityNotify');
            const title = parentType === 'dua'
                ? 'New reply in a thread you joined'
                : 'New reply in a story you joined';
            const body = 'Someone else replied too — see what they said 🤲';
            await Promise.all(targets.map(uid =>
                sendMilestonePush(uid, title, body, 'thread_reply', { parentId, parentType })
            ));
        } catch { /* never block posting over a notification */ }
    },

    REPORT_THRESHOLD,
    MAX_LENGTH,
    MAX_NAME_LENGTH,
    FREE_REPLIES_PER_DAY,
};
