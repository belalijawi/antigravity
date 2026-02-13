import { BookOpen, Star, Heart } from "lucide-react";
import { cn } from "@/lib/utils";

function InfoCard({ title, icon, children }: { title: string, icon: React.ReactNode, children: React.ReactNode }) {
    return (
        <div className="bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-sm hover:bg-white/10 transition-colors">
            <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-primary/20 rounded-lg text-primary">
                    {icon}
                </div>
                <h3 className="text-xl font-semibold text-white">{title}</h3>
            </div>
            <div className="text-muted-foreground leading-relaxed space-y-2">
                {children}
            </div>
        </div>
    );
}

export function EducationalContent() {
    return (
        <div className="w-full max-w-5xl px-4 py-20 animate-in fade-in duration-1000 slide-in-from-bottom-10 delay-300">
            <div className="text-center mb-12">
                <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">The Honor of the Believer</h2>
                <div className="h-1 w-20 bg-primary mx-auto rounded-full" />
            </div>

            <div className="grid md:grid-cols-3 gap-6">
                <InfoCard title="What is Tahajjud?" icon={<BookOpen className="w-6 h-6" />}>
                    <p>
                        Tahajjud is a voluntary night prayer performed after sleeping. It is often called the "Prayer of the Night" (Qiyam al-Layl) but specifically refers to prayer after waking up from sleep.
                    </p>
                </InfoCard>

                <InfoCard title="Virtues" icon={<Star className="w-6 h-6" />}>
                    <p>
                        "Adhere to night prayer... for it is the habit of the righteous before you, a means of drawing nearer to your Lord, an expiation for sins, and a deterrent from wrongdoing." (Tirmidhi)
                    </p>
                </InfoCard>

                <InfoCard title="How to Pray" icon={<Heart className="w-6 h-6" />}>
                    <ul className="list-disc list-inside space-y-1">
                        <li>Make intention (Niyyah).</li>
                        <li>Pray 2 rak'ahs at a time.</li>
                        <li>It is recommended to pray Witr (odd number) as the last prayer of the night.</li>
                        <li>Best time: The last third of the night.</li>
                    </ul>
                </InfoCard>
            </div>
        </div>
    );
}
