import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, signInAnonymously } from "firebase/auth";
import { getFirestore, collection, addDoc, serverTimestamp } from "firebase/firestore";

// Same project the Tahajjud+ app itself uses — config is safe to be in
// source, web API keys are public-facing by design (Firestore rules are
// the actual security boundary, not this key).
const FIREBASE_CONFIG = {
    apiKey: "AIzaSyBTbpXPTn-wMBp821rMaoqOqdstNhzyRdM",
    authDomain: "tahajjud-2d7bf.firebaseapp.com",
    projectId: "tahajjud-2d7bf",
    storageBucket: "tahajjud-2d7bf.firebasestorage.app",
    messagingSenderId: "434827238021",
    appId: "1:434827238021:web:2a437aa88af1b360c1e7ec",
};

function getFirebaseApp() {
    return getApps().length ? getApp() : initializeApp(FIREBASE_CONFIG);
}

export interface AmbassadorApplication {
    name: string;
    email: string;
    location?: string;
    instagram?: string;
    tiktok?: string;
    youtube?: string;
    otherPlatform?: string;
    audienceSize?: string;
    workLinks?: string;
    why?: string;
}

/**
 * Anonymous sign-in first, same pattern the app itself uses (Firestore
 * rules require request.auth != null on every collection, including this
 * one — there's no fully-public unauthenticated write anywhere in this
 * project, and this form shouldn't be the first exception).
 */
export async function submitAmbassadorApplication(data: AmbassadorApplication): Promise<void> {
    const app = getFirebaseApp();
    const auth = getAuth(app);
    if (!auth.currentUser) {
        await signInAnonymously(auth);
    }
    const db = getFirestore(app);
    // addDoc() rejects any field whose value is `undefined` (as opposed to
    // simply omitting the key) — every optional field on this form arrives
    // here as `undefined` when left blank, so those keys have to be dropped
    // entirely rather than passed through as-is.
    const clean = Object.fromEntries(
        Object.entries(data).filter(([, v]) => v !== undefined)
    );
    await addDoc(collection(db, "ambassador-applications"), {
        ...clean,
        status: "new",
        submittedAt: serverTimestamp(),
    });
}
