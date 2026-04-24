/**
 * Silently preloads Quran data into AsyncStorage while the app is idle.
 * All heavy services (timing, words, audio URLs) hit the network only once —
 * every subsequent session is served instantly from cache.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { QuranTimingService } from './QuranTimingService';
import { QuranWordService } from './QuranWordService';
import { QuranService } from './QuranService';

// Juz Amma (most commonly memorized surahs) — short ones first
const JUZ_AMMA = [
    114, 113, 112, 111, 110, 109, 108, 107, 106, 105,
    104, 103, 102, 101, 100, 99, 98, 97, 96, 95,
    94, 93, 92, 91, 90, 89, 88, 87, 86, 85,
    84, 83, 82, 81, 80, 79, 78,
];

async function getHifzSurahs(): Promise<number[]> {
    try {
        const raw = await AsyncStorage.getItem('hifz_progress_v1');
        if (!raw) return [];
        const progress: Record<string, any> = JSON.parse(raw);
        const surahs = new Set<number>();
        Object.values(progress).forEach((item: any) => {
            if (item?.surahNumber) surahs.add(item.surahNumber);
        });
        return Array.from(surahs);
    } catch {
        return [];
    }
}

async function isCached(key: string): Promise<boolean> {
    try {
        const v = await AsyncStorage.getItem(key);
        return v !== null;
    } catch {
        return false;
    }
}

async function preloadSurah(surahNumber: number, translationEdition: string): Promise<void> {
    const [timingCached, wordsCached, audioCached] = await Promise.all([
        isCached(`qdc_timing_v2_${surahNumber}`),
        isCached(`qdc_words_v2_${surahNumber}`),
        isCached(`quran_audio_v1_${surahNumber}_ar.alafasy`),
    ]);

    const tasks: Promise<any>[] = [];
    if (!timingCached) tasks.push(QuranTimingService.getSurahAudioData(surahNumber));
    if (!wordsCached) tasks.push(QuranWordService.getSurahWords(surahNumber));
    if (!audioCached) tasks.push(QuranService.getAudioRecitation(surahNumber));

    // Preload translation if non-default and not cached
    if (translationEdition !== 'en.sahih' && translationEdition !== 'quran-uthmani') {
        const translationCached = await isCached(`quran_translation_v1_${surahNumber}_${translationEdition}`);
        if (!translationCached) tasks.push(QuranService.getSurah(surahNumber, translationEdition));
    }

    if (tasks.length > 0) await Promise.allSettled(tasks);
}

export const QuranPreloadService = {
    async preloadInBackground(): Promise<void> {
        try {
            const [hifzSurahs, translationEdition] = await Promise.all([
                getHifzSurahs(),
                AsyncStorage.getItem('hifz_translation_edition_v1').then(v => v ?? 'en.sahih'),
            ]);

            // User's hifz surahs first (most important), then Juz Amma
            const toPreload = [...new Set([...hifzSurahs, ...JUZ_AMMA])];

            for (const surahNumber of toPreload) {
                await preloadSurah(surahNumber, translationEdition);
                // Yield between surahs to keep UI responsive
                await new Promise(r => setTimeout(r, 400));
            }
        } catch {
            // Never crash the app over preloading
        }
    },
};
