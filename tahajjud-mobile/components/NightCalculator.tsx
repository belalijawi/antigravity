import React, { useEffect, useState } from "react";
import Animated, { useSharedValue, useAnimatedStyle, withRepeat, withSequence, withTiming, cancelAnimation, Easing } from 'react-native-reanimated';
import { View, Text, ActivityIndicator, StyleSheet, TouchableOpacity, Alert, AppState, AppStateStatus, Linking, DeviceEventEmitter, Modal, TextInput, KeyboardAvoidingView, Platform } from "react-native";
import * as Location from "expo-location";
import { BlurView } from 'expo-blur';
import { getPrayerTimes } from "../lib/api";
import { calculateLastThird, NightCalculation, PrayerTimes } from "../lib/prayer-times";
import { Moon, Bell, BellOff, Plus, X } from "lucide-react-native";
import { LinearGradient } from 'expo-linear-gradient';
import { PrayerCard } from "./PrayerCard";
import { format, addDays } from "date-fns";
import { isNotificationEnabled, requestNotificationPermissions, scheduleAllPrayerNotifications, scheduleFutureTahajjudNotifications, scheduleFuturePrayerNotifications, cancelNotification, NOTIFICATION_ENABLED_KEY } from '../utils/notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../context/ThemeContext';
import { updateWidget } from '../utils/widgetBridge';
import { usePurchases } from '../context/PurchasesContext';
import { localDateStr } from '../utils/localDate';
import { mosqueTimeToDate } from '../utils/mosqueTimetable';

export function NightCalculator({ onNightCalcReady, onPrayerTimesReady, refreshKey }: { onNightCalcReady?: (calc: NightCalculation) => void, onPrayerTimesReady?: (times: PrayerTimes) => void, refreshKey?: number } = {}) {
    const { colors } = useTheme();
    const { isPremium, openPaywall } = usePurchases();
    const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
    const [prayerTimes, setPrayerTimes] = useState<PrayerTimes | null>(null);
    const [nightCalc, setNightCalc] = useState<NightCalculation | null>(null);
    const [loading, setLoading] = useState<boolean>(true);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const [locationDenied, setLocationDenied] = useState<boolean>(false);
    const [currentTime, setCurrentTime] = useState<Date>(new Date());
    const [notificationEnabled, setNotificationEnabled] = useState<boolean>(false);
    const [buffers, setBuffers] = useState<number[]>([15]); // Array of reminder offsets in minutes
    const [selectedMethod, setSelectedMethod] = useState<number>(2); // Default ISNA
    const [lastScheduledKey, setLastScheduledKey] = useState<string | null>(null);
    const [internalRefresh, setInternalRefresh] = useState(0);
    const [showBufferModal, setShowBufferModal] = useState(false);
    const [editingBufferIdx, setEditingBufferIdx] = useState<number | null>(null);
    const [bufferInput, setBufferInput] = useState('');
    const [prayerReminderOffset, setPrayerReminderOffset] = useState(0);
    // Track whether we've completed at least one successful load so subsequent
    // silent re-fetches (offset/method/buffer changes) don't flash the spinner.
    const hasLoadedRef = React.useRef(false);

    // Listen for offset changes from Settings
    useEffect(() => {
        const loadOffset = async () => {
            const raw = await AsyncStorage.getItem('prayer_reminder_offset');
            const val = raw ? parseInt(raw, 10) : 0;
            if (val !== prayerReminderOffset) {
                setPrayerReminderOffset(val);
                setLastScheduledKey(null); // force reschedule
            }
        };
        loadOffset();
        const sub = DeviceEventEmitter.addListener('prayerReminderOffsetChanged', loadOffset);
        // When the user picks a new calc method in Settings, refresh times
        // immediately — the main effect re-runs whenever selectedMethod changes.
        const methodSub = DeviceEventEmitter.addListener('prayerMethodChanged', (id: number) => {
            if (typeof id === 'number' && id !== selectedMethod) {
                setSelectedMethod(id);
                setLastScheduledKey(null);
            }
        });
        // When the user imports/clears a mosque timetable, reload times immediately
        const mosqueSub = DeviceEventEmitter.addListener('mosqueTimetableUpdated', () => {
            setInternalRefresh(p => p + 1);
        });
        return () => { sub.remove(); methodSub.remove(); mosqueSub.remove(); };
    }, [selectedMethod]);
    const [cityName, setCityName] = useState<string | null>(null);

    // Derived: are we currently in the last third?
    const isLastThird = !!(nightCalc && currentTime >= nightCalc.lastThirdStart && currentTime < nightCalc.nightEnd);

    // Pulsing dot animation when the gate is open
    const dotScale   = useSharedValue(1);
    const dotOpacity = useSharedValue(1);

    useEffect(() => {
        if (isLastThird) {
            dotScale.value = withRepeat(
                withSequence(withTiming(1.9, { duration: 900 }), withTiming(1.0, { duration: 900 })),
                -1, false,
            );
            dotOpacity.value = withRepeat(
                withSequence(withTiming(0.3, { duration: 900 }), withTiming(1.0, { duration: 900 })),
                -1, false,
            );
        } else {
            cancelAnimation(dotScale); cancelAnimation(dotOpacity);
            dotScale.value   = withTiming(1, { duration: 400 });
            dotOpacity.value = withTiming(1, { duration: 400 });
        }
    }, [isLastThird]);

    const dotAnimStyle = useAnimatedStyle(() => ({
        transform: [{ scale: dotScale.value }],
        opacity: dotOpacity.value,
    }));

    // Animated progress width (0–100)
    const progressAnim = useSharedValue(0);

    const progressWidthStyle = useAnimatedStyle(() => ({
        width: `${progressAnim.value}%` as any,
    }));

    // Shimmer sweep across Night Flow bar
    const shimmerX    = useSharedValue(-60);
    const barGlow     = useSharedValue(0);

    // Real-time bar fill: runs one continuous animation from current progress → lastThird marker
    useEffect(() => {
        if (!nightCalc || isLastThird) return;

        const total            = nightCalc.nightEnd.getTime() - nightCalc.nightStart.getTime();
        const elapsed          = Math.max(0, Date.now() - nightCalc.nightStart.getTime());
        const currentPct       = Math.min((elapsed / total) * 100, 100);
        const lastThirdPct     = ((nightCalc.lastThirdStart.getTime() - nightCalc.nightStart.getTime()) / total) * 100;
        const msToLastThird    = Math.max(0, nightCalc.lastThirdStart.getTime() - Date.now());

        // Snap to current real position immediately, then fill linearly until last third
        progressAnim.value = currentPct;
        if (msToLastThird > 0) {
            progressAnim.value = withTiming(lastThirdPct, {
                duration: msToLastThird,
                easing: Easing.linear,
            });
        }
    }, [nightCalc]);

    useEffect(() => {
        if (isLastThird) {
            // Animate bar to 100% when gate opens
            progressAnim.value = withTiming(100, { duration: 1200, easing: Easing.out(Easing.cubic) });
            // Sweep left → right endlessly
            shimmerX.value = -60;
            shimmerX.value = withRepeat(
                withTiming(400, { duration: 1800, easing: Easing.inOut(Easing.quad) }),
                -1, false,
            );
            // Bar background glow pulse
            barGlow.value = withRepeat(
                withSequence(
                    withTiming(1, { duration: 1200 }),
                    withTiming(0.2, { duration: 1200 }),
                ),
                -1, false,
            );
        } else {
            cancelAnimation(shimmerX);
            cancelAnimation(barGlow);
            shimmerX.value = -60;
            barGlow.value  = withTiming(0, { duration: 500 });
        }
    }, [isLastThird]);

    const shimmerStyle = useAnimatedStyle(() => ({
        transform: [{ translateX: shimmerX.value }],
    }));

    const barGlowStyle = useAnimatedStyle(() => ({
        shadowOpacity: barGlow.value * 0.7,
        shadowRadius:  4 + barGlow.value * 8,
    }));

    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 60000);
        return () => clearInterval(timer);
    }, []);

    useEffect(() => {
        let watchSub: Location.LocationSubscription | null = null;

        const start = async () => {
            await fetchLocation();

            // Watch for movement while app is open — only fires when user moves >1 km
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status === 'granted') {
                watchSub = await Location.watchPositionAsync(
                    {
                        accuracy: Location.Accuracy.Balanced,
                        distanceInterval: 1000, // metres — only fires after 1 km of movement
                        timeInterval: 5 * 60 * 1000, // no more than once every 5 minutes
                    },
                    async (loc) => {
                        await applyNewLocation(loc.coords.latitude, loc.coords.longitude);
                    }
                );
            }
        };

        start();

        // Throttle foreground re-fetches — Android fires AppState 'active' on
        // every focus change (keyboard, system bar, biometric prompt). Without
        // this throttle, every brief refocus triggered a GPS call + prayer-times
        // re-fetch + loading spinner flicker.
        let lastFetchAt = 0;
        const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
            if (nextAppState === 'active') {
                const now = Date.now();
                if (now - lastFetchAt < 60_000) return; // skip if last fetch was <60s ago
                lastFetchAt = now;
                fetchLocation();
            }
        });

        return () => {
            subscription.remove();
            watchSub?.remove();
        };
    }, []);

    useEffect(() => {
        (async () => {
            try {
                const val = await AsyncStorage.getItem('tahajjud_buffers');
                if (val) {
                    try {
                        const parsed = JSON.parse(val);
                        if (Array.isArray(parsed)) setBuffers(parsed);
                    } catch { /* corrupted — keep default [15] */ }
                } else {
                    const old = await AsyncStorage.getItem('tahajjud_buffer_minutes').catch(() => null);
                    const saved = old ? parseInt(old, 10) : 15;
                    setBuffers([isNaN(saved) ? 15 : saved]);
                }
            } catch { /* ignore storage error */ }

            try {
                const val = await AsyncStorage.getItem('prayer_calculation_method');
                if (val) {
                    const m = parseInt(val, 10);
                    if (!isNaN(m)) setSelectedMethod(m);
                }
            } catch { /* ignore storage error */ }
        })();
    }, []);

    const saveBuffers = async (next: number[]) => {
        setBuffers(next);
        await AsyncStorage.setItem('tahajjud_buffers', JSON.stringify(next));
        if (notificationEnabled) { setLastScheduledKey(null); setInternalRefresh(p => p + 1); }
    };

    // Silently prefetch and cache prayer times for the next 6 nights,
    // then schedule wake-up + daily prayer notifications so they fire without an app open.
    const prefetchFutureNights = async (
        lat: number, lng: number, method: number, remindBuffers: number[],
        tahajjudEnabled: boolean, allPrayersEnabled: boolean
    ) => {
        try {
            const tahajjudNights: { targetTime: Date; buffer: number }[] = [];
            const futurePrayers: { name: string; time: Date }[] = [];

            for (let i = 1; i <= 6; i++) {
                const night = addDays(new Date(), i);
                const nextDay = addDays(new Date(), i + 1);
                const [nightTimes, nextDayTimes] = await Promise.all([
                    getPrayerTimes(lat, lng, night, method),
                    getPrayerTimes(lat, lng, nextDay, method),
                ]);
                if (tahajjudEnabled) {
                    const calc = calculateLastThird(nightTimes.maghrib, nextDayTimes.fajr);
                    for (const buf of remindBuffers) {
                        tahajjudNights.push({ targetTime: new Date(calc.lastThirdStart), buffer: buf });
                    }
                }
                if (allPrayersEnabled) {
                    futurePrayers.push(
                        { name: 'Fajr',    time: nightTimes.fajr },
                        { name: 'Dhuhr',   time: nightTimes.dhuhr },
                        { name: 'Asr',     time: nightTimes.asr },
                        { name: 'Maghrib', time: nightTimes.maghrib },
                        { name: 'Isha',    time: nightTimes.isha },
                    );
                }
            }

            if (tahajjudNights.length > 0) await scheduleFutureTahajjudNotifications(tahajjudNights);
            if (futurePrayers.length > 0)  await scheduleFuturePrayerNotifications(futurePrayers);

            console.log(`[DEBUG] Pre-scheduled ${tahajjudNights.length} Tahajjud + ${futurePrayers.length} daily prayers for next 6 days`);
        } catch (err) {
            console.warn('[DEBUG] prefetchFutureNights failed (non-critical):', err);
        }
    };

    // Haversine distance in km between two coordinates
    const distanceKm = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
        const R = 6371;
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a = Math.sin(dLat / 2) ** 2 +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
        return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    };

    // Reverse geocode to get a readable city name
    const resolveCityName = async (lat: number, lng: number): Promise<string | null> => {
        try {
            const results = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
            if (results.length > 0) {
                const r = results[0];
                return r.city || r.subregion || r.region || r.country || null;
            }
        } catch {}
        return null;
    };

    const applyNewLocation = async (lat: number, lng: number) => {
        const prevLoc = location;

        // Round to ~111m precision (3 decimal places of lat/lng). Without this,
        // every AppState foreground event (frequent on Android, fires on keyboard
        // open / status bar focus) creates a fresh location object reference even
        // when the coordinates are effectively identical → triggers prayer-times
        // re-fetch → loading spinner flicker. Skip when location hasn't meaningfully moved.
        if (prevLoc) {
            const SAME_LOCATION_THRESHOLD_KM = 0.05; // 50 metres
            const moved = distanceKm(prevLoc.lat, prevLoc.lng, lat, lng);
            if (moved < SAME_LOCATION_THRESHOLD_KM) {
                // Same spot — don't re-set state, don't re-geocode.
                return;
            }
        }

        const movedFar = prevLoc
            ? distanceKm(prevLoc.lat, prevLoc.lng, lat, lng) > 30
            : false;

        setLocation({ lat, lng });

        // Reverse geocode city name
        const city = await resolveCityName(lat, lng);
        setCityName(city);

        // If user travelled >30 km, force notification reschedule for new location
        if (movedFar) {
            setLastScheduledKey(null);
            console.log(`[DEBUG] Significant location change detected (>30km). Rescheduling notifications.`);
        }
    };

    const fetchLocation = async () => {
        try {
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
                setLocationDenied(true);
                setLocation({ lat: 21.4225, lng: 39.8262 });
                setCityName('Makkah');
                return;
            }
            setLocationDenied(false);
            const loc = await Location.getCurrentPositionAsync({
                accuracy: Location.Accuracy.Balanced,
            });
            await applyNewLocation(loc.coords.latitude, loc.coords.longitude);
        } catch (error) {
            console.error('Error fetching location:', error);
            if (!location) {
                setLocationDenied(true);
                setLocation({ lat: 21.4225, lng: 39.8262 });
                setCityName('Makkah');
            }
        }
    };

    useEffect(() => {
        if (!location) return;
        let cancelled = false;
        async function fetchData() {
            if (!hasLoadedRef.current) setLoading(true);
            try {
                const today = new Date();
                const todayTimes = await getPrayerTimes(location!.lat, location!.lng, today, selectedMethod);

                let nightStart: Date;
                let nightEnd: Date;
                let activeTimes: PrayerTimes;

                if (today < todayTimes.fajr) {
                    const yesterday = new Date(today);
                    yesterday.setDate(yesterday.getDate() - 1);
                    const yesterdayTimes = await getPrayerTimes(location!.lat, location!.lng, yesterday, selectedMethod);
                    nightStart = yesterdayTimes.maghrib;
                    nightEnd = todayTimes.fajr;
                    activeTimes = todayTimes;
                } else {
                    const tomorrow = new Date(today);
                    tomorrow.setDate(tomorrow.getDate() + 1);
                    const tomorrowTimes = await getPrayerTimes(location!.lat, location!.lng, tomorrow, selectedMethod);
                    nightStart = todayTimes.maghrib;
                    nightEnd = tomorrowTimes.fajr;
                    activeTimes = todayTimes;
                }

                // Override with mosque timetable if available for today.
                // Load the full timetable once to avoid 3 separate AsyncStorage reads.
                // Pass the correct calendar date to mosqueTimeToDate so adjacent-day
                // times (yesterday's Maghrib, tomorrow's Fajr) are on the right date.
                const { getMosqueTimetable: loadMosqueTimetable } = await import('../utils/mosqueTimetable');
                const mosqueTimetable = await loadMosqueTimetable();
                const todayKey = localDateStr(today);
                const mosqueTimes = mosqueTimetable?.times[todayKey] ?? null;

                if (mosqueTimes) {
                    activeTimes = {
                        ...activeTimes,
                        fajr:    mosqueTimeToDate(mosqueTimes.fajr,    today),
                        dhuhr:   mosqueTimeToDate(mosqueTimes.dhuhr,   today),
                        asr:     mosqueTimeToDate(mosqueTimes.asr,     today),
                        maghrib: mosqueTimeToDate(mosqueTimes.maghrib, today),
                        isha:    mosqueTimeToDate(mosqueTimes.isha,    today),
                    };

                    if (today < todayTimes.fajr) {
                        // Before Fajr: nightEnd = today's mosque Fajr (correct date ✓)
                        nightEnd = mosqueTimeToDate(mosqueTimes.fajr, today);
                        // nightStart = yesterday's mosque Maghrib ON YESTERDAY'S DATE
                        const yesterday = new Date(today);
                        yesterday.setDate(yesterday.getDate() - 1);
                        const yMosque = mosqueTimetable?.times[localDateStr(yesterday)] ?? null;
                        if (yMosque) nightStart = mosqueTimeToDate(yMosque.maghrib, yesterday);
                    } else {
                        // After Fajr: nightStart = tonight's mosque Maghrib (correct date ✓)
                        nightStart = mosqueTimeToDate(mosqueTimes.maghrib, today);
                        // nightEnd = tomorrow's mosque Fajr ON TOMORROW'S DATE
                        const tomorrow = new Date(today);
                        tomorrow.setDate(tomorrow.getDate() + 1);
                        const tMosque = mosqueTimetable?.times[localDateStr(tomorrow)] ?? null;
                        if (tMosque) nightEnd = mosqueTimeToDate(tMosque.fajr, tomorrow);
                    }
                }

                if (cancelled) return;
                hasLoadedRef.current = true;
                setPrayerTimes(activeTimes);
                onPrayerTimesReady?.(activeTimes);
                // Cache today's prayer times so any screen (e.g. Tracker) can
                // gate "you can't log a prayer that hasn't happened yet" logic
                // without holding its own copy of location / calc method.
                try {
                    await AsyncStorage.setItem('prayer_times_today_v1', JSON.stringify({
                        date: localDateStr(new Date()),
                        fajr: activeTimes.fajr.toISOString(),
                        sunrise: activeTimes.sunrise.toISOString(),
                        dhuhr: activeTimes.dhuhr.toISOString(),
                        asr: activeTimes.asr.toISOString(),
                        maghrib: activeTimes.maghrib.toISOString(),
                        isha: activeTimes.isha.toISOString(),
                    }));
                    DeviceEventEmitter.emit('prayerTimesUpdated');
                } catch { /* ignore */ }
                const calc = calculateLastThird(nightStart, nightEnd);
                setNightCalc(calc);
                onNightCalcReady?.(calc);

                // Update home screen widget with latest prayer times, streak & Tahajjud time
                updateWidget(activeTimes, new Date(calc.lastThirdStart)).catch(() => {});

                // Schedule all enabled prayer notifications (Daily + Tahajjud)
                const allPrayers = await AsyncStorage.getItem('notification_all_prayers_enabled');
                const isEnabled = allPrayers === 'true';

                const tahajjudEnabled = await AsyncStorage.getItem(NOTIFICATION_ENABLED_KEY);
                const isTahajjudEnabled = tahajjudEnabled === 'true';

                // Prevent duplicate scheduling if nothing changed
                const currentKey = `${JSON.stringify(activeTimes)}_${isEnabled}_${isTahajjudEnabled}_${JSON.stringify(buffers)}_${prayerReminderOffset}`;
                if (currentKey !== lastScheduledKey) {
                    await scheduleAllPrayerNotifications(activeTimes, isEnabled, {
                        enabled: isTahajjudEnabled,
                        buffers,
                        targetTime: new Date(calc.lastThirdStart)
                    });
                    setLastScheduledKey(currentKey);
                    console.log(`[DEBUG] Unified notifications scheduled for ${today.toDateString()}`);

                    // Pre-fetch + schedule the next 6 nights so the alarm fires even if
                    // the user doesn't open the app every day.
                    if (isTahajjudEnabled || isEnabled) {
                        prefetchFutureNights(location!.lat, location!.lng, selectedMethod, buffers, isTahajjudEnabled, isEnabled);
                    }
                }
            } catch (err: any) {
                if (cancelled) return;
                console.error(err);
                const msg = err?.message ?? String(err);
                if (msg.includes('Network request failed') || msg.includes('aborted') || err?.name === 'AbortError') {
                    setErrorMsg("Can't reach prayer-times server. Check your internet and try again.");
                } else {
                    setErrorMsg("Failed to load prayer times");
                }
            } finally {
                if (!cancelled) setLoading(false);
            }
        }
        fetchData();
        return () => { cancelled = true; };
        // Depend on primitive lat/lng values rather than the location object —
        // otherwise any new object reference (even same coordinates) re-triggers
        // the entire prayer-times fetch and causes the loading flicker loop on
        // Android. Same logic for buffers: serialize to string so a same-content
        // array doesn't re-trigger when AsyncStorage rehydrates it on cold start.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [location?.lat, location?.lng, refreshKey, selectedMethod, JSON.stringify(buffers), internalRefresh, prayerReminderOffset]);

    useEffect(() => {
        checkNotificationStatus();
    }, [internalRefresh]);

    const checkNotificationStatus = async () => {
        const enabled = await AsyncStorage.getItem(NOTIFICATION_ENABLED_KEY);
        setNotificationEnabled(enabled === 'true');
    };

    const [isTogglingNotif, setIsTogglingNotif] = React.useState(false);
    const handleToggleNotification = async () => {
        if (!nightCalc || isTogglingNotif) return;
        setIsTogglingNotif(true);
        if (notificationEnabled) {
            await cancelNotification('tahajjud');
            await AsyncStorage.setItem(NOTIFICATION_ENABLED_KEY, 'false');
            setNotificationEnabled(false);
            setLastScheduledKey(null); // Force re-sync
            Alert.alert('Reminder Disabled', 'Tahajjud reminder has been turned off.');
        } else {
            const hasPermission = await requestNotificationPermissions();
            if (!hasPermission) {
                Alert.alert('Permission Required', 'Please enable notifications in settings.');
                setIsTogglingNotif(false);
                return;
            }
            await AsyncStorage.setItem(NOTIFICATION_ENABLED_KEY, 'true');
            setNotificationEnabled(true);
            setLastScheduledKey(null); // Force re-sync that will include Tahajjud
            // Trigger local refresh to run fetchData again with the new enabled state
            setInternalRefresh(prev => prev + 1);

            const targetTime = new Date(nightCalc.lastThirdStart);
            const reminderLines = buffers
                .slice()
                .sort((a, b) => b - a)
                .map(b => {
                    const t = new Date(targetTime.getTime() - b * 60 * 1000);
                    return `• ${format(t, 'h:mm a')}${b > 0 ? ` (${b} min before)` : ' (at start)'}`;
                })
                .join('\n');
            Alert.alert('Reminder Set! 🌙', `Reminders scheduled:\n${reminderLines}`);
        }
        setIsTogglingNotif(false);
    };

    if (loading) return (
        <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color="#f8fafc" />
            <Text style={styles.loadingText}>Seeking the stars...</Text>
        </View>
    );

    if (errorMsg && !prayerTimes) return (
        <View style={styles.centerContainer}>
            <Text style={styles.errorText}>{errorMsg}</Text>
            <TouchableOpacity
                onPress={() => { setErrorMsg(null); setInternalRefresh(p => p + 1); }}
                style={{ marginTop: 12, paddingHorizontal: 20, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' }}
            >
                <Text style={{ color: '#94a3b8', fontSize: 13 }}>Try again</Text>
            </TouchableOpacity>
        </View>
    );

    if (!nightCalc || !prayerTimes) return null;

    return (
        <View style={styles.container}>
            <LinearGradient
                colors={['rgba(6, 182, 212, 0.1)', 'rgba(79, 70, 229, 0.05)', 'transparent']}
                style={StyleSheet.absoluteFill}
            />
            <BlurView intensity={20} tint="dark" style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.3)' }]} />

            {/* Location Permission Warning Banner */}
            {locationDenied && (
                <View style={styles.locationWarning}>
                    <View style={styles.locationWarningContent}>
                        <Text style={styles.locationWarningIcon}>📍</Text>
                        <View style={styles.locationWarningText}>
                            <Text style={styles.locationWarningTitle}>Location Access Needed</Text>
                            <Text style={styles.locationWarningBody}>
                                Prayer times are calculated using Makkah. Enable location for accurate local times.
                            </Text>
                        </View>
                    </View>
                    <TouchableOpacity
                        style={styles.locationWarningButton}
                        onPress={() => Linking.openSettings()}
                    >
                        <Text style={styles.locationWarningButtonText}>Open Settings</Text>
                    </TouchableOpacity>
                </View>
            )}

            <View style={styles.mainDisplay}>
                <View style={styles.timeBadge}>
                    <View style={styles.labelRow}>
                        <Text style={styles.label}>Last Third Begins</Text>
                        {cityName && (
                            <TouchableOpacity onPress={fetchLocation} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                                <Text style={styles.cityBadge}>📍 {cityName}</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                    <Text style={[styles.timeText, { color: colors.accent }]}>{format(nightCalc.lastThirdStart, "h:mm a")}</Text>
                    <View style={styles.statusRow}>
                        <Animated.View style={[styles.pulseDot, isLastThird && styles.pulseDotActive, dotAnimStyle]} />
                        <Text style={[styles.statusText, isLastThird && { color: colors.accent, fontWeight: '800', letterSpacing: 0.5 }]}>
                            {isLastThird ? "The Gate is Open" : "Upcoming"}
                        </Text>
                    </View>
                </View>

                <View style={styles.actionColumn}>
                    <TouchableOpacity
                        style={[styles.alarmButton, notificationEnabled && styles.alarmButtonActive]}
                        onPress={handleToggleNotification}
                        disabled={isTogglingNotif}
                    >
                        <BlurView intensity={20} tint="dark" style={StyleSheet.absoluteFill} />
                        {notificationEnabled ? <Bell size={16} color="#fff" fill="#fff" /> : <BellOff size={16} color="#94a3b8" />}
                        <Text style={[styles.alarmButtonText, notificationEnabled && styles.alarmButtonTextActive]}>
                            {notificationEnabled ? "On" : "Set"}
                        </Text>
                    </TouchableOpacity>

                    <View style={styles.buffersRow}>
                        {buffers.map((buf, idx) => (
                            <View key={idx} style={[styles.bufferChip, { borderColor: colors.accent + '55' }]}>
                                {/* − */}
                                <TouchableOpacity
                                    onPress={() => {
                                        const next = [...buffers];
                                        next[idx] = Math.max(0, next[idx] - 5);
                                        saveBuffers(next);
                                    }}
                                    hitSlop={{ top: 6, bottom: 6, left: 6, right: 2 }}
                                >
                                    <Text style={styles.chipStepper}>−</Text>
                                </TouchableOpacity>

                                {/* value — tap to type custom */}
                                <TouchableOpacity
                                    onPress={() => {
                                        setEditingBufferIdx(idx);
                                        setBufferInput(buf.toString());
                                        setShowBufferModal(true);
                                    }}
                                >
                                    <Text style={[styles.chipValue, { color: colors.accent }]}>
                                        {buf === 0 ? '0' : `${buf}m`}
                                    </Text>
                                </TouchableOpacity>

                                {/* + */}
                                <TouchableOpacity
                                    onPress={() => {
                                        const next = [...buffers];
                                        next[idx] = Math.min(120, next[idx] + 5);
                                        saveBuffers(next);
                                    }}
                                    hitSlop={{ top: 6, bottom: 6, left: 2, right: 6 }}
                                >
                                    <Text style={styles.chipStepper}>+</Text>
                                </TouchableOpacity>

                                {/* × delete — only when >1 reminder */}
                                {buffers.length > 1 && (
                                    <TouchableOpacity
                                        onPress={() => saveBuffers(buffers.filter((_, i) => i !== idx))}
                                        hitSlop={{ top: 6, bottom: 6, left: 4, right: 6 }}
                                        style={styles.chipDelete}
                                    >
                                        <X size={9} color="#475569" />
                                    </TouchableOpacity>
                                )}
                            </View>
                        ))}

                        {/* Add reminder — premium only */}
                        {buffers.length < 4 && (
                            <TouchableOpacity
                                style={[styles.addChipBtn, { borderColor: isPremium ? colors.accent + '44' : 'rgba(255,255,255,0.08)' }]}
                                onPress={() => isPremium ? saveBuffers([...buffers, 30]) : openPaywall()}
                            >
                                <Plus size={11} color={isPremium ? colors.accent : '#475569'} />
                            </TouchableOpacity>
                        )}
                    </View>
                </View>
            </View>

            <View style={styles.gridContainer}>
                <PrayerCard name="Fajr" time={format(nightCalc.nightEnd, "h:mm")} />
                <PrayerCard name="Sunrise" time={format(prayerTimes.sunrise, "h:mm")} />
                <PrayerCard name="Dhuhr" time={format(prayerTimes.dhuhr, "h:mm")} />
                <PrayerCard name="Asr" time={format(prayerTimes.asr, "h:mm")} />
                <PrayerCard name="Maghrib" time={format(prayerTimes.maghrib, "h:mm")} />
                <PrayerCard name="Isha" time={format(prayerTimes.isha, "h:mm")} />
            </View>

            {/* Night Flow Progress Bar */}
            {(() => {
                const total      = nightCalc.nightEnd.getTime() - nightCalc.nightStart.getTime();
                const elapsed    = Math.max(0, Math.min(total, currentTime.getTime() - nightCalc.nightStart.getTime()));
                const progress   = (elapsed / total) * 100;
                const markerPos  = ((nightCalc.lastThirdStart.getTime() - nightCalc.nightStart.getTime()) / total) * 100;


                return (
                    <View style={styles.progressArea}>
                        <View style={styles.progressHeader}>
                            <Text style={[styles.progressLabel, isLastThird && { color: colors.accent }]}>
                                Night Flow{isLastThird ? ' ✦' : ''}
                            </Text>
                            <Text style={[styles.progressValue, isLastThird && { color: colors.accent }]}>
                                {isLastThird ? '100%' : `${Math.min(100, Math.floor(progress))}%`}
                            </Text>
                        </View>

                        {/* Bar */}
                        <Animated.View style={[
                            styles.progressBarBg,
                            isLastThird && {
                                shadowColor: colors.accent,
                                shadowOffset: { width: 0, height: 0 },
                            },
                            barGlowStyle,
                        ]}>
                            {/* Fill — width driven by progressAnim */}
                            <Animated.View style={[styles.progressBarFill, progressWidthStyle]}>
                                <LinearGradient
                                    colors={isLastThird ? [colors.accent, colors.accent + '99'] : [colors.accent, colors.accent + '80']}
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 0 }}
                                    style={{ flex: 1 }}
                                />
                            </Animated.View>

                            {/* Shimmer sweep — only in last third */}
                            {isLastThird && (
                                <Animated.View style={[styles.shimmerBar, shimmerStyle]}>
                                    <LinearGradient
                                        colors={['transparent', 'rgba(255,255,220,0.65)', 'transparent']}
                                        start={{ x: 0, y: 0 }}
                                        end={{ x: 1, y: 0 }}
                                        style={{ width: 56, height: '100%' }}
                                    />
                                </Animated.View>
                            )}

                            {/* Last Third Marker */}
                            <View style={[
                                styles.lastThirdMarker,
                                { left: `${markerPos}%` as any },
                                isLastThird && { backgroundColor: colors.accent, width: 2 },
                            ]} />
                        </Animated.View>

                        <View style={styles.progressFooter}>
                            <Text style={styles.footerTime}>Maghrib • {format(nightCalc.nightStart, "h:mm a")}</Text>
                            <Text style={[styles.footerTime, { color: colors.accent, fontWeight: isLastThird ? '900' : '700' }]}>
                                {isLastThird ? '✦ Gate Open ✦' : 'Tahajjud Zone'}
                            </Text>
                            <Text style={styles.footerTime}>{format(nightCalc.nightEnd, "h:mm a")} • Fajr</Text>
                        </View>
                    </View>
                );
            })()}

            {/* In-app buffer time modal */}
            <Modal
                animationType="fade"
                transparent
                visible={showBufferModal}
                onRequestClose={() => setShowBufferModal(false)}
            >
                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                    style={styles.bufferModalOverlay}
                >
                    <View style={styles.bufferModalBox}>
                        <Text style={[styles.bufferModalTitle, { color: colors.primaryText }]}>Set Reminder</Text>
                        <Text style={[styles.bufferModalSub, { color: colors.secondaryText }]}>Minutes before Tahajjud begins</Text>

                        <View style={styles.bufferPresetRow}>
                            {[0, 5, 10, 15, 20, 30].map(mins => (
                                <TouchableOpacity
                                    key={mins}
                                    style={[
                                        styles.bufferPresetBtn,
                                        parseInt(bufferInput) === mins && { backgroundColor: colors.accent + '22', borderColor: colors.accent + '66' },
                                    ]}
                                    onPress={() => setBufferInput(mins.toString())}
                                >
                                    <Text style={[styles.bufferPresetText, { color: parseInt(bufferInput) === mins ? colors.accent : '#94a3b8' }]}>
                                        {mins === 0 ? 'At start' : `${mins}m`}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        <TextInput
                            style={[styles.bufferInput, { color: colors.primaryText, borderColor: colors.accent + '44' }]}
                            value={bufferInput}
                            onChangeText={setBufferInput}
                            keyboardType="number-pad"
                            placeholder="Custom (e.g. 45)"
                            placeholderTextColor="#475569"
                            selectTextOnFocus
                        />

                        <View style={styles.bufferModalActions}>
                            <TouchableOpacity
                                style={[styles.bufferModalBtn, { backgroundColor: 'rgba(255,255,255,0.06)' }]}
                                onPress={() => setShowBufferModal(false)}
                            >
                                <Text style={{ color: '#94a3b8', fontWeight: '700', fontSize: 15 }}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.bufferModalBtn, { backgroundColor: colors.accent }]}
                                onPress={() => {
                                    const val = parseInt(bufferInput, 10);
                                    if (!isNaN(val) && val >= 0 && val <= 240 && editingBufferIdx !== null) {
                                        const next = [...buffers];
                                        next[editingBufferIdx] = val;
                                        saveBuffers(next);
                                    }
                                    setShowBufferModal(false);
                                }}
                            >
                                <Text style={{ color: '#020617', fontWeight: '800', fontSize: 15 }}>Save</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </KeyboardAvoidingView>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { width: '100%', padding: 20 },
    centerContainer: { height: 200, alignItems: 'center', justifyContent: 'center' },
    loadingText: { color: '#64748b', marginTop: 12, fontSize: 11, letterSpacing: 1 },
    errorText: { color: '#ef4444', fontSize: 11 },
    mainDisplay: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
    timeBadge: { flex: 1 },
    labelRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 2 },
    label: { fontSize: 9, color: '#cbd5e1', fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1.5 },
    cityBadge: { fontSize: 9, color: '#64748b', fontWeight: '700' },
    timeText: { fontSize: 36, fontWeight: '900', letterSpacing: -1 },
    statusRow: { flexDirection: 'row', alignItems: 'center', marginTop: 2, gap: 5 },
    pulseDot: { width: 5, height: 5, borderRadius: 2.5, backgroundColor: '#475569' },
    pulseDotActive: { backgroundColor: '#f8fafc' },
    statusText: { fontSize: 10, color: '#cbd5e1', fontWeight: '700' },
    actionColumn: { alignItems: 'flex-end', gap: 6 },
    buffersRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'flex-end',
        gap: 5,
        maxWidth: 200,
    },
    bufferChip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 8,
        paddingVertical: 5,
        borderRadius: 10,
        borderWidth: 1,
        backgroundColor: 'rgba(255,255,255,0.05)',
    },
    chipStepper: {
        color: '#94a3b8',
        fontSize: 14,
        fontWeight: '300',
        lineHeight: 16,
    },
    chipValue: {
        fontSize: 11,
        fontWeight: '800',
        minWidth: 24,
        textAlign: 'center',
    },
    chipDelete: {
        marginLeft: 2,
    },
    addChipBtn: {
        width: 30,
        height: 30,
        borderRadius: 10,
        borderWidth: 1,
        backgroundColor: 'rgba(255,255,255,0.05)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    alarmButton: {
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 12,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
        minWidth: 80,
        justifyContent: 'center',
        overflow: 'hidden'
    },
    alarmButtonActive: { backgroundColor: 'rgba(248, 250, 252, 0.1)', borderColor: 'rgba(248, 250, 252, 0.3)' },
    alarmButtonText: { color: '#94a3b8', fontSize: 11, fontWeight: '900', textTransform: 'uppercase' },
    alarmButtonTextActive: { color: '#f8fafc' },
    prepRow: { flexDirection: 'row', gap: 4 },
    bufferTab: {
        width: 32,
        height: 24,
        borderRadius: 6,
        backgroundColor: 'rgba(255, 255, 255, 0.03)',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.05)'
    },
    stepperBtn: {
        width: 32,
        height: 28,
        borderRadius: 8,
        backgroundColor: 'rgba(255,255,255,0.06)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.12)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    stepperBtnText: {
        color: '#f8fafc',
        fontSize: 16,
        fontWeight: '300',
        lineHeight: 18,
    },
    stepperValue: {
        minWidth: 64,
        height: 28,
        borderRadius: 8,
        backgroundColor: 'rgba(255,255,255,0.08)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.15)',
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 8,
    },
    bufferTabActive: { backgroundColor: 'rgba(248, 250, 252, 0.1)', borderColor: 'rgba(248, 250, 252, 0.2)' },
    bufferTabText: { fontSize: 9, color: '#64748b', fontWeight: '900' },
    bufferTabTextActive: { color: '#f8fafc' },
    gridContainer: { flexDirection: 'row', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginBottom: 24 },
    progressArea: { marginTop: 10 },
    progressHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 8 },
    progressLabel: { fontSize: 9, color: '#64748b', fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1 },
    progressValue: { fontSize: 10, color: '#cbd5e1', fontWeight: '800' },
    progressBarBg: { height: 6, backgroundColor: 'rgba(255, 255, 255, 0.06)', borderRadius: 3, overflow: 'hidden', position: 'relative' },
    progressBarFill: { height: '100%', borderRadius: 3 },
    lastThirdMarker: { position: 'absolute', top: 0, bottom: 0, width: 2, backgroundColor: 'rgba(255, 255, 255, 0.2)', zIndex: 1 },
    shimmerBar: { position: 'absolute', top: 0, bottom: 0, width: 56, zIndex: 2 },
    progressFooter: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
    footerTime: { fontSize: 8, color: '#475569', fontWeight: '700' },
    locationWarning: {
        marginBottom: 16,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: 'rgba(251, 191, 36, 0.3)',
        backgroundColor: 'rgba(251, 191, 36, 0.08)',
        padding: 12,
        gap: 10,
    },
    locationWarningContent: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 10,
    },
    locationWarningIcon: {
        fontSize: 18,
        lineHeight: 22,
    },
    locationWarningText: {
        flex: 1,
        gap: 2,
    },
    locationWarningTitle: {
        fontSize: 12,
        fontWeight: '900',
        color: '#fbbf24',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    locationWarningBody: {
        fontSize: 11,
        color: '#94a3b8',
        fontWeight: '500',
        lineHeight: 16,
    },
    locationWarningButton: {
        alignSelf: 'flex-end',
        paddingHorizontal: 14,
        paddingVertical: 6,
        borderRadius: 8,
        backgroundColor: 'rgba(251, 191, 36, 0.15)',
        borderWidth: 1,
        borderColor: 'rgba(251, 191, 36, 0.4)',
    },
    locationWarningButtonText: {
        fontSize: 11,
        fontWeight: '900',
        color: '#fbbf24',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    bufferModalOverlay: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.65)',
        padding: 24,
    },
    bufferModalBox: {
        width: '100%',
        backgroundColor: '#0f172a',
        borderRadius: 24,
        padding: 24,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.08)',
        gap: 16,
    },
    bufferModalTitle: {
        fontSize: 20,
        fontWeight: '900',
    },
    bufferModalSub: {
        fontSize: 13,
        fontWeight: '500',
        marginTop: -10,
    },
    bufferPresetRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    bufferPresetBtn: {
        paddingHorizontal: 14,
        paddingVertical: 9,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.10)',
        backgroundColor: 'rgba(255,255,255,0.04)',
    },
    bufferPresetText: {
        fontSize: 13,
        fontWeight: '700',
    },
    bufferInput: {
        height: 48,
        borderWidth: 1,
        borderRadius: 14,
        paddingHorizontal: 16,
        fontSize: 18,
        fontWeight: '700',
        backgroundColor: 'rgba(255,255,255,0.04)',
        textAlign: 'center',
    },
    bufferModalActions: {
        flexDirection: 'row',
        gap: 10,
    },
    bufferModalBtn: {
        flex: 1,
        height: 48,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
    },
});
