import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
    View, Text, StyleSheet, TouchableOpacity, Pressable,
    ScrollView, Modal, Platform, Vibration,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
    FadeInDown, useSharedValue, useAnimatedStyle, withSpring, withSequence,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Svg, { Circle, Path } from 'react-native-svg';
import { useTheme } from '../context/ThemeContext';
import { tabletContentStyle } from '../utils/layout';

// ─── Dhikr definitions ───────────────────────────────────────────────────────

const DHIKRS = [
    { id: 'subhan',   arabic: 'سُبْحَانَ اللَّهِ',    transliteration: 'SubhanAllah',    meaning: 'Glory be to Allah',          target: 33 },
    { id: 'hamd',     arabic: 'الْحَمْدُ لِلَّهِ',    transliteration: 'Alhamdulillah',   meaning: 'All praise is due to Allah', target: 33 },
    { id: 'akbar',    arabic: 'اللَّهُ أَكْبَرُ',      transliteration: 'Allahu Akbar',    meaning: 'Allah is the Greatest',      target: 34 },
    { id: 'istighfar',arabic: 'أَسْتَغْفِرُ اللَّهَ',  transliteration: 'Astaghfirullah',  meaning: 'I seek forgiveness from Allah', target: 100 },
    { id: 'tahleel',  arabic: 'لَا إِلَٰهَ إِلَّا اللَّهُ', transliteration: 'La ilaha illallah', meaning: 'There is no god but Allah', target: 100 },
    { id: 'salawat',  arabic: 'اللَّهُمَّ صَلِّ عَلَى مُحَمَّد', transliteration: 'Allahuma Salli \'ala Muhammad', meaning: 'Blessings upon the Prophet ﷺ', target: 100 },
];

const STORAGE_KEY = 'tasbeeh-sessions';

interface Session {
    dhikrId: string;
    count: number;
    date: string; // ISO date string
}

// ─── Arc progress ring ────────────────────────────────────────────────────────

function ProgressRing({ count, target, accent }: { count: number; target: number; accent: string }) {
    const SIZE = 240;
    const STROKE = 6;
    const R = (SIZE - STROKE) / 2;
    const CIRCUMFERENCE = 2 * Math.PI * R;
    const progress = Math.min(count / target, 1);
    const offset = CIRCUMFERENCE * (1 - progress);

    return (
        <Svg width={SIZE} height={SIZE} style={StyleSheet.absoluteFill}>
            {/* Background track */}
            <Circle
                cx={SIZE / 2} cy={SIZE / 2} r={R}
                stroke="rgba(255,255,255,0.08)"
                strokeWidth={STROKE}
                fill="none"
            />
            {/* Progress arc */}
            <Circle
                cx={SIZE / 2} cy={SIZE / 2} r={R}
                stroke={accent}
                strokeWidth={STROKE}
                fill="none"
                strokeLinecap="round"
                strokeDasharray={`${CIRCUMFERENCE}`}
                strokeDashoffset={offset}
                rotation="-90"
                origin={`${SIZE / 2}, ${SIZE / 2}`}
            />
        </Svg>
    );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function TasbeehTab() {
    const { colors } = useTheme();
    const insets = useSafeAreaInsets();
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [count, setCount] = useState(0);
    const [rounds, setRounds] = useState(0); // full completions of target
    const [showPicker, setShowPicker] = useState(false);
    const [sessions, setSessions] = useState<Session[]>([]);
    const tapScale = useSharedValue(1);

    const dhikr = DHIKRS[selectedIndex];

    useEffect(() => {
        loadSessions();
    }, []);

    const loadSessions = async () => {
        try {
            const raw = await AsyncStorage.getItem(STORAGE_KEY);
            if (raw) setSessions(JSON.parse(raw));
        } catch (_) {}
    };

    const saveSession = async (finalCount: number) => {
        if (finalCount === 0) return;
        const session: Session = {
            dhikrId: dhikr.id,
            count: finalCount,
            date: new Date().toISOString(),
        };
        const updated = [session, ...sessions].slice(0, 50); // keep last 50
        setSessions(updated);
        try {
            await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
        } catch (_) {}
    };

    const handleTap = useCallback(() => {
        const newCount = count + 1;

        // Haptic feedback
        if (Platform.OS === 'ios') {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        } else {
            Vibration.vibrate(20);
        }

        // Pulse animation
        tapScale.value = withSequence(
            withSpring(0.94, { damping: 15 }),
            withSpring(1.0, { damping: 12 }),
        );

        if (newCount >= dhikr.target) {
            // Completed a round
            const newRounds = rounds + 1;
            setRounds(newRounds);
            setCount(0);
            if (Platform.OS === 'ios') {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            } else {
                Vibration.vibrate([0, 80, 50, 80]);
            }
            // Auto-save completed round
            saveSession(dhikr.target);
        } else {
            setCount(newCount);
        }
    }, [count, dhikr, rounds]);

    const handleReset = () => {
        if (count > 0) saveSession(count);
        setCount(0);
        setRounds(0);
    };

    const handleSelectDhikr = (index: number) => {
        if (count > 0) saveSession(count);
        setSelectedIndex(index);
        setCount(0);
        setRounds(0);
        setShowPicker(false);
    };

    const tapAnimStyle = useAnimatedStyle(() => ({
        transform: [{ scale: tapScale.value }],
    }));

    const todaySessions = sessions.filter(s => {
        const today = new Date().toDateString();
        return new Date(s.date).toDateString() === today;
    });

    const todayTotal = todaySessions.reduce((sum, s) => sum + s.count, 0);

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <View style={[styles.content, tabletContentStyle()]}>

                {/* Header */}
                <Animated.View entering={FadeInDown.duration(500)} style={styles.header}>
                    <Text style={styles.title}>Tasbeeh</Text>
                    <Text style={[styles.subtitle, { color: colors.secondaryText }]}>
                        Tap to count • Hold to reset
                    </Text>
                </Animated.View>

                {/* Dhikr selector */}
                <Animated.View entering={FadeInDown.delay(100).duration(500)}>
                    <TouchableOpacity style={styles.dhikrSelector} onPress={() => setShowPicker(true)} activeOpacity={0.7}>
                        <BlurView intensity={15} tint="dark" style={StyleSheet.absoluteFill} />
                        <LinearGradient
                            colors={['rgba(255,255,255,0.07)', 'transparent']}
                            style={StyleSheet.absoluteFill}
                        />
                        <Text style={[styles.dhikrTranslit, { color: colors.accent }]}>
                            {dhikr.transliteration}
                        </Text>
                        <Text style={[styles.dhikrMeaning, { color: colors.secondaryText }]}>
                            {dhikr.meaning} · {dhikr.target}×
                        </Text>
                        <Text style={[styles.changeLabel, { color: colors.secondaryText }]}>tap to change ›</Text>
                    </TouchableOpacity>
                </Animated.View>

                {/* Big tap button with ring */}
                <Animated.View entering={FadeInDown.delay(200).duration(500)} style={styles.tapArea}>
                    <Pressable onPress={handleTap} onLongPress={handleReset} style={styles.tapPressable} delayLongPress={600}>
                        <Animated.View style={[styles.tapCircle, tapAnimStyle]}>
                            <BlurView intensity={20} tint="dark" style={StyleSheet.absoluteFill} />
                            <LinearGradient
                                colors={['rgba(255,255,255,0.06)', 'rgba(255,255,255,0.02)']}
                                style={StyleSheet.absoluteFill}
                            />
                            <ProgressRing count={count} target={dhikr.target} accent={colors.accent} />

                            {/* Count display */}
                            <View style={styles.countContainer}>
                                <Text style={[styles.countNumber, { color: colors.primaryText }]}>
                                    {count}
                                </Text>
                                <Text style={[styles.targetLabel, { color: colors.secondaryText }]}>
                                    / {dhikr.target}
                                </Text>
                                {rounds > 0 && (
                                    <View style={[styles.roundsBadge, { backgroundColor: colors.accent + '22', borderColor: colors.accent + '55' }]}>
                                        <Text style={[styles.roundsText, { color: colors.accent }]}>
                                            {rounds}× complete
                                        </Text>
                                    </View>
                                )}
                            </View>

                            {/* Arabic text */}
                            <Text style={styles.arabicText}>{dhikr.arabic}</Text>
                        </Animated.View>
                    </Pressable>
                </Animated.View>

                {/* Today stats */}
                {todayTotal > 0 && (
                    <Animated.View entering={FadeInDown.delay(300).duration(500)} style={styles.statsRow}>
                        <BlurView intensity={12} tint="dark" style={StyleSheet.absoluteFill} />
                        <Text style={[styles.statsLabel, { color: colors.secondaryText }]}>Today</Text>
                        <Text style={[styles.statsValue, { color: colors.primaryText }]}>
                            {todayTotal.toLocaleString()} dhikr
                        </Text>
                    </Animated.View>
                )}

            </View>

            {/* Dhikr picker modal */}
            <Modal visible={showPicker} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowPicker(false)}>
                <View style={styles.modalContainer}>
                    <LinearGradient colors={['#0a1628', '#020617']} style={StyleSheet.absoluteFill} />

                    <View style={styles.modalHeader}>
                        <Text style={styles.modalTitle}>Choose Dhikr</Text>
                        <TouchableOpacity onPress={() => setShowPicker(false)} style={styles.closeBtn}>
                            <Text style={[styles.closeBtnText, { color: colors.secondaryText }]}>Done</Text>
                        </TouchableOpacity>
                    </View>

                    <ScrollView style={styles.modalList} contentContainerStyle={{ paddingBottom: 40 }}>
                        {DHIKRS.map((d, i) => {
                            const isSelected = i === selectedIndex;
                            return (
                                <TouchableOpacity
                                    key={d.id}
                                    style={[styles.dhikrOption, isSelected && { borderColor: colors.accent + '66' }]}
                                    onPress={() => handleSelectDhikr(i)}
                                    activeOpacity={0.7}
                                >
                                    <BlurView intensity={12} tint="dark" style={StyleSheet.absoluteFill} />
                                    <View style={styles.dhikrOptionContent}>
                                        <Text style={styles.dhikrOptionArabic}>{d.arabic}</Text>
                                        <Text style={[styles.dhikrOptionTranslit, { color: isSelected ? colors.accent : colors.primaryText }]}>
                                            {d.transliteration}
                                        </Text>
                                        <Text style={[styles.dhikrOptionMeaning, { color: colors.secondaryText }]}>
                                            {d.meaning}
                                        </Text>
                                    </View>
                                    <View style={[styles.targetBadge, { backgroundColor: colors.accent + '22' }]}>
                                        <Text style={[styles.targetBadgeText, { color: colors.accent }]}>{d.target}×</Text>
                                    </View>
                                </TouchableOpacity>
                            );
                        })}
                    </ScrollView>
                </View>
            </Modal>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    content: {
        flex: 1,
        paddingHorizontal: 20,
    },
    header: {
        alignItems: 'center',
        paddingTop: 16,
        paddingBottom: 12,
    },
    title: {
        fontSize: 28,
        fontWeight: '700',
        color: '#ffffff',
        letterSpacing: -0.5,
    },
    subtitle: {
        fontSize: 13,
        marginTop: 4,
    },
    dhikrSelector: {
        borderRadius: 16,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
        padding: 14,
        alignItems: 'center',
        marginBottom: 20,
    },
    dhikrTranslit: {
        fontSize: 18,
        fontWeight: '700',
        letterSpacing: 0.3,
    },
    dhikrMeaning: {
        fontSize: 13,
        marginTop: 2,
    },
    changeLabel: {
        fontSize: 11,
        marginTop: 6,
        opacity: 0.7,
    },
    tapArea: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 260,
        maxHeight: 320,
    },
    tapPressable: {
        width: 240,
        height: 240,
    },
    tapCircle: {
        width: 240,
        height: 240,
        borderRadius: 120,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.12)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    countContainer: {
        alignItems: 'center',
    },
    countNumber: {
        fontSize: 72,
        fontWeight: '200',
        letterSpacing: -2,
        lineHeight: 80,
    },
    targetLabel: {
        fontSize: 16,
        marginTop: -4,
    },
    roundsBadge: {
        marginTop: 8,
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 20,
        borderWidth: 1,
    },
    roundsText: {
        fontSize: 12,
        fontWeight: '600',
    },
    arabicText: {
        position: 'absolute',
        bottom: 24,
        color: 'rgba(255,255,255,0.25)',
        fontSize: 14,
        fontFamily: Platform.OS === 'ios' ? 'Arial' : undefined,
    },
    statsRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderRadius: 14,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
        paddingHorizontal: 16,
        paddingVertical: 12,
        marginTop: 16,
        marginBottom: 8,
    },
    statsLabel: {
        fontSize: 14,
    },
    statsValue: {
        fontSize: 14,
        fontWeight: '600',
    },
    // Modal
    modalContainer: {
        flex: 1,
        backgroundColor: '#020617',
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingTop: 20,
        paddingBottom: 12,
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: '#ffffff',
    },
    closeBtn: {
        padding: 4,
    },
    closeBtnText: {
        fontSize: 16,
    },
    modalList: {
        paddingHorizontal: 16,
    },
    dhikrOption: {
        borderRadius: 16,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
        marginBottom: 10,
        flexDirection: 'row',
        alignItems: 'center',
        padding: 14,
    },
    dhikrOptionContent: {
        flex: 1,
    },
    dhikrOptionArabic: {
        fontSize: 18,
        color: 'rgba(255,255,255,0.7)',
        marginBottom: 4,
        textAlign: 'right',
    },
    dhikrOptionTranslit: {
        fontSize: 16,
        fontWeight: '600',
    },
    dhikrOptionMeaning: {
        fontSize: 12,
        marginTop: 2,
    },
    targetBadge: {
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 10,
        marginLeft: 10,
    },
    targetBadgeText: {
        fontSize: 13,
        fontWeight: '700',
    },
});
