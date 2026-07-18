/**
 * Client-side community milestone notifications.
 *
 * When a user's dua receives an Ameen / "praying for", or their testimony
 * gets a like, we notify the author. This is done client-side (the reactor's
 * device sends the push) because the project is on Firebase's free Spark plan
 * which can't run Cloud Functions — same trust model as partner wake-ups.
 *
 * Rate-limiting: we cap at one notification per (author, type) per 60 seconds
 * so rapid Ameens from multiple users don't spam the author's lock screen.
 */

import { doc, getDoc } from 'firebase/firestore';
import { getFirebaseAuth, getFirebaseDb } from './firebase';

// Milestones used by testimony submissions (still milestone-gated).
const MILESTONES = [1, 10, 25, 50, 100, 250, 500];
export function isMilestone(count: number): boolean {
    return MILESTONES.includes(count);
}

// In-memory rate-limit: track the last time we sent a push for each author+type.
// Resets on app restart, which is fine — we just want to avoid a burst.
const lastSentAt = new Map<string, number>();
const RATE_LIMIT_MS = 60_000; // one notification per author per 60 seconds

/**
 * Sends a push to `authorId`. No-ops if:
 *  - the author is the current user (don't notify yourself)
 *  - the author has no stored push token
 *  - a notification for this author+type was sent within the last 60 seconds
 */
export async function sendMilestonePush(
    authorId: string,
    title: string,
    body: string,
    type: 'dua_milestone' | 'testimony_milestone' | 'top_dua' | 'top_story',
): Promise<void> {
    try {
        const me = getFirebaseAuth()?.currentUser;
        if (!me || me.uid === authorId) return; // never notify self

        // Rate-limit: skip if we already sent one recently for this author+type
        const rateKey = `${authorId}_${type}`;
        const last = lastSentAt.get(rateKey) ?? 0;
        if (Date.now() - last < RATE_LIMIT_MS) return;
        lastSentAt.set(rateKey, Date.now());

        const db = getFirebaseDb();
        const snap = await getDoc(doc(db, 'push_tokens', authorId));
        const token = snap.exists() ? (snap.data() as any).token : null;
        if (!token) return;

        const controller = new AbortController();
        const tid = setTimeout(() => controller.abort(), 10000);
        const res = await fetch('https://exp.host/--/api/v2/push/send', {
            method: 'POST',
            signal: controller.signal,
            headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
            body: JSON.stringify({
                to: token, title, body,
                sound: 'default', priority: 'high',
                data: { type },
            }),
        });
        clearTimeout(tid);
        if (__DEV__) {
            const json = await res.json().catch(() => null);
            if (json?.data?.status === 'error') {
                console.warn('[communityNotify] Expo push error:', json.data.message, 'token:', token?.slice(0, 20));
            }
        }
    } catch { /* never block the reaction over a notification */ }
}
