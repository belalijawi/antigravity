import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { GlassBg as BlurView } from './GlassBg';
import { BookOpen, Sparkles, ChevronRight } from 'lucide-react-native';
import { useTheme } from '../context/ThemeContext';
import { QuranService } from '../services/QuranService';

// Curated list of reflective verses — rotates daily by day-of-year.
// All citations checked against Madinah Mushaf numbering.
const REFLECTIVE_VERSES: { surah: number; ayah: number }[] = [
    { surah: 2,  ayah: 286 }, // Allah does not burden a soul
    { surah: 94, ayah: 6   }, // With hardship comes ease
    { surah: 13, ayah: 28  }, // In the remembrance of Allah hearts find rest
    { surah: 65, ayah: 3   }, // Whoever puts trust in Allah, He is sufficient
    { surah: 2,  ayah: 152 }, // Remember Me, I will remember you
    { surah: 39, ayah: 53  }, // Do not despair of the mercy of Allah
    { surah: 50, ayah: 16  }, // Closer than the jugular vein
    { surah: 2,  ayah: 153 }, // Seek help through patience and prayer
    { surah: 3,  ayah: 173 }, // Sufficient for us is Allah
    { surah: 17, ayah: 80  }, // My Lord, cause me to enter and exit in truth
    { surah: 25, ayah: 70  }, // Allah will replace bad deeds with good
    { surah: 73, ayah: 8   }, // Remember the name of your Lord
    { surah: 76, ayah: 26  }, // Prostrate to Him and exalt Him long into the night
    { surah: 51, ayah: 17  }, // They used to sleep but little of the night
    { surah: 32, ayah: 16  }, // Their sides forsake their beds
    { surah: 17, ayah: 79  }, // Pray Tahajjud as additional for you
    { surah: 67, ayah: 1   }, // Blessed is He in whose hand is dominion
    { surah: 89, ayah: 27  }, // O reassured soul
];

// Friday-specific verses — surfaced when day.getDay() === 5. Rotates among
// these so consecutive Fridays don't show the same verse. All centered on
// Jumu'ah, Surah Al-Kahf, or the act of gathering for prayer.
const FRIDAY_VERSES: { surah: number; ayah: number }[] = [
    { surah: 62, ayah: 9  }, // "When prayer is called for on Friday, hasten to remembrance of Allah"
    { surah: 62, ayah: 10 }, // "When the prayer has ended, disperse and seek the bounty of Allah"
    { surah: 18, ayah: 10 }, // Surah Al-Kahf opening dua — "Our Lord, grant us mercy"
    { surah: 18, ayah: 24 }, // "Remember your Lord when you forget"
    { surah: 18, ayah: 28 }, // "Be patient with those who call upon their Lord morning and evening"
    { surah: 18, ayah: 110 }, // Al-Kahf closing verse — "Whoever hopes to meet his Lord, let him do righteous work"
];

interface DailyVerse {
    surah: number;
    ayah: number;
    arabic: string;
    translation: string;
    surahName: string;
}

interface Props {
    onOpenSurah?: (surahNumber: number, ayahNumber: number) => void;
}

export function VerseOfTheDay({ onOpenSurah }: Props) {
    const { colors } = useTheme();
    const [verse, setVerse] = useState<DailyVerse | null>(null);

    useEffect(() => {
        loadDailyVerse();
    }, []);

    const loadDailyVerse = async () => {
        try {
            // Pick verse by day-of-year — same verse for everyone on the same day.
            // On Fridays, override with a Friday-themed verse (Jumu'ah / Al-Kahf).
            const today = new Date();
            const start = new Date(today.getFullYear(), 0, 0);
            const diff = Date.now() - start.getTime();
            const dayOfYear = Math.floor(diff / 86400000);
            const isFriday = today.getDay() === 5;
            const pool = isFriday ? FRIDAY_VERSES : REFLECTIVE_VERSES;
            const pick = pool[dayOfYear % pool.length];

            const [arabicSurah, englishSurah] = await Promise.all([
                QuranService.getSurah(pick.surah, 'quran-uthmani'),
                QuranService.getSurah(pick.surah, 'en.sahih'),
            ]);
            if (!arabicSurah || !englishSurah) return;

            const arabicAyah = arabicSurah.ayahs.find(a => a.numberInSurah === pick.ayah);
            const englishAyah = englishSurah.ayahs.find(a => a.numberInSurah === pick.ayah);
            if (!arabicAyah || !englishAyah) return;

            setVerse({
                surah: pick.surah,
                ayah: pick.ayah,
                arabic: arabicAyah.text,
                translation: englishAyah.text,
                surahName: englishSurah.englishName,
            });
        } catch (e) {
            // Silent fail — verse-of-the-day is decorative, not critical
        }
    };

    if (!verse) {
        return (
            <View style={[styles.card, { borderColor: colors.accent + '20' }]}>
                <Text style={[styles.placeholder, { color: colors.secondaryText }]}>
                    Loading today's verse…
                </Text>
            </View>
        );
    }

    return (
        <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => onOpenSurah?.(verse.surah, verse.ayah)}
            style={[styles.card, { borderColor: colors.accent + '33' }]}
        >
            <LinearGradient
                colors={[colors.accent + '15', 'transparent']}
                style={StyleSheet.absoluteFill}
            />
            <BlurView intensity={15} tint="dark" style={StyleSheet.absoluteFill} />

            <View style={styles.headerRow}>
                <View style={[styles.iconWrap, { backgroundColor: colors.accent + '22', borderColor: colors.accent + '44' }]}>
                    <Sparkles size={12} color={colors.accent} />
                </View>
                <Text style={[styles.kicker, { color: colors.accent }]}>
                    {new Date().getDay() === 5 ? 'FRIDAY REFLECTION' : 'VERSE OF THE DAY'}
                </Text>
            </View>

            <Text style={styles.arabic} numberOfLines={3}>
                {verse.arabic}
            </Text>

            <Text style={[styles.translation, { color: colors.primaryText }]} numberOfLines={4}>
                {verse.translation}
            </Text>

            <View style={styles.footer}>
                <Text style={[styles.citation, { color: colors.secondaryText }]}>
                    {verse.surahName} {verse.surah}:{verse.ayah}
                </Text>
                <View style={styles.readMore}>
                    <Text style={[styles.readMoreText, { color: colors.accent }]}>Read in surah</Text>
                    <ChevronRight size={12} color={colors.accent} />
                </View>
            </View>
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    card: {
        marginHorizontal: 16,
        marginVertical: 8,
        borderRadius: 20,
        borderWidth: 1,
        padding: 18,
        overflow: 'hidden',
    },
    placeholder: { fontSize: 13, padding: 8, textAlign: 'center' },
    headerRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
    iconWrap: {
        width: 22, height: 22, borderRadius: 11, borderWidth: 1,
        alignItems: 'center', justifyContent: 'center',
    },
    kicker: { fontSize: 10, fontWeight: '800', letterSpacing: 1.5 },
    arabic: {
        fontSize: 22,
        lineHeight: 42,
        color: '#f1f5f9',
        textAlign: 'right',
        writingDirection: 'rtl',
        marginBottom: 12,
        // AmiriQuran is loaded in App.tsx — falls back to system if missing
        fontFamily: 'AmiriQuran',
    },
    translation: { fontSize: 14, lineHeight: 22, fontStyle: 'italic', marginBottom: 12 },
    footer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    citation: { fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },
    readMore: { flexDirection: 'row', alignItems: 'center', gap: 2 },
    readMoreText: { fontSize: 12, fontWeight: '700' },
});
