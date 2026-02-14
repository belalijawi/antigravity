import React, { useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, SafeAreaView, Linking, Share, ScrollView, Platform, Alert } from 'react-native';
import { Heart, Send, Share2, BookHeart, Sparkles } from 'lucide-react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import { useTheme } from '../context/ThemeContext';
import { haptic } from '../utils/haptic';
import { initialTestimonies, Testimony, storyTopics } from '../data/testimonies';
import { captureRef } from 'react-native-view-shot';
import { QuoteShareCard } from './QuoteShareCard';
import { checkAchievements } from '../utils/achievements';
import { useRef } from 'react';

const TestimonyCard = ({ item, onShare }: { item: Testimony, onShare: (item: Testimony) => void }) => {
    const [liked, setLiked] = useState(false);
    const [count, setCount] = useState(item.reactions);

    const handleReact = () => {
        if (!liked) {
            setLiked(true);
            setCount(c => c + 1);
        } else {
            setLiked(false);
            setCount(c => c - 1);
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
                            color={liked ? "#f8fafc" : "#94a3b8"}
                            fill={liked ? "#f8fafc" : "none"}
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


export function TestimoniesTab() {
    const { colors } = useTheme();
    const [selectedTopic, setSelectedTopic] = useState('All');
    const [sharingQuote, setSharingQuote] = useState<Testimony | null>(null);
    const viewShotRef = useRef<View>(null);

    const filteredStories = selectedTopic === 'All'
        ? initialTestimonies
        : initialTestimonies.filter(t => t.tags.includes(selectedTopic));

    const handleShareStory = async () => {
        Linking.openURL('mailto:tahajjud.letters@gmail.com?subject=My Tahajjud Story&body=Here is my story...');
        const newlyUnlocked = await checkAchievements('story', 1);
        if (newlyUnlocked) {
            Alert.alert("Achievement Unlocked!", `You earned the "${newlyUnlocked.title}" badge.`);
        }
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
        <SafeAreaView style={styles.safeArea}>
            <View style={styles.container}>
                <View style={styles.header}>
                    <Text style={[styles.headerTitle, { color: colors.accent }]}>Reflections</Text>
                    <Text style={[styles.headerSubtitle, { color: colors.secondaryText }]}>Echoes of faith from the silent hours</Text>
                </View>

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

                <FlatList
                    data={filteredStories}
                    renderItem={({ item }) => <TestimonyCard item={item} onShare={handleShareQuote} />}
                    keyExtractor={item => item.id}
                    contentContainerStyle={styles.listContent}
                    showsVerticalScrollIndicator={false}
                />

                <TouchableOpacity style={[styles.fab, { shadowColor: colors.shadow }]} onPress={handleShareStory}>
                    <LinearGradient
                        colors={colors.accentGradient} // Dynamic Gradient
                        style={StyleSheet.absoluteFill}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                    />
                    <Send color="#020617" size={20} strokeWidth={2.5} />
                    <Text style={styles.fabText}>Share Reflection</Text>
                </TouchableOpacity>

                <View collapsable={false} style={styles.captureBuffer}>
                    <QuoteShareCard ref={viewShotRef} testimony={sharingQuote} />
                </View>
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
        paddingBottom: 120,
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
        backgroundColor: 'rgba(248, 250, 252, 0.08)',
        borderColor: 'rgba(248, 250, 252, 0.2)',
    },
    reactionCount: {
        marginLeft: 8,
        fontSize: 13,
        color: '#94a3b8',
        fontWeight: '800',
    },
    reactionCountActive: {
        color: '#f8fafc',
    },
    fab: {
        position: 'absolute',
        bottom: 120,
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
