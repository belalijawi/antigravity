/** Formats a duration in seconds as "M:SS" (e.g. 125 -> "2:05"). */
export function formatMinSec(seconds: number): string {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
}

/**
 * Converts a 24-hour "HH:MM" (or "H:MM") time string to 12-hour "H:MM am/pm".
 * Returns "--:--" for missing/malformed input (the AI timetable extraction
 * can return days with some prayers absent).
 */
export function format12Hour(time: string | undefined): string {
    if (!time || !/^\d{1,2}:\d{2}$/.test(time)) return '--:--';
    const [h, m] = time.split(':').map(Number);
    const ampm = h >= 12 ? 'pm' : 'am';
    const hour = h % 12 || 12;
    return `${hour}:${m.toString().padStart(2, '0')} ${ampm}`;
}
