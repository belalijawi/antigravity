import React, { useEffect, useState } from 'react';
import { View, ScrollView, StyleSheet, SafeAreaView, Text, TouchableOpacity, Modal } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Settings } from 'lucide-react-native';
import { NightCalculator } from './NightCalculator';
import { QiblaCompass } from './QiblaCompass';
import { Tracker } from './Tracker';
import { HadithCard } from './HadithCard';
import { DuaNetwork } from './DuaNetwork';
import { SettingsScreen } from './SettingsScreen';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import Animated, { FadeInUp, FadeInDown } from 'react-native-reanimated';
import { useTheme } from '../context/ThemeContext';


export function HomeTab() {
    const { colors } = useTheme();
    const [userName, setUserName] = useState<string | null>(null);
    const [isSettingsVisible, setIsSettingsVisible] = useState(false);

    // ...
    // Inside JSX:
    // Replace #facc15 with colors.accent
    // Replace #f8fafc with colors.primaryText
    // Replace #94a3b8 with colors.secondaryText


    useEffect(() => {
        loadUserName();
    }, []);

    const loadUserName = async () => {
        try {
            const name = await AsyncStorage.getItem('user-name');
            if (name) setUserName(name);
        } catch (e) {
            console.error('Failed to load user name', e);
        }
    };

    return (
        <SafeAreaView style={styles.safeArea}>
            <ScrollView
                style={styles.container}
                contentContainerStyle={styles.contentContainer}
                showsVerticalScrollIndicator={false}
            >
                {/* Header */}
                <View style={styles.header}>
                    <View>
                        <Text style={[styles.dateText, { color: colors.accent }]}>
                            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                        </Text>
                        <Text style={[styles.greetingText, { color: colors.secondaryText }]}>
                            Assalamu Alaikum,
                        </Text>
                        <Text style={[styles.nameText, { color: colors.primaryText }]}>{userName || 'Servant'}</Text>
                    </View>
                    <TouchableOpacity
                        activeOpacity={0.7}
                        onPress={() => setIsSettingsVisible(true)}
                        style={[styles.settingsButton, { borderColor: 'rgba(255, 255, 255, 0.08)' }]}
                    >
                        <BlurView intensity={20} tint="dark" style={[StyleSheet.absoluteFill, { borderRadius: 20 }]} />
                        <Settings color={colors.primaryText} size={24} strokeWidth={2} />
                    </TouchableOpacity>
                </View>

                {/* Hero: Celestial Portal */}
                <Animated.View
                    entering={FadeInUp.duration(1200)}
                    style={styles.heroPortal}
                >
                    <LinearGradient
                        colors={['rgba(248, 250, 252, 0.08)', 'rgba(79, 70, 229, 0.02)', 'transparent']}
                        style={[StyleSheet.absoluteFill, { borderRadius: 40 }]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                    />
                    <BlurView intensity={40} tint="dark" style={[StyleSheet.absoluteFill, { borderRadius: 40, backgroundColor: 'rgba(0,0,0,0.2)' }]} />

                    <View style={styles.moonContainer}>
                        <View style={styles.moon}>
                            {/* Base Moon Surface with Realistic Gradient */}
                            <LinearGradient
                                colors={['#b0b8c4', '#8895a5', '#6b7785', '#4a5568']}
                                style={[StyleSheet.absoluteFill, { borderRadius: 40 }]}
                                start={{ x: 0.2, y: 0.2 }}
                                end={{ x: 0.9, y: 0.9 }}
                            />

                            {/* Lunar Maria (Dark Seas) - More Realistic Patterns */}
                            <View style={[styles.moonSea, { top: 8, left: 5, width: 35, height: 28, transform: [{ rotate: '25deg' }], opacity: 0.15 }]} />
                            <View style={[styles.moonSea, { top: 25, right: 8, width: 22, height: 18, transform: [{ rotate: '-15deg' }], opacity: 0.12 }]} />
                            <View style={[styles.moonSea, { bottom: 12, left: 18, width: 28, height: 22, opacity: 0.10 }]} />
                            <View style={[styles.moonSea, { bottom: 20, right: 12, width: 18, height: 16, transform: [{ rotate: '40deg' }], opacity: 0.08 }]} />

                            {/* Impact Craters with Depth */}
                            {/* Large crater with rim highlight */}
                            <View style={[styles.craterOuter, { top: 15, left: 28, width: 18, height: 18 }]}>
                                <View style={[styles.moonCrater, { width: 14, height: 14, opacity: 0.18 }]} />
                                <View style={[styles.craterHighlight, { top: 2, left: 2, width: 8, height: 8 }]} />
                            </View>

                            {/* Medium craters */}
                            <View style={[styles.craterOuter, { top: 38, left: 18, width: 12, height: 12 }]}>
                                <View style={[styles.moonCrater, { width: 10, height: 10, opacity: 0.15 }]} />
                            </View>
                            <View style={[styles.craterOuter, { bottom: 24, left: 40, width: 14, height: 14 }]}>
                                <View style={[styles.moonCrater, { width: 11, height: 11, opacity: 0.12 }]} />
                                <View style={[styles.craterHighlight, { top: 1, left: 1, width: 6, height: 6 }]} />
                            </View>

                            {/* Small craters scattered */}
                            <View style={[styles.moonCrater, { top: 10, right: 18, width: 6, height: 6, opacity: 0.10 }]} />
                            <View style={[styles.moonCrater, { top: 28, right: 25, width: 5, height: 5, opacity: 0.08 }]} />
                            <View style={[styles.moonCrater, { bottom: 18, left: 12, width: 7, height: 7, opacity: 0.14 }]} />
                            <View style={[styles.moonCrater, { bottom: 35, right: 20, width: 8, height: 8, opacity: 0.11 }]} />
                            <View style={[styles.moonCrater, { top: 50, left: 8, width: 4, height: 4, opacity: 0.09 }]} />
                            <View style={[styles.moonCrater, { top: 22, left: 52, width: 5, height: 5, opacity: 0.07 }]} />

                            {/* Micro-craters for texture */}
                            <View style={[styles.moonCrater, { top: 18, left: 12, width: 3, height: 3, opacity: 0.06 }]} />
                            <View style={[styles.moonCrater, { top: 32, left: 32, width: 3, height: 3, opacity: 0.05 }]} />
                            <View style={[styles.moonCrater, { top: 44, right: 14, width: 3, height: 3, opacity: 0.07 }]} />
                            <View style={[styles.moonCrater, { bottom: 28, left: 25, width: 4, height: 4, opacity: 0.06 }]} />
                            <View style={[styles.moonCrater, { bottom: 42, right: 28, width: 3, height: 3, opacity: 0.05 }]} />
                            <View style={[styles.moonCrater, { top: 58, left: 46, width: 3, height: 3, opacity: 0.06 }]} />
                            <View style={[styles.moonCrater, { top: 14, left: 38, width: 2, height: 2, opacity: 0.04 }]} />
                            <View style={[styles.moonCrater, { bottom: 15, left: 8, width: 3, height: 3, opacity: 0.05 }]} />
                            <View style={[styles.moonCrater, { bottom: 48, left: 52, width: 2, height: 2, opacity: 0.04 }]} />
                            <View style={[styles.moonCrater, { top: 36, right: 10, width: 2, height: 2, opacity: 0.05 }]} />

                            {/* Subtle ray patterns (ejecta) */}
                            <View style={[styles.moonRay, { top: 12, left: 20, width: 1, height: 8, transform: [{ rotate: '25deg' }] }]} />
                            <View style={[styles.moonRay, { top: 26, left: 48, width: 1, height: 6, transform: [{ rotate: '-35deg' }] }]} />
                            <View style={[styles.moonRay, { bottom: 30, right: 18, width: 1, height: 7, transform: [{ rotate: '15deg' }] }]} />

                            {/* Subtle Highlight on Lit Side */}
                            <View style={styles.moonHighlight} />

                            {/* Terminator Shadow (Crescent Effect) */}
                            <View style={styles.moonShadow} />
                        </View>
                        {/* Atmospheric Glow */}
                        <View style={[styles.moonAura, { borderColor: 'rgba(248, 250, 252, 0.25)' }]} />
                        <View style={[styles.moonAura, { width: 140, height: 140, borderRadius: 70, opacity: 0.15, borderColor: 'rgba(255, 255, 255, 0.2)' }]} />
                    </View>

                    <View style={styles.heroContent}>
                        <Text style={[styles.heroSubtitle, { color: colors.accent }]}>Tonight's Journey</Text>
                        <Text style={styles.heroTitle}>Enter the Silent Hour</Text>
                        <View style={styles.heroBadge}>
                            <View style={styles.pulseDot} />
                            <Text style={[styles.heroBadgeText, { color: colors.accent }]}>Gate is Open</Text>
                        </View>
                    </View>
                </Animated.View>

                {/* Bento Grid Layout */}
                <View style={styles.bentoContainer}>
                    {/* Large Card: Night Calculator */}
                    <Animated.View
                        entering={FadeInDown.delay(200).duration(800)}
                        style={[styles.bentoCard, styles.bentoCardLarge]}
                    >
                        <BlurView intensity={15} tint="dark" style={StyleSheet.absoluteFill} />
                        <NightCalculator />
                    </Animated.View>

                    {/* Row: Dua Network & Stats */}
                    <View style={styles.bentoRow}>
                        <Animated.View
                            entering={FadeInDown.delay(400).duration(800)}
                            style={[styles.bentoCard, styles.bentoCardSquare]}
                        >
                            <BlurView intensity={20} tint="dark" style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.3)' }]} />
                            <DuaNetwork />
                        </Animated.View>

                        <Animated.View
                            entering={FadeInDown.delay(600).duration(800)}
                            style={[styles.bentoCard, styles.bentoCardSquare]}
                        >
                            <BlurView intensity={20} tint="dark" style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.3)' }]} />
                            <Tracker />
                        </Animated.View>
                    </View>

                    {/* Horizontal: Hadith Carousel / Cards */}
                    <Animated.View entering={FadeInDown.delay(800).duration(800)} style={styles.hadithCarousel}>
                        <HadithCard
                            text="The Lord descends every night to the lowest heaven when one-third of the night remains..."
                            source="Bukhari 1145"
                        />
                    </Animated.View>

                    {/* Full Width: Qibla Compass */}
                    <Animated.View
                        entering={FadeInDown.delay(1000).duration(800)}
                        style={styles.fullWidthCard}
                    >
                        <QiblaCompass />
                    </Animated.View>
                </View>
            </ScrollView>

            <Modal
                visible={isSettingsVisible}
                animationType="slide"
                presentationStyle="fullScreen"
                onRequestClose={() => setIsSettingsVisible(false)}
            >
                <SettingsScreen onClose={() => setIsSettingsVisible(false)} />
            </Modal>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: 'transparent',
    },
    container: {
        flex: 1,
    },
    contentContainer: {
        paddingBottom: 150, // Space for floating tab bar
    },
    header: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        paddingHorizontal: 24,
        paddingTop: 30,
        paddingBottom: 40,
    },
    dateText: {
        fontSize: 12,
        color: '#facc15', // Fallback
        textTransform: 'uppercase',
        letterSpacing: 2,
        marginBottom: 8,
        fontWeight: '900',
    },
    greetingText: {
        fontSize: 16,
        color: '#94a3b8', // Stardust Grey
        fontWeight: '600',
    },
    nameText: {
        fontSize: 34,
        fontWeight: '900',
        color: '#f8fafc', // Moonlight White
        marginTop: 4,
        letterSpacing: -0.5,
    },
    settingsButton: {
        padding: 12,
        backgroundColor: 'transparent',
        borderRadius: 20,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.08)',
    },
    heroPortal: {
        marginHorizontal: 20,
        height: 220,
        borderRadius: 40,
        overflow: 'hidden',
        flexDirection: 'row',
        alignItems: 'center',
        padding: 24,
        backgroundColor: 'transparent',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.08)',
        marginBottom: 24,
        shadowColor: '#06b6d4',
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.15,
        shadowRadius: 24,
        elevation: 0,
    },
    moonContainer: {
        width: 110,
        height: 110,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 20,
    },
    moon: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: 'transparent',
        shadowColor: '#ffffff',
        shadowRadius: 30,
        shadowOpacity: 0.5,
        elevation: 0,
    },
    moonCrater: {
        position: 'absolute',
        borderRadius: 50,
        backgroundColor: 'rgba(0,0,0,0.06)',
    },
    moonSea: {
        position: 'absolute',
        backgroundColor: 'rgba(15, 23, 42, 0.08)',
        borderRadius: 40,
    },
    craterOuter: {
        position: 'absolute',
        justifyContent: 'center',
        alignItems: 'center',
    },
    craterHighlight: {
        position: 'absolute',
        borderRadius: 50,
        backgroundColor: 'rgba(255, 255, 255, 0.06)',
    },
    moonHighlight: {
        position: 'absolute',
        top: 8,
        left: 8,
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: 'rgba(255, 255, 255, 0.08)',
    },
    moonRay: {
        position: 'absolute',
        backgroundColor: 'rgba(255, 255, 255, 0.03)',
        borderRadius: 0.5,
    },
    moonShadow: {
        position: 'absolute',
        width: 85,
        height: 85,
        borderRadius: 42.5,
        backgroundColor: 'rgba(2, 6, 23, 0.25)',
        top: -5,
        right: -25,
    },
    moonAura: {
        position: 'absolute',
        width: 120,
        height: 120,
        borderRadius: 60,
        borderWidth: 1,
        borderColor: 'rgba(248, 250, 252, 0.1)',
        opacity: 0.4,
    },
    heroContent: {
        flex: 1,
        alignItems: 'flex-start',
    },
    heroSubtitle: {
        fontSize: 12,
        color: '#facc15', // Fallback
        textTransform: 'uppercase',
        letterSpacing: 2.5,
        fontWeight: '900',
        marginBottom: 4,
    },
    heroTitle: {
        fontSize: 30,
        fontWeight: '900',
        color: '#f8fafc', // Moonlight White
        marginBottom: 12,
        letterSpacing: -0.5,
    },
    heroBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(248, 250, 252, 0.08)',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
        gap: 8,
    },
    pulseDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: '#f8fafc',
    },
    heroBadgeText: {
        color: '#facc15', // Fallback
        fontSize: 12,
        fontWeight: '900',
    },
    bentoContainer: {
        paddingHorizontal: 20,
        gap: 16,
    },
    bentoCard: {
        borderRadius: 32,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.08)',
        overflow: 'hidden',
    },
    bentoCardContent: {
        flex: 1,
    },
    bentoCardLarge: {
        padding: 0,
    },
    bentoRow: {
        flexDirection: 'row',
        gap: 16,
    },
    bentoCardSquare: {
        flex: 1,
        aspectRatio: 0.9, // Even taller for more space
        justifyContent: 'center',
        padding: 0,
    },
    hadithCarousel: {
        marginTop: 8, // Added space above
        marginBottom: 16,
    },
    fullWidthCard: {
        marginBottom: 16,
    }
});
