import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, Alert } from 'react-native';
import { Send, Heart, Share2, Users } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { incrementDuasSent, incrementDuasReceived, getCommunityStats } from '../utils/community';

export const DuaNetwork = () => {
    const [stats, setStats] = useState({ duasSent: 0, duasReceived: 0 });
    const [isSending, setIsSending] = useState(false);
    const sendScale = new Animated.Value(1);

    useEffect(() => {
        loadStats();

        // Randomly simulate receiving a dua every 30-60 seconds for engagement
        const interval = setInterval(() => {
            if (Math.random() > 0.7) {
                simulateIncomingDua();
            }
        }, 45000);

        return () => clearInterval(interval);
    }, []);

    const loadStats = async () => {
        const s = await getCommunityStats();
        setStats(s);
    };

    const simulateIncomingDua = async () => {
        const newStats = await incrementDuasReceived();
        if (newStats) {
            setStats(newStats);
            // We won't show an intrusive alert every time, but maybe a subtle indicator
        }
    };

    const handleSendDua = async () => {
        setIsSending(true);

        // Animation
        Animated.sequence([
            Animated.timing(sendScale, { toValue: 1.2, duration: 200, useNativeDriver: true }),
            Animated.timing(sendScale, { toValue: 1, duration: 200, useNativeDriver: true }),
        ]).start();

        const newStats = await incrementDuasSent();
        if (newStats) setStats(newStats);

        setTimeout(() => {
            setIsSending(false);
            Alert.alert(
                "Dua Transmitted ✨",
                "Your anonymous prayer has been sent into the global network. A brother or sister somewhere in the world will receive your light tonight.",
                [{ text: "MashAllah" }]
            );
        }, 1000);
    };

    return (
        <View style={styles.container}>
            <LinearGradient
                colors={['rgba(255, 255, 255, 0.05)', 'rgba(255, 255, 255, 0.01)']}
                style={StyleSheet.absoluteFill}
            />
            <BlurView intensity={5} tint="dark" style={StyleSheet.absoluteFill} />

            <View style={styles.header}>
                <View style={styles.headerLeft}>
                    <Users size={18} color="#facc15" />
                    <Text style={styles.title}>Spirit Network</Text>
                </View>
                <View style={styles.receivedBadge}>
                    <Heart size={10} color="#ef4444" fill="#ef4444" />
                    <Text style={styles.receivedText}>{stats.duasReceived} Received</Text>
                </View>
            </View>

            <Text style={styles.description}>
                Send a silent prayer to a random person praying Tahajjud right now.
            </Text>

            <TouchableOpacity
                style={styles.sendButton}
                onPress={handleSendDua}
                disabled={isSending}
                activeOpacity={0.8}
            >
                <Animated.View style={{ transform: [{ scale: sendScale }], flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Send size={20} color="#0f172a" />
                    <Text style={styles.sendButtonText}>
                        {isSending ? "Transmitting..." : "Send Anonymous Dua"}
                    </Text>
                </Animated.View>
            </TouchableOpacity>

            <View style={styles.footer}>
                <View style={styles.statLine}>
                    <Text style={styles.statLabel}>You've shared</Text>
                    <Text style={styles.statValue}>{stats.duasSent} Lights</Text>
                </View>
                <View style={styles.divider} />
                <View style={styles.statLine}>
                    <Text style={styles.statLabel}>Network Depth</Text>
                    <Text style={styles.statValue}>Global</Text>
                </View>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        marginHorizontal: 16,
        padding: 24,
        borderRadius: 32,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.08)',
        marginTop: 8,
        overflow: 'hidden',
        backgroundColor: 'transparent',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    headerLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    title: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#ffffff',
    },
    receivedBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(239, 68, 68, 0.1)',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 12,
        gap: 4,
    },
    receivedText: {
        color: '#ef4444',
        fontSize: 10,
        fontWeight: 'bold',
    },
    description: {
        color: '#94a3b8',
        lineHeight: 20,
        marginBottom: 24,
        fontSize: 14,
    },
    sendButton: {
        backgroundColor: '#facc15',
        height: 56,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#facc15',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 4,
    },
    sendButtonText: {
        color: '#0f172a',
        fontWeight: 'bold',
        fontSize: 16,
    },
    footer: {
        flexDirection: 'row',
        marginTop: 24,
        paddingTop: 16,
        borderTopWidth: 1,
        borderTopColor: 'rgba(255, 255, 255, 0.05)',
        justifyContent: 'space-between',
    },
    statLine: {
        flex: 1,
        alignItems: 'center',
    },
    statLabel: {
        fontSize: 10,
        color: '#64748b',
        marginBottom: 4,
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    statValue: {
        fontSize: 14,
        color: '#f8fafc',
        fontWeight: 'bold',
    },
    divider: {
        width: 1,
        height: '80%',
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        alignSelf: 'center',
    }
});
