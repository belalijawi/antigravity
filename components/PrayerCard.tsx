import { cn } from "@/lib/utils";
import { Clock } from "lucide-react";

interface PrayerCardProps {
    name: string;
    time: string;
    isActive?: boolean;
    isNext?: boolean;
}

export function PrayerCard({ name, time, isActive, isNext }: PrayerCardProps) {
    return (
        <div className={cn(
            "flex flex-col items-center justify-center p-4 rounded-xl transition-all duration-300 backdrop-blur-md bg-white/5 border border-white/10",
            isActive && "bg-primary/20 border-primary/50 shadow-[0_0_15px_rgba(var(--primary),0.3)]",
            isNext && "border-accent/50 animate-pulse"
        )}>
            <div className="flex items-center gap-2 mb-2">
                <Clock className={cn("w-4 h-4", isActive ? "text-primary-foreground" : "text-muted-foreground")} />
                <span className={cn("text-xs font-medium uppercase tracking-wider", isActive ? "text-primary-foreground" : "text-muted-foreground")}>
                    {name}
                </span>
            </div>
            <span className="text-2xl font-bold font-mono tracking-tight">
                {time}
            </span>
        </div>
    );
}
