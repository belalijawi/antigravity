import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type ThemeType = 'silver' | 'teal' | 'emerald' | 'gold' | 'rose' | 'purple';

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
}

const themes: Record<ThemeType, ThemeColors> = {
    silver: {
        accent: '#f1f5f9',
        accentGradient: ['#f1f5f9', '#cbd5e1'],
        primaryText: '#ffffff',
        secondaryText: '#94a3b8',
        background: '#020617',
        success: '#4ade80',
        shadow: 'rgba(241, 245, 249, 0.3)',
        nebula: [
            'rgba(79, 70, 229, 0.25)',
            'rgba(139, 92, 246, 0.2)',
            'rgba(236, 72, 153, 0.1)',
            'rgba(56, 189, 248, 0.15)',
        ],
        premium: false,
    },
    teal: {
        accent: '#22d3ee',
        accentGradient: ['#22d3ee', '#06b6d4'],
        primaryText: '#f0f9ff',
        secondaryText: '#94a3b8',
        background: '#020617',
        success: '#4ade80',
        shadow: 'rgba(34, 211, 238, 0.4)',
        nebula: [
            'rgba(6, 182, 212, 0.25)',
            'rgba(34, 211, 238, 0.18)',
            'rgba(99, 102, 241, 0.12)',
            'rgba(14, 165, 233, 0.15)',
        ],
        premium: false,
    },
    // ── Premium themes ────────────────────────────────────────────
    emerald: {
        accent: '#34d399',
        accentGradient: ['#34d399', '#10b981'],
        primaryText: '#ecfdf5',
        secondaryText: '#6ee7b7',
        background: '#020f09',
        success: '#4ade80',
        shadow: 'rgba(52, 211, 153, 0.4)',
        nebula: [
            'rgba(16, 185, 129, 0.25)',
            'rgba(6, 182, 212, 0.18)',
            'rgba(20, 184, 166, 0.12)',
            'rgba(52, 211, 153, 0.1)',
        ],
        premium: true,
    },
    gold: {
        accent: '#fbbf24',
        accentGradient: ['#fbbf24', '#f59e0b'],
        primaryText: '#fffbeb',
        secondaryText: '#fcd34d',
        background: '#0d0800',
        success: '#4ade80',
        shadow: 'rgba(251, 191, 36, 0.4)',
        nebula: [
            'rgba(251, 191, 36, 0.2)',
            'rgba(249, 115, 22, 0.15)',
            'rgba(234, 179, 8, 0.1)',
            'rgba(180, 83, 9, 0.12)',
        ],
        premium: true,
    },
    rose: {
        accent: '#f472b6',
        accentGradient: ['#f472b6', '#ec4899'],
        primaryText: '#fff1f2',
        secondaryText: '#fda4af',
        background: '#100008',
        success: '#4ade80',
        shadow: 'rgba(244, 114, 182, 0.4)',
        nebula: [
            'rgba(244, 114, 182, 0.25)',
            'rgba(236, 72, 153, 0.18)',
            'rgba(168, 85, 247, 0.12)',
            'rgba(251, 113, 133, 0.1)',
        ],
        premium: true,
    },
    purple: {
        accent: '#a78bfa',
        accentGradient: ['#a78bfa', '#8b5cf6'],
        primaryText: '#f5f3ff',
        secondaryText: '#c4b5fd',
        background: '#06020f',
        success: '#4ade80',
        shadow: 'rgba(167, 139, 250, 0.4)',
        nebula: [
            'rgba(167, 139, 250, 0.3)',
            'rgba(139, 92, 246, 0.22)',
            'rgba(79, 70, 229, 0.15)',
            'rgba(196, 181, 253, 0.08)',
        ],
        premium: true,
    },
};

export const PREMIUM_THEMES: ThemeType[] = ['emerald', 'gold', 'rose', 'purple'];

export const THEME_LABELS: Record<ThemeType, string> = {
    silver: 'Night Silver',
    teal: 'Ocean Teal',
    emerald: 'Emerald Night',
    gold: 'Desert Gold',
    rose: 'Rose Dusk',
    purple: 'Deep Purple',
};

interface ThemeContextType {
    theme: ThemeType;
    colors: ThemeColors;
    setTheme: (theme: ThemeType) => void;
    userName: string;
    setUserName: (name: string) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
    const [theme, setThemeState] = useState<ThemeType>('silver');
    const [userName, setUserNameState] = useState<string>('Servant');

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

    return (
        <ThemeContext.Provider value={{ theme, colors: themes[theme], setTheme, userName, setUserName }}>
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
