import React from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { X } from 'lucide-react-native';
import Animated, { FadeIn, ZoomIn } from 'react-native-reanimated';
import { haptic } from '../utils/haptic';
import { track } from '../utils/analytics';
import { t } from '../utils/i18n';

interface Props {
    visible: boolean;
    onClose: () => void;
}

const REASONS = [
    'too_expensive',
    'not_enough_use',
    'missing_feature',
    'found_better_app',
    'other',
] as const;

export function CancellationSurveyModal({ visible, onClose }: Props) {
    const handlePick = (reason: typeof REASONS[number]) => {
        haptic.light();
        track('subscription_cancellation_reason', { reason });
        onClose();
    };

    const handleSkip = () => {
        track('subscription_cancellation_reason', { reason: 'skipped' });
        onClose();
    };

    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={handleSkip}>
            <View style={styles.backdrop}>
                <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />

                <Animated.View entering={ZoomIn.duration(450).springify()} style={styles.dialog}>
                    <LinearGradient
                        colors={['rgba(244,63,94,0.16)', 'rgba(2,6,23,0.97)']}
                        style={StyleSheet.absoluteFill}
                        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                    />

                    <TouchableOpacity style={styles.closeBtn} onPress={handleSkip} hitSlop={12}>
                        <X size={22} color="#64748b" />
                    </TouchableOpacity>

                    <Animated.Text entering={FadeIn.delay(100)} style={styles.heading}>
                        {t('cancelSurvey.heading')}
                    </Animated.Text>

                    <Animated.Text entering={FadeIn.delay(180)} style={styles.body}>
                        {t('cancelSurvey.body')}
                    </Animated.Text>

                    <Animated.View entering={FadeIn.delay(280)} style={styles.reasons}>
                        {REASONS.map(reason => (
                            <TouchableOpacity
                                key={reason}
                                style={styles.reasonBtn}
                                onPress={() => handlePick(reason)}
                                activeOpacity={0.7}
                            >
                                <Text style={styles.reasonText}>{t(`cancelSurvey.reason_${reason}`)}</Text>
                            </TouchableOpacity>
                        ))}
                    </Animated.View>

                    <TouchableOpacity onPress={handleSkip} style={styles.dismissBtn}>
                        <Text style={styles.dismissText}>{t('cancelSurvey.skip')}</Text>
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
        borderColor: 'rgba(244,63,94,0.25)',
    },
    closeBtn: {
        position: 'absolute',
        top: 14,
        right: 14,
        zIndex: 2,
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
    reasons: {
        width: '100%',
        gap: 10,
        marginBottom: 16,
    },
    reasonBtn: {
        width: '100%',
        paddingVertical: 14,
        paddingHorizontal: 18,
        borderRadius: 16,
        backgroundColor: 'rgba(148,163,184,0.08)',
        borderWidth: 1,
        borderColor: 'rgba(148,163,184,0.18)',
    },
    reasonText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#e2e8f0',
        textAlign: 'center',
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
