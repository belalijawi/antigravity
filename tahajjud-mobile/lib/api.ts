import { PrayerTimes } from "./prayer-times";
import AsyncStorage from '@react-native-async-storage/async-storage';

const ALADHAN_API_URL = "https://api.aladhan.com/v1";
const PRAYER_CACHE_PREFIX = 'prayer_times_v2_';

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

function buildCacheKey(latitude: number, longitude: number, dateStr: string): string {
    return `${PRAYER_CACHE_PREFIX}${latitude.toFixed(2)}_${longitude.toFixed(2)}_${dateStr}`;
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

export async function getPrayerTimes(latitude: number, longitude: number, date?: Date, method: number = 2): Promise<PrayerTimes> {
    const d = date || new Date();
    // API uses DD-MM-YYYY format
    const dateStr = `${d.getDate()}-${d.getMonth() + 1}-${d.getFullYear()}`;

    // Return cached result if available — prayer times for a given date never change
    const cacheKey = buildCacheKey(latitude, longitude, dateStr);
    const cached = await loadFromCache(cacheKey);
    if (cached) return cached;

    let finalMethod = method;
    let customParams = '';

    if (isInIreland(latitude, longitude)) {
        // Ireland: custom method matching MCND/ICCI
        // Fajr 20°, Isha 14° — calibrated against MCND Coolmine March 2026
        // Tune format: Imsak,Fajr,Sunrise,Dhuhr,Asr,Maghrib,Sunset,Isha,Midnight
        finalMethod = 99;
        customParams = '&methodSettings=20,null,14';
        customParams += '&tune=0,38,0,3,1,4,0,3,0';
    } else if (isInUK(latitude, longitude)) {
        // UK: MWL method calibrated to match East London Mosque (LUPT)
        // Verified against ELM timetable March 2026
        // Tune format: Imsak,Fajr,Sunrise,Dhuhr,Asr,Maghrib,Sunset,Isha,Midnight
        finalMethod = 3;
        customParams = '&tune=0,17,0,6,1,1,0,-28,0';
    }

    // Method parameter allows customizing Fajr/Isha calculation angles
    const url = `${ALADHAN_API_URL}/timings/${dateStr}?latitude=${latitude}&longitude=${longitude}&method=${finalMethod}${customParams}`;

    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error("Failed to fetch prayer times");
        }
        const data = await response.json();
        const timings = data.data.timings;

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

        // Persist to cache so future loads are instant and work offline
        await saveToCache(cacheKey, result);
        return result;
    } catch (error) {
        console.error("Error fetching prayer times:", error);
        throw error;
    }
}

