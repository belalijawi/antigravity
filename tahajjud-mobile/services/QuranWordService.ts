/**
 * Fetches word-by-word Arabic text + transliteration + English meaning from QDC API.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

const QDC_BASE = 'https://api.qurancdn.com/api/qdc';
const CACHE_PREFIX = 'qdc_words_v2_'; // bumped from v1 to include transliteration

export interface QuranWord {
    position: number;       // 1-based word position in the ayah
    arabic: string;         // Uthmani Arabic text
    transliteration: string; // Romanized pronunciation (e.g. "bismillāhi")
    meaning: string;        // English gloss
}

export interface AyahWords {
    ayahNumber: number; // 1-based
    words: QuranWord[];
}

export const QuranWordService = {
    async getSurahWords(surahNumber: number): Promise<AyahWords[]> {
        const cacheKey = `${CACHE_PREFIX}${surahNumber}`;
        try {
            const cached = await AsyncStorage.getItem(cacheKey);
            if (cached) return JSON.parse(cached);
        } catch { /* ignore */ }

        try {
            // QDC paginates at 50 verses — fetch all pages
            const allAyahs: AyahWords[] = [];
            let page = 1;
            const perPage = 50;

            while (true) {
                // 12s timeout per page so a single slow request doesn't hang
                // the whole pagination loop on a long surah.
                const controller = new AbortController();
                const tid = setTimeout(() => controller.abort(), 12000);
                const res = await fetch(
                    `${QDC_BASE}/verses/by_chapter/${surahNumber}?words=true&word_fields=text_uthmani,transliteration_text,translation_text&page=${page}&per_page=${perPage}`,
                    { headers: { 'Accept': 'application/json' }, signal: controller.signal }
                ).finally(() => clearTimeout(tid));
                if (!res.ok) break;
                const data = await res.json();
                const verses: any[] = data.verses ?? [];

                for (const verse of verses) {
                    const words: QuranWord[] = (verse.words ?? [])
                        .filter((w: any) => w.char_type_name !== 'end') // skip ayah number glyph
                        .map((w: any, i: number) => ({
                            position: i + 1,
                            arabic: w.text_uthmani ?? w.text ?? '',
                            transliteration: w.transliteration?.text ?? '',
                            meaning: w.translation?.text ?? '',
                        }));
                    allAyahs.push({ ayahNumber: verse.verse_number, words });
                }

                if (verses.length < perPage) break;
                page++;
            }

            await AsyncStorage.setItem(cacheKey, JSON.stringify(allAyahs));
            return allAyahs;
        } catch (e) {
            console.error('QuranWordService error:', e);
            return [];
        }
    },
};
