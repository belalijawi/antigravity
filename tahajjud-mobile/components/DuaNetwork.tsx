import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { Send, Users } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { GlassBg as BlurView } from './GlassBg';
import { incrementDuasSent, getCommunityStats } from '../utils/community';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withSequence,
    withSpring
} from 'react-native-reanimated';
import { useTheme } from '../context/ThemeContext';

export const DuaNetwork = () => {
    const { colors } = useTheme();
    const [stats, setStats] = useState({ duasSent: 0, duasReceived: 0 });
    const [isSending, setIsSending] = useState(false);

    const buttonScale = useSharedValue(1);

    useEffect(() => {
        loadStats();
    }, []);

    const loadStats = async () => {
        const s = await getCommunityStats();
        setStats(s);
    };

    const handleSendDua = async () => {
        if (isSending) return;

        setIsSending(true);
        buttonScale.value = withSequence(
            withSpring(1.1),
            withSpring(1)
        );

        const newStats = await incrementDuasSent();
        if (newStats) setStats(newStats);

        setTimeout(() => {
            setIsSending(false);
            Alert.alert("Alhamdulillah", "Your prayer has been shared.");
        }, 800);
    };

    const buttonAnimatedStyle = useAnimatedStyle(() => ({
        transform: [{ scale: buttonScale.value }]
    }));

    return (
        <View style={styles.container}>
            <LinearGradient
                colors={['rgba(255, 255, 255, 0.05)', 'transparent']}
                style={[StyleSheet.absoluteFill, { borderRadius: 32 }]}
            />

            <View style={styles.content}>
                <View style={styles.iconCircle}>
                    <BlurView intensity={20} tint="dark" style={StyleSheet.absoluteFill} />
                    <Users size={18} color={colors.accent} strokeWidth={2.5} />
                </View>

                <Text style={styles.title}>Ummah Pulse</Text>

                <View style={styles.statsContainer}>
                    <Text style={[styles.statValue, { color: colors.primaryText }]}>{stats.duasSent}</Text>
                    <Text style={[styles.statLabel, { color: colors.secondaryText }]}>Prayers Shared</Text>
                </View>

                <TouchableOpacity
                    onPress={handleSendDua}
                    onPressIn={() => buttonScale.value = withSpring(0.95)}
                    onPressOut={() => buttonScale.value = withSpring(1)}
                    style={styles.actionButton}
                    disabled={isSending}
                    activeOpacity={1}
                >
                    <BlurView intensity={20} tint="dark" style={[StyleSheet.absoluteFill, { borderRadius: 14 }]} />
                    <Animated.View style={[styles.buttonContent, buttonAnimatedStyle]}>
                        <Send size={14} color={isSending ? colors.accent : colors.primaryText} />
                        <Text style={[styles.buttonText, { color: isSending ? colors.accent : colors.primaryText }]}>
                            {isSending ? "..." : "Send Dua"}
                        </Text>
                    </Animated.View>
                </TouchableOpacity>
            </View>
        </View>
    );
};

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
    statsContainer: {
        alignItems: 'center',
        marginVertical: 4, // Controlled vertical rhythm
    },
    statValue: {
        fontSize: 22, // Slightly compressed
        fontWeight: '900',
    },
    statLabel: {
        fontSize: 10,
        fontWeight: 'bold',
    },
    actionButton: {
        width: '100%',
        height: 38, // Slightly shorter but still fully functional
        borderRadius: 12,
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
        overflow: 'hidden',
    },
    buttonContent: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    buttonText: {
        fontSize: 11,
        fontWeight: '900',
        textTransform: 'uppercase',
        letterSpacing: 1,
    }
});
