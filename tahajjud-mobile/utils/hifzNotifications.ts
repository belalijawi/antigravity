import * as Notifications from 'expo-notifications';
import { HifzAyah } from './hifzStorage';
import { requestNotificationPermissions } from './notifications';

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
            const key = due.toISOString().slice(0, 10);
            byDate[key] = (byDate[key] ?? 0) + 1;
        }
    });

    for (const [dateStr, count] of Object.entries(byDate)) {
        // Fire at 9 AM on the due date
        const trigger = new Date(`${dateStr}T09:00:00`);
        if (trigger <= now) continue;

        await Notifications.scheduleNotificationAsync({
            content: {
                title: '📿 Hifz review due',
                body: `${count} ayah${count !== 1 ? 's' : ''} ready for review`,
                data: { type: HIFZ_NOTIF_TAG },
                sound: true,
            },
            trigger,
        });
    }
}

// Call on app start to request permission upfront (no-op if already granted/denied)
export async function requestHifzNotificationPermission(): Promise<boolean> {
    return requestNotificationPermissions();
}
