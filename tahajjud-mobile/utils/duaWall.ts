import {
    collection, doc, addDoc, getDoc, setDoc, getDocs, updateDoc, deleteDoc,
    query, orderBy, limit, where, serverTimestamp, increment,
    onSnapshot, QuerySnapshot, DocumentData,
} from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getFirebaseAuth, getFirebaseDb } from './firebase';
import { format } from 'date-fns';

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
const RATE_LIMIT_MS = 24 * 60 * 60 * 1000; // 24h
const MAX_LENGTH = 280;
const MIN_WORDS = 5;
const REPORT_THRESHOLD = 5;

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
    text: string;
    ameenCount: number;
    prayCount?: number;     // "I'm praying for you" reaction count
    reportCount: number;
    createdAt: Date;
    hidden: boolean;
}

export interface PublishResult {
    ok: boolean;
    error?: 'too-short' | 'too-long' | 'rate-limited' | 'profanity' | 'not-signed-in' | 'firestore-error';
    duaId?: string;
}

export const DuaWall = {
    /** Local-only check — has the user published in the last 24h? */
    async canPublishNow(): Promise<{ ok: boolean; nextAt?: Date }> {
        const v = await AsyncStorage.getItem(RATE_LIMIT_KEY);
        if (!v) return { ok: true };
        const last = parseInt(v, 10);
        const next = last + RATE_LIMIT_MS;
        if (Date.now() >= next) return { ok: true };
        return { ok: false, nextAt: new Date(next) };
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

    async publish(text: string): Promise<PublishResult> {
        const v = this.validate(text);
        if (!v.ok) return v;

        const rate = await this.canPublishNow();
        if (!rate.ok) return { ok: false, error: 'rate-limited' };

        const user = getFirebaseAuth()?.currentUser;
        if (!user) return { ok: false, error: 'not-signed-in' };

        try {
            const db = getFirebaseDb();
            const ref = await addDoc(collection(db, 'public-duas'), {
                text: text.trim(),
                ameenCount: 0,
                reportCount: 0,
                authorId: user.uid, // server-only field
                createdAt: serverTimestamp(),
                hidden: false,
            });
            await AsyncStorage.setItem(RATE_LIMIT_KEY, String(Date.now()));
            return { ok: true, duaId: ref.id };
        } catch (e) {
            console.error('[DuaWall] publish error', e);
            return { ok: false, error: 'firestore-error' };
        }
    },

    /** Subscribe to the most recent N non-hidden duas. */
    subscribeWall(maxItems: number, cb: (duas: PublicDua[]) => void): () => void {
        const db = getFirebaseDb();
        const q = query(
            collection(db, 'public-duas'),
            where('hidden', '==', false),
            orderBy('createdAt', 'desc'),
            limit(maxItems),
        );
        const unsub = onSnapshot(q, (snap: QuerySnapshot<DocumentData>) => {
            const list: PublicDua[] = [];
            snap.forEach(d => {
                const data = d.data() as any;
                list.push({
                    id: d.id,
                    text: data.text ?? '',
                    ameenCount: data.ameenCount ?? 0,
                    prayCount: data.prayCount ?? 0,
                    reportCount: data.reportCount ?? 0,
                    createdAt: data.createdAt?.toDate?.() ?? new Date(),
                    hidden: data.hidden ?? false,
                });
            });
            cb(list);
        }, err => {
            console.error('[DuaWall] subscribe error', err);
        });
        return unsub;
    },

    /**
     * Tap Ameen — idempotent per (user, dua). We store the marker doc with
     * a deterministic id `${uid}_${duaId}` so re-taps from the same user are
     * a no-op. A single getDoc check protects against duplicate increments.
     */
    async ameen(duaId: string): Promise<boolean> {
        const user = getFirebaseAuth()?.currentUser;
        if (!user) return false;
        const db = getFirebaseDb();
        const ameenId = `${user.uid}_${duaId}`;
        try {
            const ameenRef = doc(db, 'ameens', ameenId);
            const existing = await getDoc(ameenRef);
            if (existing.exists()) return true; // already counted — idempotent
            await Promise.all([
                setDoc(ameenRef, {
                    userId: user.uid,
                    duaId,
                    createdAt: serverTimestamp(),
                }),
                updateDoc(doc(db, 'public-duas', duaId), {
                    ameenCount: increment(1),
                }),
            ]);
            // Milestone notification to the dua's author (client-side, free-plan)
            this.maybeNotifyDuaMilestone(duaId, 'ameen').catch(() => {});
            return true;
        } catch (e) {
            console.error('[DuaWall] ameen error', e);
            return false;
        }
    },

    /**
     * After an Ameen/pray increment, re-read the dua and notify the author if
     * the count just landed on a milestone. Safe to fire-and-forget.
     */
    async maybeNotifyDuaMilestone(duaId: string, kind: 'ameen' | 'pray'): Promise<void> {
        const db = getFirebaseDb();
        const snap = await getDoc(doc(db, 'public-duas', duaId));
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
    },

    /**
     * "I'm praying for you" — second reaction type beyond Ameen. Same
     * idempotency pattern: doc id `${uid}_${duaId}` in the `prays` collection.
     * A user can mark BOTH Ameen and Praying on the same dua (they're separate
     * intentions — Ameen affirms the dua, Praying signals personal effort).
     */
    async prayingFor(duaId: string): Promise<boolean> {
        const user = getFirebaseAuth()?.currentUser;
        if (!user) return false;
        const db = getFirebaseDb();
        const prayId = `${user.uid}_${duaId}`;
        try {
            const prayRef = doc(db, 'prays', prayId);
            const existing = await getDoc(prayRef);
            if (existing.exists()) return true; // already counted — idempotent
            await Promise.all([
                setDoc(prayRef, {
                    userId: user.uid,
                    duaId,
                    createdAt: serverTimestamp(),
                }),
                updateDoc(doc(db, 'public-duas', duaId), {
                    prayCount: increment(1),
                }),
            ]);
            // Milestone notification to the dua's author (client-side, free-plan)
            this.maybeNotifyDuaMilestone(duaId, 'pray').catch(() => {});
            return true;
        } catch (e) {
            console.error('[DuaWall] prayingFor error', e);
            return false;
        }
    },

    /** Undo an Ameen — delete the marker and decrement the count. */
    async unameen(duaId: string): Promise<boolean> {
        const user = getFirebaseAuth()?.currentUser;
        if (!user) return false;
        const db = getFirebaseDb();
        const ameenRef = doc(db, 'ameens', `${user.uid}_${duaId}`);
        try {
            const existing = await getDoc(ameenRef);
            if (!existing.exists()) return true; // nothing to undo — already idempotent
            await Promise.all([
                deleteDoc(ameenRef),
                updateDoc(doc(db, 'public-duas', duaId), { ameenCount: increment(-1) }),
            ]);
            return true;
        } catch (e) {
            console.error('[DuaWall] unameen error', e);
            return false;
        }
    },

    /** Undo a "praying for" — delete the marker and decrement the count. */
    async unpray(duaId: string): Promise<boolean> {
        const user = getFirebaseAuth()?.currentUser;
        if (!user) return false;
        const db = getFirebaseDb();
        const prayRef = doc(db, 'prays', `${user.uid}_${duaId}`);
        try {
            const existing = await getDoc(prayRef);
            if (!existing.exists()) return true;
            await Promise.all([
                deleteDoc(prayRef),
                updateDoc(doc(db, 'public-duas', duaId), { prayCount: increment(-1) }),
            ]);
            return true;
        } catch (e) {
            console.error('[DuaWall] unpray error', e);
            return false;
        }
    },

    /**
     * Report a dua — also idempotent per (user, dua) so a single user can't
     * push past the report threshold by spamming. Flagged duas auto-hide
     * server-side via a Firestore trigger.
     */
    async report(duaId: string, reason: string = 'inappropriate'): Promise<boolean> {
        const user = getFirebaseAuth()?.currentUser;
        if (!user) return false;
        const db = getFirebaseDb();
        const reportId = `${user.uid}_${duaId}`;
        try {
            const reportRef = doc(db, 'reports', reportId);
            const existing = await getDoc(reportRef);
            if (existing.exists()) return true; // already reported
            await Promise.all([
                setDoc(reportRef, {
                    userId: user.uid,
                    duaId,
                    reason,
                    createdAt: serverTimestamp(),
                }),
                updateDoc(doc(db, 'public-duas', duaId), {
                    reportCount: increment(1),
                }),
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
                    ameenCount: data.ameenCount ?? 0,
                    reportCount: data.reportCount ?? 0,
                    createdAt: data.createdAt?.toDate?.() ?? new Date(),
                    hidden: data.hidden ?? false,
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
                hiddenAt: hidden ? new Date() : null,
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
};
