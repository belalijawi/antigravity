import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Moon, Star, Sun, BookOpen, CheckCircle, Heart, Info, RotateCcw } from 'lucide-react-native';
import Svg, { Circle } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { format, differenceInDays } from 'date-fns';
import Animated, { FadeInUp, FadeInDown, useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import { useTheme } from '../context/ThemeContext';
import { getPrayerTimes } from '../lib/api';
import * as Location from 'expo-location';
import { haptic } from '../utils/haptic';
import { tabletContentStyle } from '../utils/layout';

interface GoalCardProps {
    title: string;
    value: number;
    icon: React.ComponentType<any>;
    onIncrement: () => void;
    onDecrement: () => void;
    target?: number;
    disabled?: boolean;
    disabledMessage?: string;
    accentColor: string;
}

function GoalCard({ title, value, icon: Icon, onIncrement, onDecrement, target = 30, disabled = false, disabledMessage, accentColor }: GoalCardProps) {
    const scale = useSharedValue(1);
    const progress = (value / target) * 100;
    const radius = 35;
    const circumference = 2 * Math.PI * radius;
    const strokeDashoffset = circumference - (progress / 100) * circumference;

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [{ scale: scale.value }]
    }));

    const handlePress = () => {
        if (disabled) {
            haptic.warning();
            Alert.alert("Already Logged", disabledMessage || "You have already logged this for today. Come back tomorrow! 🌙");
            return;
        }
        haptic.success();
        scale.value = withSpring(1.2, {}, () => {
            scale.value = withSpring(1);
        });
        onIncrement();
    };

    return (
        <TouchableOpacity
            onPress={handlePress}
            onLongPress={() => {
                haptic.medium();
                Alert.alert(
                    "Correction",
                    `Remove 1 ${title.toLowerCase()}?`,
                    [
                        { text: "Cancel", style: "cancel" },
                        { text: "Remove", style: "destructive", onPress: () => { haptic.warning(); onDecrement(); } }
                    ]
                );
            }}
            activeOpacity={0.9}
            style={[styles.goalCard, disabled && { opacity: 0.8 }]}
        >
            <BlurView intensity={20} tint="dark" style={StyleSheet.absoluteFill} />

            {/* SVG Progress Ring */}
            <View style={styles.ringContainer}>
                <Svg width="80" height="80">
                    <Circle
                        cx="40"
                        cy="40"
                        r={radius}
                        stroke="rgba(255, 255, 255, 0.05)"
                        strokeWidth="4"
                        fill="transparent"
                    />
                    <Circle
                        cx="40"
                        cy="40"
                        r={radius}
                        stroke={disabled ? "#4ade80" : accentColor}
                        strokeWidth="4"
                        strokeDasharray={circumference}
                        strokeDashoffset={strokeDashoffset}
                        strokeLinecap="round"
                        fill="transparent"
                    />
                </Svg>
            </View>

            <View style={[styles.goalIcon, { backgroundColor: (disabled ? "#4ade80" : accentColor) + '20' }]}>
                <Icon color={disabled ? "#4ade80" : accentColor} size={20} />
            </View>

            <View style={styles.goalInfo}>
                <Text style={[styles.goalValue, disabled && { color: "#4ade80" }]}>{value}</Text>
                <Text style={styles.goalTitle}>{disabled ? "Logged Today" : title}</Text>
                <Text style={styles.goalTarget}>Target: {target}</Text>
            </View>

            <Animated.View style={[styles.plusButton, animatedStyle]}>
                <CheckCircle size={18} color={disabled ? "#4ade80" : accentColor} />
            </Animated.View>
        </TouchableOpacity>
    );
}

export function RamadanTab() {
    const { colors } = useTheme();
    const [suhoorTime, setSuhoorTime] = useState<Date | null>(null);
    const [iftarTime, setIftarTime] = useState<Date | null>(null);
    const [countdown, setCountdown] = useState<string>('');
    const [fastDays, setFastDays] = useState(0);
    const [quranGoal, setQuranGoal] = useState(0);
    const [isRamadanActive, setIsRamadanActive] = useState(false);
    const [daysUntil, setDaysUntil] = useState(0);
    const [lastFastDate, setLastFastDate] = useState<string | null>(null);

    // Ramadan 2026 starts approx Feb 18
    const RAMADAN_START = new Date('2026-02-18T00:00:00');

    useEffect(() => {
        const now = new Date();
        const diff = differenceInDays(RAMADAN_START, now);
        setDaysUntil(Math.max(0, diff));
        setIsRamadanActive(now >= RAMADAN_START);

        loadLocationAndTimes();
        loadGoals();

        const timer = setInterval(updateCountdown, 1000);
        return () => clearInterval(timer);
    }, []);

    const loadLocationAndTimes = async () => {
        try {
            const { status } = await Location.requestForegroundPermissionsAsync();
            let lat = 21.4225, lng = 39.8262; // Makkah fallback

            if (status === 'granted') {
                const loc = await Location.getCurrentPositionAsync({});
                lat = loc.coords.latitude;
                lng = loc.coords.longitude;
            }

            const times = await getPrayerTimes(lat, lng, new Date());
            setSuhoorTime(times.fajr);
            setIftarTime(times.maghrib);
        } catch (e) {
            console.error('Failed to load prayer times for Ramadan tab', e);
        }
    };

    const loadGoals = async () => {
        const stored = await AsyncStorage.getItem('ramadan-goals');
        if (stored) {
            const parsed = JSON.parse(stored);
            setFastDays(parsed.fastDays || 0);
            setQuranGoal(parsed.quranGoal || 0);
            setLastFastDate(parsed.lastFastDate || null);
        }
    };

    const saveGoals = async (newFast: number, newQuran: number, fastDate?: string | null) => {
        const data = {
            fastDays: newFast,
            quranGoal: newQuran,
            lastFastDate: fastDate !== undefined ? fastDate : lastFastDate
        };
        await AsyncStorage.setItem('ramadan-goals', JSON.stringify(data));
    };

    const updateCountdown = () => {
        const now = new Date();

        if (!isRamadanActive) {
            const diff = RAMADAN_START.getTime() - now.getTime();
            if (diff <= 0) {
                setIsRamadanActive(true);
                return;
            }
            setCountdown(`Awaiting the Crescent`);
            return;
        }

        if (!iftarTime || !suhoorTime) return;

        let target = iftarTime;
        let label = 'Iftar';

        if (now > iftarTime) {
            target = new Date(suhoorTime.getTime() + 24 * 60 * 60 * 1000);
            label = 'Suhoor';
        } else if (now < suhoorTime) {
            target = suhoorTime;
            label = 'Suhoor';
        }

        const diff = target.getTime() - now.getTime();
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const secs = Math.floor((diff % (1000 * 60)) / 1000);

        setCountdown(`${label} in ${hours}h ${mins}m ${secs}s`);
    };

    return (
        <SafeAreaView style={styles.safeArea}>
            <ScrollView style={styles.container} contentContainerStyle={[styles.content, tabletContentStyle()]} showsVerticalScrollIndicator={false}>
                <View style={styles.header}>
                    <Text style={[styles.headerTitle, { color: colors.accent }]}>Ramadan 2026</Text>
                    <Text style={styles.headerSubtitle}>
                        {isRamadanActive ? 'Ramadan Mubarak' : `${daysUntil} days until the blessed month`}
                    </Text>
                </View>

                {/* Countdown Card */}
                <Animated.View entering={FadeInUp.delay(200)} style={styles.countdownCard}>
                    <LinearGradient
                        colors={[colors.accent + '30', 'transparent']}
                        style={StyleSheet.absoluteFill}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                    />
                    <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />
                    <View style={styles.countdownContent}>
                        <Moon color={colors.accent} size={32} />
                        <Text style={[styles.countdownTime, { color: colors.primaryText }]}>{countdown || '--:--:--'}</Text>
                        {!isRamadanActive && (
                            <Text style={styles.contingencyNote}>Subject to local moon sighting 🌙</Text>
                        )}
                        {isRamadanActive && (
                            <View style={styles.timeLabels}>
                                <View style={styles.timeLabelItem}>
                                    <Text style={styles.timeLabel}>Suhoor</Text>
                                    <Text style={styles.timeValue}>{suhoorTime ? format(suhoorTime, 'h:mm a') : '--:--'}</Text>
                                </View>
                                <View style={styles.timeLabelItem}>
                                    <Text style={styles.timeLabel}>Iftar</Text>
                                    <Text style={styles.timeValue}>{iftarTime ? format(iftarTime, 'h:mm a') : '--:--'}</Text>
                                </View>
                            </View>
                        )}
                    </View>
                </Animated.View>

                {/* Goals Grid */}
                <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>Spiritual Tracker</Text>
                    <Text style={styles.sectionDesc}>Long-press any card to correct a mistake</Text>
                </View>
                <View style={styles.goalsGrid}>
                    <GoalCard
                        title="Fasts Completed"
                        value={fastDays}
                        icon={Heart}
                        accentColor={colors.accent}
                        disabled={lastFastDate === format(new Date(), 'yyyy-MM-dd')}
                        disabledMessage="MashAllah! You have already logged your fast for today. See you at Iftar! 🌙"
                        onIncrement={() => {
                            const today = format(new Date(), 'yyyy-MM-dd');
                            const n = fastDays + 1;
                            setFastDays(n);
                            setLastFastDate(today);
                            saveGoals(n, quranGoal, today);
                        }}
                        onDecrement={() => {
                            const n = Math.max(0, fastDays - 1);
                            setFastDays(n);
                            setLastFastDate(null); // Reset date lock if removing
                            saveGoals(n, quranGoal, null);
                        }}
                    />
                    <GoalCard
                        title="Juz Read"
                        value={quranGoal}
                        icon={BookOpen}
                        accentColor={colors.accent}
                        onIncrement={() => {
                            const n = quranGoal + 1;
                            setQuranGoal(n);
                            saveGoals(fastDays, n);
                        }}
                        onDecrement={() => {
                            const n = Math.max(0, quranGoal - 1);
                            setQuranGoal(n);
                            saveGoals(fastDays, n);
                        }}
                    />
                </View>

                {/* Ramadan Duas */}
                <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>Daily Duas</Text>
                </View>

                {/* Niyyah */}
                <TouchableOpacity style={styles.duaCard} onPress={() => Alert.alert("Suhoor Niyyah", "I intend to keep the fast tomorrow in the month of Ramadan.")}>
                    <BlurView intensity={20} tint="dark" style={StyleSheet.absoluteFill} />
                    <Text style={styles.duaType}>Niyyah for Fasting</Text>
                    <Text style={styles.duaArabic}>وَبِصَوْمِ غَدٍ نَّوَيْتُ مِنْ شَهْرِ رَمَضَانَ</Text>
                    <Text style={[styles.duaTransliteration, { color: colors.accent }]}>Wa bi-sawmi ghadinn nawaytu min shahri ramadan</Text>
                    <Text style={styles.duaTranslation}>"I intend to keep the fast for tomorrow in the month of Ramadan."</Text>
                </TouchableOpacity>

                {/* Iftar */}
                <TouchableOpacity style={styles.duaCard} onPress={() => Alert.alert("Iftar Dua", "The thirst is gone, the veins are moistened, and the reward is confirmed.")}>
                    <BlurView intensity={20} tint="dark" style={StyleSheet.absoluteFill} />
                    <Text style={styles.duaType}>Breaking the Fast (Iftar)</Text>
                    <Text style={styles.duaArabic}>ذَهَبَ الظَّمَأُ وَابْتَلَّتِ الْعُرُوقُ وَثَبَتَ الْأَجْرُ إِنْ شَاءَ اللَّهُ</Text>
                    <Text style={[styles.duaTransliteration, { color: colors.accent }]}>Dhahaba-dh-dhama'u wabtallati-l-'uruqu wa thabata-l-ajru in sha' Allah</Text>
                    <Text style={styles.duaTranslation}>"The thirst is gone, the veins are moistened, and the reward is confirmed, if Allah wills."</Text>
                </TouchableOpacity>

            </ScrollView>
        </SafeAreaView >
    );
}

const styles = StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: 'transparent' },
    container: { flex: 1 },
    content: { padding: 24, paddingBottom: 100 },
    header: { marginBottom: 32 },
    headerTitle: { fontSize: 32, fontWeight: '900', letterSpacing: -1 },
    headerSubtitle: { color: '#94a3b8', fontSize: 16, fontWeight: '600', marginTop: 4 },
    countdownCard: {
        height: 200,
        borderRadius: 32,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
        marginBottom: 32,
    },
    countdownContent: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
    countdownTime: { fontSize: 24, fontWeight: '900', marginVertical: 12 },
    contingencyNote: { color: '#64748b', fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: -4, marginBottom: 12 },
    timeLabels: { flexDirection: 'row', width: '100%', justifyContent: 'space-around', marginTop: 12 },
    timeLabelItem: { alignItems: 'center' },
    timeLabel: { color: '#64748b', fontSize: 10, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1 },
    timeValue: { color: '#f8fafc', fontSize: 16, fontWeight: '700', marginTop: 4 },
    sectionHeader: { marginBottom: 16 },
    sectionTitle: { color: '#64748b', fontSize: 12, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 2 },
    sectionDesc: { color: '#475569', fontSize: 11, fontWeight: '600', marginTop: 4, marginBottom: 12 },
    goalsGrid: { flexDirection: 'row', gap: 16, marginBottom: 32 },
    goalCard: {
        flex: 1,
        height: 160,
        borderRadius: 24,
        padding: 16,
        justifyContent: 'space-between',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.08)',
        overflow: 'hidden',
        position: 'relative'
    },
    ringContainer: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        justifyContent: 'center',
        alignItems: 'center',
        opacity: 0.5
    },
    goalIcon: { width: 36, height: 36, borderRadius: 12, justifyContent: 'center', alignItems: 'center', zIndex: 1 },
    goalInfo: { zIndex: 1 },
    goalValue: { color: '#f8fafc', fontSize: 24, fontWeight: '900' },
    goalTitle: { color: '#94a3b8', fontSize: 11, fontWeight: '700', marginTop: 2 },
    goalTarget: { color: '#64748b', fontSize: 9, fontWeight: '600', marginTop: 2 },
    plusButton: { position: 'absolute', top: 16, right: 16, zIndex: 1 },
    duaCard: {
        borderRadius: 24,
        padding: 24,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.08)',
        overflow: 'hidden',
        marginBottom: 16
    },
    duaType: { color: '#64748b', fontSize: 10, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 },
    duaArabic: { color: '#f8fafc', fontSize: 24, fontWeight: '700', textAlign: 'right', marginBottom: 12 },
    duaTransliteration: { fontSize: 13, fontWeight: '600', fontStyle: 'italic', marginBottom: 8, lineHeight: 20 },
    duaTranslation: { color: '#cbd5e1', fontSize: 14, lineHeight: 22 }
});
