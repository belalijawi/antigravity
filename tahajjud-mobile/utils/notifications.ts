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

        const notificationId = await AsyncStorage.getItem(idKey);
        if (notificationId) {
            await Notifications.cancelScheduledNotificationAsync(notificationId);
            await AsyncStorage.removeItem(idKey);
            console.log(`Canceled notification: ${notificationId} (${key})`);
        }

        if (oldIdKey) {
            const oldId = await AsyncStorage.getItem(oldIdKey);
            if (oldId) {
                await Notifications.cancelScheduledNotificationAsync(oldId);
                await AsyncStorage.removeItem(oldIdKey);
                console.log(`Canceled legacy notification: ${oldId}`);
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
    tahajjudConfig?: { enabled: boolean, buffer: number, targetTime: Date }
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
        const notificationKeys = keys.filter(k => k.startsWith(NOTIFICATION_ID_KEY_PREFIX) || k === 'tahajjud_notification_id');
        if (notificationKeys.length > 0) {
            await AsyncStorage.multiRemove(notificationKeys);
        }

        const isOverallEnabled = typeof enabledPrayers === 'boolean' ? enabledPrayers : Object.values(enabledPrayers).some(v => v);

        if (!isOverallEnabled && !tahajjudConfig?.enabled) {
            console.log('[DEBUG] All notifications are disabled globally. Slate cleared.');
            return;
        }

        if (isOverallEnabled) {
            console.log('[DEBUG] Starting clean re-scheduling for daily prayers...');
            const prayers = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'];

            for (const prayer of prayers) {
                const isEnabled = typeof enabledPrayers === 'boolean'
                    ? enabledPrayers
                    : enabledPrayers[prayer.toLowerCase()];

                if (isEnabled) {
                    // Call schedulePrayerNotification without redundant internal cancel (since we just wiped all)
                    await internalSchedulePrayerNotification(prayer.charAt(0).toUpperCase() + prayer.slice(1), prayerTimes[prayer]);
                }
            }
        }

        // 2. Handle Tahajjud if config is provided
        if (tahajjudConfig?.enabled) {
            console.log('[DEBUG] Scheduling Tahajjud within global sweep...');
            await internalScheduleTahajjudNotification(tahajjudConfig.targetTime, tahajjudConfig.buffer);
        }
    } finally {
        isSchedulingGlobal = false;
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
            sound: "tahajjud_alert.wav",
            priority: Notifications.AndroidNotificationPriority.MAX,
            vibrate: [0, 1000, 500, 1000],
        },
        trigger: {
            date: timeToWake,
            channelId: 'tahajjud',
        },
    });

    await AsyncStorage.setItem(`${NOTIFICATION_ID_KEY_PREFIX}tahajjud`, notificationId);
    await AsyncStorage.setItem(NOTIFICATION_ENABLED_KEY, 'true');
    console.log(`[DEBUG] Tahajjud scheduled for ${timeToWake.toLocaleString()}`);
}

/**
 * Internal helper that doesn't call cancelNotification to avoid redundant AsyncStorage hits
 */
async function internalSchedulePrayerNotification(prayerName: string, targetTime: Date) {
    const now = new Date();
    const scheduleTime = new Date(targetTime);
    const safetyMargin = 3 * 60 * 1000; // Increased to 3 minutes to be very safe against app-load jitter

    if (scheduleTime <= new Date(now.getTime() + safetyMargin)) {
        console.log(`[DEBUG] Skipping ${prayerName}: too close or in past`);
        return;
    }

    const notificationId = await Notifications.scheduleNotificationAsync({
        content: {
            title: `🕌 ${prayerName} Prayer`,
            body: `It is time for ${prayerName}. Take a break and connect with your Creator.`,
            priority: Notifications.AndroidNotificationPriority.HIGH,
            sound: true,
        },
        trigger: {
            date: scheduleTime,
            channelId: 'prayers',
        },
    });

    await AsyncStorage.setItem(`${NOTIFICATION_ID_KEY_PREFIX}${prayerName.toLowerCase()}`, notificationId);
    console.log(`[DEBUG] ${prayerName} scheduled for ${scheduleTime.toLocaleString()}`);
}
