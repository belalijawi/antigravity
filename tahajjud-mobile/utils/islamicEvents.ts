/**
 * Islamic Calendar Events — schedules push notifications for key dates
 * in the Islamic calendar using the Umm al-Qura Hijri conversion.
 *
 * Events covered:
 *  - White days (Ayyam al-Beed): 13th, 14th, 15th of every month
 *  - Ashura: 9th + 10th of Muharram
 *  - Isra wal-Miraj: 27th of Rajab
 *  - 15th Sha'ban (Nisf Sha'ban / Laylatul Bara'ah)
 *  - First day of Ramadan
 *  - Laylatul Qadr: odd nights 21st–29th Ramadan
 *  - Day of Arafah: 9th Dhu al-Hijjah
 *  - First day of Dhul Hijjah (start of 10 blessed days)
 *
 * Runs once per week; schedules notifications 30 days ahead so they fire
 * even if the user doesn't open the app.
 */

import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { toHijri } from './hijri';
import { t } from './i18n';

const LAST_SCHEDULED_KEY = 'islamic-events-scheduled-v1';

interface IslamicEvent {
    hijriMonth: number;
    hijriDay: number;
    /** Key prefix into i18n.ts — resolves to `islamicEvent.{key}.title`/`.body` */
    key: string;
    /** Hour (local time) to fire the notification */
    hour: number;
}

const ISLAMIC_EVENTS: IslamicEvent[] = [
    // ── White Days (every month) ──
    { hijriMonth: 0, hijriDay: 13, key: 'whiteDay13', hour: 7 },
    { hijriMonth: 0, hijriDay: 14, key: 'whiteDay14', hour: 7 },
    { hijriMonth: 0, hijriDay: 15, key: 'whiteDay15', hour: 7 },

    // ── Muharram (month 1) ──
    { hijriMonth: 1, hijriDay: 1, key: 'newYear', hour: 8 },
    { hijriMonth: 1, hijriDay: 9, key: 'ashuraEve', hour: 7 },
    { hijriMonth: 1, hijriDay: 10, key: 'ashura', hour: 6 },

    // ── Rajab (month 7) ──
    { hijriMonth: 7, hijriDay: 1, key: 'rajabBegins', hour: 7 },
    { hijriMonth: 7, hijriDay: 27, key: 'israMiraj', hour: 20 },

    // ── Sha'ban (month 8) ──
    { hijriMonth: 8, hijriDay: 14, key: 'nisfShabanEve', hour: 20 },
    { hijriMonth: 8, hijriDay: 15, key: 'nisfShaban', hour: 6 },

    // ── Ramadan (month 9) ──
    { hijriMonth: 9, hijriDay: 1, key: 'ramadanBegins', hour: 6 },
    { hijriMonth: 9, hijriDay: 21, key: 'qadr21', hour: 20 },
    { hijriMonth: 9, hijriDay: 23, key: 'qadr23', hour: 20 },
    { hijriMonth: 9, hijriDay: 25, key: 'qadr25', hour: 20 },
    { hijriMonth: 9, hijriDay: 27, key: 'qadr27', hour: 20 },
    { hijriMonth: 9, hijriDay: 29, key: 'qadr29', hour: 20 },

    // ── Dhu al-Hijjah (month 12) ──
    { hijriMonth: 12, hijriDay: 1, key: 'dhulHijjahBegins', hour: 7 },
    { hijriMonth: 12, hijriDay: 8, key: 'tarwiyah', hour: 7 },
    { hijriMonth: 12, hijriDay: 9, key: 'arafah', hour: 6 },
    { hijriMonth: 12, hijriDay: 10, key: 'eidAdha', hour: 7 },
];

/**
 * Looks 30 days ahead and schedules notifications for any Islamic events
 * that fall in that window. Skips events already scheduled.
 * Safe to call on every launch — has a 6-day throttle.
 */
export async function scheduleIslamicEventNotifications(): Promise<void> {
    try {
        // Throttle to once every 6 days
        const last = await AsyncStorage.getItem(LAST_SCHEDULED_KEY);
        if (last && Date.now() - parseInt(last, 10) < 6 * 24 * 60 * 60 * 1000) return;

        const { status } = await Notifications.getPermissionsAsync();
        if (status !== 'granted') return;

        // Cancel any existing Islamic event notifications to avoid duplicates
        const all = await Notifications.getAllScheduledNotificationsAsync();
        for (const n of all) {
            if (n.content.data?.type === 'islamic_event') {
                await Notifications.cancelScheduledNotificationAsync(n.identifier).catch(() => {});
            }
        }

        const now = new Date();

        // Check the next 35 days
        for (let offset = 0; offset <= 35; offset++) {
            const checkDate = new Date(now);
            checkDate.setDate(now.getDate() + offset);
            const hijri = toHijri(checkDate);

            for (const event of ISLAMIC_EVENTS) {
                // hijriMonth === 0 means "every month" (white days)
                const monthMatches = event.hijriMonth === 0 || event.hijriMonth === hijri.month;
                if (!monthMatches || event.hijriDay !== hijri.day) continue;

                // Schedule at the specified hour on that Gregorian date
                const fireDate = new Date(checkDate);
                fireDate.setHours(event.hour, 0, 0, 0);
                if (fireDate <= now) continue; // already passed

                await Notifications.scheduleNotificationAsync({
                    content: {
                        title: t(`islamicEvent.${event.key}.title`),
                        body: t(`islamicEvent.${event.key}.body`),
                        sound: 'default',
                        data: { type: 'islamic_event' },
                    },
                    trigger: {
                        type: Notifications.SchedulableTriggerInputTypes.DATE,
                        date: fireDate,
                        ...(Platform.OS === 'android' && { channelId: 'prayers' }),
                    },
                });
            }
        }

        await AsyncStorage.setItem(LAST_SCHEDULED_KEY, String(Date.now()));
    } catch (e) {
        console.warn('[islamicEvents] scheduling failed:', e);
    }
}

/**
 * Force a fresh schedule, bypassing the 6-day throttle above — for when the
 * content itself just became stale (e.g. the user changed language), not
 * just when it's been a while. Without this, an event notification queued
 * days ago in the old language would sit there un-refreshed until the
 * throttle window happened to expire on its own, firing in the wrong
 * language in the meantime.
 */
export async function forceRescheduleIslamicEventNotifications(): Promise<void> {
    try { await AsyncStorage.removeItem(LAST_SCHEDULED_KEY); } catch { /* ignore */ }
    await scheduleIslamicEventNotifications();
}
