import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { View, Text, ScrollView, TextInput, TouchableOpacity, StyleSheet, FlatList, Alert, Modal, KeyboardAvoidingView, Platform, ScrollView as RNScrollView, ActivityIndicator, DeviceEventEmitter } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Search, Heart, Volume2, Square, Plus, X, Trash2, Mail, PenTool, Sprout, Lock, Moon, BookHeart } from 'lucide-react-native';
import { TahajjudJournalHistory } from './TahajjudJournalHistory';
import { TahajjudJournal, STATE_OPTIONS, JournalEntry } from '../utils/tahajjudJournal';
import { duaDatabase, categories, Dua } from '../data/duas';
import { getBookmarkedDuas, toggleBookmark } from '../utils/bookmarks';
import { getPersonalDuas, savePersonalDua, deletePersonalDua, PersonalDua } from '../utils/personalDuas';
import { checkAchievements } from '../utils/achievements';
import * as Speech from 'expo-speech';
import * as LocalAuthentication from 'expo-local-authentication';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../utils/supabase';
import { fetchCloudData } from '../utils/syncService';
import { getFirebaseAuth } from '../utils/firebase';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { useTheme } from '../context/ThemeContext';
import { usePurchases } from '../context/PurchasesContext';
import { tabletContentStyle } from '../utils/layout';

interface DuaCardProps {
    dua: Dua;
    isBookmarked?: boolean;
    onToggleBookmark?: (duaId: string) => void;
    isPlaying?: boolean;
    activeArabicWord?: number;
    onPlay?: () => void;
    onDelete?: () => void;
}

// Memoized DuaCard to prevent unnecessary re-renders
const DuaCard = React.memo(({ dua, isBookmarked, onToggleBookmark, isPlaying, activeArabicWord = -1, onPlay, onDelete }: DuaCardProps) => {
    const { colors, cardBg, blurIntensity } = useTheme();

    // Derive translation word index proportionally from arabic word position
    const arabicWords = dua.arabic ? dua.arabic.split(' ') : [];
    const translationWords = dua.translation ? dua.translation.split(' ') : [];
    const activeTranslationWord = activeArabicWord >= 0 && arabicWords.length > 0
        ? Math.min(
            Math.floor((activeArabicWord / arabicWords.length) * translationWords.length),
            translationWords.length - 1
          )
        : -1;
    return (
        <Animated.View
            entering={FadeInDown.duration(600)}
            style={styles.duaCard}
        >
            <BlurView intensity={Math.round(15 * blurIntensity)} tint="dark" style={[StyleSheet.absoluteFill, { backgroundColor: cardBg }]} />
            <LinearGradient
                colors={['rgba(255, 255, 255, 0.05)', 'transparent']}
                style={StyleSheet.absoluteFill}
            />

            <View style={styles.duaCardContent}>
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
                                    <Square size={18} color="#f8fafc" fill="#f8fafc" />
                                ) : (
                                    <Volume2 size={20} color="#94a3b8" />
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
                                    size={20}
                                    color={isBookmarked ? '#f8fafc' : '#94a3b8'}
                                    fill={isBookmarked ? '#f8fafc' : 'none'}
                                />
                            </TouchableOpacity>
                        )}
                        {onDelete && (
                            <TouchableOpacity
                                onPress={onDelete}
                                style={styles.actionButton}
                                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                            >
                                <Trash2 size={18} color="#ef4444" />
                            </TouchableOpacity>
                        )}
                    </View>
                </View>

                <Text style={styles.duaTitle}>{dua.title}</Text>

                {dua.category === 'Personal' ? (
                    <View style={styles.letterContentContainer}>
                        {dua.translation ? (
                            <Text style={styles.letterText} numberOfLines={4}>{dua.translation}</Text>
                        ) : (
                            <Text style={[styles.letterText, { color: '#475569', fontStyle: 'italic' }]}>No content</Text>
                        )}
                    </View>
                ) : (
                    <>
                        {dua.arabic ? (
                            <View style={styles.arabicContainer}>
                                {activeArabicWord >= 0 ? (
                                    <Text style={[styles.arabicText, { textAlign: 'right' }]}>
                                        {arabicWords.map((word, wi) => (
                                            <Text key={wi} style={
                                                wi === activeArabicWord
                                                    ? { color: '#22d3ee', fontWeight: '800' }
                                                    : { color: '#ffffff' }
                                            }>
                                                {word}{wi < arabicWords.length - 1 ? ' ' : ''}
                                            </Text>
                                        ))}
                                    </Text>
                                ) : (
                                    <Text style={styles.arabicText}>{dua.arabic}</Text>
                                )}
                            </View>
                        ) : null}

                        {dua.transliteration ? (
                            <View style={styles.transliterationContainer}>
                                <Text style={[styles.transliterationLabel, { color: '#94a3b8' }]}>Transliteration</Text>
                                <Text style={[styles.transliterationText, { color: '#cbd5e1' }]}>{dua.transliteration}</Text>
                            </View>
                        ) : null}

                        {dua.translation ? (
                            <View style={styles.translationContainer}>
                                <Text style={[styles.translationLabel, { color: colors.accent }]}>Translation</Text>
                                {activeTranslationWord >= 0 ? (
                                    <Text style={styles.translationText}>
                                        {translationWords.map((word, wi) => (
                                            <Text key={wi} style={
                                                wi === activeTranslationWord
                                                    ? { color: '#67e8f9', fontWeight: '800' }
                                                    : { color: '#f8fafc' }
                                            }>
                                                {word}{wi < translationWords.length - 1 ? ' ' : ''}
                                            </Text>
                                        ))}
                                    </Text>
                                ) : (
                                    <Text style={[styles.translationText, { color: '#f8fafc' }]}>{dua.translation}</Text>
                                )}
                            </View>
                        ) : null}
                    </>
                )}

                <View style={styles.cardFooter}>
                    <View style={styles.footerLine} />
                    <Text style={styles.sourceText}>{dua.source}</Text>
                </View>
            </View>
        </Animated.View>
    );
}, (prevProps, nextProps) => {
    return (
        prevProps.isBookmarked === nextProps.isBookmarked &&
        prevProps.isPlaying === nextProps.isPlaying &&
        prevProps.activeArabicWord === nextProps.activeArabicWord &&
        prevProps.dua.id === nextProps.dua.id
    );
});


const FREE_DUA_LIMIT = 3;

export function DuasTab() {
    const { colors } = useTheme();
    const { isPremium, openPaywall } = usePurchases();
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('All');
    const [bookmarkedIds, setBookmarkedIds] = useState<string[]>([]);
    const [playingDuaId, setPlayingDuaId] = useState<string | null>(null);
    const [voiceIdentifier, setVoiceIdentifier] = useState<string | null>(null);
    const [activeArabicWord, setActiveArabicWord] = useState(-1);
    const wordTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const flatListRef = useRef<FlatList>(null);

    useEffect(() => {
        const sub = DeviceEventEmitter.addListener('scrollToTop', (tab: string) => {
            if (tab === 'Duas') flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
        });
        return () => sub.remove();
    }, []);

    const clearWordTimer = useCallback(() => {
        if (wordTimerRef.current) { clearTimeout(wordTimerRef.current); wordTimerRef.current = null; }
        setActiveArabicWord(-1);
    }, []);

    // Personal Dua State
    const [activeTab, setActiveTab] = useState<'library' | 'personal'>('library');
    const [isLocked, setIsLocked] = useState(false);
    const [personalDuas, setPersonalDuas] = useState<PersonalDua[]>([]);
    const [isModalVisible, setIsModalVisible] = useState(false);
    const [journalEntries, setJournalEntries] = useState<JournalEntry[]>([]);
    const [showJournalHistory, setShowJournalHistory] = useState(false);

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
            clearWordTimer();
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
                if (!success) return;
            }
            // Load journal entries for premium users
            if (isPremium) {
                const entries = await TahajjudJournal.getAll();
                setJournalEntries(entries);
            }
        }
        setActiveTab(tab);
    };

    const loadPersonalDuasData = async () => {
        // 1. Load local data first for speed
        const localDuas = await getPersonalDuas();
        setPersonalDuas(localDuas);

        // 2. If authenticated via Firebase, try to fetch fresh data from cloud
        const auth = getFirebaseAuth();
        const firebaseUser = auth?.currentUser;
        if (firebaseUser) {
            const cloudDuas = await fetchCloudData(firebaseUser.uid);
            if (cloudDuas.length > 0) {
                setPersonalDuas(cloudDuas);
                await AsyncStorage.setItem('personal-duas', JSON.stringify(cloudDuas));
            }
        }
    };

    const handleSaveDua = async () => {
        if (!newDuaTranslation.trim()) {
            Alert.alert('Empty Letter', 'Please write something in your letter to Allah.');
            return;
        }

        // Free limit check
        if (!isPremium && personalDuas.length >= FREE_DUA_LIMIT) {
            openPaywall();
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
            if (playingDuaId === dua.id) {
                Speech.stop();
                setPlayingDuaId(null);
                clearWordTimer();
                return;
            }

            Speech.stop();
            clearWordTimer();
            setPlayingDuaId(dua.id);

            const words = dua.arabic ? dua.arabic.split(' ') : [];
            const wordDurations = words.map(w => Math.max(220, (280 + w.length * 30) / 0.85));

            const options: Speech.SpeechOptions = {
                rate: 0.85,
                pitch: 1.0,
                onStart: () => {
                    // Start word timer only when audio actually begins
                    let current = 0;
                    setActiveArabicWord(0);
                    const scheduleNext = () => {
                        if (current >= words.length - 1) return;
                        wordTimerRef.current = setTimeout(() => {
                            current++;
                            setActiveArabicWord(current);
                            scheduleNext();
                        }, wordDurations[current]);
                    };
                    scheduleNext();
                },
                onDone: () => { setPlayingDuaId(null); clearWordTimer(); },
                onStopped: () => { setPlayingDuaId(null); clearWordTimer(); },
                onError: (e) => {
                    console.log('Speech error:', e);
                    setPlayingDuaId(null);
                    clearWordTimer();
                }
            };

            if (voiceIdentifier) {
                options.voice = voiceIdentifier;
                options.language = 'ar';
            }

            Speech.speak(dua.arabic, options);

        } catch (error) {
            console.error('Playback failed', error);
            setPlayingDuaId(null);
            clearWordTimer();
            Alert.alert('Error', 'Unable to play audio.');
        }
    }, [playingDuaId, voiceIdentifier, clearWordTimer]);

    const filteredDuas = useMemo(() => {
        // Synonym / related-topic map
        const SYNONYMS: Record<string, string[]> = {
            money: ['wealth', 'rizq', 'provision', 'income', 'finance', 'rich', 'poor', 'poverty', 'halal', 'earning'],
            rich: ['wealth', 'rizq', 'provision', 'money', 'income'],
            poor: ['poverty', 'wealth', 'rizq', 'money', 'need'],
            job: ['work', 'rizq', 'provision', 'wealth', 'income', 'success', 'career'],
            work: ['job', 'rizq', 'provision', 'success', 'career'],
            stress: ['anxiety', 'worry', 'fear', 'peace', 'calm', 'depression', 'mental'],
            anxiety: ['stress', 'worry', 'fear', 'peace', 'calm', 'depression'],
            sad: ['grief', 'sorrow', 'depression', 'anxiety', 'loss', 'heartbreak'],
            depression: ['anxiety', 'stress', 'sad', 'grief', 'peace', 'mental'],
            worry: ['anxiety', 'stress', 'fear', 'peace', 'trust', 'tawakkul'],
            fear: ['anxiety', 'worry', 'protection', 'peace', 'trust'],
            sick: ['health', 'illness', 'healing', 'shifa', 'disease', 'cure'],
            illness: ['sick', 'health', 'healing', 'shifa', 'disease', 'cure'],
            heal: ['health', 'sick', 'illness', 'shifa', 'cure'],
            health: ['sick', 'healing', 'shifa', 'illness', 'disease'],
            shifa: ['health', 'healing', 'sick', 'illness'],
            wife: ['marriage', 'spouse', 'family', 'nikah', 'husband'],
            husband: ['marriage', 'spouse', 'family', 'nikah', 'wife'],
            marriage: ['spouse', 'wife', 'husband', 'family', 'nikah', 'wedding'],
            nikah: ['marriage', 'spouse', 'family'],
            kids: ['children', 'family', 'child', 'baby', 'offspring'],
            children: ['family', 'kids', 'child', 'offspring', 'baby'],
            child: ['children', 'family', 'kids', 'offspring'],
            family: ['children', 'wife', 'husband', 'parents', 'marriage'],
            parents: ['family', 'mother', 'father', 'forgiveness'],
            mum: ['parents', 'mother', 'family'],
            dad: ['parents', 'father', 'family'],
            mother: ['parents', 'family', 'mum'],
            father: ['parents', 'family', 'dad'],
            sleep: ['night', 'rest', 'bedtime', 'daily routine'],
            eat: ['food', 'meal', 'daily routine', 'blessing'],
            food: ['eat', 'meal', 'daily routine', 'provision', 'rizq'],
            travel: ['journey', 'trip', 'vehicle', 'road'],
            journey: ['travel', 'trip', 'vehicle'],
            forgive: ['forgiveness', 'sin', 'repentance', 'tawbah', 'mercy'],
            sin: ['forgiveness', 'repentance', 'tawbah', 'guilt', 'regret'],
            repent: ['repentance', 'tawbah', 'forgiveness', 'sin'],
            repentance: ['tawbah', 'forgiveness', 'sin', 'regret'],
            tawbah: ['repentance', 'forgiveness', 'sin'],
            mercy: ['forgiveness', 'rahma', 'kindness'],
            guidance: ['hidayah', 'right path', 'guide', 'direction'],
            hidayah: ['guidance', 'right path'],
            exam: ['study', 'knowledge', 'education', 'success', 'school'],
            study: ['knowledge', 'education', 'exam', 'success'],
            school: ['education', 'knowledge', 'study', 'exam'],
            education: ['knowledge', 'study', 'school', 'exam', 'success'],
            protection: ['evil eye', 'shaytan', 'devil', 'harm', 'safety', 'ruqyah'],
            'evil eye': ['protection', 'envy', 'hasad', 'harm'],
            envy: ['evil eye', 'hasad', 'protection'],
            hasad: ['evil eye', 'envy', 'protection'],
            jannah: ['paradise', 'heaven', 'afterlife', 'hereafter'],
            paradise: ['jannah', 'heaven', 'afterlife', 'hereafter'],
            heaven: ['jannah', 'paradise', 'afterlife'],
            ummah: ['muslim', 'community', 'palestinians', 'oppressed'],
            palestine: ['ummah', 'oppressed', 'muslim', 'war'],
            morning: ['morning & evening', 'daily', 'adhkar', 'wake up'],
            evening: ['morning & evening', 'daily', 'adhkar', 'night'],
            adhkar: ['morning & evening', 'daily', 'dhikr', 'remembrance'],
            dhikr: ['adhkar', 'remembrance', 'morning & evening'],
            prayer: ['salah', 'namaz', 'fajr', 'dhuhr', 'asr', 'maghrib', 'isha'],
            salah: ['prayer', 'namaz', 'worship'],
            namaz: ['salah', 'prayer', 'worship'],
            ramadan: ['fasting', 'iftar', 'suhoor', 'laylatul qadr'],
            fasting: ['ramadan', 'fast', 'iftar', 'suhoor'],
            dua: ['supplication', 'prayer', 'asking allah'],
            supplication: ['dua', 'prayer', 'asking'],
        };

        // Expand search query with synonyms
        const getSearchTerms = (q: string): string[] => {
            const terms = [q];
            const synonymList = SYNONYMS[q];
            if (synonymList) terms.push(...synonymList);
            // Also check if q is a value in any synonym list
            Object.entries(SYNONYMS).forEach(([key, vals]) => {
                if (vals.includes(q) && !terms.includes(key)) terms.push(key);
            });
            return terms;
        };

        const results = duaDatabase.filter(dua => {
            // Filter by bookmarked
            if (selectedCategory === 'Liked') {
                if (!bookmarkedIds.includes(dua.id)) return false;
            } else if (selectedCategory !== 'All') {
                if (dua.category !== selectedCategory) return false;
            }

            // Filter by search
            if (searchQuery) {
                const query = searchQuery.toLowerCase().trim();
                const terms = getSearchTerms(query);
                const haystack = [dua.title, dua.category, dua.transliteration, dua.translation].join(' ').toLowerCase();
                return terms.some(term => haystack.includes(term));
            }

            return true;
        });

        if (!searchQuery) return results;

        // Sort by relevance: direct title match first, then synonym matches
        const q = searchQuery.toLowerCase().trim();
        return results.sort((a, b) => {
            const score = (dua: typeof a) => {
                if (dua.title.toLowerCase().startsWith(q)) return 0;
                if (dua.title.toLowerCase().includes(q)) return 1;
                if (dua.transliteration.toLowerCase().includes(q)) return 2;
                if (dua.translation.toLowerCase().includes(q)) return 3;
                return 4; // synonym match
            };
            return score(a) - score(b);
        });
    }, [selectedCategory, searchQuery, bookmarkedIds]);

    // Add Bookmarked to categories
    const allCategories = useMemo(() => ['All', 'Liked', ...categories.slice(1)], []);

    const renderDuaItem = useCallback(({ item }: { item: Dua }) => (
        <DuaCard
            dua={item}
            isBookmarked={bookmarkedIds.includes(item.id)}
            onToggleBookmark={handleToggleBookmark}
            isPlaying={playingDuaId === item.id}
            activeArabicWord={playingDuaId === item.id ? activeArabicWord : -1}
            onPlay={() => handlePlayDua(item)}
        />
    ), [bookmarkedIds, playingDuaId, activeArabicWord, handleToggleBookmark, handlePlayDua]);

    const renderPersonalDuaItem = useCallback(({ item }: { item: PersonalDua }) => {
        const date = new Date(item.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        const wordCount = item.translation ? item.translation.trim().split(/\s+/).length : 0;
        return (
            <View style={[styles.letterCard, { borderColor: colors.accent + '25', backgroundColor: colors.accent + '08' }]}>
                <View style={styles.letterCardHeader}>
                    <View style={{ flex: 1 }}>
                        <Text style={[styles.letterCardTitle, { color: colors.primaryText }]} numberOfLines={1}>{item.title}</Text>
                        <Text style={[styles.letterCardMeta, { color: colors.secondaryText }]}>{date} · {wordCount} words</Text>
                    </View>
                    <TouchableOpacity onPress={() => handleDeleteDua(item.id)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                        <Trash2 size={16} color="#ef4444" />
                    </TouchableOpacity>
                </View>
                {item.translation ? (
                    <Text style={[styles.letterCardPreview, { color: colors.secondaryText }]} numberOfLines={3}>{item.translation}</Text>
                ) : null}
            </View>
        );
    }, [handleDeleteDua, colors]);

    const renderEmptyState = () => (
        <View style={styles.emptyState}>
            <Text style={styles.emptyText}>
                {selectedCategory === 'Liked'
                    ? 'No liked duas yet. Tap the heart icon to save your favourites!'
                    : 'No duas found'}
            </Text>
        </View>
    );

    return (
        <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
            <View style={[styles.container, tabletContentStyle()]}>
                {/* Header */}
                <View style={styles.header}>
                    <Text style={[styles.headerTitle, { color: colors.accent }]}>Duas</Text>
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
                    <FlatList
                        ref={flatListRef}
                        style={{ flex: 1 }}
                        data={filteredDuas}
                        renderItem={renderDuaItem}
                        keyExtractor={item => item.id}
                        contentContainerStyle={[styles.duasContent, { flexGrow: 1 }]}
                        ListHeaderComponent={
                            <View>
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
                            </View>
                        }
                        ListEmptyComponent={renderEmptyState}
                        initialNumToRender={5}
                        maxToRenderPerBatch={10}
                        windowSize={5}
                        showsVerticalScrollIndicator={false}
                    />
                ) : (
                    <View style={{ flex: 1 }}>
                        {/* Premium journal section */}
                        {isPremium && (
                            <TouchableOpacity
                                onPress={() => setShowJournalHistory(true)}
                                style={styles.journalBanner}
                                activeOpacity={0.8}
                            >
                                <View style={[styles.journalBannerIcon, { backgroundColor: colors.accent + '18', borderColor: colors.accent + '33' }]}>
                                    <Moon size={16} color={colors.accent} />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.journalBannerTitle}>Night Journal</Text>
                                    <Text style={styles.journalBannerSub}>
                                        {journalEntries.length > 0
                                            ? `${journalEntries.length} night${journalEntries.length !== 1 ? 's' : ''} logged`
                                            : 'Reflects saved after Tahajjud'}
                                    </Text>
                                </View>
                                <BookHeart size={16} color={colors.accent} />
                            </TouchableOpacity>
                        )}
                        <FlatList
                            style={{ flex: 1 }}
                            data={personalDuas}
                            renderItem={renderPersonalDuaItem}
                            keyExtractor={item => item.id}
                            contentContainerStyle={[styles.duasContent, { flexGrow: 1 }]}
                            ListEmptyComponent={() => (
                                <View style={styles.emptyState}>
                                    <Text style={styles.emptyText}>Your heart's journey is a private conversation.</Text>
                                    <Text style={styles.emptySubtext}>Tap the ✏️ icon to write your first letter to Allah.</Text>
                                </View>
                            )}
                            showsVerticalScrollIndicator={false}
                        />
                        <TouchableOpacity
                            style={[styles.fab, { backgroundColor: colors.accent, shadowColor: colors.shadow }]}
                            onPress={() => setIsModalVisible(true)}
                        >
                            <PenTool color="#020617" size={22} />
                            {!isPremium && (
                                <View style={styles.fabBadge}>
                                    <Text style={styles.fabBadgeText}>
                                        {personalDuas.length}/{FREE_DUA_LIMIT}
                                    </Text>
                                </View>
                            )}
                        </TouchableOpacity>
                    </View>
                )}

                <TahajjudJournalHistory
                    visible={showJournalHistory}
                    onClose={() => setShowJournalHistory(false)}
                />

                {/* Add Dua Modal */}
                <Modal
                    visible={isModalVisible}
                    animationType="slide"
                    presentationStyle="pageSheet"
                    onRequestClose={() => setIsModalVisible(false)}
                >
                    <KeyboardAvoidingView
                        behavior={Platform.OS === "ios" ? "padding" : "height"}
                        style={styles.letterModal}
                    >
                        {/* Top bar */}
                        <View style={styles.letterModalTopBar}>
                            <TouchableOpacity onPress={() => setIsModalVisible(false)} style={styles.letterModalCancel}>
                                <Text style={styles.letterModalCancelText}>Cancel</Text>
                            </TouchableOpacity>
                            <View style={styles.letterModalLabelWrap}>
                                <PenTool size={11} color={colors.accent} />
                                <Text style={[styles.letterModalLabel, { color: colors.accent }]}>LETTER TO ALLAH</Text>
                            </View>
                            <TouchableOpacity
                                onPress={handleSaveDua}
                                style={[styles.letterModalSendBtn, { backgroundColor: colors.accent }]}
                            >
                                <Text style={styles.letterModalSendText}>Send</Text>
                            </TouchableOpacity>
                        </View>

                        {/* Paper area */}
                        <RNScrollView
                            style={styles.letterPaperScroll}
                            contentContainerStyle={styles.letterPaperContent}
                            showsVerticalScrollIndicator={false}
                            keyboardShouldPersistTaps="handled"
                        >
                            <Text style={[styles.letterArabicBismillah, { color: colors.accent }]}>بِسْمِ اللَّهِ</Text>

                            <TextInput
                                style={styles.letterTitleField}
                                placeholder="Subject (optional)"
                                placeholderTextColor="#334155"
                                value={newDuaTitle}
                                onChangeText={setNewDuaTitle}
                                returnKeyType="next"
                            />

                            <View style={styles.letterHRule} />

                            <TextInput
                                style={styles.letterBodyField}
                                placeholder={"Ya Allah,\n\nWrite whatever is on your heart…"}
                                placeholderTextColor="#334155"
                                value={newDuaTranslation}
                                onChangeText={setNewDuaTranslation}
                                multiline
                                autoFocus
                                textAlignVertical="top"
                            />

                            {newDuaTranslation.trim().length > 0 && (
                                <Text style={[styles.wordCountText, { color: colors.secondaryText, opacity: 0.5 }]}>
                                    {newDuaTranslation.trim().split(/\s+/).length} words
                                </Text>
                            )}
                        </RNScrollView>
                    </KeyboardAvoidingView>
                </Modal>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: 'transparent',
    },
    container: {
        flex: 1,
    },
    header: {
        paddingTop: 32,
        paddingHorizontal: 24,
        paddingBottom: 20,
    },
    headerTitle: {
        fontSize: 32,
        fontWeight: '900',
        letterSpacing: -1,
    },
    tabsContainer: {
        flexDirection: 'row',
        backgroundColor: 'rgba(255, 255, 255, 0.03)',
        borderRadius: 16,
        padding: 4,
        marginTop: 20,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.05)',
    },
    tab: {
        flex: 1,
        paddingVertical: 10,
        alignItems: 'center',
        borderRadius: 12,
    },
    activeTab: {
        backgroundColor: '#f8fafc',
    },
    tabText: {
        color: '#94a3b8',
        fontWeight: '700',
        fontSize: 14,
    },
    activeTabText: {
        color: '#020617',
    },
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginHorizontal: 20,
        marginBottom: 20,
        paddingHorizontal: 20,
        height: 56,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.08)',
        overflow: 'hidden',
        backgroundColor: 'rgba(255, 255, 255, 0.02)',
    },
    searchIcon: {
        marginRight: 12,
    },
    searchInput: {
        flex: 1,
        color: '#ffffff',
        fontSize: 16,
        fontWeight: '600',
    },
    categoriesContainer: {
        height: 44,
        marginBottom: 24,
    },
    categoriesContent: {
        paddingHorizontal: 20,
        gap: 10,
    },
    categoryPill: {
        height: 40,
        paddingHorizontal: 18,
        borderRadius: 20,
        backgroundColor: 'rgba(255, 255, 255, 0.03)',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.08)',
    },
    categoryPillActive: {
        backgroundColor: 'rgba(248, 250, 252, 0.1)',
        borderColor: '#f8fafc',
    },
    categoryText: {
        color: '#64748b',
        fontSize: 13,
        fontWeight: '700',
    },
    categoryTextActive: {
        color: '#f8fafc',
    },
    duasContent: {
        paddingHorizontal: 20,
        paddingBottom: 180,
    },
    journalBanner: {
        flexDirection: 'row', alignItems: 'center', gap: 12,
        marginHorizontal: 16, marginTop: 12, marginBottom: 4,
        padding: 14, borderRadius: 16, borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.08)',
        backgroundColor: 'rgba(255,255,255,0.03)',
    },
    journalBannerIcon: {
        width: 36, height: 36, borderRadius: 18,
        borderWidth: 1, alignItems: 'center', justifyContent: 'center',
    },
    journalBannerTitle: { color: '#f1f5f9', fontSize: 14, fontWeight: '700' },
    journalBannerSub: { color: '#475569', fontSize: 12, marginTop: 1 },
    emptyState: {
        paddingVertical: 80,
        alignItems: 'center',
        paddingHorizontal: 40,
    },
    emptyText: {
        color: '#f8fafc',
        fontSize: 18,
        fontWeight: '700',
        textAlign: 'center',
    },
    emptySubtext: {
        color: '#64748b',
        fontSize: 14,
        marginTop: 12,
        textAlign: 'center',
        lineHeight: 20,
    },
    duaCard: {
        borderRadius: 24,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.08)',
        overflow: 'hidden',
    },
    duaCardContent: {
        padding: 24,
    },
    duaCardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
    },
    categoryBadge: {
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.08)',
    },
    categoryBadgeText: {
        color: '#cbd5e1',
        fontSize: 11,
        fontWeight: '900',
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    cardActions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    actionButton: {
        width: 36,
        height: 36,
        borderRadius: 12,
        backgroundColor: 'rgba(255, 255, 255, 0.04)',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.05)',
    },
    duaTitle: {
        fontSize: 22,
        fontWeight: '800',
        color: '#f8fafc',
        marginBottom: 20,
        lineHeight: 30,
    },
    arabicContainer: {
        backgroundColor: 'rgba(248, 250, 252, 0.03)',
        padding: 24,
        borderRadius: 20,
        marginBottom: 20,
        borderWidth: 1,
        borderColor: 'rgba(248, 250, 252, 0.08)',
    },
    arabicText: {
        fontSize: 26,
        color: '#ffffff',
        textAlign: 'right',
        lineHeight: 48,
        fontFamily: Platform.OS === 'ios' ? 'Amiri' : 'System',
    },
    transliterationContainer: {
        marginBottom: 16,
    },
    transliterationLabel: {
        fontSize: 11,
        color: '#94a3b8', // Stardust Grey
        marginBottom: 6,
        fontWeight: '900',
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    transliterationText: {
        fontSize: 15,
        color: '#cbd5e1', // Lighter Grey for readability
        fontStyle: 'italic',
        lineHeight: 24,
        fontWeight: '700',
    },
    translationContainer: {
        marginBottom: 20,
    },
    translationLabel: {
        fontSize: 11,
        marginBottom: 6,
        fontWeight: '900',
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    translationText: {
        fontSize: 16,
        color: '#f8fafc', // Moonlight White
        lineHeight: 28,
        fontWeight: '600',
    },
    cardFooter: {
        marginTop: 12,
    },
    footerLine: {
        height: 1,
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        marginBottom: 16,
    },
    sourceText: {
        fontSize: 11,
        color: '#94a3b8',
        fontWeight: '900',
        textTransform: 'uppercase',
        letterSpacing: 1,
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
    letterContentContainer: {
        paddingVertical: 12,
    },
    letterText: {
        color: '#f8fafc',
        fontSize: 18,
        lineHeight: 30,
        fontWeight: '400',
    },
    fab: {
        position: 'absolute',
        bottom: 140,
        right: 24,
        width: 64,
        height: 64,
        borderRadius: 32,
        justifyContent: 'center',
        alignItems: 'center',
        elevation: 8,
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.4,
        shadowRadius: 16,
        overflow: 'visible', // Ensure shadow is seen
    },
    fabBadge: {
        position: 'absolute',
        top: -4,
        right: -4,
        backgroundColor: '#0f172a',
        borderRadius: 10,
        paddingHorizontal: 5,
        paddingVertical: 2,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.15)',
        minWidth: 28,
        alignItems: 'center',
    },
    fabBadgeText: {
        color: '#94a3b8',
        fontSize: 9,
        fontWeight: '800',
    },
    letterModal: {
        flex: 1,
        backgroundColor: '#080d1a',
    },
    letterModalTopBar: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingTop: 16,
        paddingBottom: 12,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.06)',
    },
    letterModalCancel: {
        paddingVertical: 6,
        paddingHorizontal: 4,
        minWidth: 60,
    },
    letterModalCancelText: {
        color: '#64748b',
        fontSize: 16,
        fontWeight: '500',
    },
    letterModalLabelWrap: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    letterModalLabel: {
        fontSize: 10,
        fontWeight: '800',
        letterSpacing: 1.5,
    },
    letterModalSendBtn: {
        paddingVertical: 7,
        paddingHorizontal: 18,
        borderRadius: 20,
        minWidth: 60,
        alignItems: 'center',
    },
    letterModalSendText: {
        color: '#020617',
        fontSize: 14,
        fontWeight: '800',
    },
    letterPaperScroll: {
        flex: 1,
    },
    letterPaperContent: {
        paddingHorizontal: 28,
        paddingTop: 32,
        paddingBottom: 60,
    },
    letterArabicBismillah: {
        fontSize: 22,
        textAlign: 'center',
        marginBottom: 28,
        fontWeight: '400',
    },
    letterTitleField: {
        fontSize: 22,
        fontWeight: '700',
        color: '#f8fafc',
        padding: 0,
        marginBottom: 12,
    },
    letterHRule: {
        height: 1,
        backgroundColor: 'rgba(255,255,255,0.06)',
        marginBottom: 20,
    },
    letterBodyField: {
        fontSize: 17,
        color: '#e2e8f0',
        lineHeight: 30,
        minHeight: 300,
        textAlignVertical: 'top',
        padding: 0,
        fontWeight: '400',
    },
    letterCard: {
        borderRadius: 16,
        borderWidth: 1,
        padding: 16,
        marginHorizontal: 16,
        marginBottom: 12,
        gap: 8,
    },
    letterCardHeader: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 12,
    },
    letterCardTitle: {
        fontSize: 16,
        fontWeight: '800',
    },
    letterCardMeta: {
        fontSize: 11,
        fontWeight: '600',
        marginTop: 2,
        opacity: 0.7,
    },
    letterCardPreview: {
        fontSize: 14,
        lineHeight: 20,
        opacity: 0.8,
    },
    wordCountText: {
        textAlign: 'right',
        fontSize: 11,
        color: '#475569',
        fontWeight: '600',
        marginTop: 4,
        marginBottom: 8,
    },
});
