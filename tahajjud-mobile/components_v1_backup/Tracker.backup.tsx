import React, { useEffect, useState } from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { Trophy, CheckCircle } from "lucide-react-native";
import AsyncStorage from '@react-native-async-storage/async-storage';
import { subDays } from "date-fns";

export function Tracker() {
    const [streak, setStreak] = useState(0);
    const [history, setHistory] = useState<string[]>([]); // ISO date strings
    const [todayLogged, setTodayLogged] = useState(false);
    const [userName, setUserName] = useState<string | null>(null);

    useEffect(() => {
        loadHistory();
        loadUserName();
    }, []);

    const loadUserName = async () => {
        try {
            const name = await AsyncStorage.getItem('user-name');
            setUserName(name);
        } catch (e) {
            console.error('Failed to load user name', e);
        }
    };

    const loadHistory = async () => {
        try {
            const storedHistory = await AsyncStorage.getItem("tahajjud-tracker");
            if (storedHistory) {
                const parsed = JSON.parse(storedHistory);
                setHistory(parsed);
                calculateStreak(parsed);
                checkToday(parsed);
            }
        } catch (e) {
            console.error("Failed to load history", e);
        }
    };

    const saveHistory = async (newHistory: string[]) => {
        try {
            await AsyncStorage.setItem("tahajjud-tracker", JSON.stringify(newHistory));
        } catch (e) {
            console.error("Failed to save history", e);
        }
    }

    const calculateStreak = (dates: string[]) => {
        if (dates.length === 0) {
            setStreak(0);
            return;
        }

        const todayStr = new Date().toISOString().split('T')[0];
        const yesterdayStr = subDays(new Date(), 1).toISOString().split('T')[0];

        const hasToday = dates.some(d => d.split('T')[0] === todayStr);
        const hasYesterday = dates.some(d => d.split('T')[0] === yesterdayStr);

        if (!hasToday && !hasYesterday) {
            setStreak(0);
            return;
        }

        let checkDate = new Date();
        if (!hasToday) {
            checkDate = subDays(checkDate, 1);
        }

        let count = 0;
        while (true) {
            const str = checkDate.toISOString().split('T')[0];
            const found = dates.some(d => d.split('T')[0] === str);
            if (found) {
                count++;
                checkDate = subDays(checkDate, 1);
            } else {
                break;
            }
        }
        setStreak(count);
    };

    const checkToday = (dates: string[]) => {
        const todayStr = new Date().toISOString().split('T')[0];
        const found = dates.some(d => d.split('T')[0] === todayStr);
        setTodayLogged(found);
    }

    const toggleToday = () => {
        const today = new Date();
        const todayStr = today.toISOString().split('T')[0];

        let newHistory = [...history];

        if (todayLogged) {
            newHistory = newHistory.filter(d => d.split('T')[0] !== todayStr);
        } else {
            newHistory.push(today.toISOString());
        }

        setHistory(newHistory);
        saveHistory(newHistory);
        checkToday(newHistory);
        calculateStreak(newHistory);
    };

    return (
        <View className="w-full px-4 mb-10">
            <View className="w-full p-6 bg-white/5 border border-white/10 rounded-2xl">
                <View className="flex-row items-center justify-between mb-6">
                    <View className="flex-row items-center gap-2">
                        <Trophy size={20} color={streak > 0 ? "#facc15" : "#94a3b8"} />
                        <Text className="text-white font-semibold">
                            {userName ? `${userName}'s Streak` : 'Streak'}
                        </Text>
                    </View>
                    <View className="px-3 py-1 bg-primary/20 rounded-full">
                        <Text className="text-primary font-bold">{streak} Days</Text>
                    </View>
                </View>

                <TouchableOpacity
                    onPress={toggleToday}
                    className={`w-full py-4 rounded-xl flex-row items-center justify-center gap-3 border ${todayLogged
                        ? "bg-green-500/20 border-green-500/50"
                        : "bg-white/10 border-white/5"
                        }`}
                >
                    <CheckCircle size={20} color={todayLogged ? "#4ade80" : "#f8fafc"} />
                    <Text className={`font-medium ${todayLogged ? "text-green-400" : "text-white"}`}>
                        {todayLogged ? "Prayed Today" : "I Prayed Today"}
                    </Text>
                </TouchableOpacity>

                <Text className="text-xs text-center text-muted-foreground mt-4 italic">
                    "The most beloved deeds to Allah are those that are consistent, even if they are small."
                </Text>
            </View>
        </View>
    );
}
