import AsyncStorage from '@react-native-async-storage/async-storage';
import { getFirebaseAuth, getFirebaseDb } from './firebase';
import { collection, doc, setDoc, deleteDoc } from 'firebase/firestore';

export interface PersonalDua {
    id: string;
    title: string;
    arabic?: string;
    transliteration?: string;
    translation?: string;
    notes?: string;
    createdAt: number;
}

// Matches the key already used in DuasTab.tsx and syncService.ts
const STORAGE_KEY = 'personal-duas';
const LEGACY_KEY = 'personal_duas';

// One-time migration from old underscore key → unified dash key.
// Runs on first read; cheap once it's done (legacy entry removed).
let migrationDone = false;
async function migrateLegacyKey(): Promise<void> {
    if (migrationDone) return;
    try {
        const [legacy, current] = await Promise.all([
            AsyncStorage.getItem(LEGACY_KEY),
            AsyncStorage.getItem(STORAGE_KEY),
        ]);
        if (legacy && !current) {
            await AsyncStorage.setItem(STORAGE_KEY, legacy);
        }
        if (legacy) {
            await AsyncStorage.removeItem(LEGACY_KEY);
        }
    } catch { /* ignore */ }
    migrationDone = true;
}

// ── Firestore helpers (background, non-blocking) ──
function cloudSetDua(dua: PersonalDua) {
    (async () => {
        try {
            const user = getFirebaseAuth()?.currentUser;
            if (!user) return;
            const db = getFirebaseDb();
            if (!db) return;
            const ref = doc(db, 'users', user.uid, 'tahajjud_letters', dua.id);
            await setDoc(ref, {
                title: dua.title,
                arabic: dua.arabic ?? null,
                transliteration: dua.transliteration ?? null,
                translation: dua.translation ?? null,
                notes: dua.notes ?? null,
                createdAt: new Date(dua.createdAt),
                updatedAt: new Date(),
            }, { merge: true });
        } catch (e) {
            // Offline / not signed in — local save is still durable
            console.log('[personalDuas] cloud sync skipped:', e);
        }
    })();
}

function cloudDeleteDua(id: string) {
    (async () => {
        try {
            const user = getFirebaseAuth()?.currentUser;
            if (!user) return;
            const db = getFirebaseDb();
            if (!db) return;
            await deleteDoc(doc(db, 'users', user.uid, 'tahajjud_letters', id));
        } catch (e) {
            console.log('[personalDuas] cloud delete skipped:', e);
        }
    })();
}

// ── Live subscription so any open screen updates instantly ──
type Listener = (entries: PersonalDua[]) => void;
const listeners = new Set<Listener>();
function notify(entries: PersonalDua[]) {
    listeners.forEach(l => { try { l(entries); } catch { /* ignore */ } });
}

export const subscribePersonalDuas = (listener: Listener): () => void => {
    listeners.add(listener);
    return () => { listeners.delete(listener); };
};

// ── Local CRUD (with cloud mirror) ──
export const getPersonalDuas = async (): Promise<PersonalDua[]> => {
    try {
        await migrateLegacyKey();
        const jsonValue = await AsyncStorage.getItem(STORAGE_KEY);
        return jsonValue != null ? JSON.parse(jsonValue) : [];
    } catch (e) {
        console.error('Error loading personal duas', e);
        return [];
    }
};

export const savePersonalDua = async (dua: PersonalDua): Promise<boolean> => {
    try {
        const currentDuas = await getPersonalDuas();
        const updatedDuas = [dua, ...currentDuas];
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updatedDuas));
        notify(updatedDuas);
        cloudSetDua(dua);
        return true;
    } catch (e) {
        console.error('Error saving personal dua', e);
        return false;
    }
};

export const deletePersonalDua = async (id: string): Promise<void> => {
    try {
        const currentDuas = await getPersonalDuas();
        const filteredDuas = currentDuas.filter(d => d.id !== id);
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(filteredDuas));
        notify(filteredDuas);
        cloudDeleteDua(id);
    } catch (e) {
        console.error('Error deleting personal dua', e);
    }
};
