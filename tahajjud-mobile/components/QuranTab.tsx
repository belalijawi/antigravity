import * as React from 'react';
import { useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity, ActivityIndicator, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { QuranService, SurahMeta } from '../services/QuranService';
import { SurahReader } from './SurahReader';
import { Search, Bookmark, BookOpen } from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useTheme } from '../context/ThemeContext';
import { tabletContentStyle } from '../utils/layout';

export function QuranTab() {
    const { colors } = useTheme();
    const [surahs, setSurahs] = useState<SurahMeta[]>([]);
    const [filteredSurahs, setFilteredSurahs] = useState<SurahMeta[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedSurah, setSelectedSurah] = useState<number | null>(null);
    const [bookmark, setBookmark] = useState<{ surahNumber: number, edition: string, surahName: string, ayahNumber?: number } | null>(null);
    const [currentEdition, setCurrentEdition] = useState('en.sahih');

    useEffect(() => {
        loadList();
        loadBookmark();
    }, []);

    const loadBookmark = async () => {
        try {
            const saved = await AsyncStorage.getItem('quran_last_read');
            if (saved) {
                const parsed = JSON.parse(saved);
                if (parsed && typeof parsed === 'object' && parsed.surahNumber) {
                    setBookmark(parsed);
                }
            }
        } catch (e) {
            console.error('Error loading bookmark:', e);
            setBookmark(null);
        }
    };

    const loadList = async () => {
        const list = await QuranService.getSurahList();
        setSurahs(list);
        setFilteredSurahs(list);
        setLoading(false);
    };

    const handleSearch = (text: string) => {
        setSearchQuery(text);
        if (text) {
            const filtered = surahs.filter(s =>
                s.englishName.toLowerCase().includes(text.toLowerCase()) ||
                s.englishNameTranslation.toLowerCase().includes(text.toLowerCase())
            );
            setFilteredSurahs(filtered);
        } else {
            setFilteredSurahs(surahs);
        }
    };

    if (selectedSurah) {
        return (
            <SurahReader
                surahNumber={selectedSurah}
                edition={currentEdition}
                onEditionChange={setCurrentEdition}
                onClose={() => {
                    setSelectedSurah(null);
                    loadBookmark();
                }}
            />
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            <View style={[{ flex: 1 }, tabletContentStyle()]}>
                <View style={styles.header}>
                    <Text style={[styles.title, { color: colors.accent }]}>The Holy Quran</Text>
                    <Text style={styles.subtitle}>Guidance for the heart</Text>
                </View>

                {bookmark && !searchQuery && (
                    <Animated.View
                        entering={FadeInDown.duration(800)}
                        style={styles.bookmarkWrapper}
                    >
                        <TouchableOpacity
                            style={styles.bookmarkCard}
                            onPress={() => {
                                if (bookmark) {
                                    setCurrentEdition(bookmark.edition);
                                    setSelectedSurah(bookmark.surahNumber);
                                }
                            }}
                        >
                            <BlurView intensity={20} tint="dark" style={StyleSheet.absoluteFill} />
                            <LinearGradient
                                colors={['rgba(248, 250, 252, 0.15)', 'transparent']}
                                style={StyleSheet.absoluteFill}
                            />
                            <View style={styles.bookmarkIconContainer}>
                                <BookOpen color={colors.primaryText} size={24} strokeWidth={2} />
                            </View>
                            <View style={styles.bookmarkContent}>
                                <Text style={styles.bookmarkLabel}>RESUME ASCENT</Text>
                                <Text style={[styles.bookmarkSurah, { color: colors.primaryText }]}>
                                    {bookmark.surahName} {bookmark.ayahNumber ? `• v${bookmark.ayahNumber}` : ''}
                                </Text>
                            </View>
                            <Bookmark color="#22d3ee" size={20} fill="#22d3ee" />
                        </TouchableOpacity>
                    </Animated.View>
                )}

                <View style={styles.searchContainer}>
                    <BlurView intensity={10} tint="dark" style={StyleSheet.absoluteFill} />
                    <Search color="#94a3b8" size={20} />
                    <TextInput
                        style={styles.input}
                        placeholder="Search by Name or Theme..."
                        placeholderTextColor="rgba(255, 255, 255, 0.2)"
                        value={searchQuery}
                        onChangeText={handleSearch}
                    />
                </View>

                {loading ? (
                    <ActivityIndicator size="large" color="#f8fafc" style={{ marginTop: 50 }} />
                ) : (
                    <FlatList
                        data={filteredSurahs}
                        keyExtractor={(item) => item.number.toString()}
                        contentContainerStyle={styles.listContent}
                        showsVerticalScrollIndicator={false}
                        renderItem={({ item }) => (
                            <TouchableOpacity
                                style={styles.card}
                                onPress={() => setSelectedSurah(item.number)}
                            >
                                <BlurView intensity={15} tint="dark" style={StyleSheet.absoluteFill} />
                                <LinearGradient
                                    colors={['rgba(255, 255, 255, 0.05)', 'transparent']}
                                    style={StyleSheet.absoluteFill}
                                />

                                <View style={styles.cardMain}>
                                    <View style={styles.numberBadge}>
                                        <Text style={styles.numberText}>{item.number}</Text>
                                    </View>
                                    <View style={styles.cardTextGroup}>
                                        <Text style={styles.surahName}>{item.englishName}</Text>
                                        <Text style={styles.surahTranslation}>{item.englishNameTranslation}</Text>
                                    </View>
                                    <View style={styles.cardEndGroup}>
                                        <Text style={styles.ayahCount}>{item.numberOfAyahs} v.</Text>
                                        <Text style={styles.revelationType}>{item.revelationType}</Text>
                                    </View>
                                </View>
                            </TouchableOpacity>
                        )}
                    />
                )}
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: 'transparent',
    },
    header: {
        paddingTop: 32,
        paddingHorizontal: 24,
        paddingBottom: 24,
    },
    title: {
        fontSize: 32,
        fontWeight: '900',
        color: '#facc15',
        letterSpacing: -1,
    },
    subtitle: {
        fontSize: 15,
        color: '#94a3b8',
        fontWeight: '600',
        marginTop: 4,
    },
    bookmarkWrapper: {
        paddingHorizontal: 20,
        marginBottom: 24,
    },
    bookmarkCard: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 20,
        borderRadius: 24,
        borderWidth: 1,
        borderColor: 'rgba(248, 250, 252, 0.3)',
        overflow: 'hidden',
    },
    bookmarkIconContainer: {
        width: 52,
        height: 52,
        borderRadius: 26,
        backgroundColor: 'rgba(248, 250, 252, 0.05)',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 16,
        borderWidth: 1,
        borderColor: 'rgba(248, 250, 252, 0.1)',
    },
    bookmarkContent: {
        flex: 1,
    },
    bookmarkLabel: {
        color: '#cbd5e1',
        fontSize: 11,
        fontWeight: '900',
        letterSpacing: 1.5,
    },
    bookmarkSurah: {
        color: '#f8fafc',
        fontSize: 20,
        fontWeight: '800',
        marginTop: 2,
    },
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginHorizontal: 20,
        marginBottom: 24,
        paddingHorizontal: 20,
        height: 56,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.08)',
        overflow: 'hidden',
        backgroundColor: 'rgba(255, 255, 255, 0.02)',
    },
    input: {
        flex: 1,
        color: '#ffffff',
        marginLeft: 14,
        fontSize: 16,
        fontWeight: '600',
    },
    listContent: {
        paddingHorizontal: 20,
        paddingBottom: 130,
    },
    card: {
        borderRadius: 20,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.06)',
        overflow: 'hidden',
        height: 84,
        justifyContent: 'center',
    },
    cardMain: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
    },
    numberBadge: {
        width: 44,
        height: 44,
        borderRadius: 14,
        backgroundColor: 'rgba(255, 255, 255, 0.03)',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 16,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.05)',
    },
    numberText: {
        color: '#cbd5e1',
        fontWeight: '900',
        fontSize: 15,
    },
    cardTextGroup: {
        flex: 1,
    },
    surahName: {
        color: '#f8fafc',
        fontSize: 17,
        fontWeight: '800',
    },
    surahTranslation: {
        color: '#94a3b8',
        fontSize: 13,
        fontWeight: '600',
        marginTop: 2,
    },
    cardEndGroup: {
        alignItems: 'flex-end',
    },
    ayahCount: {
        color: '#cbd5e1',
        fontSize: 12,
        fontWeight: '900',
    },
    revelationType: {
        color: '#475569',
        fontSize: 10,
        fontWeight: '900',
        textTransform: 'uppercase',
        marginTop: 4,
        letterSpacing: 0.5,
    }
});
