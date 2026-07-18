import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { GlassBg as BlurView } from './GlassBg';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { BookOpen, X } from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../context/ThemeContext';
import { haptic } from '../utils/haptic';
import { t } from '../utils/i18n';

interface Props {
    onOpenKahf: () => void;
}

/**
 * Friday surfacing for Surah Al-Kahf.
 *
 * Hadith: «من قرأ سورة الكهف يوم الجمعة، أضاء له من النور ما بين الجمعتين»
 * "Whoever reads Surah Al-Kahf on Friday, light shines for them between
 *  the two Fridays." — al-Hakim, sahih.
 *
 * Only shows on Fridays (local time). User can dismiss for the day. Visible
 * from Thursday maghrib through Friday maghrib would be more correct in the
 * Islamic sense, but most users think of "Friday" as the Gregorian day, so
 * we use that for clarity.
 */
export function FridayKahfCard({ onOpenKahf }: Props) {
    const { colors, cardBg, blurIntensity } = useTheme();
    const [dismissed, setDismissed] = useState(false);

    const today = new Date();
    const isFriday = today.getDay() === 5;
    const todayKey = today.toISOString().slice(0, 10);
    const dismissKey = `kahf-card-dismissed-${todayKey}`;

    useEffect(() => {
        if (!isFriday) return;
        AsyncStorage.getItem(dismissKey).then(v => {
            if (v === '1') setDismissed(true);
        }).catch(() => {});
    }, [isFriday, dismissKey]);

    if (!isFriday || dismissed) return null;

    const handleDismiss = async () => {
        haptic.light();
        setDismissed(true);
        try { await AsyncStorage.setItem(dismissKey, '1'); } catch { /* ignore */ }
    };

    const handleOpen = () => {
        haptic.medium();
        onOpenKahf();
    };

    return (
        <Animated.View entering={FadeInDown.duration(500)} style={styles.wrap}>
            <View style={[styles.card, { borderColor: '#facc1555' }]}>
                <LinearGradient
                    colors={['rgba(250,204,21,0.10)', 'rgba(250,204,21,0.02)', 'transparent']}
                    style={StyleSheet.absoluteFill}
                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                />
                <BlurView intensity={Math.round(15 * blurIntensity)} tint="dark" style={[StyleSheet.absoluteFill, { backgroundColor: cardBg }]} />

                <View style={styles.content}>
                    <View style={styles.headerRow}>
                        <View style={[styles.iconWrap, { backgroundColor: '#facc1522', borderColor: '#facc1555' }]}>
                            <BookOpen size={14} color="#facc15" />
                        </View>
                        <Text style={styles.kicker}>{t('fridayCard.kicker')}</Text>
                        <TouchableOpacity onPress={handleDismiss} style={styles.dismissBtn} hitSlop={10}>
                            <X size={14} color={colors.secondaryText} />
                        </TouchableOpacity>
                    </View>

                    <Text style={styles.quote}>
                        {t('fridayCard.quote')}
                    </Text>
                    <Text style={styles.attribution}>{t('fridayCard.attribution')}</Text>

                    <TouchableOpacity
                        onPress={handleOpen}
                        activeOpacity={0.85}
                        style={[styles.openBtn, { backgroundColor: '#facc15' }]}
                    >
                        <Text style={styles.openBtnText}>{t('fridayCard.readBtn')}</Text>
                    </TouchableOpacity>
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
        padding: 18,
        overflow: 'hidden',
    },
    content: { gap: 12 },
    headerRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    iconWrap: {
        width: 24, height: 24, borderRadius: 12, borderWidth: 1,
        alignItems: 'center', justifyContent: 'center',
    },
    kicker: { flex: 1, fontSize: 11, fontWeight: '800', letterSpacing: 1.4, color: '#facc15' },
    dismissBtn: { padding: 2 },
    quote: { color: '#e2e8f0', fontSize: 14, lineHeight: 21, fontStyle: 'italic' },
    attribution: { color: '#64748b', fontSize: 11, fontWeight: '600' },
    openBtn: {
        marginTop: 4,
        paddingVertical: 12,
        borderRadius: 12,
        alignItems: 'center',
    },
    openBtnText: { color: '#0a1228', fontSize: 14, fontWeight: '800' },
});
