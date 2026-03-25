import { NativeModules, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { WidgetDataBridge } = NativeModules;

interface PrayerTimes {
    fajr?: string;
    dhuhr?: string;
    asr?: string;
    maghrib?: string;
    isha?: string;
    [key: string]: string | undefined;
}

const PRAYER_ORDER = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'];

/** Parses a "HH:mm" prayer time string into today's Date */
function parseToTodayDate(timeStr: string): Date {
    const [h, m] = timeStr.split(':').map(Number);
    const d = new Date();
    d.setHours(h, m, 0, 0);
    return d;
}

/**
 * Finds the next upcoming prayer from today's times.
 * If all have passed, returns Fajr of tomorrow.
 */
function findNextPrayer(times: PrayerTimes): { name: string; date: Date } | null {
    const now = new Date();
    for (const prayer of PRAYER_ORDER) {
        const raw = times[prayer];
        if (!raw) continue;
        const prayerDate = parseToTodayDate(raw);
        if (prayerDate > now) {
            return { name: prayer.charAt(0).toUpperCase() + prayer.slice(1), date: prayerDate };
        }
    }
    // All passed — next is Fajr tomorrow
    const fajrRaw = times['fajr'];
    if (!fajrRaw) return null;
    const tomorrow = parseToTodayDate(fajrRaw);
    tomorrow.setDate(tomorrow.getDate() + 1);
    return { name: 'Fajr', date: tomorrow };
}

/**
 * Call this after prayer times load and after the streak updates.
 * Writes data to the shared App Group for the home screen widget.
 */
export async function updateWidget(prayerTimes: PrayerTimes): Promise<void> {
    if (Platform.OS !== 'ios' || !WidgetDataBridge) return;

    const next = findNextPrayer(prayerTimes);
    if (!next) return;

    let streak = 0;
    try {
        const raw = await AsyncStorage.getItem('tahajjud-tracker');
        if (raw) {
            const history: string[] = JSON.parse(raw);
            // Calculate streak (same logic as Tracker.tsx)
            const today = new Date().toDateString();
            let s = 0;
            let check = new Date();
            // Check if today is logged
            if (history.includes(today)) {
                s = 1;
                check.setDate(check.getDate() - 1);
                while (history.includes(check.toDateString())) {
                    s++;
                    check.setDate(check.getDate() - 1);
                }
            } else {
                // Check if yesterday is logged (streak still valid)
                check.setDate(check.getDate() - 1);
                while (history.includes(check.toDateString())) {
                    s++;
                    check.setDate(check.getDate() - 1);
                }
            }
            streak = s;
        }
    } catch (_) {}

    try {
        WidgetDataBridge.writeWidgetData(
            next.name,
            next.date.getTime() / 1000, // Unix seconds
            streak,
        );
    } catch (e) {
        console.log('WidgetDataBridge error:', e);
    }
}
