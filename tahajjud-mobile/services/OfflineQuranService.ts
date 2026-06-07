import * as FileSystem from 'expo-file-system/legacy';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getCurrentReciterId, reciterAudioUrl } from '../utils/reciters';
import { QuranService } from './QuranService';

const DOWNLOAD_DIR = `${FileSystem.documentDirectory}quran_audio/`;
const DOWNLOADS_KEY = 'offline_quran_downloads_v2'; // bumped key for new (surah,reciter) shape
const LEGACY_DOWNLOADS_KEY = 'offline_quran_downloads'; // pre-reciter shape

export type DownloadStatus = 'none' | 'downloading' | 'downloaded' | 'error';

export interface DownloadInfo {
    surahNumber: number;
    reciterId: string;
    status: DownloadStatus;
    progress: number; // 0–1
    localUri?: string;
}

type Listener = (info: DownloadInfo) => void;

// Map key: `${surahNumber}_${reciterId}`
const keyOf = (surahNumber: number, reciterId: string) => `${surahNumber}_${reciterId}`;

class OfflineQuranService {
    private downloads = new Map<string, DownloadInfo>();
    private listeners = new Map<string, Listener[]>();
    private resumables = new Map<string, FileSystem.DownloadResumable>();
    private initialized = false;

    async init() {
        if (this.initialized) return;
        this.initialized = true;
        try {
            await FileSystem.makeDirectoryAsync(DOWNLOAD_DIR, { intermediates: true });
            await this.migrateLegacyDownloads();

            const saved = await AsyncStorage.getItem(DOWNLOADS_KEY);
            if (saved) {
                const list: DownloadInfo[] = JSON.parse(saved);
                for (const d of list) {
                    const uri = this.localUri(d.surahNumber, d.reciterId);
                    const info = await FileSystem.getInfoAsync(uri);
                    if (info.exists) {
                        this.downloads.set(keyOf(d.surahNumber, d.reciterId), {
                            ...d, status: 'downloaded', localUri: uri,
                        });
                    }
                }
            }
        } catch (e) {
            console.error('[OfflineQuran] init error', e);
        }
    }

    /**
     * One-time migration: pre-reciter downloads were Alafasy-only and named `{n}.mp3`.
     * Move them to the new naming scheme and rewrite the index under the v2 key.
     */
    private async migrateLegacyDownloads() {
        try {
            const legacy = await AsyncStorage.getItem(LEGACY_DOWNLOADS_KEY);
            if (!legacy) return;
            const old: Array<{ surahNumber: number; status: string; progress: number; localUri?: string }> =
                JSON.parse(legacy);
            const migrated: DownloadInfo[] = [];
            for (const d of old) {
                if (d.status !== 'downloaded') continue;
                const oldPath = `${DOWNLOAD_DIR}${d.surahNumber}.mp3`;
                const newPath = `${DOWNLOAD_DIR}ar.alafasy_${d.surahNumber}.mp3`;
                try {
                    const exists = await FileSystem.getInfoAsync(oldPath);
                    if (exists.exists) {
                        try { await FileSystem.moveAsync({ from: oldPath, to: newPath }); } catch { /* maybe already moved */ }
                    }
                    const finalCheck = await FileSystem.getInfoAsync(newPath);
                    if (finalCheck.exists) {
                        migrated.push({
                            surahNumber: d.surahNumber,
                            reciterId: 'ar.alafasy',
                            status: 'downloaded',
                            progress: 1,
                            localUri: newPath,
                        });
                    }
                } catch { /* skip this entry */ }
            }
            if (migrated.length > 0) {
                await AsyncStorage.setItem(DOWNLOADS_KEY, JSON.stringify(migrated));
            }
            await AsyncStorage.removeItem(LEGACY_DOWNLOADS_KEY);
        } catch (e) {
            console.error('[OfflineQuran] legacy migration error', e);
        }
    }

    /** Path on disk for a given (surah, reciter) tuple. */
    localUri(surahNumber: number, reciterId: string = getCurrentReciterId()): string {
        return `${DOWNLOAD_DIR}${reciterId}_${surahNumber}.mp3`;
    }

    /** Remote MP3 URL for the given (surah, reciter). */
    remoteUrl(surahNumber: number, reciterId: string = getCurrentReciterId()): string {
        return reciterAudioUrl(reciterId, surahNumber);
    }

    getInfo(surahNumber: number, reciterId: string = getCurrentReciterId()): DownloadInfo {
        return this.downloads.get(keyOf(surahNumber, reciterId)) ?? {
            surahNumber, reciterId, status: 'none', progress: 0,
        };
    }

    isDownloaded(surahNumber: number, reciterId: string = getCurrentReciterId()): boolean {
        return this.downloads.get(keyOf(surahNumber, reciterId))?.status === 'downloaded';
    }

    /**
     * Returns the local file URI if this surah is downloaded for the given (or current) reciter.
     * Used by the audio engine to decide between offline file and CDN streaming.
     */
    getLocalUri(surahNumber: number, reciterId: string = getCurrentReciterId()): string | null {
        const info = this.downloads.get(keyOf(surahNumber, reciterId));
        return info?.status === 'downloaded' ? (info.localUri ?? null) : null;
    }

    /** Surah numbers downloaded for the current reciter. */
    getAllDownloaded(reciterId: string = getCurrentReciterId()): number[] {
        return Array.from(this.downloads.values())
            .filter(d => d.status === 'downloaded' && d.reciterId === reciterId)
            .map(d => d.surahNumber);
    }

    subscribe(surahNumber: number, listener: Listener, reciterId: string = getCurrentReciterId()): () => void {
        const k = keyOf(surahNumber, reciterId);
        const existing = this.listeners.get(k) ?? [];
        this.listeners.set(k, [...existing, listener]);
        return () => {
            const updated = (this.listeners.get(k) ?? []).filter(l => l !== listener);
            this.listeners.set(k, updated);
        };
    }

    async download(surahNumber: number, reciterId: string = getCurrentReciterId()): Promise<boolean> {
        if (this.isDownloaded(surahNumber, reciterId)) return true;
        const k = keyOf(surahNumber, reciterId);
        if (this.downloads.get(k)?.status === 'downloading') return false;

        this.set(surahNumber, reciterId, { surahNumber, reciterId, status: 'downloading', progress: 0 });

        try {
            const uri = this.localUri(surahNumber, reciterId);
            const url = this.remoteUrl(surahNumber, reciterId);

            const resumable = FileSystem.createDownloadResumable(
                url,
                uri,
                {},
                ({ totalBytesWritten, totalBytesExpectedToWrite }) => {
                    const p = totalBytesExpectedToWrite > 0
                        ? totalBytesWritten / totalBytesExpectedToWrite
                        : 0;
                    this.set(surahNumber, reciterId, {
                        surahNumber, reciterId, status: 'downloading', progress: p,
                    });
                }
            );

            this.resumables.set(k, resumable);
            const result = await resumable.downloadAsync();
            this.resumables.delete(k);

            if (result?.uri) {
                this.set(surahNumber, reciterId, {
                    surahNumber, reciterId, status: 'downloaded', progress: 1, localUri: result.uri,
                });
                await this.persist();
                // Pre-cache the user's non-bundled translation for this surah
                // so it loads instantly offline. Arabic (quran-uthmani) and
                // English (en.sahih) are bundled locally — no network needed.
                // Run in the background — the audio is already done.
                this.prefetchTranslation(surahNumber).catch(() => {});
                // NOTE: we intentionally do NOT prefetch individual per-ayah
                // audio files here. The offline fallback in QuranAudioContext
                // already handles the "no ayah cache" case by playing the
                // whole-surah MP3 we just downloaded — which is far smaller
                // (1 file vs up to 286 per surah) and gives identical
                // continuous-playback quality. Per-ayah files are only needed
                // for the tap-to-play karaoke mode, which requires a live
                // connection anyway for word-level timing data.
                return true;
            }

            this.set(surahNumber, reciterId, { surahNumber, reciterId, status: 'error', progress: 0 });
            return false;
        } catch (e) {
            console.error('[OfflineQuran] download error', e);
            this.set(surahNumber, reciterId, { surahNumber, reciterId, status: 'error', progress: 0 });
            return false;
        }
    }

    async cancelDownload(surahNumber: number, reciterId: string = getCurrentReciterId()) {
        const k = keyOf(surahNumber, reciterId);
        const resumable = this.resumables.get(k);
        if (resumable) {
            try { await resumable.pauseAsync(); } catch {}
            this.resumables.delete(k);
        }
        try { await FileSystem.deleteAsync(this.localUri(surahNumber, reciterId), { idempotent: true }); } catch {}
        this.set(surahNumber, reciterId, { surahNumber, reciterId, status: 'none', progress: 0 });
    }

    async delete(surahNumber: number, reciterId: string = getCurrentReciterId()) {
        try { await FileSystem.deleteAsync(this.localUri(surahNumber, reciterId), { idempotent: true }); } catch {}
        this.downloads.delete(keyOf(surahNumber, reciterId));
        await this.persist();
        this.notify(surahNumber, reciterId, { surahNumber, reciterId, status: 'none', progress: 0 });
    }

    /**
     * Pre-fetch the user's currently-active translation for this surah so it
     * lives in AsyncStorage and can be read offline. QuranService.getSurah
     * caches the result automatically — we just trigger the fetch here.
     * Called as a side-effect of `download()`.
     */
    private async prefetchTranslation(surahNumber: number): Promise<void> {
        try {
            const edition = (await AsyncStorage.getItem('reader_translation_edition_v1')) ?? 'en.sahih';
            // Arabic (quran-uthmani) and English (en.sahih) are bundled in
            // quran_en.json — instant, no network. Everything else is fetched
            // from the API and cached in AsyncStorage on first use.
            const LOCAL_EDITIONS = new Set(['quran-uthmani', 'en.sahih']);
            if (!LOCAL_EDITIONS.has(edition)) {
                await QuranService.getSurah(surahNumber, edition);
            }
        } catch { /* offline — try again later */ }
    }

    private set(surahNumber: number, reciterId: string, info: DownloadInfo) {
        this.downloads.set(keyOf(surahNumber, reciterId), info);
        this.notify(surahNumber, reciterId, info);
    }

    private notify(surahNumber: number, reciterId: string, info: DownloadInfo) {
        (this.listeners.get(keyOf(surahNumber, reciterId)) ?? []).forEach(l => l(info));
    }

    private async persist() {
        const downloaded = Array.from(this.downloads.values())
            .filter(d => d.status === 'downloaded');
        await AsyncStorage.setItem(DOWNLOADS_KEY, JSON.stringify(downloaded));
    }
}

export default new OfflineQuranService();
