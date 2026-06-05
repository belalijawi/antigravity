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
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DeviceEventEmitter } from 'react-native';

export const METHOD_IDS = {
    KARACHI: 1,        // South Asia (18°)
    ISNA: 2,           // North America (15°)
    MWL: 3,            // Europe, Far East, default (17°)
    UMM_AL_QURA: 4,    // Makkah, Saudi Arabia
    DIYANET: 13,       // Turkey
    MOONSIGHTING: 15,  // Moonsighting Committee Worldwide — UK, Ireland, high latitudes
} as const;

/** ISO 3166-1 alpha-2 country code → recommended method id */
const COUNTRY_TO_METHOD: Record<string, number> = {
    // North America (ISNA)
    US: METHOD_IDS.ISNA, CA: METHOD_IDS.ISNA, MX: METHOD_IDS.ISNA,

    // Arabian Peninsula (Umm al-Qura)
    SA: METHOD_IDS.UMM_AL_QURA, AE: METHOD_IDS.UMM_AL_QURA, BH: METHOD_IDS.UMM_AL_QURA,
    KW: METHOD_IDS.UMM_AL_QURA, QA: METHOD_IDS.UMM_AL_QURA, OM: METHOD_IDS.UMM_AL_QURA,
    YE: METHOD_IDS.UMM_AL_QURA,

    // South Asia (Karachi)
    PK: METHOD_IDS.KARACHI, IN: METHOD_IDS.KARACHI, BD: METHOD_IDS.KARACHI,
    AF: METHOD_IDS.KARACHI, LK: METHOD_IDS.KARACHI, NP: METHOD_IDS.KARACHI,

    // Turkey
    TR: METHOD_IDS.DIYANET,
    CY: METHOD_IDS.DIYANET,

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
        const country = await detectCountryFromGps();
        const method = methodForCountry(country);
        await AsyncStorage.setItem('prayer_calculation_method', String(method));
        await AsyncStorage.setItem(PREF_AUTO_PICK_DONE, '1');
        // Tell NightCalculator to switch to the correct method immediately.
        DeviceEventEmitter.emit('prayerMethodChanged', method);
        return { picked: method, country };
    } catch {
        return { picked: null, country: null };
    }
}
