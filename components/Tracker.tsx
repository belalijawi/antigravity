"use client";

import { useEffect, useState } from "react";
import { CheckCircle, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";
import { subDays } from "date-fns";

export function Tracker() {
    const [streak, setStreak] = useState(0);
    const [history, setHistory] = useState<string[]>([]); // ISO date strings
    const [todayLogged, setTodayLogged] = useState(false);

    const calculateStreak = (dates: string[]) => {
        if (dates.length === 0) {
            setStreak(0);
            return;
        }

        // Simple streak logic: consecutive days.
        // Note: Tahajjud is usually pre-dawn. If I log it at 4 AM, it's "today".
        const todayStr = new Date().toISOString().split('T')[0];
        const yesterdayStr = subDays(new Date(), 1).toISOString().split('T')[0];

        const hasToday = dates.some(d => d.split('T')[0] === todayStr);
        const hasYesterday = dates.some(d => d.split('T')[0] === yesterdayStr);

        if (!hasToday && !hasYesterday) {
            setStreak(0);
            return;
        }

        // Logic: Iterate back day by day
        let checkDate = new Date();
        // If today not logged but checking streak, start from yesterday
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

    useEffect(() => {
        // Deliberately deferred to an effect rather than a lazy useState
        // initializer: this component renders on the server first (no
        // "use client" opt-out of SSR here), and localStorage doesn't exist
        // there — reading it outside an effect would crash the server render.
        const storedHistory = localStorage.getItem("tahajjud-tracker");
        if (storedHistory) {
            const parsed = JSON.parse(storedHistory);
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setHistory(parsed);
            calculateStreak(parsed);
            checkToday(parsed);
        }
    }, []);

    const toggleToday = () => {
        const today = new Date();
        const todayStr = today.toISOString().split('T')[0];

        let newHistory = [...history];

        if (todayLogged) {
            // Remove today
            newHistory = newHistory.filter(d => d.split('T')[0] !== todayStr);
        } else {
            // Add today
            newHistory.push(today.toISOString());
        }

        setHistory(newHistory);
        localStorage.setItem("tahajjud-tracker", JSON.stringify(newHistory));
        checkToday(newHistory);
        calculateStreak(newHistory);
    };

    return (
        <div className="w-full max-w-sm mx-auto p-6 bg-white/5 border border-white/10 rounded-2xl backdrop-blur-md">
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                    <Trophy className={cn("w-5 h-5", streak > 0 ? "text-yellow-400" : "text-muted-foreground")} />
                    <span className="text-white font-semibold">Streak</span>
                </div>
                <div className="px-3 py-1 bg-primary/20 rounded-full text-primary font-mono font-bold">
                    {streak} Days
                </div>
            </div>

            <button
                onClick={toggleToday}
                className={cn(
                    "w-full py-4 rounded-xl flex items-center justify-center gap-3 transition-all duration-300 font-medium",
                    todayLogged
                        ? "bg-green-500/20 text-green-400 border border-green-500/50 hover:bg-green-500/30"
                        : "bg-white/10 text-white border border-white/5 hover:bg-white/20 hover:scale-[1.02]"
                )}
            >
                <CheckCircle className={cn("w-5 h-5", todayLogged ? "fill-green-400 text-green-950" : "")} />
                {todayLogged ? "Prayed Today" : "I Prayed Today"}
            </button>

            <p className="text-xs text-center text-muted-foreground mt-4">
                &ldquo;The most beloved deeds to Allah are those that are consistent, even if they are small.&rdquo;
            </p>
        </div>
    );
}
