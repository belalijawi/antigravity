/**
 * Previously this file bundled 5 language translations (~6.3 MB of JSON)
 * directly into the app for every user, regardless of their language.
 *
 * They are now fetched on-demand from alquran.cloud the first time a user
 * selects that language, then cached permanently in AsyncStorage — identical
 * offline behaviour after the first load, with ~6 MB saved for every user.
 *
 * The only kept metadata is the display names, which are tiny.
 */

// Metadata is still kept here (a few hundred bytes) so the language picker
// can show native-script names without a network request.
const META: Record<string, { name: string; englishName: string; language: string }> = {
    'ur.kanzuliman': { name: 'کنزالایمان',       englishName: 'Kanz ul Iman (Ahmed Raza Khan)', language: 'ur' },
    'id.indonesian': { name: 'Bahasa Indonesia',  englishName: 'Bahasa Indonesia',               language: 'id' },
    'tr.diyanet':    { name: 'Diyanet İşleri',    englishName: 'Diyanet Isleri',                 language: 'tr' },
    'bn.bengali':    { name: 'বাংলা',             englishName: 'Zohurul Hoque',                  language: 'bn' },
    'fr.hamidullah': { name: 'Muhammad Hamidullah', englishName: 'Muhammad Hamidullah',          language: 'fr' },
};

/**
 * Previously returned true for 5 languages that were bundled as local JSON.
 * Now always returns false — every non-English, non-Arabic edition is fetched
 * from the API and cached in AsyncStorage on first use.
 */
export function isBundledTranslation(_edition: string): boolean {
    return false;
}

/** No longer used — kept for API compatibility, always returns null. */
export function getBundledSurahText(_edition: string, _surahNumber: number): string[] | null {
    return null;
}

/** Display metadata for a known edition identifier. */
export function getBundledEditionMeta(edition: string) {
    return META[edition];
}
