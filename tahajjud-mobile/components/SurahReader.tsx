import React, { useEffect, useState, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity, Modal, FlatList, ViewToken, Pressable, Platform, Animated } from 'react-native';
// Use the safe-area-context version (cross-platform). The built-in
// `react-native` SafeAreaView is a no-op on Android — that's why the system
// status bar was overlapping the SurahReader header.
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Globe, X, Check, Bookmark, Play, Pause, SkipBack, SkipForward, Volume2, Timer, WifiOff, Brain, Repeat, Lock } from 'lucide-react-native';
import { BlurView } from 'expo-blur';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { QuranService, SurahDetail, Edition, Ayah } from '../services/QuranService';
import TrackPlayer, { useProgress, Event, State } from 'react-native-track-player';
import { BackHandler } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import OfflineQuranService from '../services/OfflineQuranService';
import { HifzSession } from './HifzSession';
import { usePurchases } from '../context/PurchasesContext';
import { useQuranAudio } from '../context/QuranAudioContext';
import { QuranTimingService, AyahAudioData, getWordAtTime } from '../services/QuranTimingService';
import { parseTajweed, isTajweedEdition, TAJWEED_COLORS } from '../utils/tajweedParser';
import { QuranWordService, AyahWords } from '../services/QuranWordService';
import { getCurrentReciterId, subscribeReciter } from '../utils/reciters';

interface Props {
    surahNumber: number;
    edition?: string;
    onEditionChange: (newEdition: string) => void;
    onClose: () => void;
    playQueue?: number[];    // ordered surah numbers for playlist mode
    playlistName?: string;  // shown in the player bar
    /**
     * Optional 1-based ayah number to scroll to on open. Used when the user
     * jumps in from a verse reference like "67:1" in the global search.
     */
    initialAyahNumber?: number;
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
    // ── Arabic (original) ──
    { identifier: 'quran-uthmani', displayName: 'Arabic', subName: 'Madinah Mushaf (Hafs)', isPremium: true },
    { identifier: 'quran-tajweed', displayName: 'Arabic', subName: 'With Tajweed colors', isPremium: true },

    // ── English ──
    { identifier: 'en.sahih', displayName: 'English', subName: 'Saheeh International', isPremium: false },
    { identifier: 'en.khattab', displayName: 'English', subName: 'The Clear Quran (Khattab)', isPremium: true },

    // ── European languages ──
    { identifier: 'fr.hamidullah', displayName: 'French', subName: 'Muhammad Hamidullah', isPremium: true },
    { identifier: 'es.cortes', displayName: 'Spanish', subName: 'Julio Cortes', isPremium: true },
    { identifier: 'de.aburida', displayName: 'German', subName: 'Abu Rida', isPremium: true },
    { identifier: 'it.piccardo', displayName: 'Italian', subName: 'Hamza Roberto Piccardo', isPremium: true },
    { identifier: 'pt.elhayek', displayName: 'Portuguese', subName: 'Samir El-Hayek', isPremium: true },
    { identifier: 'nl.keyzer', displayName: 'Dutch', subName: 'Salomo Keyzer', isPremium: true },
    { identifier: 'ru.kuliev', displayName: 'Russian', subName: 'Elmir Kuliev', isPremium: true },
    { identifier: 'sq.ahmeti', displayName: 'Albanian', subName: 'Sherif Ahmeti', isPremium: true },
    { identifier: 'bs.korkut', displayName: 'Bosnian', subName: 'Besim Korkut', isPremium: true },
    { identifier: 'tr.diyanet', displayName: 'Turkish', subName: 'Diyanet Isleri', isPremium: true },

    // ── Middle East / Caucasus / Central Asia ──
    { identifier: 'fa.ghomshei', displayName: 'Persian', subName: 'Mahdi Elahi Ghomshei', isPremium: true },
    { identifier: 'az.musayev', displayName: 'Azerbaijani', subName: 'Alikhan Musayev', isPremium: true },
    { identifier: 'uz.sodik', displayName: 'Uzbek', subName: 'Muhammad Sodik Muhammad Yusuf', isPremium: true },

    // ── South Asia ──
    { identifier: 'ur.kanzuliman', displayName: 'Urdu', subName: 'Ahmed Raza Khan', isPremium: true },
    { identifier: 'hi.hindi', displayName: 'Hindi', subName: 'Farooq Khan & Nadwi', isPremium: true },
    { identifier: 'bn.bengali', displayName: 'Bengali', subName: 'Zohurul Hoque', isPremium: true },
    { identifier: 'ta.tamil', displayName: 'Tamil', subName: 'Jan Trust Foundation', isPremium: true },

    // ── Southeast Asia ──
    { identifier: 'id.indonesian', displayName: 'Indonesian', subName: 'Bahasa Indonesia', isPremium: true },
    { identifier: 'ms.basmeih', displayName: 'Malay', subName: 'Abdullah Basmeih', isPremium: true },
    { identifier: 'th.thai', displayName: 'Thai', subName: 'King Fahd Complex', isPremium: true },

    // ── East Asia ──
    { identifier: 'zh.jian', displayName: 'Chinese', subName: 'Ma Jian', isPremium: true },
    { identifier: 'ja.japanese', displayName: 'Japanese', subName: 'Ryoichi Mita', isPremium: true },

    // ── Africa ──
    { identifier: 'sw.barwani', displayName: 'Swahili', subName: 'Ali Muhsin Al-Barwani', isPremium: true },
    { identifier: 'so.abduh', displayName: 'Somali', subName: 'Mahmud Muhammad Abduh', isPremium: true },
    { identifier: 'am.sadiq', displayName: 'Amharic', subName: 'Muhammad Sadiq & Sani Habib', isPremium: true },
];

function getActiveWordByWeight(words: string[], posMs: number, durMs: number): number {
    if (words.length === 0 || durMs <= 0) return 0;
    const baseLengths = words.map(w => Math.max(w.replace(/[\u064B-\u065F\u0610-\u061A\u06D6-\u06DC]/g, '').length, 1));
    const total = baseLengths.reduce((a, b) => a + b, 0);
    const ratio = Math.min(posMs / durMs, 1);
    let cumulative = 0;
    for (let i = 0; i < baseLengths.length; i++) {
        cumulative += baseLengths[i] / total;
        if (ratio <= cumulative) return i;
    }
    return words.length - 1;
}

// \u2500\u2500\u2500 Memoized ayah row \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
// Pulled out and React.memo'd so that when playback ticks fire (every 200ms),
// only the currently-playing ayah re-renders \u2014 all other visible ayahs are
// skipped via shallow prop comparison. Cuts FlatList re-renders from N to 1
// per playback tick and is what makes the reader feel smooth during playback.
interface AyahRowProps {
    ayah: Ayah;
    index: number;
    isActive: boolean;
    isPlaying: boolean;
    audioLoading: boolean;
    isBookmarked: boolean;
    edition: string;
    activeWordIndex: number;   // -1 when not active
    activeMeaning: string;
    accentColor: string;
    // Stable handlers — receive `index` / `ayahNumber` as args so the parent
    // doesn't need to recreate function references per row each render.
    onPressAyah: (ayahNumber: number) => void;
    onPressPlay: (index: number) => void;
}

const AyahRow = React.memo(function AyahRow({
    ayah, index, isActive, isPlaying, audioLoading, isBookmarked, edition,
    activeWordIndex, activeMeaning, accentColor, onPressAyah, onPressPlay,
}: AyahRowProps) {
    const isArabicMushaf = edition.startsWith('quran-') || edition.startsWith('ar.');
    const isRTL = isArabicMushaf
        || edition.startsWith('ur.')
        || edition.startsWith('fa.')
        || edition.startsWith('he.')
        || edition.startsWith('sd.')
        || edition.startsWith('ps.');

    const baseTextStyle: any = [
        styles.ayahText,
        isRTL && { textAlign: 'right' as const, writingDirection: 'rtl' as const },
        isArabicMushaf && { fontFamily: 'AmiriQuran', lineHeight: 56 },
        !isArabicMushaf && isRTL && { lineHeight: 30, fontSize: 17 },
    ];

    return (
        <Pressable
            style={({ pressed }) => [
                styles.ayahCard,
                isBookmarked && styles.bookmarkedAyahCard,
                isActive && styles.activeAyahCard,
                // Immediate visual feedback so users feel the press register
                // even before the bookmark state propagates through the list.
                pressed && { opacity: 0.7 },
            ]}
            android_ripple={{ color: 'rgba(34, 211, 238, 0.15)', borderless: false }}
            hitSlop={4}
            onPress={() => onPressAyah(ayah.numberInSurah)}
        >
            <View style={styles.ayahInfo}>
                <View style={styles.numberCircle}>
                    <Text style={styles.numberText}>{ayah.numberInSurah}</Text>
                </View>
                <View style={styles.ayahActions}>
                    <Pressable
                        onPress={() => onPressPlay(index)}
                        style={({ pressed }) => [styles.ayahPlayButton, pressed && { opacity: 0.6 }]}
                        android_ripple={{ color: 'rgba(34, 211, 238, 0.25)', borderless: true, radius: 22 }}
                        hitSlop={10}
                    >
                        {isActive && audioLoading ? (
                            <ActivityIndicator size="small" color="#22d3ee" />
                        ) : isActive && isPlaying ? (
                            <Pause size={16} color="#22d3ee" fill="#22d3ee" />
                        ) : (
                            <Play size={16} color="#94a3b8" />
                        )}
                    </Pressable>
                    {isBookmarked && <Bookmark color="#22d3ee" size={16} fill="#22d3ee" />}
                </View>
            </View>

            {/* Karaoke highlight only for the active ayah while playing */}
            {isActive && isPlaying ? (() => {
                const words = ayah.text.split(' ');
                return (
                    <View>
                        <Text style={baseTextStyle}>
                            {words.map((word: string, wi: number) => (
                                <Text key={wi} style={wi === activeWordIndex ? styles.wordActive : styles.wordUpcoming}>
                                    {word}{wi < words.length - 1 ? ' ' : ''}
                                </Text>
                            ))}
                        </Text>
                        {activeMeaning ? (
                            <View style={styles.wordMeaningPill}>
                                <Text style={[styles.wordMeaningText, { color: accentColor }]}>{activeMeaning}</Text>
                            </View>
                        ) : null}
                    </View>
                );
            })() : isTajweedEdition(edition) ? (
                <Text style={[...baseTextStyle, isActive && { opacity: 0.95 }]}>
                    {parseTajweed(ayah.text).map((tok, ti) => (
                        <Text key={ti} style={{ color: TAJWEED_COLORS[tok.rule] }}>{tok.text}</Text>
                    ))}
                </Text>
            ) : (
                <Text style={[...baseTextStyle, isActive && { color: '#22d3ee' }]}>
                    {ayah.text}
                </Text>
            )}
        </Pressable>
    );
});

export function SurahReader({ surahNumber: initialSurahNumber, edition = 'en.sahih', onEditionChange, onClose, playQueue, playlistName, initialAyahNumber }: Props) {
    const [activeSurahNumber, setActiveSurahNumber] = useState(initialSurahNumber);
    const surahNumber = activeSurahNumber; // alias so existing references stay valid
    const autoPlayRef = useRef(false); // true when advancing to next surah automatically

    // Android hardware back button — close the reader instead of leaving the
    // app. iOS users tap the on-screen back arrow; Android users instinctively
    // hit the system back gesture, which previously did nothing here.
    useEffect(() => {
        if (Platform.OS !== 'android') return;
        const sub = BackHandler.addEventListener('hardwareBackPress', () => {
            onClose();
            return true; // mark event handled so OS doesn't also bubble it
        });
        return () => sub.remove();
    }, [onClose]);

    // Queue tracking for playlist mode
    const queueIndexRef = useRef<number>(0);

    // Initialize queue position when playQueue is provided
    useEffect(() => {
        if (playQueue && playQueue.length > 0) {
            const idx = playQueue.indexOf(initialSurahNumber);
            queueIndexRef.current = idx >= 0 ? idx : 0;
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const { isPremium, openPaywall } = usePurchases();
    const audio = useQuranAudio();
    // Read playing state first so useProgress can use it to set poll rate.
    const isPlaying = audio.isPlaying;
    const audioLoading = audio.isLoading;
    // Poll at 250ms while playing for smooth karaoke; slow to 2 s when idle
    // so the native bridge stays quiet and list scroll stays responsive.
    const progress = useProgress(isPlaying ? 250 : 2000);
    const [surah, setSurah] = useState<SurahDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [modalVisible, setModalVisible] = useState(false);
    const [hifzVisible, setHifzVisible] = useState(false);
    const flatListRef = useRef<FlatList>(null);
    const [initialScrollDone, setInitialScrollDone] = useState(false);
    const [bookmarkedAyah, setBookmarkedAyah] = useState<number | null>(null);
    const lastReadAyahRef = useRef<number>(1);
    // Remembers the last ayah we jumped to so we re-scroll only when the user
    // explicitly requests a new ayah (not on every re-render).
    const lastProcessedAyahRef = useRef<number | undefined>(undefined);

    // Offline state — used to highlight downloaded surahs in the list etc.
    const [offlineUri, setOfflineUri] = useState<string | null>(null);

    // Audio state — primary engine is TrackPlayer (via QuranAudioContext) so
    // the user gets Now Playing / lockscreen controls. Local state mirrors
    // what the context tells us for UI purposes.
    const [playbackSpeed, setPlaybackSpeed] = useState<0.75 | 1 | 1.25 | 1.5>(1);
    const playbackSpeedRef = useRef<0.75 | 1 | 1.25 | 1.5>(1);
    const [currentAyahIndex, setCurrentAyahIndex] = useState<number | null>(null);
    const currentAyahIndexRef = useRef<number | null>(null);
    const [audioAyahs, setAudioAyahs] = useState<Ayah[]>([]);
    const audioAyahsRef = useRef<Ayah[]>([]);

    // Word-level highlight tracking — position/duration derived from
    // TrackPlayer's useProgress (in seconds; convert to ms for timing data).
    const playbackPosition = progress.position * 1000;
    const playbackDuration = Math.max(progress.duration * 1000, 1);
    const [ayahTimingData, setAyahTimingData] = useState<AyahAudioData[]>([]);
    const [ayahWordData, setAyahWordData] = useState<AyahWords[]>([]);

    // Surah is declared after these states — guarded inline below.
    // Compute the active word index for the CURRENTLY playing ayah only.
    // Memoized so the FlatList doesn't re-evaluate per-row on every render.
    // When playback ticks update playbackPosition (every 200ms), this memo
    // re-runs, but it's a single O(1)-ish lookup, not per-ayah work.
    const surahForActive = useRef<SurahDetail | null>(null);
    const { activeWordIndex, activeMeaning } = React.useMemo(() => {
        const s = surahForActive.current;
        if (!s || currentAyahIndex === null || currentAyahIndex < 0) {
            return { activeWordIndex: -1, activeMeaning: '' };
        }
        const ayah = s.ayahs[currentAyahIndex];
        if (!ayah) return { activeWordIndex: -1, activeMeaning: '' };
        const words = ayah.text.split(' ');
        const isArabicMushaf = edition.startsWith('quran-') || edition.startsWith('ar.');
        const segments = ayahTimingData.find(a => a.ayahNumber === ayah.numberInSurah)?.segments ?? [];
        const idx = isArabicMushaf && segments.length > 0
            ? getWordAtTime(segments, playbackPosition)
            : isArabicMushaf
                ? getActiveWordByWeight(words, playbackPosition, playbackDuration)
                : Math.floor(Math.min(playbackPosition / Math.max(playbackDuration, 1), 1) * words.length);
        const wordList = ayahWordData.find(a => a.ayahNumber === ayah.numberInSurah)?.words ?? [];
        const meaning = isArabicMushaf && idx >= 0 && idx < wordList.length
            ? wordList[idx]?.meaning ?? ''
            : '';
        return { activeWordIndex: idx, activeMeaning: meaning };
    }, [currentAyahIndex, playbackPosition, playbackDuration, ayahTimingData, ayahWordData, edition]);

    // ── Sync currentAyahIndex with whichever track TrackPlayer is on ──
    // When TrackPlayer auto-advances (or lockscreen skip-next fires), the
    // active track's ayahNumber tells us which row to highlight. Only sync
    // when we're playing audio for the same surah this reader is showing.
    useEffect(() => {
        if (
            audio.currentAyahNumber != null
            && audio.currentSurahNumber === activeSurahNumber
            && surahForActive.current
        ) {
            const idx = surahForActive.current.ayahs.findIndex(
                (a) => a.numberInSurah === audio.currentAyahNumber
            );
            if (idx >= 0 && idx !== currentAyahIndexRef.current) {
                setCurrentAyahIndex(idx);
                currentAyahIndexRef.current = idx;
            }
        }
    }, [audio.currentAyahNumber, audio.currentSurahNumber, activeSurahNumber]);

    // Stable Function Refs for background callbacks
    const playAyahRef = useRef<(index: number) => Promise<void>>(null);
    const handleNextAyahRef = useRef<() => void>(null);

    // Sleep timer
    const SLEEP_OPTIONS = [15, 30, 60] as const;
    const [sleepTimerMins, setSleepTimerMins] = useState<0 | 15 | 30 | 60>(0);
    const [sleepSecondsLeft, setSleepSecondsLeft] = useState(0);
    const sleepIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    // Repeat mode
    const [repeatSurah, setRepeatSurah] = useState(false);
    const repeatSurahRef = useRef(false);


    const clearSleepTimer = () => {
        if (sleepIntervalRef.current) {
            clearInterval(sleepIntervalRef.current);
            sleepIntervalRef.current = null;
        }
        setSleepTimerMins(0);
        setSleepSecondsLeft(0);
        // Restore full volume on TrackPlayer
        TrackPlayer.setVolume(1.0).catch(() => {});
    };

    const cycleSleepTimer = () => {
        clearSleepTimer();
        const next = sleepTimerMins === 0 ? 15 : sleepTimerMins === 15 ? 30 : sleepTimerMins === 30 ? 60 : 0;
        if (next === 0) return;
        const totalSeconds = next * 60;
        setSleepTimerMins(next);
        setSleepSecondsLeft(totalSeconds);
        let remaining = totalSeconds;
        sleepIntervalRef.current = setInterval(async () => {
            remaining -= 1;
            setSleepSecondsLeft(remaining);
            // Fade volume in last 30 seconds
            if (remaining <= 30) {
                const vol = Math.max(0.01, remaining / 30);
                try { await TrackPlayer.setVolume(vol); } catch (_) {}
            }
            if (remaining <= 0) {
                clearInterval(sleepIntervalRef.current!);
                sleepIntervalRef.current = null;
                setSleepTimerMins(0);
                setSleepSecondsLeft(0);
                // Pause and reset volume
                try {
                    await TrackPlayer.pause();
                    await TrackPlayer.setVolume(1.0);
                } catch (_) {}
            }
        }, 1000);
    };

    // Cleanup sleep timer on unmount
    useEffect(() => {
        return () => {
            if (sleepIntervalRef.current) clearInterval(sleepIntervalRef.current);
        };
    }, []);

    const formatSleepTime = (secs: number) => {
        const m = Math.floor(secs / 60);
        const s = secs % 60;
        return `${m}:${s.toString().padStart(2, '0')}`;
    };

    // Audio bar slide animation
    const [showAudioBar, setShowAudioBar] = useState(false);
    const audioBarAnim = useRef(new Animated.Value(150)).current;

    const showBar = useCallback(() => {
        setShowAudioBar(true);
        Animated.spring(audioBarAnim, {
            toValue: 0,
            useNativeDriver: true,
            tension: 80,
            friction: 12,
        }).start();
    }, [audioBarAnim]);

    const hideBar = useCallback(() => {
        Animated.timing(audioBarAnim, {
            toValue: 150,
            duration: 250,
            useNativeDriver: true,
        }).start(() => setShowAudioBar(false));
    }, [audioBarAnim]);

    const { colors } = useTheme();

    // Follow external surah changes (e.g. user picks a new verse from search
    // while SurahReader is already mounted on a different surah). Internal
    // auto-advance still calls setActiveSurahNumber directly — that's fine
    // because the prop hasn't changed.
    useEffect(() => {
        if (initialSurahNumber !== activeSurahNumber) {
            setActiveSurahNumber(initialSurahNumber);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [initialSurahNumber]);

    useEffect(() => {
        loadSurah();
    }, [activeSurahNumber, edition]);

    // Refresh local audioAyahs (per-ayah URL list) whenever the user changes
    // reciter. The audio context handles the live TrackPlayer queue swap
    // (preserving position) — this just keeps our cached URL list fresh so
    // future playAyah() calls build the queue with the new voice.
    useEffect(() => {
        const unsub = subscribeReciter(async (newReciterId) => {
            try {
                const fresh = await QuranService.getAudioRecitation(activeSurahNumber, newReciterId);
                setAudioAyahs(fresh);
                audioAyahsRef.current = fresh;
            } catch { /* ignore */ }
        });
        return () => unsub();
    }, [activeSurahNumber]);

    // Bumped each time loadSurah is called. Stored on a ref so async callbacks
    // can compare against the latest value and bail if the user has since
    // switched to a different surah (race-condition guard). Without this, if
    // the user taps surah A then quickly switches to surah B, A's slower
    // response could land after B's and overwrite B's content.
    const loadRequestIdRef = useRef(0);

    const loadSurah = async () => {
        const isAutoAdvance = autoPlayRef.current;
        const requestId = ++loadRequestIdRef.current;
        const requestedSurahNumber = surahNumber;
        setLoading(true);
        setInitialScrollDone(false);
        if (!isAutoAdvance) hideBar();

        // Audio session is now managed globally by TrackPlayer in
        // QuranAudioContext — no per-surah setup needed here.

        // Check for offline audio (used by the download badge logic elsewhere)
        const localUri = OfflineQuranService.getLocalUri(surahNumber);
        setOfflineUri(localUri);

        const data = await QuranService.getSurah(surahNumber, edition);

        // Race-condition guard: user switched to a different surah while we
        // were fetching this one — abandon this load entirely.
        if (requestId !== loadRequestIdRef.current) return;

        if (data) {
            setSurah(data);
            surahForActive.current = data;
            // ⚡️ Render the surah text IMMEDIATELY — audio recitation, ayah
            // timing data, and word-level data are only needed for playback
            // and don't block reading. Load them in the background so the
            // user sees text instantly and the loading spinner goes away.
            setLoading(false);

            // Background load — does not block the UI
            (async () => {
                try {
                    const [audioData, timingData, wordsData] = await Promise.all([
                        QuranService.getAudioRecitation(requestedSurahNumber, getCurrentReciterId()),
                        QuranTimingService.getSurahAudioData(requestedSurahNumber),
                        QuranWordService.getSurahWords(requestedSurahNumber),
                    ]);
                    // Same race-condition guard for background data — if the
                    // user already moved on, these results are stale.
                    if (requestId !== loadRequestIdRef.current) return;
                    setAudioAyahs(audioData);
                    audioAyahsRef.current = audioData;
                    setAyahTimingData(timingData);
                    setAyahWordData(wordsData);
                } catch { /* audio is opt-in; ignore failures */ }
            })();

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

        // Auto-play first ayah when continuing from previous surah
        if (isAutoAdvance) {
            autoPlayRef.current = false;
            setTimeout(() => playAyahRef.current?.(0), 300);
        }
    };

    // Stop TrackPlayer when the reader unmounts (e.g. user closes the surah).
    useEffect(() => {
        return () => {
            TrackPlayer.reset().catch(() => {});
        };
    }, []);

    // Routes ayah playback through TrackPlayer (via the QuranAudioContext).
    // The queue is the full current surah (1 ayah = 1 track), so lockscreen
    // skip-next/prev steps through ayahs and Now Playing shows the right
    // metadata. Reusing the queue when staying within the same surah means
    // we just `skip(index)` instead of rebuilding.
    // Cancellation token — bumped on every playAyah call. If the user taps
    // another ayah while a previous load is still in flight, the new tap wins
    // and the old request abandons before clobbering TrackPlayer state.
    const playAyahTokenRef = useRef(0);

    const playAyah = async (index: number) => {
        if (!audioAyahs[index] || !surah) return;

        // Each tap gets a fresh token. If a later tap fires before this one
        // finishes, that tap will increment the token and we'll see it differs
        // from ours below — meaning we should bail out instead of fighting it.
        const token = ++playAyahTokenRef.current;

        // Eagerly mark this ayah as active so the play button changes to
        // a spinner immediately, instead of staying on the grey Play icon
        // until the network fetch finishes.
        setCurrentAyahIndex(index);
        currentAyahIndexRef.current = index;
        showBar();

        try {
            const sameSurahAlreadyLoaded =
                audio.currentSurahNumber === surahNumber
                && audio.currentAyahNumber != null;

            if (sameSurahAlreadyLoaded) {
                // Queue already exists for this surah — just jump to the
                // right track. No reload required. This is the FAST path —
                // typically completes in <100ms.
                await audio.skipToIndex(index);
            } else {
                // Build a fresh queue for the whole surah, starting playback
                // at the tapped ayah.
                const tracks = audioAyahs.map(a => ({
                    url: a.text,
                    title: `${surah.englishName} · ${a.numberInSurah}`,
                    ayahNumber: a.numberInSurah,
                }));
                await audio.startAyahQueue(tracks, surahNumber, surah.englishName);
                // Race-guard: if user tapped a different ayah while we were
                // building the queue, abandon — the new tap is handling it.
                if (token !== playAyahTokenRef.current) return;
                if (index > 0) {
                    await audio.skipToIndex(index);
                }
            }

            // Final race-guard before scroll/rate
            if (token !== playAyahTokenRef.current) return;

            // Re-assert playback rate after starting (track changes reset it)
            await TrackPlayer.setRate(playbackSpeedRef.current).catch(() => {});

            // Auto-scroll to the active ayah so the user can see the highlight
            try {
                flatListRef.current?.scrollToIndex({
                    index,
                    animated: true,
                    viewPosition: 0.3,
                });
            } catch { /* offscreen items can throw; ignore */ }
        } catch (e) {
            console.error('[SurahReader] playAyah error:', e);
        }
    };

    // End-of-queue handler — fires when TrackPlayer's queue ends (either
    // last ayah of surah finished playing OR user kept hitting "next" past
    // the final ayah). Picks the right "next" behaviour based on mode.
    const handleNextAyah = useCallback(() => {
        // End of surah behaviour:
        if (repeatSurahRef.current) {
            // 1. Repeat: restart from first ayah
            setTimeout(() => playAyahRef.current?.(0), 200);
            return;
        }
        if (playQueue && playQueue.length > 0) {
            // 2. Playlist mode: advance to next surah in playlist
            const nextQueueIndex = queueIndexRef.current + 1;
            if (nextQueueIndex < playQueue.length) {
                queueIndexRef.current = nextQueueIndex;
                autoPlayRef.current = true;
                setCurrentAyahIndex(null);
                currentAyahIndexRef.current = null;
                setActiveSurahNumber(playQueue[nextQueueIndex]);
                return;
            }
        }
        // 3. Default: advance to next surah (stops at Al-Nas = 114)
        if (activeSurahNumber < 114) {
            autoPlayRef.current = true;
            setCurrentAyahIndex(null);
            currentAyahIndexRef.current = null;
            setActiveSurahNumber(activeSurahNumber + 1);
        } else {
            setCurrentAyahIndex(null);
            currentAyahIndexRef.current = null;
            hideBar();
        }
    }, [hideBar, activeSurahNumber, playQueue]);

    // Listen for TrackPlayer's "queue ended" event so end-of-surah behaviour
    // (repeat / next surah / next playlist track) fires reliably.
    useEffect(() => {
        const sub = TrackPlayer.addEventListener(Event.PlaybackQueueEnded, () => {
            handleNextAyahRef.current?.();
        });
        return () => sub.remove();
    }, []);

    // Sync refs every render
    playAyahRef.current = playAyah;
    handleNextAyahRef.current = handleNextAyah;
    repeatSurahRef.current = repeatSurah;

    const handlePrevAyah = () => {
        const currentIndex = currentAyahIndexRef.current;
        const prevIndex = (currentIndex !== null ? currentIndex : 1) - 1;
        if (prevIndex >= 0) {
            playAyahRef.current?.(prevIndex);
        }
    };

    const handlePlayPause = async () => {
        // Prefer the live TrackPlayer state — on Android the activeTrack
        // metadata can lag behind, which caused tapping play-while-playing
        // to incorrectly enter the "start fresh" branch and restart the surah.
        try {
            const { state } = await TrackPlayer.getPlaybackState();
            if (
                state === State.Playing ||
                state === State.Paused ||
                state === State.Buffering ||
                state === State.Ready
            ) {
                // Something is loaded — just toggle. Don't reset.
                await audio.togglePlayPause();
                return;
            }
        } catch { /* fall through to fresh-start path */ }

        // Nothing loaded yet — start playback from the current ayah.
        import('../utils/analytics').then(m => m.track('quran_played', { surah: surah?.number })).catch(() => {});
        playAyahRef.current?.(currentAyahIndex !== null ? currentAyahIndex : 0);
    };

    const handleSpeedChange = async () => {
        const speeds: (0.75 | 1 | 1.25 | 1.5)[] = [0.75, 1, 1.25, 1.5];
        const next = speeds[(speeds.indexOf(playbackSpeed) + 1) % speeds.length];
        setPlaybackSpeed(next);
        playbackSpeedRef.current = next;
        try { await TrackPlayer.setRate(next); } catch { /* ignore */ }
    };

    const renderAudioControlsContent = () => (
        <>
            {/* Main controls row: speed | skip back | play | skip forward */}
            <View style={styles.audioControls}>
                <Pressable
                    onPress={handleSpeedChange}
                    android_ripple={{ color: colors.accent + '40', borderless: false }}
                    hitSlop={6}
                    style={({ pressed }) => [
                        styles.sleepTimerBtn,
                        playbackSpeed !== 1 && { backgroundColor: colors.accent + '33', borderColor: colors.accent + '66' },
                        pressed && { opacity: 0.6 },
                    ]}
                >
                    <Text style={[styles.sleepTimerText, playbackSpeed !== 1 && { color: colors.accent }]}>
                        {playbackSpeed}x
                    </Text>
                </Pressable>

                <Pressable
                    onPress={handlePrevAyah}
                    android_ripple={{ color: 'rgba(255,255,255,0.2)', borderless: true, radius: 24 }}
                    hitSlop={10}
                    style={({ pressed }) => [styles.controlButton, pressed && { opacity: 0.6 }]}
                >
                    <SkipBack size={20} color="#fff" />
                </Pressable>

                <Pressable
                    onPress={handlePlayPause}
                    android_ripple={{ color: 'rgba(0,0,0,0.2)', borderless: true, radius: 32 }}
                    hitSlop={10}
                    style={({ pressed }) => [
                        styles.playPauseButton,
                        { backgroundColor: colors.accent },
                        pressed && { opacity: 0.85 },
                    ]}
                >
                    {audioLoading ? (
                        <ActivityIndicator size="small" color="#000" />
                    ) : isPlaying ? (
                        <Pause size={24} color="#000" fill="#000" />
                    ) : (
                        <Play size={24} color="#000" fill="#000" style={{ marginLeft: 2 }} />
                    )}
                </Pressable>

                <Pressable
                    onPress={handleNextAyah}
                    android_ripple={{ color: 'rgba(255,255,255,0.2)', borderless: true, radius: 24 }}
                    hitSlop={10}
                    style={({ pressed }) => [styles.controlButton, pressed && { opacity: 0.6 }]}
                >
                    <SkipForward size={20} color="#fff" />
                </Pressable>

                {/* Placeholder to balance the speed button on the left */}
                <View style={{ width: 42 }} />
            </View>

            {/* Footer: ayah counter row */}
            {currentAyahIndex !== null && surah && (
                <View style={styles.audioFooter}>
                    {playlistName && playQueue && playQueue.length > 0 ? (
                        <View style={styles.audioInfo}>
                            <Volume2 size={12} color="#94a3b8" />
                            <Text style={styles.audioInfoText}>
                                {playlistName} · {queueIndexRef.current + 1}/{playQueue.length}
                            </Text>
                        </View>
                    ) : (
                        <View style={styles.audioInfo}>
                            <Volume2 size={12} color="#94a3b8" />
                            <Text style={styles.audioInfoText}>
                                Ayah {currentAyahIndex + 1} of {surah.numberOfAyahs}
                            </Text>
                        </View>
                    )}
                </View>
            )}

            {/* Footer: toggles row */}
            <View style={styles.audioFooterToggles}>
                <TouchableOpacity
                    onPress={() => setRepeatSurah(prev => !prev)}
                    style={[styles.sleepTimerBtn, repeatSurah && { backgroundColor: colors.accent + '33', borderColor: colors.accent + '66' }]}
                >
                    <Repeat size={13} color={repeatSurah ? colors.accent : '#94a3b8'} />
                    <Text style={[styles.sleepTimerText, repeatSurah && { color: colors.accent }]}>Loop</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    onPress={cycleSleepTimer}
                    style={[styles.sleepTimerBtn, sleepTimerMins > 0 && { backgroundColor: colors.accent + '33', borderColor: colors.accent + '66' }]}
                >
                    <Timer size={13} color={sleepTimerMins > 0 ? colors.accent : '#94a3b8'} />
                    <Text style={[styles.sleepTimerText, sleepTimerMins > 0 && { color: colors.accent }]}>
                        {sleepTimerMins === 0 ? 'Sleep' : formatSleepTime(sleepSecondsLeft)}
                    </Text>
                </TouchableOpacity>
            </View>
        </>
    );

    // Auto-scroll when data is ready. Priority order:
    //   1. `initialAyahNumber` prop — caller wants a specific ayah (e.g. user
    //      tapped "2:255" in the global search). Re-fires whenever the prop
    //      changes, so a second search to a new ayah within the same surah
    //      still scrolls.
    //   2. Resume from saved bookmark on first mount.
    useEffect(() => {
        if (loading || !surah || !flatListRef.current) return;

        const ayahJumpRequested =
            initialAyahNumber !== undefined &&
            initialAyahNumber !== lastProcessedAyahRef.current;
        const firstScroll = !initialScrollDone;
        if (!ayahJumpRequested && !firstScroll) return;

        lastProcessedAyahRef.current = initialAyahNumber;

        const targetAyah = initialAyahNumber ?? lastReadAyahRef.current;
        const index = Math.max(0, Math.min(targetAyah - 1, surah.ayahs.length - 1));

        if (index > 0) {
            setTimeout(() => {
                flatListRef.current?.scrollToIndex({
                    index,
                    animated: ayahJumpRequested && !firstScroll,
                    viewPosition: 0,
                });
            }, 100);
        } else if (index === 0) {
            // Explicit "go to ayah 1" — make sure we're at the top.
            setTimeout(() => {
                flatListRef.current?.scrollToOffset({ offset: 0, animated: false });
            }, 100);
        }

        if (initialAyahNumber) setBookmarkedAyah(initialAyahNumber);
        if (firstScroll) setInitialScrollDone(true);
    }, [loading, surah, initialScrollDone, initialAyahNumber]);

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

    // Stable action handlers so FlatList items don't see new function refs
    // on every parent re-render. Without this, every visible ayah re-renders
    // on every audio tick (4Hz) and the reader feels laggy. We route through
    // a ref so the callbacks themselves are stable, but always call the
    // latest version of saveBookmark / playAyah / handlePlayPause.
    const actionsRef = useRef({ saveBookmark, playAyah, handlePlayPause });
    actionsRef.current = { saveBookmark, playAyah, handlePlayPause };
    const handleAyahPress = useCallback((ayahNumber: number) => {
        actionsRef.current.saveBookmark(ayahNumber);
    }, []);
    const handleAyahPlayPress = useCallback((index: number) => {
        if (currentAyahIndexRef.current === index) {
            actionsRef.current.handlePlayPause();
        } else {
            actionsRef.current.playAyah(index);
        }
    }, []);

    // Memoized renderItem so FlatList passes a stable function reference. Combined
    // with React.memo on AyahRow, this means only rows whose props actually
    // changed (active/bookmarked/playing) re-render — fixes Android list lag.
    const renderAyahItem = useCallback(({ item: ayah, index }: { item: Ayah; index: number }) => {
        const isActive = currentAyahIndex === index;
        const isBookmarked = bookmarkedAyah === ayah.numberInSurah;
        return (
            <AyahRow
                ayah={ayah}
                index={index}
                isActive={isActive}
                isPlaying={isActive && isPlaying}
                audioLoading={isActive && audioLoading}
                isBookmarked={isBookmarked}
                edition={edition}
                activeWordIndex={isActive ? activeWordIndex : -1}
                activeMeaning={isActive ? activeMeaning : ''}
                accentColor={colors.accent}
                onPressAyah={handleAyahPress}
                onPressPlay={handleAyahPlayPress}
            />
        );
    }, [currentAyahIndex, bookmarkedAyah, isPlaying, audioLoading, edition, activeWordIndex, activeMeaning, colors.accent, handleAyahPress, handleAyahPlayPress]);

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
        // Quran translations are FREE for everyone — we never paywall the
        // meaning of the Quran. Premium is for tools (Hifz, offline, etc.).
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
            <SafeAreaView style={styles.headerSafeArea} edges={['top', 'left', 'right']}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={onClose} style={styles.iconButton}>
                        <ArrowLeft color="#fff" size={24} />
                    </TouchableOpacity>

                    <View style={styles.headerTitleContainer}>
                        <Text style={styles.headerTitle}>{surah.englishName}</Text>
                        <Text style={styles.headerSubtitle}>{surah.englishNameTranslation}</Text>
                    </View>

                    <TouchableOpacity
                        onPress={() => {
                            if (!isPremium) { openPaywall(); return; }
                            setHifzVisible(true);
                        }}
                        style={styles.hifzButton}
                    >
                        <Brain color={colors.accent} size={20} />
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 2 }}>
                            <Text style={[styles.hifzLabel, { color: colors.accent, marginTop: 0 }]}>Hifz</Text>
                            {!isPremium && <Lock size={9} color="#f59e0b" />}
                        </View>
                    </TouchableOpacity>

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
                initialNumToRender={8}
                maxToRenderPerBatch={6}
                windowSize={4}
                // Frees memory + GPU cost for off-screen rows on long surahs
                // (Baqarah = 286 ayahs). Critical for Android scroll perf.
                removeClippedSubviews={Platform.OS === 'android'}
                updateCellsBatchingPeriod={50}
                onScrollToIndexFailed={(info) => {
                    // FlatList can't measure offscreen variable-height items
                    // synchronously. Step 1: approximate the offset using the
                    // measured average — gets us close. Step 2: after layout
                    // settles, run a precise scrollToIndex.
                    const offset = info.averageItemLength * info.index;
                    flatListRef.current?.scrollToOffset({ offset, animated: false });
                    setTimeout(() => {
                        flatListRef.current?.scrollToIndex({ index: info.index, animated: false, viewPosition: 0 });
                    }, 200);
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
                contentContainerStyle={[styles.scrollContent, showAudioBar && { paddingBottom: 300 }]}
                // NOTE: deliberately exclude `activeWordIndex` here — it changes
                // per-word during audio playback (~3-8x per second) and was
                // causing the whole FlatList to invalidate on every word
                // highlight tick. On long surahs (Baqarah, 286 ayahs) the
                // constant re-render starved the touch handler and broke
                // scrolling on Android. The active row still gets the prop
                // directly via renderItem so word highlighting still works.
                extraData={`${currentAyahIndex}-${isPlaying}-${audioLoading}-${bookmarkedAyah}`}
                renderItem={renderAyahItem}
            />

            {/* Floating Audio Player — slides up on play, hidden on load */}
            {showAudioBar && (
                <Animated.View style={[styles.audioPlayerContainer, { transform: [{ translateY: audioBarAnim }] }]}>
                    {Platform.OS === 'ios' ? (
                        <BlurView intensity={80} tint="dark" style={styles.audioPlayerBlur}>
                            {renderAudioControlsContent()}
                        </BlurView>
                    ) : (
                        <View style={[styles.audioPlayerBlur, { backgroundColor: 'rgba(15, 23, 42, 0.98)', borderTopWidth: 1, borderColor: 'rgba(255, 255, 255, 0.1)' }]}>
                            {renderAudioControlsContent()}
                        </View>
                    )}
                </Animated.View>
            )}

            {/* Hifz Mode — full screen modal */}
            <Modal
                animationType="slide"
                transparent={false}
                visible={hifzVisible}
                onRequestClose={() => setHifzVisible(false)}
            >
                {surah && (
                    <HifzSession
                        surahNumber={surahNumber}
                        surahName={surah.englishName}
                        surahNameTranslation={surah.englishNameTranslation}
                        totalAyahs={surah.numberOfAyahs}
                        onClose={() => setHifzVisible(false)}
                    />
                )}
            </Modal>

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
    hifzButton: {
        alignItems: 'center',
        paddingHorizontal: 8,
    },
    hifzLabel: {
        fontSize: 10,
        fontWeight: '700',
        marginTop: 2,
    },
    offlineBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 8,
        paddingVertical: 5,
        borderRadius: 8,
        borderWidth: 1,
        marginRight: 4,
    },
    offlineBadgeText: {
        fontSize: 10,
        fontWeight: '700',
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
    wordActive: {
        color: '#22d3ee',
        fontWeight: '800',
        fontSize: 20,
    },
    wordPast: {
        color: '#334155',
        fontWeight: '600',
        fontSize: 19,
    },
    wordUpcoming: {
        color: '#f8fafc',
        fontWeight: '400',
        fontSize: 19,
    },
    wordMeaningPill: {
        alignSelf: 'center',
        marginTop: 8,
        paddingHorizontal: 14,
        paddingVertical: 5,
        borderRadius: 20,
        backgroundColor: 'rgba(34, 211, 238, 0.12)',
        borderWidth: 1,
        borderColor: 'rgba(34, 211, 238, 0.3)',
    },
    wordMeaningText: {
        fontSize: 13,
        fontWeight: '700',
        textAlign: 'center',
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
    audioFooter: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
        marginTop: 6,
    },
    audioFooterToggles: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        marginTop: 8,
        width: '100%',
    },
    audioInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    audioInfoText: {
        color: '#94a3b8',
        fontSize: 11,
        fontWeight: 'bold',
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    sleepTimerBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 4,
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.15)',
        backgroundColor: 'rgba(255,255,255,0.06)',
        minWidth: 42,
    },
    sleepTimerText: {
        color: '#94a3b8',
        fontSize: 11,
        fontWeight: '600',
        textAlign: 'center',
    },
});
