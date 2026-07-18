import AsyncStorage from '@react-native-async-storage/async-storage';
import { localDateStr } from './localDate';

const STATS_KEY = 'tahajjud-community-stats';

interface CommunityStats {
    duasSent: number;
    duasReceived: number;
    lastUpdate: string; // YYYY-MM-DD
}

export const getCommunityStats = async (): Promise<CommunityStats> => {
    try {
        const today = localDateStr(new Date());
        const stored = await AsyncStorage.getItem(STATS_KEY);

        if (stored) {
            const stats: CommunityStats = JSON.parse(stored);
            // If it's a new day, reset the counts
            if (stats.lastUpdate !== today) {
                const resetStats = { duasSent: 0, duasReceived: 0, lastUpdate: today };
                await AsyncStorage.setItem(STATS_KEY, JSON.stringify(resetStats));
                return resetStats;
            }
            return stats;
        }

        return { duasSent: 0, duasReceived: 0, lastUpdate: today };
    } catch (e) {
        return { duasSent: 0, duasReceived: 0, lastUpdate: localDateStr(new Date()) };
    }
};

export const incrementDuasSent = async () => {
    try {
        const today = localDateStr(new Date());
        const stats = await getCommunityStats();
        const newStats = {
            ...stats,
            duasSent: stats.duasSent + 1,
            lastUpdate: today
        };
        await AsyncStorage.setItem(STATS_KEY, JSON.stringify(newStats));
        return newStats;
    } catch (e) {
        console.error('Failed to increment duas sent', e);
    }
};

