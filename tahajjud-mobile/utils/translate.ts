import { getApp } from 'firebase/app';
import { getFunctions, httpsCallable } from 'firebase/functions';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getLocale } from './i18n';

/**
 * On-demand translation for user-posted duas, stories, and replies — tapped
 * from a "Translate" link, never automatic (it's a billed Cloud Function
 * call under the hood). The real cache lives on the source Firestore doc
 * itself (translateText writes translations.{lang} there — see
 * functions/index.js), so re-opening the same content is normally free; this
 * on-device cache just saves the network round-trip within a session.
 */

const LOCAL_CACHE_KEY = 'translate-local-cache-v1'; // JSON: { "{docId}:{lang}": string }
const LOCAL_CACHE_CAP = 300;

export type TranslateParentType = 'dua' | 'testimony' | 'comment';

export type TranslateResult =
    | { ok: true; text: string }
    | { ok: false; error: string };

async function cacheLocally(key: string, text: string): Promise<void> {
    try {
        const raw = await AsyncStorage.getItem(LOCAL_CACHE_KEY);
        const map: Record<string, string> = raw ? JSON.parse(raw) : {};
        map[key] = text;
        const keys = Object.keys(map);
        if (keys.length > LOCAL_CACHE_CAP) {
            for (const k of keys.slice(0, keys.length - LOCAL_CACHE_CAP)) delete map[k];
        }
        await AsyncStorage.setItem(LOCAL_CACHE_KEY, JSON.stringify(map));
    } catch { /* best-effort cache, never block on it */ }
}

export const Translate = {
    /**
     * Translate `text` (the live content of `docId`) into the app's current
     * display language. `existingTranslations` — the `translations` map
     * already present on a doc the caller fetched live — is checked first so
     * a translation someone else already triggered never costs a network
     * call at all, let alone an API charge.
     */
    async translate(
        text: string,
        docId: string,
        parentType: TranslateParentType,
        existingTranslations?: Record<string, string>,
    ): Promise<TranslateResult> {
        const targetLang = getLocale();

        if (existingTranslations?.[targetLang]) {
            return { ok: true, text: existingTranslations[targetLang] };
        }

        const cacheKey = `${docId}:${targetLang}`;
        try {
            const raw = await AsyncStorage.getItem(LOCAL_CACHE_KEY);
            const map: Record<string, string> = raw ? JSON.parse(raw) : {};
            if (map[cacheKey]) return { ok: true, text: map[cacheKey] };
        } catch { /* fall through to the network call */ }

        try {
            const functions = getFunctions(getApp());
            const call = httpsCallable(functions, 'translateText');
            const res = await call({ text, targetLang, parentType, docId });
            const translated = (res.data as any)?.translated;
            if (typeof translated !== 'string' || translated.length === 0) {
                return { ok: false, error: 'bad-response' };
            }
            cacheLocally(cacheKey, translated).catch(() => {});
            return { ok: true, text: translated };
        } catch (e: any) {
            console.error('[Translate] translate error', e);
            return { ok: false, error: e?.code ?? 'unknown' };
        }
    },
};
