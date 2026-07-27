/**
 * Shared fuzzy-matching helpers used by every search bar in the app.
 * Goal: the user shouldn't need to type exact spelling, dashes, or know
 * whether the surah name starts with "Al-".
 *
 *   normalize("Al-Fatiha") → "alfatiha"
 *   normalize("Sūratu l-Mulk") → "suratulmulk"
 *   dropAl("alfatiha") → "fatiha"
 *   fuzzyMatch("Al-Fatiha", "ftha") → true (subsequence)
 *   fuzzyMatch("Al-Fatiha", "alfatiha") → true
 *   fuzzyMatch("Al-Fatiha", "fatihah") → true (subsequence tolerant of trailing h)
 */

/**
 * Lowercase, strip diacritics, strip everything non-alphanumeric — but keep
 * the Arabic script block (U+0600-U+06FF). Without that carve-out this
 * stripped Arabic text down to an empty string entirely (it's outside
 * a-z0-9), silently breaking search-by-Arabic-name everywhere this is used.
 */
export function normalize(s: string): string {
    return (s ?? '')
        .toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        // Arabic diacritics (tashkeel/harakat, U+064B-U+065F and U+0670) and
        // Quranic annotation marks (U+06D6-U+06ED) — a different Unicode
        // block than the Latin combining marks above, so NFD doesn't
        // decompose them; strip explicitly so "الفاتحة" and a fully-voweled
        // Quranic "اَلْفَاتِحَة" normalize to the same string.
        .replace(/[\u064b-\u065f\u0670\u06d6-\u06ed]/g, '')
        .replace(/[^a-z0-9\u0600-\u06ff]/g, '');
}

/** Drop a leading "al" article so "alfatiha" and "fatiha" both match. */
export function dropAl(s: string): string {
    return s.startsWith('al') && s.length > 3 ? s.slice(2) : s;
}

/**
 * English plural → singular tolerance: "duas" → "dua", "ayahs" → "ayah".
 * Min length 4 so we don't accidentally chop real short names ("yas", "us").
 */
export function stripPlural(s: string): string {
    return s.length >= 4 && s.endsWith('s') ? s.slice(0, -1) : s;
}

/**
 * Returns true if every char of needle appears in haystack in order — lets
 * "ftha" match "fatiha", "mlk" match "mulk", "supplictn" match "supplication".
 */
export function isSubsequence(needle: string, haystack: string): boolean {
    if (!needle) return true;
    let i = 0;
    for (let j = 0; i < needle.length && j < haystack.length; j++) {
        if (needle[i] === haystack[j]) i++;
    }
    return i === needle.length;
}

/**
 * True if any of `haystacks` matches `query` fuzzily. Tries every
 * combination of with/without the "al" article on both sides, then falls
 * back to a subsequence match for typos and partial spellings.
 */
export function fuzzyMatch(query: string, ...haystacks: (string | null | undefined)[]): boolean {
    const n = normalize(query);
    if (!n) return true; // empty query matches everything
    // Build a small set of query variants so plurals + "al-" prefix work
    // both ways. Substring/subsequence are then checked against each haystack.
    const variants = new Set<string>([n, dropAl(n), stripPlural(n), dropAl(stripPlural(n))]);
    for (const h of haystacks) {
        if (!h) continue;
        const hN = normalize(h);
        if (!hN) continue;
        const hs = dropAl(hN);
        for (const v of variants) {
            if (!v) continue;
            if (hN.includes(v) || hs.includes(v)) return true;
            if (isSubsequence(v, hs) || isSubsequence(v, hN)) return true;
        }
    }
    return false;
}

/**
 * Score how well a haystack matches a query — lower is better.
 *   0 = exact normalized match
 *   1 = haystack starts with the query
 *   2 = haystack contains the query
 *   3 = subsequence match
 *   Infinity = no match
 *
 * Use this to sort search results so the most relevant entry sits at the top.
 */
export function matchScore(query: string, haystack: string | null | undefined): number {
    const n = normalize(query);
    if (!n) return 0;
    const h = normalize(haystack ?? '');
    if (!h) return Infinity;
    const ns = dropAl(n);
    const hs = dropAl(h);
    const np = stripPlural(n);
    const nsp = stripPlural(ns);
    if (h === n || hs === ns || h === np || hs === nsp) return 0;
    if (h.startsWith(n) || hs.startsWith(ns) || h.startsWith(np) || hs.startsWith(nsp)) return 1;
    if (h.includes(n) || hs.includes(ns) || h.includes(np) || hs.includes(nsp)) return 2;
    if (isSubsequence(ns, hs) || isSubsequence(n, h) || isSubsequence(nsp, hs)) return 3;
    return Infinity;
}
