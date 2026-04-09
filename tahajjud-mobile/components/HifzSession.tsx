import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
    View, Text, StyleSheet, TouchableOpacity, ActivityIndicator,
    SafeAreaView, ScrollView, Alert, Modal, FlatList, Switch, GestureResponderEvent,
} from 'react-native';
import { ArrowLeft, Brain, Play, Pause, Eye, ChevronRight, Award, RotateCcw, Plus, Flame, Target, Mic, HelpCircle, Undo2, SkipBack } from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Audio, AVPlaybackStatus, InterruptionModeIOS, InterruptionModeAndroid } from 'expo-av';
import * as FileSystem from 'expo-file-system/legacy';
import { QuranService, SurahDetail } from '../services/QuranService';
import { QuranTimingService, AyahAudioData, getWordAtTime } from '../services/QuranTimingService';
import { QuranWordService, AyahWords } from '../services/QuranWordService';
import { useTheme } from '../context/ThemeContext';
import {
    HifzAyah, HifzRating, StreakData, SavedSession,
    HIDE_FRACTION, getAllHifzData, recordReview, initAyah, getDueReviewsForSurah,
    getStreakData, recordPracticeDay, getDailyGoal, getTodayProgress, addTodayProgress,
    saveSession, loadSession, clearSession, getHardestAyahs, setAyahHifz,
} from '../utils/hifzStorage';
import { haptic } from '../utils/haptic';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';

const AUDIO_CACHE_DIR = FileSystem.documentDirectory + 'hifz_audio/';

interface Props {
    surahNumber: number;
    surahName: string;
    surahNameTranslation: string;
    totalAyahs: number;
    onClose: () => void;
}

interface QueueItem {
    ayahIndices: number[];
    rateIndex: number;
    isAccumulation: boolean;
}

type SessionState = 'setup' | 'practice' | 'summary';
type PracticePhase = 'listening' | 'reciting' | 'rating';

interface SessionResult {
    ayahNumber: number;
    rating: HifzRating;
}

function buildReviewQueue(indices: number[]): QueueItem[] {
    return indices.map(i => ({ ayahIndices: [i], rateIndex: i, isAccumulation: false }));
}

function buildProgressiveQueue(ayahNumbers: number[]): QueueItem[] {
    const items: QueueItem[] = [];
    for (let i = 0; i < ayahNumbers.length; i++) {
        const newIdx = ayahNumbers[i] - 1;
        items.push({ ayahIndices: [newIdx], rateIndex: newIdx, isAccumulation: false });
        if (i > 0) {
            const groupIndices = ayahNumbers.slice(0, i + 1).map(n => n - 1);
            items.push({ ayahIndices: groupIndices, rateIndex: newIdx, isAccumulation: true });
        }
    }
    return items;
}

function levelToColor(level: number, started: boolean): string {
    if (!started) return 'rgba(255,255,255,0.05)';
    if (level === 0) return 'rgba(34,211,238,0.2)';
    if (level <= 2) return 'rgba(239,68,68,0.4)';
    if (level <= 4) return 'rgba(245,158,11,0.45)';
    return 'rgba(34,197,94,0.5)';
}

const RECITATION_SECS = 30;

export function HifzSession({ surahNumber, surahName, surahNameTranslation, totalAyahs, onClose }: Props) {
    const { colors } = useTheme();
    const [sessionState, setSessionState] = useState<SessionState>('setup');

    // Data
    const [surah, setSurah] = useState<SurahDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [hifzData, setHifzData] = useState<Record<string, HifzAyah>>({});
    const [dueReviews, setDueReviews] = useState<HifzAyah[]>([]);
    const [selectedAyahs, setSelectedAyahs] = useState<number[]>([]);
    const [addAyahsModalVisible, setAddAyahsModalVisible] = useState(false);
    const [progressiveMode, setProgressiveMode] = useState(true);

    // Guide
    const [guideVisible, setGuideVisible] = useState(false);

    // Heatmap collapsed by default
    const [heatmapExpanded, setHeatmapExpanded] = useState(false);

    // Streak + goal
    const [streakData, setStreakData] = useState<StreakData>({ lastPracticeDate: '', currentStreak: 0, longestStreak: 0 });
    const [dailyGoal, setDailyGoalState] = useState(5);
    const [todayProgress, setTodayProgress] = useState(0);

    // Practice queue
    const [queue, setQueue] = useState<QueueItem[]>([]);
    const [queuePos, setQueuePos] = useState(0);
    const queueRef = useRef<QueueItem[]>([]);
    const queuePosRef = useRef<number>(0);
    const [revealed, setRevealed] = useState(false);
    const [peekedWords, setPeekedWords] = useState<Set<number>>(new Set());
    const peekTimersRef = useRef<Record<number, ReturnType<typeof setTimeout>>>({});
    const [sessionResults, setSessionResults] = useState<SessionResult[]>([]);
    const [forgotCount, setForgotCount] = useState(0); // attempts on current item before advancing

    // Session resume
    const [savedSession, setSavedSession] = useState<SavedSession | null>(null);

    // Hardest ayahs
    const [hardestAyahs, setHardestAyahs] = useState<HifzAyah[]>([]);

    // Recitation timer — 'auto' scales with word count
    const [recitationTimeSetting, setRecitationTimeSetting] = useState<'auto' | 15 | 30 | 45 | 60>('auto');
    const recitationTimeSettingRef = useRef<'auto' | 15 | 30 | 45 | 60>('auto');

    // Undo last rating
    const [undoAvailable, setUndoAvailable] = useState(false);
    const undoRef = useRef<{
        item: QueueItem;
        prevHifzRecord: HifzAyah | null;
        prevResults: SessionResult[];
        prevQueue: QueueItem[];
        prevQueuePos: number;
    } | null>(null);

    // Scrubber layout width
    const [scrubBarWidth, setScrubBarWidth] = useState(1);

    // Surah ref for dynamic recitation timer
    const surahRef = useRef<SurahDetail | null>(null);

    // Practice phase
    const [practicePhase, setPracticePhase] = useState<PracticePhase>('listening');
    const [recitationSecsLeft, setRecitationSecsLeft] = useState(RECITATION_SECS);
    const recitationTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

    // Settings
    const [repeatCount, setRepeatCount] = useState(2);
    const repeatCountRef = useRef(2);
    const [playbackSpeed, setPlaybackSpeed] = useState<0.75 | 1 | 1.25>(1);
    const playbackSpeedRef = useRef<0.75 | 1 | 1.25>(1);
    const [recitationMode, setRecitationMode] = useState(true);
    const recitationModeRef = useRef(true);
    const [showTranslit, setShowTranslit] = useState(false);
    const [showTranslation, setShowTranslation] = useState(false);

    // Translation (English) for each ayah — ayahNumber → text
    const translationMapRef = useRef<Record<number, string>>({});

    // Audio
    const [isPlaying, setIsPlaying] = useState(false);
    const [audioLoading, setAudioLoading] = useState(false);
    const soundRef = useRef<Audio.Sound | null>(null);
    const [ayahAudioData, setAyahAudioData] = useState<AyahAudioData[]>([]);
    const [ayahWords, setAyahWords] = useState<AyahWords[]>([]);
    // Audio URLs from alquran.cloud (same reliable source as SurahReader)
    const audioUrlMapRef = useRef<Record<number, string>>({}); // ayahNumber → URL
    const [playbackPos, setPlaybackPos] = useState(0);
    const [playbackDur, setPlaybackDur] = useState(1);
    const [playingGroupIdx, setPlayingGroupIdx] = useState(0);
    const playingGroupIdxRef = useRef(0);
    const [currentRepeat, setCurrentRepeat] = useState(1);
    const currentRepeatRef = useRef(1);
    const currentItemRef = useRef<QueueItem | null>(null);
    const playAyahDirectRef = useRef<((ayahNum: number) => Promise<void>) | null>(null);
    const ayahAudioDataRef = useRef<AyahAudioData[]>([]);
    // Preloaded sounds: ayahNum → Sound object buffered and ready to play
    const preloadMapRef = useRef<Record<number, Audio.Sound>>({});

    // Keep refs in sync
    useEffect(() => { ayahAudioDataRef.current = ayahAudioData; }, [ayahAudioData]);
    useEffect(() => { playbackSpeedRef.current = playbackSpeed; }, [playbackSpeed]);
    useEffect(() => { repeatCountRef.current = repeatCount; }, [repeatCount]);
    useEffect(() => { recitationModeRef.current = recitationMode; }, [recitationMode]);
    useEffect(() => { surahRef.current = surah; }, [surah]);
    useEffect(() => { recitationTimeSettingRef.current = recitationTimeSetting; }, [recitationTimeSetting]);
    useEffect(() => {
        if (queue.length > 0 && queuePos < queue.length) {
            currentItemRef.current = queue[queuePos];
        }
    }, [queue, queuePos]);

    useEffect(() => {
        // Set audio mode once for the entire session — calling it on every play causes delay
        Audio.setAudioModeAsync({
            staysActiveInBackground: true,
            interruptionModeIOS: InterruptionModeIOS.MixWithOthers,
            playsInSilentModeIOS: true,
            shouldDuckAndroid: true,
            interruptionModeAndroid: InterruptionModeAndroid.DuckOthers,
            playThroughEarpieceAndroid: false,
        }).catch(() => {});
        loadData();
        return () => {
            soundRef.current?.unloadAsync().catch(() => {});
            // Release all preloaded sounds
            Object.values(preloadMapRef.current).forEach(s => s.unloadAsync().catch(() => {}));
            preloadMapRef.current = {};
            Object.values(peekTimersRef.current).forEach(clearTimeout);
            if (recitationTimerRef.current) clearInterval(recitationTimerRef.current);
        };
    }, []);

    const loadData = async () => {
        setLoading(true);
        // Ensure audio cache directory exists
        await FileSystem.makeDirectoryAsync(AUDIO_CACHE_DIR, { intermediates: true }).catch(() => {});

        const [surahData, audioAyahs, translationData, timingData, wordsData, allHifz, streak, goal, progress] = await Promise.all([
            QuranService.getSurah(surahNumber, 'quran-uthmani'),
            QuranService.getAudioRecitation(surahNumber),
            QuranService.getSurah(surahNumber, 'en.sahih'),
            QuranTimingService.getSurahAudioData(surahNumber),
            QuranWordService.getSurahWords(surahNumber),
            getAllHifzData(),
            getStreakData(),
            getDailyGoal(),
            getTodayProgress(),
        ]);
        setSurah(surahData);
        surahRef.current = surahData;
        // Build ayahNumber → audio URL map from the reliable alquran.cloud source
        const urlMap: Record<number, string> = {};
        audioAyahs.forEach((a: any) => { urlMap[a.numberInSurah] = a.text; });
        audioUrlMapRef.current = urlMap;
        // Build ayahNumber → English translation map
        const transMap: Record<number, string> = {};
        translationData?.ayahs?.forEach((a: any) => { transMap[a.numberInSurah] = a.text; });
        translationMapRef.current = transMap;
        setAyahAudioData(timingData);
        ayahAudioDataRef.current = timingData;
        setAyahWords(wordsData);
        setHifzData(allHifz);
        setStreakData(streak);
        setDailyGoalState(goal);
        setTodayProgress(progress);
        const [due, hardest, saved] = await Promise.all([
            getDueReviewsForSurah(surahNumber),
            getHardestAyahs(surahNumber, 5),
            loadSession(surahNumber),
        ]);
        setDueReviews(due);
        setHardestAyahs(hardest);
        setSavedSession(saved);
        setLoading(false);
        // Kick off preloading for due reviews so first play is instant
        due.slice(0, 3).forEach(a => preloadAyah(a.ayahNumber));
        // Auto-show guide on first ever open
        const seen = await AsyncStorage.getItem('hifz_guide_seen_v1');
        if (!seen) setGuideVisible(true);
    };

    // ── Offline-first audio cache ───────────────────────────────────

    const getAudioUri = useCallback(async (ayahNum: number): Promise<string | null> => {
        const remoteUrl = audioUrlMapRef.current[ayahNum];
        if (!remoteUrl) return null;
        const localPath = AUDIO_CACHE_DIR + `${surahNumber}_${ayahNum}.mp3`;
        try {
            const info = await FileSystem.getInfoAsync(localPath);
            if (info.exists) return localPath;
            const result = await FileSystem.downloadAsync(remoteUrl, localPath);
            if (result.status === 200) return localPath;
        } catch { /* fall through to remote */ }
        return remoteUrl;
    }, [surahNumber]);

    // ── Preloading ──────────────────────────────────────────────────

    const preloadAyah = useCallback(async (ayahNum: number) => {
        if (preloadMapRef.current[ayahNum]) return; // already buffered
        const uri = await getAudioUri(ayahNum);
        if (!uri) return;
        try {
            const { sound } = await Audio.Sound.createAsync(
                { uri },
                { shouldPlay: false, progressUpdateIntervalMillis: 50 }
            );
            preloadMapRef.current[ayahNum] = sound;
        } catch { /* silent — fallback will createAsync on demand */ }
    }, [getAudioUri]);

    // Preload current item + next item whenever queue position changes
    useEffect(() => {
        if (!audioUrlMapRef.current || Object.keys(audioUrlMapRef.current).length === 0) return;
        const item = queue[queuePos];
        if (item) item.ayahIndices.forEach(idx => preloadAyah(idx + 1));
        const next = queue[queuePos + 1];
        if (next) next.ayahIndices.forEach(idx => preloadAyah(idx + 1));
    }, [queuePos, queue, preloadAyah]);

    // ── Recitation countdown ────────────────────────────────────────

    const computeRecitationSecs = useCallback((): number => {
        const setting = recitationTimeSettingRef.current;
        if (setting !== 'auto') return setting;
        const item = currentItemRef.current;
        const s = surahRef.current;
        if (!item || !s) return 30;
        let wordCount = 0;
        item.ayahIndices.forEach(idx => {
            const ayah = s.ayahs[idx];
            if (ayah) wordCount += ayah.text.split(' ').length;
        });
        // ~1.3 Arabic words/second is a comfortable recitation pace
        return Math.max(15, Math.min(90, Math.round(wordCount / 1.3)));
    }, []);

    const startRecitationPhase = useCallback(() => {
        const secs = computeRecitationSecs();
        setPracticePhase('reciting');
        setRecitationSecsLeft(secs);
        if (recitationTimerRef.current) clearInterval(recitationTimerRef.current);
        recitationTimerRef.current = setInterval(() => {
            setRecitationSecsLeft(prev => {
                if (prev <= 1) {
                    clearInterval(recitationTimerRef.current!);
                    recitationTimerRef.current = null;
                    setPracticePhase('rating');
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
    }, []);

    const skipRecitation = useCallback(() => {
        if (recitationTimerRef.current) {
            clearInterval(recitationTimerRef.current);
            recitationTimerRef.current = null;
        }
        setPracticePhase('rating');
    }, []);

    // ── Audio ───────────────────────────────────────────────────────

    const stopAudio = useCallback(async () => {
        try {
            if (soundRef.current) {
                await soundRef.current.unloadAsync();
                soundRef.current = null;
            }
        } catch {}
        setIsPlaying(false);
        setPlaybackPos(0);
        setPlaybackDur(1);
    }, []);

    const onPlaybackStatus = useCallback((status: AVPlaybackStatus) => {
        if (status.isLoaded) {
            setPlaybackPos(status.positionMillis ?? 0);
            setPlaybackDur(status.durationMillis ?? 1);
            if (status.didJustFinish) {
                const item = currentItemRef.current;
                const nextInGroup = playingGroupIdxRef.current + 1;
                if (item && nextInGroup < item.ayahIndices.length) {
                    // More ayahs in the group — play next
                    playingGroupIdxRef.current = nextInGroup;
                    setPlayingGroupIdx(nextInGroup);
                    setPlaybackPos(0);
                    setPlaybackDur(1);
                    playAyahDirectRef.current?.(item.ayahIndices[nextInGroup] + 1);
                } else {
                    // Last ayah in group finished
                    setIsPlaying(false);
                    playingGroupIdxRef.current = 0;
                    setPlayingGroupIdx(0);
                    setPlaybackPos(0);
                    setPlaybackDur(1);

                    const nextRepeat = currentRepeatRef.current + 1;
                    if (nextRepeat <= repeatCountRef.current) {
                        // Repeat the full group
                        currentRepeatRef.current = nextRepeat;
                        setCurrentRepeat(nextRepeat);
                        if (item) playAyahDirectRef.current?.(item.ayahIndices[0] + 1);
                    } else {
                        // All repeats done
                        if (recitationModeRef.current) {
                            startRecitationPhase();
                        } else {
                            setPracticePhase('rating');
                        }
                    }
                }
            }
        }
    }, [startRecitationPhase]);

    const _playAyahDirect = useCallback(async (ayahNum: number) => {
        try {
            // Unload current sound first
            if (soundRef.current) {
                await soundRef.current.unloadAsync();
                soundRef.current = null;
            }

            const preloaded = preloadMapRef.current[ayahNum];
            let sound: Audio.Sound;

            if (preloaded) {
                // Instant play — sound is already buffered
                delete preloadMapRef.current[ayahNum];
                preloaded.setOnPlaybackStatusUpdate(onPlaybackStatus);
                await preloaded.setStatusAsync({
                    positionMillis: 0,
                    shouldPlay: true,
                    progressUpdateIntervalMillis: 50,
                    rate: playbackSpeedRef.current,
                    shouldCorrectPitch: true,
                });
                sound = preloaded;
            } else {
                // Resolve URI (local cache first, then remote)
                const uri = await getAudioUri(ayahNum);
                if (!uri) {
                    console.error('Hifz: no audio URI for ayah', ayahNum);
                    return;
                }
                const result = await Audio.Sound.createAsync(
                    { uri },
                    { shouldPlay: true, progressUpdateIntervalMillis: 50, rate: playbackSpeedRef.current, shouldCorrectPitch: true },
                    onPlaybackStatus
                );
                sound = result.sound;
            }

            soundRef.current = sound;
            setIsPlaying(true);
        } catch (e) {
            console.error('Hifz audio error:', e);
        }
    }, [onPlaybackStatus, getAudioUri]);

    useEffect(() => { playAyahDirectRef.current = _playAyahDirect; }, [_playAyahDirect]);

    const playAyahAudio = useCallback(async (ayahNum: number) => {
        playingGroupIdxRef.current = 0;
        currentRepeatRef.current = 1;
        setPlayingGroupIdx(0);
        setCurrentRepeat(1);
        // Only show loading spinner if not preloaded (i.e. will need network fetch)
        const willBeInstant = !!preloadMapRef.current[ayahNum];
        if (!willBeInstant) setAudioLoading(true);
        await stopAudio();
        try {
            await _playAyahDirect(ayahNum);
        } catch (e) {
            console.error('Hifz audio error:', e);
        } finally {
            setAudioLoading(false);
        }
    }, [stopAudio, _playAyahDirect]);

    const handlePlayPause = useCallback(async () => {
        const item = currentItemRef.current;
        if (!soundRef.current) {
            if (!item) return;
            await playAyahAudio(item.ayahIndices[0] + 1);
            return;
        }
        const status = await soundRef.current.getStatusAsync();
        if (status.isLoaded) {
            if (status.isPlaying) {
                await soundRef.current.pauseAsync();
                setIsPlaying(false);
            } else {
                if (status.didJustFinish || status.positionMillis >= (status.durationMillis ?? 1) - 100) {
                    if (item) await playAyahAudio(item.ayahIndices[0] + 1);
                } else {
                    await soundRef.current.playAsync();
                    setIsPlaying(true);
                }
            }
        }
    }, [playAyahAudio]);

    const changeSpeed = useCallback(async (speed: 0.75 | 1 | 1.25) => {
        setPlaybackSpeed(speed);
        playbackSpeedRef.current = speed;
        if (soundRef.current) {
            try {
                await soundRef.current.setRateAsync(speed, true);
            } catch {}
        }
    }, []);

    // ── Session builders ────────────────────────────────────────────

    const startWithDue = () => {
        if (dueReviews.length === 0) return;
        launchSession(buildReviewQueue(dueReviews.map(a => a.ayahNumber - 1)));
    };

    const startPracticeAll = () => {
        const allEntries = Object.values(hifzData)
            .filter(a => a.surahNumber === surahNumber)
            .sort((a, b) => a.ayahNumber - b.ayahNumber);
        if (allEntries.length === 0) return;
        launchSession(buildReviewQueue(allEntries.map(a => a.ayahNumber - 1)));
    };

    const startNewAyahs = async (ayahNumbers: number[]) => {
        await Promise.all(ayahNumbers.map(n => initAyah(surahNumber, n)));
        const items = progressiveMode
            ? buildProgressiveQueue(ayahNumbers)
            : buildReviewQueue(ayahNumbers.map(n => n - 1));
        launchSession(items);
    };

    const launchSession = (items: QueueItem[]) => {
        setQueue(items);
        queueRef.current = items;
        setQueuePos(0);
        queuePosRef.current = 0;
        currentItemRef.current = items[0] ?? null;
        setRevealed(false);
        setPeekedWords(new Set());
        setSessionResults([]);
        setPlayingGroupIdx(0);
        playingGroupIdxRef.current = 0;
        setCurrentRepeat(1);
        currentRepeatRef.current = 1;
        setPracticePhase('listening');
        setUndoAvailable(false);
        undoRef.current = null;
        setSavedSession(null);
        clearSession(surahNumber).catch(() => {});
        setSessionState('practice');
        if (recitationTimerRef.current) clearInterval(recitationTimerRef.current);
        stopAudio();
    };

    // Resume a previously saved session
    const resumeSavedSession = (session: SavedSession) => {
        setQueue(session.queue);
        queueRef.current = session.queue;
        setQueuePos(session.queuePos);
        queuePosRef.current = session.queuePos;
        currentItemRef.current = session.queue[session.queuePos] ?? null;
        setSessionResults(session.sessionResults);
        setRevealed(false);
        setPeekedWords(new Set());
        setPlayingGroupIdx(0);
        playingGroupIdxRef.current = 0;
        setCurrentRepeat(1);
        currentRepeatRef.current = 1;
        setPracticePhase('listening');
        setUndoAvailable(false);
        undoRef.current = null;
        setSavedSession(null);
        clearSession(surahNumber).catch(() => {});
        setSessionState('practice');
        if (recitationTimerRef.current) clearInterval(recitationTimerRef.current);
        stopAudio();
    };

    // ── Practice logic ──────────────────────────────────────────────

    const currentItem = queue[queuePos];
    const currentRateAyahNumber = currentItem ? currentItem.rateIndex + 1 : 1;
    const hifzKey = `${surahNumber}:${currentRateAyahNumber}`;
    const currentHifz = hifzData[hifzKey];
    const level = currentHifz?.level ?? 0;
    const hideFraction = HIDE_FRACTION[level] ?? 0;

    const handlePeek = useCallback((wordIndex: number) => {
        if (peekTimersRef.current[wordIndex]) clearTimeout(peekTimersRef.current[wordIndex]);
        setPeekedWords(prev => new Set([...prev, wordIndex]));
        peekTimersRef.current[wordIndex] = setTimeout(() => {
            setPeekedWords(prev => { const n = new Set(prev); n.delete(wordIndex); return n; });
            delete peekTimersRef.current[wordIndex];
        }, 1500);
    }, []);

    // Force-advance after 3 Forgots — records 'forgot' and moves on
    const handleForceAdvance = async () => {
        if (!currentItem) return;
        setForgotCount(0);
        await handleAdvance('forgot');
    };

    const handleAdvance = async (rating: HifzRating) => {
        if (!currentItem) return;

        // Accumulation items practice in context but don't affect spaced repetition schedule
        if (!currentItem.isAccumulation) {
            const key = `${surahNumber}:${currentItem.rateIndex + 1}`;
            const prevRecord = hifzData[key] ?? null;
            // Store undo snapshot before mutating
            undoRef.current = {
                item: currentItem,
                prevHifzRecord: prevRecord,
                prevResults: [...sessionResults],
                prevQueue: [...queueRef.current],
                prevQueuePos: queuePosRef.current,
            };
            setUndoAvailable(true);
            await recordReview(surahNumber, currentItem.rateIndex + 1, rating);
            const updatedHifz = await getAllHifzData();
            setHifzData(updatedHifz);
        } else {
            // Accumulation — still allow undo of queue position (no storage change)
            undoRef.current = {
                item: currentItem,
                prevHifzRecord: null,
                prevResults: [...sessionResults],
                prevQueue: [...queueRef.current],
                prevQueuePos: queuePosRef.current,
            };
            setUndoAvailable(true);
        }

        const result: SessionResult = { ayahNumber: currentItem.rateIndex + 1, rating };
        const newResults = [...sessionResults, result];
        setSessionResults(newResults);

        Object.values(peekTimersRef.current).forEach(clearTimeout);
        peekTimersRef.current = {};
        setPeekedWords(new Set());
        if (recitationTimerRef.current) { clearInterval(recitationTimerRef.current); recitationTimerRef.current = null; }

        await stopAudio();

        let newQueue = [...queueRef.current];
        // Forgot (including forced advance) always re-queues for later in the session
        if (rating === 'forgot') {
            if (currentItem.isAccumulation) {
                newQueue.push({ ...currentItem });
            } else {
                newQueue.push({ ayahIndices: [currentItem.rateIndex], rateIndex: currentItem.rateIndex, isAccumulation: false });
            }
        }

        const nextPos = queuePosRef.current + 1;
        if (nextPos >= newQueue.length) {
            await recordPracticeDay();
            await addTodayProgress(newResults.length);
            const [updatedProgress, updatedStreak] = await Promise.all([getTodayProgress(), getStreakData()]);
            setTodayProgress(updatedProgress);
            setStreakData(updatedStreak);
            setQueue(newQueue);
            queueRef.current = newQueue;
            // Session complete — discard any saved mid-session state
            await clearSession(surahNumber).catch(() => {});
            setUndoAvailable(false);
            undoRef.current = null;
            setSessionState('summary');
            return;
        }

        setQueue(newQueue);
        queueRef.current = newQueue;
        setQueuePos(nextPos);
        queuePosRef.current = nextPos;
        currentItemRef.current = newQueue[nextPos];
        setForgotCount(0);
        // Don't clear undoRef here — user may still want to undo on the new item
        setRevealed(false);
        setPeekedWords(new Set());
        setPlayingGroupIdx(0);
        playingGroupIdxRef.current = 0;
        setCurrentRepeat(1);
        currentRepeatRef.current = 1;
        setPracticePhase('listening');
        setPlaybackPos(0);
        setPlaybackDur(1);
    };

    const handleUndo = async () => {
        const undo = undoRef.current;
        if (!undo) return;
        // Restore hifz record in storage
        if (!undo.item.isAccumulation) {
            if (undo.prevHifzRecord) {
                await setAyahHifz(undo.prevHifzRecord);
            } else {
                const all = await getAllHifzData();
                delete all[`${surahNumber}:${undo.item.rateIndex + 1}`];
                await AsyncStorage.setItem('hifz_progress_v1', JSON.stringify(all));
            }
            const updated = await getAllHifzData();
            setHifzData(updated);
        }
        // Restore queue position and results
        setQueue(undo.prevQueue);
        queueRef.current = undo.prevQueue;
        setQueuePos(undo.prevQueuePos);
        queuePosRef.current = undo.prevQueuePos;
        currentItemRef.current = undo.prevQueue[undo.prevQueuePos];
        setSessionResults(undo.prevResults);
        setForgotCount(0);
        setRevealed(false);
        setPeekedWords(new Set());
        setPlayingGroupIdx(0);
        playingGroupIdxRef.current = 0;
        setCurrentRepeat(1);
        currentRepeatRef.current = 1;
        setPracticePhase('listening');
        setUndoAvailable(false);
        undoRef.current = null;
        haptic.light();
        await stopAudio();
    };

    const handleRate = async (rating: HifzRating) => {
        if (!currentItem) return;

        if (rating === 'forgot') {
            haptic.error();
            // Stay on this ayah — force another listen before they can move on
            const newCount = forgotCount + 1;
            setForgotCount(newCount);
            Object.values(peekTimersRef.current).forEach(clearTimeout);
            peekTimersRef.current = {};
            setPeekedWords(new Set());
            if (recitationTimerRef.current) { clearInterval(recitationTimerRef.current); recitationTimerRef.current = null; }
            setRevealed(false);
            setPlayingGroupIdx(0);
            playingGroupIdxRef.current = 0;
            setCurrentRepeat(1);
            currentRepeatRef.current = 1;
            setPracticePhase('listening');
            setPlaybackPos(0);
            setPlaybackDur(1);
            // Auto-play so they hear it again immediately
            await stopAudio();
            setTimeout(() => playAyahAudio(currentItem.ayahIndices[0] + 1), 250);
            return;
        }

        // Haptics for non-forgot ratings
        if (rating === 'hard') haptic.warning();
        else if (rating === 'good') haptic.medium();
        else if (rating === 'easy') haptic.success();

        // Hard / Good / Easy — advance normally
        await handleAdvance(rating);
    };

    const handleSeek = useCallback(async (evt: GestureResponderEvent) => {
        if (!soundRef.current || scrubBarWidth <= 1) return;
        const x = evt.nativeEvent.locationX;
        const frac = Math.max(0, Math.min(1, x / scrubBarWidth));
        const seekMs = frac * playbackDur;
        try {
            await soundRef.current.setPositionAsync(seekMs);
            setPlaybackPos(seekMs);
        } catch {}
    }, [scrubBarWidth, playbackDur]);

    // ── Render: Setup ───────────────────────────────────────────────

    const renderSetup = () => {
        const allEntries = Object.values(hifzData).filter(a => a.surahNumber === surahNumber);
        const startedCount = allEntries.length;
        const masteredCount = allEntries.filter(a => a.level === 5).length;
        const ayahLevelMap: Record<number, { level: number }> = {};
        allEntries.forEach(a => { ayahLevelMap[a.ayahNumber] = { level: a.level }; });
        const goalDone = todayProgress >= dailyGoal;

        return (
            <ScrollView contentContainerStyle={styles.setupContainer} showsVerticalScrollIndicator={false}>
                {/* Streak + daily goal */}
                <Animated.View entering={FadeInDown.duration(500)} style={styles.streakRow}>
                    <View style={[styles.streakCard, { borderColor: streakData.currentStreak > 0 ? '#f9741655' : 'rgba(255,255,255,0.08)' }]}>
                        <Flame color={streakData.currentStreak > 0 ? '#f97316' : '#475569'} size={20} />
                        <Text style={[styles.streakNum, { color: streakData.currentStreak > 0 ? '#f97316' : '#475569' }]}>{streakData.currentStreak}</Text>
                        <Text style={styles.streakLabel}>day streak</Text>
                    </View>
                    <View style={[styles.goalCard, { borderColor: goalDone ? '#22c55e55' : 'rgba(255,255,255,0.08)' }]}>
                        <Target color={goalDone ? '#22c55e' : '#94a3b8'} size={20} />
                        <Text style={[styles.streakNum, { color: goalDone ? '#22c55e' : '#f8fafc' }]}>{todayProgress}/{dailyGoal}</Text>
                        <Text style={styles.streakLabel}>{goalDone ? 'goal done!' : 'today'}</Text>
                    </View>
                </Animated.View>

                {/* Progress */}
                <Animated.View entering={FadeInDown.duration(600)} style={styles.progressCard}>
                    <Brain color={colors.accent} size={28} />
                    <Text style={[styles.setupTitle, { color: colors.primaryText }]}>Hifz Mode</Text>
                    <Text style={styles.setupSubtitle}>{surahName} · {surahNameTranslation}</Text>
                    <View style={styles.statsRow}>
                        <View style={styles.statBlock}>
                            <Text style={[styles.statNum, { color: colors.accent }]}>{startedCount}</Text>
                            <Text style={styles.statLabel}>Learning</Text>
                        </View>
                        <View style={styles.statDivider} />
                        <View style={styles.statBlock}>
                            <Text style={[styles.statNum, { color: '#22c55e' }]}>{masteredCount}</Text>
                            <Text style={styles.statLabel}>Mastered</Text>
                        </View>
                        <View style={styles.statDivider} />
                        <View style={styles.statBlock}>
                            <Text style={[styles.statNum, { color: '#94a3b8' }]}>{totalAyahs}</Text>
                            <Text style={styles.statLabel}>Total</Text>
                        </View>
                    </View>
                </Animated.View>

                {/* Heatmap */}
                {startedCount > 0 && (
                    <Animated.View entering={FadeInDown.duration(600).delay(50)} style={styles.heatmapCard}>
                        <TouchableOpacity
                            style={styles.heatmapHeader}
                            onPress={() => setHeatmapExpanded(v => !v)}
                            activeOpacity={0.7}
                        >
                            <Text style={styles.heatmapTitle}>SURAH MAP</Text>
                            <View style={styles.heatmapHeaderRight}>
                                <Text style={styles.heatmapSummary}>{masteredCount}/{totalAyahs} mastered</Text>
                                <ChevronRight
                                    color="#475569"
                                    size={14}
                                    style={{ transform: [{ rotate: heatmapExpanded ? '90deg' : '0deg' }] }}
                                />
                            </View>
                        </TouchableOpacity>
                        {heatmapExpanded && (
                            <>
                                <View style={styles.heatmapLegend}>
                                    {[
                                        { color: 'rgba(34,211,238,0.2)', label: 'New' },
                                        { color: 'rgba(239,68,68,0.4)', label: 'Learning' },
                                        { color: 'rgba(245,158,11,0.45)', label: 'Strong' },
                                        { color: 'rgba(34,197,94,0.5)', label: 'Mastered' },
                                    ].map(l => (
                                        <View key={l.label} style={styles.legendItem}>
                                            <View style={[styles.legendDot, { backgroundColor: l.color }]} />
                                            <Text style={styles.legendLabel}>{l.label}</Text>
                                        </View>
                                    ))}
                                </View>
                                <View style={styles.heatmapGrid}>
                                    {Array.from({ length: totalAyahs }, (_, i) => {
                                        const num = i + 1;
                                        const entry = ayahLevelMap[num];
                                        return (
                                            <View key={num} style={[styles.heatCell, { backgroundColor: entry ? levelToColor(entry.level, true) : 'rgba(255,255,255,0.05)' }]}>
                                                <Text style={styles.heatCellNum}>{num}</Text>
                                            </View>
                                        );
                                    })}
                                </View>
                            </>
                        )}
                    </Animated.View>
                )}

                {/* Resume saved session */}
                {savedSession && (
                    <Animated.View entering={FadeInDown.duration(600).delay(80)}>
                        <TouchableOpacity
                            style={[styles.actionCard, { borderColor: '#f97316aa' }]}
                            onPress={() => resumeSavedSession(savedSession)}
                        >
                            <View style={[styles.actionIcon, { backgroundColor: '#f9731622' }]}>
                                <SkipBack color="#f97316" size={22} />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={[styles.actionTitle, { color: colors.primaryText }]}>Resume Session</Text>
                                <Text style={styles.actionSub}>
                                    {savedSession.queuePos}/{savedSession.queue.length} items · saved{' '}
                                    {new Date(savedSession.savedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </Text>
                            </View>
                            <ChevronRight color="#f97316" size={20} />
                        </TouchableOpacity>
                    </Animated.View>
                )}

                {/* Due reviews */}
                {dueReviews.length > 0 && (
                    <Animated.View entering={FadeInDown.duration(700).delay(100)}>
                        <TouchableOpacity style={[styles.actionCard, { borderColor: colors.accent + '55' }]} onPress={startWithDue}>
                            <View style={[styles.actionIcon, { backgroundColor: colors.accent + '22' }]}>
                                <RotateCcw color={colors.accent} size={22} />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={[styles.actionTitle, { color: colors.primaryText }]}>Review Due</Text>
                                <Text style={styles.actionSub}>{dueReviews.length} ayah{dueReviews.length !== 1 ? 's' : ''} ready for review</Text>
                            </View>
                            <ChevronRight color="#475569" size={20} />
                        </TouchableOpacity>
                    </Animated.View>
                )}

                {/* Practice all — always available once any ayah is started */}
                {startedCount > 0 && (
                    <Animated.View entering={FadeInDown.duration(700).delay(125)}>
                        <TouchableOpacity style={styles.actionCard} onPress={startPracticeAll}>
                            <View style={styles.actionIcon}>
                                <Play color="#94a3b8" size={22} />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={[styles.actionTitle, { color: colors.primaryText }]}>Practice All</Text>
                                <Text style={styles.actionSub}>Run through all {startedCount} ayah{startedCount !== 1 ? 's' : ''} regardless of schedule</Text>
                            </View>
                            <ChevronRight color="#475569" size={20} />
                        </TouchableOpacity>
                    </Animated.View>
                )}

                {/* Hardest ayahs */}
                {hardestAyahs.length > 0 && (
                    <Animated.View entering={FadeInDown.duration(700).delay(150)} style={styles.hardestCard}>
                        <Text style={styles.heatmapTitle}>HARDEST AYAHS</Text>
                        {hardestAyahs.map((a, idx) => (
                            <View key={a.ayahNumber} style={styles.hardestRow}>
                                <View style={styles.hardestNum}>
                                    <Text style={styles.hardestNumText}>{a.ayahNumber}</Text>
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.hardestLabel}>Ayah {a.ayahNumber}</Text>
                                    <Text style={styles.hardestSub}>{a.forgotCount} forgot · L{a.level} · {a.reviewCount} reviews</Text>
                                </View>
                                <View style={[styles.hardestRankBadge, { backgroundColor: idx === 0 ? '#ef444430' : 'rgba(255,255,255,0.06)' }]}>
                                    <Text style={[styles.hardestRankText, { color: idx === 0 ? '#ef4444' : '#64748b' }]}>
                                        {'😔'.repeat(Math.min(a.forgotCount, 3))}
                                    </Text>
                                </View>
                            </View>
                        ))}
                        <TouchableOpacity
                            style={[styles.hardestPracticeBtn, { borderColor: '#ef444444' }]}
                            onPress={() => {
                                const items = buildReviewQueue(hardestAyahs.map(a => a.ayahNumber - 1));
                                launchSession(items);
                            }}
                        >
                            <Text style={styles.hardestPracticeBtnText}>Practice Hardest Ayahs</Text>
                        </TouchableOpacity>
                    </Animated.View>
                )}

                {/* Add new */}
                <Animated.View entering={FadeInDown.duration(700).delay(200)}>
                    <TouchableOpacity style={styles.actionCard} onPress={() => setAddAyahsModalVisible(true)}>
                        <View style={styles.actionIcon}>
                            <Plus color="#94a3b8" size={22} />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={[styles.actionTitle, { color: colors.primaryText }]}>Add New Ayahs</Text>
                            <Text style={styles.actionSub}>Select verses to begin memorising</Text>
                        </View>
                        <ChevronRight color="#475569" size={20} />
                    </TouchableOpacity>
                </Animated.View>
            </ScrollView>
        );
    };

    // ── Render: Practice ────────────────────────────────────────────

    const renderPractice = () => {
        if (!currentItem || !surah) return null;
        const playingAyahNum = currentItem.ayahIndices[playingGroupIdx] + 1;
        const isReciting = practicePhase === 'reciting';
        const isRatingPhase = practicePhase === 'rating';

        return (
            <View style={{ flex: 1 }}>
                <ScrollView contentContainerStyle={styles.practiceContainer} showsVerticalScrollIndicator={false}>

                    {/* Progress bar */}
                    <View style={styles.sessionProgress}>
                        <Text style={styles.sessionProgressText}>
                            {queuePos + 1} / {queue.length}
                            {currentItem.isAccumulation ? '  ·  Accumulation' : ''}
                            {repeatCount > 1 ? `  ·  ${currentRepeat}/${repeatCount}` : ''}
                        </Text>
                        <View style={styles.progressBarTrack}>
                            <View style={[styles.progressBarFill, { width: `${((queuePos + 1) / queue.length) * 100}%`, backgroundColor: colors.accent }]} />
                        </View>
                    </View>

                    {/* Speed + repeat controls */}
                    <View style={styles.settingsRow}>
                        <View style={styles.settingsGroup}>
                            <Text style={styles.settingsLabel}>SPEED</Text>
                            <View style={styles.settingsBtns}>
                                {([0.75, 1, 1.25] as const).map(s => (
                                    <TouchableOpacity
                                        key={s}
                                        style={[styles.settingsBtn, playbackSpeed === s && { backgroundColor: colors.accent + '33', borderColor: colors.accent + '66' }]}
                                        onPress={() => changeSpeed(s)}
                                    >
                                        <Text style={[styles.settingsBtnText, playbackSpeed === s && { color: colors.accent }]}>{s}x</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </View>
                        <View style={styles.settingsGroup}>
                            <Text style={styles.settingsLabel}>REPEATS</Text>
                            <View style={styles.settingsBtns}>
                                {[1, 2, 3].map(r => (
                                    <TouchableOpacity
                                        key={r}
                                        style={[styles.settingsBtn, repeatCount === r && { backgroundColor: colors.accent + '33', borderColor: colors.accent + '66' }]}
                                        onPress={() => { setRepeatCount(r); repeatCountRef.current = r; }}
                                    >
                                        <Text style={[styles.settingsBtnText, repeatCount === r && { color: colors.accent }]}>{r}×</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </View>
                        <View style={styles.settingsGroup}>
                            <Text style={styles.settingsLabel}>RECITE</Text>
                            <Switch
                                value={recitationMode}
                                onValueChange={v => {
                                    setRecitationMode(v);
                                    recitationModeRef.current = v;
                                    // If toggled off while recitation phase is active, skip to rating
                                    if (!v && practicePhase === 'reciting') {
                                        skipRecitation();
                                    }
                                }}
                                trackColor={{ false: '#334155', true: colors.accent + '88' }}
                                thumbColor={recitationMode ? colors.accent : '#94a3b8'}
                                style={{ transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }] }}
                            />
                        </View>
                    </View>

                    {/* Recitation timer settings — only visible when recitation mode is on */}
                    {recitationMode && (
                        <View style={styles.timerRow}>
                            <Text style={styles.settingsLabel}>TIMER</Text>
                            {(['auto', 15, 30, 45, 60] as const).map(t => (
                                <TouchableOpacity
                                    key={t.toString()}
                                    style={[styles.timerBtn, recitationTimeSetting === t && { backgroundColor: '#f9731622', borderColor: '#f9741666' }]}
                                    onPress={() => { setRecitationTimeSetting(t); recitationTimeSettingRef.current = t; }}
                                >
                                    <Text style={[styles.timerBtnText, recitationTimeSetting === t && { color: '#f97316' }]}>
                                        {t === 'auto' ? 'Auto' : `${t}s`}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    )}

                    {/* Transliteration + Translation toggles */}
                    <View style={styles.displayRow}>
                        <TouchableOpacity
                            style={[styles.displayToggle, showTranslit && { backgroundColor: '#7c3aed22', borderColor: '#7c3aed66' }]}
                            onPress={() => setShowTranslit(v => !v)}
                        >
                            <Text style={[styles.displayToggleText, showTranslit && { color: '#a78bfa' }]}>A Translit</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.displayToggle, showTranslation && { backgroundColor: '#0369a122', borderColor: '#0369a166' }]}
                            onPress={() => setShowTranslation(v => !v)}
                        >
                            <Text style={[styles.displayToggleText, showTranslation && { color: '#38bdf8' }]}>EN Translation</Text>
                        </TouchableOpacity>
                    </View>

                    {/* Level badge */}
                    <View style={styles.levelBadgeRow}>
                        <View style={[styles.levelBadge, { backgroundColor: level === 5 ? colors.accent + '33' : 'rgba(255,255,255,0.06)' }]}>
                            <Text style={[styles.levelBadgeText, { color: level === 5 ? colors.accent : '#94a3b8' }]}>
                                {level === 5 ? 'MASTERED' : `LEVEL ${level}`}
                            </Text>
                        </View>
                        <Text style={styles.ayahLabel}>
                            {currentItem.isAccumulation
                                ? `Ayahs ${currentItem.ayahIndices.map(i => i + 1).join(' + ')}`
                                : `Ayah ${currentItem.rateIndex + 1}`}
                        </Text>
                    </View>

                    {/* Recitation phase overlay */}
                    {isReciting && (
                        <Animated.View entering={FadeInDown.duration(400)} style={[styles.recitationBanner, { borderColor: '#22d3ee44' }]}>
                            <Mic color="#22d3ee" size={24} />
                            <View style={{ flex: 1 }}>
                                <Text style={styles.recitationTitle}>Now Recite</Text>
                                <Text style={styles.recitationSub}>Recite from memory — {recitationSecsLeft}s remaining</Text>
                            </View>
                            <TouchableOpacity style={[styles.recitationDoneBtn, { backgroundColor: colors.accent }]} onPress={skipRecitation}>
                                <Text style={styles.recitationDoneText}>Done</Text>
                            </TouchableOpacity>
                        </Animated.View>
                    )}

                    {/* Ayah cards */}
                    {currentItem.ayahIndices.map((ayahIdx) => {
                        const ayahNum = ayahIdx + 1;
                        const ayah = surah.ayahs[ayahIdx];
                        if (!ayah) return null;

                        const isRateAyah = ayahIdx === currentItem.rateIndex;
                        const thisHideFraction = isRateAyah ? hideFraction : 0;
                        const hideAll = isReciting && isRateAyah;
                        const isPlayingThis = isPlaying && playingAyahNum === ayahNum;

                        const words = ayah.text.split(' ');
                        const hideFrom = hideAll ? 0 : (words.length - Math.round(words.length * thisHideFraction));

                        const segments = ayahAudioData.find(a => a.ayahNumber === ayahNum)?.segments ?? [];
                        const activeWord = isPlayingThis ? getWordAtTime(segments, playbackPos) : -1;
                        const wordList = ayahWords.find(a => a.ayahNumber === ayahNum)?.words ?? [];
                        const activeMeaning = activeWord >= 0 && activeWord < wordList.length
                            ? wordList[activeWord]?.meaning ?? '' : '';
                        const translation = translationMapRef.current[ayahNum] ?? '';

                        return (
                            <View key={ayahIdx}>
                                {currentItem.ayahIndices.length > 1 && (
                                    <Text style={[styles.groupAyahLabel, isRateAyah && { color: colors.accent }]}>
                                        Ayah {ayahNum}{isRateAyah ? ' · practice' : ' · context'}
                                    </Text>
                                )}
                                <View style={[
                                    styles.arabicCard,
                                    !isRateAyah && styles.arabicCardContext,
                                    isPlayingThis && { borderColor: colors.accent + '44' },
                                    hideAll && styles.arabicCardReciting,
                                ]}>
                                    <Text style={styles.arabicText}>
                                        {words.map((word, wi) => {
                                            const isHidden = !revealed && wi >= hideFrom;
                                            const isPeeked = isHidden && peekedWords.has(wi);
                                            const isActive = !isHidden && wi === activeWord;
                                            return (
                                                <Text
                                                    key={wi}
                                                    suppressHighlighting
                                                    onPress={isHidden && !isPeeked && isRateAyah && !hideAll ? () => handlePeek(wi) : undefined}
                                                    style={[
                                                        styles.arabicWord,
                                                        isHidden && !isPeeked && styles.arabicWordHidden,
                                                        isPeeked && styles.arabicWordPeeked,
                                                        isActive && styles.arabicWordActive,
                                                    ]}
                                                >
                                                    {(isHidden && !isPeeked) ? '\u2581\u2581\u2581' : word}
                                                    {wi < words.length - 1 ? ' ' : ''}
                                                </Text>
                                            );
                                        })}
                                    </Text>

                                    {/* Transliteration row — mirrors Arabic word hiding */}
                                    {showTranslit && wordList.length > 0 && (
                                        <View style={styles.translitRow}>
                                            {wordList.map((w, wi) => {
                                                const isHidden = !revealed && wi >= hideFrom;
                                                const isPeeked = isHidden && peekedWords.has(wi);
                                                const isActive = !isHidden && wi === activeWord;
                                                return (
                                                    <Text
                                                        key={wi}
                                                        suppressHighlighting
                                                        onPress={isHidden && !isPeeked && isRateAyah && !hideAll ? () => handlePeek(wi) : undefined}
                                                        style={[
                                                            styles.translitWord,
                                                            isHidden && !isPeeked && styles.translitWordHidden,
                                                            isPeeked && { color: '#64748b' },
                                                            isActive && { color: '#22d3ee', fontWeight: '700' },
                                                        ]}
                                                    >
                                                        {(isHidden && !isPeeked) ? '·' : (w.transliteration || w.arabic)}
                                                        {wi < wordList.length - 1 ? ' ' : ''}
                                                    </Text>
                                                );
                                            })}
                                        </View>
                                    )}
                                </View>

                                {/* Word meaning pill */}
                                {activeMeaning ? (
                                    <View style={styles.meaningPillWrap}>
                                        <View style={[styles.meaningPill, { borderColor: colors.accent + '55', backgroundColor: colors.accent + '18' }]}>
                                            <Text style={[styles.meaningPillText, { color: colors.accent }]}>{activeMeaning}</Text>
                                        </View>
                                    </View>
                                ) : <View style={{ height: showTranslation && translation ? 0 : 20 }} />}

                                {/* Full translation */}
                                {showTranslation && translation ? (
                                    <View style={styles.translationBox}>
                                        <Text style={styles.translationText}>{translation}</Text>
                                    </View>
                                ) : null}
                            </View>
                        );
                    })}

                    {hideFraction > 0 && !revealed && !isReciting && (
                        <Text style={styles.peekHint}>Tap any ▁▁▁ word to peek for 1.5s</Text>
                    )}

                    {/* Audio controls */}
                    {!isRatingPhase && (
                        <View>
                            {/* Scrubber — shown when audio has played */}
                            {playbackDur > 1 && (
                                <TouchableOpacity
                                    activeOpacity={1}
                                    onPress={handleSeek}
                                    onLayout={(e) => setScrubBarWidth(e.nativeEvent.layout.width)}
                                    style={styles.scrubBar}
                                >
                                    <View style={styles.scrubTrack}>
                                        <View style={[styles.scrubFill, { width: `${Math.min(100, (playbackPos / playbackDur) * 100)}%`, backgroundColor: colors.accent }]} />
                                    </View>
                                    <View style={[styles.scrubThumb, { left: Math.max(0, (playbackPos / playbackDur) * Math.max(0, scrubBarWidth - 12)), backgroundColor: colors.accent }]} />
                                </TouchableOpacity>
                            )}
                            <View style={styles.controlsRow}>
                                <TouchableOpacity style={styles.audioBtn} onPress={handlePlayPause} disabled={isReciting}>
                                    {audioLoading ? (
                                        <ActivityIndicator size="small" color={colors.accent} />
                                    ) : isPlaying ? (
                                        <Pause color={colors.accent} size={22} fill={colors.accent} />
                                    ) : (
                                        <Play color={isReciting ? '#334155' : colors.accent} size={22} />
                                    )}
                                    <Text style={[styles.audioBtnLabel, { color: isReciting ? '#334155' : colors.accent }]}>
                                        {isPlaying
                                            ? (currentItem.ayahIndices.length > 1 ? `${playingGroupIdx + 1}/${currentItem.ayahIndices.length}` : 'Pause')
                                            : 'Listen'}
                                    </Text>
                                </TouchableOpacity>

                                {hideFraction > 0 && !revealed && !isReciting && (
                                    <TouchableOpacity style={styles.revealBtn} onPress={() => setRevealed(true)}>
                                        <Eye color="#94a3b8" size={20} />
                                        <Text style={styles.revealBtnLabel}>Reveal All</Text>
                                    </TouchableOpacity>
                                )}

                                {/* Undo last rating */}
                                {undoAvailable && (
                                    <TouchableOpacity style={styles.undoBtn} onPress={handleUndo}>
                                        <Undo2 color="#64748b" size={18} />
                                        <Text style={styles.undoBtnLabel}>Undo</Text>
                                    </TouchableOpacity>
                                )}
                            </View>
                        </View>
                    )}

                    {/* Forgot banner — shown in listening phase when they've pressed Forgot at least once */}
                    {forgotCount > 0 && practicePhase === 'listening' && (
                        <Animated.View entering={FadeInDown.duration(350)} style={styles.forgotBanner}>
                            <Text style={styles.forgotBannerEmoji}>😔</Text>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.forgotBannerTitle}>Listen again carefully</Text>
                                <Text style={styles.forgotBannerSub}>
                                    {forgotCount >= 3
                                        ? 'Keep listening — you can move on when ready'
                                        : `Attempt ${forgotCount + 1} · follow each word as it plays`}
                                </Text>
                            </View>
                        </Animated.View>
                    )}

                    {/* Rating — only shown in rating phase */}
                    {isRatingPhase && (
                        <Animated.View entering={FadeInUp.duration(300)} style={styles.ratingSection}>
                            <Text style={styles.ratingLabel}>
                                {forgotCount > 0
                                    ? 'Did you get it this time?'
                                    : currentItem.isAccumulation ? 'How did the full group feel?' : 'How did you do?'}
                            </Text>
                            <View style={styles.ratingRow}>
                                {(['forgot', 'hard', 'good', 'easy'] as HifzRating[]).map(r => (
                                    <TouchableOpacity
                                        key={r}
                                        style={[styles.ratingBtn, { borderColor: ratingColor(r) + '55', backgroundColor: ratingColor(r) + '18' }]}
                                        onPress={() => handleRate(r)}
                                    >
                                        <Text style={styles.ratingEmoji}>{ratingEmoji(r)}</Text>
                                        <Text style={[styles.ratingBtnText, { color: ratingColor(r) }]}>
                                            {r.charAt(0).toUpperCase() + r.slice(1)}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                            {/* After 3 forgots let them bail out */}
                            {forgotCount >= 3 && (
                                <TouchableOpacity style={styles.forceAdvanceBtn} onPress={handleForceAdvance}>
                                    <Text style={styles.forceAdvanceText}>Move on for now →</Text>
                                </TouchableOpacity>
                            )}
                            {sessionResults.filter(r => r.rating === 'forgot').length > 0 && forgotCount === 0 && (
                                <Text style={styles.requeueNote}>
                                    {sessionResults.filter(r => r.rating === 'forgot').length} ayah{sessionResults.filter(r => r.rating === 'forgot').length !== 1 ? 's' : ''} re-queued
                                </Text>
                            )}
                        </Animated.View>
                    )}

                    {/* Before rating phase: show "skip to rate" if not in reciting mode */}
                    {!isRatingPhase && !isReciting && (
                        <TouchableOpacity style={styles.skipToRateBtn} onPress={() => setPracticePhase('rating')}>
                            <Text style={styles.skipToRateText}>Skip to rating →</Text>
                        </TouchableOpacity>
                    )}
                </ScrollView>
            </View>
        );
    };

    // ── Render: Summary ─────────────────────────────────────────────

    const renderSummary = () => {
        const counts = {
            forgot: sessionResults.filter(r => r.rating === 'forgot').length,
            hard: sessionResults.filter(r => r.rating === 'hard').length,
            good: sessionResults.filter(r => r.rating === 'good').length,
            easy: sessionResults.filter(r => r.rating === 'easy').length,
        };
        const score = sessionResults.length > 0
            ? Math.round(((counts.good + counts.easy * 2) / (sessionResults.length * 2)) * 100) : 0;
        const goalDone = todayProgress >= dailyGoal;

        return (
            <ScrollView contentContainerStyle={styles.summaryContainer} showsVerticalScrollIndicator={false}>
                <Animated.View entering={FadeInUp.duration(600)} style={styles.summaryCard}>
                    <Award color={score >= 70 ? colors.accent : '#94a3b8'} size={48} />
                    <Text style={[styles.summaryScore, { color: score >= 70 ? colors.accent : '#f8fafc' }]}>{score}%</Text>
                    <Text style={styles.summaryTitle}>Session Complete</Text>
                    <Text style={styles.summarySubtitle}>{sessionResults.length} review{sessionResults.length !== 1 ? 's' : ''}</Text>
                </Animated.View>

                <Animated.View entering={FadeInUp.duration(600).delay(80)} style={styles.streakRow}>
                    <View style={[styles.streakCard, { borderColor: '#f9741655' }]}>
                        <Flame color="#f97316" size={20} />
                        <Text style={[styles.streakNum, { color: '#f97316' }]}>{streakData.currentStreak}</Text>
                        <Text style={styles.streakLabel}>day streak</Text>
                    </View>
                    <View style={[styles.goalCard, { borderColor: goalDone ? '#22c55e55' : 'rgba(255,255,255,0.08)' }]}>
                        <Target color={goalDone ? '#22c55e' : '#94a3b8'} size={20} />
                        <Text style={[styles.streakNum, { color: goalDone ? '#22c55e' : '#f8fafc' }]}>{todayProgress}/{dailyGoal}</Text>
                        <Text style={styles.streakLabel}>{goalDone ? 'goal done!' : 'today'}</Text>
                    </View>
                </Animated.View>

                <Animated.View entering={FadeInUp.duration(600).delay(150)} style={styles.summaryStats}>
                    {(['forgot', 'hard', 'good', 'easy'] as HifzRating[]).map(r => (
                        <View key={r} style={styles.summaryStatRow}>
                            <Text style={styles.summaryEmoji}>{ratingEmoji(r)}</Text>
                            <Text style={[styles.summaryStatLabel, { color: ratingColor(r) }]}>{r.charAt(0).toUpperCase() + r.slice(1)}</Text>
                            <Text style={styles.summaryStatCount}>{counts[r as HifzRating]}</Text>
                        </View>
                    ))}
                </Animated.View>

                <Animated.View entering={FadeInUp.duration(600).delay(300)} style={{ gap: 12 }}>
                    <TouchableOpacity style={[styles.summaryBtn, { backgroundColor: colors.accent }]} onPress={() => { loadData(); setSessionState('setup'); }}>
                        <Text style={styles.summaryBtnText}>Continue</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.summaryBtnOutline} onPress={onClose}>
                        <Text style={styles.summaryBtnOutlineText}>Close</Text>
                    </TouchableOpacity>
                </Animated.View>
            </ScrollView>
        );
    };

    // ── Guide Modal ─────────────────────────────────────────────────

    const renderGuide = () => (
        <Modal visible={guideVisible} animationType="slide" transparent>
            <View style={styles.modalOverlay}>
                <View style={[styles.modalContent, { paddingBottom: 0 }]}>
                    <View style={styles.modalHeader}>
                        <Brain color={colors.accent} size={20} />
                        <Text style={[styles.modalTitle, { flex: 1, marginLeft: 10 }]}>How Hifz Mode Works</Text>
                        <TouchableOpacity onPress={async () => {
                            await AsyncStorage.setItem('hifz_guide_seen_v1', '1');
                            setGuideVisible(false);
                        }}>
                            <Text style={[styles.modalClose, { color: colors.accent }]}>Got it</Text>
                        </TouchableOpacity>
                    </View>
                    <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40, gap: 20 }} showsVerticalScrollIndicator={false}>

                        {/* Overview */}
                        <View style={styles.guideSection}>
                            <Text style={styles.guideSectionTitle}>🧠  What is Hifz Mode?</Text>
                            <Text style={styles.guideBody}>
                                Hifz Mode helps you memorise the Quran using{' '}
                                <Text style={styles.guideHighlight}>spaced repetition</Text> — a proven method that
                                shows you each ayah at the exact right time so it sticks in long-term memory.
                                The more you know an ayah, the less often you need to review it.
                            </Text>
                        </View>

                        {/* Step 1 */}
                        <View style={styles.guideSection}>
                            <Text style={styles.guideSectionTitle}>1️⃣  Add Ayahs to Learn</Text>
                            <Text style={styles.guideBody}>
                                Tap <Text style={styles.guideHighlight}>Add New Ayahs</Text> and select the verses
                                you want to memorise.{'\n\n'}
                                <Text style={styles.guideHighlight}>Progressive Mode</Text> (recommended) introduces
                                them gradually: learn Ayah 1, then Ayah 2, then recite both together, then add Ayah 3, and so on.
                                This builds a chain so each new ayah connects to what came before.
                            </Text>
                        </View>

                        {/* Step 2 */}
                        <View style={styles.guideSection}>
                            <Text style={styles.guideSectionTitle}>2️⃣  Practice — 3 Phases</Text>

                            <View style={styles.guidePhaseRow}>
                                <View style={[styles.guidePhaseDot, { backgroundColor: '#22d3ee33', borderColor: '#22d3ee66' }]}>
                                    <Text style={[styles.guidePhaseNum, { color: '#22d3ee' }]}>1</Text>
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.guidePhaseTitle}>Listen</Text>
                                    <Text style={styles.guidePhaseBody}>
                                        Press <Text style={styles.guideHighlight}>Listen</Text> to hear the ayah.
                                        Words light up as they're recited so you can follow along.
                                        Each word's English meaning appears below it.{'\n'}
                                        Use <Text style={styles.guideHighlight}>Speed</Text> (0.75× / 1× / 1.25×) and
                                        <Text style={styles.guideHighlight}> Repeats</Text> (1–3×) to control playback.
                                    </Text>
                                </View>
                            </View>

                            <View style={styles.guidePhaseRow}>
                                <View style={[styles.guidePhaseDot, { backgroundColor: '#f9741633', borderColor: '#f9741666' }]}>
                                    <Text style={[styles.guidePhaseNum, { color: '#f97416' }]}>2</Text>
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.guidePhaseTitle}>Recite (optional)</Text>
                                    <Text style={styles.guidePhaseBody}>
                                        If the <Text style={styles.guideHighlight}>Recite toggle</Text> is on, after
                                        listening the text goes blank and a 30-second timer starts.
                                        Say the ayah aloud from memory, then tap <Text style={styles.guideHighlight}>Done</Text>.
                                    </Text>
                                </View>
                            </View>

                            <View style={styles.guidePhaseRow}>
                                <View style={[styles.guidePhaseDot, { backgroundColor: '#22c55e33', borderColor: '#22c55e66' }]}>
                                    <Text style={[styles.guidePhaseNum, { color: '#22c55e' }]}>3</Text>
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.guidePhaseTitle}>Rate Yourself</Text>
                                    <Text style={styles.guidePhaseBody}>
                                        Be honest — tap how well you recalled it:
                                    </Text>
                                    <View style={{ gap: 6, marginTop: 8 }}>
                                        {[
                                            { emoji: '😔', label: 'Forgot', desc: 'Blank. Level drops, review again today.', color: '#ef4444' },
                                            { emoji: '😤', label: 'Hard', desc: 'Struggled but got it. Review tomorrow.', color: '#f97316' },
                                            { emoji: '😊', label: 'Good', desc: 'Recalled well. Level up, longer gap.', color: '#22d3ee' },
                                            { emoji: '🌟', label: 'Easy', desc: 'Perfect recall. Level +2, much longer gap.', color: '#22c55e' },
                                        ].map(r => (
                                            <View key={r.label} style={styles.guideRatingRow}>
                                                <Text style={{ fontSize: 18 }}>{r.emoji}</Text>
                                                <Text style={[styles.guideRatingLabel, { color: r.color }]}>{r.label}</Text>
                                                <Text style={styles.guideRatingDesc}>{r.desc}</Text>
                                            </View>
                                        ))}
                                    </View>
                                </View>
                            </View>
                        </View>

                        {/* Transliteration + Translation */}
                        <View style={styles.guideSection}>
                            <Text style={styles.guideSectionTitle}>🔤  Can't Read Arabic?</Text>
                            <Text style={styles.guideBody}>
                                No problem — two toggles in the practice screen make Hifz Mode fully accessible:
                            </Text>
                            <View style={{ gap: 10, marginTop: 4 }}>
                                <View style={styles.guidePhaseRow}>
                                    <View style={[styles.guidePhaseDot, { backgroundColor: '#7c3aed22', borderColor: '#7c3aed66' }]}>
                                        <Text style={[styles.guidePhaseNum, { color: '#a78bfa' }]}>A</Text>
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <Text style={[styles.guidePhaseTitle, { color: '#a78bfa' }]}>Translit</Text>
                                        <Text style={styles.guidePhaseBody}>
                                            Shows the <Text style={styles.guideHighlight}>romanized pronunciation</Text> below
                                            each Arabic word (e.g. <Text style={[styles.guideHighlight, { fontStyle: 'italic' }]}>bismillāhi r-raḥmāni r-raḥīm</Text>).
                                            Hidden words are hidden here too — so the memory challenge works the same way.
                                        </Text>
                                    </View>
                                </View>
                                <View style={styles.guidePhaseRow}>
                                    <View style={[styles.guidePhaseDot, { backgroundColor: '#0369a122', borderColor: '#0369a166' }]}>
                                        <Text style={[styles.guidePhaseNum, { color: '#38bdf8' }]}>EN</Text>
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <Text style={[styles.guidePhaseTitle, { color: '#38bdf8' }]}>Translation</Text>
                                        <Text style={styles.guidePhaseBody}>
                                            Shows the <Text style={styles.guideHighlight}>full English meaning</Text> of the ayah
                                            below the Arabic card, so you always understand what you're memorising.
                                        </Text>
                                    </View>
                                </View>
                            </View>
                        </View>

                        {/* Hidden words */}
                        <View style={styles.guideSection}>
                            <Text style={styles.guideSectionTitle}>👁  Hidden Words</Text>
                            <Text style={styles.guideBody}>
                                As your level rises, more words get hidden (shown as{' '}
                                <Text style={[styles.guideHighlight, { letterSpacing: 2 }]}>▁▁▁</Text>).
                                At Level 5 the whole ayah is hidden — pure memory recall.{'\n\n'}
                                Tap any hidden word to <Text style={styles.guideHighlight}>peek</Text> at it for 1.5 seconds.
                                Tap <Text style={styles.guideHighlight}>Reveal All</Text> to show everything if you're stuck.
                            </Text>
                            <View style={styles.guideLevelGrid}>
                                {[
                                    { level: 0, label: 'All visible', color: 'rgba(34,211,238,0.25)' },
                                    { level: 1, label: '20% hidden', color: 'rgba(239,68,68,0.35)' },
                                    { level: 2, label: '40% hidden', color: 'rgba(239,68,68,0.5)' },
                                    { level: 3, label: '60% hidden', color: 'rgba(245,158,11,0.45)' },
                                    { level: 4, label: '80% hidden', color: 'rgba(245,158,11,0.6)' },
                                    { level: 5, label: 'All hidden', color: 'rgba(34,197,94,0.5)' },
                                ].map(l => (
                                    <View key={l.level} style={[styles.guideLevelCell, { backgroundColor: l.color }]}>
                                        <Text style={styles.guideLevelNum}>L{l.level}</Text>
                                        <Text style={styles.guideLevelLabel}>{l.label}</Text>
                                    </View>
                                ))}
                            </View>
                        </View>

                        {/* Streak + goal */}
                        <View style={styles.guideSection}>
                            <Text style={styles.guideSectionTitle}>🔥  Streak & Daily Goal</Text>
                            <Text style={styles.guideBody}>
                                Complete at least one session every day to keep your streak alive.
                                The default daily goal is <Text style={styles.guideHighlight}>5 reviews</Text>.
                                Check the heatmap on the setup screen to see your progress across every ayah in the surah.
                            </Text>
                        </View>

                        {/* Tip */}
                        <View style={[styles.guideSection, { backgroundColor: colors.accent + '12', borderColor: colors.accent + '33', borderWidth: 1 }]}>
                            <Text style={[styles.guideSectionTitle, { color: colors.accent }]}>💡  Tips for Beginners</Text>
                            <Text style={styles.guideBody}>
                                • Start with just <Text style={styles.guideHighlight}>3–5 ayahs</Text> in Progressive Mode.{'\n'}
                                • Listen 2–3 times with the Recite toggle on.{'\n'}
                                • If you can't read Arabic, turn on <Text style={styles.guideHighlight}>Translit</Text> and follow the pronunciation.{'\n'}
                                • Turn on <Text style={styles.guideHighlight}>Translation</Text> to understand what you're saying.{'\n'}
                                • Be honest with ratings — marking <Text style={styles.guideHighlight}>Forgot</Text> when you forget is what makes the system work. It'll keep bringing it back until it sticks.
                            </Text>
                        </View>

                    </ScrollView>
                </View>
            </View>
        </Modal>
    );

    // ── Add Ayahs Modal ─────────────────────────────────────────────

    const renderAddAyahsModal = () => {
        const alreadyAdded = new Set(
            Object.values(hifzData).filter(a => a.surahNumber === surahNumber).map(a => a.ayahNumber)
        );
        return (
            <Modal visible={addAyahsModalVisible} animationType="slide" transparent>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Select Ayahs</Text>
                            <TouchableOpacity onPress={() => { setAddAyahsModalVisible(false); setSelectedAyahs([]); }}>
                                <Text style={[styles.modalClose, { color: colors.accent }]}>Cancel</Text>
                            </TouchableOpacity>
                        </View>
                        <View style={styles.progressiveToggle}>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.progressiveToggleTitle}>Progressive Mode</Text>
                                <Text style={styles.progressiveToggleSub}>1 → 2 → 1+2 → 3 → 1+2+3...</Text>
                            </View>
                            <Switch
                                value={progressiveMode}
                                onValueChange={setProgressiveMode}
                                trackColor={{ false: '#334155', true: colors.accent + '88' }}
                                thumbColor={progressiveMode ? colors.accent : '#94a3b8'}
                            />
                        </View>
                        <FlatList
                            data={surah?.ayahs ?? []}
                            keyExtractor={item => item.numberInSurah.toString()}
                            contentContainerStyle={{ paddingBottom: 40 }}
                            renderItem={({ item }) => {
                                const isAdded = alreadyAdded.has(item.numberInSurah);
                                const isSelected = selectedAyahs.includes(item.numberInSurah);
                                return (
                                    <TouchableOpacity
                                        style={[
                                            styles.ayahPickerRow,
                                            isAdded && styles.ayahPickerRowAdded,
                                            isSelected && { backgroundColor: colors.accent + '22' },
                                        ]}
                                        onPress={isAdded ? undefined : () => setSelectedAyahs(prev =>
                                            isSelected ? prev.filter(n => n !== item.numberInSurah) : [...prev, item.numberInSurah]
                                        )}
                                        activeOpacity={isAdded ? 1 : 0.7}
                                    >
                                        <View style={[styles.ayahPickerNum, isAdded && styles.ayahPickerNumAdded, isSelected && { backgroundColor: colors.accent + '33', borderColor: colors.accent }]}>
                                            <Text style={[styles.ayahPickerNumText, isAdded && { color: '#334155' }, isSelected && { color: colors.accent }]}>{item.numberInSurah}</Text>
                                        </View>
                                        <Text style={[styles.ayahPickerText, isAdded && { opacity: 0.3 }]} numberOfLines={2}>{item.text}</Text>
                                        {isAdded && <Text style={styles.ayahPickerAddedLabel}>In progress</Text>}
                                    </TouchableOpacity>
                                );
                            }}
                        />
                        {selectedAyahs.length > 0 && (
                            <TouchableOpacity
                                style={[styles.startBtn, { backgroundColor: colors.accent }]}
                                onPress={() => { setAddAyahsModalVisible(false); setSelectedAyahs([]); startNewAyahs([...selectedAyahs].sort((a, b) => a - b)); }}
                            >
                                <Text style={styles.startBtnText}>
                                    Start {selectedAyahs.length} Ayah{selectedAyahs.length !== 1 ? 's' : ''}{progressiveMode ? ' (Progressive)' : ''}
                                </Text>
                            </TouchableOpacity>
                        )}
                    </View>
                </View>
            </Modal>
        );
    };

    // ── Main ────────────────────────────────────────────────────────

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#f8fafc" />
                <Text style={styles.loadingText}>Preparing Hifz...</Text>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <SafeAreaView style={styles.headerSafeArea}>
                <View style={styles.header}>
                    <TouchableOpacity
                        onPress={sessionState === 'practice' ? () => {
                            Alert.alert('Exit Session?', 'Save progress and resume later?', [
                                { text: 'Cancel', style: 'cancel' },
                                {
                                    text: 'Exit & Save',
                                    onPress: async () => {
                                        await saveSession(surahNumber, { queue, queuePos, sessionResults });
                                        stopAudio();
                                        setSessionState('setup');
                                        setSavedSession({ surahNumber, queue, queuePos, sessionResults, savedAt: new Date().toISOString() });
                                    }
                                },
                                { text: 'Discard', style: 'destructive', onPress: () => { clearSession(surahNumber).catch(() => {}); stopAudio(); setSessionState('setup'); } },
                            ]);
                        } : onClose}
                        style={styles.backBtn}
                    >
                        <ArrowLeft color="#fff" size={24} />
                    </TouchableOpacity>
                    <View style={styles.headerCenter}>
                        <Text style={styles.headerTitle}>
                            {sessionState === 'setup' ? 'Hifz Mode' : sessionState === 'practice' ? surahName : 'Summary'}
                        </Text>
                        {sessionState === 'setup' && <Text style={styles.headerSub}>{surahName}</Text>}
                    </View>
                    <TouchableOpacity onPress={() => setGuideVisible(true)} style={{ padding: 4 }}>
                        <HelpCircle color={colors.accent} size={22} />
                    </TouchableOpacity>
                </View>
            </SafeAreaView>

            {sessionState === 'setup' && renderSetup()}
            {sessionState === 'practice' && renderPractice()}
            {sessionState === 'summary' && renderSummary()}
            {renderAddAyahsModal()}
            {renderGuide()}
        </View>
    );
}

function ratingColor(r: HifzRating): string {
    if (r === 'forgot') return '#ef4444';
    if (r === 'hard') return '#f97316';
    if (r === 'good') return '#22d3ee';
    return '#22c55e';
}
function ratingEmoji(r: HifzRating): string {
    if (r === 'forgot') return '😔';
    if (r === 'hard') return '😤';
    if (r === 'good') return '😊';
    return '🌟';
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#00080f' },
    loadingContainer: { flex: 1, backgroundColor: '#00080f', alignItems: 'center', justifyContent: 'center', gap: 16 },
    loadingText: { color: '#94a3b8', fontSize: 16 },
    headerSafeArea: { backgroundColor: 'rgba(15,23,42,0.9)', borderBottomWidth: 1, borderColor: 'rgba(30,41,59,0.5)' },
    header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 16 },
    backBtn: { padding: 4 },
    headerCenter: { flex: 1, alignItems: 'center' },
    headerTitle: { color: '#f8fafc', fontSize: 18, fontWeight: 'bold' },
    headerSub: { color: '#94a3b8', fontSize: 12, fontWeight: '600', marginTop: 2 },

    setupContainer: { padding: 20, gap: 16, paddingBottom: 60 },
    streakRow: { flexDirection: 'row', gap: 12 },
    streakCard: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 16, borderWidth: 1, padding: 14 },
    goalCard: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 16, borderWidth: 1, padding: 14 },
    streakNum: { fontSize: 20, fontWeight: '900' },
    streakLabel: { color: '#94a3b8', fontSize: 11, fontWeight: '600', flex: 1 },

    progressCard: { backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 24, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', padding: 24, alignItems: 'center', gap: 6 },
    setupTitle: { fontSize: 22, fontWeight: '900', marginTop: 4 },
    setupSubtitle: { color: '#94a3b8', fontSize: 13, fontWeight: '600' },
    statsRow: { flexDirection: 'row', marginTop: 12, gap: 0 },
    statBlock: { flex: 1, alignItems: 'center', gap: 4 },
    statDivider: { width: 1, backgroundColor: 'rgba(255,255,255,0.08)', marginVertical: 4 },
    statNum: { fontSize: 26, fontWeight: '900' },
    statLabel: { color: '#94a3b8', fontSize: 12, fontWeight: '600' },

    heatmapCard: { backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)', padding: 16, gap: 10 },
    heatmapHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    heatmapHeaderRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    heatmapSummary: { color: '#475569', fontSize: 11, fontWeight: '700' },
    heatmapTitle: { color: '#475569', fontSize: 11, fontWeight: '900', letterSpacing: 1.2 },
    heatmapLegend: { flexDirection: 'row', gap: 12, flexWrap: 'wrap' },
    legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
    legendDot: { width: 10, height: 10, borderRadius: 3 },
    legendLabel: { color: '#64748b', fontSize: 11, fontWeight: '600' },
    heatmapGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
    heatCell: { width: 36, height: 30, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
    heatCellNum: { color: '#94a3b8', fontSize: 10, fontWeight: '700' },

    actionCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', padding: 20, gap: 16 },
    actionIcon: { width: 48, height: 48, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.06)', alignItems: 'center', justifyContent: 'center' },
    actionTitle: { fontSize: 17, fontWeight: '800' },
    actionSub: { color: '#94a3b8', fontSize: 13, fontWeight: '600', marginTop: 2 },

    practiceContainer: { padding: 20, paddingBottom: 60 },
    sessionProgress: { marginBottom: 16, gap: 8 },
    sessionProgressText: { color: '#94a3b8', fontSize: 12, fontWeight: '700', textAlign: 'center' },
    progressBarTrack: { height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.08)' },
    progressBarFill: { height: 4, borderRadius: 2 },

    settingsRow: { flexDirection: 'row', gap: 8, marginBottom: 16, alignItems: 'center' },
    settingsGroup: { flex: 1, gap: 4 },
    settingsLabel: { color: '#475569', fontSize: 9, fontWeight: '900', letterSpacing: 1, textAlign: 'center' },
    settingsBtns: { flexDirection: 'row', gap: 4 },
    settingsBtn: { flex: 1, paddingVertical: 6, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', alignItems: 'center' },
    settingsBtnText: { color: '#64748b', fontSize: 11, fontWeight: '800' },

    levelBadgeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
    levelBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.06)' },
    levelBadgeText: { fontSize: 11, fontWeight: '900', letterSpacing: 1 },
    ayahLabel: { color: '#94a3b8', fontSize: 13, fontWeight: '700' },

    recitationBanner: {
        flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16,
        backgroundColor: 'rgba(34,211,238,0.08)', borderRadius: 16, borderWidth: 1, padding: 16,
    },
    recitationTitle: { color: '#22d3ee', fontSize: 15, fontWeight: '900' },
    recitationSub: { color: '#67e8f9', fontSize: 12, marginTop: 2 },
    recitationDoneBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10 },
    recitationDoneText: { color: '#0f172a', fontSize: 13, fontWeight: '900' },

    groupAyahLabel: { color: '#475569', fontSize: 12, fontWeight: '700', marginBottom: 6, marginTop: 4 },
    arabicCard: { backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', padding: 20, marginBottom: 4 },
    arabicCardContext: { backgroundColor: 'rgba(255,255,255,0.02)', borderColor: 'rgba(255,255,255,0.05)' },
    arabicCardReciting: { borderColor: 'rgba(34,211,238,0.25)', backgroundColor: 'rgba(34,211,238,0.03)' },
    arabicText: { textAlign: 'right', lineHeight: 52 },
    arabicWord: { color: '#f8fafc', fontSize: 26, lineHeight: 52 },
    arabicWordHidden: { color: '#1e293b', backgroundColor: '#1e293b', borderRadius: 3 },
    arabicWordPeeked: { color: '#64748b' },
    arabicWordActive: { color: '#22d3ee', fontWeight: '700' },

    peekHint: { color: '#334155', fontSize: 12, textAlign: 'center', marginBottom: 8, fontStyle: 'italic' },
    meaningPillWrap: { alignItems: 'center', marginBottom: 8 },
    meaningPill: { paddingHorizontal: 14, paddingVertical: 5, borderRadius: 20, borderWidth: 1 },
    meaningPillText: { fontSize: 13, fontWeight: '700' },

    displayRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
    displayToggle: { flex: 1, paddingVertical: 7, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', alignItems: 'center' },
    displayToggleText: { color: '#475569', fontSize: 12, fontWeight: '800' },

    translitRow: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)' },
    translitWord: { color: '#7c3aed', fontSize: 13, fontStyle: 'italic', lineHeight: 22 },
    translitWordHidden: { color: '#1e293b' },

    translationBox: { backgroundColor: 'rgba(3,105,161,0.1)', borderRadius: 12, borderWidth: 1, borderColor: 'rgba(56,189,248,0.2)', padding: 12, marginBottom: 8 },
    translationText: { color: '#7dd3fc', fontSize: 14, lineHeight: 22, fontStyle: 'italic' },

    controlsRow: { flexDirection: 'row', gap: 12, marginBottom: 20, justifyContent: 'center' },
    audioBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 14, backgroundColor: 'rgba(34,211,238,0.1)', borderWidth: 1, borderColor: 'rgba(34,211,238,0.3)' },
    audioBtnLabel: { fontSize: 15, fontWeight: '700' },
    revealBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
    revealBtnLabel: { color: '#94a3b8', fontSize: 15, fontWeight: '700' },

    ratingSection: { gap: 10 },
    ratingLabel: { color: '#cbd5e1', fontSize: 13, fontWeight: '700', textAlign: 'center', letterSpacing: 0.5 },
    ratingRow: { flexDirection: 'row', gap: 8 },
    ratingBtn: { flex: 1, alignItems: 'center', paddingVertical: 12, borderRadius: 16, borderWidth: 1, gap: 4 },
    ratingEmoji: { fontSize: 20 },
    ratingBtnText: { fontSize: 11, fontWeight: '800' },
    requeueNote: { color: '#475569', fontSize: 12, textAlign: 'center', fontStyle: 'italic' },
    skipToRateBtn: { alignSelf: 'center', marginTop: 12, paddingVertical: 8, paddingHorizontal: 16 },
    skipToRateText: { color: '#334155', fontSize: 13 },

    forgotBanner: {
        flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12,
        backgroundColor: 'rgba(239,68,68,0.08)', borderRadius: 14, borderWidth: 1,
        borderColor: 'rgba(239,68,68,0.25)', padding: 14,
    },
    forgotBannerEmoji: { fontSize: 22 },
    forgotBannerTitle: { color: '#fca5a5', fontSize: 14, fontWeight: '800' },
    forgotBannerSub: { color: '#ef444499', fontSize: 12, marginTop: 2 },
    forceAdvanceBtn: { alignSelf: 'center', marginTop: 4, paddingVertical: 8, paddingHorizontal: 16 },
    forceAdvanceText: { color: '#475569', fontSize: 13, fontStyle: 'italic' },

    summaryContainer: { padding: 24, gap: 16, paddingBottom: 60 },
    summaryCard: { backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 28, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', padding: 28, alignItems: 'center', gap: 8 },
    summaryScore: { fontSize: 52, fontWeight: '900' },
    summaryTitle: { color: '#f8fafc', fontSize: 22, fontWeight: '900' },
    summarySubtitle: { color: '#94a3b8', fontSize: 14, fontWeight: '600' },
    summaryStats: { backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)', padding: 20, gap: 12 },
    summaryStatRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    summaryEmoji: { fontSize: 18, width: 28, textAlign: 'center' },
    summaryStatLabel: { flex: 1, fontSize: 15, fontWeight: '700' },
    summaryStatCount: { color: '#f8fafc', fontSize: 18, fontWeight: '900' },
    summaryBtn: { borderRadius: 16, paddingVertical: 16, alignItems: 'center' },
    summaryBtnText: { color: '#0f172a', fontSize: 16, fontWeight: '900' },
    summaryBtnOutline: { borderRadius: 16, paddingVertical: 16, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' },
    summaryBtnOutlineText: { color: '#94a3b8', fontSize: 16, fontWeight: '700' },

    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
    modalContent: { backgroundColor: '#0f172a', borderTopLeftRadius: 28, borderTopRightRadius: 28, maxHeight: '90%', paddingTop: 8 },
    modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
    modalTitle: { color: '#f8fafc', fontSize: 18, fontWeight: '800' },
    modalClose: { fontSize: 16, fontWeight: '700' },
    progressiveToggle: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderColor: 'rgba(255,255,255,0.08)', gap: 12 },
    progressiveToggleTitle: { color: '#f8fafc', fontSize: 15, fontWeight: '700' },
    progressiveToggleSub: { color: '#64748b', fontSize: 12, marginTop: 2 },
    ayahPickerRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)', gap: 14 },
    ayahPickerRowAdded: { opacity: 0.5 },
    ayahPickerNum: { width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' },
    ayahPickerNumAdded: { backgroundColor: 'rgba(255,255,255,0.02)', borderColor: 'rgba(255,255,255,0.05)' },
    ayahPickerNumText: { color: '#cbd5e1', fontWeight: '800', fontSize: 13 },
    ayahPickerAddedLabel: { color: '#334155', fontSize: 11, fontWeight: '700' },
    ayahPickerText: { flex: 1, color: '#f8fafc', fontSize: 18, textAlign: 'right', lineHeight: 34 },
    startBtn: { margin: 16, borderRadius: 16, paddingVertical: 16, alignItems: 'center' },
    startBtnText: { color: '#0f172a', fontSize: 16, fontWeight: '900' },

    // Hardest ayahs
    hardestCard: { backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 20, borderWidth: 1, borderColor: 'rgba(239,68,68,0.15)', padding: 16, gap: 10 },
    hardestRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.04)' },
    hardestNum: { width: 34, height: 34, borderRadius: 10, backgroundColor: 'rgba(239,68,68,0.15)', borderWidth: 1, borderColor: 'rgba(239,68,68,0.3)', alignItems: 'center', justifyContent: 'center' },
    hardestNumText: { color: '#fca5a5', fontSize: 13, fontWeight: '800' },
    hardestLabel: { color: '#f8fafc', fontSize: 14, fontWeight: '700' },
    hardestSub: { color: '#64748b', fontSize: 11, fontWeight: '600', marginTop: 1 },
    hardestRankBadge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
    hardestRankText: { fontSize: 13 },
    hardestPracticeBtn: { marginTop: 4, borderRadius: 12, borderWidth: 1, paddingVertical: 10, alignItems: 'center', backgroundColor: 'rgba(239,68,68,0.08)' },
    hardestPracticeBtnText: { color: '#fca5a5', fontSize: 13, fontWeight: '800' },

    // Timer row
    timerRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12, paddingHorizontal: 2 },
    timerBtn: { flex: 1, paddingVertical: 5, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', alignItems: 'center' },
    timerBtnText: { color: '#64748b', fontSize: 10, fontWeight: '800' },

    // Audio scrubber
    scrubBar: { height: 28, justifyContent: 'center', marginBottom: 6, marginHorizontal: 2 },
    scrubTrack: { height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.1)', overflow: 'hidden' },
    scrubFill: { height: 4, borderRadius: 2 },
    scrubThumb: { position: 'absolute', width: 12, height: 12, borderRadius: 6, top: 8 },

    // Undo button
    undoBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 12, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
    undoBtnLabel: { color: '#64748b', fontSize: 13, fontWeight: '700' },

    // Guide
    guideSection: { backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 18, padding: 16, gap: 10 },
    guideSectionTitle: { color: '#f8fafc', fontSize: 15, fontWeight: '900', marginBottom: 2 },
    guideBody: { color: '#94a3b8', fontSize: 14, lineHeight: 22 },
    guideHighlight: { color: '#f8fafc', fontWeight: '700' },
    guidePhaseRow: { flexDirection: 'row', gap: 12, marginTop: 10 },
    guidePhaseDot: { width: 32, height: 32, borderRadius: 10, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
    guidePhaseNum: { fontSize: 14, fontWeight: '900' },
    guidePhaseTitle: { color: '#f8fafc', fontSize: 14, fontWeight: '800', marginBottom: 4 },
    guidePhaseBody: { color: '#94a3b8', fontSize: 13, lineHeight: 20 },
    guideRatingRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    guideRatingLabel: { fontSize: 13, fontWeight: '800', width: 52 },
    guideRatingDesc: { color: '#64748b', fontSize: 12, flex: 1 },
    guideLevelGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
    guideLevelCell: { borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8, alignItems: 'center', gap: 2, minWidth: 90 },
    guideLevelNum: { color: '#f8fafc', fontSize: 13, fontWeight: '900' },
    guideLevelLabel: { color: '#cbd5e1', fontSize: 11, fontWeight: '600' },
});
