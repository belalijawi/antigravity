import React, { useEffect, useState } from "react";
import { View, Text, ActivityIndicator, StyleSheet, TouchableOpacity, Alert, AppState, AppStateStatus, Linking } from "react-native";
import * as Location from "expo-location";
import { BlurView } from 'expo-blur';
import { getPrayerTimes } from "../lib/api";
import { calculateLastThird, NightCalculation, PrayerTimes } from "../lib/prayer-times";
import { Moon, Bell, BellOff } from "lucide-react-native";
import { LinearGradient } from 'expo-linear-gradient';
import { PrayerCard } from "./PrayerCard";
import { format } from "date-fns";
import { isNotificationEnabled, requestNotificationPermissions, scheduleAllPrayerNotifications, cancelNotification, NOTIFICATION_ENABLED_KEY } from '../utils/notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../context/ThemeContext';

export function NightCalculator({ onNightCalcReady, refreshKey }: { onNightCalcReady?: (calc: NightCalculation) => void, refreshKey?: number } = {}) {
    const { colors } = useTheme();
    const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
    const [prayerTimes, setPrayerTimes] = useState<PrayerTimes | null>(null);
    const [nightCalc, setNightCalc] = useState<NightCalculation | null>(null);
    const [loading, setLoading] = useState<boolean>(true);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const [locationDenied, setLocationDenied] = useState<boolean>(false);
    const [currentTime, setCurrentTime] = useState<Date>(new Date());
    const [notificationEnabled, setNotificationEnabled] = useState<boolean>(false);
    const [selectedBuffer, setSelectedBuffer] = useState<number>(0); // Default to 0 (at the time)
    const [selectedMethod, setSelectedMethod] = useState<number>(2); // Default ISNA
    const [lastScheduledKey, setLastScheduledKey] = useState<string | null>(null);
    const [internalRefresh, setInternalRefresh] = useState(0);

    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 60000);
        return () => clearInterval(timer);
    }, []);

    useEffect(() => {
        fetchLocation();
        const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
            if (nextAppState === 'active') {
                fetchLocation();
            }
        });
        return () => subscription.remove();
    }, []);

    useEffect(() => {
        AsyncStorage.getItem('tahajjud_buffer_minutes').then(val => {
            if (val) setSelectedBuffer(parseInt(val, 10));
        });
        AsyncStorage.getItem('prayer_calculation_method').then(val => {
            if (val) setSelectedMethod(parseInt(val, 10));
        });
    }, []);

    const fetchLocation = async () => {
        try {
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
                setLocationDenied(true);
                // Fall back to Makkah so prayer times still work
                setLocation({ lat: 21.4225, lng: 39.8262 });
                return;
            }
            setLocationDenied(false);
            const loc = await Location.getCurrentPositionAsync({
                accuracy: Location.Accuracy.High
            });
            setLocation({
                lat: loc.coords.latitude,
                lng: loc.coords.longitude
            });
        } catch (error) {
            console.error('Error fetching location:', error);
            if (!location) {
                setLocationDenied(true);
                setLocation({ lat: 21.4225, lng: 39.8262 });
            }
        }
    };

    useEffect(() => {
        if (!location) return;
        async function fetchData() {
            setLoading(true);
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

                setPrayerTimes(activeTimes);
                const calc = calculateLastThird(nightStart, nightEnd);
                setNightCalc(calc);
                onNightCalcReady?.(calc);

                // Schedule all enabled prayer notifications (Daily + Tahajjud)
                const allPrayers = await AsyncStorage.getItem('notification_all_prayers_enabled');
                const isEnabled = allPrayers === 'true';

                const tahajjudEnabled = await AsyncStorage.getItem(NOTIFICATION_ENABLED_KEY);
                const isTahajjudEnabled = tahajjudEnabled === 'true';

                // Prevent duplicate scheduling if nothing changed
                const currentKey = `${JSON.stringify(activeTimes)}_${isEnabled}_${isTahajjudEnabled}_${selectedBuffer}`;
                if (currentKey !== lastScheduledKey) {
                    await scheduleAllPrayerNotifications(activeTimes, isEnabled, {
                        enabled: isTahajjudEnabled,
                        buffer: selectedBuffer,
                        targetTime: new Date(calc.lastThirdStart)
                    });
                    setLastScheduledKey(currentKey);
                    console.log(`[DEBUG] Unified notifications scheduled for ${today.toDateString()}`);
                }
            } catch (err) {
                console.error(err);
                setErrorMsg("Failed to load prayer times");
            } finally {
                setLoading(false);
            }
        }
        fetchData();
    }, [location, refreshKey, selectedMethod, selectedBuffer, internalRefresh]);

    useEffect(() => {
        checkNotificationStatus();
    }, [internalRefresh]);

    const checkNotificationStatus = async () => {
        const enabled = await AsyncStorage.getItem(NOTIFICATION_ENABLED_KEY);
        setNotificationEnabled(enabled === 'true');
    };

    const handleToggleNotification = async () => {
        if (!nightCalc) return;
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
                return;
            }
            await AsyncStorage.setItem(NOTIFICATION_ENABLED_KEY, 'true');
            setNotificationEnabled(true);
            setLastScheduledKey(null); // Force re-sync that will include Tahajjud
            // Trigger local refresh to run fetchData again with the new enabled state
            setInternalRefresh(prev => prev + 1);

            const targetTime = new Date(nightCalc.lastThirdStart);
            const wakeTime = new Date(targetTime.getTime() - selectedBuffer * 60 * 1000);
            Alert.alert('Reminder Set! 🌙', `You will be woken up at ${format(wakeTime, 'h:mm a')}\n(${selectedBuffer} mins before Last Third)`);
        }
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
                    <Text style={styles.label}>Last Third Begins</Text>
                    <Text style={[styles.timeText, { color: colors.accent }]}>{format(nightCalc.lastThirdStart, "h:mm a")}</Text>
                    <View style={styles.statusRow}>
                        <View style={[styles.pulseDot, (currentTime >= nightCalc.lastThirdStart && currentTime < nightCalc.nightEnd) && styles.pulseDotActive]} />
                        <Text style={[styles.statusText, (currentTime >= nightCalc.lastThirdStart && currentTime < nightCalc.nightEnd) && { color: colors.accent }]}>
                            {(currentTime >= nightCalc.lastThirdStart && currentTime < nightCalc.nightEnd) ? "The Gate is Open" : "Upcoming"}
                        </Text>
                    </View>
                </View>

                <View style={styles.actionColumn}>
                    <TouchableOpacity
                        style={[styles.alarmButton, notificationEnabled && styles.alarmButtonActive]}
                        onPress={handleToggleNotification}
                    >
                        <BlurView intensity={20} tint="dark" style={StyleSheet.absoluteFill} />
                        {notificationEnabled ? <Bell size={16} color="#fff" fill="#fff" /> : <BellOff size={16} color="#94a3b8" />}
                        <Text style={[styles.alarmButtonText, notificationEnabled && styles.alarmButtonTextActive]}>
                            {notificationEnabled ? "On" : "Set"}
                        </Text>
                    </TouchableOpacity>

                    <View style={styles.prepRow}>
                        {[0, 15, 30, 45].map((mins) => (
                            <TouchableOpacity
                                key={mins}
                                style={[styles.bufferTab, selectedBuffer === mins && styles.bufferTabActive]}
                                onPress={() => {
                                    setSelectedBuffer(mins);
                                    AsyncStorage.setItem('tahajjud_buffer_minutes', mins.toString());
                                    if (notificationEnabled) {
                                        setLastScheduledKey(null); // Force re-sync
                                        setInternalRefresh(prev => prev + 1);
                                    }
                                }}
                            >
                                <Text style={[styles.bufferTabText, selectedBuffer === mins && styles.bufferTabTextActive]}>
                                    {mins === 0 ? "Now" : mins}
                                </Text>
                            </TouchableOpacity>
                        ))}
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

            {/* Premium Touch: Night Progress Bar */}
            <View style={styles.progressArea}>
                <View style={styles.progressHeader}>
                    <Text style={styles.progressLabel}>Night Flow</Text>
                    <Text style={styles.progressValue}>
                        {(() => {
                            const total = nightCalc.nightEnd.getTime() - nightCalc.nightStart.getTime();
                            const elapsed = Math.max(0, Math.min(total, currentTime.getTime() - nightCalc.nightStart.getTime()));
                            return Math.floor((elapsed / total) * 100) + "%";
                        })()}
                    </Text>
                </View>
                <View style={styles.progressBarBg}>
                    {(() => {
                        const total = nightCalc.nightEnd.getTime() - nightCalc.nightStart.getTime();
                        const elapsed = Math.max(0, Math.min(total, currentTime.getTime() - nightCalc.nightStart.getTime()));
                        const progress = (elapsed / total) * 100;
                        const isLastThird = currentTime >= nightCalc.lastThirdStart && currentTime < nightCalc.nightEnd;
                        const markerPos = ((nightCalc.lastThirdStart.getTime() - nightCalc.nightStart.getTime()) / total) * 100;

                        return (
                            <>
                                <LinearGradient
                                    colors={isLastThird ? [colors.accent, '#f8fafc'] : [colors.accent, colors.accent + '80']}
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 0 }}
                                    style={[
                                        styles.progressBarFill,
                                        { width: `${progress}%` as any }
                                    ]}
                                />
                                {/* Dynamic Last Third Marker */}
                                <View style={[styles.lastThirdMarker, { left: `${markerPos}%` }]} />
                            </>
                        );
                    })()}
                </View>
                <View style={styles.progressFooter}>
                    <Text style={styles.footerTime}>Maghrib • {format(nightCalc.nightStart, "h:mm a")}</Text>
                    <Text style={[styles.footerTime, { color: colors.accent }]}>Tahajjud Zone</Text>
                    <Text style={styles.footerTime}>{format(nightCalc.nightEnd, "h:mm a")} • Fajr</Text>
                </View>
            </View>
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
    label: { fontSize: 9, color: '#cbd5e1', fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 2 },
    timeText: { fontSize: 36, fontWeight: '900', letterSpacing: -1 },
    statusRow: { flexDirection: 'row', alignItems: 'center', marginTop: 2, gap: 5 },
    pulseDot: { width: 5, height: 5, borderRadius: 2.5, backgroundColor: '#475569' },
    pulseDotActive: { backgroundColor: '#f8fafc' },
    statusText: { fontSize: 10, color: '#cbd5e1', fontWeight: '700' },
    actionColumn: { alignItems: 'flex-end', gap: 8 },
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
    bufferTabActive: { backgroundColor: 'rgba(248, 250, 252, 0.1)', borderColor: 'rgba(248, 250, 252, 0.2)' },
    bufferTabText: { fontSize: 9, color: '#64748b', fontWeight: '900' },
    bufferTabTextActive: { color: '#f8fafc' },
    gridContainer: { flexDirection: 'row', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginBottom: 24 },
    progressArea: { marginTop: 10 },
    progressHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 8 },
    progressLabel: { fontSize: 9, color: '#64748b', fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1 },
    progressValue: { fontSize: 10, color: '#cbd5e1', fontWeight: '800' },
    progressBarBg: { height: 4, backgroundColor: 'rgba(255, 255, 255, 0.05)', borderRadius: 2, overflow: 'hidden', position: 'relative' },
    progressBarFill: { height: '100%', borderRadius: 2 },
    lastThirdMarker: { position: 'absolute', top: 0, bottom: 0, width: 2, backgroundColor: 'rgba(255, 255, 255, 0.2)', zIndex: 1 },
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
});
