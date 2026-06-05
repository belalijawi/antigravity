/**
 * Locally-bundled Quran translations — major non-English languages that load
 * instantly without a network round-trip.
 *
 * Each bundled file is a flat object: { "1": [ayah1, ayah2, ...], "2": [...] }
 * indexed by surah number (string keys 1–114).
 *
 * Source: alquran.cloud /v1/quran/{edition}, downloaded once and compacted.
 * Same Tanzil-verified text as the API would return — guaranteed identical.
 *
 * Total bundle impact: ~6.3 MB across 5 languages.
 */

// Each translation is required statically so Metro includes it in the JS bundle.
// We don't lazy-load — the pay-as-you-go cost is read once + cached in memory.
const BUNDLED: Record<string, () => any> = {
    'ur.kanzuliman': () => require('../data/translations/ur.kanzuliman.json'),
    'id.indonesian': () => require('../data/translations/id.indonesian.json'),
    'tr.diyanet':    () => require('../data/translations/tr.diyanet.json'),
    'bn.bengali':    () => require('../data/translations/bn.bengali.json'),
    'fr.hamidullah': () => require('../data/translations/fr.hamidullah.json'),
};

const META: Record<string, { name: string; englishName: string; language: string }> = {
    'ur.kanzuliman': { name: 'کنزالایمان', englishName: 'Kanz ul Iman (Ahmed Raza Khan)', language: 'ur' },
    'id.indonesian': { name: 'Bahasa Indonesia', englishName: 'Bahasa Indonesia', language: 'id' },
    'tr.diyanet':    { name: 'Diyanet İşleri', englishName: 'Diyanet Isleri', language: 'tr' },
    'bn.bengali':    { name: 'বাংলা', englishName: 'Zohurul Hoque', language: 'bn' },
    'fr.hamidullah': { name: 'Muhammad Hamidullah', englishName: 'Muhammad Hamidullah', language: 'fr' },
};

const cache = new Map<string, Record<string, string[]>>();
// Negative cache: editions we've already failed to load. Prevents repeated
// require() calls (and repeated error logs) on every page navigation.
const failedLoads = new Set<string>();

/** True if this edition is bundled locally and can be served without network. */
export function isBundledTranslation(edition: string): boolean {
    return Object.prototype.hasOwnProperty.call(BUNDLED, edition);
}

/** Returns ayah texts for the given surah from the bundled translation, or null. */
export function getBundledSurahText(edition: string, surahNumber: number): string[] | null {
    if (!isBundledTranslation(edition)) return null;
    if (failedLoads.has(edition)) return null;
    if (!cache.has(edition)) {
        try {
            cache.set(edition, BUNDLED[edition]());
        } catch (e) {
            console.error('[BundledTranslations] failed to load', edition, e);
            failedLoads.add(edition);
            return null;
        }
    }
    const data = cache.get(edition);
    if (!data) return null;
    return data[String(surahNumber)] ?? null;
}

/** Display metadata for a bundled edition (used in the API surah response shape). */
export function getBundledEditionMeta(edition: string) {
    return META[edition];
}
