import AsyncStorage from '@react-native-async-storage/async-storage';

export interface Reciter {
    id: string;          // alquran.cloud edition identifier
    name: string;
    arabicName: string;
    description: string;
}

// 7 reciters — the universally-loved core, no redundancy.
// One murattal-classic, two Haram imams with different timbres,
// two classical Egyptians, and the tajweed reference standard.
export const RECITERS: Reciter[] = [
    {
        id: 'ar.alafasy',
        name: 'Mishary Rashid Alafasy',
        arabicName: 'مشاري راشد العفاسي',
        description: 'Murattal — the most-listened reciter globally',
    },
    {
        id: 'ar.abdurrahmaansudais',
        name: 'Abdurrahman As-Sudais',
        arabicName: 'عبد الرحمن السديس',
        description: 'Imam of Masjid al-Haram, Makkah',
    },
    {
        id: 'ar.mahermuaiqly',
        name: 'Maher Al-Mueaqly',
        arabicName: 'ماهر المعيقلي',
        description: 'Imam of Masjid al-Haram — calm and contemplative',
    },
    {
        id: 'ar.saoodshuraym',
        name: 'Saood Ash-Shuraym',
        arabicName: 'سعود الشريم',
        description: 'Imam of Masjid al-Haram — deep, slow tempo',
    },
    {
        id: 'ar.abdulbasitmurattal',
        name: 'Abdul Basit Abdul Samad',
        arabicName: 'عبد الباسط عبد الصمد',
        description: 'The legendary Egyptian reciter',
    },
    {
        id: 'ar.minshawi',
        name: 'Muhammad Siddiq Al-Minshawi',
        arabicName: 'محمد صديق المنشاوي',
        description: 'Classical Egyptian — pairs well with Husary',
    },
    {
        id: 'ar.husary',
        name: 'Mahmoud Khalil Al-Husary',
        arabicName: 'محمود خليل الحصري',
        description: 'The Tajweed reference standard',
    },
];

const RECITER_KEY = 'selected-reciter-v1';
const DEFAULT_RECITER_ID = 'ar.alafasy';

// Current reciter — synchronous access for non-React callers (e.g. audio service)
let currentReciterId: string = DEFAULT_RECITER_ID;

// Bootstrap from AsyncStorage at module load
(async () => {
    try {
        const saved = await AsyncStorage.getItem(RECITER_KEY);
        if (saved && RECITERS.some(r => r.id === saved)) {
            currentReciterId = saved;
            notify(saved);
        }
    } catch { /* ignore */ }
})();

// ── Pub/sub so UI + audio engine react to changes ──
type Listener = (reciterId: string) => void;
const listeners = new Set<Listener>();
function notify(id: string) {
    listeners.forEach(l => { try { l(id); } catch { /* ignore */ } });
}

export function getCurrentReciterId(): string {
    return currentReciterId;
}

export function getCurrentReciter(): Reciter {
    return RECITERS.find(r => r.id === currentReciterId) ?? RECITERS[0];
}

export async function setCurrentReciter(id: string): Promise<void> {
    if (!RECITERS.some(r => r.id === id)) return;
    if (id === currentReciterId) return;
    currentReciterId = id;
    try { await AsyncStorage.setItem(RECITER_KEY, id); } catch { /* ignore */ }
    notify(id);
}

export function subscribeReciter(listener: Listener): () => void {
    listeners.add(listener);
    return () => { listeners.delete(listener); };
}

/** Reciters available to free users (no premium subscription required). */
export const FREE_RECITER_IDS = ['ar.alafasy'];

/**
 * If the current reciter is premium-only and the user is not premium, revert
 * to the free default. Called from PurchasesContext whenever premium status
 * resolves so a lapsed user can't keep using a paid reciter forever.
 */
export async function enforceReciterAccess(isPremium: boolean): Promise<void> {
    if (isPremium) return;
    if (FREE_RECITER_IDS.includes(currentReciterId)) return;
    await setCurrentReciter(DEFAULT_RECITER_ID);
}

// CDN URL builder — used by both audio context and offline service
export function reciterAudioUrl(reciterId: string, surahNumber: number): string {
    return `https://cdn.islamic.network/quran/audio-surah/128/${reciterId}/${surahNumber}.mp3`;
}
