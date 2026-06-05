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

const LAST_SCHEDULED_KEY = 'islamic-events-scheduled-v1';

interface IslamicEvent {
    hijriMonth: number;
    hijriDay: number;
    title: string;
    body: string;
    /** Hour (local time) to fire the notification */
    hour: number;
}

const ISLAMIC_EVENTS: IslamicEvent[] = [
    // ── White Days (every month) ──
    { hijriMonth: 0, hijriDay: 13, title: '🌕 White Days begin', body: "Today starts the three white nights — the 13th, 14th and 15th. Fasting and extra prayer are highly recommended.", hour: 7 },
    { hijriMonth: 0, hijriDay: 14, title: '🌕 White Day', body: "The 14th of the month — one of the three blessed white days. A great day to fast.", hour: 7 },
    { hijriMonth: 0, hijriDay: 15, title: '🌕 Last White Day', body: "The 15th — the last of the three blessed white nights. Don't let it pass without extra worship.", hour: 7 },

    // ── Muharram (month 1) ──
    { hijriMonth: 1, hijriDay: 1, title: '🎆 Islamic New Year', body: "1 Muharram — a new Hijri year begins. Reflect on the year past and set intentions for the year ahead.", hour: 8 },
    { hijriMonth: 1, hijriDay: 9, title: '🤲 Ashura is tomorrow', body: "The 9th of Muharram. Tomorrow is the Day of Ashura — fast today and tomorrow to follow the Sunnah.", hour: 7 },
    { hijriMonth: 1, hijriDay: 10, title: '🤲 Day of Ashura', body: "The 10th of Muharram — fasting today expiates the sins of the past year. Don't miss it.", hour: 6 },

    // ── Rajab (month 7) ──
    { hijriMonth: 7, hijriDay: 1, title: '🌙 Rajab begins', body: "The sacred month of Rajab has arrived — one of the four forbidden months. Increase your dhikr and good deeds.", hour: 7 },
    { hijriMonth: 7, hijriDay: 27, title: '✨ Isra wal-Miraj', body: "The 27th of Rajab — the night the Prophet ﷺ ascended to the heavens. Spend this night in prayer and gratitude.", hour: 20 },

    // ── Sha'ban (month 8) ──
    { hijriMonth: 8, hijriDay: 14, title: '✨ Laylatul Bara\'ah tonight', body: "Tonight is the 15th of Sha'ban — a night of forgiveness. Stay awake in prayer, the Prophet ﷺ said Allah frees people from the Fire this night.", hour: 20 },
    { hijriMonth: 8, hijriDay: 15, title: '🤲 15th of Sha\'ban', body: "Fast today on the 15th of Sha'ban and increase your istighfar.", hour: 6 },

    // ── Ramadan (month 9) ──
    { hijriMonth: 9, hijriDay: 1, title: '🌙 Ramadan Mubarak', body: "The blessed month has arrived. May Allah accept your fasting, prayers, and recitation. Open the app to track your Ramadan journey.", hour: 6 },
    { hijriMonth: 9, hijriDay: 21, title: '✨ Seek Laylatul Qadr', body: "The last 10 nights begin. The odd nights — 21st, 23rd, 25th, 27th, 29th — could be Laylatul Qadr, better than 1000 months.", hour: 20 },
    { hijriMonth: 9, hijriDay: 23, title: '✨ 23rd night of Ramadan', body: "One of the odd nights in the last 10. Laylatul Qadr could be tonight — stand in prayer.", hour: 20 },
    { hijriMonth: 9, hijriDay: 25, title: '✨ 25th night of Ramadan', body: "Don't sleep tonight. This could be Laylatul Qadr — a night of worship worth more than a lifetime.", hour: 20 },
    { hijriMonth: 9, hijriDay: 27, title: '⭐ 27th night — most likely Laylatul Qadr', body: "The 27th of Ramadan — the night most scholars consider most likely to be Laylatul Qadr. Stand in prayer tonight.", hour: 20 },
    { hijriMonth: 9, hijriDay: 29, title: '✨ Final odd night of Ramadan', body: "The last chance for Laylatul Qadr. Give this night everything you have.", hour: 20 },

    // ── Dhu al-Hijjah (month 12) ──
    { hijriMonth: 12, hijriDay: 1, title: '🕌 The 10 blessed days begin', body: "Dhu al-Hijjah has arrived — the Prophet ﷺ said no days are better for good deeds than these 10 days. Fast, give, and pray.", hour: 7 },
    { hijriMonth: 12, hijriDay: 8, title: '🕌 Day of Tarwiyah', body: "The 8th of Dhu al-Hijjah. Pilgrims head to Mina today. Wherever you are, increase your dhikr and fasting.", hour: 7 },
    { hijriMonth: 12, hijriDay: 9, title: '🤲 Day of Arafah — fast today', body: "The greatest day of the year. Fasting today expiates two years of sins. Make dua — Allah descends and boasts of His servants to the angels.", hour: 6 },
    { hijriMonth: 12, hijriDay: 10, title: '🎆 Eid al-Adha Mubarak', body: "Eid Mubarak! May Allah accept the sacrifice of Ibrahim's family and yours. Enjoy this blessed day with your family.", hour: 7 },
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
                        title: event.title,
                        body: event.body,
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
