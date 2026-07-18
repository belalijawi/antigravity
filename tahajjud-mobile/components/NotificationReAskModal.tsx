import React, { useEffect, useState } from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, Linking } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Bell, X } from 'lucide-react-native';
import Animated, { FadeIn, ZoomIn } from 'react-native-reanimated';
import { haptic } from '../utils/haptic';
import { track } from '../utils/analytics';
import { t } from '../utils/i18n';
import { requestNotificationPermissions } from '../utils/notifications';
import { getNotificationPermissionStatus, markNotificationReAskShown } from '../utils/notificationReAsk';

interface Props {
    visible: boolean;
    tahajjudCount: number;
    onClose: () => void;
}

export function NotificationReAskModal({ visible, tahajjudCount, onClose }: Props) {
    const [working, setWorking] = useState(false);

    useEffect(() => {
        if (visible) {
            haptic.light();
            track('notification_reask_shown');
        }
    }, [visible]);

    const finish = () => {
        markNotificationReAskShown().catch(() => {});
        onClose();
    };

    const handleEnable = async () => {
        if (working) return;
        setWorking(true);
        haptic.medium();
        try {
            // iOS never re-shows the native permission dialog once a user has
            // explicitly denied it — the only way back is Settings. If they
            // were never asked (undetermined), the request itself works fine.
            const status = await getNotificationPermissionStatus();
            if (status === 'denied') {
                track('notification_reask_opened_settings');
                Linking.openSettings();
            } else {
                const granted = await requestNotificationPermissions();
                track('notification_reask_result', { granted });
            }
        } finally {
            setWorking(false);
            finish();
        }
    };

    const handleDismiss = () => {
        track('notification_reask_dismissed');
        finish();
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

                    <Animated.View entering={FadeIn.delay(100)} style={styles.iconWrap}>
                        <Bell size={28} color="#818cf8" />
                    </Animated.View>

                    <Animated.Text entering={FadeIn.delay(150)} style={styles.heading}>
                        {t('notifReask.heading')}
                    </Animated.Text>

                    <Animated.Text entering={FadeIn.delay(250)} style={styles.body}>
                        {t('notifReask.body', { count: String(tahajjudCount) })}
                    </Animated.Text>

                    <Animated.View entering={FadeIn.delay(400)} style={styles.btns}>
                        <TouchableOpacity style={styles.enableBtn} onPress={handleEnable} disabled={working} activeOpacity={0.85}>
                            <LinearGradient
                                colors={['rgba(99,102,241,0.9)', 'rgba(139,92,246,0.9)']}
                                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                                style={StyleSheet.absoluteFill}
                            />
                            <Text style={styles.enableBtnText}>{t('notifReask.enableBtn')}</Text>
                        </TouchableOpacity>

                        <TouchableOpacity onPress={handleDismiss} style={styles.dismissBtn}>
                            <Text style={styles.dismissText}>{t('notifReask.maybeLater')}</Text>
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
    iconWrap: {
        width: 64, height: 64, borderRadius: 32,
        backgroundColor: 'rgba(129,140,248,0.15)',
        borderWidth: 1, borderColor: 'rgba(129,140,248,0.35)',
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
    enableBtn: {
        overflow: 'hidden',
        borderRadius: 999,
        width: '100%',
        height: 52,
        justifyContent: 'center',
        alignItems: 'center',
    },
    enableBtnText: {
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
