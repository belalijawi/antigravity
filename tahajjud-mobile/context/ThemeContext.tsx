import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type ThemeType = 'silver' | 'teal' | 'emerald' | 'gold' | 'rose' | 'purple' | 'cosmic';

export interface ThemeColors {
    accent: string;
    accentGradient: [string, string];
    primaryText: string;
    secondaryText: string;
    background: string;
    success: string;
    shadow: string;
    // Nebula blob colours for each of the 4 background layers
    nebula: [string, string, string, string];
    // Whether this theme requires premium
    premium: boolean;
    // Star field settings (optional — defaults used if absent)
    starCount?: number;
    starMaxOpacity?: number;
    nebulaOverlay?: string; // rgba overlay on top of blobs
}

const themes: Record<ThemeType, ThemeColors> = {
    silver: {
        accent: '#e2e8f0',
        accentGradient: ['#e2e8f0', '#94a3b8'],
        primaryText: '#ffffff',
        secondaryText: '#94a3b8',
        background: '#010510',
        success: '#4ade80',
        shadow: 'rgba(226, 232, 240, 0.35)',
        nebula: [
            'rgba(99,  102, 241, 0.35)',   // indigo cloud — top right
            'rgba(148, 163, 184, 0.28)',   // cool slate — bottom left
            'rgba(186, 230, 253, 0.20)',   // icy blue — centre
            'rgba(56,  189, 248, 0.25)',   // crisp sky — bottom right
        ],
        premium: false,
        starCount: 160,
        starMaxOpacity: 0.55,
        nebulaOverlay: 'rgba(0,2,10,0.18)',
    },
    teal: {
        accent: '#22d3ee',
        accentGradient: ['#22d3ee', '#06b6d4'],
        primaryText: '#f0f9ff',
        secondaryText: '#67e8f9',
        background: '#00080f',
        success: '#4ade80',
        shadow: 'rgba(34, 211, 238, 0.45)',
        nebula: [
            'rgba(6,   182, 212, 0.45)',   // vivid cyan — top right
            'rgba(20,  184, 166, 0.38)',   // rich teal — bottom left
            'rgba(99,  102, 241, 0.22)',   // indigo depth — centre
            'rgba(34,  211, 238, 0.32)',   // electric aqua — bottom right
        ],
        premium: false,
        starCount: 155,
        starMaxOpacity: 0.52,
        nebulaOverlay: 'rgba(0,5,10,0.16)',
    },
    // ── Premium themes ────────────────────────────────────────────
    emerald: {
        accent: '#34d399',
        accentGradient: ['#34d399', '#10b981'],
        primaryText: '#ecfdf5',
        secondaryText: '#6ee7b7',
        background: '#000d06',
        success: '#4ade80',
        shadow: 'rgba(52, 211, 153, 0.45)',
        nebula: [
            'rgba(16,  185, 129, 0.42)',   // emerald glow — top right
            'rgba(6,   182, 212, 0.30)',   // teal shimmer — bottom left
            'rgba(52,  211, 153, 0.28)',   // mint haze — centre
            'rgba(5,   150, 105, 0.35)',   // deep forest — bottom right
        ],
        premium: true,
        starCount: 145,
        starMaxOpacity: 0.60,
        nebulaOverlay: 'rgba(0,5,2,0.16)',
    },
    gold: {
        accent: '#fbbf24',
        accentGradient: ['#fbbf24', '#f59e0b'],
        primaryText: '#fffbeb',
        secondaryText: '#fcd34d',
        background: '#0a0500',
        success: '#4ade80',
        shadow: 'rgba(251, 191, 36, 0.45)',
        nebula: [
            'rgba(251, 191, 36,  0.38)',   // amber fire — top right
            'rgba(249, 115, 22,  0.30)',   // orange ember — bottom left
            'rgba(234, 179, 8,   0.24)',   // golden haze — centre
            'rgba(217, 119, 6,   0.28)',   // deep amber — bottom right
        ],
        premium: true,
        starCount: 170,
        starMaxOpacity: 0.65,
        nebulaOverlay: 'rgba(8,3,0,0.14)',
    },
    rose: {
        accent: '#f472b6',
        accentGradient: ['#f472b6', '#ec4899'],
        primaryText: '#fff1f2',
        secondaryText: '#fda4af',
        background: '#0d0008',
        success: '#4ade80',
        shadow: 'rgba(244, 114, 182, 0.45)',
        nebula: [
            'rgba(244, 114, 182, 0.42)',   // hot rose — top right
            'rgba(236, 72,  153, 0.35)',   // deep pink — bottom left
            'rgba(168, 85,  247, 0.25)',   // violet bloom — centre
            'rgba(251, 113, 133, 0.30)',   // blush coral — bottom right
        ],
        premium: true,
        starCount: 150,
        starMaxOpacity: 0.58,
        nebulaOverlay: 'rgba(8,0,5,0.16)',
    },
    purple: {
        accent: '#a78bfa',
        accentGradient: ['#a78bfa', '#8b5cf6'],
        primaryText: '#f5f3ff',
        secondaryText: '#c4b5fd',
        background: '#04010e',
        success: '#4ade80',
        shadow: 'rgba(167, 139, 250, 0.45)',
        nebula: [
            'rgba(167, 139, 250, 0.48)',   // lavender — top right
            'rgba(139, 92,  246, 0.42)',   // rich violet — bottom left
            'rgba(79,  70,  229, 0.30)',   // deep indigo — centre
            'rgba(196, 181, 253, 0.22)',   // soft lilac — bottom right
        ],
        premium: true,
        starCount: 180,
        starMaxOpacity: 0.70,
        nebulaOverlay: 'rgba(2,0,8,0.15)',
    },
    cosmic: {
        accent: '#38bdf8',
        accentGradient: ['#38bdf8', '#818cf8'],
        primaryText: '#f0f9ff',
        secondaryText: '#93c5fd',
        background: '#00020a',
        success: '#34d399',
        shadow: 'rgba(56, 189, 248, 0.6)',
        nebula: [
            'rgba(56,  189, 248, 0.55)',   // bright cyan — top right
            'rgba(109, 40,  217, 0.50)',   // deep violet — bottom left
            'rgba(236, 72,  153, 0.32)',   // hot pink emission — centre
            'rgba(6,   182, 212, 0.38)',   // electric teal — bottom right
        ],
        premium: true,
        starCount: 220,
        starMaxOpacity: 0.85,
        nebulaOverlay: 'rgba(0,0,8,0.15)', // barely dims — lets colours breathe
    },
};

export const PREMIUM_THEMES: ThemeType[] = ['emerald', 'gold', 'rose', 'purple', 'cosmic'];

export const THEME_LABELS: Record<ThemeType, string> = {
    silver: 'Night Silver',
    teal: 'Ocean Teal',
    emerald: 'Emerald Night',
    gold: 'Desert Gold',
    rose: 'Rose Dusk',
    purple: 'Deep Purple',
    cosmic: 'Cosmic',
};

interface ThemeContextType {
    theme: ThemeType;
    colors: ThemeColors;
    setTheme: (theme: ThemeType) => void;
    userName: string;
    setUserName: (name: string) => void;
    darkMode: boolean;
    setDarkMode: (enabled: boolean) => void;
    // Dark-mode-aware card surface values — use these on every glass card
    cardBg: string;
    cardBorder: string;
    blurIntensity: number; // scale factor: multiply your per-card base intensity by this
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
    const [theme, setThemeState] = useState<ThemeType>('teal');
    const [userName, setUserNameState] = useState<string>('Servant');
    const [darkMode, setDarkModeState] = useState<boolean>(false);

    useEffect(() => {
        loadSettings();
    }, []);

    const loadSettings = async () => {
        try {
            const savedTheme = await AsyncStorage.getItem('app-theme');
            if (savedTheme && Object.keys(themes).includes(savedTheme)) {
                setThemeState(savedTheme as ThemeType);
            }

            const savedName = await AsyncStorage.getItem('user-name');
            if (savedName) setUserNameState(savedName);

            const savedDark = await AsyncStorage.getItem('dark-mode');
            if (savedDark === 'true') setDarkModeState(true);
        } catch (e) {
            console.error('Failed to load settings', e);
        }
    };

    const setTheme = async (newTheme: ThemeType) => {
        setThemeState(newTheme);
        await AsyncStorage.setItem('app-theme', newTheme);
    };

    const setUserName = async (newName: string) => {
        setUserNameState(newName);
        await AsyncStorage.setItem('user-name', newName);
    };

    const setDarkMode = async (enabled: boolean) => {
        setDarkModeState(enabled);
        await AsyncStorage.setItem('dark-mode', enabled ? 'true' : 'false');
    };

    // Computed dark-mode-aware surface values
    const cardBg = darkMode ? 'rgba(3, 5, 15, 0.93)' : 'rgba(10, 15, 35, 0.45)';
    const cardBorder = darkMode ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.10)';
    const blurIntensity = darkMode ? 0.25 : 1; // multiply base intensity by this

    return (
        <ThemeContext.Provider value={{ theme, colors: themes[theme], setTheme, userName, setUserName, darkMode, setDarkMode, cardBg, cardBorder, blurIntensity }}>
            {children}
        </ThemeContext.Provider>
    );
}

export function useTheme() {
    const context = useContext(ThemeContext);
    if (!context) {
        throw new Error('useTheme must be used within a ThemeProvider');
    }
    return context;
}
