import AsyncStorage from '@react-native-async-storage/async-storage';

const STATS_KEY = 'tahajjud-community-stats';

interface CommunityStats {
    duasSent: number;
    duasReceived: number;
    lastUpdate: string; // YYYY-MM-DD
}

export const getCommunityStats = async (): Promise<CommunityStats> => {
    try {
        const today = new Date().toISOString().split('T')[0];
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
        return { duasSent: 0, duasReceived: 0, lastUpdate: new Date().toISOString().split('T')[0] };
    }
};

export const incrementDuasSent = async () => {
    try {
        const today = new Date().toISOString().split('T')[0];
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

export const incrementDuasReceived = async () => {
    try {
        const today = new Date().toISOString().split('T')[0];
        const stats = await getCommunityStats();
        const newStats = {
            ...stats,
            duasReceived: stats.duasReceived + 1,
            lastUpdate: today
        };
        await AsyncStorage.setItem(STATS_KEY, JSON.stringify(newStats));
        return newStats;
    } catch (e) {
        console.error('Failed to increment duas received', e);
    }
};

// Simulation logic
export const getSimulatedLiveCount = () => {
    // Basic simulation: Base count + random fluctuation
    const base = 12430;
    const fluctuation = Math.floor(Math.random() * 200) - 100;
    return base + fluctuation;
};

export const getRandomPulseLocation = () => {
    // Returns random coordinates for map pulses
    return {
        x: Math.random() * 100, // percentage
        y: Math.random() * 100, // percentage
    };
};
