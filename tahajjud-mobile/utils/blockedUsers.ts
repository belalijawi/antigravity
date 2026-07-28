/**
 * Blocking abusive users.
 *
 * App Store Review Guideline 1.2 requires an app with user-generated content
 * to offer all four of: a filter for objectionable material, a way to report
 * it, a way to BLOCK abusive users, and published contact details. This file
 * is the third of those.
 *
 * Blocking is device-local and immediate. It deliberately does NOT write to
 * Firestore: the community is anonymous by design (authorId is never shown to
 * anyone), so a server-side block list would create exactly the kind of
 * per-person record the rest of the feature set avoids — and a local list
 * satisfies the guideline, which is about the complainant no longer seeing the
 * abuser, not about punishing them globally. Reporting, which IS server-side,
 * remains the route to getting content removed for everyone.
 *
 * Blocking hides every surface that person authored: their duas on the Wall
 * and on the map, their replies in any thread, and their Leaderboard row.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { DeviceEventEmitter } from 'react-native';

const KEY = 'blocked-authors-v1';
/** Emitted after the list changes so open screens re-filter immediately. */
export const BLOCKED_CHANGED = 'blockedAuthorsChanged';

let cache: Set<string> | null = null;

export async function getBlocked(): Promise<Set<string>> {
    if (cache) return cache;
    try {
        const raw = await AsyncStorage.getItem(KEY);
        cache = new Set(raw ? (JSON.parse(raw) as string[]) : []);
    } catch {
        // Don't poison the cache on a transient read failure.
        return new Set();
    }
    return cache;
}

export async function blockAuthor(authorId: string): Promise<void> {
    if (!authorId) return;
    const set = new Set(await getBlocked());
    set.add(authorId);
    cache = set;
    try { await AsyncStorage.setItem(KEY, JSON.stringify([...set])); } catch { /* ignore */ }
    DeviceEventEmitter.emit(BLOCKED_CHANGED);
}

export async function unblockAuthor(authorId: string): Promise<void> {
    const set = new Set(await getBlocked());
    set.delete(authorId);
    cache = set;
    try { await AsyncStorage.setItem(KEY, JSON.stringify([...set])); } catch { /* ignore */ }
    DeviceEventEmitter.emit(BLOCKED_CHANGED);
}

/** Synchronous read of the last known list — for render-time filtering. */
export function blockedSnapshot(): Set<string> {
    return cache ?? new Set();
}
