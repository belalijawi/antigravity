import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAuth, Auth, initializeAuth } from 'firebase/auth';
import { getFirestore, Firestore } from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Firebase config is safe to be in source — web API keys are public-facing by design.
// Previously stored in AsyncStorage: empty on fresh install → null auth → SIGABRT crash.
const FIREBASE_CONFIG = {
    apiKey: "AIzaSyBTbpXPTn-wMBp821rMaoqOqdstNhzyRdM",
    authDomain: "tahajjud-2d7bf.firebaseapp.com",
    projectId: "tahajjud-2d7bf",
    storageBucket: "tahajjud-2d7bf.firebasestorage.app",
    messagingSenderId: "434827238021",
    appId: "1:434827238021:web:2a437aa88af1b360c1e7ec",
};

// Initialize eagerly at module load — guarantees getFirebaseAuth() never returns null.
let app: FirebaseApp;
let auth: Auth;
let db: Firestore;

if (getApps().length) {
    app = getApp();
    auth = getAuth(app);
    db = getFirestore(app);
} else {
    app = initializeApp(FIREBASE_CONFIG);
    try {
        // Use initializeAuth with AsyncStorage for persistent sessions across app restarts.
        // getReactNativePersistence is imported inline to avoid TypeScript path resolution issues.
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const { getReactNativePersistence } = require('firebase/auth');
        auth = initializeAuth(app, {
            persistence: getReactNativePersistence(AsyncStorage),
        });
    } catch {
        // Fallback to in-memory auth if persistence setup fails (e.g. in Expo Go)
        auth = getAuth(app);
    }
    db = getFirestore(app);
}

export const getFirebaseAuth = (): Auth => auth;
export const getFirebaseDb = (): Firestore => db;

// Kept for backwards compatibility
export const initFirebase = async () => ({ app, auth, db });
export const saveFirebaseConfig = async (_config: any) => { /* no-op — config is now hardcoded */ };
export interface FirebaseConfig {
    apiKey: string; authDomain: string; projectId: string;
    storageBucket: string; messagingSenderId: string; appId: string;
}
