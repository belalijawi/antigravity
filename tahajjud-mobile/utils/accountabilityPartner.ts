import AsyncStorage from '@react-native-async-storage/async-storage';
import { getFirebaseAuth, getFirebaseDb } from './firebase';
import { doc, setDoc, getDoc, onSnapshot, Unsubscribe } from 'firebase/firestore';

const LOCAL_KEY = 'accountability_partner_v1';

export interface PartnerData {
    myCode: string;
    partnerCode: string | null;
    partnerUserId: string | null;
    partnerName: string | null;
}

function generateCode(uid: string): string {
    // Deterministic 6-char uppercase code from uid
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

export const AccountabilityPartner = {
    async getOrCreate(): Promise<PartnerData> {
        const local = await loadLocal();
        if (local) return local;

        const user = getFirebaseAuth().currentUser;
        const myCode = user ? generateCode(user.uid) : generateCode(Math.random().toString());
        const data: PartnerData = { myCode, partnerCode: null, partnerUserId: null, partnerName: null };

        if (user) {
            try {
                const db = getFirebaseDb();
                // Register this code so others can look it up
                await setDoc(doc(db, 'partner_codes', myCode), { userId: user.uid, name: user.displayName ?? 'A friend' }, { merge: true });
            } catch { /* offline */ }
        }

        await saveLocal(data);
        return data;
    },

    async connectPartner(partnerCode: string, myName: string): Promise<{ success: boolean; name: string | null }> {
        const code = partnerCode.toUpperCase().trim();
        try {
            const db = getFirebaseDb();
            const snap = await getDoc(doc(db, 'partner_codes', code));
            if (!snap.exists()) return { success: false, name: null };

            const { userId: partnerUserId, name: partnerName } = snap.data() as { userId: string; name: string };

            const local = await loadLocal();
            const myCode = local?.myCode ?? '';
            const updated: PartnerData = { myCode, partnerCode: code, partnerUserId, partnerName };
            await saveLocal(updated);

            // Let partner know about you
            const user = getFirebaseAuth().currentUser;
            if (user) {
                await setDoc(doc(db, 'partner_codes', myCode), { userId: user.uid, name: myName }, { merge: true });
                // Write partnership to both users
                await setDoc(doc(db, 'partnerships', user.uid), { partnerUserId, partnerCode: code }, { merge: true });
                await setDoc(doc(db, 'partnerships', partnerUserId), { partnerUserId: user.uid, partnerCode: myCode }, { merge: true });
            }

            return { success: true, name: partnerName };
        } catch {
            return { success: false, name: null };
        }
    },

    async disconnect(): Promise<void> {
        const local = await loadLocal();
        if (!local) return;
        const updated: PartnerData = { ...local, partnerCode: null, partnerUserId: null, partnerName: null };
        await saveLocal(updated);
        try {
            const user = getFirebaseAuth().currentUser;
            if (user) {
                const db = getFirebaseDb();
                await setDoc(doc(db, 'partnerships', user.uid), { partnerUserId: null, partnerCode: null }, { merge: true });
            }
        } catch { /* ignore */ }
    },

    // Log tonight's Tahajjud to Firestore so partner can see it
    async logTahajjudForPartner(): Promise<void> {
        const user = getFirebaseAuth().currentUser;
        if (!user) return;
        const today = new Date().toISOString().slice(0, 10);
        try {
            const db = getFirebaseDb();
            await setDoc(doc(db, 'tahajjud_logs', `${user.uid}_${today}`), {
                userId: user.uid,
                date: today,
                prayedAt: new Date().toISOString(),
            });
        } catch { /* offline */ }
    },

    // Listen to partner's prayer status for today
    listenToPartner(
        partnerUserId: string,
        onUpdate: (prayedTonight: boolean, prayedAt: string | null) => void
    ): Unsubscribe {
        const today = new Date().toISOString().slice(0, 10);
        const db = getFirebaseDb();
        return onSnapshot(
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
    },
};
