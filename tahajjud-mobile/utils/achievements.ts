import AsyncStorage from '@react-native-async-storage/async-storage';

export interface Achievement {
    id: string;
    title: string;
    description: string;
    icon: string; // Icon name from lucide-react-native
    criteria: {
        type: 'prayer' | 'dua' | 'story';
        count: number;
    };
    unlockedAt?: string; // ISO date string
}

export const ACHIEVEMENTS: Achievement[] = [
    {
        id: 'first-step',
        title: 'First Step',
        description: 'Log your first Tahajjud prayer',
        icon: 'Star',
        criteria: { type: 'prayer', count: 1 }
    },
    {
        id: 'early-riser',
        title: 'Early Riser',
        description: 'Log 3 Tahajjud prayers',
        icon: 'Sunrise',
        criteria: { type: 'prayer', count: 3 }
    },
    {
        id: 'steadfast',
        title: 'Steadfast',
        description: 'Log 7 Tahajjud prayers',
        icon: 'ShieldCheck',
        criteria: { type: 'prayer', count: 7 }
    },
    {
        id: 'moonlighter',
        title: 'Moonlighter',
        description: 'Log 30 Tahajjud prayers',
        icon: 'Moon',
        criteria: { type: 'prayer', count: 30 }
    },
    {
        id: 'scribe',
        title: 'Scribe',
        description: 'Write 5 personal duas in your journal',
        icon: 'PenTool',
        criteria: { type: 'dua', count: 5 }
    },
    {
        id: 'beacon',
        title: 'Beacon',
        description: 'Share your Tahajjud story with the community',
        icon: 'MessageSquarePlus',
        criteria: { type: 'story', count: 1 }
    }
];

const STORAGE_KEY = 'tahajjud-achievements';

export const getAchievements = async (): Promise<Achievement[]> => {
    try {
        const stored = await AsyncStorage.getItem(STORAGE_KEY);
        const unlockedIds: Record<string, string> = stored ? JSON.parse(stored) : {};

        return ACHIEVEMENTS.map(achievement => ({
            ...achievement,
            unlockedAt: unlockedIds[achievement.id]
        }));
    } catch (e) {
        console.error('Failed to get achievements', e);
        return ACHIEVEMENTS;
    }
};

export const checkAchievements = async (type: 'prayer' | 'dua' | 'story', count: number): Promise<Achievement | null> => {
    try {
        const stored = await AsyncStorage.getItem(STORAGE_KEY);
        const unlockedIds: Record<string, string> = stored ? JSON.parse(stored) : {};
        let newlyUnlocked: Achievement | null = null;

        for (const achievement of ACHIEVEMENTS) {
            if (!unlockedIds[achievement.id] && achievement.criteria.type === type && count >= achievement.criteria.count) {
                unlockedIds[achievement.id] = new Date().toISOString();
                newlyUnlocked = { ...achievement, unlockedAt: unlockedIds[achievement.id] };
            }
        }

        if (newlyUnlocked) {
            await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(unlockedIds));
        }

        return newlyUnlocked;
    } catch (e) {
        console.error('Failed to check achievements', e);
        return null;
    }
};
