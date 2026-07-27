import React, { useState, useRef, useEffect } from 'react';
import { ScrollView, StyleSheet, View, Text, TouchableOpacity, DeviceEventEmitter } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { GlassBg as BlurView } from './GlassBg';
import { LinearGradient } from 'expo-linear-gradient';
import { Tracker } from './Tracker';
import { HistoryCalendar } from './HistoryCalendar';
import { QiblaCompass } from './QiblaCompass';
import { PrayerAnalytics } from './PrayerAnalytics';
import { tabletContentStyle } from '../utils/layout';
import { useTheme } from '../context/ThemeContext';
import { usePurchases } from '../context/PurchasesContext';
import { Lock } from 'lucide-react-native';
import { t, getLocale } from '../utils/i18n';
import { tc } from '../data/contentTranslations';

type PrayerSubTab = 'tracker' | 'history' | 'qibla' | 'stats';

function getTabs(): { key: PrayerSubTab; label: string; premium?: boolean }[] {
    return [
        { key: 'tracker', label: t('prayersTab.tabTracker') },
        { key: 'history', label: t('prayersTab.tabHistory') },
        { key: 'qibla',   label: t('prayersTab.tabQibla')   },
        { key: 'stats',   label: t('prayersTab.tabStats'), premium: true },
    ];
}

const PRAYER_QUOTES = [
    {
        arabic: null,
        text: 'The first of a person\'s deeds to be examined on the Day of Resurrection will be his prayer. If it is sound, the rest of his deeds will be sound. If it is corrupt, the rest of his deeds will be corrupt.',
        source: 'Tirmidhi 413 · Sahih',
    },
    {
        arabic: 'بَيْنَ الرَّجُلِ وَبَيْنَ الشِّرْكِ وَالْكُفْرِ تَرْكُ الصَّلَاةِ',
        text: 'Between a man and disbelief and polytheism is the abandonment of prayer.',
        source: 'Sahih Muslim 82',
    },
    {
        arabic: 'إِنَّ الصَّلَاةَ كَانَتْ عَلَى الْمُؤْمِنِينَ كِتَابًا مَّوْقُوتًا',
        text: 'Indeed, prayer has been decreed upon the believers a decree of specified times.',
        source: 'Quran 4:103',
    },
    {
        arabic: null,
        text: 'Whoever misses the Asr prayer, it is as though he has been deprived of his family and his property.',
        source: 'Bukhari 552 · Muslim 626',
    },
    {
        arabic: 'فَخَلَفَ مِن بَعْدِهِمْ خَلْفٌ أَضَاعُوا الصَّلَاةَ وَاتَّبَعُوا الشَّهَوَاتِ ۖ فَسَوْفَ يَلْقَوْنَ غَيًّا',
        text: 'Then there came after them successors who neglected prayer and pursued desires — so they are going to meet evil.',
        source: 'Quran 19:59',
    },
];

function PrayerQuotes() {
    const { colors, cardBg, blurIntensity } = useTheme();

    return (
        <View style={styles.quotesSection}>
            <Text style={[styles.quotesHeading, { color: colors.secondaryText }]}>
                {t('prayersTab.quotesHeading')}
            </Text>
            {PRAYER_QUOTES.map((q, i) => (
                <View key={i} style={styles.quoteCard}>
                    <BlurView
                        intensity={Math.round(14 * blurIntensity)}
                        tint="dark"
                        style={[StyleSheet.absoluteFill, { borderRadius: 18, backgroundColor: cardBg }]}
                    />
                    <LinearGradient
                        colors={['rgba(255,255,255,0.03)', 'transparent']}
                        style={[StyleSheet.absoluteFill, { borderRadius: 18 }]}
                    />
                    <View style={styles.quoteCardInner}>
                        {q.arabic && (
                            <Text style={[styles.quoteArabic, { color: colors.primaryText }]}>
                                {q.arabic}
                            </Text>
                        )}
                        <Text style={[styles.quoteText, { color: colors.primaryText }]}>
                            "{tc(`prayers.quote${i + 1}.text`, q.text)}"
                        </Text>
                        <View style={[styles.quoteDivider, { backgroundColor: colors.accent + '30' }]} />
                        <Text style={[styles.quoteSource, { color: colors.accent }]}>
                            — {q.source}
                        </Text>
                    </View>
                </View>
            ))}
        </View>
    );
}

export function PrayersTab() {
    const insets = useSafeAreaInsets();
    const { colors } = useTheme();
    const { isPremium, openPaywall } = usePurchases();
    const [activeTab, setActiveTab] = useState<PrayerSubTab>('tracker');
    const [statsIsNew, setStatsIsNew] = useState(false);
    const scrollRef = useRef<ScrollView>(null);
    const TABS = getTabs();

    // Show a "NEW" dot on Stats until the user has opened it — checked once on
    // mount. Dismissal happens synchronously in the onPress handler below so the
    // dot disappears the instant the user taps Stats (no async re-read race).
    useEffect(() => {
        import('../utils/featureDiscovery')
            .then(m => m.hasUsedFeature('prayer_analytics'))
            .then(used => setStatsIsNew(!used))
            .catch(() => {});
    }, []);

    useEffect(() => {
        const sub = DeviceEventEmitter.addListener('scrollToTop', (tab: string) => {
            if (tab === 'Prayers') scrollRef.current?.scrollTo({ y: 0, animated: true });
        });
        // Deep-link from feature discovery to a specific sub-tab
        const openSub = DeviceEventEmitter.addListener('prayers:openSubTab', (key: PrayerSubTab) => {
            // 'stats' is premium-gated; the discovery card already routed free
            // users to the paywall, so reaching here means they have access.
            setActiveTab(key);
        });
        return () => { sub.remove(); openSub.remove(); };
    }, []);

    return (
        <SafeAreaView style={styles.safe} edges={['top']}>
            {/* Page header */}
            <View style={[styles.header, tabletContentStyle()]}>
                <Text style={[styles.pageTitle, { color: colors.primaryText }]}>{t('prayersTab.title')}</Text>
                <Text style={[styles.pageDate, { color: colors.secondaryText }]}>
                    {new Date().toLocaleDateString(getLocale(), { weekday: 'long', month: 'long', day: 'numeric' })}
                </Text>

                {/* Sub-tab pills */}
                <View style={[styles.tabBar, { backgroundColor: 'rgba(255,255,255,0.03)', borderColor: 'rgba(255,255,255,0.06)' }]}>
                    {TABS.map(tab => {
                        const active = activeTab === tab.key;
                        const locked = tab.premium && !isPremium;
                        return (
                            <TouchableOpacity
                                key={tab.key}
                                onPress={() => {
                                    if (locked) { openPaywall('feature_gate:prayer_stats', 'prayer_analytics'); return; }
                                    setActiveTab(tab.key);
                                    if (tab.key === 'stats') {
                                        setStatsIsNew(false); // clear the NEW dot instantly
                                        import('../utils/featureDiscovery').then(m => m.markFeatureUsed('prayer_analytics')).catch(() => {});
                                    }
                                    if (tab.key === 'qibla') import('../utils/featureDiscovery').then(m => m.markFeatureUsed('qibla')).catch(() => {});
                                }}
                                style={[
                                    styles.tabPill,
                                    active && { backgroundColor: colors.accent },
                                ]}
                                activeOpacity={0.7}
                            >
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                    <Text style={[
                                        styles.tabLabel,
                                        { color: active ? '#020617' : locked ? '#334155' : colors.secondaryText },
                                    ]}>
                                        {tab.label}
                                    </Text>
                                    {locked && <Lock size={9} color="#f59e0b" />}
                                    {tab.key === 'stats' && statsIsNew && !active && (
                                        <View style={styles.newDot} />
                                    )}
                                </View>
                            </TouchableOpacity>
                        );
                    })}
                </View>
            </View>

            {/* Content */}
            <ScrollView
                ref={scrollRef}
                key={activeTab}
                contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 100 }]}
                showsVerticalScrollIndicator={false}
            >
                <View style={[styles.content, tabletContentStyle()]}>
                    {activeTab === 'tracker' && (
                        <>
                            <Tracker />
                            <PrayerQuotes />
                        </>
                    )}
                    {activeTab === 'history' && <HistoryCalendar />}
                    {activeTab === 'qibla'   && <QiblaCompass />}
                    {activeTab === 'stats'   && <PrayerAnalytics />}
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safe: {
        flex: 1,
        backgroundColor: 'transparent',
    },
    header: {
        paddingHorizontal: 20,
        paddingTop: 20,
        paddingBottom: 16,
        gap: 4,
    },
    pageTitle: {
        fontSize: 32,
        fontWeight: '900',
        letterSpacing: -0.5,
    },
    pageDate: {
        fontSize: 12,
        fontWeight: '600',
        textTransform: 'uppercase',
        letterSpacing: 1,
        marginBottom: 16,
    },
    tabBar: {
        flexDirection: 'row',
        borderRadius: 14,
        borderWidth: 1,
        padding: 4,
        gap: 4,
    },
    tabPill: {
        flex: 1,
        paddingVertical: 9,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
    },
    tabLabel: {
        fontSize: 13,
        fontWeight: '800',
        letterSpacing: 0.2,
    },
    newDot: {
        width: 6, height: 6, borderRadius: 3,
        backgroundColor: '#22c55e',
    },
    scroll: {
        flexGrow: 1,
    },
    content: {
        paddingHorizontal: 20,
        paddingTop: 8,
        gap: 16,
    },
    // ── Quotes ──────────────────────────────────────────────────────────
    quotesSection: {
        gap: 12,
        marginTop: 4,
    },
    quotesHeading: {
        fontSize: 10,
        fontWeight: '800',
        textTransform: 'uppercase',
        letterSpacing: 1.2,
        marginBottom: 4,
        marginLeft: 2,
    },
    quoteCard: {
        borderRadius: 18,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.07)',
        overflow: 'hidden',
    },
    quoteCardInner: {
        padding: 18,
        gap: 10,
    },
    quoteArabic: {
        fontSize: 17,
        fontWeight: '600',
        textAlign: 'right',
        lineHeight: 30,
        opacity: 0.9,
    },
    quoteText: {
        fontSize: 14,
        fontWeight: '500',
        lineHeight: 22,
        opacity: 0.9,
    },
    quoteDivider: {
        height: 1,
    },
    quoteSource: {
        fontSize: 11,
        fontWeight: '800',
        textTransform: 'uppercase',
        letterSpacing: 0.8,
    },
});
