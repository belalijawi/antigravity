/**
 * Auto-recommends a prayer-time calculation method based on the user's
 * country. The right method depends on what most local masjids use — most
 * users don't know which one to pick, so we default to the regional
 * convention and show a "Recommended for [Country]" badge in Settings.
 *
 * Mapping is intentionally conservative: we only override the default when
 * we're confident a country has a clear convention. Everything else falls
 * back to MWL (Muslim World League, the global default).
 */
import * as Location from 'expo-location';
import * as Localization from 'expo-localization';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DeviceEventEmitter } from 'react-native';

export const METHOD_IDS = {
    JAFARI: 0,         // Shia Ithna-Ashari, Leva Institute, Qum — not country-specific
    KARACHI: 1,        // South Asia (18°)
    ISNA: 2,           // North America (15°)
    MWL: 3,            // Europe, Far East, default (17°)
    UMM_AL_QURA: 4,    // Makkah, Saudi Arabia
    EGYPTIAN: 5,       // Egyptian General Authority of Survey — Egypt
    TEHRAN: 7,         // Institute of Geophysics, University of Tehran — Iran's official method
    GULF: 8,           // Gulf Region — Bahrain, Oman (no more specific dedicated method)
    KUWAIT: 9,         // Kuwait
    QATAR: 10,         // Qatar
    SINGAPORE: 11,     // Majlis Ugama Islam Singapura — Singapore's official method
    UOIF: 12,          // Union des Organisations Islamiques de France (12°) — France
    DIYANET: 13,       // Turkey
    RUSSIA: 14,        // Spiritual Administration of Muslims of Russia
    MOONSIGHTING: 15,  // Moonsighting Committee Worldwide — UK, Ireland, high latitudes
    DUBAI: 16,         // Dubai / UAE (experimental)
    JAKIM: 17,         // Jabatan Kemajuan Islam Malaysia — Malaysia
    TUNISIA: 18,       // Tunisia
    ALGERIA: 19,       // Algeria
    KEMENAG: 20,       // Kementerian Agama — Indonesia
    MOROCCO: 21,       // Morocco
    PORTUGAL: 22,      // Comunidade Islamica de Lisboa — Portugal
    JORDAN: 23,        // Ministry of Awqaf, Islamic Affairs and Holy Places — Jordan
} as const;

/**
 * ISO 3166-1 alpha-2 country code → recommended method id.
 *
 * This intentionally covers every country the Aladhan API has a dedicated,
 * officially-sourced method for — not just majority-Muslim countries.
 * A country's Muslim population size doesn't determine whether it has its
 * own recognized civil/religious authority for prayer times (Singapore and
 * Portugal below are neither majority-Muslim, but both have one). Everything
 * NOT listed here has no such dedicated, verifiable method as of this
 * writing and falls back to MWL — that's a gap to close later with sourced
 * data, not a judgment that MWL is correct for those places.
 */
const COUNTRY_TO_METHOD: Record<string, number> = {
    // North America (ISNA)
    US: METHOD_IDS.ISNA, CA: METHOD_IDS.ISNA, MX: METHOD_IDS.ISNA,

    // Arabian Peninsula — split into each country's own dedicated method
    // where Aladhan has one, rather than lumping them all under Umm al-Qura.
    SA: METHOD_IDS.UMM_AL_QURA,
    AE: METHOD_IDS.DUBAI,
    KW: METHOD_IDS.KUWAIT,
    QA: METHOD_IDS.QATAR,
    BH: METHOD_IDS.GULF,
    OM: METHOD_IDS.GULF,
    YE: METHOD_IDS.UMM_AL_QURA, // no dedicated method; closest regional convention

    // South Asia (Karachi)
    PK: METHOD_IDS.KARACHI, IN: METHOD_IDS.KARACHI, BD: METHOD_IDS.KARACHI,
    AF: METHOD_IDS.KARACHI, LK: METHOD_IDS.KARACHI, NP: METHOD_IDS.KARACHI,

    // Turkey
    TR: METHOD_IDS.DIYANET,
    CY: METHOD_IDS.DIYANET,

    // France — UOIF (12°/12°) is the traditional French convention, distinct
    // enough from MWL (18°/17°) to matter: roughly an hour's difference on
    // Fajr at French latitudes.
    FR: METHOD_IDS.UOIF,

    // UK / Ireland / high-latitude Europe — MCW is what most local timetables
    // (Wifaqul Ulama UK, MCND Ireland, many community calendars) follow.
    GB: METHOD_IDS.MOONSIGHTING,
    IE: METHOD_IDS.MOONSIGHTING,
    // Nordic / high-latitude European countries where the constant-angle methods
    // give problematic times in summer.
    NO: METHOD_IDS.MOONSIGHTING,
    SE: METHOD_IDS.MOONSIGHTING,
    FI: METHOD_IDS.MOONSIGHTING,
    DK: METHOD_IDS.MOONSIGHTING,
    IS: METHOD_IDS.MOONSIGHTING,

    // Iran — Institute of Geophysics, University of Tehran is the country's
    // official method (distinct from the Jafari method used by some Shia
    // communities elsewhere, which is not Iran's civil standard).
    IR: METHOD_IDS.TEHRAN,

    // Russia
    RU: METHOD_IDS.RUSSIA,

    // Egypt, and the Levant countries that also officially follow the
    // Egyptian General Authority of Survey method.
    EG: METHOD_IDS.EGYPTIAN,
    IQ: METHOD_IDS.EGYPTIAN,
    SY: METHOD_IDS.EGYPTIAN,
    LB: METHOD_IDS.EGYPTIAN,

    // Maghreb — each has its own government-run method
    MA: METHOD_IDS.MOROCCO,
    DZ: METHOD_IDS.ALGERIA,
    TN: METHOD_IDS.TUNISIA,

    // Jordan
    JO: METHOD_IDS.JORDAN,

    // Southeast Asia — official state authorities
    ID: METHOD_IDS.KEMENAG,
    MY: METHOD_IDS.JAKIM,
    // Brunei intentionally excluded — sources disagree on its actual official
    // method (Karachi vs. Egyptian-style angles both cited), so there's
    // nothing verifiable enough to map with confidence yet.

    // Singapore — MUIS (Majlis Ugama Islam Singapura) is the legally
    // recognized authority, despite Islam being a minority religion there.
    SG: METHOD_IDS.SINGAPORE,

    // Portugal — Comunidade Islamica de Lisboa, despite being a minority
    // religion there too.
    PT: METHOD_IDS.PORTUGAL,
};

const PREF_COUNTRY_KEY = 'detected_country_code_v1';
const PREF_AUTO_PICK_DONE = 'prayer_method_auto_pick_done_v1';

/** Recommended method id for the given ISO country code. Falls back to MWL. */
export function methodForCountry(countryCode: string | null | undefined): number {
    if (!countryCode) return METHOD_IDS.MWL;
    return COUNTRY_TO_METHOD[countryCode.toUpperCase()] ?? METHOD_IDS.MWL;
}

/** Last detected ISO country code, persisted across launches. */
export async function getDetectedCountry(): Promise<string | null> {
    try { return await AsyncStorage.getItem(PREF_COUNTRY_KEY); } catch { return null; }
}

async function setDetectedCountry(code: string): Promise<void> {
    try { await AsyncStorage.setItem(PREF_COUNTRY_KEY, code); } catch { /* ignore */ }
}

/**
 * Detect the user's country from GPS + reverse-geocode and persist it.
 * Returns the ISO country code, or null if permission denied / lookup fails.
 */
export async function detectCountryFromGps(): Promise<string | null> {
    try {
        const { status } = await Location.getForegroundPermissionsAsync();
        if (status !== 'granted') return null;
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Lowest });
        const results = await Location.reverseGeocodeAsync({
            latitude: loc.coords.latitude, longitude: loc.coords.longitude,
        });
        const code = (results?.[0]?.isoCountryCode ?? null);
        if (code) await setDetectedCountry(code);
        return code;
    } catch {
        return null;
    }
}

/**
 * Device locale's region code (e.g. the "FR" in "fr-FR") — no permission
 * needed, always available synchronously from the OS. Used as the fallback
 * signal for the very first auto-pick, which fires a fixed 2.5s after app
 * launch (see App.tsx) — location permission is instead requested mid-onboarding,
 * whenever the user taps through to that slide, so GPS is very often still
 * ungranted at that point. Without this fallback, that race always resolved
 * to "no country detected" → silently defaulted to MWL for most new users.
 */
function getDeviceRegionCode(): string | null {
    try {
        return Localization.getLocales()[0]?.regionCode ?? null;
    } catch {
        return null;
    }
}

/**
 * One-time auto-pick of the prayer calculation method on the user's first
 * launch (or any subsequent launch where they haven't picked one yet).
 * No-op once the user has explicitly chosen a method.
 */
export async function autoPickMethodIfNeeded(): Promise<{ picked: number | null; country: string | null }> {
    try {
        const [stored, autoDone] = await Promise.all([
            AsyncStorage.getItem('prayer_calculation_method'),
            AsyncStorage.getItem(PREF_AUTO_PICK_DONE),
        ]);

        if (stored) {
            // Method already in storage — fire the event so NightCalculator
            // (which may have loaded before storage was read) gets the right value.
            const method = parseInt(stored, 10);
            if (!isNaN(method)) DeviceEventEmitter.emit('prayerMethodChanged', method);
            const country = await getDetectedCountry();
            return { picked: null, country };
        }

        if (autoDone) {
            const country = await getDetectedCountry();
            return { picked: null, country };
        }

        // First launch — detect country and auto-pick the right method.
        // GPS is the more accurate signal (real current location, not just
        // device locale) but only works if permission was already granted in
        // an earlier session; the device region is an immediate fallback so
        // this doesn't lose the race against onboarding's own location
        // prompt, which the user hasn't necessarily reached yet.
        const gpsCountry = await detectCountryFromGps();
        const country = gpsCountry ?? getDeviceRegionCode();
        const method = methodForCountry(country);

        if (country) {
            // Real signal found — persist it so this doesn't run again, and
            // cache the country for the Settings "Recommended for X" badge.
            await setDetectedCountry(country);
            await AsyncStorage.setItem('prayer_calculation_method', String(method));
            await AsyncStorage.setItem(PREF_AUTO_PICK_DONE, '1');
        }
        // If both GPS and locale genuinely came back empty (very rare),
        // deliberately skip BOTH writes above — persisting the MWL fallback
        // would make the next launch's `stored` check pass and short-circuit
        // before ever retrying detection, silently freezing on a blind guess
        // exactly like the bug this fallback exists to prevent. Leaving
        // storage untouched means next app open tries again from scratch.

        // Tell NightCalculator to switch to the correct method immediately —
        // even when not persisted, this gives the current session the right
        // (or best-guess) prayer times rather than NightCalculator's own
        // hardcoded ISNA default.
        DeviceEventEmitter.emit('prayerMethodChanged', method);
        return { picked: country ? method : null, country };
    } catch {
        return { picked: null, country: null };
    }
}
