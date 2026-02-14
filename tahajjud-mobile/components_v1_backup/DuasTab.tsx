import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, ScrollView, TextInput, TouchableOpacity, StyleSheet, SafeAreaView, FlatList, Alert, Modal, KeyboardAvoidingView, Platform, ScrollView as RNScrollView, ActivityIndicator } from 'react-native';
import { Search, Heart, Volume2, Square, Plus, X, Trash2, Mail, PenTool, Sprout, Lock } from 'lucide-react-native';
import { duaDatabase, categories, Dua } from '../data/duas';
import { getBookmarkedDuas, toggleBookmark } from '../utils/bookmarks';
import { getPersonalDuas, savePersonalDua, deletePersonalDua, PersonalDua } from '../utils/personalDuas';
import { checkAchievements } from '../utils/achievements';
import * as Speech from 'expo-speech';
import * as LocalAuthentication from 'expo-local-authentication';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../utils/supabase';
import { fetchCloudData } from '../utils/syncService';

interface DuaCardProps {
    dua: Dua;
    isBookmarked?: boolean;
    onToggleBookmark?: (duaId: string) => void;
    isPlaying?: boolean;
    onPlay?: () => void;
    onDelete?: () => void;
}

// Memoized DuaCard to prevent unnecessary re-renders
const DuaCard = React.memo(({ dua, isBookmarked, onToggleBookmark, isPlaying, onPlay, onDelete }: DuaCardProps) => {
    return (
        <View style={styles.duaCard}>
            {/* Header with Category and Bookmark */}
            <View style={styles.duaCardHeader}>
                <View style={styles.categoryBadge}>
                    <Text style={styles.categoryBadgeText}>{dua.category}</Text>
                </View>
                <View style={styles.cardActions}>
                    {onPlay && (
                        <TouchableOpacity
                            onPress={onPlay}
                            style={styles.actionButton}
                            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        >
                            {isPlaying ? (
                                <Square
                                    size={22}
                                    color="#f8fafc"
                                    fill="#f8fafc"
                                />
                            ) : (
                                <Volume2
                                    size={24}
                                    color="#64748b"
                                />
                            )}
                        </TouchableOpacity>
                    )}
                    {onToggleBookmark && (
                        <TouchableOpacity
                            onPress={() => onToggleBookmark(dua.id)}
                            style={styles.actionButton}
                            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        >
                            <Heart
                                size={24}
                                color={isBookmarked ? '#ef4444' : '#64748b'}
                                fill={isBookmarked ? '#ef4444' : 'none'}
                            />
                        </TouchableOpacity>
                    )}
                    {onDelete && (
                        <TouchableOpacity
                            onPress={onDelete}
                            style={styles.actionButton}
                            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        >
                            <Trash2
                                size={22}
                                color="#ef4444"
                            />
                        </TouchableOpacity>
                    )}
                </View>
            </View>

            {/* Title */}
            <Text style={styles.duaTitle}>{dua.title}</Text>

            {/* Letter Content (New for Tahajjud Letters) */}
            {dua.category === 'Personal' && dua.translation ? (
                <View style={styles.letterContentContainer}>
                    <Text style={styles.letterText}>{dua.translation}</Text>
                </View>
            ) : (
                <>
                    {/* Arabic Text */}
                    {dua.arabic ? (
                        <View style={styles.arabicContainer}>
                            <Text style={styles.arabicText}>{dua.arabic}</Text>
                        </View>
                    ) : null}

                    {/* Transliteration */}
                    {dua.transliteration ? (
                        <View style={styles.transliterationContainer}>
                            <Text style={styles.transliterationLabel}>Transliteration:</Text>
                            <Text style={styles.transliterationText}>{dua.transliteration}</Text>
                        </View>
                    ) : null}

                    {/* Translation */}
                    {dua.translation ? (
                        <View style={styles.translationContainer}>
                            <Text style={styles.translationLabel}>Translation:</Text>
                            <Text style={styles.translationText}>{dua.translation}</Text>
                        </View>
                    ) : null}
                </>
            )}

            {/* Source */}
            <Text style={styles.sourceText}>— {dua.source}</Text>
        </View>
    );
}, (prevProps, nextProps) => {
    return (
        prevProps.isBookmarked === nextProps.isBookmarked &&
        prevProps.isPlaying === nextProps.isPlaying &&
        prevProps.dua.id === nextProps.dua.id
    );
});

export function DuasTab() {
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('All');
    const [bookmarkedIds, setBookmarkedIds] = useState<string[]>([]);
    const [playingDuaId, setPlayingDuaId] = useState<string | null>(null);
    const [voiceIdentifier, setVoiceIdentifier] = useState<string | null>(null);

    // Personal Dua State
    const [activeTab, setActiveTab] = useState<'library' | 'personal'>('library');
    const [isLocked, setIsLocked] = useState(false);
    const [personalDuas, setPersonalDuas] = useState<PersonalDua[]>([]);
    const [isModalVisible, setIsModalVisible] = useState(false);

    // Form State
    const [newDuaTitle, setNewDuaTitle] = useState('');
    const [newDuaArabic, setNewDuaArabic] = useState('');
    const [newDuaTranslation, setNewDuaTranslation] = useState('');
    const [newDuaTransliteration, setNewDuaTransliteration] = useState('');
    const [newDuaNotes, setNewDuaNotes] = useState('');

    // Load data on mount
    useEffect(() => {
        loadBookmarks();
        loadVoice();
        loadPersonalDuasData();
        checkLockStatus();
        return () => {
            Speech.stop();
        };
    }, []);

    const checkLockStatus = async () => {
        const locked = await AsyncStorage.getItem('biometric-lock-enabled');
        setIsLocked(locked === 'true');
    };

    const handleTabChange = async (tab: 'library' | 'personal') => {
        if (tab === 'personal') {
            const locked = await AsyncStorage.getItem('biometric-lock-enabled');
            if (locked === 'true') {
                const { success } = await LocalAuthentication.authenticateAsync({
                    promptMessage: 'Access your private letters',
                    cancelLabel: 'Cancel',
                });

                if (!success) return; // Stay on library
            }
        }
        setActiveTab(tab);
    };

    const loadPersonalDuasData = async () => {
        // 1. Load local data first for speed
        const localDuas = await getPersonalDuas();
        setPersonalDuas(localDuas);

        // 2. If authenticated, try to fetch fresh data from cloud
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
            const cloudDuas = await fetchCloudData(user.id);
            if (cloudDuas.length > 0) {
                // Simplistic merge: prefer whatever is in the cloud for now
                // Or you could merge and deduplicate
                setPersonalDuas(cloudDuas);

                // Keep local storage in sync
                await AsyncStorage.setItem('personal-duas', JSON.stringify(cloudDuas));
            }
        }
    };

    const handleSaveDua = async () => {
        if (!newDuaTranslation.trim()) {
            Alert.alert('Empty Letter', 'Please write something in your letter to Allah.');
            return;
        }

        const date = new Date();
        const formattedDate = date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });

        const newDua: PersonalDua = {
            id: Date.now().toString(),
            title: newDuaTitle.trim() || `Letter · ${formattedDate}`,
            arabic: newDuaArabic,
            transliteration: newDuaTransliteration,
            translation: newDuaTranslation,
            notes: newDuaNotes,
            createdAt: Date.now(),
        };

        await savePersonalDua(newDua);
        const updatedDuas = [newDua, ...personalDuas];
        setPersonalDuas(updatedDuas);
        setIsModalVisible(false);
        resetForm();

        // Check for achievements
        const newlyUnlocked = await checkAchievements('dua', updatedDuas.length);
        if (newlyUnlocked) {
            Alert.alert(
                "Achievement Unlocked! 🏅",
                `Congratulations! You earned the "${newlyUnlocked.title}" badge for your Tahajjud Letters.\n\n${newlyUnlocked.description}`,
                [{ text: "MashAllah!" }]
            );
        }
    };

    const handleDeleteDua = async (id: string) => {
        Alert.alert(
            "Delete Dua",
            "Are you sure you want to delete this dua?",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Delete",
                    style: "destructive",
                    onPress: async () => {
                        await deletePersonalDua(id);
                        setPersonalDuas(prev => prev.filter(d => d.id !== id));
                    }
                }
            ]
        );
    };

    const resetForm = () => {
        setNewDuaTitle('');
        setNewDuaArabic('');
        setNewDuaTranslation('');
        setNewDuaTransliteration('');
        setNewDuaNotes('');
    };

    const loadVoice = async () => {
        try {
            const voices = await Speech.getAvailableVoicesAsync();

            // Log all Arabic voices to help debugging (if we could see logs)
            const arabicVoices = voices.filter(v => v.language.includes('ar'));
            console.log('[Audio] Available Arabic voices:', arabicVoices.map(v => v.name));

            // Priority list for better quality voices
            // "Maged" is a high-quality male voice on iOS
            // "Tarik" is another male voice
            const preferredNames = ['Maged', 'Tarik', 'Majed'];

            let selectedVoice = null;

            // 1. Try to find a preferred voice
            for (const name of preferredNames) {
                selectedVoice = arabicVoices.find(v => v.name.includes(name));
                if (selectedVoice) break;
            }

            // 2. If not found, pick any Arabic voice
            if (!selectedVoice) {
                selectedVoice = arabicVoices[0];
            }

            if (selectedVoice) {
                console.log('[Audio] Selected voice:', selectedVoice.name);
                setVoiceIdentifier(selectedVoice.identifier);
            }
        } catch (e) {
            console.log('Error loading voices', e);
        }
    };

    const loadBookmarks = async () => {
        const bookmarks = await getBookmarkedDuas();
        setBookmarkedIds(bookmarks);
    };

    const handleToggleBookmark = useCallback(async (duaId: string) => {
        await toggleBookmark(duaId);
        // Optimistic update
        setBookmarkedIds(prev =>
            prev.includes(duaId)
                ? prev.filter(id => id !== duaId)
                : [...prev, duaId]
        );
    }, []);

    const handlePlayDua = useCallback(async (dua: Dua) => {
        try {
            // If tapping the same card that is already playing, stop it.
            if (playingDuaId === dua.id) {
                Speech.stop();
                setPlayingDuaId(null);
                return;
            }

            // If switching to a new card, stop previous immediately
            Speech.stop();
            setPlayingDuaId(dua.id);

            // Small delay to ensure the engine is ready
            setTimeout(() => {
                const options: Speech.SpeechOptions = {
                    rate: 0.85, // Slower for more solemn recitation
                    pitch: 1.0, // Natural pitch
                    onDone: () => setPlayingDuaId(null),
                    onStopped: () => setPlayingDuaId(null),
                    onError: (e) => {
                        console.log('Speech error:', e);
                        setPlayingDuaId(null);
                    }
                };

                // Only set voice/language if we are sure we have an Arabic voice
                if (voiceIdentifier) {
                    options.voice = voiceIdentifier;
                    options.language = 'ar';
                } else {
                    // Fallback to system default (likely English on Simulator)
                    console.log('[Audio] Using system default voice');
                }

                Speech.speak(dua.arabic, options);
            }, 100);

        } catch (error) {
            console.error('Playback failed', error);
            setPlayingDuaId(null);
            Alert.alert('Error', 'Unable to play audio.');
        }
    }, [playingDuaId, voiceIdentifier]);

    const filteredDuas = useMemo(() => {
        return duaDatabase.filter(dua => {
            // Filter by bookmarked
            if (selectedCategory === 'Bookmarked') {
                if (!bookmarkedIds.includes(dua.id)) return false;
            } else if (selectedCategory !== 'All') {
                if (dua.category !== selectedCategory) return false;
            }

            // Filter by search
            if (searchQuery) {
                const query = searchQuery.toLowerCase();
                return (
                    dua.title.toLowerCase().includes(query) ||
                    dua.category.toLowerCase().includes(query) ||
                    dua.translation.toLowerCase().includes(query)
                );
            }

            return true;
        });
    }, [selectedCategory, searchQuery, bookmarkedIds]);

    // Add Bookmarked to categories
    const allCategories = useMemo(() => ['All', 'Bookmarked', ...categories.slice(1)], []);

    const renderDuaItem = useCallback(({ item }: { item: Dua }) => (
        <DuaCard
            dua={item}
            isBookmarked={bookmarkedIds.includes(item.id)}
            onToggleBookmark={handleToggleBookmark}
            isPlaying={playingDuaId === item.id}
            onPlay={() => handlePlayDua(item)}
        />
    ), [bookmarkedIds, playingDuaId, handleToggleBookmark, handlePlayDua]);

    const renderPersonalDuaItem = useCallback(({ item }: { item: PersonalDua }) => {
        const adaptedDua: Dua = {
            id: item.id,
            title: item.title,
            arabic: item.arabic || '',
            translation: item.translation || '',
            transliteration: item.transliteration || '',
            source: 'My Journal',
            category: 'Personal'
        };

        return (
            <DuaCard
                dua={adaptedDua}
                onDelete={() => handleDeleteDua(item.id)}
            />
        );
    }, [handleDeleteDua]);

    const renderEmptyState = () => (
        <View style={styles.emptyState}>
            <Text style={styles.emptyText}>
                {selectedCategory === 'Bookmarked'
                    ? 'No bookmarked duas yet. Tap the heart icon to save your favorites!'
                    : 'No duas found'}
            </Text>
        </View>
    );

    return (
        <SafeAreaView style={styles.safeArea}>
            <View style={styles.container}>
                {/* Header */}
                <View style={styles.header}>
                    <Text style={styles.headerTitle}>Duas</Text>
                    <View style={styles.tabsContainer}>
                        <TouchableOpacity
                            style={[styles.tab, activeTab === 'library' && styles.activeTab]}
                            onPress={() => handleTabChange('library')}
                        >
                            <Text style={[styles.tabText, activeTab === 'library' && styles.activeTabText]}>Library</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.tab, activeTab === 'personal' && styles.activeTab]}
                            onPress={() => handleTabChange('personal')}
                        >
                            <Text style={[styles.tabText, activeTab === 'personal' && styles.activeTabText]}>Letters</Text>
                        </TouchableOpacity>
                    </View>
                </View>

                {activeTab === 'library' ? (
                    <>
                        {/* Search Bar */}
                        <View style={styles.searchContainer}>
                            <Search size={20} color="#94a3b8" style={styles.searchIcon} />
                            <TextInput
                                style={styles.searchInput}
                                placeholder="Search duas..."
                                placeholderTextColor="#94a3b8"
                                value={searchQuery}
                                onChangeText={setSearchQuery}
                            />
                        </View>

                        {/* Category Pills */}
                        <View style={styles.categoriesContainer}>
                            <ScrollView
                                horizontal
                                showsHorizontalScrollIndicator={false}
                                contentContainerStyle={styles.categoriesContent}
                            >
                                {allCategories.map(category => (
                                    <TouchableOpacity
                                        key={category}
                                        onPress={() => setSelectedCategory(category)}
                                        style={[
                                            styles.categoryPill,
                                            selectedCategory === category && styles.categoryPillActive
                                        ]}
                                    >
                                        <Text style={[
                                            styles.categoryText,
                                            selectedCategory === category && styles.categoryTextActive
                                        ]}>
                                            {category}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </ScrollView>
                        </View>

                        {/* Duas List */}
                        <FlatList
                            data={filteredDuas}
                            renderItem={renderDuaItem}
                            keyExtractor={item => item.id}
                            contentContainerStyle={styles.duasContent}
                            ListEmptyComponent={renderEmptyState}
                            removeClippedSubviews={true}
                            initialNumToRender={5}
                            maxToRenderPerBatch={10}
                            windowSize={5}
                            showsVerticalScrollIndicator={false}
                        />
                    </>
                ) : (
                    <View style={{ flex: 1 }}>
                        <FlatList
                            data={personalDuas}
                            renderItem={renderPersonalDuaItem}
                            keyExtractor={item => item.id}
                            contentContainerStyle={styles.duasContent}
                            ListEmptyComponent={() => (
                                <View style={styles.emptyState}>
                                    <Text style={styles.emptyText}>Your heart's journey is a private conversation.</Text>
                                    <Text style={styles.emptySubtext}>Tap the ✉️ icon to write your first letter to Allah.</Text>
                                </View>
                            )}
                        />
                        <TouchableOpacity
                            style={styles.fab}
                            onPress={() => setIsModalVisible(true)}
                        >
                            <Mail color="white" size={24} />
                        </TouchableOpacity>
                    </View>
                )}

                {/* Add Dua Modal */}
                <Modal
                    visible={isModalVisible}
                    animationType="slide"
                    transparent={true}
                    onRequestClose={() => setIsModalVisible(false)}
                >
                    <KeyboardAvoidingView
                        behavior={Platform.OS === "ios" ? "padding" : "height"}
                        style={styles.modalContainer}
                    >
                        <View style={styles.modalContent}>
                            <View style={styles.modalHeader}>
                                <View>
                                    <Text style={styles.modalTitle}>Tahajjud Letter</Text>
                                    <Text style={styles.modalSubtitle}>Write freely to your Lord...</Text>
                                </View>
                                <TouchableOpacity onPress={() => setIsModalVisible(false)}>
                                    <X color="#94a3b8" size={24} />
                                </TouchableOpacity>
                            </View>

                            <RNScrollView
                                style={styles.formScrollView}
                                showsVerticalScrollIndicator={false}
                            >
                                <View style={styles.letterWritingArea}>
                                    <TextInput
                                        style={[styles.input, styles.letterTitleInput]}
                                        placeholder="Optional Title (e.g. For my parents)"
                                        placeholderTextColor="#64748b"
                                        value={newDuaTitle}
                                        onChangeText={setNewDuaTitle}
                                    />

                                    <View style={styles.divider} />

                                    <TextInput
                                        style={[styles.input, styles.letterTextArea]}
                                        placeholder="What is on your heart tonight? Pour it all out here... Allah is listening."
                                        placeholderTextColor="#475569"
                                        value={newDuaTranslation}
                                        onChangeText={setNewDuaTranslation}
                                        multiline
                                        autoFocus
                                    />
                                </View>

                                {/* Hidden Advanced Options Toggle */}
                                <TouchableOpacity
                                    style={styles.advancedToggle}
                                    onPress={() => Alert.alert("Tip", "You can just write in English/your language. Allah understands all hearts.")}
                                >
                                    <Text style={styles.advancedToggleText}>Need to add Arabic or Notes?</Text>
                                </TouchableOpacity>
                            </RNScrollView>

                            <TouchableOpacity style={styles.saveButton} onPress={handleSaveDua}>
                                <Text style={styles.saveButtonText}>Entrust to Allah ✨</Text>
                            </TouchableOpacity>
                        </View>
                    </KeyboardAvoidingView>
                </Modal>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: '#020617',
    },
    container: {
        flex: 1,
        backgroundColor: '#020617',
    },
    header: {
        paddingTop: 20,
        paddingHorizontal: 24,
        paddingBottom: 16,
    },
    headerTitle: {
        fontSize: 28,
        fontWeight: 'bold',
        color: '#ffffff',
        marginBottom: 8,
    },
    headerSubtitle: {
        fontSize: 15,
        color: '#94a3b8',
    },
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
        borderRadius: 12,
        marginHorizontal: 16,
        marginBottom: 16,
        paddingHorizontal: 12,
    },
    searchIcon: {
        marginRight: 8,
    },
    searchInput: {
        flex: 1,
        color: '#ffffff',
        fontSize: 16,
        paddingVertical: 12,
    },
    categoriesContainer: {
        maxHeight: 50,
        marginBottom: 16,
    },
    categoriesContent: {
        paddingHorizontal: 16,
        gap: 8,
    },
    categoryPill: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
        marginRight: 8,
    },
    categoryPillActive: {
        backgroundColor: '#f8fafc',
        borderColor: '#f8fafc',
    },
    categoryText: {
        color: '#94a3b8',
        fontSize: 14,
        fontWeight: '500',
    },
    categoryTextActive: {
        color: '#020617',
        fontWeight: '600',
    },
    duasList: {
        flex: 1,
    },
    duasContent: {
        paddingHorizontal: 16,
        paddingBottom: 40,
    },
    emptyState: {
        paddingVertical: 60,
        alignItems: 'center',
    },
    emptyText: {
        color: '#94a3b8',
        fontSize: 16,
    },
    duaCard: {
        backgroundColor: 'rgba(255, 255, 255, 0.03)',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
        borderRadius: 16,
        padding: 20,
        marginBottom: 16,
    },
    duaCardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    cardActions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    actionButton: {
        padding: 4,
    },
    categoryBadge: {
        alignSelf: 'flex-start',
        backgroundColor: 'rgba(248, 250, 252, 0.1)',
        paddingHorizontal: 12,
        paddingVertical: 4,
        borderRadius: 12,
        marginBottom: 12,
    },
    categoryBadgeText: {
        color: '#f8fafc',
        fontSize: 12,
        fontWeight: '600',
    },
    duaTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#ffffff',
        marginBottom: 16,
    },
    arabicContainer: {
        backgroundColor: 'rgba(248, 250, 252, 0.05)',
        padding: 16,
        borderRadius: 12,
        marginBottom: 16,
    },
    arabicText: {
        fontSize: 22,
        color: '#ffffff',
        textAlign: 'right',
        lineHeight: 40,
        fontWeight: '500',
    },
    transliterationContainer: {
        marginBottom: 12,
    },
    transliterationLabel: {
        fontSize: 12,
        color: '#94a3b8',
        marginBottom: 4,
        fontWeight: '600',
    },
    transliterationText: {
        fontSize: 15,
        color: '#f8fafc',
        fontStyle: 'italic',
        lineHeight: 24,
    },
    translationContainer: {
        marginBottom: 12,
    },
    translationLabel: {
        fontSize: 12,
        color: '#94a3b8',
        marginBottom: 4,
        fontWeight: '600',
    },
    translationText: {
        fontSize: 15,
        color: '#f8fafc',
        lineHeight: 24,
    },
    sourceText: {
        fontSize: 13,
        color: '#94a3b8',
        textAlign: 'right',
        marginTop: 8,
    },
    // New Styles for Personal Dua Journal
    tabsContainer: {
        flexDirection: 'row',
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        borderRadius: 12,
        padding: 4,
        marginTop: 16,
    },
    tab: {
        flex: 1,
        paddingVertical: 8,
        alignItems: 'center',
        borderRadius: 8,
    },
    activeTab: {
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
    },
    tabText: {
        color: '#94a3b8',
        fontWeight: '600',
        fontSize: 14,
    },
    activeTabText: {
        color: '#ffffff',
    },
    fab: {
        position: 'absolute',
        bottom: 100,
        right: 24,
        backgroundColor: '#4f46e5',
        width: 56,
        height: 56,
        borderRadius: 28,
        justifyContent: 'center',
        alignItems: 'center',
        elevation: 8,
        shadowColor: '#4f46e5',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
    },
    modalContainer: {
        flex: 1,
        justifyContent: 'flex-end',
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
    },
    modalContent: {
        backgroundColor: '#1e293b',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        padding: 24,
        maxHeight: '85%',
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 24,
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#ffffff',
    },
    formScrollView: {
        marginBottom: 16,
    },
    label: {
        fontSize: 14,
        color: '#cbd5e1',
        marginBottom: 8,
        fontWeight: '500',
    },
    input: {
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        borderRadius: 12,
        padding: 16,
        color: '#ffffff',
        fontSize: 16,
        marginBottom: 20,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
    },
    textArea: {
        height: 100,
        textAlignVertical: 'top',
    },
    saveButton: {
        backgroundColor: '#4f46e5',
        paddingVertical: 16,
        borderRadius: 12,
        alignItems: 'center',
    },
    saveButtonText: {
        color: '#ffffff',
        fontSize: 16,
        fontWeight: 'bold',
    },
    emptySubtext: {
        color: '#64748b',
        fontSize: 14,
        marginTop: 8,
    },
    letterContentContainer: {
        backgroundColor: 'rgba(255, 255, 255, 0.02)',
        padding: 16,
        borderRadius: 12,
        borderLeftWidth: 2,
        borderLeftColor: '#4f46e5',
        marginBottom: 8,
    },
    letterText: {
        color: '#e2e8f0',
        fontSize: 16,
        lineHeight: 26,
        fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
    },
    modalSubtitle: {
        color: '#94a3b8',
        fontSize: 14,
        marginTop: 4,
    },
    letterWritingArea: {
        backgroundColor: 'rgba(255, 255, 255, 0.03)',
        borderRadius: 16,
        padding: 16,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.05)',
    },
    letterTitleInput: {
        backgroundColor: 'transparent',
        borderWidth: 0,
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 0,
        paddingHorizontal: 0,
    },
    letterTextArea: {
        backgroundColor: 'transparent',
        borderWidth: 0,
        height: 300,
        fontSize: 16,
        lineHeight: 24,
        paddingHorizontal: 0,
    },
    divider: {
        height: 1,
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        marginVertical: 12,
    },
    advancedToggle: {
        marginTop: 16,
        padding: 12,
        alignItems: 'center',
    },
    advancedToggleText: {
        color: '#64748b',
        fontSize: 12,
        textDecorationLine: 'underline',
    }
});
