import * as React from 'react';
import { useEffect, useState, useRef } from 'react';
import { HifzTab } from './HifzTab';
import { Brain, BookOpen as BookOpenIcon, Radio, Lock } from 'lucide-react-native';
import { View, Text, FlatList, StyleSheet, TouchableOpacity, ActivityIndicator, TextInput, Alert, DeviceEventEmitter, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { QuranService, SurahMeta } from '../services/QuranService';
import { SurahReader } from './SurahReader';
import { Search, Bookmark, BookOpen, Download, CheckCircle, Wifi, Trash2 } from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { GlassBg as BlurView } from './GlassBg';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useTheme } from '../context/ThemeContext';
import { tabletContentStyle } from '../utils/layout';
import OfflineQuranService, { DownloadInfo } from '../services/OfflineQuranService';
import { subscribeReciter, getCurrentReciterId } from '../utils/reciters';
import { usePurchases } from '../context/PurchasesContext';
import { PlaylistManager } from './PlaylistManager';
import { QuranPlaylist } from '../utils/quranPlaylists';
import { QuranMiniPlayer } from './QuranMiniPlayer';
import { useQuranAudio } from '../context/QuranAudioContext';

// Returns true if every char of `needle` appears in `haystack` in order.
// Lets "ftha" match "fatiha", or "mlk" match "mulk" — gentle on typos.
function isSubsequence(needle: string, haystack: string): boolean {
    let i = 0;
    for (let j = 0; i < needle.length && j < haystack.length; j++) {
        if (needle[i] === haystack[j]) i++;
    }
    return i === needle.length;
}

export function QuranTab() {
    const { colors, cardBg, blurIntensity } = useTheme();
    const { isPremium, openPaywall } = usePurchases();
    const audio = useQuranAudio();
    const [surahs, setSurahs] = useState<SurahMeta[]>([]);
    const [filteredSurahs, setFilteredSurahs] = useState<SurahMeta[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    // Detected verse reference like "2:255" — surfaces a tap-to-jump banner
    // above the surah list. Same pattern as the home GlobalSearch.
    const [verseRef, setVerseRef] = useState<{ surahNumber: number; ayahNumber: number; surahName: string } | null>(null);
    const [selectedSurah, setSelectedSurah] = useState<number | null>(null);
    // When the user jumps in from a verse reference (e.g. "67:1"), we want
    // SurahReader to scroll to that exact ayah on open rather than the top.
    const [selectedAyah, setSelectedAyah] = useState<number | null>(null);
    const [activeSubTab, setActiveSubTab] = useState<'quran' | 'hifz' | 'radio'>('quran');
    const [bookmark, setBookmark] = useState<{ surahNumber: number, edition: string, surahName: string, ayahNumber?: number } | null>(null);
    const [currentEdition, _setCurrentEdition] = useState('en.sahih');
    // Wrap the setter so changes persist to AsyncStorage — the preload service
    // reads this to know which edition to pre-fetch for popular night-reading surahs.
    const setCurrentEdition = (e: string) => {
        _setCurrentEdition(e);
        AsyncStorage.setItem('reader_translation_edition_v1', e).catch(() => {});
    };
    // Restore on mount
    useEffect(() => {
        AsyncStorage.getItem('reader_translation_edition_v1').then(v => {
            if (v) _setCurrentEdition(v);
        }).catch(() => {});
    }, []);
    const [dlMap, setDlMap] = useState<Record<number, DownloadInfo>>({});
    const [reciterId, setReciterId] = useState<string>(getCurrentReciterId());
    const unsubscribeRefs = useRef<Array<() => void>>([]);
    const flatListRef = useRef<FlatList>(null);

    // Playlist / Radio state
    const [showPlaylistManager, setShowPlaylistManager] = useState(false);

    // One-time setup: load list, bookmark, init service, scroll-to-top listener
    useEffect(() => {
        loadList();
        loadBookmark();
        OfflineQuranService.init();
        const scrollSub = DeviceEventEmitter.addListener('scrollToTop', (tab: string) => {
            if (tab === 'Quran') flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
        });
        // External "open this surah" events — fired by GlobalSearch and
        // Verse-of-the-Day "Read in Surah". Pops the SurahReader open.
        const openSub = DeviceEventEmitter.addListener('open:surah', (payload: { surahNumber: number; ayahNumber?: number }) => {
            if (!payload?.surahNumber) return;
            setSelectedAyah(payload.ayahNumber ?? null);
            setSelectedSurah(payload.surahNumber);
        });
        // Deep-link from feature discovery → open the Hifz sub-tab
        const hifzSub = DeviceEventEmitter.addListener('quran:openHifz', () => {
            if (isPremium) setActiveSubTab('hifz');
        });
        // Flush any request that arrived before this screen mounted (lazy-mounted
        // tabs miss the initial emit).
        const { consumePendingOpen } = require('../App');
        const pending = consumePendingOpen('surah');
        if (pending) {
            setSelectedAyah(pending.ayahNumber ?? null);
            setSelectedSurah(pending.surahNumber);
        }

        const reciterSub = subscribeReciter(setReciterId);
        return () => {
            scrollSub.remove();
            openSub.remove();
            hifzSub.remove();
            reciterSub();
        };
    }, []);

    // Subscriptions to download events — re-built whenever surahs load or reciter changes
    useEffect(() => {
        if (surahs.length === 0) return;
        // Drop any subscriptions/state from the previous reciter immediately,
        // so users never see stale "downloaded" badges from another voice.
        unsubscribeRefs.current.forEach(fn => fn());
        setDlMap({});

        unsubscribeRefs.current = surahs.map(s =>
            OfflineQuranService.subscribe(s.number, (info) => {
                // Ignore late events from a previously-active reciter
                if (info.reciterId !== reciterId) return;
                setDlMap(prev => ({ ...prev, [info.surahNumber]: info }));
            })
        );
        // Seed status for the active reciter
        const fresh: Record<number, DownloadInfo> = {};
        surahs.forEach(s => { fresh[s.number] = OfflineQuranService.getInfo(s.number); });
        setDlMap(fresh);

        return () => {
            unsubscribeRefs.current.forEach(fn => fn());
            unsubscribeRefs.current = [];
        };
    }, [surahs, reciterId]);

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
        // Subscriptions + dlMap seeding handled by the [surahs, reciterId] effect
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

    const VERSE_REF_REGEX = /^\s*(\d{1,3})\s*:\s*(\d{1,3})\s*$/;

    const handleSearch = (text: string) => {
        setSearchQuery(text);
        if (!text.trim()) {
            setFilteredSurahs(surahs);
            setVerseRef(null);
            return;
        }

        // Direct verse reference ("2:255") — show jump banner + filter to that
        // surah so the user immediately sees the context.
        const verseMatch = text.match(VERSE_REF_REGEX);
        if (verseMatch) {
            const sNum = parseInt(verseMatch[1], 10);
            const aNum = parseInt(verseMatch[2], 10);
            const surahMeta = surahs.find(s => s.number === sNum);
            if (surahMeta && aNum >= 1 && aNum <= surahMeta.numberOfAyahs) {
                setVerseRef({ surahNumber: sNum, ayahNumber: aNum, surahName: surahMeta.englishName });
                setFilteredSurahs([surahMeta]);
                return;
            }
            // Invalid (surah doesn't exist or ayah out of range) — clear and
            // fall through to normal name search so user gets some feedback.
            setVerseRef(null);
        } else {
            setVerseRef(null);
        }

        // Normalize aggressively so the user doesn't have to spell exactly
        // ("al-fatiha", "al fatiha", "fatihah", "AlFatiha" all match).
        const normalize = (s: string) =>
            s.toLowerCase()
                // Strip diacritics / accents
                .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
                // Drop the "al " / "al-" prefix Arabic articles often carry
                .replace(/\bal[- ]/g, '')
                // Collapse all non-alphanumerics (dashes, spaces, punctuation)
                .replace(/[^a-z0-9]/g, '');

        const q = normalize(text);
        if (!q) {
            setFilteredSurahs(surahs);
            return;
        }

        const scored: { s: SurahMeta; score: number }[] = [];
        for (const s of surahs) {
            const nameN  = normalize(s.englishName);
            const arabicN = normalize(s.name);
            const transN = normalize(s.englishNameTranslation);
            const numS   = s.number.toString();

            let score = -1;
            if (numS === text.trim())                 score = 0;
            else if (nameN === q)                      score = 1;
            else if (nameN.startsWith(q))              score = 2;
            else if (arabicN.startsWith(q))            score = 3;
            else if (transN.startsWith(q))             score = 4;
            else if (nameN.includes(q))                score = 5;
            else if (transN.includes(q))               score = 6;
            else if (arabicN.includes(q))              score = 7;
            // Subsequence fallback ("fatih" matches "fatiha")
            else if (isSubsequence(q, nameN))          score = 8;
            else if (isSubsequence(q, transN))         score = 9;

            if (score >= 0) scored.push({ s, score });
        }

        scored.sort((a, b) => a.score - b.score || a.s.number - b.s.number);
        setFilteredSurahs(scored.map(x => x.s));
    };

    if (selectedSurah) {
        return (
            <SurahReader
                surahNumber={selectedSurah}
                edition={currentEdition}
                onEditionChange={setCurrentEdition}
                initialAyahNumber={selectedAyah ?? undefined}
                onClose={() => {
                    setSelectedSurah(null);
                    setSelectedAyah(null);
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
                        onPress={() => {
                            if (!isPremium) { openPaywall(); return; }
                            setActiveSubTab('hifz');
                        }}
                    >
                        <Brain size={14} color={activeSubTab === 'hifz' ? colors.accent : '#475569'} />
                        <Text style={[styles.subTabText, activeSubTab === 'hifz' && { color: colors.accent }]}>Hifz</Text>
                        {!isPremium && <Lock size={9} color="#f59e0b" />}
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.subTab, activeSubTab === 'radio' && { backgroundColor: colors.accent + '22', borderColor: colors.accent + '66' }]}
                        onPress={() => {
                            // Premium gate disabled for testing
                            setActiveSubTab('radio');
                            setShowPlaylistManager(true);
                        }}
                    >
                        <Radio size={14} color={activeSubTab === 'radio' ? colors.accent : '#475569'} />
                        <Text style={[styles.subTabText, activeSubTab === 'radio' && { color: colors.accent }]}>Radio</Text>
                        {!isPremium && <Lock size={9} color="#f59e0b" />}
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
                        placeholder="Search by name or verse (e.g. 2:255)…"
                        placeholderTextColor="rgba(255, 255, 255, 0.2)"
                        value={searchQuery}
                        onChangeText={handleSearch}
                        // Cap font scaling so iOS "Larger Text" can't push
                        // descender letters past the container's fixed height.
                        maxFontSizeMultiplier={1.2}
                    />
                </View>}

                {/* Verse-reference jump banner — appears when user types "2:255" etc. */}
                {activeSubTab === 'quran' && verseRef && (
                    <TouchableOpacity
                        style={[styles.verseJumpBanner, { borderColor: colors.accent + '55', backgroundColor: colors.accent + '12' }]}
                        onPress={() => {
                            setSelectedAyah(verseRef.ayahNumber);
                            setSelectedSurah(verseRef.surahNumber);
                            setSearchQuery('');
                            setVerseRef(null);
                            setFilteredSurahs(surahs);
                        }}
                        activeOpacity={0.7}
                    >
                        <BookOpen size={16} color={colors.accent} />
                        <View style={{ flex: 1 }}>
                            <Text style={[styles.verseJumpTitle, { color: colors.accent }]}>
                                Jump to {verseRef.surahName} · Ayah {verseRef.ayahNumber}
                            </Text>
                            <Text style={styles.verseJumpSub}>Surah {verseRef.surahNumber}:{verseRef.ayahNumber}</Text>
                        </View>
                    </TouchableOpacity>
                )}

                {activeSubTab === 'quran' && (loading ? (
                    <ActivityIndicator size="large" color="#f8fafc" style={{ marginTop: 50 }} />
                ) : (
                    <FlatList
                        ref={flatListRef}
                        style={{ flex: 1 }}
                        data={filteredSurahs}
                        keyExtractor={(item) => item.number.toString()}
                        contentContainerStyle={styles.listContent}
                        showsVerticalScrollIndicator={false}
                        // Frees off-screen rows from memory on the 114-surah list
                        removeClippedSubviews={Platform.OS === 'android'}
                        initialNumToRender={12}
                        maxToRenderPerBatch={8}
                        windowSize={5}
                        // Tap anywhere on the list background → keyboard dismisses.
                        // Taps on row content still register (handled vs always).
                        keyboardShouldPersistTaps="handled"
                        keyboardDismissMode="on-drag"
                        renderItem={({ item }) => {
                            const dlInfo = dlMap[item.number] ?? { surahNumber: item.number, status: 'none', progress: 0 };
                            const isDownloaded = dlInfo.status === 'downloaded';
                            const isDownloading = dlInfo.status === 'downloading';
                            return (
                            <TouchableOpacity
                                style={styles.card}
                                onPress={() => setSelectedSurah(item.number)}
                            >
                                <View style={[StyleSheet.absoluteFill, { backgroundColor: cardBg }]} />
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

            {/* Playlist Manager modal */}
            <PlaylistManager
                visible={showPlaylistManager}
                onClose={() => {
                    setShowPlaylistManager(false);
                    if (activeSubTab === 'radio') setActiveSubTab('quran');
                }}
                onPlay={(playlist: QuranPlaylist) => {
                    // Start background playback — no navigation to SurahReader
                    audio.startPlaylist(playlist.surahNumbers, playlist.name);
                    setShowPlaylistManager(false);
                    setActiveSubTab('quran');
                }}
            />

            {/* Mini player — floats above tab bar while a playlist is playing */}
            <QuranMiniPlayer />
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
        // minHeight (was fixed height: 56) lets the row grow if iOS Larger
        // Text is enabled, so descender letters (y, g, p, j) don't get
        // clipped at the bottom.
        minHeight: 56,
        paddingVertical: 8,
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
        lineHeight: 22, // room under the baseline so descenders aren't clipped
        fontWeight: '600',
    },
    verseJumpBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingVertical: 12,
        paddingHorizontal: 14,
        marginHorizontal: 20,
        marginTop: 8,
        marginBottom: 4,
        borderRadius: 14,
        borderWidth: 1,
    },
    verseJumpTitle: {
        fontSize: 14,
        fontWeight: '800',
        letterSpacing: 0.2,
    },
    verseJumpSub: {
        fontSize: 11,
        color: '#94a3b8',
        fontWeight: '600',
        marginTop: 2,
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
