import AsyncStorage from '@react-native-async-storage/async-storage';
import { getFirebaseAuth, getFirebaseDb } from './firebase';
import { collection, doc, setDoc, getDocs, query, orderBy, deleteDoc } from 'firebase/firestore';
import { localDateStr } from './localDate';

const LOCAL_KEY = 'tahajjud_journal_v1';

export type SpiritualState = 'tired' | 'focused' | 'emotional' | 'distracted' | 'connected';

export const STATE_OPTIONS: { key: SpiritualState; emoji: string; label: string }[] = [
    { key: 'tired',      emoji: '😴', label: 'Tired'      },
    { key: 'focused',    emoji: '🙏', label: 'Focused'    },
    { key: 'emotional',  emoji: '😢', label: 'Emotional'  },
    { key: 'distracted', emoji: '🌀', label: 'Distracted' },
    { key: 'connected',  emoji: '✨', label: 'Connected'  },
];

export interface JournalEntry {
    id: string;
    date: string;         // YYYY-MM-DD
    rakats: number;
    state: SpiritualState;
    duaText: string;
    createdAt: string;    // ISO
    duaAnswered?: boolean;
}

async function loadLocal(): Promise<JournalEntry[]> {
    try {
        const raw = await AsyncStorage.getItem(LOCAL_KEY);
        return raw ? JSON.parse(raw) : [];
    } catch { return []; }
}

async function saveLocal(entries: JournalEntry[]): Promise<void> {
    await AsyncStorage.setItem(LOCAL_KEY, JSON.stringify(entries));
}

// ── Live subscription so any open screen updates the moment data changes ──
type Listener = (entries: JournalEntry[]) => void;
const listeners = new Set<Listener>();

function notify(entries: JournalEntry[]) {
    const sorted = [...entries].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    listeners.forEach(l => { try { l(sorted); } catch { /* ignore */ } });
}

export const TahajjudJournal = {
    async getAll(): Promise<JournalEntry[]> {
        const entries = await loadLocal();
        return entries.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    },

    async save(entry: Omit<JournalEntry, 'id' | 'createdAt'>): Promise<JournalEntry> {
        const id = `${entry.date}_${Date.now()}`;
        const full: JournalEntry = { ...entry, id, createdAt: new Date().toISOString() };

        const existing = await loadLocal();
        // Replace entry for same date if exists, else prepend
        const filtered = existing.filter(e => e.date !== entry.date);
        const next = [full, ...filtered];
        await saveLocal(next);
        // Notify subscribers immediately — every open view refreshes
        notify(next);

        // Sync to Firestore if signed in (background — don't block UI)
        (async () => {
            try {
                const user = getFirebaseAuth().currentUser;
                if (user) {
                    const db = getFirebaseDb();
                    await setDoc(doc(db, 'users', user.uid, 'journal', id), full);
                }
            } catch { /* offline — local save is enough */ }
        })();

        return full;
    },

    /** Subscribe to live entry updates. Returns an unsubscribe fn. */
    subscribe(listener: Listener): () => void {
        listeners.add(listener);
        return () => { listeners.delete(listener); };
    },

    async getToday(): Promise<JournalEntry | null> {
        const today = localDateStr(new Date());
        const entries = await loadLocal();
        return entries.find(e => e.date === today) ?? null;
    },

    async markAnswered(id: string, answered: boolean): Promise<void> {
        const entries = await loadLocal();
        const updated = entries.map(e => e.id === id ? { ...e, duaAnswered: answered } : e);
        await saveLocal(updated);
        notify(updated);
        (async () => {
            try {
                const user = getFirebaseAuth().currentUser;
                if (user) {
                    const entry = updated.find(e => e.id === id);
                    if (entry) {
                        await setDoc(doc(getFirebaseDb(), 'users', user.uid, 'journal', id), entry);
                    }
                }
            } catch { /* ignore */ }
        })();
    },

    async delete(id: string): Promise<void> {
        const entries = await loadLocal();
        const next = entries.filter(e => e.id !== id);
        await saveLocal(next);
        notify(next);
        (async () => {
            try {
                const user = getFirebaseAuth().currentUser;
                if (user) {
                    await deleteDoc(doc(getFirebaseDb(), 'users', user.uid, 'journal', id));
                }
            } catch { /* ignore */ }
        })();
    },
};
