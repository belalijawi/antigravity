import * as React from 'react';
import { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity, Modal, FlatList, SafeAreaView, ViewToken, Pressable } from 'react-native';
import { ArrowLeft, Globe, X, Check, Bookmark } from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { QuranService, SurahDetail, Edition } from '../services/QuranService';

interface Props {
    surahNumber: number;
    edition?: string;
    onEditionChange: (edition: string) => void;
    onClose: () => void;
}

const LANGUAGE_MAP: Record<string, string> = {
    'en': 'English',
    'fr': 'French',
    'es': 'Spanish',
    'ur': 'Urdu',
    'ar': 'Arabic',
    'id': 'Indonesian',
    'tr': 'Turkish',
    'ru': 'Russian',
    'de': 'German',
    'it': 'Italian',
    'pt': 'Portuguese',
    'bn': 'Bengali',
    'hi': 'Hindi',
    'zh': 'Chinese',
    'ja': 'Japanese',
    'fa': 'Persian',
    'sw': 'Swahili',
    'ha': 'Hausa',
    'nl': 'Dutch',
    'sv': 'Swedish',
    'no': 'Norwegian',
    'fi': 'Finnish',
    'da': 'Danish',
    'pl': 'Polish',
    'cs': 'Czech',
    'sk': 'Slovak',
    'hu': 'Hungarian',
    'ro': 'Romanian',
    'bg': 'Bulgarian',
    'el': 'Greek',
    'he': 'Hebrew',
    'th': 'Thai',
    'ko': 'Korean',
    'vi': 'Vietnamese',
    'ms': 'Malay',
    'ta': 'Tamil',
    'ml': 'Malayalam',
    'kn': 'Kannada',
    'te': 'Telugu',
    'mr': 'Marathi',
    'gu': 'Gujarati',
    'pa': 'Punjabi',
    'sq': 'Albanian',
    'az': 'Azerbaijani',
    'bs': 'Bosnian',
    'uz': 'Uzbek'
};

const VERIFIED_EDITIONS = [
    { identifier: 'en.khattab', displayName: 'English', subName: 'The Clear Quran (Dr. Mustafa Khattab)', isPremium: true },
    { identifier: 'en.sahih', displayName: 'English', subName: 'Sahih International', isPremium: true },
    { identifier: 'quran-uthmani', displayName: 'Arabic', subName: 'Original Text', isPremium: true },
    { identifier: 'ar.muyassar', displayName: 'Arabic', subName: 'Tafsir Al-Muyassar', isPremium: true },
    { identifier: 'fr.hamidullah', displayName: 'French', subName: 'Muhammad Hamidullah', isPremium: true },
    { identifier: 'es.cortes', displayName: 'Spanish', subName: 'Julio Cortes', isPremium: true },
    { identifier: 'de.bubenheim', displayName: 'German', subName: 'Bubenheim & Elyas', isPremium: true },
    { identifier: 'ru.kuliev', displayName: 'Russian', subName: 'Elmir Kuliev', isPremium: true },
    { identifier: 'ur.jalandhry', displayName: 'Urdu', subName: 'Fateh Muhammad Jalandhry', isPremium: true },
    { identifier: 'bn.bengali', displayName: 'Bengali', subName: 'Muhiuddin Khan', isPremium: true },
    { identifier: 'id.indonesian', displayName: 'Indonesian', subName: 'Bahasa Indonesia', isPremium: true },
    { identifier: 'tr.diyanet', displayName: 'Turkish', subName: 'Diyanet Isleri', isPremium: true },
    { identifier: 'hi.hindi', displayName: 'Hindi', subName: 'Farooq Khan & Nadwi', isPremium: true },
    { identifier: 'zh.jian', displayName: 'Chinese', subName: 'Ma Jian', isPremium: true },
    { identifier: 'it.piccardo', displayName: 'Italian', subName: 'Hamza Roberto Piccardo', isPremium: true },
    { identifier: 'pt.elhayek', displayName: 'Portuguese', subName: 'Samir El-Hayek', isPremium: true },
    { identifier: 'ja.japanese', displayName: 'Japanese', subName: 'Ryoichi Mita', isPremium: true },
];

export function SurahReader({ surahNumber, edition = 'en.sahih', onEditionChange, onClose }: Props) {
    const [surah, setSurah] = useState<SurahDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [modalVisible, setModalVisible] = useState(false);
    const flatListRef = useRef<FlatList>(null);
    const [initialScrollDone, setInitialScrollDone] = useState(false);
    const [bookmarkedAyah, setBookmarkedAyah] = useState<number | null>(null);
    const lastReadAyahRef = useRef<number>(1);

    useEffect(() => {
        loadSurah();
    }, [surahNumber, edition]);

    const loadSurah = async () => {
        setLoading(true);
        setInitialScrollDone(false);
        const data = await QuranService.getSurah(surahNumber, edition);
        if (data) {
            setSurah(data);

            // Load specific bookmark for this surah/ayah if exists
            try {
                const saved = await AsyncStorage.getItem('quran_last_read');
                if (saved) {
                    const bookmark = JSON.parse(saved);
                    if (bookmark.surahNumber === surahNumber) {
                        lastReadAyahRef.current = bookmark.ayahNumber || 1;
                        setBookmarkedAyah(bookmark.ayahNumber || null);
                    }
                }
            } catch (e) {
                console.error('Error loading ayah bookmark:', e);
            }
        }
        setLoading(false);
    };

    // Auto-scroll when data is ready
    useEffect(() => {
        if (!loading && surah && !initialScrollDone && flatListRef.current) {
            const index = lastReadAyahRef.current - 1;
            if (index > 0) {
                setTimeout(() => {
                    flatListRef.current?.scrollToIndex({
                        index,
                        animated: false,
                        viewPosition: 0
                    });
                }, 100);
            }
            setInitialScrollDone(true);
        }
    }, [loading, surah, initialScrollDone]);

    const saveBookmark = async (ayahNumber: number) => {
        if (!surah) return;
        setBookmarkedAyah(ayahNumber);
        try {
            const bookmark = {
                surahNumber,
                edition,
                surahName: surah.englishName,
                ayahNumber,
                timestamp: new Date().getTime()
            };
            await AsyncStorage.setItem('quran_last_read', JSON.stringify(bookmark));
        } catch (e) {
            console.error('Error saving bookmark:', e);
        }
    };

    const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
        if (viewableItems.length > 0) {
            const topItem = viewableItems[0];
            if (topItem.index !== null) {
                lastReadAyahRef.current = topItem.index + 1;
            }
        }
    }).current;

    const viewabilityConfig = useRef({
        itemVisiblePercentThreshold: 50
    }).current;

    const openLanguageModal = async () => {
        setModalVisible(true);
    };

    const handleEditionSelect = (newEdition: string) => {
        onEditionChange(newEdition);
        setModalVisible(false);
    };

    if (loading) {
        return (
            <View style={styles.centerContainer}>
                <ActivityIndicator size="large" color="#f8fafc" />
                <Text style={styles.loadingText}>Loading Verses...</Text>
            </View>
        );
    }

    if (!surah) {
        return (
            <View style={styles.centerContainer}>
                <Text style={styles.errorText}>Could not load translation.</Text>
                <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                    <Text style={styles.closeButtonText}>Go Back</Text>
                </TouchableOpacity>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            {/* Top Bar */}
            <SafeAreaView style={styles.headerSafeArea}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={onClose} style={styles.iconButton}>
                        <ArrowLeft color="#fff" size={24} />
                    </TouchableOpacity>

                    <View style={styles.headerTitleContainer}>
                        <Text style={styles.headerTitle}>{surah.englishName}</Text>
                        <Text style={styles.headerSubtitle}>{surah.englishNameTranslation}</Text>
                    </View>

                    <TouchableOpacity onPress={openLanguageModal} style={styles.langButton}>
                        <Globe color="#cbd5e1" size={22} />
                        <Text style={styles.langLabel}>Language</Text>
                    </TouchableOpacity>
                </View>
            </SafeAreaView>

            {/* Content using FlatList for tracking and scrolling */}
            <FlatList
                ref={flatListRef}
                data={surah.ayahs}
                keyExtractor={(item) => item.number.toString()}
                onViewableItemsChanged={onViewableItemsChanged}
                viewabilityConfig={viewabilityConfig}
                initialNumToRender={10}
                maxToRenderPerBatch={10}
                windowSize={5}
                onScrollToIndexFailed={(info) => {
                    setTimeout(() => {
                        flatListRef.current?.scrollToIndex({ index: info.index, animated: false });
                    }, 500);
                }}
                ListHeaderComponent={
                    surah.number !== 9 ? (
                        <View style={styles.bismillahContainer}>
                            <Text style={styles.arabicBismillah}>بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ</Text>
                            <Text style={styles.englishBismillah}>
                                In the name of Allah, the Entirely Merciful, the Especially Merciful
                            </Text>
                        </View>
                    ) : null
                }
                contentContainerStyle={styles.scrollContent}
                renderItem={({ item: ayah }) => {
                    const isBookmarked = bookmarkedAyah === ayah.numberInSurah;
                    return (
                        <Pressable
                            style={[
                                styles.ayahCard,
                                isBookmarked && styles.bookmarkedAyahCard
                            ]}
                            onPress={() => saveBookmark(ayah.numberInSurah)}
                        >
                            <View style={styles.ayahInfo}>
                                <View style={styles.numberCircle}>
                                    <Text style={styles.numberText}>{ayah.numberInSurah}</Text>
                                </View>
                                {isBookmarked && (
                                    <Bookmark color="#22d3ee" size={16} fill="#22d3ee" />
                                )}
                            </View>
                            <Text style={[
                                styles.ayahText,
                                (edition.startsWith('ar.') || edition.startsWith('quran-')) && { textAlign: 'right' }
                            ]}>
                                {ayah.text}
                            </Text>
                        </Pressable>
                    );
                }}
            />

            {/* Modern Language Picker Modal */}
            <Modal
                animationType="slide"
                transparent={true}
                visible={modalVisible}
                onRequestClose={() => setModalVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Choose Language</Text>
                            <TouchableOpacity onPress={() => setModalVisible(false)} style={styles.modalCloseIcon}>
                                <X color="#94a3b8" size={24} />
                            </TouchableOpacity>
                        </View>

                        <FlatList
                            data={VERIFIED_EDITIONS}
                            keyExtractor={(item) => item.identifier}
                            contentContainerStyle={{ paddingBottom: 40 }}
                            renderItem={({ item }) => (
                                <TouchableOpacity
                                    style={[
                                        styles.langRow,
                                        item.identifier === edition && styles.selectedRow
                                    ]}
                                    onPress={() => handleEditionSelect(item.identifier)}
                                >
                                    <View style={{ flex: 1 }}>
                                        <View style={styles.langNameContainer}>
                                            <Text style={[
                                                styles.mainLangName,
                                                item.identifier === edition && styles.yellowText
                                            ]}>
                                                {item.displayName}
                                            </Text>
                                            <View style={styles.verifiedBadge}>
                                                <Check color="#10b981" size={10} strokeWidth={3} />
                                                <Text style={styles.verifiedText}>AUTHENTIC</Text>
                                            </View>
                                        </View>
                                        <Text style={styles.subEditionName}>
                                            {item.subName}
                                        </Text>
                                    </View>
                                    {item.identifier === edition && (
                                        <View style={styles.activeDot} />
                                    )}
                                </TouchableOpacity>
                            )}
                        />
                    </View>
                </View>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: 'transparent',
    },
    centerContainer: {
        flex: 1,
        backgroundColor: 'transparent',
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerSafeArea: {
        backgroundColor: 'rgba(15, 23, 42, 0.8)',
        borderBottomWidth: 1,
        borderColor: 'rgba(30, 41, 59, 0.5)',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingBottom: 16,
    },
    headerTitleContainer: {
        flex: 1,
        alignItems: 'center',
    },
    headerTitle: {
        color: '#f8fafc',
        fontSize: 18,
        fontWeight: 'bold',
    },
    headerSubtitle: {
        color: '#cbd5e1',
        fontSize: 12,
        fontWeight: '600',
    },
    iconButton: {
        width: 44,
        height: 44,
        alignItems: 'center',
        justifyContent: 'center',
    },
    langButton: {
        alignItems: 'center',
        paddingHorizontal: 8,
    },
    langLabel: {
        color: '#cbd5e1',
        fontSize: 10,
        fontWeight: '600',
    },
    loadingText: {
        color: '#cbd5e1',
        marginTop: 10,
        fontWeight: '600',
    },
    errorText: {
        color: '#ef4444',
        marginBottom: 20,
    },
    closeButton: {
        paddingVertical: 12,
        paddingHorizontal: 24,
        backgroundColor: '#1e293b',
        borderRadius: 12,
    },
    closeButtonText: {
        color: '#fff',
        fontWeight: '600',
    },
    scrollContent: {
        padding: 16,
        paddingBottom: 60,
    },
    bismillahContainer: {
        alignItems: 'center',
        marginBottom: 32,
        marginTop: 8,
    },
    arabicBismillah: {
        color: '#fff',
        fontSize: 28,
        marginBottom: 8,
        textAlign: 'center',
    },
    englishBismillah: {
        color: '#cbd5e1',
        fontSize: 13,
        fontStyle: 'italic',
        textAlign: 'center',
        opacity: 0.9,
    },
    ayahCard: {
        backgroundColor: 'rgba(15, 23, 42, 0.4)',
        borderRadius: 24,
        padding: 24,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.08)',
    },
    bookmarkedAyahCard: {
        borderColor: '#22d3ee',
        backgroundColor: 'rgba(34, 211, 238, 0.08)',
    },
    ayahInfo: {
        marginBottom: 12,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    numberCircle: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: '#1e293b',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: '#334155',
    },
    numberText: {
        color: '#cbd5e1',
        fontSize: 13,
        fontWeight: 'bold',
    },
    ayahText: {
        color: '#f8fafc',
        fontSize: 19,
        lineHeight: 34,
        textAlign: 'left',
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.9)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: '#0f172a',
        borderTopLeftRadius: 32,
        borderTopRightRadius: 32,
        height: '80%',
        padding: 24,
        borderTopWidth: 1,
        borderColor: '#334155',
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 24,
        paddingBottom: 16,
        borderBottomWidth: 1,
        borderColor: '#1e293b',
    },
    modalTitle: {
        color: '#fff',
        fontSize: 22,
        fontWeight: 'bold',
    },
    modalCloseIcon: {
        padding: 4,
    },
    langRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 18,
        paddingHorizontal: 16,
        borderRadius: 16,
        marginBottom: 8,
        backgroundColor: '#1e293b33',
    },
    selectedRow: {
        backgroundColor: '#1e293b',
        borderWidth: 1,
        borderColor: '#334155',
    },
    langNameContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    verifiedBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#064e3b',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
        gap: 2,
    },
    verifiedText: {
        color: '#10b981',
        fontSize: 8,
        fontWeight: 'bold',
        letterSpacing: 0.5,
    },
    mainLangName: {
        color: '#fff',
        fontSize: 17,
        fontWeight: '600',
    },
    yellowText: {
        color: '#f8fafc',
    },
    subEditionName: {
        color: '#94a3b8',
        fontSize: 12,
        marginTop: 2,
        fontWeight: '600',
    },
    activeDot: {
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: '#f8fafc',
    }
});
