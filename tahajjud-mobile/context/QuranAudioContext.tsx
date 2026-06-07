import React, {
    createContext, useContext, useEffect, useRef,
    useState, useCallback, ReactNode,
} from 'react';
import TrackPlayer, {
    Capability,
    Event,
    State,
    useActiveTrack,
    usePlaybackState,
    AppKilledPlaybackBehavior,
} from 'react-native-track-player';
import * as FileSystem from 'expo-file-system/legacy';
import { QuranService } from '../services/QuranService';
import OfflineQuranService from '../services/OfflineQuranService';

// Per-ayah audio cache. Pre-downloading every ayah of a surah BEFORE we add
// them to the TrackPlayer queue is what gives us truly gapless playback —
// streaming each ayah at the moment its turn comes adds a few hundred ms
// of network latency per track which the user hears as pauses between
// verses. Local files have zero load time so AVQueuePlayer can chain them
// seamlessly.
const AYAH_CACHE_DIR = FileSystem.cacheDirectory + 'ayah-audio-cache/';
async function ensureAyahCacheDir(): Promise<void> {
    try {
        const info = await FileSystem.getInfoAsync(AYAH_CACHE_DIR);
        if (!info.exists) await FileSystem.makeDirectoryAsync(AYAH_CACHE_DIR, { intermediates: true });
    } catch { /* ignore */ }
}
function cachePathFor(reciterId: string, surahNumber: number, ayahNumber: number): string {
    const safe = `${reciterId}_${surahNumber}_${ayahNumber}`.replace(/[^a-zA-Z0-9_]/g, '_');
    return `${AYAH_CACHE_DIR}${safe}.mp3`;
}
async function getCachedAyahUri(reciterId: string, surahNumber: number, ayahNumber: number): Promise<string | null> {
    try {
        const p = cachePathFor(reciterId, surahNumber, ayahNumber);
        const info = await FileSystem.getInfoAsync(p);
        if (info.exists && info.size && info.size > 1024) return p;
    } catch { /* ignore */ }
    return null;
}
async function downloadAyahToCache(remoteUrl: string, reciterId: string, surahNumber: number, ayahNumber: number): Promise<string> {
    await ensureAyahCacheDir();
    const local = cachePathFor(reciterId, surahNumber, ayahNumber);
    const existing = await FileSystem.getInfoAsync(local);
    if (existing.exists && existing.size && existing.size > 1024) return local;
    try {
        const res = await FileSystem.downloadAsync(remoteUrl, local);
        if (res.status >= 200 && res.status < 300) return local;
    } catch { /* fall back to remote */ }
    // Clean up partial file if any
    try { await FileSystem.deleteAsync(local, { idempotent: true }); } catch { /* ignore */ }
    return remoteUrl;
}
import {
    getCurrentReciter, getCurrentReciterId, reciterAudioUrl, subscribeReciter,
} from '../utils/reciters';

export interface AyahTrack {
    url: string;             // streaming or local file uri
    title: string;           // e.g. "Al-Fatiha · 3"
    ayahNumber: number;      // numberInSurah
}

interface QuranAudioContextValue {
    isPlaying: boolean;
    isLoading: boolean;
    currentSurahNumber: number | null;
    currentSurahName: string | null;
    /** Active ayah number when an ayah-queue is playing; null otherwise. */
    currentAyahNumber: number | null;
    playlistName: string | null;
    queueIndex: number;
    queueTotal: number;
    /** Start a full-surah queue (1 surah = 1 track). */
    startPlaylist: (queue: number[], name?: string) => Promise<void>;
    /**
     * Start an ayah-by-ayah queue (1 ayah = 1 track). Lockscreen "skip next"
     * advances ayah-by-ayah. Use this for in-reader playback so the user
     * gets Now Playing controls without leaving the surah.
     */
    startAyahQueue: (
        ayahs: AyahTrack[],
        surahNumber: number,
        surahName: string,
        reciterName?: string,
    ) => Promise<void>;
    /** Skip to a specific track index in the active queue. */
    skipToIndex: (index: number) => Promise<void>;
    togglePlayPause: () => Promise<void>;
    skipNext: () => Promise<void>;
    skipPrev: () => Promise<void>;
    stop: () => Promise<void>;
    seekTo: (seconds: number) => Promise<void>;
    setRate: (rate: number) => Promise<void>;
    setSleepTimer: (mins: 0 | 15 | 30 | 60) => void;
    sleepTimerMins: 0 | 15 | 30 | 60;
    sleepSecondsLeft: number;
}

const QuranAudioContext = createContext<QuranAudioContextValue | null>(null);

export function QuranAudioProvider({ children }: { children: ReactNode }) {
    // ── RNTP hooks (drive the UI state automatically) ──
    const playbackState = usePlaybackState();
    const activeTrack = useActiveTrack();

    const isPlaying = playbackState.state === State.Playing;
    const isLoading =
        playbackState.state === State.Buffering ||
        playbackState.state === State.Loading;

    // surahNumber stored as a custom field on each track
    const currentSurahNumber: number | null =
        activeTrack ? ((activeTrack as any).surahNumber as number) ?? null : null;
    const currentAyahNumber: number | null =
        activeTrack ? ((activeTrack as any).ayahNumber as number) ?? null : null;
    const currentSurahName: string | null = activeTrack?.title ?? null;

    const [playlistName, setPlaylistName] = useState<string | null>(null);
    const [queueTotal, setQueueTotal] = useState(0);
    const [queueIndex, setQueueIndex] = useState(0);

    // Keep queueIndex in sync whenever the active track changes
    useEffect(() => {
        if (!activeTrack) return;
        TrackPlayer.getActiveTrackIndex().then(idx => {
            if (idx !== null && idx !== undefined) setQueueIndex(idx);
        }).catch(() => {});
    }, [activeTrack]);

    // Clear state when playlist finishes
    useEffect(() => {
        const sub = TrackPlayer.addEventListener(Event.PlaybackQueueEnded, async () => {
            try { await TrackPlayer.reset(); } catch { /* ignore */ }
            setPlaylistName(null);
            setQueueTotal(0);
            setQueueIndex(0);
        });
        return () => sub.remove();
    }, []);

    // ── One-time player setup ──
    // Exposed as a promise so callers can await readiness before issuing
    // play/add/skip commands. Without this, tapping "Play" before setup is
    // done silently no-ops, forcing the user to tap multiple times.
    const setupPromiseRef = useRef<Promise<void> | null>(null);
    if (!setupPromiseRef.current) {
        setupPromiseRef.current = (async () => {
            try {
                await TrackPlayer.setupPlayer();
                await TrackPlayer.updateOptions({
                    capabilities: [
                        Capability.Play,
                        Capability.Pause,
                        Capability.SkipToNext,
                        Capability.SkipToPrevious,
                        Capability.Stop,
                        Capability.SeekTo,   // enables the lock-screen scrubber
                    ],
                    compactCapabilities: [
                        Capability.Play,
                        Capability.Pause,
                        Capability.SkipToNext,
                        Capability.SkipToPrevious,
                    ],
                    android: {
                        appKilledPlaybackBehavior:
                            AppKilledPlaybackBehavior.StopPlaybackAndRemoveNotification,
                    },
                });
            } catch {
                // setupPlayer throws if already initialised — safe to ignore.
            }
        })();
    }
    const ensurePlayerReady = useCallback(() => setupPromiseRef.current ?? Promise.resolve(), []);

    // ── Public API ──

    // Track which queue + reciter is currently playing so we can rebuild on reciter change
    const activeQueueRef = useRef<{ queue: number[]; name: string | null; reciterId: string } | null>(null);

    const buildAndPlay = useCallback(async (queue: number[], name: string | null, reciterId: string) => {
        await ensurePlayerReady();
        // Fetch surah names for Now Playing metadata
        const surahList = await QuranService.getSurahList();
        const metaMap: Record<number, string> = {};
        surahList.forEach(s => { metaMap[s.number] = s.englishName; });

        const reciter = getCurrentReciter();
        const tracks = queue.map(surahNumber => {
            // Prefer downloaded file for this reciter; fall back to streaming
            const localUri = OfflineQuranService.getLocalUri(surahNumber, reciterId);
            return {
                url: localUri ?? reciterAudioUrl(reciterId, surahNumber),
                title: metaMap[surahNumber] ?? `Surah ${surahNumber}`,
                artist: reciter.name,
                album: 'The Holy Quran',
                artwork: require('../assets/icon.png'),
                surahNumber,
            };
        });

        await TrackPlayer.reset();
        await TrackPlayer.add(tracks);
        await TrackPlayer.play();
    }, []);

    const startPlaylist = useCallback(async (queue: number[], name?: string) => {
        try {
            const reciterId = getCurrentReciterId();
            activeQueueRef.current = { queue, name: name ?? null, reciterId };
            await buildAndPlay(queue, name ?? null, reciterId);

            setPlaylistName(name ?? null);
            setQueueTotal(queue.length);
            setQueueIndex(0);
        } catch (e) {
            console.error('[QuranAudio] startPlaylist error:', e);
        }
    }, [buildAndPlay]);

    // Active ayah-queue (separate from surah-queue). Tracked so we can stop
    // the reciter-change handler from trying to rebuild surah-queues when
    // really an ayah-queue is in flight.
    const activeAyahQueueRef = useRef<{ surahNumber: number; ayahs: AyahTrack[] } | null>(null);

    const startAyahQueue = useCallback(async (
        ayahs: AyahTrack[],
        surahNumber: number,
        surahName: string,
        reciterName?: string,
    ) => {
        try {
            await ensurePlayerReady();
            activeQueueRef.current = null;
            activeAyahQueueRef.current = { surahNumber, ayahs };
            const reciter = getCurrentReciter();
            const reciterId = getCurrentReciterId();

            // Check only the first few ayahs instead of all N.
            // Checking all N (up to 286 for Al-Baqarah) via Promise.all
            // resolves hundreds of Promises simultaneously, flooding the JS
            // event loop and blocking scroll for several seconds.
            // 3 stats is enough to determine offline-fallback eligibility.
            const QUICK_CHECK = Math.min(ayahs.length, 3);
            const quickHits = await Promise.all(
                ayahs.slice(0, QUICK_CHECK).map(a => getCachedAyahUri(reciterId, surahNumber, a.ayahNumber)),
            );
            const anyCached = quickHits.some(Boolean);

            // ── Offline fallback ───────────────────────────────────────────
            // Nothing cached + whole-surah MP3 downloaded → play that instead.
            // Loses per-ayah karaoke highlight, but works on airplane mode.
            if (!anyCached) {
                const surahLocalUri = OfflineQuranService.getLocalUri(surahNumber, reciterId);
                if (surahLocalUri) {
                    await TrackPlayer.reset();
                    await TrackPlayer.add({
                        url: surahLocalUri,
                        title: surahName,
                        artist: reciterName ?? reciter.name,
                        album: 'The Holy Quran',
                        artwork: require('../assets/icon.png'),
                        surahNumber,
                    });
                    await TrackPlayer.play();
                    setPlaylistName(surahName);
                    setQueueTotal(1);
                    setQueueIndex(0);
                    return;
                }
            }

            // Build tracks with streaming URLs immediately — no waiting for
            // all cache checks. The first few ayahs use local files if already
            // cached; the rest stream. Background downloads below swap upcoming
            // tracks to local files for gapless playback.
            const tracks = ayahs.map((a, i) => ({
                url: quickHits[i] ?? a.url,
                title: `${surahName} · ${a.ayahNumber}`,
                artist: reciterName ?? reciter.name,
                album: surahName,
                artwork: require('../assets/icon.png'),
                surahNumber,
                ayahNumber: a.ayahNumber,
            }));
            await TrackPlayer.reset();
            await TrackPlayer.add(tracks);
            await TrackPlayer.play();
            setPlaylistName(surahName);
            setQueueTotal(ayahs.length);
            setQueueIndex(0);

            // Download ayahs in background with capped concurrency — populate
            // cache and silently swap upcoming tracks to local files as each
            // finishes. We cap at 4 parallel downloads to avoid saturating the
            // JS bridge (Al-Baqarah has 286 ayahs; firing all at once hangs the UI).
            const CACHE_CONCURRENCY = 4;
            const processAyah = async (a: AyahTrack, i: number) => {
                const localUri = await downloadAyahToCache(a.url, reciterId, surahNumber, a.ayahNumber)
                    .catch(() => null);
                if (!localUri || !localUri.startsWith(AYAH_CACHE_DIR)) return;
                try {
                    const activeIdx = await TrackPlayer.getActiveTrackIndex();
                    if (typeof activeIdx !== 'number' || i <= activeIdx) return;
                    await TrackPlayer.remove([i]);
                    await TrackPlayer.add({
                        url: localUri,
                        title: tracks[i].title,
                        artist: tracks[i].artist,
                        album: tracks[i].album,
                        artwork: tracks[i].artwork,
                        surahNumber,
                        ayahNumber: tracks[i].ayahNumber,
                    }, i);
                } catch { /* race condition — fine */ }
            };
            (async () => {
                for (let b = 0; b < ayahs.length; b += CACHE_CONCURRENCY) {
                    await Promise.all(
                        ayahs.slice(b, b + CACHE_CONCURRENCY).map((a, j) => processAyah(a, b + j))
                    );
                }
            })().catch(() => {});
        } catch (e) {
            console.error('[QuranAudio] startAyahQueue error:', e);
        }
    }, []);

    // When the user picks a new reciter, swap the voice WITHOUT restarting
    // the current track. We capture the active track index + position, rebuild
    // the queue with the new reciter, then skip back to the same track and
    // seek to the same seconds. The user hears the new voice continue from
    // exactly where the old one left off (minor pacing differences aside).
    useEffect(() => {
        const unsub = subscribeReciter(async newReciterId => {
            try {
                // Snapshot what's currently playing BEFORE we touch the queue.
                const [idx, prog, state] = await Promise.all([
                    TrackPlayer.getActiveTrackIndex(),
                    TrackPlayer.getProgress(),
                    TrackPlayer.getPlaybackState(),
                ]);
                const startIdx = typeof idx === 'number' ? idx : 0;
                const savedPos = prog?.position ?? 0;
                const wasPlaying = state.state === State.Playing;

                // ── Surah-level queue active (whole-surah tracks) ──
                const active = activeQueueRef.current;
                if (active) {
                    const remaining = active.queue.slice(startIdx);
                    activeQueueRef.current = { ...active, queue: remaining, reciterId: newReciterId };
                    await buildAndPlay(remaining, active.name, newReciterId);
                    setQueueTotal(remaining.length);
                    setQueueIndex(0);
                    if (savedPos > 1) {
                        // Seek back to where the old voice was. TrackPlayer
                        // clamps to track duration so overshoot is harmless.
                        await TrackPlayer.seekTo(savedPos).catch(() => {});
                    }
                    if (!wasPlaying) await TrackPlayer.pause().catch(() => {});
                    return;
                }

                // ── Per-ayah queue active (one track per ayah) ──
                const ayahQ = activeAyahQueueRef.current;
                if (ayahQ) {
                    // Refetch ayah URLs for this surah with the new reciter
                    const fresh = await QuranService.getAudioRecitation(ayahQ.surahNumber, newReciterId);
                    const reciter = getCurrentReciter();
                    const surahName = ayahQ.ayahs[0]?.title.split(' · ')[0] ?? `Surah ${ayahQ.surahNumber}`;
                    const newAyahs: AyahTrack[] = fresh.map((a: any) => ({
                        url: a.text,
                        title: `${surahName} · ${a.numberInSurah}`,
                        ayahNumber: a.numberInSurah,
                    }));
                    activeAyahQueueRef.current = { surahNumber: ayahQ.surahNumber, ayahs: newAyahs };
                    const tracks = newAyahs.map((a) => ({
                        url: a.url,
                        title: a.title,
                        artist: reciter.name,
                        album: surahName,
                        artwork: require('../assets/icon.png'),
                        surahNumber: ayahQ.surahNumber,
                        ayahNumber: a.ayahNumber,
                    }));
                    await TrackPlayer.reset();
                    await TrackPlayer.add(tracks);
                    if (startIdx > 0 && startIdx < tracks.length) {
                        await TrackPlayer.skip(startIdx).catch(() => {});
                    }
                    if (wasPlaying) {
                        await TrackPlayer.play().catch(() => {});
                    }
                    if (savedPos > 0.5) {
                        await TrackPlayer.seekTo(savedPos).catch(() => {});
                    }
                    setQueueTotal(newAyahs.length);
                }
            } catch (e) {
                console.error('[QuranAudio] reciter switch error:', e);
            }
        });
        return () => unsub();
    }, [buildAndPlay]);

    const togglePlayPause = useCallback(async () => {
        try {
            const { state } = await TrackPlayer.getPlaybackState();
            if (state === State.Playing) {
                await TrackPlayer.pause();
            } else {
                await TrackPlayer.play();
            }
        } catch (e) {
            console.error('[QuranAudio] togglePlayPause error:', e);
        }
    }, []);

    const skipNext = useCallback(async () => {
        try { await TrackPlayer.skipToNext(); } catch { /* end of queue */ }
    }, []);

    const skipToIndex = useCallback(async (index: number) => {
        try { await TrackPlayer.skip(index); await TrackPlayer.play(); } catch { /* out of range */ }
    }, []);

    const skipPrev = useCallback(async () => {
        try { await TrackPlayer.skipToPrevious(); } catch { /* start of queue */ }
    }, []);

    const stop = useCallback(async () => {
        try { await TrackPlayer.reset(); } catch { /* ignore */ }
        activeQueueRef.current = null;
        setPlaylistName(null);
        setQueueTotal(0);
        setQueueIndex(0);
    }, []);

    const seekTo = useCallback(async (seconds: number) => {
        try { await TrackPlayer.seekTo(seconds); } catch { /* ignore */ }
    }, []);

    const setRate = useCallback(async (rate: number) => {
        try { await TrackPlayer.setRate(rate); } catch { /* ignore */ }
    }, []);

    // ── Sleep timer ──
    const [sleepTimerMins, setSleepTimerMinsState] = useState<0 | 15 | 30 | 60>(0);
    const [sleepSecondsLeft, setSleepSecondsLeft] = useState(0);
    const sleepIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const setSleepTimer = useCallback((mins: 0 | 15 | 30 | 60) => {
        if (sleepIntervalRef.current) {
            clearInterval(sleepIntervalRef.current);
            sleepIntervalRef.current = null;
        }
        setSleepTimerMinsState(mins);
        if (mins === 0) {
            setSleepSecondsLeft(0);
            return;
        }
        setSleepSecondsLeft(mins * 60);
        sleepIntervalRef.current = setInterval(() => {
            setSleepSecondsLeft(s => {
                if (s <= 1) {
                    if (sleepIntervalRef.current) clearInterval(sleepIntervalRef.current);
                    sleepIntervalRef.current = null;
                    setSleepTimerMinsState(0);
                    TrackPlayer.pause().catch(() => {});
                    return 0;
                }
                return s - 1;
            });
        }, 1000);
    }, []);

    useEffect(() => () => {
        if (sleepIntervalRef.current) clearInterval(sleepIntervalRef.current);
    }, []);

    return (
        <QuranAudioContext.Provider value={{
            isPlaying, isLoading,
            currentSurahNumber, currentAyahNumber, currentSurahName,
            playlistName, queueIndex, queueTotal,
            startPlaylist, startAyahQueue, skipToIndex,
            togglePlayPause, skipNext, skipPrev, stop,
            seekTo, setRate, setSleepTimer, sleepTimerMins, sleepSecondsLeft,
        }}>
            {children}
        </QuranAudioContext.Provider>
    );
}

export function useQuranAudio() {
    const ctx = useContext(QuranAudioContext);
    if (!ctx) throw new Error('useQuranAudio must be used within QuranAudioProvider');
    return ctx;
}
