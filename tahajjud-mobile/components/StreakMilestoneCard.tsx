import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Moon, Flame } from 'lucide-react-native';
import { t } from '../utils/i18n';

interface StreakMilestoneCardProps {
    nights: number;
    accent?: string;
}

export const StreakMilestoneCard = React.forwardRef<View, StreakMilestoneCardProps>(({ nights, accent = '#facc15' }, ref) => {
    return (
        <View ref={ref} style={styles.cardContainer} collapsable={false}>
            <View style={styles.background} />
            <View style={styles.content}>
                <View style={styles.header}>
                    <Moon size={28} color="#f8fafc" fill="#f8fafc" />
                    <Text style={[styles.appName, { color: accent }]}>Tahajjud+</Text>
                </View>

                <View style={styles.centerBlock}>
                    <View style={styles.flameRow}>
                        <Flame size={64} color={accent} />
                    </View>
                    <Text style={[styles.bigNumber, { color: accent }]}>{nights}</Text>
                    <Text style={styles.unit}>{nights === 1 ? t('streakCard.night') : t('streakModal.nightsLabel')}</Text>
                    <View style={[styles.divider, { backgroundColor: accent }]} />
                    <Text style={styles.tagline}>
                        {t('streakCard.tagline')}
                    </Text>
                </View>

                <View style={styles.footer}>
                    <Text style={styles.duaArabic}>اللهم تقبل</Text>
                    <Text style={styles.duaTranslit}>Allahumma taqabbal</Text>
                    <Text style={styles.duaMeaning}>{t('streakCard.duaMeaning')}</Text>
                </View>
            </View>
        </View>
    );
});

const styles = StyleSheet.create({
    cardContainer: {
        width: 1080,
        height: 1920,
        backgroundColor: '#020617',
        alignItems: 'center',
        justifyContent: 'center',
    },
    background: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: '#020617',
    },
    content: {
        width: '100%',
        height: '100%',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 120,
        paddingHorizontal: 80,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 18,
    },
    appName: {
        fontSize: 40,
        fontWeight: '900',
        letterSpacing: 3,
    },
    centerBlock: {
        alignItems: 'center',
        gap: 12,
    },
    flameRow: {
        marginBottom: 12,
    },
    bigNumber: {
        fontSize: 320,
        fontWeight: '900',
        lineHeight: 320,
        letterSpacing: -8,
    },
    unit: {
        fontSize: 56,
        fontWeight: '800',
        color: '#f8fafc',
        letterSpacing: 12,
        marginTop: 8,
    },
    divider: {
        width: 140,
        height: 4,
        borderRadius: 2,
        marginVertical: 40,
        opacity: 0.7,
    },
    tagline: {
        fontSize: 40,
        color: '#cbd5e1',
        textAlign: 'center',
        lineHeight: 56,
        fontStyle: 'italic',
        fontWeight: '500',
    },
    footer: {
        alignItems: 'center',
        gap: 12,
    },
    duaArabic: {
        fontSize: 64,
        color: '#f8fafc',
        fontWeight: '600',
    },
    duaTranslit: {
        fontSize: 28,
        color: '#94a3b8',
        fontWeight: '500',
        fontStyle: 'italic',
    },
    duaMeaning: {
        fontSize: 28,
        color: '#64748b',
        fontWeight: '500',
    },
});
