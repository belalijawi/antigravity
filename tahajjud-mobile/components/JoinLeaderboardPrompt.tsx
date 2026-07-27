/**
 * One-time nudge shown right after the What's New modal closes (only if the
 * user hasn't opted into the leaderboard yet) — the leaderboard is one of
 * the features that modal just introduced, so this is the natural next
 * beat: "here's what's new" → "here's one of them, want to try it now?"
 * Tapping through opens the Leaderboard modal itself, which already has its
 * own opt-in flow — this is just the doorway.
 */
import React from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Trophy, X } from 'lucide-react-native';
import Animated, { FadeIn, ZoomIn } from 'react-native-reanimated';
import { haptic } from '../utils/haptic';
import { t } from '../utils/i18n';

interface Props {
    visible: boolean;
    onJoin: () => void;
    onDismiss: () => void;
}

export function JoinLeaderboardPrompt({ visible, onJoin, onDismiss }: Props) {
    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={onDismiss}>
            <View style={styles.backdrop}>
                <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />

                <Animated.View entering={ZoomIn.duration(450).springify()} style={styles.dialog}>
                    <LinearGradient
                        colors={['rgba(251,191,36,0.20)', 'rgba(2,6,23,0.97)']}
                        style={StyleSheet.absoluteFill}
                        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                    />

                    <TouchableOpacity style={styles.closeBtn} onPress={onDismiss} hitSlop={12}>
                        <X size={22} color="#64748b" />
                    </TouchableOpacity>

                    <Animated.View entering={FadeIn.delay(100)} style={styles.iconWrap}>
                        <Trophy size={28} color="#fbbf24" />
                    </Animated.View>

                    <Animated.Text entering={FadeIn.delay(150)} style={styles.heading}>
                        {t('joinLeaderboard.heading')}
                    </Animated.Text>

                    <Animated.Text entering={FadeIn.delay(250)} style={styles.body}>
                        {t('joinLeaderboard.body')}
                    </Animated.Text>

                    <Animated.View entering={FadeIn.delay(400)} style={styles.btns}>
                        <TouchableOpacity
                            style={styles.joinBtn}
                            onPress={() => { haptic.light(); onJoin(); }}
                            activeOpacity={0.85}
                        >
                            <LinearGradient
                                colors={['#fbbf24', '#f59e0b']}
                                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                                style={StyleSheet.absoluteFill}
                            />
                            <Text style={styles.joinBtnText}>{t('joinLeaderboard.joinBtn')}</Text>
                        </TouchableOpacity>

                        <TouchableOpacity onPress={onDismiss} style={styles.dismissBtn}>
                            <Text style={styles.dismissText}>{t('joinLeaderboard.maybeLater')}</Text>
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
        borderColor: 'rgba(251,191,36,0.30)',
    },
    closeBtn: {
        position: 'absolute',
        top: 14,
        right: 14,
        zIndex: 2,
    },
    iconWrap: {
        width: 64, height: 64, borderRadius: 32,
        backgroundColor: 'rgba(251,191,36,0.15)',
        borderWidth: 1, borderColor: 'rgba(251,191,36,0.35)',
        alignItems: 'center', justifyContent: 'center',
        marginBottom: 18,
    },
    heading: {
        fontSize: 20,
        fontWeight: '700',
        color: '#f8fafc',
        marginBottom: 16,
        letterSpacing: 0.2,
        textAlign: 'center',
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
    joinBtn: {
        overflow: 'hidden',
        borderRadius: 999,
        width: '100%',
        height: 52,
        justifyContent: 'center',
        alignItems: 'center',
    },
    joinBtnText: {
        color: '#0a1228',
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
