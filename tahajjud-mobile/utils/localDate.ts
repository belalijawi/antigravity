/**
 * Returns YYYY-MM-DD in the device's **local** timezone.
 *
 * Using toISOString() would return a UTC date, which causes evening prayers
 * logged in negative-UTC-offset timezones (Americas) to be attributed to the
 * next calendar day, making them appear as "missed" in history.
 */
export function localDateStr(d: Date | string): string {
    const date = typeof d === 'string' ? new Date(d) : d;
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}
