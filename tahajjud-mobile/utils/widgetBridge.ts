import { NativeModules } from 'react-native';
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
 * The most recent of today's 5 daily prayers whose time has started but
 * that hasn't been logged yet — the prayer the widget's "Log" button should
 * target. null when nothing is currently loggable (e.g. it's the middle of
 * the night, or everything so far today is already logged).
 */
function computeLoggablePrayer(times: PrayerTimes, history: Record<string, string[]>): string | null {
    const now = new Date();
    const today = localDateStr(now);
    let best: { prayer: string; time: Date } | null = null;
    for (const prayer of PRAYER_ORDER) {
        const norm = normalizeTime((times as any)[prayer]);
        if (!norm) continue;
        const startTime = parseToTodayDate(norm);
        if (startTime > now) continue; // hasn't started yet
        const loggedToday = (history[prayer] ?? []).some(d => localDateStr(d) === today);
        if (loggedToday) continue;
        if (!best || startTime > best.time) best = { prayer, time: startTime };
    }
    return best?.prayer ?? null;
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
 * Pins a dua to the home-screen Dua widget. Returns false when the native
 * method isn't available (a binary older than the widget) so callers can
 * hide/no-op the affordance.
 */
export function setWidgetDua(dua: { title: string; arabic?: string; translation?: string }): boolean {
    if (!WidgetDataBridge) return false;
    // Call directly instead of feature-detecting the method as a property —
    // under the new-architecture interop layer, method presence checks can
    // report undefined for methods that are in fact callable, which made
    // current builds wrongly show the "update the app" alert. A genuinely
    // old binary throws here and still lands in the catch.
    try {
        WidgetDataBridge.writeDuaWidgetData(dua.title, dua.arabic ?? '', dua.translation ?? '');
        return true;
    } catch {
        return false;
    }
}

/**
 * Reads the prayer-times cache NightCalculator writes on every fresh load
 * (see components/Tracker.tsx's loadPrayerStartTimes, which reads the same
 * key). Lets any background-safe prayer-logging path (widget tap, notification
 * action) refresh the widget immediately after logging without recomputing
 * times from location/method — and without importing a whole UI component
 * module just to reach one cache read.
 */
export async function loadCachedPrayerTimes(): Promise<{ fajr: Date; dhuhr: Date; asr: Date; maghrib: Date; isha: Date } | null> {
    try {
        const raw = await AsyncStorage.getItem('prayer_times_today_v1');
        if (!raw) return null;
        const j = JSON.parse(raw);
        if (j.date !== localDateStr(new Date())) return null; // stale — yesterday's cache
        return { fajr: new Date(j.fajr), dhuhr: new Date(j.dhuhr), asr: new Date(j.asr), maghrib: new Date(j.maghrib), isha: new Date(j.isha) };
    } catch { return null; }
}

/**
 * Call this after prayer times load and after the streak updates.
 * Writes data to the shared App Group for the home screen widget.
 * @param tahajjudStart  Optional Date of tonight's last-third start (from NightCalculation)
 */
/** Coerce either format to a Unix-seconds timestamp anchored to today. */
function toUnixSeconds(v: TimeValue): number {
    const norm = normalizeTime(v);
    if (!norm) return 0; // 0 = not available, matches tahajjudStart's convention
    return parseToTodayDate(norm).getTime() / 1000;
}

export async function updateWidget(prayerTimes: PrayerTimes, tahajjudStart?: Date): Promise<void> {
    if (!WidgetDataBridge) return;

    const next = findNextPrayer(prayerTimes);
    if (!next) return;

    let streak = 0;
    let loggablePrayer = '';
    const loggedToday: string[] = [];
    const today = localDateStr(new Date());
    try {
        const raw = await AsyncStorage.getItem('prayer-tracker-v2');
        // A brand-new user has no tracker entry yet — that must NOT skip the
        // loggable-prayer computation below, or the exact users this button
        // is meant to help (nobody's logged anything yet) would never see it.
        const history = raw ? (JSON.parse(raw) as Record<string, string[]>) : {};
        const tahajjud: string[] = history.tahajjud ?? [];
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
        loggablePrayer = computeLoggablePrayer(prayerTimes, history) ?? '';
        for (const prayer of PRAYER_ORDER) {
            if ((history[prayer] ?? []).some(d => localDateStr(d) === today)) loggedToday.push(prayer);
        }
    } catch (_) {}

    try {
        WidgetDataBridge.writeWidgetData(
            next.name,
            next.date.getTime() / 1000,          // Unix seconds
            streak,
            tahajjudStart ? tahajjudStart.getTime() / 1000 : 0,  // 0 = not available
            loggablePrayer,                      // '' = nothing currently loggable
            // Raw ingredients so the widget can recompute "next prayer" and
            // "loggable prayer" live as real time passes, instead of only at
            // push time. Without these, both went stale the moment a prayer
            // transition happened while the app stayed closed — e.g. "Log
            // Dhuhr" stuck on screen well after Asr had also started.
            JSON.stringify({
                fajr: toUnixSeconds(prayerTimes.fajr),
                dhuhr: toUnixSeconds(prayerTimes.dhuhr),
                asr: toUnixSeconds(prayerTimes.asr),
                maghrib: toUnixSeconds(prayerTimes.maghrib),
                isha: toUnixSeconds(prayerTimes.isha),
            }),
            today,
            loggedToday,
        );
    } catch (e) {
        console.log('WidgetDataBridge error:', e);
    }
}
