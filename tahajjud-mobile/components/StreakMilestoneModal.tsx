import React, { useEffect, useRef, useState } from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, Share, Platform } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Share2, X, Flame, Star } from 'lucide-react-native';
import Animated, { FadeIn, ZoomIn } from 'react-native-reanimated';
import { captureRef } from 'react-native-view-shot';
import { StreakMilestoneCard } from './StreakMilestoneCard';
import { useTheme } from '../context/ThemeContext';
import { haptic } from '../utils/haptic';
import { usePurchases } from '../context/PurchasesContext';

interface StreakMilestoneModalProps {
    visible: boolean;
    nights: number;
    onClose: () => void;
}

export function StreakMilestoneModal({ visible, nights, onClose }: StreakMilestoneModalProps) {
    const { colors } = useTheme();
    const { isPremium, openPaywall } = usePurchases();
    const cardRef = useRef<View>(null);
    const [sharing, setSharing] = useState(false);

    useEffect(() => {
        if (visible) haptic.success();
    }, [visible]);

    const handleShare = async () => {
        if (sharing) return;
        setSharing(true);
        haptic.medium();
        try {
            // Small delay ensures the offscreen card has rendered before capture
            await new Promise(res => setTimeout(res, 400));
            if (cardRef.current) {
                const uri = await captureRef(cardRef, { format: 'png', quality: 1.0 });
                await Share.share({
                    url: uri,
                    message: `${nights} nights of Tahajjud, by Allah's grace. اللهم تقبل`,
                });
            }
        } catch (e) {
            // user cancelled or capture failed — silent
        } finally {
            setSharing(false);
        }
    };

    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
            <View style={styles.backdrop}>
                <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />

                <Animated.View entering={ZoomIn.duration(500).springify()} style={styles.dialog}>
                    <LinearGradient
                        colors={['rgba(250, 204, 21, 0.18)', 'rgba(2, 6, 23, 0.95)']}
                        style={StyleSheet.absoluteFill}
                        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                    />

                    <TouchableOpacity style={styles.closeBtn} onPress={onClose} hitSlop={12}>
                        <X size={22} color="#94a3b8" />
                    </TouchableOpacity>

                    <Animated.View entering={FadeIn.delay(200)} style={styles.flameWrap}>
                        <Flame size={64} color={colors.accent} />
                    </Animated.View>

                    <Text style={[styles.bigN, { color: colors.accent }]}>{nights}</Text>
                    <Text style={styles.nightsLabel}>NIGHTS</Text>
                    <View style={[styles.divider, { backgroundColor: colors.accent }]} />
                    <Text style={styles.title}>Alhamdulillah</Text>
                    <Text style={styles.body}>
                        {nights} nights of standing before your Lord{'\n'}in the depth of the night.
                    </Text>

                    <TouchableOpacity style={[styles.shareBtn, { backgroundColor: colors.accent }]} onPress={handleShare} disabled={sharing}>
                        <Share2 size={18} color="#0a0f1e" />
                        <Text style={styles.shareTxt}>{sharing ? 'Preparing…' : 'Share milestone'}</Text>
                    </TouchableOpacity>

                    {/* Premium upsell — only for free users */}
                    {!isPremium && (
                        <Animated.View entering={FadeIn.delay(600)} style={styles.upsellBox}>
                            <Text style={styles.upsellText}>
                                {nights >= 30
                                    ? '30 nights. Your journey deserves to be seen in full.'
                                    : nights >= 7
                                        ? `${nights} nights of Tahajjud — unlock your full history to see every one.`
                                        : 'Track every night, see your patterns, protect your streak.'}
                            </Text>
                            <TouchableOpacity
                                style={[styles.upsellBtn, { backgroundColor: colors.accent }]}
                                onPress={() => { onClose(); setTimeout(openPaywall, 300); }}
                                activeOpacity={0.85}
                            >
                                <Star size={14} color="#0a0f1e" fill="#0a0f1e" />
                                <Text style={styles.upsellBtnTxt}>Unlock Premium</Text>
                            </TouchableOpacity>
                        </Animated.View>
                    )}

                    <TouchableOpacity onPress={onClose} style={{ marginTop: isPremium ? 0 : 8 }}>
                        <Text style={styles.dismissTxt}>Keep going</Text>
                    </TouchableOpacity>
                </Animated.View>

                {/* Offscreen capture buffer */}
                <View collapsable={false} style={styles.captureBuffer} pointerEvents="none">
                    <StreakMilestoneCard ref={cardRef} nights={nights} accent={colors.accent} />
                </View>
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
        paddingVertical: 36,
        paddingHorizontal: 28,
        alignItems: 'center',
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(250, 204, 21, 0.30)',
    },
    closeBtn: {
        position: 'absolute',
        top: 14,
        right: 14,
        zIndex: 2,
    },
    flameWrap: {
        marginBottom: 6,
    },
    bigN: {
        fontSize: 96,
        fontWeight: '900',
        letterSpacing: -3,
        lineHeight: 100,
    },
    nightsLabel: {
        fontSize: 14,
        fontWeight: '800',
        color: '#f8fafc',
        letterSpacing: 6,
        marginTop: 4,
    },
    divider: {
        width: 64,
        height: 3,
        borderRadius: 2,
        opacity: 0.6,
        marginVertical: 18,
    },
    title: {
        fontSize: 22,
        fontWeight: '700',
        color: '#f8fafc',
        marginBottom: 8,
    },
    body: {
        fontSize: 14,
        color: '#94a3b8',
        textAlign: 'center',
        lineHeight: 21,
        marginBottom: 24,
    },
    shareBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingVertical: 14,
        paddingHorizontal: 28,
        borderRadius: 999,
        marginBottom: 16,
    },
    shareTxt: {
        fontSize: 15,
        fontWeight: '800',
        color: '#0a0f1e',
        letterSpacing: 0.3,
    },
    dismissTxt: {
        fontSize: 13,
        color: '#64748b',
        fontWeight: '600',
    },
    upsellBox: {
        width: '100%',
        borderRadius: 16,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.10)',
        backgroundColor: 'rgba(255,255,255,0.04)',
        padding: 16,
        alignItems: 'center',
        gap: 12,
        marginTop: 8,
        marginBottom: 4,
    },
    upsellText: {
        fontSize: 13,
        color: '#94a3b8',
        textAlign: 'center',
        lineHeight: 19,
        fontWeight: '500',
    },
    upsellBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 7,
        paddingVertical: 11,
        paddingHorizontal: 22,
        borderRadius: 999,
    },
    upsellBtnTxt: {
        fontSize: 13,
        fontWeight: '900',
        color: '#0a0f1e',
    },
    captureBuffer: {
        position: 'absolute',
        left: -10000,
        top: 0,
        width: 1080,
        height: 1920,
    },
});
