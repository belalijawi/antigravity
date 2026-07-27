import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * One shared nickname (+ optional country) reused as the default across
 * every naming field in the app — the Leaderboard opt-in, Dua Wall compose
 * name, comment replies, and the Accountability Partner "your name" field.
 *
 * Before this, each of those was its own blank text field, re-typed fresh
 * every time. Someone could top the leaderboard as "Yusuf_Q" AND reply to
 * your dua as "Yusuf_Q" and you'd have no way of knowing it's the same
 * person, since nothing tied the two names together. This doesn't build a
 * social graph or a backend profile — it's purely a local "remember and
 * suggest" layer. Recognition happens naturally because the same visible
 * string shows up in more than one place, not because of any server-side
 * linkage. Every surface still lets the user type something different or
 * post anonymously — this only changes the DEFAULT, never removes control.
 *
 * Deliberately NOT tied to the Leaderboard's opt-in doc: joining the
 * leaderboard means "rank me and show my scores publicly," a bigger consent
 * than "remember my name for next time." Someone should be able to have a
 * consistent name on the Dua Wall without that silently opting them into a
 * competitive, visible ranking.
 */

const KEY = 'community-profile-v1';

export interface CommunityProfile {
    nickname: string;
    country?: string;
}

export const CommunityProfileStore = {
    async get(): Promise<CommunityProfile | null> {
        try {
            const raw = await AsyncStorage.getItem(KEY);
            if (!raw) return null;
            const parsed = JSON.parse(raw);
            return parsed?.nickname ? parsed : null;
        } catch { return null; }
    },

    /** Save (or update) the shared nickname/country. Call this after ANY
     * surface successfully uses a name, so it propagates to the others next
     * time — whichever surface the user sets a name on first "wins".
     *
     * Merges onto whatever's already stored rather than replacing it wholesale
     * — callers that only ever touch the name (comment replies never had a
     * country picker of their own) used to silently ERASE a country already
     * saved from the Dua Wall or Leaderboard the moment someone posted a
     * single reply, since the old write had no country field to persist and
     * just overwrote the whole object. Passing `country: null` explicitly is
     * still how a surface clears it (e.g. opting out); omitting it just
     * leaves whatever's there untouched. */
    async set(nickname: string, country?: string | null): Promise<void> {
        const trimmed = nickname.trim();
        if (!trimmed) return;
        try {
            const existing = await this.get();
            const next: CommunityProfile = { nickname: trimmed };
            if (country !== undefined) {
                if (country) next.country = country;
            } else if (existing?.country) {
                next.country = existing.country;
            }
            await AsyncStorage.setItem(KEY, JSON.stringify(next));
        } catch { /* non-fatal — just means the next surface won't prefill */ }
    },
};
