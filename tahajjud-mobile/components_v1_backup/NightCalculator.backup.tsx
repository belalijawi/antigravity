import React, { useEffect, useState } from "react";
import { View, Text, ActivityIndicator } from "react-native";
import * as Location from "expo-location";
import { getPrayerTimes } from "../lib/api";
import { calculateLastThird, NightCalculation, PrayerTimes } from "../lib/prayer-times";
import { Star, Moon } from "lucide-react-native";
import { PrayerCard } from "./PrayerCard";
import { format } from "date-fns";

export function NightCalculator() {
    const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
    const [prayerTimes, setPrayerTimes] = useState<PrayerTimes | null>(null);
    const [nightCalc, setNightCalc] = useState<NightCalculation | null>(null);
    const [loading, setLoading] = useState<boolean>(true);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const [currentTime, setCurrentTime] = useState<Date>(new Date());

    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 60000);
        return () => clearInterval(timer);
    }, []);

    useEffect(() => {
        (async () => {
            let { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
                setErrorMsg('Permission to access location was denied. Using Makkah.');
                setLocation({ lat: 21.4225, lng: 39.8262 });
                return;
            }

            let location = await Location.getCurrentPositionAsync({});
            setLocation({
                lat: location.coords.latitude,
                lng: location.coords.longitude
            });
        })();
    }, []);

    useEffect(() => {
        if (!location) return;

        async function fetchData() {
            setLoading(true);
            try {
                const today = new Date();
                const times = await getPrayerTimes(location!.lat, location!.lng, today);
                setPrayerTimes(times);

                const tomorrow = new Date(today);
                tomorrow.setDate(tomorrow.getDate() + 1);
                const tomorrowTimes = await getPrayerTimes(location!.lat, location!.lng, tomorrow);

                const maghribToday = times.maghrib;
                const fajrTomorrow = tomorrowTimes.fajr;

                const calc = calculateLastThird(maghribToday, fajrTomorrow);
                setNightCalc(calc);

            } catch (err) {
                console.error(err);
                setErrorMsg("Failed to load prayer times");
            } finally {
                setLoading(false);
            }
        }

        fetchData();
    }, [location]);

    if (loading) {
        return (
            <View className="flex-1 items-center justify-center">
                <ActivityIndicator size="large" color="#f8fafc" />
                <Text className="text-muted-foreground mt-4">Seeking the stars...</Text>
            </View>
        );
    }

    if (errorMsg && !prayerTimes) {
        return (
            <View className="flex-1 items-center justify-center">
                <Text className="text-red-500">{errorMsg}</Text>
            </View>
        );
    }

    if (!nightCalc || !prayerTimes) return null;

    const lastThirdTime = format(nightCalc.lastThirdStart, "h:mm a");
    const isLastThirdNow = currentTime >= nightCalc.lastThirdStart && currentTime < nightCalc.nightEnd;

    return (
        <View className="w-full flex-col items-center">
            {/* Hero Section */}
            <View className="items-center py-10 w-full">
                <View className="relative mb-6">
                    <Moon size={64} color="#f8fafc" />
                    {isLastThirdNow && (
                        <View className="absolute -top-2 -right-2">
                            <Star size={24} color="#facc15" fill="#facc15" />
                        </View>
                    )}
                </View>

                <Text className="text-4xl font-bold text-white mb-2 text-center">
                    The Last Third
                </Text>

                <Text className="text-lg text-muted-foreground font-light mb-2">
                    Begins at
                </Text>

                <Text className="text-5xl font-bold text-white mb-4">
                    {lastThirdTime}
                </Text>

                <Text className="text-sm text-muted-foreground">
                    {format(nightCalc.nightStart, "h:mm a")} (Maghrib) — {format(nightCalc.nightEnd, "h:mm a")} (Fajr)
                </Text>
            </View>

            {/* Prayer Times Grid */}
            <View className="flex-row flex-wrap justify-between w-full px-4">
                <PrayerCard name="Fajr" time={format(prayerTimes.fajr, "h:mm a")} />
                <PrayerCard name="Dhuhr" time={format(prayerTimes.dhuhr, "h:mm a")} />
                <PrayerCard name="Asr" time={format(prayerTimes.asr, "h:mm a")} />
                <PrayerCard name="Maghrib" time={format(prayerTimes.maghrib, "h:mm a")} />
                <PrayerCard name="Isha" time={format(prayerTimes.isha, "h:mm a")} />
                <PrayerCard name="Sunrise" time={format(prayerTimes.sunrise, "h:mm a")} />
            </View>

            {/* Quote */}
            <View className="mt-10 px-6 w-full">
                <Text className="text-lg italic text-white/80 text-center leading-8 border-l-4 border-white/20 pl-4">
                    "The Lord descends every night to the lowest heaven when the last third of the night remains..."
                </Text>
                <Text className="text-right text-xs text-muted-foreground mt-2">— Sahih Al-Bukhari</Text>
            </View>
        </View>
    );
}
