import { PrayerTimes } from "./prayer-times";

const ALADHAN_API_URL = "https://api.aladhan.com/v1";

export async function getPrayerTimes(latitude: number, longitude: number, date?: Date): Promise<PrayerTimes> {
    const d = date || new Date();
    // API uses DD-MM-YYYY format
    const dateStr = `${d.getDate()}-${d.getMonth() + 1}-${d.getFullYear()}`;

    // Method 2 is ISNA, but user might want customization. Using generic method or specific calculation.
    // For Tahajjud, accurate Fajr and Maghrib are key. Method 2 (ISNA) or 3 (MWL) are common.
    // Method 8 is Gulf? 
    // Let's stick to a default (e.g., 2 - ISNA) for now, or make it configurable.
    const method = 2;

    const url = `${ALADHAN_API_URL}/timings/${dateStr}?latitude=${latitude}&longitude=${longitude}&method=${method}`;

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
