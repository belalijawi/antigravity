/**
 * Parses the alquran.cloud `quran-tajweed` edition's embedded markup into
 * styled tokens. The API returns ayah text with wrappers like:
 *
 *   [h:9421[ٱ]   — Hamza wasl (silent alif)
 *   [s:1404[ٱل  — Sun letter
 *   [n:9421[ن]   — Ghunnah (nasal)
 *   [p:9421[م]   — Idgham (merging)
 *   ...
 *
 * Different APIs use different markups. alquran.cloud uses single-letter
 * codes wrapped in [code:hash[text] format. We map each code to a Tajweed
 * rule + color following the King Fahd Complex coloring convention.
 */

export type TajweedRule =
    | 'hamza_wasl'      // silent alif
    | 'sun_letter'      // letter of sun (assimilated alif)
    | 'madda_normal'    // natural prolongation
    | 'madda_permissible' // permissible madd
    | 'madda_necessary' // obligatory madd
    | 'madda_obligatory' // obligatory connected madd
    | 'qalaqah'         // bouncing letter
    | 'ghunnah'         // nasalisation
    | 'ikhfa'           // hiding
    | 'idgham'          // merging
    | 'iqlab'           // conversion
    | 'silent'          // silent letter
    | 'normal';         // no Tajweed rule

export interface TajweedToken {
    text: string;
    rule: TajweedRule;
}

// alquran.cloud (Tanzil-tajweed) marker → rule
// References: https://api.alquran.cloud/v1/edition/format/text
//             https://www.tanzil.net/docs/quran_tajweed
const CODE_MAP: Record<string, TajweedRule> = {
    h: 'hamza_wasl',
    s: 'silent',          // assimilated/silent
    l: 'sun_letter',      // lam shamsiyyah
    n: 'normal',
    p: 'iqlab',
    f: 'idgham',          // farq (idgham mutamathilain etc)
    q: 'qalaqah',
    o: 'normal',
    c: 'idgham',          // idgham complete
    w: 'idgham',          // idgham bi ghunnah
    i: 'ikhfa',
    a: 'ikhfa',
    u: 'ghunnah',
    d: 'ghunnah',
    m: 'madda_normal',
};

/** Default King Fahd Complex–style coloring. */
export const TAJWEED_COLORS: Record<TajweedRule, string> = {
    hamza_wasl: '#7e7e7e',
    sun_letter: '#aaaaaa',
    silent: '#666666',
    madda_normal: '#22c55e',
    madda_permissible: '#16a34a',
    madda_necessary: '#dc2626',
    madda_obligatory: '#dc2626',
    qalaqah: '#fb923c',
    ghunnah: '#0ea5e9',
    ikhfa: '#a855f7',
    idgham: '#7e22ce',
    iqlab: '#ec4899',
    normal: '#f1f5f9',
};

/**
 * Parses Tajweed-marked text into a sequence of tokens.
 * Falls back to a single 'normal' token if no markers are present.
 *
 * Marker format: [code:hash[text]
 *
 * Example input: "[h:9421[ٱ]لْحَمْدُ لِ[l:9421[ل]َّ]هِ"
 */
export function parseTajweed(raw: string): TajweedToken[] {
    if (!raw) return [];
    if (!/\[\w:/.test(raw)) {
        // No markup — return as a single normal token
        return [{ text: raw, rule: 'normal' }];
    }

    const tokens: TajweedToken[] = [];
    let i = 0;
    while (i < raw.length) {
        // Look for a marker [code:hash[
        const markerStart = raw.indexOf('[', i);
        if (markerStart === -1) {
            const rest = raw.slice(i);
            if (rest) tokens.push({ text: rest, rule: 'normal' });
            break;
        }
        // Plain text before the marker
        if (markerStart > i) {
            tokens.push({ text: raw.slice(i, markerStart), rule: 'normal' });
        }
        // Parse "[code:hash[" header
        const headerEnd = raw.indexOf('[', markerStart + 1);
        if (headerEnd === -1) {
            tokens.push({ text: raw.slice(markerStart), rule: 'normal' });
            break;
        }
        const header = raw.slice(markerStart + 1, headerEnd); // "h:9421"
        const code = header.split(':')[0]?.toLowerCase() ?? '';
        const rule: TajweedRule = CODE_MAP[code] ?? 'normal';
        // Find the closing bracket of the styled chunk
        const closeBracket = raw.indexOf(']', headerEnd + 1);
        if (closeBracket === -1) {
            // Malformed — emit rest as plain
            tokens.push({ text: raw.slice(headerEnd + 1), rule: 'normal' });
            break;
        }
        const styledText = raw.slice(headerEnd + 1, closeBracket);
        if (styledText) tokens.push({ text: styledText, rule });
        i = closeBracket + 1;
    }
    return tokens.filter(t => t.text.length > 0);
}

/** True if the given edition string returns Tajweed-marked text. */
export function isTajweedEdition(edition: string): boolean {
    return edition === 'quran-tajweed';
}
