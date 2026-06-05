import { getFirebaseAuth } from './firebase';

/**
 * Hardcoded list of Firebase Auth UIDs that have admin privileges
 * (testimony moderation, future content tools).
 *
 * To find your UID:
 *   Firebase Console → Authentication → Users tab → look at the "User UID" column
 *
 * Paste it below as a string. Add more UIDs to expand the team.
 *
 * NOTE: This is the CLIENT-SIDE check that gates UI visibility. The actual
 * server-side enforcement is in firestore.rules, which must also list these
 * UIDs in the `isAdmin()` function.
 */
export const ADMIN_UIDS: string[] = [
    'C811qHcpRSX723ssIkl18wjtoCB3', // belalijawi@yahoo.com (Apple Sign-In)
];

export function isCurrentUserAdmin(): boolean {
    const user = getFirebaseAuth()?.currentUser;
    if (!user) return false;
    return ADMIN_UIDS.includes(user.uid);
}
