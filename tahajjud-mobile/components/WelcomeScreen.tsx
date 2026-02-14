import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Moon, ChevronRight } from 'lucide-react-native';
import { BlurView } from 'expo-blur';
import Animated, { FadeIn, FadeInDown, FadeInUp } from 'react-native-reanimated';
import { useTheme } from '../context/ThemeContext';

interface WelcomeScreenProps {
    onComplete: (name?: string) => void;
}

export function WelcomeScreen({ onComplete }: WelcomeScreenProps) {
    const { colors } = useTheme();
    const [name, setName] = useState('');

    const handleGetStarted = () => {
        onComplete(name.trim() || undefined);
    };

    return (
        <View style={styles.container}>
            {/* Background Layer */}
            <LinearGradient
                colors={['#000000', '#020617', '#000000']}
                style={StyleSheet.absoluteFill}
            />
            {/* Decorative Nebula Glows */}
            <View style={[styles.glow, { top: '10%', left: '-20%', backgroundColor: 'rgba(241, 245, 249, 0.08)' }]} />
            <View style={[styles.glow, { bottom: '10%', right: '-20%', backgroundColor: 'rgba(226, 232, 240, 0.05)' }]} />

            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={styles.container}
            >
                <View style={styles.content}>
                    {/* Hero Visual */}
                    <Animated.View
                        entering={FadeInUp.delay(200).duration(1200)}
                        style={styles.heroContainer}
                    >
                        <View style={styles.moon}>
                            <LinearGradient
                                colors={['#94a3b8', '#64748b', '#334155']}
                                style={[StyleSheet.absoluteFill, { borderRadius: 60 }]}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 1 }}
                            />
                            {/* Texture: Lunar Seas */}
                            <View style={[styles.moonSea, { top: 30, left: 20, width: 45, height: 35, transform: [{ rotate: '30deg' }] }]} />
                            <View style={[styles.moonSea, { bottom: 25, right: 35, width: 35, height: 25, opacity: 0.03 }]} />

                            {/* Varied Craters */}
                            <View style={[styles.moonCrater, { top: 20, left: 40, width: 14, height: 14, opacity: 0.08 }]} />
                            <View style={[styles.moonCrater, { top: 60, left: 20, width: 10, height: 10, opacity: 0.06 }]} />
                            <View style={[styles.moonCrater, { bottom: 30, left: 50, width: 20, height: 20, opacity: 0.04 }]} />
                            <View style={[styles.moonCrater, { bottom: 65, right: 25, width: 12, height: 12, opacity: 0.1 }]} />

                            {/* Crescent Shadow */}
                            <View style={styles.moonShadow} />

                            <View style={styles.moonCraters} />
                        </View>
                        <View style={styles.moonAura} />
                    </Animated.View>

                    {/* Text Content */}
                    <View style={styles.textGroup}>
                        <Animated.Text
                            entering={FadeInDown.delay(400).duration(1000)}
                            style={[styles.title, { color: colors.accent }]}
                        >
                            Tahajjud+
                        </Animated.Text>
                        <Animated.Text
                            entering={FadeInDown.delay(600).duration(1000)}
                            style={styles.subtitle}
                        >
                            Your companion for the sacred third of the night.
                        </Animated.Text>
                    </View>

                    {/* Action Group */}
                    <View style={styles.actionGroup}>
                        <Animated.View
                            entering={FadeInDown.delay(800).duration(1000)}
                            style={styles.inputWrapper}
                        >
                            <BlurView intensity={30} tint="dark" style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.3)' }]} />
                            <TextInput
                                style={styles.input}
                                placeholder="Enter your name"
                                placeholderTextColor="rgba(255, 255, 255, 0.3)"
                                value={name}
                                onChangeText={setName}
                                autoCapitalize="words"
                            />
                        </Animated.View>

                        <Animated.View
                            entering={FadeInDown.delay(1000).duration(1000)}
                            style={{ width: '100%' }}
                        >
                            <TouchableOpacity
                                onPress={handleGetStarted}
                                style={styles.mainButton}
                                activeOpacity={0.9}
                            >
                                <LinearGradient
                                    colors={['#f8fafc', '#cbd5e1']}
                                    style={StyleSheet.absoluteFill}
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 1 }}
                                />
                                <Text style={styles.buttonText}>Begin Your Ascent</Text>
                                <ChevronRight size={20} color="#0f172a" strokeWidth={2.5} />
                            </TouchableOpacity>
                        </Animated.View>

                        <Animated.View entering={FadeIn.delay(1200).duration(1000)}>
                            <TouchableOpacity onPress={() => onComplete(undefined)} style={styles.skipLink}>
                                <Text style={styles.skipText}>Anonymous Reflection</Text>
                            </TouchableOpacity>
                        </Animated.View>
                    </View>

                    <Animated.Text
                        entering={FadeIn.delay(1500).duration(1000)}
                        style={styles.footerQuote}
                    >
                        "The Lord descends every night to the lowest heaven when the last third of the night remains..."
                    </Animated.Text>
                </View>
            </KeyboardAvoidingView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    glow: {
        position: 'absolute',
        width: 400,
        height: 400,
        borderRadius: 200,
        opacity: 0.5,
    },
    content: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 32,
    },
    heroContainer: {
        marginBottom: 40,
        alignItems: 'center',
        justifyContent: 'center',
    },
    moon: {
        width: 120,
        height: 120,
        borderRadius: 60,
        backgroundColor: 'transparent',
        shadowColor: '#ffffff',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.4,
        shadowRadius: 40,
        elevation: 0,
    },
    moonCraters: {
        ...StyleSheet.absoluteFillObject,
        opacity: 0.03,
        backgroundColor: 'rgba(0,0,0,0.1)',
        borderRadius: 60,
    },
    moonSea: {
        position: 'absolute',
        backgroundColor: 'rgba(15, 23, 42, 0.05)',
        borderRadius: 60,
    },
    moonCrater: {
        position: 'absolute',
        borderRadius: 50,
        backgroundColor: 'rgba(0,0,0,0.06)',
    },
    moonShadow: {
        position: 'absolute',
        width: 150,
        height: 150,
        borderRadius: 75,
        backgroundColor: 'rgba(2, 6, 23, 0.15)',
        top: -15,
        right: -45,
    },
    moonAura: {
        position: 'absolute',
        width: 160,
        height: 160,
        borderRadius: 80,
        borderWidth: 1.5,
        borderColor: 'rgba(255, 255, 255, 0.15)',
    },
    textGroup: {
        alignItems: 'center',
        marginBottom: 60,
    },
    title: {
        fontSize: 48,
        fontWeight: '900',
        color: '#facc15',
        letterSpacing: -2,
        marginBottom: 8,
    },
    subtitle: {
        fontSize: 15,
        color: '#94a3b8',
        textAlign: 'center',
        lineHeight: 22,
        fontWeight: '500',
    },
    actionGroup: {
        width: '100%',
        gap: 16,
        alignItems: 'center',
    },
    inputWrapper: {
        width: '100%',
        height: 60,
        borderRadius: 20,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.08)',
        justifyContent: 'center',
        backgroundColor: 'transparent',
    },
    input: {
        flex: 1,
        paddingHorizontal: 20,
        color: '#ffffff',
        fontSize: 16,
        textAlign: 'center',
        fontWeight: '600',
    },
    mainButton: {
        width: '100%',
        height: 64,
        borderRadius: 24,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        overflow: 'hidden',
        elevation: 0,
        shadowColor: '#06b6d4',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.3,
        shadowRadius: 15,
    },
    buttonText: {
        color: '#0f172a',
        fontSize: 18,
        fontWeight: '900',
        letterSpacing: 0.3,
    },
    skipLink: {
        paddingVertical: 10,
    },
    skipText: {
        color: '#475569',
        fontSize: 13,
        fontWeight: '700',
        letterSpacing: 0.5,
    },
    footerQuote: {
        position: 'absolute',
        bottom: 50,
        fontSize: 11,
        color: '#cbd5e1',
        textAlign: 'center',
        fontStyle: 'italic',
        paddingHorizontal: 40,
        lineHeight: 18,
        fontWeight: '600',
    },
});
