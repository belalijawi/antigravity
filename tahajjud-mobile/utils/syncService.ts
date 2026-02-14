import AsyncStorage from '@react-native-async-storage/async-storage';
import { getFirebaseDb, getFirebaseAuth } from './firebase';
import { collection, doc, setDoc, getDocs, query, where, orderBy, deleteDoc } from 'firebase/firestore';
import { PersonalDua } from './personalDuas';

export const syncLocalToCloud = async (userId: string) => {
    try {
        console.log('[Sync] Starting data migration for user:', userId);

        // 1. Get local personal duas
        const localData = await AsyncStorage.getItem('personal-duas');
        if (!localData) {
            console.log('[Sync] No local data found to migrate.');
            return;
        }

        const localDuas: PersonalDua[] = JSON.parse(localData);
        if (localDuas.length === 0) return;

        const db = getFirebaseDb();
        if (!db) {
            throw new Error('Firestore not initialized');
        }

        // 2. Sync to Firestore
        // Store in: users/{userId}/tahajjud_letters/{localId}
        const promises = localDuas.map(async (dua) => {
            const docRef = doc(db, 'users', userId, 'tahajjud_letters', dua.id);
            return setDoc(docRef, {
                title: dua.title,
                arabic: dua.arabic || null,
                transliteration: dua.transliteration || null,
                translation: dua.translation || null,
                notes: dua.notes || null,
                createdAt: new Date(dua.createdAt),
                updatedAt: new Date(),
            }, { merge: true }); // merge: true allows updates without overwriting
        });

        await Promise.all(promises);

        console.log(`[Sync] Successfully migrated ${localDuas.length} letters to the cloud.`);

        // 3. Mark as synced
        await AsyncStorage.setItem('last-sync-timestamp', Date.now().toString());

    } catch (e) {
        console.error('[Sync] Migration failed:', e);
        throw e;
    }
};

export const fetchCloudData = async (userId: string) => {
    try {
        const db = getFirebaseDb();
        if (!db) {
            console.log('[Sync] Firestore not initialized');
            return [];
        }

        const lettersRef = collection(db, 'users', userId, 'tahajjud_letters');
        const q = query(lettersRef, orderBy('createdAt', 'desc'));
        const querySnapshot = await getDocs(q);

        const translatedData: PersonalDua[] = [];
        querySnapshot.forEach((doc) => {
            const data = doc.data();
            translatedData.push({
                id: doc.id,
                title: data.title,
                arabic: data.arabic,
                transliteration: data.transliteration,
                translation: data.translation,
                notes: data.notes,
                createdAt: data.createdAt?.toMillis() || Date.now(),
            });
        });

        return translatedData;
    } catch (e) {
        console.error('[Sync] Fetching cloud data failed:', e);
        return [];
    }
};

export const deleteCloudData = async (userId: string) => {
    try {
        const db = getFirebaseDb();
        if (!db) {
            console.log('[Sync] Firestore not initialized');
            return;
        }

        console.log('[Sync] Deleting cloud data for user:', userId);
        const lettersRef = collection(db, 'users', userId, 'tahajjud_letters');
        const querySnapshot = await getDocs(lettersRef);

        const actualDeletePromises = querySnapshot.docs.map(d => deleteDoc(d.ref));

        await Promise.all(actualDeletePromises);
        console.log('[Sync] All cloud letters deleted.');
    } catch (e) {
        console.error('[Sync] Failed to delete cloud data:', e);
        throw e;
    }
};
