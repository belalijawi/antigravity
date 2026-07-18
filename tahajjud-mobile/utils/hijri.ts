/**
 * Hijri (Islamic) calendar helpers — used to auto-detect Eid days, white
 * nights, Ramadan, etc. Uses the native `Intl.DateTimeFormat` with the
 * Umm al-Qura calendar (the official Saudi calendar), which most apps
 * and Islamic governments follow.
 *
 * Note: Actual moonsighting in different regions can shift dates by ±1 day,
 * so when checking for Eid we accept "today or yesterday" to catch both
 * cases without false positives later in the month.
 */

export interface HijriDate {
    day: number;
    month: number;   // 1..12
    year: number;
    monthName: string;
}

const MONTH_NAMES = [
    'Muharram', 'Safar', "Rabi' al-Awwal", "Rabi' al-Thani",
    "Jumada al-Awwal", "Jumada al-Thani", 'Rajab', "Sha'ban",
    'Ramadan', 'Shawwal', "Dhu al-Qi'dah", 'Dhu al-Hijjah',
];

/** Convert a Gregorian Date to Hijri using Umm al-Qura calendar. */
export function toHijri(date: Date = new Date()): HijriDate {
    try {
        const parts = new Intl.DateTimeFormat('en-u-ca-islamic-umalqura', {
            day: 'numeric',
            month: 'numeric',
            year: 'numeric',
        }).formatToParts(date);

        const day = parseInt(parts.find(p => p.type === 'day')?.value ?? '1', 10);
        const month = parseInt(parts.find(p => p.type === 'month')?.value ?? '1', 10);
        const year = parseInt(parts.find(p => p.type === 'year')?.value ?? '1446', 10);

        return {
            day,
            month,
            year,
            monthName: MONTH_NAMES[month - 1] ?? '',
        };
    } catch {
        // Fallback: rough approximation if Intl fails on a device
        return { day: 1, month: 1, year: 1446, monthName: 'Muharram' };
    }
}

export type EidKind = 'fitr' | 'adha';

export interface EidInfo {
    kind: EidKind;
    /** Day of Eid (1 for Eid al-Fitr, 1..3 for the days of Eid al-Adha). */
    day: number;
    label: string;
}

/**
 * Returns Eid info if today (or yesterday — moonsighting tolerance) is an
 * Eid day. Eid al-Fitr is 1st of Shawwal; Eid al-Adha is 10th-12th of
 * Dhu al-Hijjah.
 */
export function getEidToday(date: Date = new Date()): EidInfo | null {
    const today = toHijri(date);
    const yesterday = toHijri(new Date(date.getTime() - 24 * 60 * 60 * 1000));

    for (const h of [today, yesterday]) {
        // Eid al-Fitr — 1st of Shawwal (month 10)
        if (h.month === 10 && h.day === 1) {
            return { kind: 'fitr', day: 1, label: 'Eid al-Fitr' };
        }
        // Eid al-Adha — 10th-12th of Dhu al-Hijjah (month 12)
        if (h.month === 12 && h.day >= 10 && h.day <= 12) {
            return { kind: 'adha', day: h.day - 9, label: 'Eid al-Adha' };
        }
    }
    return null;
}

