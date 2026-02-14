import React from "react";
import { View, Text } from "react-native";
import { BookOpen, Star, Heart } from "lucide-react-native";

function InfoCard({ title, icon, children }: { title: string, icon: React.ReactNode, children: React.ReactNode }) {
    return (
        <View className="bg-white/5 border border-white/10 rounded-2xl p-6 mb-4">
            <View className="flex-row items-center gap-3 mb-4">
                <View className="p-2 bg-primary/20 rounded-lg">
                    {icon}
                </View>
                <Text className="text-xl font-semibold text-white">{title}</Text>
            </View>
            <View>
                {children}
            </View>
        </View>
    );
}

export function EducationalContent() {
    return (
        <View className="w-full px-4 py-10">
            <View className="items-center mb-8">
                <Text className="text-3xl font-bold text-white mb-4 text-center">The Honor of the Believer</Text>
                <View className="h-1 w-20 bg-primary rounded-full" />
            </View>

            <InfoCard title="What is Tahajjud?" icon={<BookOpen size={24} color="#f8fafc" />}>
                <Text className="text-muted-foreground leading-6">
                    Tahajjud is a voluntary night prayer performed after sleeping. It is often called the "Prayer of the Night" (Qiyam al-Layl) but specifically refers to prayer after waking up from sleep.
                </Text>
            </InfoCard>

            <InfoCard title="Virtues" icon={<Star size={24} color="#f8fafc" />}>
                <Text className="text-muted-foreground leading-6">
                    "Adhere to night prayer... for it is the habit of the righteous before you, a means of drawing nearer to your Lord, an expiation for sins, and a deterrent from wrongdoing." (Tirmidhi)
                </Text>
            </InfoCard>

            <InfoCard title="How to Pray" icon={<Heart size={24} color="#f8fafc" />}>
                <Text className="text-muted-foreground leading-6 mb-1">• Make intention (Niyyah).</Text>
                <Text className="text-muted-foreground leading-6 mb-1">• Pray 2 rak'ahs at a time.</Text>
                <Text className="text-muted-foreground leading-6 mb-1">• It is recommended to pray Witr (odd number) as the last prayer of the night.</Text>
                <Text className="text-muted-foreground leading-6">• Best time: The last third of the night.</Text>
            </InfoCard>
        </View>
    );
}
