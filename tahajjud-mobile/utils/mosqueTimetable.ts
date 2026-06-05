/**
 * Mosque timetable — photo import via Claude vision.
 *
 * Flow:
 *   1. User picks a photo of their mosque's monthly timetable
 *   2. We send it to Claude claude-3-5-sonnet with a structured extraction prompt
 *   3. Claude returns JSON with all dates + prayer times for the month
 *   4. We store that locally and use it instead of calculated times each day
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { localDateStr } from './localDate';

const STORAGE_KEY = 'mosque-timetable-v1';
const ANTHROPIC_KEY = process.env.EXPO_PUBLIC_ANTHROPIC_KEY ?? '';

export interface MosqueDayTimes {
    fajr: string;    // "HH:MM" 24-hour
    dhuhr: string;
    asr: string;
    maghrib: string;
    isha: string;
}

export interface MosqueTimetable {
    importedAt: string;          // ISO timestamp of when the photo was imported
    month: string;               // "YYYY-MM" — primary month of the timetable
    mosqueName: string | null;   // extracted from image if visible
    times: Record<string, MosqueDayTimes>; // "YYYY-MM-DD" → prayer times
}

// ── Storage ──────────────────────────────────────────────────────────────────

export async function getMosqueTimetable(): Promise<MosqueTimetable | null> {
    try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        return raw ? JSON.parse(raw) : null;
    } catch { return null; }
}

export async function saveMosqueTimetable(t: MosqueTimetable): Promise<void> {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(t));
}

export async function clearMosqueTimetable(): Promise<void> {
    await AsyncStorage.removeItem(STORAGE_KEY);
}

/** Today's mosque times, or null if not available for today. */
export async function getTodayMosqueTimes(): Promise<MosqueDayTimes | null> {
    const timetable = await getMosqueTimetable();
    if (!timetable) return null;
    const today = localDateStr(new Date());
    return timetable.times[today] ?? null;
}

/** Mosque times for a specific YYYY-MM-DD date, or null if not in the timetable. */
export async function getMosqueTimesForDate(dateStr: string): Promise<MosqueDayTimes | null> {
    const timetable = await getMosqueTimetable();
    if (!timetable) return null;
    return timetable.times[dateStr] ?? null;
}

// ── AI extraction ─────────────────────────────────────────────────────────────

function buildPrompt(): string {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;
    const currentMonthName = now.toLocaleString('en-GB', { month: 'long' });
    // If we're in the last week of the month, the timetable might be for next month
    const nextMonth = currentMonth === 12 ? 1 : currentMonth + 1;
    const nextYear = currentMonth === 12 ? currentYear + 1 : currentYear;
    const nextMonthName = new Date(nextYear, nextMonth - 1).toLocaleString('en-GB', { month: 'long' });

    return `You are extracting prayer times from a mosque monthly prayer timetable image.

CONTEXT: Today is ${now.getDate()} ${currentMonthName} ${currentYear}. The timetable is most likely for ${currentMonthName} ${currentYear} or ${nextMonthName} ${nextYear}. Use the month header visible in the image to determine which month it is.

COLUMN NAMES: Look for these prayer columns (any of these names count):
- Fajr / Subh / Fajr Begins / Fajr Start / Sehri
- Dhuhr / Zuhr / Zawal / Dhuhr Begins
- Asr / Asr Begins / Asr Start
- Maghrib / Iftar / Sunset / Maghrib Begins
- Isha / Isha Begins / Isha Start / Esha

DATE FORMAT: The timetable likely shows just the day number (1, 2, 3... 31). Use the month and year from the timetable header to construct full dates as YYYY-MM-DD.

Return ONLY valid JSON — no other text, no markdown, no explanation:
{
  "month": "YYYY-MM",
  "mosqueName": "mosque name if clearly visible, otherwise null",
  "times": {
    "YYYY-MM-DD": {"fajr": "HH:MM", "dhuhr": "HH:MM", "asr": "HH:MM", "maghrib": "HH:MM", "isha": "HH:MM"},
    "YYYY-MM-DD": {"fajr": "HH:MM", "dhuhr": "HH:MM", "asr": "HH:MM", "maghrib": "HH:MM", "isha": "HH:MM"}
  }
}

STRICT RULES:
- Convert ALL times to 24-hour HH:MM format (e.g. 3:45am → 03:45, 1:17pm → 13:17, 9:09pm → 21:09)
- Fajr must be between 01:00–07:00. Dhuhr between 11:00–15:00. Asr between 13:00–19:00. Maghrib between 16:00–22:00. Isha between 18:00–24:00
- If any time falls outside these ranges, re-check your 12/24-hour conversion
- Include every single day visible in the image — do not skip any rows
- If the timetable shows Jumu'ah or Friday prayer separately, ignore it — use the regular Dhuhr time
- If a day's times are completely unreadable, omit that day
- If this image is not a prayer timetable, return: {"error": "not_a_timetable"}
- If the image is too blurry to extract reliably, return: {"error": "image_unclear"}`;
}

export type ExtractionResult =
    | { ok: true; timetable: MosqueTimetable }
    | { ok: false; error: 'no_key' | 'not_a_timetable' | 'image_unclear' | 'network' | 'parse_error' };

export async function extractTimetableFromImage(
    base64Image: string,
    mediaType: 'image/jpeg' | 'image/png' | 'image/webp' = 'image/jpeg',
): Promise<ExtractionResult> {
    if (!ANTHROPIC_KEY) return { ok: false, error: 'no_key' };

    let responseText = '';
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 45000); // 45s timeout
    try {

        const response = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            signal: controller.signal,
            headers: {
                'x-api-key': ANTHROPIC_KEY,
                'anthropic-version': '2023-06-01',
                'content-type': 'application/json',
            },
            body: JSON.stringify({
                model: 'claude-opus-4-5',
                max_tokens: 4096,
                messages: [{
                    role: 'user',
                    content: [
                        {
                            type: 'image',
                            source: { type: 'base64', media_type: mediaType, data: base64Image },
                        },
                        { type: 'text', text: buildPrompt() },
                    ],
                }],
            }),
        });

        clearTimeout(timeout); // clear on success path
        if (!response.ok) {
            return { ok: false, error: 'network' };
        }

        const body = await response.json();
        responseText = body?.content?.[0]?.text ?? '';
    } catch {
        clearTimeout(timeout); // ensure timer is cleared on any error path
        return { ok: false, error: 'network' };
    }

    // Parse the JSON from Claude's response
    try {
        // Strip markdown code fences if present
        const cleaned = responseText.replace(/```json?\n?/gi, '').replace(/```/g, '').trim();
        const parsed = JSON.parse(cleaned);

        if (parsed.error === 'not_a_timetable') return { ok: false, error: 'not_a_timetable' };
        if (parsed.error === 'image_unclear')   return { ok: false, error: 'image_unclear' };

        if (!parsed.times || typeof parsed.times !== 'object') {
            return { ok: false, error: 'parse_error' };
        }

        // Validate and clean up times
        const cleanTimes: Record<string, MosqueDayTimes> = {};
        for (const [date, times] of Object.entries(parsed.times as Record<string, any>)) {
            if (!isValidDateKey(date)) continue;
            const cleaned = cleanDayTimes(times);
            if (cleaned) cleanTimes[date] = cleaned;
        }

        if (Object.keys(cleanTimes).length === 0) return { ok: false, error: 'parse_error' };

        const timetable: MosqueTimetable = {
            importedAt: new Date().toISOString(),
            month: parsed.month ?? Object.keys(cleanTimes)[0].slice(0, 7),
            mosqueName: parsed.mosqueName ?? null,
            times: cleanTimes,
        };

        return { ok: true, timetable };
    } catch {
        return { ok: false, error: 'parse_error' };
    }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function isValidDateKey(date: string): boolean {
    return /^\d{4}-\d{2}-\d{2}$/.test(date);
}

function isValidTime(t: unknown): t is string {
    return typeof t === 'string' && /^\d{2}:\d{2}$/.test(t);
}

function timeToMinutes(t: string): number {
    const [h, m] = t.split(':').map(Number);
    return h * 60 + m;
}

function cleanDayTimes(raw: any): MosqueDayTimes | null {
    if (!raw || typeof raw !== 'object') return null;
    const { fajr, dhuhr, asr, maghrib, isha } = raw;
    if (!isValidTime(fajr) || !isValidTime(dhuhr) || !isValidTime(asr) ||
        !isValidTime(maghrib) || !isValidTime(isha)) return null;

    // Sanity check: times must be in logical order and sensible ranges
    const fM = timeToMinutes(fajr);
    const dM = timeToMinutes(dhuhr);
    const aM = timeToMinutes(asr);
    const mgM = timeToMinutes(maghrib);
    const iM = timeToMinutes(isha);

    // Fajr: 01:00–07:00, Dhuhr: 11:00–15:00, Asr: 13:00–19:00
    // Maghrib: 16:00–22:00, Isha: 18:00–01:30 next day (allow past midnight)
    const ishaAllowed = iM >= 18 * 60 || iM <= 90; // after 18:00 or before 01:30
    if (fM < 60 || fM > 7 * 60) return null;
    if (dM < 11 * 60 || dM > 15 * 60) return null;
    if (aM < 13 * 60 || aM > 19 * 60) return null;
    if (mgM < 16 * 60 || mgM > 22 * 60) return null;
    if (!ishaAllowed) return null;

    // Order check: fajr < dhuhr < asr < maghrib
    if (!(fM < dM && dM < aM && aM < mgM)) return null;

    return { fajr, dhuhr, asr, maghrib, isha };
}

/**
 * Convert a "HH:MM" mosque time string to a Date object.
 * Pass `forDate` to set the correct calendar day — critical for adjacent-day
 * lookups (yesterday's Maghrib, tomorrow's Fajr) so nightStart/nightEnd are
 * on the right date and the Tahajjud window is calculated correctly.
 */
export function mosqueTimeToDate(timeStr: string, forDate?: Date): Date {
    const [h, m] = timeStr.split(':').map(Number);
    const d = forDate ? new Date(forDate) : new Date();
    d.setHours(h, m, 0, 0);
    return d;
}
