import { NativeModules, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { localDateStr } from './localDate';

const { WidgetDataBridge } = NativeModules;

// Accept either Date objects (from lib/prayer-times) or "HH:mm" strings.
// Internally we always normalize to "HH:mm" before parsing.
type TimeValue = string | Date | undefined;
interface PrayerTimes {
    fajr?: TimeValue;
    sunrise?: TimeValue;
    dhuhr?: TimeValue;
    asr?: TimeValue;
    maghrib?: TimeValue;
    isha?: TimeValue;
}

/** Coerce either format to "HH:mm". */
function normalizeTime(v: TimeValue): string | null {
    if (!v) return null;
    if (typeof v === 'string') return v;
    // Date object
    const h = String(v.getHours()).padStart(2, '0');
    const m = String(v.getMinutes()).padStart(2, '0');
    return `${h}:${m}`;
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
        const norm = normalizeTime((times as any)[prayer]);
        if (!norm) continue;
        const prayerDate = parseToTodayDate(norm);
        if (prayerDate > now) {
            return { name: prayer.charAt(0).toUpperCase() + prayer.slice(1), date: prayerDate };
        }
    }
    // All passed — next is Fajr tomorrow
    const fajrNorm = normalizeTime(times.fajr);
    if (!fajrNorm) return null;
    const tomorrow = parseToTodayDate(fajrNorm);
    tomorrow.setDate(tomorrow.getDate() + 1);
    return { name: 'Fajr', date: tomorrow };
}

/** Key holding the id of the dua currently pinned to the Dua widget. */
export const WIDGET_DUA_ID_KEY = 'widget_dua_id';

/**
 * Pins a dua to the home-screen Dua widget (iOS only). Returns false when
 * the native method isn't available (Android, or a binary older than the
 * widget) so callers can hide/no-op the affordance.
 */
export function setWidgetDua(dua: { title: string; arabic?: string; translation?: string }): boolean {
    if (Platform.OS !== 'ios' || !WidgetDataBridge?.writeDuaWidgetData) return false;
    try {
        WidgetDataBridge.writeDuaWidgetData(dua.title, dua.arabic ?? '', dua.translation ?? '');
        return true;
    } catch {
        return false;
    }
}

/**
 * Call this after prayer times load and after the streak updates.
 * Writes data to the shared App Group for the home screen widget.
 * @param tahajjudStart  Optional Date of tonight's last-third start (from NightCalculation)
 */
export async function updateWidget(prayerTimes: PrayerTimes, tahajjudStart?: Date): Promise<void> {
    if (Platform.OS !== 'ios' || !WidgetDataBridge) return;

    const next = findNextPrayer(prayerTimes);
    if (!next) return;

    let streak = 0;
    try {
        const raw = await AsyncStorage.getItem('prayer-tracker-v2');
        if (raw) {
            const history = JSON.parse(raw) as Record<string, string[]>;
            const tahajjud: string[] = history.tahajjud ?? [];
            const today = localDateStr(new Date());
            const hasDay = (dateStr: string) => tahajjud.some(d => localDateStr(d) === dateStr);
            const hasToday = hasDay(today);
            const yday = new Date();
            yday.setDate(yday.getDate() - 1);
            const hasYesterday = hasDay(localDateStr(yday));
            if (hasToday || hasYesterday) {
                let check = hasToday ? new Date() : yday;
                while (hasDay(localDateStr(check))) {
                    streak++;
                    check.setDate(check.getDate() - 1);
                }
            }
        }
    } catch (_) {}

    try {
        WidgetDataBridge.writeWidgetData(
            next.name,
            next.date.getTime() / 1000,          // Unix seconds
            streak,
            tahajjudStart ? tahajjudStart.getTime() / 1000 : 0,  // 0 = not available
        );
    } catch (e) {
        console.log('WidgetDataBridge error:', e);
    }
}
