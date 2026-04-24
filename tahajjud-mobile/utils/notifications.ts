import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const NOTIFICATION_ENABLED_KEY = 'tahajjud_notification_enabled';
export const NOTIFICATION_ID_KEY_PREFIX = 'scheduled_notification_id_';

let notificationHandlerConfigured = false;
let isSchedulingGlobal = false;

// Call this before any notification API usage — NOT at module load time
function ensureNotificationHandler() {
    if (notificationHandlerConfigured) return;
    notificationHandlerConfigured = true;
    Notifications.setNotificationHandler({
        handleNotification: async () => ({
            shouldShowAlert: false, // Strictly silence foreground alerts to prevent spam
            shouldPlaySound: false, // Also silence sound in foreground
            shouldSetBadge: true,
            shouldShowBanner: false,
            shouldShowList: true,
        }),
    });
}

export async function requestNotificationPermissions(): Promise<boolean> {
    ensureNotificationHandler();
    if (!Device.isDevice) {
        console.log('Notifications only work on physical devices');
        return false;
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
    }

    if (finalStatus !== 'granted') {
        console.log('Failed to get notification permissions');
        return false;
    }

    // Configure Android notification channel
    if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('tahajjud', {
            name: 'Tahajjud Reminders',
            importance: Notifications.AndroidImportance.MAX,
            vibrationPattern: [0, 2000, 1000, 2000],
            lightColor: '#4F46E5',
            sound: 'tahajjud_alert.wav',
            lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
            bypassDnd: true,
        });

        await Notifications.setNotificationChannelAsync('prayers', {
            name: 'Prayer Times',
            importance: Notifications.AndroidImportance.HIGH,
            vibrationPattern: [0, 500, 500, 500],
            lightColor: '#06b6d4',
            lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
        });
    }

    return true;
}

// Note: Public individual schedule functions removed in favor of unified scheduleAllPrayerNotifications
// to prevent race conditions and redundant scheduling spam.

export async function cancelNotification(key: string): Promise<void> {
    try {
        const idKey = `${NOTIFICATION_ID_KEY_PREFIX}${key.toLowerCase()}`;
        const oldIdKey = key.toLowerCase() === 'tahajjud' ? 'tahajjud_notification_id' : null;

        // Cancel all IDs in the multi-reminder array (Tahajjud only)
        if (key.toLowerCase() === 'tahajjud') {
            const idsJson = await AsyncStorage.getItem('tahajjud_notification_ids_array');
            if (idsJson) {
                const ids: string[] = JSON.parse(idsJson);
                for (const id of ids) {
                    await Notifications.cancelScheduledNotificationAsync(id).catch(() => {});
                }
                await AsyncStorage.removeItem('tahajjud_notification_ids_array');
                console.log(`Canceled ${ids.length} Tahajjud notification(s)`);
            }
        }

        const notificationId = await AsyncStorage.getItem(idKey);
        if (notificationId) {
            await Notifications.cancelScheduledNotificationAsync(notificationId).catch(() => {});
            await AsyncStorage.removeItem(idKey);
        }

        if (oldIdKey) {
            const oldId = await AsyncStorage.getItem(oldIdKey);
            if (oldId) {
                await Notifications.cancelScheduledNotificationAsync(oldId).catch(() => {});
                await AsyncStorage.removeItem(oldIdKey);
            }
        }

        if (key.toLowerCase() === 'tahajjud') {
            await AsyncStorage.setItem(NOTIFICATION_ENABLED_KEY, 'false');
        } else {
            await AsyncStorage.setItem(`notification_enabled_${key.toLowerCase()}`, 'false');
        }
    } catch (error) {
        console.error(`Error canceling notification for ${key}:`, error);
    }
}

// Backward compatibility
export const cancelTahajjudNotification = () => cancelNotification('tahajjud');

export async function isNotificationEnabled(key: string = 'tahajjud'): Promise<boolean> {
    try {
        if (key.toLowerCase() === 'tahajjud') {
            const enabled = await AsyncStorage.getItem(NOTIFICATION_ENABLED_KEY);
            return enabled === 'true';
        }
        const enabled = await AsyncStorage.getItem(`notification_enabled_${key.toLowerCase()}`);
        return enabled === 'true';
    } catch (error) {
        return false;
    }
}

export async function getScheduledNotificationTime(key: string = 'tahajjud'): Promise<Date | null> {
    try {
        const idKey = `${NOTIFICATION_ID_KEY_PREFIX}${key.toLowerCase()}`;
        const notificationId = await AsyncStorage.getItem(idKey);
        if (!notificationId) return null;

        const notifications = await Notifications.getAllScheduledNotificationsAsync();
        const scheduled = notifications.find(n => n.identifier === notificationId);

        if (scheduled && scheduled.trigger && 'date' in scheduled.trigger) {
            return new Date(scheduled.trigger.date);
        }
        return null;
    } catch (error) {
        console.error(`Error getting scheduled notification for ${key}:`, error);
        return null;
    }
}

export async function scheduleAllPrayerNotifications(
    prayerTimes: any,
    enabledPrayers: boolean | Record<string, boolean>,
    tahajjudConfig?: { enabled: boolean, buffers: number[], targetTime: Date }
) {
    if (isSchedulingGlobal) {
        console.log('[DEBUG] Skipping scheduleAllPrayerNotifications: already in progress');
        return;
    }

    isSchedulingGlobal = true;
    try {
        ensureNotificationHandler();

        // 1. Decisively cancel all potential stale/duplicate notifications before rescheduling
        // This is the "Nuclear Option" to ensure the device is never spammed.
        await Notifications.cancelAllScheduledNotificationsAsync();

        // Clear all ID keys from AsyncStorage as well to keep them in sync
        const keys = await AsyncStorage.getAllKeys();
        const notificationKeys = keys.filter(k =>
            k.startsWith(NOTIFICATION_ID_KEY_PREFIX) ||
            k === 'tahajjud_notification_id' ||
            k === 'tahajjud_future_ids'
        );
        if (notificationKeys.length > 0) {
            await AsyncStorage.multiRemove(notificationKeys);
        }

        const isOverallEnabled = typeof enabledPrayers === 'boolean' ? enabledPrayers : Object.values(enabledPrayers).some(v => v);

        if (!isOverallEnabled && !tahajjudConfig?.enabled) {
            console.log('[DEBUG] All notifications are disabled globally. Slate cleared.');
            return;
        }

        // Read prayer reminder offset first so it's available for scheduling
        const offsetRaw = await AsyncStorage.getItem('prayer_reminder_offset');
        const prayerOffset = offsetRaw ? parseInt(offsetRaw, 10) : 0;

        if (isOverallEnabled) {
            console.log('[DEBUG] Starting clean re-scheduling for daily prayers...');
            const prayers = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'];

            for (const prayer of prayers) {
                const isEnabled = typeof enabledPrayers === 'boolean'
                    ? enabledPrayers
                    : enabledPrayers[prayer.toLowerCase()];

                if (isEnabled) {
                    await internalSchedulePrayerNotification(prayer.charAt(0).toUpperCase() + prayer.slice(1), prayerTimes[prayer], prayerOffset);
                }
            }
        }

        // Handle Tahajjud if config is provided
        if (tahajjudConfig?.enabled) {
            console.log('[DEBUG] Scheduling Tahajjud within global sweep...');
            const ids: string[] = [];
            for (const buffer of tahajjudConfig.buffers) {
                const id = await internalScheduleTahajjudNotificationRaw(tahajjudConfig.targetTime, buffer);
                if (id) ids.push(id);
            }
            if (ids.length > 0) {
                await AsyncStorage.setItem('tahajjud_notification_ids_array', JSON.stringify(ids));
                await AsyncStorage.setItem(`${NOTIFICATION_ID_KEY_PREFIX}tahajjud`, ids[0]);
                await AsyncStorage.setItem(NOTIFICATION_ENABLED_KEY, 'true');
            }
        }
    } finally {
        isSchedulingGlobal = false;
    }
}

/**
 * Schedule Tahajjud wake-up notifications for future nights (days 1–6 ahead).
 * Called AFTER scheduleAllPrayerNotifications so tonight is already handled.
 * Does NOT cancel existing notifications.
 */
export async function scheduleFutureTahajjudNotifications(
    nights: Array<{ targetTime: Date; buffer: number }>
): Promise<void> {
    ensureNotificationHandler();
    const ids: string[] = [];
    for (const { targetTime, buffer } of nights) {
        const id = await internalScheduleTahajjudNotificationRaw(targetTime, buffer);
        if (id) ids.push(id);
    }
    // Append new IDs to the stored list so cancelNotification can find them
    try {
        const existing = JSON.parse(await AsyncStorage.getItem('tahajjud_future_ids') || '[]');
        await AsyncStorage.setItem('tahajjud_future_ids', JSON.stringify([...existing, ...ids]));
    } catch {}
}

/**
 * Schedule daily prayer notifications for future days (days 1–6 ahead).
 * Each entry is a flat list of {name, time} pairs — one per prayer per day.
 * Does NOT cancel existing notifications.
 */
export async function scheduleFuturePrayerNotifications(
    prayers: Array<{ name: string; time: Date }>
): Promise<void> {
    ensureNotificationHandler();
    const offsetRaw = await AsyncStorage.getItem('prayer_reminder_offset');
    const prayerOffset = offsetRaw ? parseInt(offsetRaw, 10) : 0;

    for (const { name, time } of prayers) {
        const scheduleTime = new Date(time.getTime() - prayerOffset * 60 * 1000);
        const now = new Date();
        const safetyMargin = 3 * 60 * 1000;
        if (scheduleTime <= new Date(now.getTime() + safetyMargin)) continue;
        try {
            const key = name.toLowerCase();
            const content = PRAYER_CONTENT[key];
            const { title, body } = buildPrayerNotificationContent(name, content, prayerOffset, time);
            await Notifications.scheduleNotificationAsync({
                content: {
                    title,
                    body,
                    priority: Notifications.AndroidNotificationPriority.HIGH,
                    sound: 'default',
                },
                trigger: {
                    type: Notifications.SchedulableTriggerInputTypes.DATE,
                    date: scheduleTime,
                    ...(Platform.OS === 'android' && { channelId: 'prayers' }),
                },
            });
        } catch (err) {
            console.warn(`[DEBUG] Failed to schedule future ${name}:`, err);
        }
    }
}

/**
 * Internal helper for Tahajjud scheduling
 */
async function internalScheduleTahajjudNotification(targetTime: Date, bufferMinutes: number) {
    const now = new Date();
    const timeToWake = new Date(targetTime.getTime() - bufferMinutes * 60 * 1000);
    const safetyMargin = 3 * 60 * 1000;

    if (timeToWake <= new Date(now.getTime() + safetyMargin)) {
        console.log('[DEBUG] Skipping Tahajjud: too close or in past');
        return;
    }

    const title = bufferMinutes > 0 ? '⏰ Tahajjud Reminder' : '🌙 Time for Tahajjud';
    const formattedTahajjudTime = targetTime.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    const body = bufferMinutes > 0
        ? `Tahajjud (Last Third) begins at ${formattedTahajjudTime} (in ${bufferMinutes} mins). Get ready.`
        : `The last third of the night has begun (${formattedTahajjudTime}). Your Lord is waiting.`;

    const notificationId = await Notifications.scheduleNotificationAsync({
        content: {
            title,
            body,
            sound: 'tahajjud_alert.wav',
            priority: Notifications.AndroidNotificationPriority.MAX,
            vibrate: [0, 1000, 500, 1000],
        },
        trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DATE,
            date: timeToWake,
            ...(Platform.OS === 'android' && { channelId: 'tahajjud' }),
        },
    });

    await AsyncStorage.setItem(`${NOTIFICATION_ID_KEY_PREFIX}tahajjud`, notificationId);
    await AsyncStorage.setItem(NOTIFICATION_ENABLED_KEY, 'true');
    console.log(`[DEBUG] Tahajjud scheduled for ${timeToWake.toLocaleString()}`);
}

/**
 * Like internalScheduleTahajjudNotification but returns the notification ID
 * (used for future-night scheduling where we don't overwrite tonight's key)
 */
async function internalScheduleTahajjudNotificationRaw(targetTime: Date, bufferMinutes: number): Promise<string | null> {
    const now = new Date();
    const timeToWake = new Date(targetTime.getTime() - bufferMinutes * 60 * 1000);
    if (timeToWake <= new Date(now.getTime() + 3 * 60 * 1000)) return null;

    const title = bufferMinutes > 0 ? '⏰ Tahajjud Reminder' : '🌙 Time for Tahajjud';
    const formattedTahajjudTime = targetTime.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    const body = bufferMinutes > 0
        ? `Tahajjud (Last Third) begins at ${formattedTahajjudTime} (in ${bufferMinutes} mins). Get ready.`
        : `The last third of the night has begun (${formattedTahajjudTime}). Your Lord is waiting.`;

    try {
        const notificationId = await Notifications.scheduleNotificationAsync({
            content: {
                title,
                body,
                sound: 'tahajjud_alert.wav',
                priority: Notifications.AndroidNotificationPriority.MAX,
                vibrate: [0, 1000, 500, 1000],
            },
            trigger: {
                type: Notifications.SchedulableTriggerInputTypes.DATE,
                date: timeToWake,
                ...(Platform.OS === 'android' && { channelId: 'tahajjud' }),
            },
        });
        return notificationId;
    } catch {
        return null;
    }
}

// Builds the right title/body depending on whether we're notifying early or at-time
function buildPrayerNotificationContent(
    name: string,
    content: { emoji: string; title: string; body: string } | undefined,
    offsetMinutes: number,
    prayerTime: Date,
): { title: string; body: string } {
    const emoji = content?.emoji ?? '🕌';
    const timeStr = prayerTime.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    if (offsetMinutes > 0) {
        return {
            title: `${emoji} ${name} in ${offsetMinutes} min`,
            body: `${name} begins at ${timeStr}. Time to prepare.`,
        };
    }
    return {
        title: content?.title ?? `${emoji} ${name}`,
        body: content?.body ?? `It is time for ${name}.`,
    };
}

// Unique title + body for each prayer — and for Tahajjud at-the-time vs. prep reminder
const PRAYER_CONTENT: Record<string, { emoji: string; title: string; body: string }> = {
    fajr: {
        emoji: '🌅',
        title: 'Fajr',
        body: "It's Fajr time. Start your day with Allah.",
    },
    dhuhr: {
        emoji: '☀️',
        title: 'Dhuhr',
        body: "Time for Dhuhr. Take a moment and pray.",
    },
    asr: {
        emoji: '🌤',
        title: 'Asr',
        body: "Asr is here. Don't delay.",
    },
    maghrib: {
        emoji: '🌇',
        title: 'Maghrib',
        body: "Maghrib time. Pray before it passes.",
    },
    isha: {
        emoji: '🌃',
        title: 'Isha',
        body: "End your day with Isha.",
    },
};

/**
 * Internal helper that doesn't call cancelNotification to avoid redundant AsyncStorage hits
 */
async function internalSchedulePrayerNotification(prayerName: string, targetTime: Date, offsetMinutes: number = 0) {
    const now = new Date();
    const scheduleTime = new Date(targetTime.getTime() - offsetMinutes * 60 * 1000);
    const safetyMargin = 3 * 60 * 1000;

    if (scheduleTime <= new Date(now.getTime() + safetyMargin)) {
        console.log(`[DEBUG] Skipping ${prayerName}: too close or in past`);
        return;
    }

    const key = prayerName.toLowerCase();
    const content = PRAYER_CONTENT[key];
    const { title, body } = buildPrayerNotificationContent(prayerName, content, offsetMinutes, targetTime);

    const notificationId = await Notifications.scheduleNotificationAsync({
        content: {
            title,
            body,
            priority: Notifications.AndroidNotificationPriority.HIGH,
            sound: 'default',
        },
        trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DATE,
            date: scheduleTime,
            ...(Platform.OS === 'android' && { channelId: 'prayers' }),
        },
    });

    await AsyncStorage.setItem(`${NOTIFICATION_ID_KEY_PREFIX}${key}`, notificationId);
    console.log(`[DEBUG] ${prayerName} scheduled for ${scheduleTime.toLocaleString()} (${offsetMinutes} min before)`);
}
