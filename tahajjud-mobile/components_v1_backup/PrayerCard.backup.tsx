import React from "react";
import { View, Text } from "react-native";
import { Clock } from "lucide-react-native";

interface PrayerCardProps {
    name: string;
    time: string;
    isActive?: boolean;
    isNext?: boolean;
}

export function PrayerCard({ name, time, isActive, isNext }: PrayerCardProps) {
    return (
        <View
            className={`flex-col items-center justify-center p-4 rounded-xl border mb-2 w-[48%] ${isActive
                ? "bg-primary/20 border-primary/50"
                : "bg-white/5 border-white/10"
                } ${isNext ? "border-accent/50" : ""}`}
        >
            <View className="flex-row items-center gap-2 mb-2">
                <Clock
                    size={16}
                    color={isActive ? "#f8fafc" : "#94a3b8"}
                />
                <Text
                    className={`text-xs font-medium uppercase tracking-wider ${isActive ? "text-primary" : "text-muted-foreground"
                        }`}
                >
                    {name}
                </Text>
            </View>
            <Text className="text-2xl font-bold text-white">
                {time}
            </Text>
        </View>
    );
}
