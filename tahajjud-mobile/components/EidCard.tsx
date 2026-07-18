import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { GlassBg as BlurView } from './GlassBg';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Sparkles, X } from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../context/ThemeContext';
import { haptic } from '../utils/haptic';
import { getEidToday } from '../utils/hijri';
import { t } from '../utils/i18n';

const EID_GOLD = '#facc15';

/**
 * Eid greeting card — surfaces on Eid al-Fitr (1st of Shawwal) and the days
 * of Eid al-Adha (10th–12th of Dhul Hijjah). Detection uses the Umm al-Qura
 * Hijri calendar via `Intl.DateTimeFormat`, with ±1-day tolerance for
 * regional moonsighting differences.
 *
 * Sits as a standalone card on the home tab (same pattern as the Friday
 * Al-Kahf card) — does NOT take over the main hero portal, so the user's
 * normal night-prayer context stays in place.
 */
export function EidCard() {
    const { cardBg, blurIntensity } = useTheme();
    const eid = getEidToday();
    const [dismissed, setDismissed] = useState(false);

    const todayKey = new Date().toISOString().slice(0, 10);
    const dismissKey = eid ? `eid-card-dismissed-${todayKey}` : null;

    useEffect(() => {
        if (!dismissKey) return;
        AsyncStorage.getItem(dismissKey).then(v => {
            if (v === '1') setDismissed(true);
        }).catch(() => {});
    }, [dismissKey]);

    if (!eid || dismissed) return null;

    const handleDismiss = async () => {
        haptic.light();
        setDismissed(true);
        if (dismissKey) {
            try { await AsyncStorage.setItem(dismissKey, '1'); } catch { /* ignore */ }
        }
    };

    // Eid al-Adha spans 3 days — show which day of Eid we're on.
    const dayLabel = eid.kind === 'adha' && eid.day > 1 ? t('eidCard.dayN', { n: eid.day }) : '';

    return (
        <Animated.View entering={FadeInDown.duration(500)} style={styles.wrap}>
            <View style={[styles.card, { borderColor: EID_GOLD + '66' }]}>
                <LinearGradient
                    colors={['rgba(250,204,21,0.18)', 'rgba(250,204,21,0.04)', 'transparent']}
                    style={StyleSheet.absoluteFill}
                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                />
                <BlurView intensity={Math.round(15 * blurIntensity)} tint="dark" style={[StyleSheet.absoluteFill, { backgroundColor: cardBg }]} />

                <View style={styles.content}>
                    <View style={styles.headerRow}>
                        <View style={[styles.iconWrap, { backgroundColor: EID_GOLD + '22', borderColor: EID_GOLD + '66' }]}>
                            <Sparkles size={14} color={EID_GOLD} />
                        </View>
                        <Text style={styles.kicker}>{eid.label.toUpperCase()}{dayLabel}</Text>
                        <TouchableOpacity onPress={handleDismiss} style={styles.dismissBtn} hitSlop={10}>
                            <X size={14} color="#94a3b8" />
                        </TouchableOpacity>
                    </View>

                    <Text style={styles.eidMubarak}>{t('eidCard.eidMubarak')}</Text>

                    <View style={styles.takbeerWrap}>
                        <Text style={styles.arabic}>اللهُ أَكْبَر</Text>
                        <Text style={styles.transliteration}>taqabbal Allahu minna wa minkum</Text>
                        <Text style={styles.meaning}>{t('eidCard.meaning')}</Text>
                    </View>
                </View>
            </View>
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    wrap: { marginHorizontal: 16, marginTop: 12, marginBottom: 4 },
    card: {
        borderRadius: 20,
        borderWidth: 1,
        padding: 20,
        overflow: 'hidden',
    },
    content: { gap: 14 },
    headerRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    iconWrap: {
        width: 24, height: 24, borderRadius: 12, borderWidth: 1,
        alignItems: 'center', justifyContent: 'center',
    },
    kicker: { flex: 1, fontSize: 11, fontWeight: '800', letterSpacing: 1.4, color: EID_GOLD },
    dismissBtn: { padding: 2 },
    eidMubarak: {
        fontSize: 36,
        fontWeight: '900',
        color: EID_GOLD,
        letterSpacing: -0.5,
        textAlign: 'center',
    },
    takbeerWrap: {
        alignItems: 'center',
        gap: 4,
        paddingTop: 4,
    },
    arabic: {
        fontSize: 28,
        color: '#f8fafc',
        fontWeight: '600',
    },
    transliteration: {
        fontSize: 13,
        color: '#cbd5e1',
        fontStyle: 'italic',
        fontWeight: '600',
    },
    meaning: {
        fontSize: 12,
        color: '#64748b',
        fontWeight: '500',
        marginTop: 2,
    },
});
