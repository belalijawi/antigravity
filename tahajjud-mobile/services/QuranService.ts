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

        // The Clear Quran (Khattab) via secondary API
        if (edition === 'en.khattab') {
            try {
                const response = await fetch(`https://quranapi.pages.dev/api/${number}.json`);
                const data = await response.json();
                return {
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
            } catch (error) {
                console.error('Error fetching Khattab translation:', error);
                return null;
            }
        }

        // All other translations — fetched from alquran.cloud API
        try {
            const response = await fetch(`${BASE_URL}/surah/${number}/${edition}`);
            const data = await response.json();
            if (data.code === 200) {
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
            const response = await fetch(`${BASE_URL}/edition?format=${format}`);
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

    // Get audio recitation for a surah
    async getAudioRecitation(number: number, reciter: string = 'ar.alafasy'): Promise<Ayah[]> {
        try {
            const response = await fetch(`${BASE_URL}/surah/${number}/${reciter}`);
            const data = await response.json();
            if (data.code === 200) {
                return data.data.ayahs.map((ayah: any) => ({
                    number: ayah.number,
                    text: ayah.audio, // Use text field to store audio URL for audio-only fetches
                    numberInSurah: ayah.numberInSurah
                }));
            }
            return [];
        } catch (error) {
            console.error('Error fetching audio:', error);
            return [];
        }
    }
};
