/**
 * Firebase Auth wrapper to replace Supabase
 * Provides compatible API for existing code
 */
import { initFirebase, getFirebaseAuth } from './firebase';
import {
    signInWithCredential,
    GoogleAuthProvider,
    OAuthProvider,
    signOut as firebaseSignOut,
    User
} from 'firebase/auth';

// Initialize Firebase on import
initFirebase();

export interface AuthUser {
    id: string;
    email: string | null;
}

/**
 * Firebase Auth wrapper with Supabase-compatible API
 */
export const auth = {
    /**
     * Get current user
     */
    getUser: async (): Promise<{ data: { user: AuthUser | null }, error: any }> => {
        try {
            const authInstance = getFirebaseAuth();
            if (!authInstance) {
                return { data: { user: null }, error: null };
            }

            const currentUser = authInstance.currentUser;
            if (!currentUser) {
                return { data: { user: null }, error: null };
            }

            return {
                data: {
                    user: {
                        id: currentUser.uid,
                        email: currentUser.email,
                    }
                },
                error: null
            };
        } catch (error) {
            return { data: { user: null }, error };
        }
    },

    /**
     * Sign out current user
     */
    signOut: async (): Promise<{ error: any }> => {
        try {
            const authInstance = getFirebaseAuth();
            if (authInstance) {
                await firebaseSignOut(authInstance);
            }
            return { error: null };
        } catch (error) {
            return { error };
        }
    },

    /**
     * Sign in with Google
     */
    signInWithGoogle: async (idToken: string): Promise<{ data: { user: AuthUser | null }, error: any }> => {
        try {
            const authInstance = getFirebaseAuth();
            if (!authInstance) {
                throw new Error('Firebase not initialized');
            }

            const credential = GoogleAuthProvider.credential(idToken);
            const result = await signInWithCredential(authInstance, credential);

            return {
                data: {
                    user: {
                        id: result.user.uid,
                        email: result.user.email,
                    }
                },
                error: null
            };
        } catch (error) {
            return { data: { user: null }, error };
        }
    },

    /**
     * Sign in with Apple
     */
    signInWithApple: async (idToken: string, nonce: string): Promise<{ data: { user: AuthUser | null }, error: any }> => {
        try {
            const authInstance = getFirebaseAuth();
            if (!authInstance) {
                throw new Error('Firebase not initialized');
            }

            const provider = new OAuthProvider('apple.com');
            const credential = provider.credential({
                idToken: idToken,
                rawNonce: nonce,
            });

            const result = await signInWithCredential(authInstance, credential);

            return {
                data: {
                    user: {
                        id: result.user.uid,
                        email: result.user.email,
                    }
                },
                error: null
            };
        } catch (error) {
            return { data: { user: null }, error };
        }
    },
};

// Export for backwards compatibility
export const supabase = { auth };
