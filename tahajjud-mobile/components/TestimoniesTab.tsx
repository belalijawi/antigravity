import React, { useState, useRef, useEffect } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, Linking, Share, ScrollView, Platform, Alert, RefreshControl, DeviceEventEmitter, Dimensions, NativeSyntheticEvent, NativeScrollEvent } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Heart, Send, Share2, BookHeart, Sparkles, PenLine } from 'lucide-react-native';
import { SubmitTestimonyModal } from './SubmitTestimonyModal';
import { GlassBg as BlurView } from './GlassBg';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getFirebaseDb } from '../utils/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { useTheme } from '../context/ThemeContext';
import { haptic } from '../utils/haptic';
import { initialTestimonies, Testimony, storyTopics } from '../data/testimonies';
import { TestimonySubmission } from '../utils/testimonySubmission';
import { captureRef } from 'react-native-view-shot';
import { QuoteShareCard } from './QuoteShareCard';
import { checkAchievements } from '../utils/achievements';


const TestimonyCard = ({ item, onShare }: { item: Testimony, onShare: (item: Testimony) => void }) => {
    const [liked, setLiked] = useState(false);
    const [count, setCount] = useState(item.reactions);
    const [reacting, setReacting] = useState(false);

    // Real Firestore testimonies have 20-char auto-generated ids; seed
    // testimonies use short ids ('1', 'c2'…) and can't be liked server-side.
    const isServerTestimony = typeof item.id === 'string' && String(item.id).length >= 12;

    // Restore the user's previous like state from Firestore
    useEffect(() => {
        if (!isServerTestimony) return;
        TestimonySubmission.hasReacted(String(item.id)).then(setLiked).catch(() => {});
    }, [item.id]);

    const handleReact = async () => {
        if (reacting) return;
        // Seed/local testimonies can't persist — fall back to local toggle
        if (!isServerTestimony) {
            setLiked(l => !l);
            setCount(c => liked ? c - 1 : c + 1);
            haptic.light();
            return;
        }
        setReacting(true);
        // Optimistic update
        const wasLiked = liked;
        setLiked(!wasLiked);
        setCount(c => wasLiked ? c - 1 : c + 1);
        haptic.light();
        try {
            const { liked: nowLiked, count } = await TestimonySubmission.toggleReaction(String(item.id));
            // Trust the server's authoritative values to prevent any drift
            setLiked(nowLiked);
            if (count !== null) setCount(count);
        } catch {
            // Revert on failure
            setLiked(wasLiked);
            setCount(c => wasLiked ? c + 1 : c - 1);
        } finally {
            setReacting(false);
        }
    };

    return (
        <Animated.View
            entering={FadeInDown.duration(800)}
            style={styles.card}
        >
            <BlurView intensity={15} tint="dark" style={StyleSheet.absoluteFill} />
            <LinearGradient
                colors={['rgba(255, 255, 255, 0.05)', 'transparent']}
                style={StyleSheet.absoluteFill}
            />

            <View style={styles.cardContent}>
                <View style={styles.cardHeader}>
                    <Text style={styles.title}>{item.title}</Text>
                    <TouchableOpacity onPress={() => onShare(item)} style={styles.iconButton}>
                        <Share2 size={18} color="#94a3b8" />
                    </TouchableOpacity>
                </View>

                <Text style={styles.body}>{item.body}</Text>

                <View style={styles.tagsContainer}>
                    {item.tags.map(tag => (
                        <View key={tag} style={styles.tagBadge}>
                            <Text style={styles.tagText}>#{tag}</Text>
                        </View>
                    ))}
                </View>

                <View style={styles.footer}>
                    <View>
                        <Text style={styles.author}>{item.author}</Text>
                        <Text style={styles.location}>{item.location}</Text>
                    </View>

                    <TouchableOpacity
                        style={[styles.reactionButton, liked && styles.reactionButtonActive]}
                        onPress={handleReact}
                    >
                        <Heart
                            size={16}
                            color={liked ? "#ef4444" : "#94a3b8"}
                            fill={liked ? "#ef4444" : "none"}
                        />
                        <Text style={[styles.reactionCount, liked && styles.reactionCountActive]}>
                            {count}
                        </Text>
                    </TouchableOpacity>
                </View>
            </View>
        </Animated.View>
    );
};


function pickFeatured(all: Testimony[]): Testimony[] {
    const shuffled = [...all].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, 5);
}

export function TestimoniesTab() {
    const { colors } = useTheme();
    const [selectedTopic, setSelectedTopic] = useState('All');
    const [sharingQuote, setSharingQuote] = useState<Testimony | null>(null);
    const [testimonies, setTestimonies] = useState<Testimony[]>(initialTestimonies);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [featured, setFeatured] = useState<Testimony[]>(() => pickFeatured(initialTestimonies));
    const [featuredIndex, setFeaturedIndex] = useState(0);
    const [showSubmit, setShowSubmit] = useState(false);
    const viewShotRef = useRef<View>(null);
    const flatListRef = useRef<FlatList>(null);
    const featuredScrollRef = useRef<FlatList<Testimony>>(null);
    // When the user swipes, pause auto-rotation for a bit so it doesn't fight
    // them. Stored as a timestamp until which auto-rotation is paused.
    const userInteractionUntilRef = useRef<number>(0);
    // Each featured "page" is the full screen width so pagingEnabled snaps cleanly.
    const SCREEN_WIDTH = Dimensions.get('window').width;
    const FEATURED_CARD_WIDTH = SCREEN_WIDTH;

    useEffect(() => {
        const sub = DeviceEventEmitter.addListener('scrollToTop', (tab: string) => {
            if (tab === 'Guide') flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
        });
        return () => sub.remove();
    }, []);

    // Cycle through featured stories every 5 seconds, but pause auto-rotation
    // for 10 seconds after the user manually swipes — so the app doesn't fight
    // their gesture by snapping back.
    useEffect(() => {
        if (featured.length <= 1) return;
        const t = setInterval(() => {
            if (Date.now() < userInteractionUntilRef.current) return;
            setFeaturedIndex(prev => {
                const next = (prev + 1) % featured.length;
                try {
                    featuredScrollRef.current?.scrollToOffset({
                        offset: next * FEATURED_CARD_WIDTH,
                        animated: true,
                    });
                } catch { /* ignore */ }
                return next;
            });
        }, 5000);
        return () => clearInterval(t);
    }, [featured.length, FEATURED_CARD_WIDTH]);

    const handleFeaturedScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
        const x = e.nativeEvent.contentOffset.x;
        const i = Math.round(x / FEATURED_CARD_WIDTH);
        if (i !== featuredIndex && i >= 0 && i < featured.length) {
            setFeaturedIndex(i);
        }
        // User swiped — pause auto-rotation for 10 seconds.
        userInteractionUntilRef.current = Date.now() + 10_000;
    };

    useEffect(() => {
        loadTestimonies();
    }, []);

    const loadTestimonies = async () => {
        try {
            // Check cache first for instant load
            const cached = await AsyncStorage.getItem('cached-testimonies');
            if (cached) {
                setTestimonies(JSON.parse(cached));
            }

            // Sync with backend
            const db = getFirebaseDb();
            if (db) {
                const q = query(
                    collection(db, 'community'),
                    where('type', '==', 'testimony')
                );

                const snapshot = await getDocs(q);
                if (!snapshot.empty) {
                    const freshData: any[] = [];
                    snapshot.forEach(doc => {
                        const data = doc.data();
                        freshData.push({
                            id: doc.id,
                            title: data.title || '',
                            body: data.body || '',
                            author: data.author || 'Anonymous',
                            location: data.location || '',
                            reactions: data.reactions || 0,
                            tags: data.tags || [],
                            createdAt: data.createdAt || 0
                        });
                    });

                    // Sort descending by timestamp in-memory to avoid index requirements
                    freshData.sort((a, b) => b.createdAt - a.createdAt);

                    setTestimonies(freshData);
                    setFeatured(pickFeatured(freshData));
                    setFeaturedIndex(0);
                    await AsyncStorage.setItem('cached-testimonies', JSON.stringify(freshData));
                }
            }
        } catch (e) {
            console.error("Failed to load testimonies:", e);
        }
    };

    const handleRefresh = async () => {
        haptic.light();
        setIsRefreshing(true);
        await loadTestimonies();
        setIsRefreshing(false);
    };

    const filteredStories = selectedTopic === 'All'
        ? testimonies
        : testimonies.filter(t => t.tags.includes(selectedTopic));

    const handleShareStory = async () => {
        haptic.medium();
        try {
            await Share.share({
                message: "Alhamdulillah, I've been using Tahajjud Plus for my night prayers. It's truly changed my connection with Allah. Check it out!",
                title: "My Tahajjud Journey",
            });
            const newlyUnlocked = await checkAchievements('story', 1);
            if (newlyUnlocked) {
                Alert.alert("Achievement Unlocked!", `You earned the "${newlyUnlocked.title}" badge.`);
            }
        } catch (_) {}
    };

    const handleShareQuote = async (item: Testimony) => {
        haptic.medium();
        setSharingQuote(item);
        setTimeout(async () => {
            try {
                if (viewShotRef.current) {
                    const uri = await captureRef(viewShotRef, { format: "png", quality: 1.0 });
                    await Share.share({ url: uri, message: `"${item.body}"\n\n— ${item.title}` });
                }
            } catch (error) {
                console.error("Snapshot failed", error);
            }
        }, 800);
    };

    return (
        <View style={styles.container}>
            <FlatList
                ref={flatListRef}
                style={{ flex: 1 }}
                data={filteredStories}
                renderItem={({ item }) => <TestimonyCard item={item} onShare={handleShareQuote} />}
                keyExtractor={item => item.id}
                contentContainerStyle={[styles.listContent, { flexGrow: 1 }]}
                removeClippedSubviews={Platform.OS === 'android'}
                initialNumToRender={6}
                maxToRenderPerBatch={4}
                windowSize={5}
                refreshControl={
                    <RefreshControl
                        refreshing={isRefreshing}
                        onRefresh={handleRefresh}
                        tintColor={colors.accent}
                        colors={[colors.accent]}
                    />
                }
                ListHeaderComponent={
                    <View>
                        <View style={styles.header}>
                            <Text style={[styles.headerTitle, { color: colors.accent }]}>Reflections</Text>
                            <Text style={[styles.headerSubtitle, { color: colors.secondaryText }]}>Echoes of faith from the silent hours</Text>
                        </View>

                        {/* Featured stories — auto-rotating + swipeable horizontal pager.
                            Negative margin breaks out of the parent FlatList's
                            paddingHorizontal: 20 so the inner pager spans the
                            full screen width — required for pagingEnabled to
                            snap each card cleanly. */}
                        {featured.length > 0 && (
                            <View style={{ marginHorizontal: -20 }}>
                                <FlatList
                                    ref={featuredScrollRef}
                                    data={featured}
                                    keyExtractor={(item) => item.id}
                                    horizontal
                                    pagingEnabled
                                    showsHorizontalScrollIndicator={false}
                                    onMomentumScrollEnd={handleFeaturedScroll}
                                    decelerationRate="fast"
                                    renderItem={({ item }) => (
                                        <View style={{ width: SCREEN_WIDTH, paddingHorizontal: 20 }}>
                                            <TouchableOpacity
                                                activeOpacity={0.85}
                                                style={[styles.featuredCard, { marginHorizontal: 0 }]}
                                                onPress={() => setSharingQuote(item)}
                                            >
                                                <BlurView intensity={20} tint="dark" style={StyleSheet.absoluteFill} />
                                                <LinearGradient
                                                    colors={[colors.accent + '22', 'transparent']}
                                                    style={StyleSheet.absoluteFill}
                                                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                                                />
                                                <View style={styles.featuredBadge}>
                                                    <Sparkles size={11} color={colors.accent} />
                                                    <Text style={[styles.featuredBadgeText, { color: colors.accent }]}>Featured</Text>
                                                </View>
                                                <Text style={styles.featuredTitle} numberOfLines={1}>{item.title}</Text>
                                                <Text style={styles.featuredBody} numberOfLines={3}>{item.body}</Text>
                                                <Text style={styles.featuredAuthor}>{item.author} · {item.location}</Text>
                                            </TouchableOpacity>
                                        </View>
                                    )}
                                />
                                <View style={[styles.featuredDots, { alignSelf: 'center', marginTop: 8, marginBottom: 16 }]}>
                                    {featured.map((_, i) => (
                                        <View key={i} style={[styles.featuredDot, i === featuredIndex && { backgroundColor: colors.accent, width: 14 }]} />
                                    ))}
                                </View>
                            </View>
                        )}

                        <View style={styles.topicsContainer}>
                            <ScrollView
                                horizontal
                                showsHorizontalScrollIndicator={false}
                                contentContainerStyle={styles.topicsContent}
                            >
                                {storyTopics.map(topic => (
                                    <TouchableOpacity
                                        key={topic}
                                        onPress={() => setSelectedTopic(topic)}
                                        style={[
                                            styles.topicPill,
                                            selectedTopic === topic && styles.topicPillActive
                                        ]}
                                    >
                                        {selectedTopic === topic && (
                                            <View style={styles.pillGlow} />
                                        )}
                                        <Text style={[
                                            styles.topicText,
                                            selectedTopic === topic && styles.topicTextActive
                                        ]}>
                                            {topic}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </ScrollView>
                        </View>
                    </View>
                }
                showsVerticalScrollIndicator={false}
            />

            <TouchableOpacity
                style={[styles.fab, { shadowColor: colors.shadow }]}
                onPress={() => { haptic.medium(); setShowSubmit(true); }}
                accessibilityLabel="Share your Tahajjud story"
                accessibilityRole="button"
            >
                <LinearGradient
                    colors={colors.accentGradient}
                    style={StyleSheet.absoluteFill}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                />
                <PenLine color="#020617" size={20} strokeWidth={2.5} />
                <Text style={styles.fabText}>Share Your Story</Text>
            </TouchableOpacity>

            <SubmitTestimonyModal visible={showSubmit} onClose={() => setShowSubmit(false)} />

            <View collapsable={false} style={styles.captureBuffer}>
                <QuoteShareCard ref={viewShotRef} testimony={sharingQuote} />
            </View>
        </View >
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
        paddingBottom: 24,
    },
    headerTitle: {
        fontSize: 32,
        fontWeight: '900',
        color: '#facc15', // Fallback
        letterSpacing: -1,
    },
    headerSubtitle: {
        fontSize: 15,
        color: '#cbd5e1',
        fontWeight: '600',
        marginTop: 4,
    },
    listContent: {
        paddingHorizontal: 20,
        paddingBottom: 180,
    },
    card: {
        borderRadius: 24,
        marginBottom: 20,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.08)',
        overflow: 'hidden',
    },
    cardContent: {
        padding: 24,
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 16,
    },
    title: {
        fontSize: 20,
        fontWeight: '800',
        color: '#f8fafc',
        flex: 1,
        lineHeight: 28,
    },
    iconButton: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    body: {
        fontSize: 16,
        color: '#cbd5e1',
        lineHeight: 26,
        marginBottom: 20,
        fontWeight: '500',
    },
    tagsContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        marginBottom: 24,
    },
    tagBadge: {
        backgroundColor: 'rgba(255, 255, 255, 0.04)',
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.06)',
    },
    tagText: {
        color: '#cbd5e1',
        fontSize: 12,
        fontWeight: '700',
    },
    featuredCard: {
        marginHorizontal: 20,
        marginBottom: 20,
        borderRadius: 20,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
        padding: 20,
        gap: 8,
    },
    featuredBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        marginBottom: 4,
    },
    featuredBadgeText: {
        fontSize: 11,
        fontWeight: '800',
        letterSpacing: 0.8,
        textTransform: 'uppercase',
    },
    featuredTitle: {
        fontSize: 18,
        fontWeight: '800',
        color: '#f8fafc',
    },
    featuredBody: {
        fontSize: 14,
        color: '#94a3b8',
        lineHeight: 22,
    },
    featuredFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: 4,
    },
    featuredAuthor: {
        fontSize: 12,
        color: '#475569',
        fontWeight: '700',
    },
    featuredDots: {
        flexDirection: 'row',
        gap: 4,
        alignItems: 'center',
    },
    featuredDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: 'rgba(255,255,255,0.2)',
    },
    topicsContainer: {
        height: 44,
        marginBottom: 24,
    },
    topicsContent: {
        paddingHorizontal: 24,
        gap: 10,
    },
    topicPill: {
        height: 40,
        paddingHorizontal: 20,
        borderRadius: 20,
        backgroundColor: 'rgba(255, 255, 255, 0.03)',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.08)',
        overflow: 'hidden',
    },
    topicPillActive: {
        backgroundColor: 'rgba(248, 250, 252, 0.15)',
        borderColor: '#f8fafc',
    },
    pillGlow: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
    },
    topicText: {
        color: '#cbd5e1',
        fontSize: 14,
        fontWeight: '800',
    },
    topicTextActive: {
        color: '#f8fafc',
    },
    footer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-end',
        borderTopWidth: 1,
        borderTopColor: 'rgba(255, 255, 255, 0.06)',
        paddingTop: 20,
    },
    author: {
        fontSize: 14,
        color: '#f8fafc',
        fontWeight: '700',
    },
    location: {
        fontSize: 12,
        color: '#64748b',
        marginTop: 2,
        fontWeight: '700',
    },
    reactionButton: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 8,
        paddingHorizontal: 16,
        borderRadius: 16,
        backgroundColor: 'rgba(255, 255, 255, 0.03)',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.06)',
    },
    reactionButtonActive: {
        backgroundColor: 'rgba(239, 68, 68, 0.12)',
        borderColor: 'rgba(239, 68, 68, 0.35)',
    },
    reactionCount: {
        marginLeft: 8,
        fontSize: 13,
        color: '#94a3b8',
        fontWeight: '800',
    },
    reactionCountActive: {
        color: '#ef4444',
    },
    fab: {
        position: 'absolute',
        bottom: 140,
        alignSelf: 'center',
        height: 60,
        paddingHorizontal: 28,
        borderRadius: 30,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        overflow: 'hidden',
        elevation: 8,
        shadowColor: '#facc15',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.4,
        shadowRadius: 16,
    },
    fabText: {
        color: '#0f172a',
        fontWeight: '900',
        fontSize: 16,
        letterSpacing: 0.2,
    },
    captureBuffer: {
        position: 'absolute',
        left: -5000,
        top: 0,
        width: 1080,
        height: 1080,
    }
});
