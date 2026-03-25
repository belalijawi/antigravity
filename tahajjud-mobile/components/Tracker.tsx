import React, { useEffect, useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Alert } from "react-native";
import { Trophy, CheckCircle, Flame } from "lucide-react-native";
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { subDays } from "date-fns";
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withSpring
} from 'react-native-reanimated';

import { useTheme } from '../context/ThemeContext';

const BEST_STREAK_KEY = 'tahajjud-best-streak';

// Milestone thresholds and their labels
const MILESTONES = [
    { days: 3, label: '3', color: '#94a3b8' },
    { days: 7, label: '7', color: '#f59e0b' },
    { days: 30, label: '30', color: '#f97316' },
    { days: 100, label: '100', color: '#a855f7' },
];

function getMilestone(streak: number) {
    for (let i = MILESTONES.length - 1; i >= 0; i--) {
        if (streak >= MILESTONES[i].days) return MILESTONES[i];
    }
    return null;
}

export function Tracker() {
    const { colors } = useTheme();
    const [streak, setStreak] = useState(0);
    const [bestStreak, setBestStreak] = useState(0);
    const [history, setHistory] = useState<string[]>([]);
    const [todayLogged, setTodayLogged] = useState(false);
    const buttonScale = useSharedValue(1);

    const buttonAnimatedStyle = useAnimatedStyle(() => ({
        transform: [{ scale: buttonScale.value }]
    }));

    useEffect(() => {
        loadHistory();
    }, []);

    const loadHistory = async () => {
        try {
            const [storedHistory, storedBest] = await Promise.all([
                AsyncStorage.getItem("tahajjud-tracker"),
                AsyncStorage.getItem(BEST_STREAK_KEY),
            ]);
            if (storedBest) setBestStreak(parseInt(storedBest, 10));
            if (storedHistory) {
                const parsed = JSON.parse(storedHistory);
                setHistory(parsed);
                calculateStreak(parsed);
                checkToday(parsed);
            }
        } catch (e) {
            console.error("Failed to load history", e);
        }
    };

    const calculateStreak = (dates: string[]) => {
        if (dates.length === 0) {
            setStreak(0);
            return;
        }
        const todayStr = new Date().toISOString().split('T')[0];
        const yesterdayStr = subDays(new Date(), 1).toISOString().split('T')[0];
        const hasToday = dates.some(d => d.split('T')[0] === todayStr);
        const hasYesterday = dates.some(d => d.split('T')[0] === yesterdayStr);

        if (!hasToday && !hasYesterday) {
            setStreak(0);
            return;
        }

        let count = 0;
        let checkDate = hasToday ? new Date() : subDays(new Date(), 1);

        while (true) {
            const checkStr = checkDate.toISOString().split('T')[0];
            const found = dates.some(d => d.split('T')[0] === checkStr);
            if (!found) break;
            count++;
            checkDate = subDays(checkDate, 1);
        }
        setStreak(count);

        // Update best streak if this is a new personal best
        AsyncStorage.getItem(BEST_STREAK_KEY).then(stored => {
            const prev = stored ? parseInt(stored, 10) : 0;
            if (count > prev) {
                setBestStreak(count);
                AsyncStorage.setItem(BEST_STREAK_KEY, count.toString());
            }
        });
    };

    const checkToday = (dates: string[]) => {
        const todayStr = new Date().toISOString().split('T')[0];
        const logged = dates.some(d => d.split('T')[0] === todayStr);
        setTodayLogged(logged);
    };

    const logToday = async () => {
        if (todayLogged) return;
        const now = new Date().toISOString();
        const newHistory = [...history, now];
        setHistory(newHistory);
        setTodayLogged(true);
        await AsyncStorage.setItem("tahajjud-tracker", JSON.stringify(newHistory));
        calculateStreak(newHistory);
        Alert.alert("Alhamdulillah", "Tonight's prayer has been logged.");
    };

    const milestone = getMilestone(streak);

    return (
        <View style={styles.container}>
            <LinearGradient
                colors={[colors.shadow, 'rgba(79, 70, 229, 0.05)', 'transparent']}
                style={[StyleSheet.absoluteFill, { borderRadius: 32 }]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
            />
            <BlurView intensity={20} tint="dark" style={StyleSheet.absoluteFill} />

            <View style={styles.content}>
                <View style={styles.iconCircle}>
                    <BlurView intensity={20} tint="dark" style={[StyleSheet.absoluteFill, { borderRadius: 32 }]} />
                    {streak >= 3
                        ? <Flame size={18} color={milestone?.color ?? colors.accent} />
                        : <Trophy size={18} color={streak > 0 ? colors.accent : colors.secondaryText} />
                    }
                </View>

                <Text style={styles.title}>Streak</Text>

                <View style={styles.streakPanel}>
                    <Text style={[styles.streakValue, { color: milestone?.color ?? colors.accent }]}>{streak}</Text>
                    <Text style={[styles.streakLabel, { color: colors.secondaryText }]}>
                        {streak === 1 ? 'day' : 'days'}
                    </Text>
                </View>

                {/* Milestone badges row */}
                <View style={styles.milestonesRow}>
                    {MILESTONES.map(m => (
                        <View
                            key={m.days}
                            style={[
                                styles.badge,
                                streak >= m.days
                                    ? { backgroundColor: m.color + '22', borderColor: m.color + '66' }
                                    : { backgroundColor: 'rgba(255,255,255,0.03)', borderColor: 'rgba(255,255,255,0.08)' }
                            ]}
                        >
                            <Text style={[styles.badgeText, { color: streak >= m.days ? m.color : '#475569' }]}>
                                {m.label}
                            </Text>
                        </View>
                    ))}
                </View>

                <TouchableOpacity
                    onPress={logToday}
                    onPressIn={() => buttonScale.value = withSpring(0.95)}
                    onPressOut={() => buttonScale.value = withSpring(1)}
                    style={[styles.actionButton, todayLogged && { borderColor: colors.success, backgroundColor: 'rgba(16, 185, 129, 0.05)' }]}
                    disabled={todayLogged}
                    activeOpacity={1}
                >
                    <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />
                    <Animated.View style={[todayLogged ? styles.loggedContent : styles.logIcon, buttonAnimatedStyle]}>
                        {todayLogged ? (
                            <CheckCircle size={16} color={colors.success} />
                        ) : (
                            <Text style={[styles.logText, { color: colors.primaryText }]}>Log</Text>
                        )}
                    </Animated.View>
                </TouchableOpacity>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        width: '100%',
    },
    content: {
        flex: 1,
        padding: 12, // Reduced padding
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    iconCircle: {
        width: 36, // Reduced size
        height: 36,
        borderRadius: 12,
        backgroundColor: 'rgba(255, 255, 255, 0.03)',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.12)',
        overflow: 'hidden',
        marginBottom: 4, // Space before title
    },
    title: {
        fontSize: 10, // Slightly smaller
        fontWeight: 'bold',
        color: '#64748b',
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    streakPanel: {
        alignItems: 'center',
        marginVertical: 4, // Controlled vertical rhythm
    },
    streakValue: {
        fontSize: 22, // Slightly compressed
        fontWeight: '900',
    },
    streakLabel: {
        fontSize: 10,
        fontWeight: 'bold',
    },
    actionButton: {
        width: '100%',
        height: 38, // Slightly shorter
        borderRadius: 12,
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
        overflow: 'hidden',
    },
    logIcon: {
        justifyContent: 'center',
        alignItems: 'center',
    },
    loggedContent: {
        justifyContent: 'center',
        alignItems: 'center',
    },
    logText: {
        fontSize: 11,
        fontWeight: '900',
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    milestonesRow: {
        flexDirection: 'row',
        gap: 4,
        justifyContent: 'center',
    },
    badge: {
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 6,
        borderWidth: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    badgeText: {
        fontSize: 9,
        fontWeight: '900',
        letterSpacing: 0.5,
    },
});
