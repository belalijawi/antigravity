import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getFirebaseDb, ensureSignedIn } from './firebase';

/**
 * Admin-broadcast announcement — a single Firestore doc, checked once on
 * app launch. Unlike the "What's New" card (hardcoded content baked into
 * the app binary, only changes with a new release), this is entirely
 * remote: publish a new one from the Moderation panel and every already-
 * installed user sees it next time they open the app, no update required.
 *
 * Deliberately a SINGLE doc (app_config/announcement — same collection
 * TopPicksService already uses for admin-curated config: public read,
 * admin-only write, no new rules needed), not its own collection — there is
 * only ever one "current" announcement. Publishing a new one simply
 * overwrites it with a fresh `id` (a timestamp string), which is what the
 * client compares against its locally-remembered "last seen id" to decide
 * whether to show it again.
 */

const DOC_PATH = ['app_config', 'announcement'] as const;
const SEEN_KEY = 'announcement-seen-id-v1';

export interface Announcement {
    id: string;
    title: string;
    body: string;
    active: boolean;
}

export const Announcements = {
    /** Public read — any signed-in user (matches other app-wide config reads). */
    async get(): Promise<Announcement | null> {
        try {
            await ensureSignedIn();
            const db = getFirebaseDb();
            const snap = await getDoc(doc(db, DOC_PATH[0], DOC_PATH[1]));
            if (!snap.exists()) return null;
            const data = snap.data() as any;
            if (!data.id || !data.title) return null;
            return { id: data.id, title: data.title, body: data.body ?? '', active: data.active ?? false };
        } catch (e) {
            console.error('[Announcements] get error', e);
            return null;
        }
    },

    /** Should THIS device show it — active, and not already seen. */
    async shouldShow(announcement: Announcement | null): Promise<boolean> {
        if (!announcement || !announcement.active) return false;
        try {
            const seenId = await AsyncStorage.getItem(SEEN_KEY);
            return seenId !== announcement.id;
        } catch { return false; }
    },

    async markSeen(id: string): Promise<void> {
        try { await AsyncStorage.setItem(SEEN_KEY, id); } catch {}
    },

    /** Admin: publish (or replace) the current announcement. A fresh `id`
     * every time means even a device that saw a PREVIOUS announcement will
     * see this new one. Server enforces admin UID (see firestore.rules). */
    async publish(title: string, body: string): Promise<Announcement | null> {
        try {
            const db = getFirebaseDb();
            const announcement: Announcement = { id: String(Date.now()), title: title.trim(), body: body.trim(), active: true };
            await setDoc(doc(db, DOC_PATH[0], DOC_PATH[1]), { ...announcement, publishedAt: serverTimestamp() });
            return announcement;
        } catch (e) {
            console.error('[Announcements] publish error', e);
            return null;
        }
    },

    /** Admin: turn off the current announcement without deleting it —
     * devices that already saw it are unaffected either way; this just
     * stops it from being shown to anyone new. */
    async deactivate(): Promise<boolean> {
        try {
            const db = getFirebaseDb();
            await setDoc(doc(db, DOC_PATH[0], DOC_PATH[1]), { active: false }, { merge: true });
            return true;
        } catch (e) {
            console.error('[Announcements] deactivate error', e);
            return false;
        }
    },
};
