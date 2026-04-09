/**
 * Fetches word-level timing data from the Quran Data Center (QDC) API.
 * Reciter 7 = Mishary Rashid Alafasy (Murattal) — same recitation used in the app.
 *
 * Each segment: [word_number_1based, start_ms, end_ms]
 * The audio URLs come from the same source so timing is guaranteed to match.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

const RECITER_ID = 7; // Mishary Rashid Alafasy
const QDC_BASE = 'https://api.qurancdn.com/api/qdc';
const CACHE_PREFIX = 'qdc_timing_v2_';

export interface WordTiming {
    wordIndex: number; // 0-based position in the ayah
    startMs: number;
    endMs: number;
}

export interface AyahAudioData {
    ayahNumber: number;  // 1-based
    audioUrl: string;
    duration: number;
    segments: WordTiming[];
}

/**
 * Given word timing segments and a current playback position,
 * returns the 0-based index of the word being spoken.
 */
export function getWordAtTime(segments: WordTiming[], posMs: number): number {
    if (!segments.length) return -1;
    let active = -1;
    for (let i = 0; i < segments.length; i++) {
        if (posMs >= segments[i].startMs) {
            active = segments[i].wordIndex;
        } else {
            break;
        }
    }
    return active;
}

export const QuranTimingService = {
    async getSurahAudioData(surahNumber: number): Promise<AyahAudioData[]> {
        const cacheKey = `${CACHE_PREFIX}${surahNumber}`;

        // Return from cache if available
        try {
            const cached = await AsyncStorage.getItem(cacheKey);
            if (cached) return JSON.parse(cached);
        } catch { /* ignore cache miss */ }

        // Fetch from QDC
        try {
            const res = await fetch(
                `${QDC_BASE}/audio/reciters/${RECITER_ID}/audio_files?chapter_number=${surahNumber}&segments=true`,
                { headers: { 'Accept': 'application/json' } }
            );
            if (!res.ok) return [];
            const data = await res.json();

            const result: AyahAudioData[] = (data.audio_files ?? []).map((file: any) => {
                // segments: [[word_1based, start_ms, end_ms], ...]
                const segments: WordTiming[] = (file.segments ?? [])
                    .filter((seg: any) => Array.isArray(seg) && seg.length >= 3)
                    .map((seg: number[]) => ({
                        wordIndex: Math.max(0, seg[0] - 1), // convert 1-based → 0-based
                        startMs: seg[1],
                        endMs: seg[2],
                    }));

                // QDC audio_url can be relative or absolute
                const rawUrl: string = file.audio_url ?? '';
                const audioUrl = rawUrl.startsWith('http')
                    ? rawUrl
                    : `https://verses.quran.com/${rawUrl}`;

                return {
                    ayahNumber: file.verse_number,
                    audioUrl,
                    duration: file.duration ?? 0,
                    segments,
                };
            });

            // Cache for future offline use
            await AsyncStorage.setItem(cacheKey, JSON.stringify(result));
            return result;
        } catch (e) {
            console.error('QuranTimingService error:', e);
            return [];
        }
    },

    clearCache: async (surahNumber?: number) => {
        if (surahNumber) {
            await AsyncStorage.removeItem(`${CACHE_PREFIX}${surahNumber}`);
        } else {
            const keys = await AsyncStorage.getAllKeys();
            const timingKeys = keys.filter(k => k.startsWith(CACHE_PREFIX));
            await AsyncStorage.multiRemove(timingKeys);
        }
    },
};
