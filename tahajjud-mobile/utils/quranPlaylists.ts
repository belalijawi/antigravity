import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'quran_playlists_v1';

export interface QuranPlaylist {
    id: string;
    name: string;
    surahNumbers: number[]; // ordered list of surah numbers
    createdAt: number;
}

function generateId(): string {
    return `playlist_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

async function readAll(): Promise<QuranPlaylist[]> {
    try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return [];
        return parsed as QuranPlaylist[];
    } catch (e) {
        console.error('quranPlaylists: readAll error', e);
        return [];
    }
}

async function writeAll(playlists: QuranPlaylist[]): Promise<void> {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(playlists));
}

export const QuranPlaylists = {
    /** Return all saved playlists (sorted newest first). */
    async getAll(): Promise<QuranPlaylist[]> {
        const all = await readAll();
        return all.sort((a, b) => b.createdAt - a.createdAt);
    },

    /** Persist a playlist (insert or replace by id). */
    async save(playlist: QuranPlaylist): Promise<void> {
        const all = await readAll();
        const idx = all.findIndex(p => p.id === playlist.id);
        if (idx >= 0) {
            all[idx] = playlist;
        } else {
            all.push(playlist);
        }
        await writeAll(all);
    },

    /** Delete a playlist by id. */
    async delete(id: string): Promise<void> {
        const all = await readAll();
        await writeAll(all.filter(p => p.id !== id));
    },

    /**
     * Build a new playlist object (does NOT save it — caller must call save()).
     */
    create(name: string, surahNumbers: number[]): QuranPlaylist {
        return {
            id: generateId(),
            name: name.trim(),
            surahNumbers,
            createdAt: Date.now(),
        };
    },
};
