import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { 
    getAuth, 
    Auth, 
    getReactNativePersistence,
    initializeAuth
} from 'firebase/auth';
import { getFirestore, Firestore } from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface FirebaseConfig {
    apiKey: string;
    authDomain: string;
    projectId: string;
    storageBucket: string;
    messagingSenderId: string;
    appId: string;
}

const CONFIG_KEY = 'firebase_config';

export const saveFirebaseConfig = async (config: FirebaseConfig) => {
    await AsyncStorage.setItem(CONFIG_KEY, JSON.stringify(config));
};

export const getSavedFirebaseConfig = async (): Promise<FirebaseConfig | null> => {
    const config = await AsyncStorage.getItem(CONFIG_KEY);
    return config ? JSON.parse(config) : null;
};

let appInstance: FirebaseApp | null = null;
let authInstance: Auth | null = null;
let dbInstance: Firestore | null = null;

export const initFirebase = async () => {
    if (appInstance) return { app: appInstance, auth: authInstance, db: dbInstance };

    const config = await getSavedFirebaseConfig();
    if (!config || !config.apiKey || config.apiKey === 'YOUR_API_KEY') {
        console.log('[Firebase] Configuration missing or invalid');
        return null;
    }

    try {
        if (!getApps().length) {
            appInstance = initializeApp(config);
            authInstance = initializeAuth(appInstance, {
                persistence: getReactNativePersistence(AsyncStorage)
            });
            dbInstance = getFirestore(appInstance);
        } else {
            appInstance = getApp();
            authInstance = getAuth(appInstance);
            dbInstance = getFirestore(appInstance);
        }
        console.log('[Firebase] Initialized successfully');
        return { app: appInstance, auth: authInstance, db: dbInstance };
    } catch (error) {
        console.error('[Firebase] Initialization error:', error);
        return null;
    }
};

// Hook-like getters for components
export const getFirebaseDb = () => dbInstance;
export const getFirebaseAuth = () => authInstance;
