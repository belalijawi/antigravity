import React, { useEffect, useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Alert } from "react-native";
import { Trophy, CheckCircle, Star, Sunrise, ShieldCheck, Moon, PenTool, MessageSquarePlus } from "lucide-react-native";
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { subDays } from "date-fns";
import { getAchievements, checkAchievements, Achievement } from "../utils/achievements";

export function Tracker() {
    const [streak, setStreak] = useState(0);
    const [history, setHistory] = useState<string[]>([]);
    const [todayLogged, setTodayLogged] = useState(false);
    const [userName, setUserName] = useState<string | null>(null);
    const [achievements, setAchievements] = useState<Achievement[]>([]);

    useEffect(() => {
        loadHistory();
        loadUserName();
        loadAchievements();
    }, []);

    const loadAchievements = async () => {
        const data = await getAchievements();
        setAchievements(data);
    };

    const loadUserName = async () => {
        try {
            const name = await AsyncStorage.getItem('user-name');
            setUserName(name);
        } catch (e) {
            console.error('Failed to load user name', e);
        }
    };

    const loadHistory = async () => {
        try {
            const storedHistory = await AsyncStorage.getItem("tahajjud-tracker");
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

    const saveHistory = async (newHistory: string[]) => {
        try {
            await AsyncStorage.setItem("tahajjud-tracker", JSON.stringify(newHistory));
        } catch (e) {
            console.error("Failed to save history", e);
        }
    }

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
        saveHistory(newHistory);
        calculateStreak(newHistory);

        // Check for achievements
        const newlyUnlocked = await checkAchievements('prayer', newHistory.length);
        if (newlyUnlocked) {
            Alert.alert(
                "Achievement Unlocked! 🏅",
                `Congratulations! You earned the "${newlyUnlocked.title}" badge.\n\n${newlyUnlocked.description}`,
                [{ text: "MashAllah!", onPress: loadAchievements }]
            );
        }
    };

    const renderBadgeIcon = (name: string, unlocked: boolean) => {
        const size = 32;
        const color = unlocked ? "#facc15" : "#475569";

        switch (name) {
            case 'Star': return <Star size={size} color={color} fill={unlocked ? "#facc15" : "none"} />;
            case 'Sunrise': return <Sunrise size={size} color={color} />;
            case 'ShieldCheck': return <ShieldCheck size={size} color={color} />;
            case 'Moon': return <Moon size={size} color={color} fill={unlocked ? "#facc15" : "none"} />;
            case 'PenTool': return <PenTool size={size} color={color} />;
            case 'MessageSquarePlus': return <MessageSquarePlus size={size} color={color} />;
            default: return <Trophy size={size} color={color} />;
        }
    };

    const showBadgeDetails = (achievement: Achievement) => {
        const status = achievement.unlockedAt
            ? `Earned on ${new Date(achievement.unlockedAt).toLocaleDateString()}`
            : "Locked";

        Alert.alert(
            achievement.title,
            `${achievement.description}\n\nStatus: ${status}`,
            [{ text: "Great!" }]
        );
    };

    return (
        <View style={styles.container}>
            <View style={styles.card}>
                <LinearGradient
                    colors={['rgba(255, 255, 255, 0.05)', 'rgba(255, 255, 255, 0.01)']}
                    style={StyleSheet.absoluteFill}
                />
                <BlurView intensity={5} tint="dark" style={StyleSheet.absoluteFill} />

                <View style={styles.header}>
                    <View style={styles.headerLeft}>
                        <Trophy size={20} color={streak > 0 ? "#facc15" : "#94a3b8"} />
                        <Text style={styles.headerText}>
                            {userName ? `${userName}'s Streak` : 'Streak'}
                        </Text>
                    </View>
                    <View style={styles.badge}>
                        <Text style={styles.badgeText}>{streak} Days</Text>
                    </View>
                </View>

                <TouchableOpacity
                    onPress={logToday}
                    disabled={todayLogged}
                    style={[
                        styles.button,
                        todayLogged ? styles.buttonLogged : styles.buttonActive
                    ]}
                    activeOpacity={0.7}
                >
                    <CheckCircle size={20} color={todayLogged ? "#22c55e" : "#0f172a"} />
                    <Text style={[
                        styles.buttonText,
                        todayLogged ? styles.buttonTextLogged : styles.buttonTextActive
                    ]}>
                        {todayLogged ? "Prayer Logged ✓" : "Log Today's Prayer"}
                    </Text>
                </TouchableOpacity>

                <Text style={styles.footerText}>
                    "The most beloved deeds to Allah are those that are consistent, even if they are small."
                </Text>
            </View>

            {/* Achievements Section */}
            <View style={styles.achievementsCard}>
                <LinearGradient
                    colors={['rgba(255, 255, 255, 0.03)', 'transparent']}
                    style={StyleSheet.absoluteFill}
                />
                <Text style={styles.sectionTitle}>Achievements</Text>
                <View style={styles.badgeGrid}>
                    {achievements.map((achievement) => (
                        <TouchableOpacity
                            key={achievement.id}
                            style={styles.badgeItem}
                            onPress={() => showBadgeDetails(achievement)}
                            activeOpacity={0.7}
                        >
                            <View style={[
                                styles.iconContainer,
                                achievement.unlockedAt ? styles.iconContainerUnlocked : styles.iconContainerLocked
                            ]}>
                                {renderBadgeIcon(achievement.icon, !!achievement.unlockedAt)}
                            </View>
                            <Text style={[
                                styles.badgeTitle,
                                !achievement.unlockedAt && styles.badgeTitleLocked
                            ]}>
                                {achievement.title}
                            </Text>
                            {achievement.unlockedAt && (
                                <Text style={styles.unlockedDate}>
                                    {new Date(achievement.unlockedAt).toLocaleDateString()}
                                </Text>
                            )}
                        </TouchableOpacity>
                    ))}
                </View>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        width: '100%',
        paddingHorizontal: 16,
        marginBottom: 40,
    },
    card: {
        width: '100%',
        padding: 24,
        borderRadius: 24,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.08)',
        overflow: 'hidden',
        backgroundColor: 'transparent',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 24,
    },
    headerLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    headerText: {
        color: '#ffffff',
        fontWeight: '600',
    },
    badge: {
        paddingHorizontal: 12,
        paddingVertical: 4,
        backgroundColor: 'rgba(248, 250, 252, 0.2)',
        borderRadius: 9999,
    },
    badgeText: {
        color: '#f8fafc',
        fontWeight: 'bold',
    },
    button: {
        width: '100%',
        paddingVertical: 16,
        borderRadius: 12,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
        borderWidth: 2,
    },
    buttonActive: {
        backgroundColor: '#f8fafc',
        borderColor: '#f8fafc',
    },
    buttonLogged: {
        backgroundColor: 'rgba(34, 197, 94, 0.1)',
        borderColor: '#22c55e',
    },
    buttonText: {
        fontWeight: '500',
    },
    buttonTextActive: {
        color: '#0f172a',
        fontWeight: 'bold',
    },
    buttonTextLogged: {
        color: '#22c55e',
    },
    footerText: {
        fontSize: 12,
        textAlign: 'center',
        color: '#94a3b8',
        marginTop: 16,
        fontStyle: 'italic',
    },
    achievementsCard: {
        width: '100%',
        padding: 24,
        borderRadius: 24,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.08)',
        marginTop: 16,
        overflow: 'hidden',
        backgroundColor: 'transparent',
    },
    sectionTitle: {
        color: '#ffffff',
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 20,
    },
    badgeGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        gap: 16,
    },
    badgeItem: {
        width: '30%',
        alignItems: 'center',
        marginBottom: 8,
    },
    iconContainer: {
        width: 64,
        height: 64,
        borderRadius: 32,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 8,
        borderWidth: 1,
    },
    iconContainerLocked: {
        backgroundColor: 'rgba(255, 255, 255, 0.03)',
        borderColor: 'rgba(255, 255, 255, 0.05)',
    },
    iconContainerUnlocked: {
        backgroundColor: 'rgba(250, 204, 21, 0.1)',
        borderColor: 'rgba(250, 204, 21, 0.3)',
    },
    badgeTitle: {
        color: '#f8fafc',
        fontSize: 12,
        fontWeight: '600',
        textAlign: 'center',
    },
    badgeTitleLocked: {
        color: '#64748b',
    },
    unlockedDate: {
        color: '#4ade80',
        fontSize: 10,
        marginTop: 2,
    }
});
