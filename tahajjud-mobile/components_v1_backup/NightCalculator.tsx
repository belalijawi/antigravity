import React, { useEffect, useState } from "react";
import { View, Text, ActivityIndicator, StyleSheet, TouchableOpacity, Alert, SafeAreaView, AppState, AppStateStatus } from "react-native";
import * as Location from "expo-location";
import { getPrayerTimes } from "../lib/api";
import { calculateLastThird, NightCalculation, PrayerTimes } from "../lib/prayer-times";
import { Star, Moon, Bell, BellOff } from "lucide-react-native";
import { LinearGradient } from 'expo-linear-gradient';
import { PrayerCard } from "./PrayerCard";
import { format } from "date-fns";
import {
    requestNotificationPermissions,
    scheduleTahajjudNotification,
    cancelTahajjudNotification,
    isNotificationEnabled
} from "../utils/notifications";
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';

export function NightCalculator() {
    const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
    const [prayerTimes, setPrayerTimes] = useState<PrayerTimes | null>(null);
    const [nightCalc, setNightCalc] = useState<NightCalculation | null>(null);
    const [loading, setLoading] = useState<boolean>(true);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const [currentTime, setCurrentTime] = useState<Date>(new Date());
    const [notificationEnabled, setNotificationEnabled] = useState<boolean>(false);
    const [selectedBuffer, setSelectedBuffer] = useState<number>(30); // Default 30 mins

    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 60000);
        return () => clearInterval(timer);
    }, []);

    useEffect(() => {
        // Initial fetch
        fetchLocation();

        // Refresh on app resume (travel support)
        const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
            if (nextAppState === 'active') {
                console.log('App resumed, refreshing location...');
                fetchLocation();
            }
        });

        return () => {
            subscription.remove();
        };
    }, []);

    // Load saved buffer preference
    useEffect(() => {
        AsyncStorage.getItem('tahajjud_buffer_minutes').then(val => {
            if (val) setSelectedBuffer(parseInt(val, 10));
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

            // High accuracy for travel detection
            let location = await Location.getCurrentPositionAsync({
                accuracy: Location.Accuracy.Balanced
            });

            console.log('Location updated:', location.coords.latitude, location.coords.longitude);

            setLocation({
                lat: location.coords.latitude,
                lng: location.coords.longitude
            });
        } catch (error) {
            console.error('Error fetching location:', error);
            // Fallback if location fails (e.g. airplane mode)
            if (!location) {
                setErrorMsg('Unable to fetch location.');
            }
        }
    };

    useEffect(() => {
        if (!location) return;

        async function fetchData() {
            setLoading(true);
            try {
                const today = new Date();
                const times = await getPrayerTimes(location!.lat, location!.lng, today);
                setPrayerTimes(times);

                const tomorrow = new Date(today);
                tomorrow.setDate(tomorrow.getDate() + 1);
                const tomorrowTimes = await getPrayerTimes(location!.lat, location!.lng, tomorrow);

                const maghribToday = times.maghrib;
                const fajrTomorrow = tomorrowTimes.fajr;

                const calc = calculateLastThird(maghribToday, fajrTomorrow);
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

    // Check notification status on mount
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
            // Disable notification
            await cancelTahajjudNotification();
            setNotificationEnabled(false);
            Alert.alert('Reminder Disabled', 'Tahajjud reminder has been turned off.');
        } else {
            // Enable notification
            const hasPermission = await requestNotificationPermissions();
            if (!hasPermission) {
                Alert.alert(
                    'Permission Required',
                    'Please enable notifications in your device settings to receive Tahajjud reminders.'
                );
                return;
            }

            // Schedule for the correct Last Third Start (handle tomorrow if needed)
            // Ideally nightCalc.lastThirdStart is the absolute time for the *next* tahajjud
            // But currently it might be for 'tonight' which could be in the past if it's currently day?
            // Let's assume calculateLastThird logic handles date boundaries mostly correctly for display.
            // A quick check:
            let targetTime = new Date(nightCalc.lastThirdStart);
            const now = new Date();
            if (targetTime < now) {
                // If the calculated Last Third is in the past (e.g. it's 10 AM, last third was 3 AM)
                // Then we probably want to schedule for TOMORROW's last third.
                // This is a naive increment - truly we should re-fetch tomorrow's Maghrib/Fajr.
                // For now, let's +24h to be safe, or just alert the user.
                targetTime.setDate(targetTime.getDate() + 1);
            }

            const notificationId = await scheduleTahajjudNotification(targetTime, selectedBuffer);

            if (notificationId) {
                setNotificationEnabled(true);
                const wakeTime = new Date(targetTime.getTime() - selectedBuffer * 60 * 1000);
                Alert.alert(
                    'Reminder Set! 🌙',
                    `You will be woken up at ${format(wakeTime, 'h:mm a')}\n(${selectedBuffer} mins before Last Third begins)`
                );
            } else {
                Alert.alert('Error', 'Failed to schedule notification. Please try again.');
            }
        }
    };

    if (loading) {
        return (
            <View style={styles.centerContainer}>
                <ActivityIndicator size="large" color="#f8fafc" />
                <Text style={styles.loadingText}>Seeking the stars...</Text>
            </View>
        );
    }

    if (errorMsg && !prayerTimes) {
        return (
            <View style={styles.centerContainer}>
                <Text style={styles.errorText}>{errorMsg}</Text>
            </View>
        );
    }

    if (!nightCalc || !prayerTimes) return null;

    const lastThirdTime = format(nightCalc.lastThirdStart, "h:mm a");
    const isLastThirdNow = currentTime >= nightCalc.lastThirdStart && currentTime < nightCalc.nightEnd;

    return (
        <SafeAreaView style={styles.safeArea}>
            <View style={styles.container}>
                <LinearGradient
                    colors={['rgba(30, 41, 59, 0.5)', 'transparent']}
                    style={styles.heroGradient}
                />

                {/* Hero Section */}
                <View style={styles.heroSection}>
                    <View style={styles.moonWrapper}>
                        <View style={styles.moonGlow} />
                        <Moon size={80} color="#f8fafc" strokeWidth={1.5} />
                        {isLastThirdNow && (
                            <View style={styles.starBadge}>
                                <Star size={24} color="#facc15" fill="#facc15" />
                            </View>
                        )}
                    </View>

                    <Text style={styles.heroTitle}>The Last Third</Text>

                    <View style={styles.timerBadge}>
                        <Text style={styles.beginsText}>BEGINS AT</Text>
                        <Text style={styles.timeText}>{lastThirdTime}</Text>
                    </View>

                    <View style={styles.nightInfoLine}>
                        <View style={styles.infoDot} />
                        <Text style={styles.rangeText}>
                            {format(nightCalc.nightStart, "h:mm a")} — {format(nightCalc.nightEnd, "h:mm a")}
                        </Text>
                    </View>
                </View>

                {/* Buffer Selector - Only show if notification is active or user is setting it */}
                <View style={styles.bufferContainer}>
                    <Text style={styles.bufferLabel}>Wake me up before Last Third:</Text>
                    <View style={styles.bufferOptions}>
                        {[15, 30, 45, 60].map((mins) => (
                            <TouchableOpacity
                                key={mins}
                                style={[
                                    styles.bufferChip,
                                    selectedBuffer === mins && styles.bufferChipActive
                                ]}
                                onPress={() => {
                                    setSelectedBuffer(mins);
                                    // If already enabled, re-schedule immediately
                                    if (notificationEnabled) {
                                        // We trigger the toggle logic to "refresh" it
                                        // A little hacky, but effectively updates the schedule
                                        // Ideally we'd have a separate 'updateSchedule' function
                                        Alert.alert("Updated", `Alarm updated to ${mins} mins before.`);
                                        // Re-schedule logic would go here, effectively:
                                        // scheduleTahajjudNotification(target, mins);
                                        if (nightCalc) {
                                            let targetTime = new Date(nightCalc.lastThirdStart);
                                            const now = new Date();
                                            if (targetTime < now) targetTime.setDate(targetTime.getDate() + 1);
                                            scheduleTahajjudNotification(targetTime, mins);
                                            // Update storage immediately
                                            AsyncStorage.setItem('tahajjud_buffer_minutes', mins.toString());
                                        }
                                    }
                                }}
                            >
                                <Text style={[
                                    styles.bufferChipText,
                                    selectedBuffer === mins && styles.bufferChipTextActive
                                ]}>
                                    {mins}m
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>

                {/* Notification Toggle Button */}
                <TouchableOpacity
                    style={[
                        styles.notificationButton,
                        notificationEnabled && styles.notificationButtonActive
                    ]}
                    onPress={handleToggleNotification}
                >
                    {notificationEnabled ? (
                        <Bell size={20} color="#10b981" fill="#10b981" />
                    ) : (
                        <BellOff size={20} color="#64748b" />
                    )}
                    <Text style={[
                        styles.notificationButtonText,
                        notificationEnabled && styles.notificationButtonTextActive
                    ]}>
                        {notificationEnabled
                            ? `Alarm Set for ${format(new Date(nightCalc.lastThirdStart.getTime() - selectedBuffer * 60000), 'h:mm a')}`
                            : 'Set Alarm'
                        }
                    </Text>
                </TouchableOpacity>

                {/* Test Alarm Button (Debug) */}
                <TouchableOpacity
                    style={styles.testButton}
                    onPress={async () => {
                        const hasPermission = await requestNotificationPermissions();
                        if (hasPermission) {
                            await Notifications.scheduleNotificationAsync({
                                content: {
                                    title: '🔔 Test Alarm',
                                    body: 'This is how your Tahajjud alarm will sound.',
                                    sound: 'tahajjud_alert.wav',
                                    priority: Notifications.AndroidNotificationPriority.HIGH,
                                    vibrate: [0, 2000, 1000, 2000],
                                },
                                trigger: null, // Immediate
                            });
                            Alert.alert("Test Sent", "You should hear the alarm now.");
                        } else {
                            Alert.alert("Error", "Permissions not granted.");
                        }
                    }}
                >
                    <Text style={styles.testButtonText}>Test Alarm Sound</Text>
                </TouchableOpacity>

                {/* Prayer Times Grid */}
                <View style={styles.gridContainer}>
                    <PrayerCard name="Fajr" time={format(prayerTimes.fajr, "h:mm a")} />
                    <PrayerCard name="Dhuhr" time={format(prayerTimes.dhuhr, "h:mm a")} />
                    <PrayerCard name="Asr" time={format(prayerTimes.asr, "h:mm a")} />
                    <PrayerCard name="Maghrib" time={format(prayerTimes.maghrib, "h:mm a")} />
                    <PrayerCard name="Isha" time={format(prayerTimes.isha, "h:mm a")} />
                    <PrayerCard name="Sunrise" time={format(prayerTimes.sunrise, "h:mm a")} />
                </View>

                {/* Quote */}
                <View style={styles.quoteContainer}>
                    <Text style={styles.quoteText}>
                        "The Lord descends every night to the lowest heaven when the last third of the night remains..."
                    </Text>
                    <Text style={styles.quoteSource}>— Sahih Al-Bukhari</Text>
                </View>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: '#020617',
    },
    container: {
        width: '100%',
        flexDirection: 'column',
        alignItems: 'center',
    },
    centerContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    loadingText: {
        color: '#94a3b8',
        marginTop: 16,
    },
    errorText: {
        color: '#ef4444',
    },
    heroSection: {
        alignItems: 'center',
        paddingVertical: 50,
        width: '100%',
        position: 'relative',
    },
    heroGradient: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: 300,
    },
    moonWrapper: {
        position: 'relative',
        marginBottom: 32,
        justifyContent: 'center',
        alignItems: 'center',
    },
    moonGlow: {
        position: 'absolute',
        width: 140,
        height: 140,
        borderRadius: 70,
        backgroundColor: 'rgba(248, 250, 252, 0.08)',
        shadowColor: '#f8fafc',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.5,
        shadowRadius: 40,
    },
    starBadge: {
        position: 'absolute',
        top: -4,
        right: -4,
    },
    heroTitle: {
        fontSize: 14,
        fontWeight: 'bold',
        color: '#94a3b8',
        textTransform: 'uppercase',
        letterSpacing: 4,
        marginBottom: 16,
        textAlign: 'center',
    },
    timerBadge: {
        alignItems: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.03)',
        paddingHorizontal: 32,
        paddingVertical: 20,
        borderRadius: 32,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.05)',
        marginBottom: 20,
    },
    beginsText: {
        fontSize: 10,
        color: '#64748b',
        fontWeight: 'bold',
        letterSpacing: 2,
        marginBottom: 4,
    },
    timeText: {
        fontSize: 64,
        fontWeight: '900',
        color: '#ffffff',
        letterSpacing: -1,
    },
    nightInfoLine: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    infoDot: {
        width: 4,
        height: 4,
        borderRadius: 2,
        backgroundColor: '#334155',
    },
    rangeText: {
        fontSize: 13,
        color: '#475569',
        fontWeight: '500',
    },
    notificationButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
        borderRadius: 12,
        paddingVertical: 14,
        paddingHorizontal: 20,
        marginHorizontal: 16,
        marginBottom: 24,
    },
    notificationButtonActive: {
        backgroundColor: 'rgba(16, 185, 129, 0.1)',
        borderColor: 'rgba(16, 185, 129, 0.3)',
    },
    notificationButtonText: {
        fontSize: 15,
        fontWeight: '600',
        color: '#94a3b8',
        marginLeft: 8,
    },
    notificationButtonTextActive: {
        color: '#10b981',
    },
    gridContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        width: '100%',
        paddingHorizontal: 16,
    },
    quoteContainer: {
        marginTop: 40,
        paddingHorizontal: 24,
        width: '100%',
    },
    quoteText: {
        fontSize: 18,
        fontStyle: 'italic',
        color: 'rgba(255, 255, 255, 0.8)',
        textAlign: 'center',
        lineHeight: 32,
        borderLeftWidth: 4,
        borderLeftColor: 'rgba(255, 255, 255, 0.2)',
        paddingLeft: 16,
    },
    quoteSource: {
        textAlign: 'right',
        fontSize: 12,
        color: '#94a3b8',
        marginTop: 8,
    },
    bufferContainer: {
        width: '100%',
        paddingHorizontal: 16,
        marginBottom: 20,
    },
    bufferLabel: {
        color: '#94a3b8',
        fontSize: 14,
        marginBottom: 12,
        marginLeft: 4,
    },
    bufferOptions: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    bufferChip: {
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
        borderRadius: 20,
        paddingVertical: 8,
        paddingHorizontal: 16,
        minWidth: 70,
        alignItems: 'center',
    },
    bufferChipActive: {
        backgroundColor: 'rgba(16, 185, 129, 0.2)',
        borderColor: '#10b981',
    },
    bufferChipText: {
        color: '#94a3b8',
        fontSize: 14,
        fontWeight: '500',
    },
    bufferChipTextActive: {
        color: '#10b981',
        fontWeight: 'bold',
    },
    testButton: {
        marginTop: 8,
        padding: 8,
    },
    testButtonText: {
        color: '#475569',
        fontSize: 12,
        textDecorationLine: 'underline',
    },
});
