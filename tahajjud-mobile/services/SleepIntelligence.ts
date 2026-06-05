import { Platform, DeviceEventEmitter } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { subDays, addMinutes, differenceInMinutes } from 'date-fns';

/**
 * Smart sleep scheduler for Tahajjud.
 *
 * Uses HealthKit (iOS) to read the user's actual sleep duration and
 * suggests a bedtime that lands them in the blessed last third of the
 * night, with enough rest to be functional.
 *
 * Falls back to a self-reported "I usually sleep N hours" when HealthKit
 * is unavailable (Android, or user-declined permission).
 *
 * Privacy: HealthKit data never leaves the device. We compute on-device
 * and never ship raw sleep timestamps anywhere.
 */

const PREF_ENABLED_KEY = 'sleep-intel-enabled-v1';
const PREF_FALLBACK_HOURS_KEY = 'sleep-intel-fallback-hours-v1';
const PREF_BEDTIME_NOTIF_ID_KEY = 'sleep-intel-bedtime-notif-id-v1';

// Lazy native import — react-native-health is iOS-only and may be absent in dev
let AppleHealthKit: any = null;
let HKConstants: any = null;
try {
    if (Platform.OS === 'ios') {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const mod = require('react-native-health');
        AppleHealthKit = mod.default ?? mod;
        HKConstants = mod.HealthKit?.Constants ?? mod.AppleHealthKit?.Constants ?? mod.Constants;
    }
} catch {
    AppleHealthKit = null;
}

export interface SleepSuggestion {
    /** Suggested bedtime tonight as a Date */
    bedtime: Date;
    /** Suggested wake time (midpoint of last third, capped) */
    suggestedWake: Date;
    /** Average sleep duration in minutes (rounded) */
    avgSleepMinutes: number;
    /** Source of the duration estimate */
    source: 'healthkit' | 'self-reported' | 'default';
    /** Number of nights of HealthKit data used (0 if not HealthKit) */
    nightsAnalyzed: number;
}

const DEFAULT_FALLBACK_HOURS = 6.5;
const MIN_SLEEP_MINUTES = 4 * 60;   // never suggest less than 4h
const MAX_SLEEP_MINUTES = 9 * 60;   // never suggest more than 9h

export const SleepIntelligence = {
    /** True if the device exposes HealthKit and the lib loaded. */
    isHealthKitAvailable(): boolean {
        return Platform.OS === 'ios' && AppleHealthKit != null;
    },

    async getEnabled(): Promise<boolean> {
        const v = await AsyncStorage.getItem(PREF_ENABLED_KEY);
        return v === 'true';
    },

    async setEnabled(enabled: boolean): Promise<void> {
        await AsyncStorage.setItem(PREF_ENABLED_KEY, enabled ? 'true' : 'false');
        // Notify subscribers (e.g. BedtimeCard) so the UI updates instantly
        // without waiting for a tab switch / remount.
        DeviceEventEmitter.emit('sleepIntelChanged', enabled);
    },

    async getFallbackHours(): Promise<number> {
        const v = await AsyncStorage.getItem(PREF_FALLBACK_HOURS_KEY);
        return v ? parseFloat(v) : DEFAULT_FALLBACK_HOURS;
    },

    async setFallbackHours(hours: number): Promise<void> {
        const clamped = Math.max(4, Math.min(10, hours));
        await AsyncStorage.setItem(PREF_FALLBACK_HOURS_KEY, String(clamped));
    },

    /**
     * Asks for HealthKit permission. Returns true if the user grants it.
     * iOS only — no-op on Android.
     */
    async requestHealthPermission(): Promise<boolean> {
        if (!this.isHealthKitAvailable()) return false;
        return new Promise(resolve => {
            const permissions = {
                permissions: {
                    read: [HKConstants?.Permissions?.SleepAnalysis ?? 'SleepAnalysis'],
                    write: [],
                },
            };
            AppleHealthKit.initHealthKit(permissions, (err: any) => {
                if (err) {
                    console.log('[SleepIntel] HealthKit init error:', err);
                    resolve(false);
                    return;
                }
                resolve(true);
            });
        });
    },

    /**
     * Computes the user's average sleep duration over the past N days.
     * Returns minutes. If HealthKit is unavailable or returns nothing,
     * falls back to the user's self-reported value.
     */
    async getAvgSleepMinutes(days: number = 14): Promise<{ minutes: number; source: SleepSuggestion['source']; nights: number }> {
        // Try HealthKit
        if (this.isHealthKitAvailable()) {
            try {
                const result = await this.queryHealthKitSleep(days);
                if (result && result.minutes >= MIN_SLEEP_MINUTES && result.minutes <= MAX_SLEEP_MINUTES) {
                    return { minutes: result.minutes, source: 'healthkit', nights: result.nights };
                }
            } catch (e) {
                console.log('[SleepIntel] HealthKit query failed, falling back', e);
            }
        }
        // Fall back to user-reported hours
        const hours = await this.getFallbackHours();
        return { minutes: Math.round(hours * 60), source: 'self-reported', nights: 0 };
    },

    queryHealthKitSleep(days: number): Promise<{ minutes: number; nights: number } | null> {
        return new Promise(resolve => {
            if (!AppleHealthKit) return resolve(null);
            const opts = {
                startDate: subDays(new Date(), days).toISOString(),
                endDate: new Date().toISOString(),
            };
            AppleHealthKit.getSleepSamples(opts, (err: any, results: any[]) => {
                if (err || !results || results.length === 0) {
                    resolve(null);
                    return;
                }
                // Group samples by night so a sleep that crosses midnight is
                // attributed to a single night. Convention: the night the user
                // *fell asleep*. Samples that start in the early morning
                // (before noon) are part of the previous night.
                //
                //   23:00 Mon → bucket "Mon"  (slept Monday night)
                //   02:00 Tue → bucket "Mon"  (still Monday's sleep, just after midnight)
                //   13:00 Tue → bucket "Tue"  (a nap on Tuesday afternoon, ignored anyway)
                const nightMinutes: Record<string, number> = {};
                for (const s of results) {
                    // Older HealthKit values: 'INBED' | 'ASLEEP'
                    // Newer (iOS 16+): 'ASLEEP_CORE' | 'ASLEEP_DEEP' | 'ASLEEP_REM' | 'AWAKE' | 'INBED'
                    const v = (s.value || '').toUpperCase();
                    const isAsleep = v === 'ASLEEP'
                        || v === 'ASLEEP_CORE'
                        || v === 'ASLEEP_DEEP'
                        || v === 'ASLEEP_REM'
                        || v === 'ASLEEP_UNSPECIFIED';
                    if (!isAsleep) continue;
                    const start = new Date(s.startDate);
                    const end = new Date(s.endDate);
                    const dur = (end.getTime() - start.getTime()) / 60000;
                    if (dur <= 0 || dur > 16 * 60) continue;

                    // Bucket: if start.hour < noon → previous day. Otherwise → that day.
                    const bucketDate = start.getHours() < 12
                        ? subDays(start, 1)
                        : start;
                    const bucket = bucketDate.toISOString().slice(0, 10);
                    nightMinutes[bucket] = (nightMinutes[bucket] ?? 0) + dur;
                }
                const values = Object.values(nightMinutes).filter(v => v >= MIN_SLEEP_MINUTES && v <= MAX_SLEEP_MINUTES);
                if (values.length === 0) {
                    resolve(null);
                    return;
                }
                const avg = values.reduce((a, b) => a + b, 0) / values.length;
                resolve({ minutes: Math.round(avg), nights: values.length });
            });
        });
    },

    /**
     * Compute tonight's suggested bedtime — designed around the BIPHASIC
     * sleep pattern that's actually realistic for working/family life:
     *
     *   1. Go to sleep early enough that your MAIN sleep block runs straight
     *      through to ~35 min before Fajr.
     *   2. Wake briefly, do wudu + Tahajjud (~25 min), pray Fajr.
     *   3. Go BACK TO SLEEP for the remaining ~30% of your usual nightly
     *      sleep so you wake up properly rested at your normal hour.
     *
     * Why split 70 / 30? Most people's "morning wake-up" is around 6–8 AM.
     * If Fajr is at 4:40 AM and they average 7h sleep, the bulk of that
     * (about 4h30m–5h) happens before Tahajjud and a shorter ~2h block
     * happens after Fajr — landing them at ~7 AM naturally. No one is
     * expected to stay awake from 4 AM onwards.
     */
    suggestBedtime(
        lastThirdStart: Date,
        fajr: Date,
        avgSleepMinutes: number
    ): SleepSuggestion {
        // 35 min before Fajr: ~5 min to wake/wudu, ~25 min for Tahajjud,
        // ~5 min buffer before Fajr starts.
        const TAHAJJUD_WINDOW_MIN = 35;
        let suggestedWake = addMinutes(fajr, -TAHAJJUD_WINDOW_MIN);

        // Safety: if Fajr − 35 min somehow falls before the last third starts
        // (very short night, e.g. high-latitude summer), at least stay inside
        // the last third by capping to the latest possible point.
        if (suggestedWake < lastThirdStart) {
            suggestedWake = addMinutes(fajr, -10); // even tighter window
        }

        // Total sleep clamped to the [4h, 9h] sanity window.
        const sleepMin = Math.max(MIN_SLEEP_MINUTES, Math.min(MAX_SLEEP_MINUTES, avgSleepMinutes));

        // Split sleep: ~70% BEFORE Tahajjud, the rest AFTER Fajr. This way
        // bedtime isn't unrealistically early AND the user gets a "back to
        // sleep" window between Fajr and their normal morning wake-up.
        const PRE_TAHAJJUD_FRACTION = 0.7;
        const preTahajjudSleep = Math.round(sleepMin * PRE_TAHAJJUD_FRACTION);
        let bedtime = addMinutes(suggestedWake, -preTahajjudSleep);

        // If bedtime ended up before noon (yesterday-spillover edge case), bump forward
        // to just before suggested wake. This shouldn't happen in practice.
        const today = new Date();
        if (bedtime < addMinutes(today, -16 * 60)) {
            bedtime = addMinutes(suggestedWake, -6 * 60);
        }

        return {
            bedtime,
            suggestedWake,
            avgSleepMinutes: sleepMin,
            source: 'default',
            nightsAnalyzed: 0,
        };
    },

    /**
     * One-call helper: return the full suggestion using HealthKit (or fallback).
     * Components on Home should use this.
     */
    async getSuggestion(lastThirdStart: Date, fajr: Date): Promise<SleepSuggestion> {
        const { minutes, source, nights } = await this.getAvgSleepMinutes(14);
        const base = this.suggestBedtime(lastThirdStart, fajr, minutes);
        return { ...base, source, nightsAnalyzed: nights };
    },
};
