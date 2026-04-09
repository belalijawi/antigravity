import * as React from 'react';
import { useEffect, useState, useRef } from 'react';
import { HifzTab } from './HifzTab';
import { Brain, BookOpen as BookOpenIcon } from 'lucide-react-native';
import { View, Text, FlatList, StyleSheet, TouchableOpacity, ActivityIndicator, TextInput, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { QuranService, SurahMeta } from '../services/QuranService';
import { SurahReader } from './SurahReader';
import { Search, Bookmark, BookOpen, Download, CheckCircle, Wifi, Trash2 } from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useTheme } from '../context/ThemeContext';
import { tabletContentStyle } from '../utils/layout';
import OfflineQuranService, { DownloadInfo } from '../services/OfflineQuranService';
import { usePurchases } from '../context/PurchasesContext';

export function QuranTab() {
    const { colors, cardBg, blurIntensity } = useTheme();
    const { isPremium, openPaywall } = usePurchases();
    const [surahs, setSurahs] = useState<SurahMeta[]>([]);
    const [filteredSurahs, setFilteredSurahs] = useState<SurahMeta[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedSurah, setSelectedSurah] = useState<number | null>(null);
    const [activeSubTab, setActiveSubTab] = useState<'quran' | 'hifz'>('quran');
    const [bookmark, setBookmark] = useState<{ surahNumber: number, edition: string, surahName: string, ayahNumber?: number } | null>(null);
    const [currentEdition, setCurrentEdition] = useState('en.sahih');
    const [dlMap, setDlMap] = useState<Record<number, DownloadInfo>>({});
    const unsubscribeRefs = useRef<Array<() => void>>([]);

    useEffect(() => {
        loadList();
        loadBookmark();
        OfflineQuranService.init();
        return () => {
            unsubscribeRefs.current.forEach(fn => fn());
        };
    }, []);

    const loadBookmark = async () => {
        try {
            const saved = await AsyncStorage.getItem('quran_last_read');
            if (saved) {
                const parsed = JSON.parse(saved);
                if (parsed && typeof parsed === 'object' && parsed.surahNumber) {
                    setBookmark(parsed);
                }
            }
        } catch (e) {
            console.error('Error loading bookmark:', e);
            setBookmark(null);
        }
    };

    const loadList = async () => {
        const list = await QuranService.getSurahList();
        setSurahs(list);
        setFilteredSurahs(list);
        setLoading(false);

        // Subscribe to download events for all surahs
        unsubscribeRefs.current.forEach(fn => fn());
        unsubscribeRefs.current = list.map(s =>
            OfflineQuranService.subscribe(s.number, (info) => {
                setDlMap(prev => ({ ...prev, [info.surahNumber]: info }));
            })
        );
        // Seed initial states
        const initial: Record<number, DownloadInfo> = {};
        list.forEach(s => {
            initial[s.number] = OfflineQuranService.getInfo(s.number);
        });
        setDlMap(initial);
    };

    const handleDownloadPress = (surahNumber: number, surahName: string) => {
        if (!isPremium) {
            openPaywall();
            return;
        }
        const info = dlMap[surahNumber] ?? OfflineQuranService.getInfo(surahNumber);
        if (info.status === 'downloaded') {
            Alert.alert(
                'Delete Offline Audio',
                `Remove the downloaded audio for ${surahName}?`,
                [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Delete', style: 'destructive', onPress: () => OfflineQuranService.delete(surahNumber) },
                ]
            );
            return;
        }
        if (info.status === 'downloading') {
            OfflineQuranService.cancelDownload(surahNumber);
            return;
        }
        OfflineQuranService.download(surahNumber);
    };

    const handleSearch = (text: string) => {
        setSearchQuery(text);
        if (text) {
            const filtered = surahs.filter(s =>
                s.englishName.toLowerCase().includes(text.toLowerCase()) ||
                s.englishNameTranslation.toLowerCase().includes(text.toLowerCase())
            );
            setFilteredSurahs(filtered);
        } else {
            setFilteredSurahs(surahs);
        }
    };

    if (selectedSurah) {
        return (
            <SurahReader
                surahNumber={selectedSurah}
                edition={currentEdition}
                onEditionChange={setCurrentEdition}
                onClose={() => {
                    setSelectedSurah(null);
                    loadBookmark();
                }}
            />
        );
    }

    return (
        <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
            <View style={[styles.container, tabletContentStyle()]}>
                <View style={styles.header}>
                    <Text style={[styles.title, { color: colors.accent }]}>The Holy Quran</Text>
                    <Text style={styles.subtitle}>Guidance for the heart</Text>
                </View>

                {/* Sub-tab switcher */}
                <View style={styles.subTabRow}>
                    <TouchableOpacity
                        style={[styles.subTab, activeSubTab === 'quran' && { backgroundColor: colors.accent + '22', borderColor: colors.accent + '66' }]}
                        onPress={() => setActiveSubTab('quran')}
                    >
                        <BookOpenIcon size={14} color={activeSubTab === 'quran' ? colors.accent : '#475569'} />
                        <Text style={[styles.subTabText, activeSubTab === 'quran' && { color: colors.accent }]}>Read</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.subTab, activeSubTab === 'hifz' && { backgroundColor: colors.accent + '22', borderColor: colors.accent + '66' }]}
                        onPress={() => setActiveSubTab('hifz')}
                    >
                        <Brain size={14} color={activeSubTab === 'hifz' ? colors.accent : '#475569'} />
                        <Text style={[styles.subTabText, activeSubTab === 'hifz' && { color: colors.accent }]}>Hifz</Text>
                    </TouchableOpacity>
                </View>

                {/* Hifz sub-tab */}
                {activeSubTab === 'hifz' && <HifzTab embedded />}

                {/* Quran sub-tab content */}
                {activeSubTab === 'quran' && bookmark && !searchQuery && (
                    <Animated.View
                        entering={FadeInDown.duration(800)}
                        style={styles.bookmarkWrapper}
                    >
                        <TouchableOpacity
                            style={styles.bookmarkCard}
                            onPress={() => {
                                if (bookmark) {
                                    setCurrentEdition(bookmark.edition);
                                    setSelectedSurah(bookmark.surahNumber);
                                }
                            }}
                        >
                            <BlurView intensity={Math.round(20 * blurIntensity)} tint="dark" style={[StyleSheet.absoluteFill, { backgroundColor: cardBg }]} />
                            <LinearGradient
                                colors={['rgba(248, 250, 252, 0.15)', 'transparent']}
                                style={StyleSheet.absoluteFill}
                            />
                            <View style={styles.bookmarkIconContainer}>
                                <BookOpen color={colors.primaryText} size={24} strokeWidth={2} />
                            </View>
                            <View style={styles.bookmarkContent}>
                                <Text style={styles.bookmarkLabel}>RESUME ASCENT</Text>
                                <Text style={[styles.bookmarkSurah, { color: colors.primaryText }]}>
                                    {bookmark.surahName} {bookmark.ayahNumber ? `• v${bookmark.ayahNumber}` : ''}
                                </Text>
                            </View>
                            <Bookmark color="#22d3ee" size={20} fill="#22d3ee" />
                        </TouchableOpacity>
                    </Animated.View>
                )}

                {activeSubTab === 'quran' && <View style={styles.searchContainer}>
                    <BlurView intensity={Math.round(10 * blurIntensity)} tint="dark" style={[StyleSheet.absoluteFill, { backgroundColor: cardBg }]} />
                    <Search color="#94a3b8" size={20} />
                    <TextInput
                        style={styles.input}
                        placeholder="Search by name..."
                        placeholderTextColor="rgba(255, 255, 255, 0.2)"
                        value={searchQuery}
                        onChangeText={handleSearch}
                    />
                </View>}

                {activeSubTab === 'quran' && (loading ? (
                    <ActivityIndicator size="large" color="#f8fafc" style={{ marginTop: 50 }} />
                ) : (
                    <FlatList
                        style={{ flex: 1 }}
                        data={filteredSurahs}
                        keyExtractor={(item) => item.number.toString()}
                        contentContainerStyle={styles.listContent}
                        showsVerticalScrollIndicator={false}
                        renderItem={({ item }) => {
                            const dlInfo = dlMap[item.number] ?? { surahNumber: item.number, status: 'none', progress: 0 };
                            const isDownloaded = dlInfo.status === 'downloaded';
                            const isDownloading = dlInfo.status === 'downloading';
                            return (
                            <TouchableOpacity
                                style={styles.card}
                                onPress={() => setSelectedSurah(item.number)}
                            >
                                <BlurView intensity={Math.round(15 * blurIntensity)} tint="dark" style={[StyleSheet.absoluteFill, { backgroundColor: cardBg }]} />
                                <LinearGradient
                                    colors={['rgba(255, 255, 255, 0.05)', 'transparent']}
                                    style={StyleSheet.absoluteFill}
                                />

                                <View style={styles.cardMain}>
                                    <View style={styles.numberBadge}>
                                        <Text style={styles.numberText}>{item.number}</Text>
                                    </View>
                                    <View style={styles.cardTextGroup}>
                                        <Text style={styles.surahName}>{item.englishName}</Text>
                                        <Text style={styles.surahTranslation}>{item.englishNameTranslation}</Text>
                                    </View>
                                    <View style={styles.cardEndGroup}>
                                        <Text style={styles.ayahCount}>{item.numberOfAyahs} v.</Text>
                                        <Text style={styles.revelationType}>{item.revelationType}</Text>
                                    </View>

                                    {/* Download button */}
                                    <TouchableOpacity
                                        style={styles.dlButton}
                                        onPress={() => handleDownloadPress(item.number, item.englishName)}
                                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                                    >
                                        {isDownloading ? (
                                            <View style={styles.dlProgressWrap}>
                                                <ActivityIndicator size="small" color={colors.accent} />
                                                <Text style={[styles.dlPct, { color: colors.accent }]}>
                                                    {Math.round(dlInfo.progress * 100)}%
                                                </Text>
                                            </View>
                                        ) : isDownloaded ? (
                                            <CheckCircle size={20} color={colors.accent} fill={colors.accent + '33'} />
                                        ) : (
                                            <Download size={18} color="#475569" />
                                        )}
                                    </TouchableOpacity>
                                </View>
                            </TouchableOpacity>
                            );
                        }}
                    />
                ))}
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: 'transparent',
    },
    header: {
        paddingTop: 32,
        paddingHorizontal: 24,
        paddingBottom: 12,
    },
    subTabRow: {
        flexDirection: 'row',
        gap: 8,
        paddingHorizontal: 20,
        marginBottom: 16,
    },
    subTab: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 12,
        backgroundColor: 'rgba(255,255,255,0.04)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.08)',
    },
    subTabText: {
        color: '#475569',
        fontSize: 13,
        fontWeight: '800',
    },
    title: {
        fontSize: 32,
        fontWeight: '900',
        color: '#facc15',
        letterSpacing: -1,
    },
    subtitle: {
        fontSize: 15,
        color: '#94a3b8',
        fontWeight: '600',
        marginTop: 4,
    },
    bookmarkWrapper: {
        paddingHorizontal: 20,
        marginBottom: 24,
    },
    bookmarkCard: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 20,
        borderRadius: 24,
        borderWidth: 1,
        borderColor: 'rgba(248, 250, 252, 0.3)',
        overflow: 'hidden',
    },
    bookmarkIconContainer: {
        width: 52,
        height: 52,
        borderRadius: 26,
        backgroundColor: 'rgba(248, 250, 252, 0.05)',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 16,
        borderWidth: 1,
        borderColor: 'rgba(248, 250, 252, 0.1)',
    },
    bookmarkContent: {
        flex: 1,
    },
    bookmarkLabel: {
        color: '#cbd5e1',
        fontSize: 11,
        fontWeight: '900',
        letterSpacing: 1.5,
    },
    bookmarkSurah: {
        color: '#f8fafc',
        fontSize: 20,
        fontWeight: '800',
        marginTop: 2,
    },
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginHorizontal: 20,
        marginBottom: 24,
        paddingHorizontal: 20,
        height: 56,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.08)',
        overflow: 'hidden',
        backgroundColor: 'rgba(255, 255, 255, 0.02)',
    },
    input: {
        flex: 1,
        color: '#ffffff',
        marginLeft: 14,
        fontSize: 16,
        fontWeight: '600',
    },
    listContent: {
        paddingHorizontal: 20,
        paddingBottom: 180,
    },
    card: {
        borderRadius: 20,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.06)',
        overflow: 'hidden',
        height: 84,
        justifyContent: 'center',
    },
    cardMain: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
    },
    numberBadge: {
        width: 44,
        height: 44,
        borderRadius: 14,
        backgroundColor: 'rgba(255, 255, 255, 0.03)',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 16,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.05)',
    },
    numberText: {
        color: '#cbd5e1',
        fontWeight: '900',
        fontSize: 15,
    },
    cardTextGroup: {
        flex: 1,
    },
    surahName: {
        color: '#f8fafc',
        fontSize: 17,
        fontWeight: '800',
    },
    surahTranslation: {
        color: '#94a3b8',
        fontSize: 13,
        fontWeight: '600',
        marginTop: 2,
    },
    cardEndGroup: {
        alignItems: 'flex-end',
    },
    ayahCount: {
        color: '#cbd5e1',
        fontSize: 12,
        fontWeight: '900',
    },
    revelationType: {
        color: '#475569',
        fontSize: 10,
        fontWeight: '900',
        textTransform: 'uppercase',
        marginTop: 4,
        letterSpacing: 0.5,
    },
    dlButton: {
        marginLeft: 12,
        width: 36,
        height: 36,
        alignItems: 'center',
        justifyContent: 'center',
    },
    dlProgressWrap: {
        alignItems: 'center',
        gap: 2,
    },
    dlPct: {
        fontSize: 9,
        fontWeight: '700',
    },
});
