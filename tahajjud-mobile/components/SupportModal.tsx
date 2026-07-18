import React, { useEffect } from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, Linking } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { X } from 'lucide-react-native';
import Animated, { FadeIn, ZoomIn } from 'react-native-reanimated';
import { haptic } from '../utils/haptic';
import { track } from '../utils/analytics';
import { t } from '../utils/i18n';

interface SupportModalProps {
    visible: boolean;
    onClose: () => void;
}

export function SupportModal({ visible, onClose }: SupportModalProps) {
    useEffect(() => {
        if (visible) {
            haptic.light();
            track('coffee_modal_shown');
        }
    }, [visible]);

    const handleSupport = () => {
        haptic.medium();
        track('coffee_cta_clicked');
        Linking.openURL('https://buymeacoffee.com/tahajjudplus');
        onClose();
    };

    const handleDismiss = () => {
        track('coffee_modal_dismissed');
        onClose();
    };

    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={handleDismiss}>
            <View style={styles.backdrop}>
                <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />

                <Animated.View entering={ZoomIn.duration(450).springify()} style={styles.dialog}>
                    <LinearGradient
                        colors={['rgba(99,102,241,0.22)', 'rgba(2,6,23,0.97)']}
                        style={StyleSheet.absoluteFill}
                        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                    />

                    <TouchableOpacity style={styles.closeBtn} onPress={handleDismiss} hitSlop={12}>
                        <X size={22} color="#64748b" />
                    </TouchableOpacity>

                    <Animated.Text entering={FadeIn.delay(100)} style={styles.flag}>🇵🇸</Animated.Text>

                    <Animated.Text entering={FadeIn.delay(150)} style={styles.heading}>
                        {t('supportModal.heading')}
                    </Animated.Text>

                    <Animated.Text entering={FadeIn.delay(250)} style={styles.body}>
                        {t('supportModal.body')}
                    </Animated.Text>

                    <Animated.View entering={FadeIn.delay(400)} style={styles.btns}>
                        <TouchableOpacity style={styles.coffeeBtn} onPress={handleSupport} activeOpacity={0.85}>
                            <LinearGradient
                                colors={['rgba(99,102,241,0.9)', 'rgba(139,92,246,0.9)']}
                                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                                style={StyleSheet.absoluteFill}
                            />
                            <Text style={styles.coffeeBtnText}>{t('supportModal.coffeeBtn')}</Text>
                        </TouchableOpacity>

                        <TouchableOpacity onPress={handleDismiss} style={styles.dismissBtn}>
                            <Text style={styles.dismissText}>{t('supportModal.maybeLater')}</Text>
                        </TouchableOpacity>
                    </Animated.View>
                </Animated.View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    backdrop: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 24,
    },
    dialog: {
        width: '100%',
        maxWidth: 360,
        borderRadius: 28,
        paddingTop: 44,
        paddingBottom: 32,
        paddingHorizontal: 28,
        alignItems: 'center',
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(139,92,246,0.30)',
    },
    closeBtn: {
        position: 'absolute',
        top: 14,
        right: 14,
        zIndex: 2,
    },
    flag: {
        fontSize: 40,
        marginBottom: 14,
    },
    heading: {
        fontSize: 20,
        fontWeight: '700',
        color: '#f8fafc',
        marginBottom: 16,
        letterSpacing: 0.2,
    },
    body: {
        fontSize: 14,
        color: '#94a3b8',
        textAlign: 'center',
        lineHeight: 22,
        marginBottom: 28,
    },
    btns: {
        width: '100%',
        alignItems: 'center',
        gap: 12,
    },
    coffeeBtn: {
        overflow: 'hidden',
        borderRadius: 999,
        width: '100%',
        height: 52,
        justifyContent: 'center',
        alignItems: 'center',
    },
    coffeeBtnText: {
        color: '#fff',
        fontSize: 15,
        fontWeight: '800',
        letterSpacing: 0.3,
    },
    dismissBtn: {
        paddingVertical: 6,
    },
    dismissText: {
        fontSize: 13,
        color: '#475569',
        fontWeight: '600',
    },
});
