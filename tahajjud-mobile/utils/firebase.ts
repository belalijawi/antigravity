import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAuth, Auth, initializeAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, initializeFirestore, Firestore } from 'firebase/firestore';
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

// Firestore transport: the Firebase JS SDK defaults to WebChannel streaming,
// which is unreliable in React Native — reads often succeed from cache while
// writes (setDoc/updateDoc) hang or reject after a timeout. That caused the
// Dua Wall "Ameen registers then disappears after a few seconds" bug (the write
// rejected → the UI rolled back). `experimentalForceLongPolling` switches to a
// long-polling transport that works reliably in RN. Must be set via
// initializeFirestore BEFORE any getFirestore() call, and only once.
function initDb(a: FirebaseApp): Firestore {
    try {
        return initializeFirestore(a, { experimentalForceLongPolling: true });
    } catch {
        // Already initialized (e.g. fast refresh) — fall back to the existing instance.
        return getFirestore(a);
    }
}

if (getApps().length) {
    app = getApp();
    auth = getAuth(app);
    db = initDb(app);
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
    db = initDb(app);
}

export const getFirebaseAuth = (): Auth => auth;
export const getFirebaseDb = (): Firestore => db;

// ── Auto anonymous sign-in ────────────────────────────────────────────
// Features like Accountability Partner, Dua Wall, and Testimony submission
// require a Firebase auth UID to satisfy Firestore rules. Most users never
// do Google/Apple sign-in — they just open the app — so we automatically
// upgrade them to an anonymous auth session in the background.
//
// Anonymous sessions persist via AsyncStorage (same as normal sign-in), so
// the user keeps the same UID across launches. When they later sign in
// with Google/Apple, the anonymous account is replaced by the real one.
// This runs once per app launch and is a no-op if a session already exists.
let anonSignInPromise: Promise<void> | null = null;
export function ensureSignedIn(): Promise<void> {
    if (anonSignInPromise) return anonSignInPromise;
    anonSignInPromise = new Promise<void>((resolve) => {
        if (auth.currentUser) { resolve(); return; }
        // Wait one auth state tick — Firebase might still be restoring a
        // persisted session from AsyncStorage. Only sign in anonymously if
        // we still have no user after that.
        const unsub = onAuthStateChanged(auth, (user) => {
            unsub();
            if (user) { resolve(); return; }
            signInAnonymously(auth)
                .then(() => resolve())
                .catch((e) => {
                    console.log('[firebase] anonymous sign-in failed:', e);
                    // Don't cache the failure — a flaky cold-start network would
                    // otherwise leave the whole session unauthenticated (every
                    // Firestore read permission-denied) with no retry path.
                    anonSignInPromise = null;
                    resolve(); // resolve anyway — caller will degrade gracefully
                });
        });
    });
    return anonSignInPromise;
}

// Kick off anonymous sign-in immediately at module load.
ensureSignedIn().catch(() => {});

/**
 * Reset the cached anonymous sign-in promise so the next `ensureSignedIn()`
 * call actually re-triggers anonymous auth. Used after `auth.signOut()` —
 * otherwise the app is left in a "no user" state and any Firestore call
 * (or any code that reads `currentUser.uid`) crashes.
 */
export async function resetToAnonymous(): Promise<void> {
    anonSignInPromise = null;
    await ensureSignedIn();
}

// Kept for backwards compatibility
export const initFirebase = async () => ({ app, auth, db });
export const saveFirebaseConfig = async (_config: any) => { /* no-op — config is now hardcoded */ };
export interface FirebaseConfig {
    apiKey: string; authDomain: string; projectId: string;
    storageBucket: string; messagingSenderId: string; appId: string;
}
