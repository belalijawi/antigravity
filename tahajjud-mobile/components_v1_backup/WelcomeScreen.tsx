import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Moon, ChevronRight } from 'lucide-react-native';
import { BlurView } from 'expo-blur';
import Animated, { FadeIn, FadeInDown, FadeInUp } from 'react-native-reanimated';

interface WelcomeScreenProps {
    onComplete: (name?: string) => void;
}

export function WelcomeScreen({ onComplete }: WelcomeScreenProps) {
    const [name, setName] = useState('');

    const handleGetStarted = () => {
        onComplete(name.trim() || undefined);
    };

    const handleSkip = () => {
        onComplete(undefined);
    };

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.container}
        >
            <LinearGradient
                colors={['#0f172a', '#020617', '#000000']}
                style={styles.gradient}
            >
                <View style={styles.content}>
                    {/* Icon */}
                    <Animated.View
                        entering={FadeInUp.delay(200).duration(1000)}
                        style={styles.iconContainer}
                    >
                        <View style={styles.iconGlow} />
                        <Moon size={100} color="#f8fafc" strokeWidth={1} />
                    </Animated.View>

                    {/* Title */}
                    <Animated.Text
                        entering={FadeInDown.delay(400).duration(1000)}
                        style={styles.title}
                    >
                        Tahajjud+
                    </Animated.Text>

                    {/* Subtitle */}
                    <Animated.Text
                        entering={FadeInDown.delay(600).duration(1000)}
                        style={styles.subtitle}
                    >
                        Your journey to the last third of the night starts here.
                    </Animated.Text>

                    {/* Name Input */}
                    <Animated.View
                        entering={FadeInDown.delay(800).duration(1000)}
                        style={styles.inputContainer}
                    >
                        <BlurView intensity={10} tint="light" style={styles.inputBlur}>
                            <TextInput
                                style={styles.input}
                                placeholder="What is your name?"
                                placeholderTextColor="rgba(255, 255, 255, 0.4)"
                                value={name}
                                onChangeText={setName}
                                autoCapitalize="words"
                                returnKeyType="done"
                                onSubmitEditing={handleGetStarted}
                            />
                        </BlurView>
                    </Animated.View>

                    {/* Get Started Button */}
                    <Animated.View
                        entering={FadeInDown.delay(1000).duration(1000)}
                        style={{ width: '100%' }}
                    >
                        <TouchableOpacity
                            onPress={handleGetStarted}
                            style={styles.button}
                            activeOpacity={0.8}
                        >
                            <LinearGradient
                                colors={['#ffffff', '#cbd5e1']}
                                style={StyleSheet.absoluteFill}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 1 }}
                            />
                            <Text style={styles.buttonText}>Enter the Light</Text>
                            <ChevronRight size={18} color="#020617" />
                        </TouchableOpacity>
                    </Animated.View>

                    {/* Skip Button */}
                    <Animated.View entering={FadeIn.delay(1500).duration(1000)}>
                        <TouchableOpacity
                            onPress={handleSkip}
                            style={styles.skipButton}
                            activeOpacity={0.6}
                        >
                            <Text style={styles.skipText}>
                                Proceed Anonymously
                            </Text>
                        </TouchableOpacity>
                    </Animated.View>

                    {/* Quote */}
                    <Animated.Text
                        entering={FadeIn.delay(2000).duration(1000)}
                        style={styles.quote}
                    >
                        "The Lord descends every night to the lowest heaven when the last third of the night remains..."
                    </Animated.Text>
                </View>
            </LinearGradient>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    gradient: {
        flex: 1,
    },
    content: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 40,
    },
    iconContainer: {
        marginBottom: 20,
        position: 'relative',
        justifyContent: 'center',
        alignItems: 'center',
    },
    iconGlow: {
        position: 'absolute',
        width: 120,
        height: 120,
        borderRadius: 60,
        backgroundColor: 'rgba(248, 250, 252, 0.05)',
        shadowColor: '#f8fafc',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.3,
        shadowRadius: 30,
    },
    title: {
        fontSize: 48,
        fontWeight: '900',
        color: '#ffffff',
        textAlign: 'center',
        marginBottom: 8,
        letterSpacing: -2,
    },
    subtitle: {
        fontSize: 16,
        color: '#94a3b8',
        textAlign: 'center',
        marginBottom: 60,
        lineHeight: 24,
        fontWeight: '500',
    },
    inputContainer: {
        width: '100%',
        marginBottom: 24,
        borderRadius: 20,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
    },
    inputBlur: {
        paddingVertical: 4,
    },
    input: {
        width: '100%',
        paddingHorizontal: 20,
        paddingVertical: 16,
        color: '#ffffff',
        fontSize: 16,
        textAlign: 'center',
    },
    button: {
        width: '100%',
        height: 64,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
        flexDirection: 'row',
        gap: 8,
        overflow: 'hidden',
        elevation: 8,
        shadowColor: '#ffffff',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
    },
    buttonText: {
        color: '#020617',
        fontWeight: '900',
        fontSize: 18,
        letterSpacing: 0.5,
    },
    skipButton: {
        marginTop: 20,
        paddingVertical: 12,
    },
    skipText: {
        color: '#64748b',
        textAlign: 'center',
        fontSize: 14,
        fontWeight: '600',
        letterSpacing: 0.5,
    },
    quote: {
        fontSize: 12,
        color: '#475569',
        textAlign: 'center',
        marginTop: 80,
        fontStyle: 'italic',
        paddingHorizontal: 20,
        lineHeight: 20,
    },
});
