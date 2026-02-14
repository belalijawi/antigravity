import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const NOTIFICATION_ENABLED_KEY = 'tahajjud_notification_enabled';
const NOTIFICATION_ID_KEY = 'tahajjud_notification_id';

// Configure notification behavior
Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true,
    }),
});

export async function requestNotificationPermissions(): Promise<boolean> {
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
            importance: Notifications.AndroidImportance.MAX, // Max for alarm-like behavior
            vibrationPattern: [0, 2000, 1000, 2000],
            lightColor: '#4F46E5',
            sound: 'tahajjud_alert.wav', // Custom sound file
            lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
            bypassDnd: true, // Attempt to bypass Do Not Disturb
        });
    }

    return true;
}

export async function scheduleTahajjudNotification(
    targetTime: Date,
    bufferMinutes: number = 0
): Promise<string | null> {
    try {
        // Cancel any existing notification
        await cancelTahajjudNotification();

        // Calculate notification time (targetTime - buffer)
        // ensure targetTime is a valid Date object
        const timeToWake = new Date(targetTime.getTime() - bufferMinutes * 60 * 1000);

        // If notification time is in the past, assume it's for tomorrow's cycle
        const now = new Date();
        if (timeToWake <= now) {
            // This logic needs to be handled by the caller (NightCalculator) to ensure
            // we are targeting the correct "Tonight/Tomorrow" instance.
            // For safety, if it's past, we warn but don't auto-increment here 
            // to avoid drift issues.
            console.warn("Scheduled time is in the past", timeToWake);
        }

        const notificationId = await Notifications.scheduleNotificationAsync({
            content: {
                title: '🌙 Time for Tahajjud',
                body: `The last third of the night has begun. Take a moment to pray.`,
                sound: "tahajjud_alert.wav", // Custom sound
                priority: Notifications.AndroidNotificationPriority.HIGH,
                vibrate: [0, 500, 250, 500],
            },
            trigger: {
                date: timeToWake,
                channelId: 'tahajjud',
            },
        });

        // Save notification ID and enabled status
        await AsyncStorage.setItem(NOTIFICATION_ID_KEY, notificationId);
        await AsyncStorage.setItem(NOTIFICATION_ENABLED_KEY, 'true');

        // Store the buffer preference for UI restoration
        await AsyncStorage.setItem('tahajjud_buffer_minutes', bufferMinutes.toString());

        console.log(`Notification scheduled for ${timeToWake.toLocaleString()}`);
        return notificationId;
    } catch (error) {
        console.error('Error scheduling notification:', error);
        return null;
    }
}

export async function cancelTahajjudNotification(): Promise<void> {
    try {
        const notificationId = await AsyncStorage.getItem(NOTIFICATION_ID_KEY);
        if (notificationId) {
            await Notifications.cancelScheduledNotificationAsync(notificationId);
            await AsyncStorage.removeItem(NOTIFICATION_ID_KEY);
        }
        await AsyncStorage.setItem(NOTIFICATION_ENABLED_KEY, 'false');
    } catch (error) {
        console.error('Error canceling notification:', error);
    }
}

export async function isNotificationEnabled(): Promise<boolean> {
    try {
        const enabled = await AsyncStorage.getItem(NOTIFICATION_ENABLED_KEY);
        return enabled === 'true';
    } catch (error) {
        return false;
    }
}

export async function getScheduledNotificationTime(): Promise<Date | null> {
    try {
        const notificationId = await AsyncStorage.getItem(NOTIFICATION_ID_KEY);
        if (!notificationId) return null;

        const notifications = await Notifications.getAllScheduledNotificationsAsync();
        const scheduled = notifications.find(n => n.identifier === notificationId);

        if (scheduled && scheduled.trigger && 'date' in scheduled.trigger) {
            return new Date(scheduled.trigger.date);
        }
        return null;
    } catch (error) {
        console.error('Error getting scheduled notification:', error);
        return null;
    }
}
