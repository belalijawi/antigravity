import React, { useEffect, useState, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity, Modal, FlatList, SafeAreaView, ViewToken, Pressable, Platform } from 'react-native';
import { ArrowLeft, Globe, X, Check, Bookmark, Play, Pause, SkipBack, SkipForward, Volume2 } from 'lucide-react-native';
import { BlurView } from 'expo-blur';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { QuranService, SurahDetail, Edition, Ayah } from '../services/QuranService';
import { Audio, AVPlaybackStatus, InterruptionModeIOS, InterruptionModeAndroid } from 'expo-av';
import { useTheme } from '../context/ThemeContext';

interface Props {
    surahNumber: number;
    edition?: string;
    onEditionChange: (newEdition: string) => void;
    onClose: () => void;
}

const DEFAULT_BISMILLAH = 'In the name of Allah, the Entirely Merciful, the Especially Merciful';

const BISMILLAH_MAP: Record<string, string> = {
    'en': 'In the name of Allah, the Entirely Merciful, the Especially Merciful',
    'fr': 'Au nom d\'Allah, le Tout Miséricordieux, le Très Miséricordieux',
    'es': 'En el nombre de Allah, el Clemente, el Misericordioso',
    'de': 'Im Namen Allahs, des Gnädigen, des Barmherzigen',
    'tr': 'Rahmân ve Rahîm olan Allah\'ın adıyla',
    'ru': 'Во имя Аллаха, Милостивого, Милосердного!',
    'id': 'Dengan nama Allah Yang Maha Pengasih, Maha Penyayang',
    'ms': 'Dengan nama Allah, Yang Maha Pemurah, lagi Maha Mengasihani',
    'fa': 'به نام خداوند بخشنده بخشایشگر',
    'ur': 'اللہ کے نام سے شروع جو نہایت مہربان بہت رحم والا ہے',
    'bn': 'পরম করুণাময় অসীম দয়ালু আল্লাহর নামে শুরু করছি',
    'hi': 'Allah کے নাম سے، جو بہت مہربান، نہایت رحم والا ہے',
    'zh': '奉至仁至慈的真主之名',
    'it': 'In nome di Allah, il Compassionevole, il Misericordioso',
    'pt': 'Em nome de Allah, o Clemente, o Misericordioso',
    'ja': '慈悲あまねく慈愛深きアッラーの御名において',
};

const VERIFIED_EDITIONS = [
    { identifier: 'en.sahih', displayName: 'English', subName: 'Saheeh International', isPremium: false },
    { identifier: 'ar.alafasy', displayName: 'Arabic', subName: 'Mishary Rashid Alafasy', isPremium: true },
    { identifier: 'en.khattab', displayName: 'English', subName: 'The Clear Quran (Khattab)', isPremium: true },
    { identifier: 'fr.hamidullah', displayName: 'French', subName: 'Muhammad Hamidullah', isPremium: true },
    { identifier: 'es.cortes', displayName: 'Spanish', subName: 'Julio Cortes', isPremium: true },
    { identifier: 'de.aburida', displayName: 'German', subName: 'Abu Rida', isPremium: true },
    { identifier: 'tr.diyanet', displayName: 'Turkish', subName: 'Diyanet Isleri', isPremium: true },
    { identifier: 'ru.kuliev', displayName: 'Russian', subName: 'Elmir Kuliev', isPremium: true },
    { identifier: 'id.indonesian', displayName: 'Indonesian', subName: 'Bahasa Indonesia', isPremium: true },
    { identifier: 'ms.basmeih', displayName: 'Malay', subName: 'Abdullah Basmeih', isPremium: true },
    { identifier: 'fa.ghomshei', displayName: 'Persian', subName: 'Mahdi Elahi Ghomshei', isPremium: true },
    { identifier: 'ur.kanzuliman', displayName: 'Urdu', subName: 'Ahmed Raza Khan', isPremium: true },
    { identifier: 'bn.bengali', displayName: 'Bengali', subName: 'Zohurul Hoque', isPremium: true },
    { identifier: 'hi.hindi', displayName: 'Hindi', subName: 'Farooq Khan & Nadwi', isPremium: true },
    { identifier: 'zh.jian', displayName: 'Chinese', subName: 'Ma Jian', isPremium: true },
    { identifier: 'it.piccardo', displayName: 'Italian', subName: 'Hamza Roberto Piccardo', isPremium: true },
    { identifier: 'pt.elhayek', displayName: 'Portuguese', subName: 'Samir El-Hayek', isPremium: true },
    { identifier: 'ja.japanese', displayName: 'Japanese', subName: 'Ryoichi Mita', isPremium: true },
];

export function SurahReader({ surahNumber, edition = 'en.sahih', onEditionChange, onClose }: Props) {
    const [surah, setSurah] = useState<SurahDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [modalVisible, setModalVisible] = useState(false);
    const flatListRef = useRef<FlatList>(null);
    const [initialScrollDone, setInitialScrollDone] = useState(false);
    const [bookmarkedAyah, setBookmarkedAyah] = useState<number | null>(null);
    const lastReadAyahRef = useRef<number>(1);

    // Audio State & Refs (Refs prevent stale closures in playback callbacks)
    const [isPlaying, setIsPlaying] = useState(false);
    const soundRef = useRef<Audio.Sound | null>(null);
    const preloadedSoundRef = useRef<Audio.Sound | null>(null);
    const preloadedIndexRef = useRef<number | null>(null);
    const [currentAyahIndex, setCurrentAyahIndex] = useState<number | null>(null);
    const currentAyahIndexRef = useRef<number | null>(null);
    const [audioLoading, setAudioLoading] = useState(false);
    const [audioAyahs, setAudioAyahs] = useState<Ayah[]>([]);
    const audioAyahsRef = useRef<Ayah[]>([]);

    // Stable Function Refs for background callbacks
    const playAyahRef = useRef<(index: number) => Promise<void>>(null);
    const handleNextAyahRef = useRef<() => void>(null);

    const { colors } = useTheme();

    useEffect(() => {
        loadSurah();
    }, [surahNumber, edition]);

    const loadSurah = async () => {
        setLoading(true);
        setInitialScrollDone(false);

        // Re-assert audio mode for this surah session
        try {
            await Audio.setAudioModeAsync({
                allowsRecordingIOS: false,
                staysActiveInBackground: true,
                interruptionModeIOS: InterruptionModeIOS.MixWithOthers,
                playsInSilentModeIOS: true,
                shouldDuckAndroid: false,
                interruptionModeAndroid: InterruptionModeAndroid.DoNotMix,
                playThroughEarpieceAndroid: false,
            });
        } catch (e) {
            console.error('Error re-asserting audio mode:', e);
        }

        const data = await QuranService.getSurah(surahNumber, edition);
        if (data) {
            setSurah(data);

            // Fetch audio recitations (default Alafasy)
            const audioData = await QuranService.getAudioRecitation(surahNumber);
            setAudioAyahs(audioData);
            audioAyahsRef.current = audioData;

            // Load specific bookmark for this surah/ayah if exists
            try {
                const saved = await AsyncStorage.getItem('quran_last_read');
                if (saved) {
                    const bookmark = JSON.parse(saved);
                    if (bookmark.surahNumber === surahNumber) {
                        lastReadAyahRef.current = bookmark.ayahNumber || 1;
                        setBookmarkedAyah(bookmark.ayahNumber || null);
                    }
                }
            } catch (e) {
                console.error('Error loading ayah bookmark:', e);
            }
        }
        setLoading(false);
    };

    // Cleanup audio resources correctly on unmount
    useEffect(() => {
        return () => {
            const cleanup = async () => {
                if (soundRef.current) {
                    try {
                        await soundRef.current.unloadAsync();
                        soundRef.current = null;
                    } catch (e) { console.log('Cleanup error (main):', e); }
                }
                if (preloadedSoundRef.current) {
                    try {
                        await preloadedSoundRef.current.unloadAsync();
                        preloadedSoundRef.current = null;
                    } catch (e) { console.log('Cleanup error (pre):', e); }
                }
            };
            cleanup();
        };
    }, []);

    const playAyah = async (index: number) => {
        if (!audioAyahs[index]) return;

        try {
            setAudioLoading(true);

            // 1. Re-assert audio mode just before play to wake up the background worker if needed
            try {
                await Audio.setAudioModeAsync({
                    allowsRecordingIOS: false,
                    staysActiveInBackground: true,
                    interruptionModeIOS: InterruptionModeIOS.MixWithOthers,
                    playsInSilentModeIOS: true,
                    shouldDuckAndroid: true,
                    interruptionModeAndroid: InterruptionModeAndroid.DuckOthers,
                    playThroughEarpieceAndroid: false,
                });
            } catch (e) {
                console.log('Error re-asserting audio mode in play:', e);
            }

            // 2. Check if we have this ayah pre-loaded
            if (preloadedSoundRef.current && preloadedIndexRef.current === index) {
                const oldSound = soundRef.current;
                const nextSound = preloadedSoundRef.current;

                // CRITICAL: Play the NEXT sound before unloading the old one to bridge the gap
                await nextSound.playAsync();

                // Now clean up the old one
                if (oldSound) {
                    try {
                        await oldSound.unloadAsync();
                    } catch (e) {
                        console.log('Error unloading old sound:', e);
                    }
                }

                soundRef.current = nextSound;
                preloadedSoundRef.current = null;
                preloadedIndexRef.current = null;

                soundRef.current.setOnPlaybackStatusUpdate(onPlaybackStatusUpdate);
            } else {
                // Manual play or no pre-load available
                const oldSound = soundRef.current;
                const preOldSound = preloadedSoundRef.current;

                const { sound: newSound } = await Audio.Sound.createAsync(
                    { uri: audioAyahs[index].text },
                    { shouldPlay: true },
                    onPlaybackStatusUpdate
                );

                if (oldSound) {
                    try {
                        await oldSound.unloadAsync();
                    } catch (e) {
                        console.log('Error unloading old sound:', e);
                    }
                }
                if (preOldSound) {
                    try {
                        await preOldSound.unloadAsync();
                    } catch (e) {
                        console.log('Error unloading pre-old sound:', e);
                    }
                }

                soundRef.current = newSound;
                preloadedSoundRef.current = null;
                preloadedIndexRef.current = null;
            }

            setCurrentAyahIndex(index);
            currentAyahIndexRef.current = index;
            setIsPlaying(true);
            setAudioLoading(false);

            // 3. Start pre-loading the next ayah immediately for seamless background transition
            // We delay this slightly to let the current playback start smoothly
            setTimeout(() => {
                preloadNextAyah(index + 1);
            }, 500);

            // Auto-scroll to current ayah with safety check
            try {
                flatListRef.current?.scrollToIndex({
                    index,
                    animated: true,
                    viewPosition: 0.3
                });
            } catch (e) {
                // Silently ignore scroll errors in background
                console.log('Scroll error (likely in background):', e);
            }

        } catch (error) {
            console.error('Error playing ayah:', error);
            setAudioLoading(false);
        }
    };

    const preloadNextAyah = async (index: number) => {
        const ayahsList = audioAyahsRef.current;
        if (index >= ayahsList.length) return;

        try {
            // Unload old pre-load if horizontal skip happened
            if (preloadedSoundRef.current) {
                await preloadedSoundRef.current.unloadAsync();
            }

            const { sound: nextSound } = await Audio.Sound.createAsync(
                { uri: ayahsList[index].text },
                { shouldPlay: false }
            );
            preloadedSoundRef.current = nextSound;
            preloadedIndexRef.current = index;
            console.log('Pre-loaded ayah:', index);
        } catch (e) {
            console.log('Pre-load failed:', e);
        }
    };

    const handleNextAyah = useCallback(() => {
        const currentIndex = currentAyahIndexRef.current;
        const ayahsList = audioAyahsRef.current;

        const nextIndex = (currentIndex !== null ? currentIndex : -1) + 1;
        if (nextIndex < ayahsList.length) {
            playAyahRef.current?.(nextIndex);
        } else {
            setIsPlaying(false);
            setCurrentAyahIndex(null);
            currentAyahIndexRef.current = null;
        }
    }, []);

    // Sync refs every render
    playAyahRef.current = playAyah;
    handleNextAyahRef.current = handleNextAyah;

    const handlePrevAyah = () => {
        const currentIndex = currentAyahIndexRef.current;
        const prevIndex = (currentIndex !== null ? currentIndex : 1) - 1;
        if (prevIndex >= 0) {
            playAyahRef.current?.(prevIndex);
        }
    };

    const onPlaybackStatusUpdate = (status: AVPlaybackStatus) => {
        if (status.isLoaded && status.didJustFinish) {
            handleNextAyahRef.current?.();
        }
    };

    const handlePlayPause = async () => {
        if (!soundRef.current) {
            playAyahRef.current?.(currentAyahIndex !== null ? currentAyahIndex : 0);
            return;
        }

        if (isPlaying) {
            await soundRef.current.pauseAsync();
            setIsPlaying(false);
        } else {
            await soundRef.current.playAsync();
            setIsPlaying(true);
        }
    };

    const renderAudioControlsContent = () => (
        <>
            <View style={styles.audioControls}>
                <TouchableOpacity onPress={handlePrevAyah} style={styles.controlButton}>
                    <SkipBack size={20} color="#fff" />
                </TouchableOpacity>

                <TouchableOpacity
                    onPress={handlePlayPause}
                    style={[styles.playPauseButton, { backgroundColor: colors.accent }]}
                >
                    {audioLoading ? (
                        <ActivityIndicator size="small" color="#000" />
                    ) : isPlaying ? (
                        <Pause size={24} color="#000" fill="#000" />
                    ) : (
                        <Play size={24} color="#000" fill="#000" style={{ marginLeft: 2 }} />
                    )}
                </TouchableOpacity>

                <TouchableOpacity onPress={handleNextAyah} style={styles.controlButton}>
                    <SkipForward size={20} color="#fff" />
                </TouchableOpacity>
            </View>

            {currentAyahIndex !== null && surah && (
                <View style={styles.audioInfo}>
                    <Volume2 size={12} color="#94a3b8" />
                    <Text style={styles.audioInfoText}>
                        Ayah {currentAyahIndex + 1} of {surah.numberOfAyahs}
                    </Text>
                </View>
            )}
        </>
    );

    // Auto-scroll when data is ready
    useEffect(() => {
        if (!loading && surah && !initialScrollDone && flatListRef.current) {
            const index = lastReadAyahRef.current - 1;
            if (index > 0) {
                setTimeout(() => {
                    flatListRef.current?.scrollToIndex({
                        index,
                        animated: false,
                        viewPosition: 0
                    });
                }, 100);
            }
            setInitialScrollDone(true);
        }
    }, [loading, surah, initialScrollDone]);

    const saveBookmark = async (ayahNumber: number) => {
        if (!surah) return;
        setBookmarkedAyah(ayahNumber);
        try {
            const bookmark = {
                surahNumber,
                edition,
                surahName: surah.englishName,
                ayahNumber,
                timestamp: new Date().getTime()
            };
            await AsyncStorage.setItem('quran_last_read', JSON.stringify(bookmark));
        } catch (e) {
            console.error('Error saving bookmark:', e);
        }
    };

    const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
        if (viewableItems.length > 0) {
            const topItem = viewableItems[0];
            if (topItem.index !== null) {
                lastReadAyahRef.current = topItem.index + 1;
            }
        }
    }).current;

    const viewabilityConfig = useRef({
        itemVisiblePercentThreshold: 50
    }).current;

    const openLanguageModal = async () => {
        setModalVisible(true);
    };

    const handleEditionSelect = (item: typeof VERIFIED_EDITIONS[0]) => {
        onEditionChange(item.identifier);
        setModalVisible(false);
    };

    if (loading) {
        return (
            <View style={styles.centerContainer}>
                <ActivityIndicator size="large" color="#f8fafc" />
                <Text style={styles.loadingText}>Loading Verses...</Text>
            </View>
        );
    }

    if (!surah) {
        return (
            <View style={styles.centerContainer}>
                <Text style={styles.errorText}>Could not load translation.</Text>
                <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                    <Text style={styles.closeButtonText}>Go Back</Text>
                </TouchableOpacity>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            {/* Top Bar */}
            <SafeAreaView style={styles.headerSafeArea}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={onClose} style={styles.iconButton}>
                        <ArrowLeft color="#fff" size={24} />
                    </TouchableOpacity>

                    <View style={styles.headerTitleContainer}>
                        <Text style={styles.headerTitle}>{surah.englishName}</Text>
                        <Text style={styles.headerSubtitle}>{surah.englishNameTranslation}</Text>
                    </View>

                    <TouchableOpacity onPress={openLanguageModal} style={styles.langButton}>
                        <Globe color="#cbd5e1" size={22} />
                        <Text style={styles.langLabel}>Language</Text>
                    </TouchableOpacity>
                </View>
            </SafeAreaView>

            {/* Content using FlatList for tracking and scrolling */}
            <FlatList
                ref={flatListRef}
                data={surah.ayahs}
                keyExtractor={(item) => item.number.toString()}
                onViewableItemsChanged={onViewableItemsChanged}
                viewabilityConfig={viewabilityConfig}
                initialNumToRender={10}
                maxToRenderPerBatch={10}
                windowSize={5}
                onScrollToIndexFailed={(info) => {
                    setTimeout(() => {
                        flatListRef.current?.scrollToIndex({ index: info.index, animated: false });
                    }, 500);
                }}
                ListHeaderComponent={() => {
                    if (surah.number === 9) return null;

                    const langCode = edition.split('.')[0];
                    const localizedBismillah = BISMILLAH_MAP[langCode] || DEFAULT_BISMILLAH;
                    const firstAyahText = surah.ayahs[0]?.text || '';

                    // Check if the first ayah already includes the Bismillah (to avoid duplication)
                    // This is common in Surah 1 and some older translations
                    const isBismillahInFirstAyah = firstAyahText.includes('بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ') ||
                        firstAyahText.toLowerCase().includes('in the name of allah') ||
                        (surah.number === 1 && firstAyahText.length > 5);

                    if (isBismillahInFirstAyah && surah.number === 1) return null;

                    return (
                        <View style={styles.bismillahContainer}>
                            <Text style={styles.arabicBismillah}>بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ</Text>
                            <Text style={styles.englishBismillah}>
                                {localizedBismillah}
                            </Text>
                        </View>
                    );
                }}
                contentContainerStyle={styles.scrollContent}
                renderItem={({ item: ayah, index }) => {
                    const isBookmarked = bookmarkedAyah === ayah.numberInSurah;

                    return (
                        <Pressable
                            style={[
                                styles.ayahCard,
                                isBookmarked && styles.bookmarkedAyahCard,
                                currentAyahIndex === index && styles.activeAyahCard
                            ]}
                            onPress={() => saveBookmark(ayah.numberInSurah)}
                        >
                            <View style={styles.ayahInfo}>
                                <View style={styles.numberCircle}>
                                    <Text style={styles.numberText}>{ayah.numberInSurah}</Text>
                                </View>
                                <View style={styles.ayahActions}>
                                    <TouchableOpacity
                                        onPress={() => playAyah(index)}
                                        style={styles.ayahPlayButton}
                                    >
                                        {currentAyahIndex === index && isPlaying ? (
                                            <Pause size={16} color="#22d3ee" fill="#22d3ee" />
                                        ) : (
                                            <Play size={16} color="#94a3b8" />
                                        )}
                                    </TouchableOpacity>
                                    {isBookmarked && (
                                        <Bookmark color="#22d3ee" size={16} fill="#22d3ee" />
                                    )}
                                </View>
                            </View>
                            <Text style={[
                                styles.ayahText,
                                (edition.startsWith('ar.') || edition.startsWith('quran-')) && { textAlign: 'right' },
                                currentAyahIndex === index && { color: '#22d3ee' }
                            ]}>
                                {ayah.text}
                            </Text>
                        </Pressable>
                    );
                }}
            />

            {/* Floating Audio Player */}
            {audioAyahs.length > 0 && (
                <View style={styles.audioPlayerContainer}>
                    {Platform.OS === 'ios' ? (
                        <BlurView intensity={80} tint="dark" style={styles.audioPlayerBlur}>
                            {renderAudioControlsContent()}
                        </BlurView>
                    ) : (
                        <View style={[styles.audioPlayerBlur, { backgroundColor: 'rgba(15, 23, 42, 0.98)', borderTopWidth: 1, borderColor: 'rgba(255, 255, 255, 0.1)' }]}>
                            {renderAudioControlsContent()}
                        </View>
                    )}
                </View>
            )}

            {/* Modern Language Picker Modal */}
            <Modal
                animationType="slide"
                transparent={true}
                visible={modalVisible}
                onRequestClose={() => setModalVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Choose Language</Text>
                            <TouchableOpacity onPress={() => setModalVisible(false)} style={styles.modalCloseIcon}>
                                <X color="#94a3b8" size={24} />
                            </TouchableOpacity>
                        </View>

                        <FlatList
                            data={VERIFIED_EDITIONS}
                            keyExtractor={(item) => item.identifier}
                            contentContainerStyle={{ paddingBottom: 40 }}
                            renderItem={({ item }) => (
                                <TouchableOpacity
                                    style={[
                                        styles.langRow,
                                        item.identifier === edition && styles.selectedRow
                                    ]}
                                    onPress={() => handleEditionSelect(item)}
                                >
                                    <View style={{ flex: 1 }}>
                                        <View style={styles.langNameContainer}>
                                            <Text style={[
                                                styles.mainLangName,
                                                item.identifier === edition && styles.yellowText
                                            ]}>
                                                {item.displayName}
                                            </Text>
                                            <View style={styles.verifiedBadge}>
                                                <Check color="#10b981" size={10} strokeWidth={3} />
                                                <Text style={styles.verifiedText}>AUTHENTIC</Text>
                                            </View>
                                        </View>
                                        <Text style={styles.subEditionName}>
                                            {item.subName}
                                        </Text>
                                    </View>
                                    {item.identifier === edition && (
                                        <View style={styles.activeDot} />
                                    )}
                                </TouchableOpacity>
                            )}
                        />
                    </View>
                </View>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: 'transparent',
    },
    centerContainer: {
        flex: 1,
        backgroundColor: 'transparent',
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerSafeArea: {
        backgroundColor: 'rgba(15, 23, 42, 0.8)',
        borderBottomWidth: 1,
        borderColor: 'rgba(30, 41, 59, 0.5)',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingBottom: 16,
    },
    headerTitleContainer: {
        flex: 1,
        alignItems: 'center',
    },
    headerTitle: {
        color: '#f8fafc',
        fontSize: 18,
        fontWeight: 'bold',
    },
    headerSubtitle: {
        color: '#cbd5e1',
        fontSize: 12,
        fontWeight: '600',
    },
    iconButton: {
        width: 44,
        height: 44,
        alignItems: 'center',
        justifyContent: 'center',
    },
    langButton: {
        alignItems: 'center',
        paddingHorizontal: 8,
    },
    langLabel: {
        color: '#cbd5e1',
        fontSize: 10,
        fontWeight: '600',
    },
    loadingText: {
        color: '#cbd5e1',
        marginTop: 10,
        fontWeight: '600',
    },
    errorText: {
        color: '#ef4444',
        marginBottom: 20,
    },
    closeButton: {
        paddingVertical: 12,
        paddingHorizontal: 24,
        backgroundColor: '#1e293b',
        borderRadius: 12,
    },
    closeButtonText: {
        color: '#fff',
        fontWeight: '600',
    },
    scrollContent: {
        padding: 16,
        paddingBottom: 220, // Increased to clear audio player when it's above tab bar
    },
    bismillahContainer: {
        alignItems: 'center',
        marginBottom: 32,
        marginTop: 8,
    },
    arabicBismillah: {
        color: '#fff',
        fontSize: 28,
        marginBottom: 8,
        textAlign: 'center',
    },
    englishBismillah: {
        color: '#cbd5e1',
        fontSize: 13,
        fontStyle: 'italic',
        textAlign: 'center',
        opacity: 0.9,
    },
    ayahCard: {
        backgroundColor: 'rgba(15, 23, 42, 0.4)',
        borderRadius: 24,
        padding: 24,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.08)',
    },
    bookmarkedAyahCard: {
        borderColor: '#22d3ee',
        backgroundColor: 'rgba(34, 211, 238, 0.08)',
    },
    activeAyahCard: {
        borderColor: '#22d3ee',
        backgroundColor: 'rgba(34, 211, 238, 0.12)',
        transform: [{ scale: 1.02 }],
    },
    ayahActions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 16,
    },
    ayahPlayButton: {
        padding: 4,
    },
    ayahInfo: {
        marginBottom: 12,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    numberCircle: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: '#1e293b',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: '#334155',
    },
    numberText: {
        color: '#cbd5e1',
        fontSize: 13,
        fontWeight: 'bold',
    },
    ayahText: {
        color: '#f8fafc',
        fontSize: 19,
        lineHeight: 34,
        textAlign: 'left',
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.9)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: '#0f172a',
        borderTopLeftRadius: 32,
        borderTopRightRadius: 32,
        height: '80%',
        padding: 24,
        borderTopWidth: 1,
        borderColor: '#334155',
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 24,
        paddingBottom: 16,
        borderBottomWidth: 1,
        borderColor: '#1e293b',
    },
    modalTitle: {
        color: '#fff',
        fontSize: 22,
        fontWeight: 'bold',
    },
    modalCloseIcon: {
        padding: 4,
    },
    langRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 18,
        paddingHorizontal: 16,
        borderRadius: 16,
        marginBottom: 8,
        backgroundColor: '#1e293b33',
    },
    selectedRow: {
        backgroundColor: '#1e293b',
        borderWidth: 1,
        borderColor: '#334155',
    },
    langNameContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    verifiedBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#064e3b',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
        gap: 2,
    },
    verifiedText: {
        color: '#10b981',
        fontSize: 8,
        fontWeight: 'bold',
        letterSpacing: 0.5,
    },
    mainLangName: {
        color: '#fff',
        fontSize: 17,
        fontWeight: '600',
    },
    yellowText: {
        color: '#f8fafc',
    },
    subEditionName: {
        color: '#94a3b8',
        fontSize: 12,
        marginTop: 2,
        fontWeight: '600',
    },
    activeDot: {
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: '#f8fafc',
    },
    audioPlayerContainer: {
        position: 'absolute',
        bottom: 130, // Raised to sit above the floating tab bar
        left: 20,
        right: 20,
        borderRadius: 24,
        overflow: 'hidden',
        elevation: 15,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.5,
        shadowRadius: 20,
        zIndex: 100,
    },
    audioPlayerBlur: {
        paddingVertical: 12,
        paddingHorizontal: 24,
        alignItems: 'center',
    },
    audioControls: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 32,
    },
    controlButton: {
        padding: 8,
    },
    playPauseButton: {
        width: 56,
        height: 56,
        borderRadius: 28,
        justifyContent: 'center',
        alignItems: 'center',
    },
    audioInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginTop: 8,
    },
    audioInfoText: {
        color: '#94a3b8',
        fontSize: 11,
        fontWeight: 'bold',
        textTransform: 'uppercase',
        letterSpacing: 1,
    }
});
