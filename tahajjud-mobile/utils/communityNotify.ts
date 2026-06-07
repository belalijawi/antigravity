/**
 * Client-side community milestone notifications.
 *
 * When a user's dua hits an Ameen / "praying for" milestone, or their testimony
 * hits a likes milestone, we notify the author. This is done client-side (the
 * reactor's device sends the push) because the project is on Firebase's free
 * Spark plan, which can't run Cloud Functions. This matches the existing
 * accountability-partner wake-up pattern, which already sends Expo pushes
 * directly from the client.
 *
 * Privacy/safety: author IDs and push tokens are already readable by any
 * authenticated user (same trust model as partner wake-ups). We never notify
 * a user about their own reaction.
 */

import { doc, getDoc } from 'firebase/firestore';
import { getFirebaseAuth, getFirebaseDb } from './firebase';

// Reaction counts that trigger a notification — feels special, never spammy.
const MILESTONES = [1, 10, 25, 50, 100, 250, 500];

export function isMilestone(count: number): boolean {
    return MILESTONES.includes(count);
}

/**
 * Sends a milestone push to `authorId`. No-ops if:
 *  - the author is the current user (don't notify yourself)
 *  - the author has no stored push token
 */
export async function sendMilestonePush(
    authorId: string,
    title: string,
    body: string,
    type: 'dua_milestone' | 'testimony_milestone',
): Promise<void> {
    try {
        const me = getFirebaseAuth()?.currentUser;
        if (!me || me.uid === authorId) return; // never notify self

        const db = getFirebaseDb();
        const snap = await getDoc(doc(db, 'push_tokens', authorId));
        const token = snap.exists() ? (snap.data() as any).token : null;
        if (!token) return;

        const controller = new AbortController();
        const tid = setTimeout(() => controller.abort(), 10000);
        await fetch('https://exp.host/--/api/v2/push/send', {
            method: 'POST',
            signal: controller.signal,
            headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
            body: JSON.stringify({
                to: token, title, body,
                sound: 'default', priority: 'high',
                data: { type },
            }),
        }).finally(() => clearTimeout(tid));
    } catch { /* never block the reaction over a notification */ }
}
