import React from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Megaphone } from 'lucide-react-native';
import { useTheme } from '../context/ThemeContext';
import { haptic } from '../utils/haptic';
import { t } from '../utils/i18n';
import type { Announcement } from '../utils/announcements';

interface Props {
    visible: boolean;
    announcement: Announcement | null;
    onDismiss: () => void;
}

/** Shown once per published announcement — remote-controlled (see
 * utils/announcements.ts), not tied to an app version like WhatsNewModal. */
export function AnnouncementModal({ visible, announcement, onDismiss }: Props) {
    const { colors } = useTheme();
    if (!announcement) return null;

    return (
        <Modal visible={visible} animationType="fade" transparent onRequestClose={onDismiss}>
            <View style={styles.overlay}>
                <View style={[styles.card, { borderColor: colors.accent + '33' }]}>
                    <LinearGradient colors={['#0d1230', '#080b1e']} style={StyleSheet.absoluteFill} />
                    <View style={[styles.iconWrap, { backgroundColor: colors.accent + '1a', borderColor: colors.accent + '44' }]}>
                        <Megaphone size={22} color={colors.accent} />
                    </View>
                    <Text style={[styles.title, { color: colors.primaryText }]}>{announcement.title}</Text>
                    {!!announcement.body && (
                        <Text style={[styles.body, { color: colors.secondaryText }]}>{announcement.body}</Text>
                    )}
                    <TouchableOpacity
                        onPress={() => { haptic.light(); onDismiss(); }}
                        style={[styles.btn, { backgroundColor: colors.accent }]}
                        accessibilityRole="button"
                    >
                        <Text style={styles.btnText}>{t('announcement.dismiss')}</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1, backgroundColor: 'rgba(0,0,0,0.6)',
        alignItems: 'center', justifyContent: 'center', padding: 28,
    },
    card: {
        width: '100%', maxWidth: 360, borderRadius: 20, borderWidth: 1,
        padding: 24, alignItems: 'center', overflow: 'hidden',
    },
    iconWrap: {
        width: 48, height: 48, borderRadius: 24, borderWidth: 1,
        alignItems: 'center', justifyContent: 'center', marginBottom: 14,
    },
    title: { fontSize: 17, fontWeight: '800', textAlign: 'center', marginBottom: 8 },
    body: { fontSize: 14, lineHeight: 21, textAlign: 'center', marginBottom: 20 },
    btn: { paddingHorizontal: 28, paddingVertical: 12, borderRadius: 14, width: '100%', alignItems: 'center' },
    btnText: { color: '#0a1228', fontSize: 14, fontWeight: '800' },
});
