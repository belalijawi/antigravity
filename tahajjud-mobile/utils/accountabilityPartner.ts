import AsyncStorage from '@react-native-async-storage/async-storage';
import { getFirebaseAuth, getFirebaseDb, ensureSignedIn } from './firebase';
import { doc, setDoc, getDoc, onSnapshot, Unsubscribe } from 'firebase/firestore';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { localDateStr } from './localDate';

const EXPO_PROJECT_ID = '826f6518-cc97-4065-bbfd-e0e8e51cb475';
const LOCAL_KEY = 'accountability_partner_v2';

export interface PartnerEntry {
    code: string;
    userId: string;
    name: string;
}

export interface PartnerData {
    myCode: string;
    partners: PartnerEntry[];
}

function generateCode(uid: string): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
        code += chars[(uid.charCodeAt(i % uid.length) + i * 7) % chars.length];
    }
    return code;
}

async function loadLocal(): Promise<PartnerData | null> {
    try {
        const raw = await AsyncStorage.getItem(LOCAL_KEY);
        return raw ? JSON.parse(raw) : null;
    } catch { return null; }
}

async function saveLocal(data: PartnerData): Promise<void> {
    await AsyncStorage.setItem(LOCAL_KEY, JSON.stringify(data));
}

async function lookupPartnerName(db: any, partnerCode: string): Promise<string | null> {
    try {
        const snap = await getDoc(doc(db, 'partner_codes', partnerCode));
        if (snap.exists()) return (snap.data() as { name: string }).name ?? null;
    } catch { /* ignore */ }
    return null;
}

/**
 * Save this user's Expo push token to Firestore so their partners can notify
 * them. Exported so app-init and post-permission flows can keep it fresh —
 * stale tokens are the #1 reason wake notifications fail silently.
 *
 * Returns the saved token, or null if anything blocked the save (no device,
 * no auth, no permission, network failure). Logs every failure path so we
 * can debug why a user's partner can't wake them.
 */
export async function saveExpoPushToken(): Promise<string | null> {
    try {
        if (!Device.isDevice) {
            console.log('[push] skip: not a physical device');
            return null;
        }
        const user = getFirebaseAuth()?.currentUser;
        if (!user) {
            console.log('[push] skip: no authenticated user');
            return null;
        }
        const { status } = await Notifications.getPermissionsAsync();
        if (status !== 'granted') {
            console.log('[push] skip: notification permission not granted');
            return null;
        }
        const token = await Notifications.getExpoPushTokenAsync({ projectId: EXPO_PROJECT_ID });
        const db = getFirebaseDb();
        // Stored in a dedicated cross-readable collection (NOT users/{uid},
        // which holds private journal/letter subcollections that must stay
        // private). push_tokens/{uid} can be read by any authenticated user
        // so accountability partners can fetch each other's tokens.
        await setDoc(doc(db, 'push_tokens', user.uid), {
            token: token.data,
            updatedAt: Date.now(),
        }, { merge: true });
        console.log('[push] token saved:', token.data.slice(0, 24) + '…');
        return token.data;
    } catch (e) {
        console.warn('[push] saveExpoPushToken failed:', e);
        return null;
    }
}

/** Internal alias for backward compatibility within this file. */
async function savePushToken(): Promise<void> {
    await saveExpoPushToken();
}

// Send a push notification to one partner via Expo's push API
async function notifyPartner(db: any, partnerUserId: string, myCode: string): Promise<void> {
    try {
        const [tokenSnap, nameSnap] = await Promise.all([
            getDoc(doc(db, 'push_tokens', partnerUserId)),
            getDoc(doc(db, 'partner_codes', myCode)),
        ]);
        if (!tokenSnap.exists()) return;
        const { token: expoPushToken } = tokenSnap.data() as { token?: string };
        if (!expoPushToken) return;
        const myName: string = nameSnap.exists() ? ((nameSnap.data() as any).name ?? 'Your partner') : 'Your partner';
        const controller = new AbortController();
        const tid = setTimeout(() => controller.abort(), 10000);
        let r: Response;
        try {
            r = await fetch('https://exp.host/--/api/v2/push/send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
                signal: controller.signal,
                body: JSON.stringify({
                    to: expoPushToken,
                    title: `🌙 ${myName} just prayed Tahajjud`,
                    body: `They're standing in the last third of the night. Join them.`,
                    data: { type: 'partner_prayed' },
                    sound: 'default',
                    priority: 'high',
                }),
            }).finally(() => clearTimeout(tid));
        } catch { return; }
        // Clean up stale token if APNs/FCM says device is unregistered
        if (r.ok) {
            try {
                const body = await r.json();
                const raw = body?.data;
                const ticket = Array.isArray(raw) ? raw[0] : raw;
                if (ticket?.details?.error === 'DeviceNotRegistered') {
                    await setDoc(doc(db, 'push_tokens', partnerUserId), { token: null }, { merge: true });
                }
            } catch { /* ignore parse errors */ }
        }
    } catch { /* ignore */ }
}

/**
 * Wake-up push result.
 *  - sent:           push accepted by Expo + ticket OK
 *  - no_token:       partner has no expoPushToken in Firestore (they haven't
 *                    granted notification permission or app hasn't registered)
 *  - device_invalid: token is stale / device unregistered with APNs
 *  - failed:         network error or unexpected response from Expo
 *
 * `detail` carries any extra context (HTTP status, Expo error code, raw
 * response body) so we can surface it in the user-facing alert and learn
 * what's failing in production.
 */
export type WakeResult = { ok: 'sent' | 'no_token' | 'device_invalid' | 'failed' | 'rate_limited'; detail?: string };

async function sendWakeupToPartner(db: any, partnerUserId: string, myCode: string): Promise<WakeResult> {
    try {
        const [tokenSnap, nameSnap] = await Promise.all([
            getDoc(doc(db, 'push_tokens', partnerUserId)),
            getDoc(doc(db, 'partner_codes', myCode)),
        ]);
        if (!tokenSnap.exists()) {
            return { ok: 'no_token', detail: 'partner has no push_tokens doc yet — they need to open build 26+ once' };
        }
        const { token: expoPushToken } = tokenSnap.data() as { token?: string };
        if (!expoPushToken) {
            return { ok: 'no_token', detail: 'partner has no token' };
        }
        const myName: string = nameSnap.exists() ? ((nameSnap.data() as any).name ?? 'Your partner') : 'Your partner';

        const requestBody = {
            to: expoPushToken,
            title: `🌙 ${myName} is calling you to Tahajjud`,
            body: `The last third of the night is open. Don't miss it.`,
            data: { type: 'partner_wakeup' },
            sound: 'default',
            priority: 'high',
        };

        let r: Response;
        try {
            // 10s timeout — wake-up pushes must feel responsive. If the network
            // is slow we'd rather report failure quickly so user knows to retry.
            const controller = new AbortController();
            const tid = setTimeout(() => controller.abort(), 10000);
            r = await fetch('https://exp.host/--/api/v2/push/send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
                signal: controller.signal,
                body: JSON.stringify(requestBody),
            }).finally(() => clearTimeout(tid));
        } catch (netErr: any) {
            const isTimeout = netErr?.name === 'AbortError';
            return { ok: 'failed', detail: isTimeout ? 'network timeout (>10s)' : `network: ${netErr?.message ?? String(netErr)}` };
        }

        if (!r.ok) {
            const text = await r.text().catch(() => '');
            return { ok: 'failed', detail: `HTTP ${r.status} ${text.slice(0, 120)}` };
        }
        // Expo returns 200 OK even when delivery fails — parse the ticket.
        type Ticket = { status: string; message?: string; details?: { error?: string } };
        const bodyJson = await r.json().catch(() => null) as { data?: Ticket | Ticket[]; errors?: Array<{ message?: string; code?: string }> } | null;

        // Top-level errors (auth/validation problems) come back as { errors: [...] }
        if (bodyJson?.errors?.length) {
            const e0 = bodyJson.errors[0];
            return { ok: 'failed', detail: `Expo error: ${e0.code ?? ''} ${e0.message ?? ''}`.trim() };
        }

        const raw = bodyJson?.data;
        const ticket: Ticket | undefined = Array.isArray(raw) ? raw[0] : raw;
        if (!ticket) {
            return { ok: 'failed', detail: `no ticket in response: ${JSON.stringify(bodyJson).slice(0, 120)}` };
        }
        if (ticket.status === 'ok') return { ok: 'sent' };
        if (ticket.details?.error === 'DeviceNotRegistered') {
            try {
                await setDoc(doc(db, 'push_tokens', partnerUserId), { token: null }, { merge: true });
            } catch { /* ignore */ }
            return { ok: 'device_invalid', detail: 'cleared stale token' };
        }
        return { ok: 'failed', detail: `ticket status: ${ticket.status}${ticket.message ? ` — ${ticket.message}` : ''}${ticket.details?.error ? ` (${ticket.details.error})` : ''}` };
    } catch (e: any) {
        return { ok: 'failed', detail: `exception: ${e?.message ?? String(e)}` };
    }
}

export const AccountabilityPartner = {
    async getOrCreate(): Promise<PartnerData> {
        // Make sure we have a Firebase auth UID before touching Firestore —
        // anonymous if the user hasn't done Google/Apple sign-in.
        await ensureSignedIn();
        const user = getFirebaseAuth().currentUser;
        const myCode = user ? generateCode(user.uid) : generateCode(Math.random().toString());

        if (user) {
            try {
                const db = getFirebaseDb();

                // Register this code so others can look it up
                await setDoc(
                    doc(db, 'partner_codes', myCode),
                    { userId: user.uid, name: user.displayName ?? 'A friend' },
                    { merge: true }
                );

                // Save push token so partners can send notifications
                savePushToken().catch(() => {});

                // Sync from Firestore
                const partnershipSnap = await getDoc(doc(db, 'partnerships', user.uid));
                if (partnershipSnap.exists()) {
                    const data = partnershipSnap.data();

                    // New format: { partners: [...] }
                    if (data.partners && Array.isArray(data.partners)) {
                        const partners: PartnerEntry[] = (data.partners as any[]).filter(
                            p => p.userId && p.code && p.name
                        );
                        const result: PartnerData = { myCode, partners };
                        await saveLocal(result);
                        return result;
                    }

                    // Old format migration: { partnerUserId, partnerCode }
                    if (data.partnerUserId && data.partnerCode) {
                        const partnerName = await lookupPartnerName(db, data.partnerCode);
                        const partners: PartnerEntry[] = [{
                            code: data.partnerCode,
                            userId: data.partnerUserId,
                            name: partnerName ?? 'Partner',
                        }];
                        const result: PartnerData = { myCode, partners };
                        await saveLocal(result);
                        // Migrate Firestore to new format
                        await setDoc(doc(db, 'partnerships', user.uid), { partners }, { merge: true });
                        return result;
                    }
                }
            } catch { /* offline — fall through to local */ }
        }

        const local = await loadLocal();
        if (local) return { ...local, myCode };

        const fresh: PartnerData = { myCode, partners: [] };
        await saveLocal(fresh);
        return fresh;
    },

    async connectPartner(partnerCode: string, myName: string): Promise<{ success: boolean; name: string | null }> {
        await ensureSignedIn();
        const code = partnerCode.toUpperCase().trim();
        try {
            const db = getFirebaseDb();
            const snap = await getDoc(doc(db, 'partner_codes', code));
            if (!snap.exists()) return { success: false, name: null };

            const { userId: partnerUserId, name: partnerName } = snap.data() as { userId: string; name: string };

            const user = getFirebaseAuth().currentUser;
            const local = await loadLocal();
            // Derive myCode from UID (deterministic) — don't depend on local
            // storage being populated, which can fail on first launch.
            const myCode = local?.myCode ?? (user ? generateCode(user.uid) : '');

            // Don't add duplicate
            if (local?.partners.some(p => p.userId === partnerUserId)) {
                return { success: true, name: partnerName };
            }

            const newEntry: PartnerEntry = { code, userId: partnerUserId, name: partnerName };
            const partners: PartnerEntry[] = [...(local?.partners ?? []), newEntry];
            const updated: PartnerData = { myCode, partners };
            await saveLocal(updated);

            if (user) {
                // Update my display name
                await setDoc(doc(db, 'partner_codes', myCode), { userId: user.uid, name: myName }, { merge: true });

                // Write my updated partners list
                await setDoc(doc(db, 'partnerships', user.uid), { partners }, { merge: true });

                // Add me to partner's list
                const partnerPartnershipSnap = await getDoc(doc(db, 'partnerships', partnerUserId));
                const theirExisting: PartnerEntry[] = partnerPartnershipSnap.exists()
                    ? ((partnerPartnershipSnap.data().partners ?? []) as any[]).filter(
                        (p: any) => p.userId && p.code && p.name
                      )
                    : [];

                if (!theirExisting.some(p => p.userId === user.uid)) {
                    const myEntry: PartnerEntry = { code: myCode, userId: user.uid, name: myName };
                    await setDoc(
                        doc(db, 'partnerships', partnerUserId),
                        { partners: [...theirExisting, myEntry] },
                        { merge: true }
                    );
                }
            }

            return { success: true, name: partnerName };
        } catch {
            return { success: false, name: null };
        }
    },

    async disconnectPartner(partnerUserId: string): Promise<void> {
        const local = await loadLocal();
        if (!local) return;
        const partners = local.partners.filter(p => p.userId !== partnerUserId);
        const updated: PartnerData = { ...local, partners };
        await saveLocal(updated);
        try {
            const user = getFirebaseAuth().currentUser;
            if (user) {
                const db = getFirebaseDb();
                // Remove from my list
                await setDoc(doc(db, 'partnerships', user.uid), { partners }, { merge: true });
                // Remove me from their list
                const partnerSnap = await getDoc(doc(db, 'partnerships', partnerUserId));
                if (partnerSnap.exists()) {
                    const theirPartners: PartnerEntry[] = ((partnerSnap.data().partners ?? []) as any[])
                        .filter((p: any) => p.userId !== user.uid);
                    await setDoc(doc(db, 'partnerships', partnerUserId), { partners: theirPartners }, { merge: true });
                }
            }
        } catch { /* ignore */ }
    },

    // Listen to your own partnership document — fires when anyone connects/disconnects
    listenToPartnership(onUpdate: (data: PartnerData) => void): Unsubscribe {
        const user = getFirebaseAuth().currentUser;
        if (!user) return () => {};

        const db = getFirebaseDb();
        return onSnapshot(
            doc(db, 'partnerships', user.uid),
            async (snap) => {
                if (!snap.exists()) return;
                const data = snap.data();
                const local = await loadLocal();
                const myCode = local?.myCode ?? generateCode(user.uid);

                const partners: PartnerEntry[] = (data.partners ?? []).filter(
                    (p: any) => p.userId && p.code && p.name
                );

                // Only update if partner list actually changed
                const localIds = (local?.partners ?? []).map(p => p.userId).sort().join(',');
                const remoteIds = partners.map(p => p.userId).sort().join(',');
                if (localIds === remoteIds) return;

                const updated: PartnerData = { myCode, partners };
                await saveLocal(updated);
                onUpdate(updated);
            },
            () => {}
        );
    },

    // Log tonight's Tahajjud and notify ALL partners.
    // Idempotent — if already logged today, updates the timestamp but does
    // NOT send duplicate partner notifications (handles remove→relog flow).
    async logTahajjudForPartner(): Promise<void> {
        const user = getFirebaseAuth().currentUser;
        if (!user) return;
        const today = localDateStr(new Date());
        try {
            const db = getFirebaseDb();
            const logRef = doc(db, 'tahajjud_logs', `${user.uid}_${today}`);

            // Check if already notified partners today before sending again
            const { getDoc } = await import('firebase/firestore');
            const existing = await getDoc(logRef).catch(() => null);
            const alreadyNotified = existing?.exists() ?? false;

            await setDoc(logRef, {
                userId: user.uid,
                date: today,
                prayedAt: new Date().toISOString(),
            });

            // Only notify partners on the first log of the day
            if (!alreadyNotified) {
                const local = await loadLocal();
                if (local?.myCode && local.partners.length > 0) {
                    for (const partner of local.partners) {
                        notifyPartner(db, partner.userId, local.myCode).catch(() => {});
                    }
                }
            }
        } catch { /* offline */ }
    },

    /**
     * Send a wake-up push to one specific partner. The receiver gets a
     * high-priority notification: "🌙 Wake up — the gate is open · {Name}
     * is calling you to Tahajjud."
     *
     * Rate-limited at 1 wake-up per partner per 8 hours so users can't
     * abuse it to spam each other.
     */
    async wakePartner(partnerUserId: string): Promise<WakeResult> {
        const RATE_LIMIT_KEY = `wakeup-sent-${partnerUserId}`;
        const RATE_WINDOW_MS = 8 * 60 * 60 * 1000;
        try {
            const last = await AsyncStorage.getItem(RATE_LIMIT_KEY);
            if (last && Date.now() - parseInt(last, 10) < RATE_WINDOW_MS) {
                return { ok: 'rate_limited' };
            }
        } catch { /* ignore */ }
        const user = getFirebaseAuth()?.currentUser;
        if (!user) return { ok: 'failed', detail: 'not signed in' };
        // myCode is deterministic from the user's Firebase UID — derive it on
        // the fly rather than relying on local storage being populated. (Local
        // storage can be empty if the partner card was never opened in this
        // session, or if AsyncStorage got cleared.)
        const myCode = generateCode(user.uid);
        const result = await sendWakeupToPartner(getFirebaseDb(), partnerUserId, myCode);
        // Record rate-limit timestamp whenever a real attempt reached Expo
        // (sent or device_invalid both count — the request went through).
        if (result.ok === 'sent' || result.ok === 'device_invalid') {
            try { await AsyncStorage.setItem(RATE_LIMIT_KEY, String(Date.now())); } catch { /* ignore */ }
        }
        console.log('[push] wakePartner result:', JSON.stringify(result));
        return result;
    },

    // Listen to a single partner's prayer status for today.
    // Returns both an unsubscribe function and a refresh function — call refresh()
    // at midnight so the listener moves to the new day's document.
    listenToPartner(
        partnerUserId: string,
        onUpdate: (prayedTonight: boolean, prayedAt: string | null) => void
    ): Unsubscribe {
        let currentUnsub: Unsubscribe | null = null;

        const subscribe = () => {
            currentUnsub?.();
            const today = localDateStr(new Date());
            const db = getFirebaseDb();
            currentUnsub = onSnapshot(
                doc(db, 'tahajjud_logs', `${partnerUserId}_${today}`),
                (snap) => {
                    if (snap.exists()) {
                        const data = snap.data() as { prayedAt: string };
                        onUpdate(true, data.prayedAt);
                    } else {
                        onUpdate(false, null);
                    }
                },
                () => onUpdate(false, null)
            );
        };

        subscribe();

        // Re-subscribe at each minute boundary — when the date changes the
        // listener automatically moves to the new day's document so partners'
        // status resets correctly after midnight.
        let lastDate = localDateStr(new Date());
        const midnightTimer = setInterval(() => {
            const d = localDateStr(new Date());
            if (d !== lastDate) {
                lastDate = d;
                onUpdate(false, null); // reset to "hasn't prayed" for new night
                subscribe();
            }
        }, 60_000);

        return () => {
            currentUnsub?.();
            clearInterval(midnightTimer);
        };
    },
};
