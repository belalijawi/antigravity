/**
 * "What's New" modal — shown once after the user updates to a new version.
 * Drives adoption of newly-shipped features (otherwise users never know
 * they exist). Tapping a feature opens it (or the paywall, if premium + free user).
 */

import React from 'react';
import { Modal, View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { X, MapPin, BarChart2, Globe, Sparkles, Heart } from 'lucide-react-native';
import { useTheme } from '../context/ThemeContext';
import { haptic } from '../utils/haptic';
import { t } from '../utils/i18n';

export interface WhatsNewItem {
    icon: React.ComponentType<{ size: number; color: string }>;
    title: string;
    desc: string;
    premium?: boolean;
}

// Update this list each release. The version string must match app version.
export const WHATS_NEW_VERSION = '1.7.1';
export function getWhatsNewItems(): WhatsNewItem[] {
    return [
        {
            icon: MapPin,
            title: t('whatsNew.item1Title'),
            desc: t('whatsNew.item1Desc'),
            premium: true,
        },
        {
            icon: BarChart2,
            title: t('whatsNew.item2Title'),
            desc: t('whatsNew.item2Desc'),
            premium: true,
        },
        {
            icon: Globe,
            title: t('whatsNew.item3Title'),
            desc: t('whatsNew.item3Desc'),
        },
        {
            icon: Heart,
            title: t('whatsNew.item4Title'),
            desc: t('whatsNew.item4Desc'),
        },
    ];
}

interface Props {
    visible: boolean;
    onClose: () => void;
}

export function WhatsNewModal({ visible, onClose }: Props) {
    const { colors } = useTheme();
    const WHATS_NEW_ITEMS = getWhatsNewItems();

    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
            <View style={styles.backdrop}>
                <View style={[styles.sheet, { backgroundColor: '#0b1124', borderColor: colors.accent + '33' }]}>
                    <LinearGradient
                        colors={[colors.accent + '1a', 'transparent']}
                        style={StyleSheet.absoluteFill}
                        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                    />

                    <TouchableOpacity style={styles.closeBtn} onPress={onClose} hitSlop={12}>
                        <X size={20} color="#94a3b8" />
                    </TouchableOpacity>

                    <View style={styles.headerRow}>
                        <Sparkles size={22} color={colors.accent} />
                        <Text style={styles.title}>{t('whatsNew.title')}</Text>
                    </View>
                    <Text style={[styles.version, { color: colors.secondaryText }]}>{t('whatsNew.version', { v: WHATS_NEW_VERSION })}</Text>

                    <ScrollView style={{ maxHeight: 380 }} showsVerticalScrollIndicator={false}>
                        {WHATS_NEW_ITEMS.map((item, i) => {
                            const Icon = item.icon;
                            return (
                                <View key={i} style={styles.itemRow}>
                                    <View style={[styles.itemIcon, { backgroundColor: colors.accent + '18' }]}>
                                        <Icon size={20} color={colors.accent} />
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <View style={styles.itemTitleRow}>
                                            <Text style={styles.itemTitle}>{item.title}</Text>
                                            {item.premium && (
                                                <View style={[styles.premiumTag, { backgroundColor: colors.accent + '22' }]}>
                                                    <Text style={[styles.premiumTagText, { color: colors.accent }]}>{t('whatsNew.premiumTag')}</Text>
                                                </View>
                                            )}
                                        </View>
                                        <Text style={[styles.itemDesc, { color: colors.secondaryText }]}>{item.desc}</Text>
                                    </View>
                                </View>
                            );
                        })}
                    </ScrollView>

                    <TouchableOpacity
                        style={[styles.cta, { backgroundColor: colors.accent }]}
                        onPress={() => { haptic.light(); onClose(); }}
                        activeOpacity={0.85}
                    >
                        <Text style={styles.ctaText}>{t('whatsNew.explore')}</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    backdrop: {
        flex: 1, backgroundColor: 'rgba(2,6,23,0.8)',
        alignItems: 'center', justifyContent: 'center', padding: 24,
    },
    sheet: {
        width: '100%', maxWidth: 380, borderRadius: 24, borderWidth: 1,
        padding: 24, overflow: 'hidden',
    },
    closeBtn: { position: 'absolute', top: 16, right: 16, zIndex: 2 },
    headerRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    title: { color: '#f1f5f9', fontSize: 22, fontWeight: '900' },
    version: { fontSize: 12, fontWeight: '600', marginTop: 2, marginBottom: 18 },
    itemRow: { flexDirection: 'row', gap: 14, marginBottom: 18, alignItems: 'flex-start' },
    itemIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
    itemTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    itemTitle: { color: '#f1f5f9', fontSize: 15, fontWeight: '800' },
    premiumTag: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
    premiumTagText: { fontSize: 8, fontWeight: '900', letterSpacing: 0.5 },
    itemDesc: { fontSize: 13, lineHeight: 18, marginTop: 2 },
    cta: {
        marginTop: 8, paddingVertical: 15, borderRadius: 16,
        alignItems: 'center',
    },
    ctaText: { color: '#0a1228', fontSize: 16, fontWeight: '800' },
});
