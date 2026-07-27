import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { t } from './i18n';

export const NOTIFICATION_ENABLED_KEY = 'tahajjud_notification_enabled';
export const NOTIFICATION_ID_KEY_PREFIX = 'scheduled_notification_id_';

let notificationHandlerConfigured = false;
let isSchedulingGlobal = false;

// Dev-only logger — stripped out in production builds
const log = (...args: any[]) => { if (__DEV__) console.log(...args); };

/**
 * Configure the foreground notification handler. Safe to call repeatedly —
 * idempotent. Exported so App.tsx can call it on cold start, ensuring the
 * handler is set before any push could possibly arrive.
 */
export function ensureNotificationHandler() {
    if (notificationHandlerConfigured) return;
    notificationHandlerConfigured = true;
    ensureNotificationCategories();
    Notifications.setNotificationHandler({
        handleNotification: async (notification) => {
            const dataType = notification.request.content.data?.type;
            // Always show partner notifications (wake-up call, partner prayed)
            const isPartner = dataType === 'partner_prayed' || dataType === 'partner_wakeup';
            // Always show Tahajjud alarms and prayer reminders even when app is open —
            // iOS silently swallows them otherwise, meaning the user misses their alarm.
            const isPrayer = dataType === 'tahajjud' || dataType === 'prayer' ||
                             dataType === 'islamic_event' || dataType === 'streak_at_risk';
            // Community reactions — warm, welcome to show in foreground.
            // Includes the admin "you were chosen" picks: without these the
            // author with the app open never saw their Top Dua/Story moment.
            const isCommunity = dataType === 'dua_milestone' || dataType === 'testimony_milestone' ||
                                dataType === 'top_dua' || dataType === 'top_story' ||
                                dataType === 'dua_reply' || dataType === 'testimony_reply' ||
                                dataType === 'reply_liked' || dataType === 'thread_reply' ||
                                // Fires from a local sync/rank-check triggered by the user's
                                // OWN action, so the app is essentially always in the
                                // foreground the moment this notification is created —
                                // without this it would never actually be seen.
                                dataType === 'leaderboard_rank';
            // Feature nudge / day-1 morning check-in / engagement nudges —
            // informational, fine in foreground. Every other scheduled
            // notification type in the app belongs in one bucket or another;
            // these were the ones missing (silently swallowed in foreground
            // if the app happened to be open when they fired).
            const isNudge = dataType === 'feature_nudge' || dataType === 'morning_after' ||
                             dataType === 'hifz_review' || dataType === 'trial_reminder' ||
                             dataType === 'trial_winback' || dataType === 'winback_1' ||
                             dataType === 'winback_2' || dataType === 'streak_paywall';
            const shouldShow = isPartner || isPrayer || isCommunity || isNudge;
            return {
                shouldShowAlert: shouldShow,
                shouldPlaySound: shouldShow,
                shouldSetBadge: true,
                shouldShowBanner: shouldShow,
                shouldShowList: true,
            };
        },
    });
}

const PRAYER_LOG_CATEGORY = 'PRAYER_LOG';
let categoriesConfigured = false;

/** One-tap "Log" action button on prayer/Tahajjud notifications. Idempotent. */
function ensureNotificationCategories() {
    if (categoriesConfigured) return;
    categoriesConfigured = true;
    Notifications.setNotificationCategoryAsync(PRAYER_LOG_CATEGORY, [
        {
            identifier: 'LOG',
            buttonTitle: t('notifAction.log'),
            options: { opensAppToForeground: true },
        },
    ]).catch(() => {});
}

export async function requestNotificationPermissions(): Promise<boolean> {
    ensureNotificationHandler();
    if (!Device.isDevice) {
        log('Notifications only work on physical devices');
        return false;
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
    }

    if (finalStatus !== 'granted') {
        log('Failed to get notification permissions');
        return false;
    }

    // Configure Android notification channel
    if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('tahajjud', {
            name: 'Tahajjud Reminders',
            importance: Notifications.AndroidImportance.MAX,
            vibrationPattern: [0, 2000, 1000, 2000],
            lightColor: '#4F46E5',
            // Android resolves this against res/raw/tahajjud_alert (the full-length
            // alarm) — the extension must match the actual raw resource file.
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

/**
 * Fire a local notification right now (not scheduled for later) — for
 * moments the APP ITSELF detects something worth telling the user about
 * client-side (e.g. a leaderboard rank crossing a tier), as opposed to a
 * remote push from another device or a time-based reminder. Silently no-ops
 * if permission was never granted — this must never be the thing that
 * PROMPTS for permission, since it fires from background sync work, not a
 * direct user action.
 */
export async function notifyNow(title: string, body: string, data?: Record<string, string>): Promise<void> {
    try {
        const { status } = await Notifications.getPermissionsAsync();
        if (status !== 'granted') return;
        ensureNotificationHandler();
        await Notifications.scheduleNotificationAsync({
            content: { title, body, sound: 'default', data },
            trigger: null, // fire immediately
        });
    } catch { /* never block the caller over a notification */ }
}

/**
 * Day-1 morning check-in — scheduled ONCE, at the end of onboarding, for the
 * following morning. First-day prayer-loggers retain at 2× everyone else;
 * this is the first-day loop-closer: "did you wake for Tahajjud? Log it."
 */
export async function scheduleMorningAfter(hasStreak: boolean): Promise<void> {
    const KEY = 'morning-after-scheduled-v1';
    try {
        if (await AsyncStorage.getItem(KEY)) return; // only ever once
        const { status } = await Notifications.getPermissionsAsync();
        if (status !== 'granted') return;

        const fireDate = new Date();
        fireDate.setDate(fireDate.getDate() + 1);
        fireDate.setHours(8, 30, 0, 0);

        await Notifications.scheduleNotificationAsync({
            content: {
                title: hasStreak ? t('morning.titleStreak') : t('morning.titleFirst'),
                body: hasStreak ? t('morning.bodyStreak') : t('morning.bodyFirst'),
                sound: 'default',
                data: { type: 'morning_after' },
            },
            trigger: {
                type: Notifications.SchedulableTriggerInputTypes.DATE,
                date: fireDate,
                ...(Platform.OS === 'android' && { channelId: 'prayers' }),
            },
        });
        await AsyncStorage.setItem(KEY, 'true');
    } catch { /* never block onboarding */ }
}

// Note: Public individual schedule functions removed in favor of unified scheduleAllPrayerNotifications
// to prevent race conditions and redundant scheduling spam.

export async function cancelNotification(key: string): Promise<void> {
    try {
        const idKey = `${NOTIFICATION_ID_KEY_PREFIX}${key.toLowerCase()}`;
        const oldIdKey = key.toLowerCase() === 'tahajjud' ? 'tahajjud_notification_id' : null;

        // Cancel all IDs in the multi-reminder array and future nights (Tahajjud only)
        if (key.toLowerCase() === 'tahajjud') {
            const idsJson = await AsyncStorage.getItem('tahajjud_notification_ids_array');
            if (idsJson) {
                const ids: string[] = JSON.parse(idsJson);
                for (const id of ids) {
                    await Notifications.cancelScheduledNotificationAsync(id).catch(() => {});
                }
                await AsyncStorage.removeItem('tahajjud_notification_ids_array');
                log(`Canceled ${ids.length} Tahajjud notification(s)`);
            }
            // Also cancel future night notifications (days 1-6 ahead)
            const futureIdsJson = await AsyncStorage.getItem('tahajjud_future_ids');
            if (futureIdsJson) {
                const futureIds: string[] = JSON.parse(futureIdsJson);
                for (const id of futureIds) {
                    await Notifications.cancelScheduledNotificationAsync(id).catch(() => {});
                }
                await AsyncStorage.removeItem('tahajjud_future_ids');
                log(`Canceled ${futureIds.length} future Tahajjud notification(s)`);
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
        log('[DEBUG] Skipping scheduleAllPrayerNotifications: already in progress');
        return;
    }

    isSchedulingGlobal = true;
    try {
        ensureNotificationHandler();

        // Cancel only tracked prayer/Tahajjud notifications by their stored IDs.
        // Previously used cancelAllScheduledNotificationsAsync() ("nuclear option")
        // which also wiped the weekly digest and Hifz review notifications — they
        // were never rescheduled, so users lost them on every app launch.
        // NOTE: today's 5 prayer notifications are deliberately NOT blanket-
        // cancelled here (unlike Tahajjud/future below). This function reruns
        // on every app foreground/launch/setting change, and a blind
        // cancel-then-reschedule pass would cancel an already-valid,
        // about-to-fire notification and then refuse to reschedule it if the
        // 3-minute safety margin had since kicked in — permanently losing a
        // notification just because the user opened the app shortly before
        // it was due. internalSchedulePrayerNotification instead cancels a
        // prayer's OLD id only at the moment it successfully schedules a
        // replacement; see the scheduling loop below, which also explicitly
        // cancels+clears any prayer that's no longer enabled.

        const tahajjudIdsJson = await AsyncStorage.getItem('tahajjud_notification_ids_array').catch(() => null);
        if (tahajjudIdsJson) {
            const ids: string[] = JSON.parse(tahajjudIdsJson);
            for (const id of ids) await Notifications.cancelScheduledNotificationAsync(id).catch(() => {});
        }

        const futureIdsJson = await AsyncStorage.getItem('tahajjud_future_ids').catch(() => null);
        if (futureIdsJson) {
            const ids: string[] = JSON.parse(futureIdsJson);
            for (const id of ids) await Notifications.cancelScheduledNotificationAsync(id).catch(() => {});
        }

        // Same as tahajjud_future_ids above, but for the days-1-6-ahead daily
        // prayer notifications scheduled by scheduleFuturePrayerNotifications.
        // Without this, changing the reminder offset (or anything else that
        // forces a reschedule) only updated TODAY's notifications — the
        // already-prescheduled future days stayed locked at the old offset,
        // and the next prefetch would stack a duplicate batch on top.
        const prayerFutureIdsJson = await AsyncStorage.getItem('prayer_future_ids').catch(() => null);
        if (prayerFutureIdsJson) {
            const ids: string[] = JSON.parse(prayerFutureIdsJson);
            for (const id of ids) await Notifications.cancelScheduledNotificationAsync(id).catch(() => {});
        }

        const legacyId = await AsyncStorage.getItem('tahajjud_notification_id').catch(() => null);
        if (legacyId) await Notifications.cancelScheduledNotificationAsync(legacyId).catch(() => {});

        // Clear tracked Tahajjud/future ID keys (today's 5 prayer keys are
        // deliberately excluded — see note above).
        const keysToRemove = [
            `${NOTIFICATION_ID_KEY_PREFIX}tahajjud`,
            'tahajjud_notification_ids_array',
            'tahajjud_future_ids',
            'prayer_future_ids',
            'tahajjud_notification_id',
        ];
        await AsyncStorage.multiRemove(keysToRemove).catch(() => {});

        const isOverallEnabled = typeof enabledPrayers === 'boolean' ? enabledPrayers : Object.values(enabledPrayers).some(v => v);

        // Cancels+clears a specific prayer's tracked notification(s) — used
        // when a prayer is (or becomes) disabled, as opposed to being
        // rescheduled, which now cancels-then-replaces atomically inside
        // internalSchedulePrayerNotification instead of here.
        const cancelPrayerKey = async (prayer: string) => {
            for (const suffix of ['', '_early']) {
                const idKey = `${NOTIFICATION_ID_KEY_PREFIX}${prayer}${suffix}`;
                const id = await AsyncStorage.getItem(idKey).catch(() => null);
                if (id) await Notifications.cancelScheduledNotificationAsync(id).catch(() => {});
                await AsyncStorage.removeItem(idKey).catch(() => {});
            }
        };

        const allPrayerKeys = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'];

        if (!isOverallEnabled && !tahajjudConfig?.enabled) {
            log('[DEBUG] All notifications are disabled globally. Slate cleared.');
            for (const prayer of allPrayerKeys) await cancelPrayerKey(prayer);
            return;
        }

        // Read prayer reminder offset first so it's available for scheduling
        const offsetRaw = await AsyncStorage.getItem('prayer_reminder_offset');
        const prayerOffset = offsetRaw ? parseInt(offsetRaw, 10) : 0;

        if (isOverallEnabled) {
            log('[DEBUG] Starting clean re-scheduling for daily prayers...');

            for (const prayer of allPrayerKeys) {
                const isEnabled = typeof enabledPrayers === 'boolean'
                    ? enabledPrayers
                    : enabledPrayers[prayer.toLowerCase()];

                if (isEnabled) {
                    const name = prayer.charAt(0).toUpperCase() + prayer.slice(1);
                    // On-time notification — the one that gets the "Log" button.
                    await internalSchedulePrayerNotification(name, prayerTimes[prayer], 0);
                    // Separately-tracked early reminder, only when the user has
                    // actually chosen a lead time. Intentionally has no "Log"
                    // button (the prayer hasn't started yet). Without this split,
                    // there used to be only ONE notification per prayer driven
                    // by the same offset — so anyone with a nonzero reminder
                    // offset would never see a loggable notification at all,
                    // since the on-time one above was never scheduled for them.
                    if (prayerOffset !== 0) {
                        await internalSchedulePrayerNotification(name, prayerTimes[prayer], prayerOffset, '_early');
                    }
                } else {
                    // This specific prayer is turned off — actually cancel it
                    // (nothing else will, now that the blanket upfront cancel
                    // is gone).
                    await cancelPrayerKey(prayer);
                }
            }
        } else {
            // Prayers are off overall but Tahajjud is still enabled — cancel
            // any prayer notifications left over from when they were on.
            for (const prayer of allPrayerKeys) await cancelPrayerKey(prayer);
        }

        // Handle Tahajjud if config is provided
        if (tahajjudConfig?.enabled) {
            log('[DEBUG] Scheduling Tahajjud within global sweep...');
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
 * Does NOT cancel existing notifications — but DOES record the IDs it
 * schedules to 'prayer_future_ids' so scheduleAllPrayerNotifications can
 * cancel them on the next reschedule (e.g. reminder-offset change).
 */
export async function scheduleFuturePrayerNotifications(
    prayers: Array<{ name: string; time: Date }>
): Promise<void> {
    ensureNotificationHandler();
    const ids: string[] = [];

    // Schedules one future notification at `offset` minutes before `time`.
    // Only offset===0 (the actual prayer time) gets the "Log" button.
    const scheduleOne = async (name: string, time: Date, offset: number) => {
        const scheduleTime = new Date(time.getTime() - offset * 60 * 1000);
        const now = new Date();
        const safetyMargin = 3 * 60 * 1000;
        if (scheduleTime <= new Date(now.getTime() + safetyMargin)) return;
        try {
            const key = name.toLowerCase();
            const content = PRAYER_CONTENT[key];
            const { title, body } = buildPrayerNotificationContent(name, content, offset, time);
            const id = await Notifications.scheduleNotificationAsync({
                content: {
                    title,
                    body,
                    priority: Notifications.AndroidNotificationPriority.HIGH,
                    sound: 'default',
                    // Without this, iOS silently delivers the notification
                    // with no sound whenever any Focus mode is active (Sleep
                    // Focus overnight is extremely common — and directly
                    // covers Fajr). Tahajjud alerts already set this; daily
                    // prayer notifications never did.
                    interruptionLevel: 'timeSensitive',
                    data: { type: 'prayer', prayer: key },
                    ...(offset === 0 && { categoryIdentifier: PRAYER_LOG_CATEGORY }),
                },
                trigger: {
                    type: Notifications.SchedulableTriggerInputTypes.DATE,
                    date: scheduleTime,
                    ...(Platform.OS === 'android' && { channelId: 'prayers' }),
                },
            });
            ids.push(id);
        } catch (err) {
            log(`[DEBUG] Failed to schedule future ${name}:`, err);
        }
    };

    // On-time only (no separate early-reminder duplicate) for future days.
    // iOS hard-caps an app at 64 pending local notifications and silently
    // evicts past that — doubling every prayer across all 6 prefetched days
    // (5 prayers x 2 x 6 days = 60) blew straight through it alongside
    // today's notifications and Tahajjud, so nothing beyond the cap ever
    // fired. Today still gets both (see scheduleAllPrayerNotifications) —
    // opening the app on any given day reschedules that day's early
    // reminder too, so the only gap is a day the app is never opened at all.
    for (const { name, time } of prayers) {
        await scheduleOne(name, time, 0);
    }

    if (ids.length > 0) {
        try {
            const existing = JSON.parse(await AsyncStorage.getItem('prayer_future_ids') || '[]');
            await AsyncStorage.setItem('prayer_future_ids', JSON.stringify([...existing, ...ids]));
        } catch {}
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
        log('[DEBUG] Skipping Tahajjud: too close or in past');
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
            // iOS: must be ≤30s and caf/wav/aiff — the old 4-min .m4a was silently
            // rejected by iOS, which played the default chime instead.
            sound: 'tahajjud_alert.caf',
            priority: Notifications.AndroidNotificationPriority.MAX,
            vibrate: [0, 1000, 500, 1000, 500, 1000],
            // ── Time-sensitive: bypasses iOS Focus / Do Not Disturb ──
            // This is the highest interruption level available without
            // Apple's critical-alerts entitlement (which requires an app
            // review request). Time-sensitive ensures the Tahajjud reminder
            // pierces through Sleep / Do Not Disturb focus modes — exactly
            // what you want from a wake-up alarm.
            interruptionLevel: 'timeSensitive',
            // Required so the foreground handler's `isPrayer` check forces
            // this alarm to show/sound even when the app is open — without
            // it, iOS silently swallows tonight's Tahajjud alert (see
            // ensureNotificationHandler above). internalScheduleTahajjudNotificationRaw
            // (used for future nights) already had this; this is the primary
            // "tonight" path and was missing it.
            data: { type: 'tahajjud', prayer: 'tahajjud' },
            // Only the at-time alert (the gate is actually open) gets the
            // "Log" action — logging from the earlier "get ready" reminder
            // would be premature. Matches internalScheduleTahajjudNotificationRaw.
            ...(bufferMinutes === 0 && { categoryIdentifier: PRAYER_LOG_CATEGORY }),
        },
        trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DATE,
            date: timeToWake,
            ...(Platform.OS === 'android' && { channelId: 'tahajjud' }),
        },
    });

    await AsyncStorage.setItem(`${NOTIFICATION_ID_KEY_PREFIX}tahajjud`, notificationId);
    await AsyncStorage.setItem(NOTIFICATION_ENABLED_KEY, 'true');
    log(`[DEBUG] Tahajjud scheduled for ${timeToWake.toLocaleString()}`);
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
                // iOS: must be ≤30s and caf/wav/aiff — the old 4-min .m4a was silently
            // rejected by iOS, which played the default chime instead.
            sound: 'tahajjud_alert.caf',
                priority: Notifications.AndroidNotificationPriority.MAX,
                vibrate: [0, 1000, 500, 1000, 500, 1000],
                // Same time-sensitive escalation as tonight's reminder so
                // future-night Tahajjud alerts also break through Do Not Disturb.
                interruptionLevel: 'timeSensitive',
                data: { type: 'tahajjud', prayer: 'tahajjud' },
                // Only the at-time alert (the gate is actually open) gets the
                // "Log" action — logging from the earlier "get ready" reminder
                // would be premature.
                ...(bufferMinutes === 0 && { categoryIdentifier: PRAYER_LOG_CATEGORY }),
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
            title: `${emoji} ${name} in ${offsetMinutes === 60 ? '1 hour' : `${offsetMinutes} min`}`,
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
async function internalSchedulePrayerNotification(prayerName: string, targetTime: Date, offsetMinutes: number = 0, idSuffix: string = '') {
    const now = new Date();
    const scheduleTime = new Date(targetTime.getTime() - offsetMinutes * 60 * 1000);
    const safetyMargin = 3 * 60 * 1000;

    if (scheduleTime <= new Date(now.getTime() + safetyMargin)) {
        log(`[DEBUG] Skipping ${prayerName}: too close or in past`);
        return;
    }

    const key = prayerName.toLowerCase();
    const content = PRAYER_CONTENT[key];
    const { title, body } = buildPrayerNotificationContent(prayerName, content, offsetMinutes, targetTime);

    // Scheduling is best-effort: a failure here (e.g. an OS/notification-channel
    // hiccup) must never propagate up into the caller's prayer-time-fetch try
    // block, which would otherwise misreport a successful prayer-time load as
    // "Failed to load prayer times". Mirrors internalScheduleTahajjudNotificationRaw.
    try {
        // Only cancel the previous notification for this exact key now that
        // we know a valid replacement is actually about to be scheduled —
        // cancelling any earlier (e.g. up front, before the safety-margin
        // check above) risked wiping out a still-valid, about-to-fire
        // notification on a rerun that then hit the safety margin and
        // returned early, permanently losing it.
        const idKey = `${NOTIFICATION_ID_KEY_PREFIX}${key}${idSuffix}`;
        const previousId = await AsyncStorage.getItem(idKey).catch(() => null);
        if (previousId) await Notifications.cancelScheduledNotificationAsync(previousId).catch(() => {});

        const notificationId = await Notifications.scheduleNotificationAsync({
            content: {
                title,
                body,
                priority: Notifications.AndroidNotificationPriority.HIGH,
                sound: 'default',
                // Without this, iOS silently delivers the notification with
                // no sound whenever any Focus mode is active (Sleep Focus
                // overnight is extremely common — and directly covers Fajr).
                // Tahajjud alerts already set this; daily prayer
                // notifications never did.
                interruptionLevel: 'timeSensitive',
                data: { type: 'prayer', prayer: key },
                // Only the at-time notification (offset 0) gets the "Log" action —
                // an early reminder fires before the prayer window has opened.
                ...(offsetMinutes === 0 && { categoryIdentifier: PRAYER_LOG_CATEGORY }),
            },
            trigger: {
                type: Notifications.SchedulableTriggerInputTypes.DATE,
                date: scheduleTime,
                ...(Platform.OS === 'android' && { channelId: 'prayers' }),
            },
        });

        // idSuffix keeps the early-reminder notification's id in a separate
        // storage key from the on-time one (see scheduleAllPrayerNotifications)
        // — without it, scheduling both for the same prayer would have the
        // second call's id silently overwrite the first's, permanently
        // orphaning whichever was scheduled first (never cancellable again).
        await AsyncStorage.setItem(idKey, notificationId);
        log(`[DEBUG] ${prayerName} scheduled for ${scheduleTime.toLocaleString()} (${offsetMinutes} min before)`);
    } catch (e) {
        log(`[DEBUG] Failed to schedule ${prayerName} notification:`, e);
    }
}
