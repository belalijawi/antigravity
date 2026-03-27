import * as FileSystem from 'expo-file-system/legacy';
import AsyncStorage from '@react-native-async-storage/async-storage';

const DOWNLOAD_DIR = `${FileSystem.documentDirectory}quran_audio/`;
const DOWNLOADS_KEY = 'offline_quran_downloads';

// Full surah MP3s from Islamic Network CDN (Mishary Alafasy, 128kbps)
const AUDIO_CDN = 'https://cdn.islamic.network/quran/audio-surah/128/ar.alafasy/';

export type DownloadStatus = 'none' | 'downloading' | 'downloaded' | 'error';

export interface DownloadInfo {
    surahNumber: number;
    status: DownloadStatus;
    progress: number; // 0–1
    localUri?: string;
}

type Listener = (info: DownloadInfo) => void;

class OfflineQuranService {
    private downloads = new Map<number, DownloadInfo>();
    private listeners = new Map<number, Listener[]>();
    private resumables = new Map<number, FileSystem.DownloadResumable>();
    private initialized = false;

    async init() {
        if (this.initialized) return;
        this.initialized = true;
        try {
            await FileSystem.makeDirectoryAsync(DOWNLOAD_DIR, { intermediates: true });
            const saved = await AsyncStorage.getItem(DOWNLOADS_KEY);
            if (saved) {
                const list: DownloadInfo[] = JSON.parse(saved);
                for (const d of list) {
                    const uri = this.localUri(d.surahNumber);
                    const info = await FileSystem.getInfoAsync(uri);
                    if (info.exists) {
                        this.downloads.set(d.surahNumber, { ...d, status: 'downloaded', localUri: uri });
                    }
                }
            }
        } catch (e) {
            console.error('[OfflineQuran] init error', e);
        }
    }

    localUri(surahNumber: number): string {
        return `${DOWNLOAD_DIR}${surahNumber}.mp3`;
    }

    remoteUrl(surahNumber: number): string {
        return `${AUDIO_CDN}${surahNumber}.mp3`;
    }

    getInfo(surahNumber: number): DownloadInfo {
        return this.downloads.get(surahNumber) ?? { surahNumber, status: 'none', progress: 0 };
    }

    isDownloaded(surahNumber: number): boolean {
        return this.downloads.get(surahNumber)?.status === 'downloaded';
    }

    getLocalUri(surahNumber: number): string | null {
        const info = this.downloads.get(surahNumber);
        return info?.status === 'downloaded' ? (info.localUri ?? null) : null;
    }

    getAllDownloaded(): number[] {
        return Array.from(this.downloads.entries())
            .filter(([, v]) => v.status === 'downloaded')
            .map(([k]) => k);
    }

    subscribe(surahNumber: number, listener: Listener): () => void {
        const existing = this.listeners.get(surahNumber) ?? [];
        this.listeners.set(surahNumber, [...existing, listener]);
        return () => {
            const updated = (this.listeners.get(surahNumber) ?? []).filter(l => l !== listener);
            this.listeners.set(surahNumber, updated);
        };
    }

    async download(surahNumber: number): Promise<boolean> {
        if (this.isDownloaded(surahNumber)) return true;
        if (this.downloads.get(surahNumber)?.status === 'downloading') return false;

        this.set(surahNumber, { surahNumber, status: 'downloading', progress: 0 });

        try {
            const uri = this.localUri(surahNumber);
            const url = this.remoteUrl(surahNumber);

            const resumable = FileSystem.createDownloadResumable(
                url,
                uri,
                {},
                ({ totalBytesWritten, totalBytesExpectedToWrite }) => {
                    const p = totalBytesExpectedToWrite > 0
                        ? totalBytesWritten / totalBytesExpectedToWrite
                        : 0;
                    this.set(surahNumber, { surahNumber, status: 'downloading', progress: p });
                }
            );

            this.resumables.set(surahNumber, resumable);
            const result = await resumable.downloadAsync();
            this.resumables.delete(surahNumber);

            if (result?.uri) {
                this.set(surahNumber, { surahNumber, status: 'downloaded', progress: 1, localUri: result.uri });
                await this.persist();
                return true;
            }

            this.set(surahNumber, { surahNumber, status: 'error', progress: 0 });
            return false;
        } catch (e) {
            console.error('[OfflineQuran] download error', e);
            this.set(surahNumber, { surahNumber, status: 'error', progress: 0 });
            return false;
        }
    }

    async cancelDownload(surahNumber: number) {
        const resumable = this.resumables.get(surahNumber);
        if (resumable) {
            try { await resumable.pauseAsync(); } catch {}
            this.resumables.delete(surahNumber);
        }
        try { await FileSystem.deleteAsync(this.localUri(surahNumber), { idempotent: true }); } catch {}
        this.set(surahNumber, { surahNumber, status: 'none', progress: 0 });
    }

    async delete(surahNumber: number) {
        try { await FileSystem.deleteAsync(this.localUri(surahNumber), { idempotent: true }); } catch {}
        this.downloads.delete(surahNumber);
        await this.persist();
        this.notify(surahNumber, { surahNumber, status: 'none', progress: 0 });
    }

    private set(surahNumber: number, info: DownloadInfo) {
        this.downloads.set(surahNumber, info);
        this.notify(surahNumber, info);
    }

    private notify(surahNumber: number, info: DownloadInfo) {
        (this.listeners.get(surahNumber) ?? []).forEach(l => l(info));
    }

    private async persist() {
        const downloaded = Array.from(this.downloads.values())
            .filter(d => d.status === 'downloaded');
        await AsyncStorage.setItem(DOWNLOADS_KEY, JSON.stringify(downloaded));
    }
}

export default new OfflineQuranService();
