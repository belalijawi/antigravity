import React, { useEffect, useState } from "react";
import { View, Text, ActivityIndicator, StyleSheet, TouchableOpacity, Alert, AppState, AppStateStatus } from "react-native";
import * as Location from "expo-location";
import { BlurView } from 'expo-blur';
import { getPrayerTimes } from "../lib/api";
import { calculateLastThird, NightCalculation, PrayerTimes } from "../lib/prayer-times";
import { Moon, Bell, BellOff } from "lucide-react-native";
import { LinearGradient } from 'expo-linear-gradient';
import { PrayerCard } from "./PrayerCard";
import { format } from "date-fns";
import {
    requestNotificationPermissions,
    scheduleTahajjudNotification,
    cancelTahajjudNotification,
    isNotificationEnabled
} from "../utils/notifications";
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../context/ThemeContext';

export function NightCalculator() {
    const { colors } = useTheme();
    const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
    const [prayerTimes, setPrayerTimes] = useState<PrayerTimes | null>(null);
    const [nightCalc, setNightCalc] = useState<NightCalculation | null>(null);
    const [loading, setLoading] = useState<boolean>(true);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const [currentTime, setCurrentTime] = useState<Date>(new Date());
    const [notificationEnabled, setNotificationEnabled] = useState<boolean>(false);
    const [selectedBuffer, setSelectedBuffer] = useState<number>(30); // Default 30 mins
    const [selectedMethod, setSelectedMethod] = useState<number>(2); // Default ISNA

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
            let { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
                setErrorMsg('Permission to access location was denied. Using Makkah.');
                setLocation({ lat: 21.4225, lng: 39.8262 });
                return;
            }
            let location = await Location.getCurrentPositionAsync({
                accuracy: Location.Accuracy.High
            });
            setLocation({
                lat: location.coords.latitude,
                lng: location.coords.longitude
            });
        } catch (error) {
            console.error('Error fetching location:', error);
            if (!location) setErrorMsg('Unable to fetch location.');
        }
    };

    useEffect(() => {
        if (!location) return;
        async function fetchData() {
            setLoading(true);
            try {
                const today = new Date();
                const times = await getPrayerTimes(location!.lat, location!.lng, today, selectedMethod);
                setPrayerTimes(times);
                const tomorrow = new Date(today);
                tomorrow.setDate(tomorrow.getDate() + 1);
                const tomorrowTimes = await getPrayerTimes(location!.lat, location!.lng, tomorrow, selectedMethod);
                const calc = calculateLastThird(times.maghrib, tomorrowTimes.fajr);
                setNightCalc(calc);
            } catch (err) {
                console.error(err);
                setErrorMsg("Failed to load prayer times");
            } finally {
                setLoading(false);
            }
        }
        fetchData();
    }, [location]);

    useEffect(() => {
        checkNotificationStatus();
    }, []);

    const checkNotificationStatus = async () => {
        const enabled = await isNotificationEnabled();
        setNotificationEnabled(enabled);
    };

    const handleToggleNotification = async () => {
        if (!nightCalc) return;
        if (notificationEnabled) {
            await cancelTahajjudNotification();
            setNotificationEnabled(false);
            Alert.alert('Reminder Disabled', 'Tahajjud reminder has been turned off.');
        } else {
            const hasPermission = await requestNotificationPermissions();
            if (!hasPermission) {
                Alert.alert('Permission Required', 'Please enable notifications in settings.');
                return;
            }
            let targetTime = new Date(nightCalc.lastThirdStart);
            if (targetTime < new Date()) targetTime.setDate(targetTime.getDate() + 1);
            const notificationId = await scheduleTahajjudNotification(targetTime, selectedBuffer);
            if (notificationId) {
                setNotificationEnabled(true);
                const wakeTime = new Date(targetTime.getTime() - selectedBuffer * 60 * 1000);
                Alert.alert('Reminder Set! 🌙', `You will be woken up at ${format(wakeTime, 'h:mm a')}\n(${selectedBuffer} mins before Last Third)`);
            }
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

            <View style={styles.mainDisplay}>
                <View style={styles.timeBadge}>
                    <Text style={styles.label}>Last Third Begins</Text>
                    <Text style={[styles.timeText, { color: colors.accent }]}>{format(nightCalc.lastThirdStart, "h:mm a")}</Text>
                    <View style={styles.statusRow}>
                        <View style={[styles.pulseDot, (currentTime >= nightCalc.lastThirdStart && currentTime < nightCalc.nightEnd) && styles.pulseDotActive]} />
                        <Text style={styles.statusText}>{(currentTime >= nightCalc.lastThirdStart && currentTime < nightCalc.nightEnd) ? "Currently Active" : "Upcoming"}</Text>
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
                        {[15, 30, 45].map((mins) => (
                            <TouchableOpacity
                                key={mins}
                                style={[styles.bufferTab, selectedBuffer === mins && styles.bufferTabActive]}
                                onPress={() => {
                                    setSelectedBuffer(mins);
                                    AsyncStorage.setItem('tahajjud_buffer_minutes', mins.toString());
                                    if (notificationEnabled && nightCalc) {
                                        let targetTime = new Date(nightCalc.lastThirdStart);
                                        if (targetTime < new Date()) targetTime.setDate(targetTime.getDate() + 1);
                                        scheduleTahajjudNotification(targetTime, mins);
                                    }
                                }}
                            >
                                <Text style={[styles.bufferTabText, selectedBuffer === mins && styles.bufferTabTextActive]}>{mins}</Text>
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
                            const total = nightCalc.nightEnd.getTime() - prayerTimes.maghrib.getTime();
                            const elapsed = Math.max(0, Math.min(total, currentTime.getTime() - prayerTimes.maghrib.getTime()));
                            return Math.floor((elapsed / total) * 100) + "%";
                        })()}
                    </Text>
                </View>
                <View style={styles.progressBarBg}>
                    <LinearGradient
                        colors={[colors.accent, colors.accent + '80']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={[
                            styles.progressBarFill,
                            {
                                width: `${(() => {
                                    const total = nightCalc.nightEnd.getTime() - prayerTimes.maghrib.getTime();
                                    const elapsed = Math.max(0, Math.min(total, currentTime.getTime() - prayerTimes.maghrib.getTime()));
                                    return (elapsed / total) * 100;
                                })()}%` as any
                            }
                        ]}
                    />
                    {/* Last Third Marker */}
                    <View style={[styles.lastThirdMarker, { left: '66.6%' }]} />
                </View>
                <View style={styles.progressFooter}>
                    <Text style={styles.footerTime}>Maghrib • {format(prayerTimes.maghrib, "h:mm a")}</Text>
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
    footerTime: { fontSize: 8, color: '#475569', fontWeight: '700' }
});
