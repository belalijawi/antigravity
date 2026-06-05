import { PrayerTimes } from "./prayer-times";
import AsyncStorage from '@react-native-async-storage/async-storage';

const ALADHAN_API_URL = "https://api.aladhan.com/v1";
// v3 cache key — includes the calculation method so changing method in
// Settings properly invalidates cached times instead of serving stale ones.
const PRAYER_CACHE_PREFIX = 'prayer_times_v3_';

/**
 * Returns true if the location is at a latitude where Fajr/Isha can't be
 * reliably calculated by sun-angle (sun never dips far enough below the
 * horizon during summer / never rises enough during winter). For these
 * latitudes we ask aladhan to apply the Angle-Based method, which gives
 * sensible fallback times instead of null.
 */
function isHighLatitude(lat: number, date: Date): boolean {
    const abs = Math.abs(lat);
    if (abs >= 48.5) return true;
    // Lower threshold during the long summer days when civil twilight stays
    // up all night — e.g. Stockholm (59°N) is fine in winter but needs the
    // rule in June.
    const month = date.getMonth() + 1;
    const isNorthernSummer = month >= 5 && month <= 8;
    const isSouthernSummer = month <= 2 || month === 11 || month === 12;
    if (abs >= 45 && lat > 0 && isNorthernSummer) return true;
    if (abs >= 45 && lat < 0 && isSouthernSummer) return true;
    return false;
}

// Ireland bounding box
const IRELAND_BOUNDS = { latMin: 51.4, latMax: 55.4, lonMin: -10.5, lonMax: -5.5 };

// UK bounding box (England, Scotland, Wales — excludes Ireland)
const UK_BOUNDS = { latMin: 49.8, latMax: 60.9, lonMin: -8.6, lonMax: 1.8 };

function isInIreland(latitude: number, longitude: number): boolean {
    return (
        latitude >= IRELAND_BOUNDS.latMin && latitude <= IRELAND_BOUNDS.latMax &&
        longitude >= IRELAND_BOUNDS.lonMin && longitude <= IRELAND_BOUNDS.lonMax
    );
}

function isInUK(latitude: number, longitude: number): boolean {
    return (
        latitude >= UK_BOUNDS.latMin && latitude <= UK_BOUNDS.latMax &&
        longitude >= UK_BOUNDS.lonMin && longitude <= UK_BOUNDS.lonMax
    );
}

function buildCacheKey(latitude: number, longitude: number, dateStr: string, method: number): string {
    return `${PRAYER_CACHE_PREFIX}${latitude.toFixed(2)}_${longitude.toFixed(2)}_${dateStr}_m${method}`;
}

async function loadFromCache(key: string): Promise<PrayerTimes | null> {
    try {
        const raw = await AsyncStorage.getItem(key);
        if (!raw) return null;
        const p = JSON.parse(raw);
        return {
            fajr: new Date(p.fajr),
            sunrise: new Date(p.sunrise),
            dhuhr: new Date(p.dhuhr),
            asr: new Date(p.asr),
            maghrib: new Date(p.maghrib),
            isha: new Date(p.isha),
        };
    } catch {
        return null;
    }
}

async function saveToCache(key: string, times: PrayerTimes): Promise<void> {
    try {
        await AsyncStorage.setItem(key, JSON.stringify(times));
    } catch {}
}

/**
 * fetch() with a hard timeout. React Native's fetch has no default timeout,
 * so a slow or dead network can leave the loading state hanging indefinitely.
 * On mobile users typically give up after ~5s — 12s timeout gives the server
 * a fair chance while preventing an infinite spinner.
 */
async function fetchWithTimeout(url: string, ms = 12000): Promise<Response> {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), ms);
    try {
        return await fetch(url, { signal: controller.signal });
    } finally {
        clearTimeout(id);
    }
}

/**
 * Find any cached prayer times for this location, regardless of date.
 * Used as offline fallback when both today's cache + the network fail —
 * better to show yesterday's times (which are 99% accurate) than nothing.
 */
async function loadAnyCacheForLocation(latitude: number, longitude: number, method: number): Promise<PrayerTimes | null> {
    try {
        const keys = await AsyncStorage.getAllKeys();
        const prefix = `${PRAYER_CACHE_PREFIX}${latitude.toFixed(2)}_${longitude.toFixed(2)}_`;
        const match = keys.find(k => k.startsWith(prefix) && k.endsWith(`_m${method}`));
        if (!match) return null;
        return await loadFromCache(match);
    } catch {
        return null;
    }
}

export async function getPrayerTimes(latitude: number, longitude: number, date?: Date, method: number = 2): Promise<PrayerTimes> {
    const d = date || new Date();
    // API uses DD-MM-YYYY format
    const dateStr = `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`;

    // Return cached result if available — prayer times for a given date never change.
    // Cache key now includes the calc method so changing methods invalidates correctly.
    const cacheKey = buildCacheKey(latitude, longitude, dateStr, method);
    const cached = await loadFromCache(cacheKey);
    if (cached) return cached;

    let finalMethod = method;
    let customParams = '';

    // Location-based calibration overrides — ONLY apply when the user is still
    // on the default MWL method (id 3). If they've explicitly picked something
    // else (ISNA, Karachi, Moonsighting, Umm al-Qura, etc.), respect their
    // choice and don't silently swap to a UK/IE-tuned method.
    const userIsOnDefault = method === 3;

    if (userIsOnDefault && isInIreland(latitude, longitude)) {
        // Ireland: custom method matching MCND/ICCI
        // Fajr 20°, Isha 14° — calibrated against MCND Coolmine March 2026
        // Tune format: Imsak,Fajr,Sunrise,Dhuhr,Asr,Maghrib,Sunset,Isha,Midnight
        finalMethod = 99;
        customParams = '&methodSettings=20,null,14';
        customParams += '&tune=0,38,0,3,1,4,0,3,0';
    } else if (userIsOnDefault && isInUK(latitude, longitude)) {
        // UK: MWL method calibrated to match East London Mosque (LUPT)
        // Verified against ELM timetable March 2026
        // Tune format: Imsak,Fajr,Sunrise,Dhuhr,Asr,Maghrib,Sunset,Isha,Midnight
        finalMethod = 3;
        customParams = '&tune=0,17,0,6,1,1,0,-28,0';
    }

    // High-latitude rule: above ~48° (and during summer above ~45°) the sun
    // doesn't dip below the horizon enough for normal Fajr/Isha calculation.
    // latitudeAdjustmentMethod=3 = Angle-Based (one-seventh of the night) —
    // the safest fallback used by Quran apps and most scholars in the region.
    //
    // Skip this for the Moonsighting Committee method (id 15) — MCW handles
    // high-latitude twilight natively, so applying an extra adjustment on
    // top of it would distort the times.
    if (isHighLatitude(latitude, d) && finalMethod !== 15) {
        customParams += '&latitudeAdjustmentMethod=3';
    }

    // Method parameter allows customizing Fajr/Isha calculation angles
    const url = `${ALADHAN_API_URL}/timings/${dateStr}?latitude=${latitude}&longitude=${longitude}&method=${finalMethod}${customParams}`;

    try {
        const response = await fetchWithTimeout(url, 12000);
        if (!response.ok) {
            throw new Error("Failed to fetch prayer times");
        }
        const data = await response.json();
        const timings = data?.data?.timings;
        if (!timings) throw new Error(`Unexpected API response: ${JSON.stringify(data).slice(0, 120)}`);

        // Helper to parse "HH:MM" to Date object for the given date
        const parseTime = (timeStr: string) => {
            const [hours, minutes] = timeStr.split(':').map(Number);
            const timeDate = new Date(d);
            timeDate.setHours(hours, minutes, 0, 0);
            return timeDate;
        };

        const result: PrayerTimes = {
            fajr: parseTime(timings.Fajr),
            sunrise: parseTime(timings.Sunrise),
            dhuhr: parseTime(timings.Dhuhr),
            asr: parseTime(timings.Asr),
            maghrib: parseTime(timings.Maghrib),
            isha: parseTime(timings.Isha)
        };

        // High-latitude fix: at places like Reykjavik in summer, the API can
        // return Isha as "00:12" — i.e. just past midnight. parseTime() will
        // attach that to today's 00:12 (which is actually BEFORE Fajr). When
        // we detect Isha < Maghrib in the same parsed date, push Isha (and
        // anything else out of order) to the next day so comparisons work.
        const ONE_DAY = 24 * 60 * 60 * 1000;
        if (result.isha.getTime() <= result.maghrib.getTime()) {
            result.isha = new Date(result.isha.getTime() + ONE_DAY);
        }

        // Persist to cache so future loads are instant and work offline
        await saveToCache(cacheKey, result);
        return result;
    } catch (error) {
        console.error("Error fetching prayer times:", error);

        // Offline fallback: if we have ANY cached prayer times for this location,
        // serve them rather than failing. Yesterday's times for the same lat/lng
        // are essentially identical (sun moves <1 minute/day) so this keeps the
        // app functional during network outages.
        const stale = await loadAnyCacheForLocation(latitude, longitude, method);
        if (stale) {
            console.log('[api] Network failed — falling back to stale cached prayer times');
            return stale;
        }

        throw error;
    }
}

