import { doc, getDoc, setDoc, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { getFirebaseDb, ensureSignedIn } from './firebase';

/**
 * Admin-curated "Top Dua of the Day" / "Top Story of the Day" picks.
 *
 * This is a manual editorial choice, not a computed metric — the admin
 * picks a specific dua/testimony from the moderation screens, and that
 * choice is stored in one small doc that every client reads.
 *
 * Firestore: app_config/topPicks { topDuaId, topStoryId, updatedAt }
 */

export interface TopPicks {
    topDuaId: string | null;
    topStoryId: string | null;
}

const EMPTY: TopPicks = { topDuaId: null, topStoryId: null };

function ref(db: NonNullable<ReturnType<typeof getFirebaseDb>>) {
    return doc(db, 'app_config', 'topPicks');
}

function fromSnapshotData(data: any): TopPicks {
    return {
        topDuaId: data?.topDuaId ?? null,
        topStoryId: data?.topStoryId ?? null,
    };
}

export const TopPicksService = {
    /** Live subscription — updates instantly when the admin changes a pick. */
    subscribe(cb: (picks: TopPicks) => void): () => void {
        const db = getFirebaseDb();
        if (!db) { cb(EMPTY); return () => {}; }

        // Firestore rules require auth to read app_config. A permission-denied
        // error permanently closes an onSnapshot listener, and on a cold start
        // the anonymous sign-in may still be in flight — attaching before it
        // resolves meant a top pick never showed up at all. Wait for auth first
        // (matches subscribeTahajjudMap's fix for the same failure mode).
        let cancelled = false;
        let unsubSnap: (() => void) | null = null;
        ensureSignedIn().finally(() => {
            if (cancelled) return;
            unsubSnap = onSnapshot(
                ref(db),
                snap => cb(snap.exists() ? fromSnapshotData(snap.data()) : EMPTY),
                () => cb(EMPTY),
            );
        });
        return () => { cancelled = true; unsubSnap?.(); };
    },

    async get(): Promise<TopPicks> {
        try {
            const db = getFirebaseDb();
            if (!db) return EMPTY;
            const snap = await getDoc(ref(db));
            return snap.exists() ? fromSnapshotData(snap.data()) : EMPTY;
        } catch {
            return EMPTY;
        }
    },

    /** Admin only — enforced server-side by firestore.rules. Pass null to clear. */
    async setTopDua(duaId: string | null): Promise<boolean> {
        try {
            const db = getFirebaseDb();
            if (!db) return false;
            await setDoc(ref(db), { topDuaId: duaId, updatedAt: serverTimestamp() }, { merge: true });
            return true;
        } catch (e) {
            console.error('[TopPicks] setTopDua error', e);
            return false;
        }
    },

    /** Admin only — enforced server-side by firestore.rules. Pass null to clear. */
    async setTopStory(testimonyId: string | null): Promise<boolean> {
        try {
            const db = getFirebaseDb();
            if (!db) return false;
            await setDoc(ref(db), { topStoryId: testimonyId, updatedAt: serverTimestamp() }, { merge: true });
            return true;
        } catch (e) {
            console.error('[TopPicks] setTopStory error', e);
            return false;
        }
    },
};
