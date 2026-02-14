import { PrayerTimes } from "./prayer-times";

const ALADHAN_API_URL = "https://api.aladhan.com/v1";

// Ireland bounding box: roughly 51.4°N to 55.4°N, -10.5°W to -5.5°W
const IRELAND_BOUNDS = {
    latMin: 51.4,
    latMax: 55.4,
    lonMin: -10.5,
    lonMax: -5.5,
};

/**
 * Check if coordinates are within Ireland
 */
function isInIreland(latitude: number, longitude: number): boolean {
    return (
        latitude >= IRELAND_BOUNDS.latMin &&
        latitude <= IRELAND_BOUNDS.latMax &&
        longitude >= IRELAND_BOUNDS.lonMin &&
        longitude <= IRELAND_BOUNDS.lonMax
    );
}

export async function getPrayerTimes(latitude: number, longitude: number, date?: Date, method: number = 2): Promise<PrayerTimes> {
    const d = date || new Date();
    // API uses DD-MM-YYYY format
    const dateStr = `${d.getDate()}-${d.getMonth() + 1}-${d.getFullYear()}`;

    // Auto-detect Ireland and use custom method (matches MCND/ICCI)
    let finalMethod = method;
    let customParams = '';

    if (isInIreland(latitude, longitude)) {
        // Use custom method 99 with Ireland-specific angles
        // Fajr: 20° (more conservative than MWL 18°)
        // Isha: 14° (less conservative than MWL 17°)
        finalMethod = 99;
        customParams = '&methodSettings=20,null,14';

        // Fine-tune with minute offsets to match MCND exactly
        // Format: Imsak,Fajr,Sunrise,Dhuhr,Asr,Maghrib,Sunset,Isha,Midnight
        // Based on Feb 12, 2026 comparison with MCND times
        customParams += '&tune=0,28,0,1,1,-1,0,6,0';
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

        return {
            fajr: parseTime(timings.Fajr),
            sunrise: parseTime(timings.Sunrise),
            dhuhr: parseTime(timings.Dhuhr),
            asr: parseTime(timings.Asr),
            maghrib: parseTime(timings.Maghrib),
            isha: parseTime(timings.Isha)
        };
    } catch (error) {
        console.error("Error fetching prayer times:", error);
        throw error;
    }
}

