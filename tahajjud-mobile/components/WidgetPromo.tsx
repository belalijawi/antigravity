import React, { useEffect, useRef } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    Platform,
    Animated,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { X, LayoutDashboard } from 'lucide-react-native';
import { useTheme } from '../context/ThemeContext';
import { t } from '../utils/i18n';

const DISMISSED_KEY = 'widget_promo_dismissed';

interface WidgetPromoProps {
    onDismiss: () => void;
}

export function WidgetPromo({ onDismiss }: WidgetPromoProps) {
    const { colors } = useTheme();
    const translateY = useRef(new Animated.Value(60)).current;
    const opacity = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        Animated.parallel([
            Animated.spring(translateY, {
                toValue: 0,
                tension: 65,
                friction: 10,
                useNativeDriver: true,
            }),
            Animated.timing(opacity, {
                toValue: 1,
                duration: 280,
                useNativeDriver: true,
            }),
        ]).start();
    }, []);

    const dismiss = async () => {
        await AsyncStorage.setItem(DISMISSED_KEY, 'true');
        Animated.parallel([
            Animated.timing(translateY, {
                toValue: 60,
                duration: 220,
                useNativeDriver: true,
            }),
            Animated.timing(opacity, {
                toValue: 0,
                duration: 200,
                useNativeDriver: true,
            }),
        ]).start(onDismiss);
    };

    const steps = Platform.OS === 'android'
        ? [t('widgetPromo.step1'), t('widgetPromo.step2Android'), t('widgetPromo.step3Android'), t('widgetPromo.step4Android')]
        : [t('widgetPromo.step1'), t('widgetPromo.step2'), t('widgetPromo.step3'), t('widgetPromo.step4')];

    return (
        <Animated.View style={[styles.wrapper, { opacity, transform: [{ translateY }] }]}>
            <View style={[styles.card, { borderColor: 'rgba(139,92,246,0.35)' }]}>
                <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />
                <LinearGradient
                    colors={['rgba(88,28,235,0.18)', 'rgba(139,92,246,0.08)', 'transparent']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={StyleSheet.absoluteFill}
                />

                {/* Dismiss button */}
                <TouchableOpacity style={styles.closeBtn} onPress={dismiss} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                    <X size={16} color={colors.secondaryText} />
                </TouchableOpacity>

                <View style={styles.row}>
                    {/* Widget icon */}
                    <View style={styles.iconWrap}>
                        <LinearGradient
                            colors={['#7c3aed', '#4f46e5']}
                            style={styles.iconGradient}
                        >
                            <LayoutDashboard size={22} color="#fff" />
                        </LinearGradient>
                    </View>

                    <View style={styles.textCol}>
                        <Text style={[styles.title, { color: colors.primaryText }]}>
                            {t('widgetPromo.title')}
                        </Text>
                        <Text style={[styles.body, { color: colors.secondaryText }]}>
                            {t('widgetPromo.body')}
                        </Text>
                    </View>
                </View>

                {/* Step-by-step */}
                <View style={styles.steps}>
                    {steps.map((step, i) => (
                        <View key={i} style={styles.stepRow}>
                            <View style={styles.stepNum}>
                                <Text style={styles.stepNumText}>{i + 1}</Text>
                            </View>
                            <Text style={[styles.stepText, { color: colors.secondaryText }]}>{step}</Text>
                        </View>
                    ))}
                </View>

                <TouchableOpacity style={styles.gotItBtn} onPress={dismiss} activeOpacity={0.8}>
                    <LinearGradient
                        colors={['#7c3aed', '#6d28d9']}
                        style={styles.gotItGradient}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                    >
                        <Text style={styles.gotItText}>{t('widgetPromo.gotIt')}</Text>
                    </LinearGradient>
                </TouchableOpacity>
            </View>
        </Animated.View>
    );
}

/** Call this to check whether the promo should be shown */
export async function shouldShowWidgetPromo(): Promise<boolean> {
    const dismissed = await AsyncStorage.getItem(DISMISSED_KEY);
    return dismissed !== 'true';
}

const styles = StyleSheet.create({
    wrapper: {
        marginTop: 16,
        marginHorizontal: 4,
    },
    card: {
        borderRadius: 20,
        borderWidth: 1,
        overflow: 'hidden',
        padding: 18,
    },
    closeBtn: {
        position: 'absolute',
        top: 12,
        right: 12,
        zIndex: 10,
        padding: 4,
    },
    row: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        marginBottom: 14,
        paddingRight: 20,
    },
    iconWrap: {
        marginRight: 14,
        marginTop: 2,
    },
    iconGradient: {
        width: 44,
        height: 44,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    textCol: {
        flex: 1,
    },
    title: {
        fontSize: 15,
        fontWeight: '700',
        marginBottom: 4,
    },
    body: {
        fontSize: 13,
        lineHeight: 18,
    },
    steps: {
        gap: 8,
        marginBottom: 16,
    },
    stepRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    stepNum: {
        width: 22,
        height: 22,
        borderRadius: 11,
        backgroundColor: 'rgba(139,92,246,0.25)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    stepNumText: {
        fontSize: 11,
        fontWeight: '700',
        color: '#a78bfa',
    },
    stepText: {
        fontSize: 13,
        flex: 1,
    },
    gotItBtn: {
        borderRadius: 12,
        overflow: 'hidden',
    },
    gotItGradient: {
        paddingVertical: 11,
        alignItems: 'center',
    },
    gotItText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '700',
    },
});
