import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { HifzAyah } from './hifzStorage';
import { requestNotificationPermissions } from './notifications';
import { localDateStr } from './localDate';
import { t } from './i18n';

const HIFZ_NOTIF_TAG = 'hifz_review';

// Cancel all previously scheduled hifz review notifications
async function cancelHifzNotifications(): Promise<void> {
    try {
        const all = await Notifications.getAllScheduledNotificationsAsync();
        await Promise.all(
            all
                .filter(n => n.content.data?.type === HIFZ_NOTIF_TAG)
                .map(n => Notifications.cancelScheduledNotificationAsync(n.identifier))
        );
    } catch {}
}

// Schedule one notification per day (for the next 7 days) when reviews are due.
// Call this after every session so the schedule stays accurate.
export async function scheduleHifzNotifications(
    allHifz: Record<string, HifzAyah>
): Promise<void> {
    const hasPermission = await requestNotificationPermissions();
    if (!hasPermission) return;

    await cancelHifzNotifications();

    const now = new Date();
    const sevenDaysOut = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    // Group due ayahs by calendar date
    const byDate: Record<string, number> = {};
    Object.values(allHifz).forEach(a => {
        const due = new Date(a.nextReview);
        if (due > now && due <= sevenDaysOut) {
            const key = localDateStr(due);
            byDate[key] = (byDate[key] ?? 0) + 1;
        }
    });

    for (const [dateStr, count] of Object.entries(byDate)) {
        // Fire at 9 AM local time on the due date.
        // Parse year/month/day manually so Date uses local timezone,
        // not UTC (which `new Date('YYYY-MM-DDT...')` would do on some runtimes).
        const [y, m, d] = dateStr.split('-').map(Number);
        const fireDate = new Date(y, m - 1, d, 9, 0, 0, 0);
        if (fireDate <= now) continue;

        // One failed date must not stop the remaining days in this loop from
        // being scheduled (mirrors cancelHifzNotifications' own try/catch).
        try {
            await Notifications.scheduleNotificationAsync({
                content: {
                    title: t('hifzReview.title'),
                    body: t('hifz.ayahsReadyForReview', { n: count }),
                    data: { type: HIFZ_NOTIF_TAG },
                    sound: true,
                },
                trigger: {
                    type: Notifications.SchedulableTriggerInputTypes.DATE,
                    date: fireDate,
                    ...(Platform.OS === 'android' && { channelId: 'prayers' }),
                },
            });
        } catch { /* best-effort — continue scheduling the remaining days */ }
    }
}

// Call on app start to request permission upfront (no-op if already granted/denied)
export async function requestHifzNotificationPermission(): Promise<boolean> {
    return requestNotificationPermissions();
}
