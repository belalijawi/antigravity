import {
    collection, doc, getDoc, getDocFromServer, getDocs, addDoc, setDoc, deleteDoc, updateDoc, increment,
    query, where, orderBy, serverTimestamp,
} from 'firebase/firestore';
import { getFirebaseAuth, getFirebaseDb } from './firebase';

/**
 * Testimony submission + moderation queue.
 *
 * Flow:
 *   1. User opens "Share Your Story" → fills out form → calls submit()
 *   2. Doc lands in `community-submissions/{id}` with status: 'pending'
 *   3. Admin (you) sees it in TestimonyModerationModal (Settings → Admin)
 *   4. Approve → doc moves to `community` with type: 'testimony' → live to all users
 *   5. Reject → doc deleted from queue
 *
 * Privacy: submitter's UID is stored on the submission for abuse control,
 * but is NEVER shown alongside the published testimony (which has a free-text
 * `author` field — "Anonymous", first name, or whatever the user enters).
 */

export interface SubmittedTestimony {
    title: string;
    body: string;
    author: string;      // free-text — "Anonymous" or first name
    location: string;    // free-text — "London, UK" or empty
    tags: string[];      // 1-3 from storyTopics
}

export interface PendingTestimony extends SubmittedTestimony {
    id: string;
    submitterId: string;
    submittedAt: number;
}

const MAX_TITLE = 80;
const MAX_BODY = 2000;
const MIN_BODY = 50;

const PROFANITY = [
    'fuck', 'shit', 'bitch', 'cunt', 'dick', 'pussy', 'asshole',
    'kill', 'murder', 'suicide', 'rape',
];

export interface SubmitResult {
    ok: boolean;
    error?: 'too-short' | 'too-long' | 'profanity' | 'not-signed-in' | 'rate-limited' | 'firestore-error' | 'missing-tag';
}

export const TestimonySubmission = {
    /** Validate before sending — same word-boundary profanity check as Dua Wall. */
    validate(t: SubmittedTestimony): SubmitResult {
        if (t.title.trim().length === 0 || t.title.length > MAX_TITLE) {
            return { ok: false, error: 'too-long' };
        }
        if (t.body.trim().length < MIN_BODY) return { ok: false, error: 'too-short' };
        if (t.body.length > MAX_BODY) return { ok: false, error: 'too-long' };
        if (t.tags.length === 0) return { ok: false, error: 'missing-tag' };

        const blob = (t.title + ' ' + t.body).toLowerCase();
        const tokens = new Set(blob.split(/[^a-z']+/).filter(Boolean));
        for (const w of PROFANITY) {
            if (tokens.has(w)) return { ok: false, error: 'profanity' };
        }
        return { ok: true };
    },

    /** User-facing: submit a new testimony to the pending queue. */
    async submit(t: SubmittedTestimony): Promise<SubmitResult> {
        const v = this.validate(t);
        if (!v.ok) return v;

        const user = getFirebaseAuth()?.currentUser;
        if (!user) return { ok: false, error: 'not-signed-in' };

        try {
            const db = getFirebaseDb();
            await addDoc(collection(db, 'community-submissions'), {
                title: t.title.trim(),
                body: t.body.trim(),
                author: t.author.trim() || 'Anonymous',
                location: t.location.trim(),
                tags: t.tags.slice(0, 3),
                submitterId: user.uid,
                submittedAt: Date.now(),
                status: 'pending',
            });
            return { ok: true };
        } catch (e) {
            console.error('[Testimony] submit error', e);
            return { ok: false, error: 'firestore-error' };
        }
    },

    /** Admin-only: list all pending submissions, newest first. */
    async listPending(): Promise<PendingTestimony[]> {
        try {
            const db = getFirebaseDb();
            const snap = await getDocs(query(
                collection(db, 'community-submissions'),
                where('status', '==', 'pending'),
                orderBy('submittedAt', 'desc'),
            ));
            const out: PendingTestimony[] = [];
            snap.forEach(d => {
                const data = d.data() as any;
                out.push({
                    id: d.id,
                    title: data.title ?? '',
                    body: data.body ?? '',
                    author: data.author ?? 'Anonymous',
                    location: data.location ?? '',
                    tags: data.tags ?? [],
                    submitterId: data.submitterId ?? '',
                    submittedAt: data.submittedAt ?? 0,
                });
            });
            return out;
        } catch (e) {
            console.error('[Testimony] listPending error', e);
            return [];
        }
    },

    /** Admin-only: promote a pending submission to the live community feed. */
    async approve(submission: PendingTestimony): Promise<boolean> {
        try {
            const db = getFirebaseDb();
            // 1. Create the live doc in `community`
            await addDoc(collection(db, 'community'), {
                type: 'testimony',
                title: submission.title,
                body: submission.body,
                author: submission.author,
                location: submission.location,
                tags: submission.tags,
                reactions: 0,
                authorId: submission.submitterId, // server-only — for like notifications, never displayed
                createdAt: Date.now(),
            });
            // 2. Delete from queue
            await deleteDoc(doc(db, 'community-submissions', submission.id));
            return true;
        } catch (e) {
            console.error('[Testimony] approve error', e);
            return false;
        }
    },

    /** Admin-only: drop a submission. */
    async reject(submissionId: string): Promise<boolean> {
        try {
            const db = getFirebaseDb();
            await deleteDoc(doc(db, 'community-submissions', submissionId));
            return true;
        } catch (e) {
            console.error('[Testimony] reject error', e);
            return false;
        }
    },

    /**
     * Toggle a like (reaction) on a published testimony. Persists to Firestore
     * and is idempotent per (user, testimony) via a marker doc. Returns the new
     * liked state. Liking increments `reactions` which the Cloud Function watches
     * to send milestone notifications to the author.
     */
    async toggleReaction(testimonyId: string): Promise<{ liked: boolean; count: number | null }> {
        const user = getFirebaseAuth()?.currentUser;
        if (!user) return { liked: false, count: null };
        const db = getFirebaseDb();
        const markerRef = doc(db, 'testimony-reactions', `${user.uid}_${testimonyId}`);
        const docRef = doc(db, 'community', testimonyId);
        try {
            const existing = await getDoc(markerRef);
            const liked = !existing.exists();
            if (liked) {
                await Promise.all([
                    setDoc(markerRef, { userId: user.uid, testimonyId, createdAt: serverTimestamp() }),
                    updateDoc(docRef, { reactions: increment(1) }),
                ]);
                this.maybeNotifyTestimonyMilestone(testimonyId).catch(() => {});
            } else {
                await Promise.all([
                    deleteDoc(markerRef),
                    updateDoc(docRef, { reactions: increment(-1) }),
                ]);
            }
            // Read back the authoritative count so the UI never drifts from the server
            let count: number | null = null;
            try {
                const fresh = await getDoc(docRef);
                if (fresh.exists()) count = (fresh.data() as any).reactions ?? null;
            } catch { /* count stays null — UI keeps its optimistic value */ }
            return { liked, count };
        } catch (e) {
            console.error('[Testimony] toggleReaction error', e);
            return { liked: false, count: null };
        }
    },

    /**
     * After a like increment, re-read the testimony and notify the author if
     * the reaction count just landed on a milestone. Fire-and-forget.
     */
    async maybeNotifyTestimonyMilestone(testimonyId: string): Promise<void> {
        try {
            const db = getFirebaseDb();
            // Force server read to get the committed reaction count, not stale cache
            const snap = await getDocFromServer(doc(db, 'community', testimonyId));
            if (!snap.exists()) return;
            const d = snap.data() as any;
            if (!d.authorId) return;
            const c = d.reactions ?? 0;
            const { isMilestone, sendMilestonePush } = await import('./communityNotify');
            if (!isMilestone(c)) return;
            const body = c === 1
                ? 'Someone was moved by your story ❤️'
                : `${c} people have been moved by your story ❤️`;
            await sendMilestonePush(d.authorId, 'Your story is inspiring others', body, 'testimony_milestone');
        } catch { /* never block the reaction over a notification failure */ }
    },

    /** Has the current user already liked this testimony? */
    async hasReacted(testimonyId: string): Promise<boolean> {
        const user = getFirebaseAuth()?.currentUser;
        if (!user) return false;
        try {
            const db = getFirebaseDb();
            const snap = await getDoc(doc(db, 'testimony-reactions', `${user.uid}_${testimonyId}`));
            return snap.exists();
        } catch {
            return false;
        }
    },
};
