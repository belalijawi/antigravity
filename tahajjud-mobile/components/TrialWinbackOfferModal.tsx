import React from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { X, Star } from 'lucide-react-native';
import Animated, { FadeIn, ZoomIn } from 'react-native-reanimated';
import { haptic } from '../utils/haptic';
import { track } from '../utils/analytics';
import { t } from '../utils/i18n';

interface Props {
    visible: boolean;
    onClose: () => void;
    onClaim: () => void;
}

export function TrialWinbackOfferModal({ visible, onClose, onClaim }: Props) {
    const handleClaim = () => {
        haptic.light();
        track('trial_winback_popup_claimed');
        onClaim();
    };

    const handleSkip = () => {
        track('trial_winback_popup_dismissed');
        onClose();
    };

    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={handleSkip}>
            <View style={styles.backdrop}>
                <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />

                <Animated.View entering={ZoomIn.duration(450).springify()} style={styles.dialog}>
                    <LinearGradient
                        colors={['rgba(250,204,21,0.16)', 'rgba(2,6,23,0.97)']}
                        style={StyleSheet.absoluteFill}
                        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                    />

                    <TouchableOpacity style={styles.closeBtn} onPress={handleSkip} hitSlop={12}>
                        <X size={22} color="#64748b" />
                    </TouchableOpacity>

                    <Animated.View entering={FadeIn.delay(80)} style={styles.iconWrap}>
                        <Star size={28} color="#facc15" fill="#facc15" />
                    </Animated.View>

                    <Animated.Text entering={FadeIn.delay(140)} style={styles.heading}>
                        {t('trialWinbackPopup.heading')}
                    </Animated.Text>

                    <Animated.Text entering={FadeIn.delay(220)} style={styles.body}>
                        {t('trialWinbackPopup.body')}
                    </Animated.Text>

                    <Animated.View entering={FadeIn.delay(300)} style={{ width: '100%' }}>
                        <TouchableOpacity style={styles.claimBtn} onPress={handleClaim} activeOpacity={0.85}>
                            <Text style={styles.claimText}>{t('trialWinbackPopup.cta')}</Text>
                        </TouchableOpacity>
                    </Animated.View>

                    <TouchableOpacity onPress={handleSkip} style={styles.dismissBtn}>
                        <Text style={styles.dismissText}>{t('trialWinbackPopup.skip')}</Text>
                    </TouchableOpacity>
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
        maxWidth: 380,
        borderRadius: 28,
        paddingTop: 44,
        paddingBottom: 24,
        paddingHorizontal: 24,
        alignItems: 'center',
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(250,204,21,0.3)',
    },
    closeBtn: {
        position: 'absolute',
        top: 14,
        right: 14,
        zIndex: 2,
    },
    iconWrap: {
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: 'rgba(250,204,21,0.14)',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 16,
    },
    heading: {
        fontSize: 19,
        fontWeight: '700',
        color: '#f8fafc',
        marginBottom: 10,
        letterSpacing: 0.2,
        textAlign: 'center',
    },
    body: {
        fontSize: 13,
        color: '#94a3b8',
        textAlign: 'center',
        lineHeight: 20,
        marginBottom: 24,
    },
    claimBtn: {
        width: '100%',
        paddingVertical: 15,
        borderRadius: 16,
        backgroundColor: '#facc15',
        alignItems: 'center',
        marginBottom: 14,
    },
    claimText: {
        fontSize: 15,
        fontWeight: '700',
        color: '#000',
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
