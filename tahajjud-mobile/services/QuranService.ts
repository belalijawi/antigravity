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
    audioAyahs?: Ayah[]; // Optional audio URLs mapping
}

export interface Edition {
    identifier: string;
    language: string;
    name: string;
    englishName: string;
    format: string;
    type: string;
}

const BASE_URL = 'https://api.alquran.cloud/v1';

export const QuranService = {
    // Get list of all 114 Surahs
    async getSurahList(): Promise<SurahMeta[]> {
        try {
            const response = await fetch(`${BASE_URL}/surah`);
            const data = await response.json();
            if (data.code === 200) {
                return data.data;
            }
            throw new Error('Failed to fetch Surah list');
        } catch (error) {
            console.error(error);
            return [];
        }
    },

    // Get specific Surah in specific edition (language)
    async getSurah(number: number, edition: string = 'en.sahih'): Promise<SurahDetail | null> {
        // Handle Mustafa Khattab's "The Clear Quran" via secondary API
        if (edition === 'en.khattab') {
            try {
                const response = await fetch(`https://quranapi.pages.dev/api/${number}.json`);
                const data = await response.json();

                // Map the secondary API response to our SurahDetail interface
                return {
                    number: data.surahNo,
                    name: data.surahNameArabic,
                    englishName: data.surahName,
                    englishNameTranslation: data.surahNameTranslation,
                    revelationType: data.revelationPlace === 'Mecca' ? 'Meccan' : 'Medinan',
                    numberOfAyahs: data.totalAyah,
                    ayahs: data.english.map((text: string, index: number) => ({
                        number: index + 1, // This is a simplification, but sufficient for display
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
