import * as React from 'react';
import { useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity, ActivityIndicator, TextInput, SafeAreaView } from 'react-native';
import { QuranService, SurahMeta } from '../services/QuranService';
import { SurahReader } from './SurahReader';
import { Search, Bookmark, BookOpen } from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

export function QuranTab() {
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
                    loadBookmark(); // Refresh bookmark when closing reader
                }}
            />
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.title}>The Noble Quran</Text>
                <Text style={styles.subtitle}>Read and Reflect during the Night</Text>
            </View>

            {bookmark && !searchQuery && (
                <View style={styles.bookmarkWrapper}>
                    <TouchableOpacity
                        style={styles.bookmarkCard}
                        onPress={() => {
                            if (bookmark) {
                                setCurrentEdition(bookmark.edition);
                                setSelectedSurah(bookmark.surahNumber);
                            }
                        }}
                    >
                        <View style={styles.bookmarkIconContainer}>
                            <BookOpen color="#facc15" size={24} />
                        </View>
                        <View style={styles.bookmarkContent}>
                            <Text style={styles.bookmarkLabel}>CONTINUE READING</Text>
                            <Text style={styles.bookmarkSurah}>
                                {bookmark.surahName} {bookmark.ayahNumber ? `• Verse ${bookmark.ayahNumber}` : ''}
                            </Text>
                        </View>
                        <Bookmark color="#facc15" size={20} fill="#facc15" />
                    </TouchableOpacity>
                </View>
            )}

            <View style={styles.searchContainer}>
                <Search color="#64748b" size={20} />
                <TextInput
                    style={styles.input}
                    placeholder="Search Surah..."
                    placeholderTextColor="#64748b"
                    value={searchQuery}
                    onChangeText={handleSearch}
                />
            </View>

            {loading ? (
                <ActivityIndicator size="large" color="#facc15" style={{ marginTop: 50 }} />
            ) : (
                <FlatList
                    data={filteredSurahs}
                    keyExtractor={(item) => item.number.toString()}
                    contentContainerStyle={styles.listContent}
                    renderItem={({ item }) => (
                        <TouchableOpacity
                            style={styles.card}
                            onPress={() => setSelectedSurah(item.number)}
                        >
                            <View style={styles.numberBadge}>
                                <Text style={styles.numberText}>{item.number}</Text>
                            </View>
                            <View style={styles.cardContent}>
                                <Text style={styles.surahName}>{item.englishName}</Text>
                                <Text style={styles.surahTranslation}>{item.englishNameTranslation}</Text>
                            </View>
                            <View>
                                <Text style={styles.ayahCount}>{item.numberOfAyahs} Ayahs</Text>
                                <Text style={styles.revelationType}>{item.revelationType}</Text>
                            </View>
                        </TouchableOpacity>
                    )}
                />
            )}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#020617',
    },
    header: {
        padding: 20,
        paddingTop: 40,
    },
    title: {
        color: '#fff',
        fontSize: 28,
        fontWeight: 'bold',
    },
    subtitle: {
        color: '#94a3b8',
        fontSize: 14,
        marginTop: 4,
    },
    bookmarkWrapper: {
        paddingHorizontal: 20,
        marginBottom: 20,
    },
    bookmarkCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(250, 204, 21, 0.1)',
        padding: 16,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: 'rgba(250, 204, 21, 0.3)',
    },
    bookmarkIconContainer: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: 'rgba(250, 204, 21, 0.2)',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 16,
    },
    bookmarkContent: {
        flex: 1,
    },
    bookmarkLabel: {
        color: '#facc15',
        fontSize: 10,
        fontWeight: 'bold',
        letterSpacing: 1,
    },
    bookmarkSurah: {
        color: '#fff',
        fontSize: 18,
        fontWeight: 'bold',
        marginTop: 2,
    },
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#1e293b',
        marginHorizontal: 20,
        marginBottom: 20,
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderRadius: 12,
    },
    input: {
        flex: 1,
        color: '#fff',
        marginLeft: 12,
        fontSize: 16,
    },
    listContent: {
        paddingHorizontal: 20,
        paddingBottom: 40,
    },
    card: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#0f172a',
        padding: 16,
        borderRadius: 12,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: '#1e293b',
    },
    numberBadge: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#1e293b',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 16,
    },
    numberText: {
        color: '#facc15',
        fontWeight: 'bold',
    },
    cardContent: {
        flex: 1,
    },
    surahName: {
        color: '#fff',
        fontSize: 16,
        fontWeight: 'bold',
    },
    surahTranslation: {
        color: '#94a3b8',
        fontSize: 12,
    },
    ayahCount: {
        color: '#64748b',
        fontSize: 12,
        textAlign: 'right',
    },
    revelationType: {
        color: '#475569',
        fontSize: 10,
        textAlign: 'right',
        textTransform: 'uppercase',
        marginTop: 2,
    }
});
