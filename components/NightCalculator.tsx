"use client";

import { useEffect, useState } from "react";
import { getPrayerTimes } from "@/lib/api";
import { calculateLastThird, NightCalculation, PrayerTimes } from "@/lib/prayer-times";
import { Loader2, Moon, Star } from "lucide-react";
import { PrayerCard } from "./PrayerCard";
import { format } from "date-fns";

export function NightCalculator() {
    const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
    const [prayerTimes, setPrayerTimes] = useState<PrayerTimes | null>(null);
    const [nightCalc, setNightCalc] = useState<NightCalculation | null>(null);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    const [currentTime, setCurrentTime] = useState<Date>(new Date());

    useEffect(() => {
        // Update time every minute
        const timer = setInterval(() => setCurrentTime(new Date()), 60000);
        return () => clearInterval(timer);
    }, []);

    useEffect(() => {
        if ("geolocation" in navigator) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    setLocation({
                        lat: position.coords.latitude,
                        lng: position.coords.longitude
                    });
                },
                (err) => {
                    console.error("Geolocation error:", err);
                    setError("Could not get location. Using default (Makkah).");
                    // Default to Makkah
                    setLocation({ lat: 21.4225, lng: 39.8262 });
                }
            );
        } else {
            setError("Geolocation not supported.");
            setLocation({ lat: 21.4225, lng: 39.8262 });
        }
    }, []);

    useEffect(() => {
        if (!location) return;

        async function fetchData() {
            setLoading(true);
            try {
                // Fetch for today
                const today = new Date();
                const times = await getPrayerTimes(location!.lat, location!.lng, today);
                setPrayerTimes(times);

                // Fetch for tomorrow to get tomorrow's Fajr for accurate calculation if needed
                // But simplified logic in calculateLastThird handles Fajr < Maghrib assumption or direct inputs.
                // However, Maghrib is today, Fajr is tomorrow.
                // Our API returns Fajr for "today".
                // If it's night (post Maghrib), we need today's Maghrib and *Tomorrow's* Fajr.
                // If it's day (pre Maghrib), we wait for today's Maghrib.

                // Let's get tomorrow's times too to be safe.
                const tomorrow = new Date(today);
                tomorrow.setDate(tomorrow.getDate() + 1);
                const tomorrowTimes = await getPrayerTimes(location!.lat, location!.lng, tomorrow);

                // Determine relevant Maghrib and Fajr
                // If now > Maghrib (Today), then Night Start = Maghrib (Today), Night End = Fajr (Tomorrow)
                // If now < Maghrib (Today), then Night Start = Maghrib (Today), Night End = Fajr (Tomorrow) 
                // Wait, logic is: Night is always Maghrib(N) to Fajr(N+1).
                // We show calculation for the *upcoming* or *current* night.

                const maghribToday = times.maghrib;
                const fajrTomorrow = tomorrowTimes.fajr;

                const calc = calculateLastThird(maghribToday, fajrTomorrow);
                setNightCalc(calc);

            } catch (err) {
                console.error(err);
                setError("Failed to load prayer times");
            } finally {
                setLoading(false);
            }
        }

        fetchData();
    }, [location]);

    if (loading) {
        return (
            <div className="flex h-[50vh] flex-col items-center justify-center gap-4">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-muted-foreground animate-pulse">Seeking the stars...</p>
            </div>
        );
    }

    if (error && !prayerTimes) {
        return (
            <div className="flex h-[50vh] flex-col items-center justify-center text-destructive">
                <p>{error}</p>
            </div>
        );
    }

    if (!nightCalc || !prayerTimes) return null;

    const lastThirdTime = format(nightCalc.lastThirdStart, "h:mm a");
    const isLastThirdNow = currentTime >= nightCalc.lastThirdStart && currentTime < nightCalc.nightEnd;

    return (
        <div className="flex flex-col items-center w-full max-w-4xl px-4 animate-in fade-in duration-1000 slide-in-from-bottom-5">
            {/* Hero Section */}
            <div className="relative flex flex-col items-center text-center py-12 md:py-20">
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-64 bg-primary/20 blur-[100px] rounded-full pointer-events-none" />

                <div className="relative">
                    <Moon className="w-16 h-16 text-primary mb-6 mx-auto drop-shadow-[0_0_15px_rgba(var(--primary),0.5)]" />
                    {isLastThirdNow && (
                        <div className="absolute -top-2 -right-2">
                            <Star className="w-6 h-6 text-yellow-400 animate-pulse fill-yellow-400" />
                        </div>
                    )}
                </div>

                <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight bg-gradient-to-b from-white to-white/70 bg-clip-text text-transparent mb-4">
                    The Last Third
                </h1>

                <div className="flex flex-col items-center gap-2 mt-4">
                    <p className="text-lg md:text-xl text-muted-foreground font-light">
                        Begins at
                    </p>
                    <div className="text-5xl md:text-7xl font-mono font-bold text-white drop-shadow-2xl">
                        {lastThirdTime}
                    </div>
                    <p className="text-sm text-muted-foreground mt-2">
                        {format(nightCalc.nightStart, "h:mm a")} (Maghrib) — {format(nightCalc.nightEnd, "h:mm a")} (Fajr)
                    </p>
                </div>
            </div>

            {/* Prayer Times Grid */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 w-full mt-12">
                <PrayerCard name="Fajr" time={format(prayerTimes.fajr, "h:mm a")} isNext={false} />
                <PrayerCard name="Dhuhr" time={format(prayerTimes.dhuhr, "h:mm a")} />
                <PrayerCard name="Asr" time={format(prayerTimes.asr, "h:mm a")} />
                <PrayerCard name="Maghrib" time={format(prayerTimes.maghrib, "h:mm a")} />
                <PrayerCard name="Isha" time={format(prayerTimes.isha, "h:mm a")} />
                {/* Sunrise is optional but good for context */}
                <PrayerCard name="Sunrise" time={format(prayerTimes.sunrise, "h:mm a")} />
            </div>

            {/* Educational / Motivational Quote */}
            <div className="mt-20 max-w-2xl text-center">
                <blockquote className="text-xl italic font-serif text-white/80 leading-relaxed border-l-4 border-primary/50 pl-6 py-2 bg-white/5 rounded-r-lg">
                    &ldquo;The Lord descends every night to the lowest heaven when the last third of the night remains...&rdquo;
                </blockquote>
                <p className="text-right text-sm text-muted-foreground mt-2">— Sahih Al-Bukhari</p>
            </div>
        </div>
    );
}
