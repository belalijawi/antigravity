import { saveFirebaseConfig } from './utils/firebase';

/**
 * Run this script ONCE to save your Firebase configuration
 * After running, you can delete this file
 */
export async function setupFirebase() {
    try {
        await saveFirebaseConfig({
            apiKey: "AIzaSyBTbpXPTn-wMBp821rMaoqOqdstNhzyRdM",
            authDomain: "tahajjud-2d7bf.firebaseapp.com",
            projectId: "tahajjud-2d7bf",
            storageBucket: "tahajjud-2d7bf.firebasestorage.app",
            messagingSenderId: "434827238021",
            appId: "1:434827238021:web:2a437aa88af1b360c1e7ec",
        });

        console.log('✅ Firebase configuration saved successfully!');
        console.log('You can now delete this setup-firebase.ts file');
        return true;
    } catch (error) {
        console.error('❌ Error saving Firebase config:', error);
        return false;
    }
}
