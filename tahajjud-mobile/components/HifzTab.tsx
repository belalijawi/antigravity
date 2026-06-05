import React, { useCallback, useState } from 'react';
import {
    View, Text, StyleSheet, TouchableOpacity, ActivityIndicator,
    FlatList, Modal, TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Brain, Flame, Target, Search, ChevronRight } from 'lucide-react-native';
import { useFocusEffect } from '@react-navigation/native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { QuranService, SurahMeta } from '../services/QuranService';
import { HifzSession } from './HifzSession';
import { fuzzyMatch } from '../utils/fuzzy';
import { useTheme } from '../context/ThemeContext';
import { tabletContentStyle } from '../utils/layout';
import {
    getAllHifzData, getStreakData, getDailyGoal, getTodayProgress,
    StreakData, HifzAyah,
} from '../utils/hifzStorage';
import { scheduleHifzNotifications, requestHifzNotificationPermission } from '../utils/hifzNotifications';

function countDueNow(ayahs: HifzAyah[]): number {
    const now = new Date();
    return ayahs.filter(a => new Date(a.nextReview) <= now).length;
}

interface SurahHifzStats {
    started: number;
    mastered: number;
    total: number;
}

export function HifzTab({ embedded = false }: { embedded?: boolean }) {
    const { colors, cardBg, blurIntensity } = useTheme();

    const [surahs, setSurahs] = useState<SurahMeta[]>([]);
    const [filteredSurahs, setFilteredSurahs] = useState<SurahMeta[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');

    const [statsMap, setStatsMap] = useState<Record<number, SurahHifzStats>>({});
    const [dueMap, setDueMap] = useState<Record<number, number>>({}); // surahNumber → due count
    const [streakData, setStreakData] = useState<StreakData>({ lastPracticeDate: '', currentStreak: 0, longestStreak: 0 });
    const [dailyGoal, setDailyGoal] = useState(5);
    const [todayProgress, setTodayProgress] = useState(0);

    const [selectedSurah, setSelectedSurah] = useState<SurahMeta | null>(null);

    const loadData = useCallback(async () => {
        setLoading(true);
        const [list, allHifz, streak, goal, progress] = await Promise.all([
            QuranService.getSurahList(),
            getAllHifzData(),
            getStreakData(),
            getDailyGoal(),
            getTodayProgress(),
        ]);

        setSurahs(list);
        setFilteredSurahs(list);
        setStreakData(streak);
        setDailyGoal(goal);
        setTodayProgress(progress);

        // Build per-surah stats + due counts
        const map: Record<number, SurahHifzStats> = {};
        const due: Record<number, number> = {};
        const allAyahs = Object.values(allHifz as Record<string, HifzAyah>);
        allAyahs.forEach(a => {
            if (!map[a.surahNumber]) map[a.surahNumber] = { started: 0, mastered: 0, total: 0 };
            map[a.surahNumber].started++;
            if (a.level === 5) map[a.surahNumber].mastered++;
        });
        list.forEach(s => {
            if (!map[s.number]) map[s.number] = { started: 0, mastered: 0, total: s.numberOfAyahs };
            else map[s.number].total = s.numberOfAyahs;
            const surahAyahs = allAyahs.filter(a => a.surahNumber === s.number);
            const dueCount = countDueNow(surahAyahs);
            if (dueCount > 0) due[s.number] = dueCount;
        });
        setStatsMap(map);
        setDueMap(due);
        setLoading(false);
        // Keep notification schedule up to date
        requestHifzNotificationPermission().then(granted => {
            if (granted) scheduleHifzNotifications(allHifz as Record<string, HifzAyah>);
        }).catch(() => {});
    }, []);

    // Reload every time the tab is focused
    useFocusEffect(useCallback(() => { loadData(); }, [loadData]));

    const handleSearch = (text: string) => {
        setSearchQuery(text);
        if (!text.trim()) { setFilteredSurahs(surahs); return; }
        setFilteredSurahs(
            surahs.filter(s =>
                s.number.toString() === text.trim() ||
                fuzzyMatch(text, s.englishName, s.englishNameTranslation, s.name)
            )
        );
    };

    const goalDone = todayProgress >= dailyGoal;

    // Sort: surahs with progress float to top
    const sortedSurahs = [...filteredSurahs].sort((a, b) => {
        const aHas = (statsMap[a.number]?.started ?? 0) > 0 ? 1 : 0;
        const bHas = (statsMap[b.number]?.started ?? 0) > 0 ? 1 : 0;
        if (aHas !== bHas) return bHas - aHas;
        return a.number - b.number;
    });

    const totalStarted = Object.values(statsMap).reduce((s, v) => s + (v.started > 0 ? 1 : 0), 0);
    const totalMastered = Object.values(statsMap).reduce((s, v) => s + v.mastered, 0);
    const totalDue = Object.values(dueMap).reduce((s, v) => s + v, 0);

    const renderItem = ({ item, index }: { item: SurahMeta; index: number }) => {
        const stats = statsMap[item.number] ?? { started: 0, mastered: 0, total: item.numberOfAyahs };
        const hasProgress = stats.started > 0;
        const progress = stats.total > 0 ? stats.started / stats.total : 0;
        const masteredFrac = stats.total > 0 ? stats.mastered / stats.total : 0;
        const dueCount = dueMap[item.number] ?? 0;

        return (
            <Animated.View entering={FadeInDown.duration(400).delay(Math.min(index, 20) * 30)}>
                <TouchableOpacity
                    style={styles.card}
                    onPress={() => setSelectedSurah(item)}
                    activeOpacity={0.75}
                >
                    <BlurView
                        intensity={Math.round(15 * blurIntensity)}
                        tint="dark"
                        style={[StyleSheet.absoluteFill, { backgroundColor: cardBg, borderRadius: 20 }]}
                    />
                    {hasProgress && (
                        <LinearGradient
                            colors={['rgba(34,211,238,0.06)', 'transparent']}
                            style={StyleSheet.absoluteFill}
                        />
                    )}

                    <View style={styles.cardLeft}>
                        <View style={[styles.numBadge, hasProgress && { backgroundColor: colors.accent + '22', borderColor: colors.accent + '55' }]}>
                            <Text style={[styles.numText, hasProgress && { color: colors.accent }]}>{item.number}</Text>
                        </View>
                        <View style={styles.cardText}>
                            <Text style={[styles.surahName, { color: colors.primaryText }]}>{item.englishName}</Text>
                            <Text style={styles.surahSub}>{item.englishNameTranslation}  ·  {item.numberOfAyahs} ayahs</Text>
                        </View>
                    </View>

                    <View style={styles.cardRight}>
                        {dueCount > 0 && (
                            <View style={styles.dueBadge}>
                                <Text style={styles.dueBadgeText}>{dueCount}</Text>
                            </View>
                        )}
                        {hasProgress ? (
                            <View style={styles.progressGroup}>
                                {/* Bar */}
                                <View style={styles.progressTrack}>
                                    {/* mastered (green) portion */}
                                    <View style={[styles.progressFill, { width: `${masteredFrac * 100}%`, backgroundColor: '#22c55e' }]} />
                                    {/* started (accent) portion on top of mastered */}
                                    <View style={[
                                        StyleSheet.absoluteFill,
                                        { width: `${progress * 100}%`, backgroundColor: colors.accent + '55', borderRadius: 4 },
                                    ]} />
                                </View>
                                <Text style={styles.progressLabel}>
                                    {stats.started}/{stats.total}
                                    {stats.mastered > 0 ? `  ·  ${stats.mastered} ✓` : ''}
                                </Text>
                            </View>
                        ) : (
                            <Text style={styles.startLabel}>Start</Text>
                        )}
                        <ChevronRight color="#334155" size={16} />
                    </View>
                </TouchableOpacity>
            </Animated.View>
        );
    };

    const Wrapper = embedded ? View : SafeAreaView;
    const wrapperProps = embedded ? {} : { edges: ['top', 'left', 'right'] as const };

    return (
        <Wrapper style={styles.container} {...wrapperProps}>
            <View style={[styles.container, tabletContentStyle()]}>

                {/* Header — hidden when embedded (host provides it) */}
                {!embedded && (
                    <View style={styles.header}>
                        <Brain color={colors.accent} size={26} />
                        <View style={{ flex: 1, marginLeft: 12 }}>
                            <Text style={[styles.title, { color: colors.accent }]}>Hifz Mode</Text>
                            <Text style={styles.subtitle}>Memorise the Quran</Text>
                        </View>
                    </View>
                )}

                {/* Due reviews banner */}
                {!loading && totalDue > 0 && (
                    <Animated.View entering={FadeInDown.duration(400)} style={styles.dueBanner}>
                        <Text style={styles.dueBannerEmoji}>🔔</Text>
                        <Text style={styles.dueBannerText}>
                            <Text style={styles.dueBannerCount}>{totalDue} ayah{totalDue !== 1 ? 's' : ''}</Text>
                            {' '}due for review — tap a surah to start
                        </Text>
                    </Animated.View>
                )}

                {/* Streak + Goal + Stats */}
                {!loading && (
                    <Animated.View entering={FadeInDown.duration(500)} style={styles.statsRow}>
                        <View style={[styles.statCard, { borderColor: streakData.currentStreak > 0 ? '#f9741655' : 'rgba(255,255,255,0.08)' }]}>
                            <Flame color={streakData.currentStreak > 0 ? '#f97316' : '#475569'} size={18} />
                            <Text style={[styles.statNum, { color: streakData.currentStreak > 0 ? '#f97316' : '#475569' }]}>{streakData.currentStreak}</Text>
                            <Text style={styles.statLabel}>streak</Text>
                        </View>
                        <View style={[styles.statCard, { borderColor: goalDone ? '#22c55e55' : 'rgba(255,255,255,0.08)' }]}>
                            <Target color={goalDone ? '#22c55e' : '#94a3b8'} size={18} />
                            <Text style={[styles.statNum, { color: goalDone ? '#22c55e' : colors.primaryText }]}>{todayProgress}/{dailyGoal}</Text>
                            <Text style={styles.statLabel}>today</Text>
                        </View>
                        <View style={[styles.statCard, { borderColor: 'rgba(255,255,255,0.08)' }]}>
                            <Brain color={colors.accent} size={18} />
                            <Text style={[styles.statNum, { color: colors.accent }]}>{totalStarted}</Text>
                            <Text style={styles.statLabel}>surahs</Text>
                        </View>
                        <View style={[styles.statCard, { borderColor: totalMastered > 0 ? '#22c55e55' : 'rgba(255,255,255,0.08)' }]}>
                            <Text style={[styles.statNum, { color: '#22c55e', fontSize: 18 }]}>✓</Text>
                            <Text style={[styles.statNum, { color: '#22c55e' }]}>{totalMastered}</Text>
                            <Text style={styles.statLabel}>mastered</Text>
                        </View>
                    </Animated.View>
                )}

                {/* Search */}
                <View style={styles.searchBox}>
                    <Search color="#475569" size={16} />
                    <TextInput
                        style={styles.searchInput}
                        placeholder="Search surah..."
                        placeholderTextColor="#334155"
                        value={searchQuery}
                        onChangeText={handleSearch}
                        maxFontSizeMultiplier={1.2}
                    />
                </View>

                {loading ? (
                    <ActivityIndicator size="large" color={colors.accent} style={{ marginTop: 60 }} />
                ) : (
                    <FlatList
                        data={sortedSurahs}
                        keyExtractor={s => s.number.toString()}
                        renderItem={renderItem}
                        contentContainerStyle={styles.listContent}
                        showsVerticalScrollIndicator={false}
                        keyboardShouldPersistTaps="handled"
                        ListHeaderComponent={
                            totalStarted === 0 && !searchQuery ? (
                                <Animated.View entering={FadeInDown.duration(600)} style={styles.emptyCard}>
                                    <Brain color={colors.accent} size={36} />
                                    <Text style={[styles.emptyTitle, { color: colors.primaryText }]}>Start Your Hifz Journey</Text>
                                    <Text style={styles.emptyBody}>
                                        Pick any surah below and tap <Text style={{ color: colors.accent, fontWeight: '700' }}>Add New Ayahs</Text> to begin memorising with spaced repetition.
                                    </Text>
                                </Animated.View>
                            ) : null
                        }
                    />
                )}
            </View>

            {/* HifzSession modal */}
            <Modal
                animationType="slide"
                transparent={false}
                visible={!!selectedSurah}
                onRequestClose={() => setSelectedSurah(null)}
            >
                {selectedSurah && (
                    <HifzSession
                        surahNumber={selectedSurah.number}
                        surahName={selectedSurah.englishName}
                        surahNameTranslation={selectedSurah.englishNameTranslation}
                        totalAyahs={selectedSurah.numberOfAyahs}
                        onClose={() => { setSelectedSurah(null); loadData(); }}
                    />
                )}
            </Modal>
        </Wrapper>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: 'transparent' },

    dueBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        marginHorizontal: 20,
        marginBottom: 12,
        backgroundColor: 'rgba(239,68,68,0.1)',
        borderRadius: 14,
        borderWidth: 1,
        borderColor: 'rgba(239,68,68,0.3)',
        paddingHorizontal: 14,
        paddingVertical: 12,
    },
    dueBannerEmoji: { fontSize: 18 },
    dueBannerText: { flex: 1, color: '#fca5a5', fontSize: 13, fontWeight: '600' },
    dueBannerCount: { color: '#ef4444', fontWeight: '900' },

    dueBadge: {
        backgroundColor: '#ef444433',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#ef444466',
        paddingHorizontal: 7,
        paddingVertical: 3,
        marginRight: 4,
    },
    dueBadgeText: { color: '#ef4444', fontSize: 11, fontWeight: '900' },

    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingTop: 8,
        paddingBottom: 16,
    },
    title: { fontSize: 22, fontWeight: '900' },
    subtitle: { color: '#475569', fontSize: 12, fontWeight: '600', marginTop: 1 },

    statsRow: {
        flexDirection: 'row',
        gap: 8,
        paddingHorizontal: 20,
        marginBottom: 14,
    },
    statCard: {
        flex: 1,
        backgroundColor: 'rgba(255,255,255,0.04)',
        borderRadius: 14,
        borderWidth: 1,
        paddingVertical: 10,
        alignItems: 'center',
        gap: 3,
    },
    statNum: { fontSize: 16, fontWeight: '900', color: '#f8fafc' },
    statLabel: { color: '#475569', fontSize: 10, fontWeight: '700' },

    searchBox: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        marginHorizontal: 20,
        marginBottom: 12,
        backgroundColor: 'rgba(255,255,255,0.04)',
        borderRadius: 14,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.08)',
        paddingHorizontal: 14,
        paddingVertical: 12,
        minHeight: 44,
    },
    searchInput: { flex: 1, color: '#f8fafc', fontSize: 14, lineHeight: 20 },

    listContent: { paddingHorizontal: 20, paddingBottom: 120, gap: 8 },

    card: {
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: 20,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.07)',
        overflow: 'hidden',
        paddingHorizontal: 14,
        paddingVertical: 14,
        gap: 12,
    },
    cardLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
    numBadge: {
        width: 38,
        height: 38,
        borderRadius: 11,
        backgroundColor: 'rgba(255,255,255,0.06)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    numText: { color: '#94a3b8', fontSize: 13, fontWeight: '800' },
    cardText: { flex: 1, gap: 2 },
    surahName: { fontSize: 15, fontWeight: '800' },
    surahSub: { color: '#475569', fontSize: 12, fontWeight: '600' },

    cardRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    progressGroup: { alignItems: 'flex-end', gap: 4 },
    progressTrack: {
        width: 72,
        height: 5,
        borderRadius: 4,
        backgroundColor: 'rgba(255,255,255,0.08)',
        overflow: 'hidden',
    },
    progressFill: { height: '100%', borderRadius: 4 },
    progressLabel: { color: '#64748b', fontSize: 10, fontWeight: '700' },
    startLabel: { color: '#334155', fontSize: 12, fontWeight: '700' },

    emptyCard: {
        backgroundColor: 'rgba(255,255,255,0.03)',
        borderRadius: 24,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.07)',
        padding: 28,
        alignItems: 'center',
        gap: 10,
        marginBottom: 16,
    },
    emptyTitle: { fontSize: 18, fontWeight: '900', textAlign: 'center' },
    emptyBody: { color: '#475569', fontSize: 14, lineHeight: 22, textAlign: 'center' },
});
