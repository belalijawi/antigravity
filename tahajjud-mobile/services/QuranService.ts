import AsyncStorage from '@react-native-async-storage/async-storage';
import {
    isBundledTranslation, getBundledSurahText, getBundledEditionMeta,
} from './BundledTranslations';

export interface SurahMeta {
    number: number;
    name: string;
    englishName: string;
    englishNameTranslation: string;
    numberOfAyahs: number;
    revelationType: string;
}

export interface Ayah {
    number: number;
    text: string;
    numberInSurah: number;
}

export interface SurahDetail {
    number: number;
    name: string;
    englishName: string;
    englishNameTranslation: string;
    revelationType: string;
    numberOfAyahs: number;
    ayahs: Ayah[];
    edition: {
        identifier: string;
        language: string;
        name: string;
        englishName: string;
    };
    audioAyahs?: Ayah[];
}

export interface Edition {
    identifier: string;
    language: string;
    name: string;
    englishName: string;
    format: string;
    type: string;
}

// Tanzil-sourced local dataset (quran-json package) — verified Saheeh International + Uthmani Arabic
// All 6,236 ayahs bundled locally: zero network dependency, zero API errors
const LOCAL_QURAN_DATA: any[] = require('quran-json/dist/quran_en.json');

const LOCAL_SURAH_LIST: SurahMeta[] = LOCAL_QURAN_DATA.map((s: any) => ({
    number: s.id,
    name: s.name,
    englishName: s.transliteration,
    englishNameTranslation: s.translation,
    numberOfAyahs: s.total_verses,
    revelationType: s.type.charAt(0).toUpperCase() + s.type.slice(1),
}));

function buildSurahDetailFromLocal(surahData: any, edition: string, useArabic: boolean): SurahDetail {
    return {
        number: surahData.id,
        name: surahData.name,
        englishName: surahData.transliteration,
        englishNameTranslation: surahData.translation,
        revelationType: surahData.type.charAt(0).toUpperCase() + surahData.type.slice(1),
        numberOfAyahs: surahData.total_verses,
        ayahs: surahData.verses.map((v: any) => ({
            number: v.id,
            text: useArabic ? v.text : v.translation,
            numberInSurah: v.id,
        })),
        edition: {
            identifier: edition,
            language: useArabic ? 'ar' : 'en',
            name: useArabic ? 'Uthmani (Tanzil)' : 'Saheeh International (Tanzil)',
            englishName: useArabic ? 'Uthmani (Tanzil)' : 'Saheeh International (Tanzil)',
        },
    };
}

const BASE_URL = 'https://api.alquran.cloud/v1';

/**
 * fetch() with a hard timeout. RN's fetch has no default timeout — on slow or
 * dead networks (common on cellular data) requests could hang forever and
 * leave the user staring at a spinner. 10s is generous for the Quran APIs.
 */
async function fetchWithTimeout(url: string, ms = 10000): Promise<Response> {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), ms);
    try {
        return await fetch(url, { signal: controller.signal });
    } finally {
        clearTimeout(id);
    }
}

export const QuranService = {
    // Get list of all 114 Surahs — served from local Tanzil dataset
    async getSurahList(): Promise<SurahMeta[]> {
        return LOCAL_SURAH_LIST;
    },

    // Get specific Surah — local for Arabic/English, API for all other translations
    async getSurah(number: number, edition: string = 'en.sahih'): Promise<SurahDetail | null> {
        // ✅ Local Tanzil data — verified, offline, instant
        if (edition === 'en.sahih') {
            const surahData = LOCAL_QURAN_DATA[number - 1];
            if (!surahData) return null;
            return buildSurahDetailFromLocal(surahData, edition, false);
        }

        if (edition === 'quran-uthmani') {
            const surahData = LOCAL_QURAN_DATA[number - 1];
            if (!surahData) return null;
            return buildSurahDetailFromLocal(surahData, edition, true);
        }

        // ✅ Bundled translations — Urdu, Indonesian, Turkish, Bengali, French
        // Load instantly from local data, no network round-trip
        if (isBundledTranslation(edition)) {
            const ayahTexts = getBundledSurahText(edition, number);
            // Without surah metadata we can't show a header — bail to network fallback below
            const surahData = LOCAL_QURAN_DATA[number - 1];
            if (!ayahTexts || !surahData) {
                // Fall through to the API path so we don't render an empty/unusable surah
            } else {
                const meta = getBundledEditionMeta(edition);
                return {
                    number,
                    name: surahData.name,
                    englishName: surahData.transliteration,
                    englishNameTranslation: surahData.translation,
                    revelationType: surahData.type
                        ? surahData.type.charAt(0).toUpperCase() + surahData.type.slice(1)
                        : '',
                    numberOfAyahs: ayahTexts.length,
                    ayahs: ayahTexts.map((text, idx) => ({
                        number: idx + 1,
                        text,
                        numberInSurah: idx + 1,
                    })),
                    edition: {
                        identifier: edition,
                        language: meta?.language ?? '',
                        name: meta?.name ?? edition,
                        englishName: meta?.englishName ?? edition,
                    },
                };
            }
        }

        const translationCacheKey = `quran_translation_v1_${number}_${edition}`;

        // Check translation cache first
        try {
            const cached = await AsyncStorage.getItem(translationCacheKey);
            if (cached) return JSON.parse(cached);
        } catch { /* ignore */ }

        // The Clear Quran (Khattab) via secondary API
        if (edition === 'en.khattab') {
            try {
                const response = await fetchWithTimeout(`https://quranapi.pages.dev/api/${number}.json`);
                const data = await response.json();
                const result = {
                    number: data.surahNo,
                    name: data.surahNameArabic,
                    englishName: data.surahName,
                    englishNameTranslation: data.surahNameTranslation,
                    revelationType: data.revelationPlace === 'Mecca' ? 'Meccan' : 'Medinan',
                    numberOfAyahs: data.totalAyah,
                    ayahs: data.english.map((text: string, index: number) => ({
                        number: index + 1,
                        text: text,
                        numberInSurah: index + 1
                    })),
                    edition: {
                        identifier: 'en.khattab',
                        language: 'en',
                        name: 'The Clear Quran (Dr. Mustafa Khattab)',
                        englishName: 'The Clear Quran (Dr. Mustafa Khattab)'
                    }
                };
                await AsyncStorage.setItem(translationCacheKey, JSON.stringify(result));
                return result;
            } catch (error) {
                console.error('Error fetching Khattab translation:', error);
                return null;
            }
        }

        // All other translations — fetched from alquran.cloud API
        try {
            const response = await fetchWithTimeout(`${BASE_URL}/surah/${number}/${edition}`);
            const data = await response.json();
            if (data.code === 200) {
                await AsyncStorage.setItem(translationCacheKey, JSON.stringify(data.data));
                return data.data;
            }
            return null;
        } catch (error) {
            console.error(error);
            return null;
        }
    },

    // Get list of available editions (translations/audio)
    async getAvailableEditions(format: string = 'text'): Promise<Edition[]> {
        try {
            const response = await fetchWithTimeout(`${BASE_URL}/edition?format=${format}`);
            const data = await response.json();
            if (data.code === 200) {
                // Filter to only include translations or audio reciters
                return data.data.filter((e: Edition) =>
                    format === 'text' ? e.type === 'translation' : e.type === 'versebyverse'
                );
            }
            return [];
        } catch (error) {
            console.error(error);
            return [];
        }
    },

    // Get audio recitation for a surah — cached in AsyncStorage
    async getAudioRecitation(number: number, reciter: string = 'ar.alafasy'): Promise<Ayah[]> {
        // ⚠️  Audio source overrides — bumped cache key so previously-cached
        // low-quality URLs are skipped after this fix ships.
        const cacheKey = `quran_audio_v2_${number}_${reciter}`;
        try {
            const cached = await AsyncStorage.getItem(cacheKey);
            if (cached) return JSON.parse(cached);
        } catch { /* ignore */ }

        try {
            const response = await fetchWithTimeout(`${BASE_URL}/surah/${number}/${reciter}`);
            const data = await response.json();
            if (data.code === 200) {
                const result = data.data.ayahs.map((ayah: any) => ({
                    number: ayah.number,
                    text: ayah.audio as string,
                    numberInSurah: ayah.numberInSurah,
                }));

                // ── Maher Al-Mueaqly audio fix ────────────────────────────
                // islamic.network serves Maher at 22kHz / 64kbps, which sounds
                // muffled and (per user reports) glitchy compared to other
                // reciters who serve at 44kHz. everyayah.com hosts the SAME
                // recording at 44.1kHz, so we redirect Maher URLs to that
                // source. Other reciters are left untouched.
                if (reciter === 'ar.mahermuaiqly') {
                    for (const ayah of result) {
                        const sp = String(number).padStart(3, '0');
                        const ap = String(ayah.numberInSurah).padStart(3, '0');
                        ayah.text = `https://everyayah.com/data/Maher_AlMuaiqly_64kbps/${sp}${ap}.mp3`;
                    }
                }

                await AsyncStorage.setItem(cacheKey, JSON.stringify(result));
                return result;
            }
            return [];
        } catch (error) {
            console.error('Error fetching audio:', error);
            return [];
        }
    }
};
