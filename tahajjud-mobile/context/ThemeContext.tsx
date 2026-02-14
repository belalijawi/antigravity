import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { StatusBar } from 'react-native';

export type ThemeType = 'silver' | 'teal';

export interface ThemeColors {
    accent: string;
    accentGradient: [string, string];
    primaryText: string;
    secondaryText: string;
    background: string;
    success: string;
    shadow: string;
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
    },
    teal: {
        accent: '#22d3ee',
        accentGradient: ['#22d3ee', '#06b6d4'],
        primaryText: '#f0f9ff',
        secondaryText: '#94a3b8',
        background: '#020617',
        success: '#4ade80',
        shadow: 'rgba(34, 211, 238, 0.4)',
    },
};

interface ThemeContextType {
    theme: ThemeType;
    colors: ThemeColors;
    setTheme: (theme: ThemeType) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
    const [theme, setThemeState] = useState<ThemeType>('silver');

    useEffect(() => {
        loadTheme();
    }, []);

    const loadTheme = async () => {
        try {
            const savedTheme = await AsyncStorage.getItem('app-theme');
            if (savedTheme && Object.keys(themes).includes(savedTheme)) {
                setThemeState(savedTheme as ThemeType);
            } else {
                setThemeState('silver');
            }
        } catch (e) {
            console.error('Failed to load theme', e);
        }
    };

    const setTheme = async (newTheme: ThemeType) => {
        setThemeState(newTheme);
        await AsyncStorage.setItem('app-theme', newTheme);
    };

    return (
        <ThemeContext.Provider value={{ theme, colors: themes[theme], setTheme }}>
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
