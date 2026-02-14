import React, { useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, SafeAreaView, Linking, Share, ScrollView, Platform, Alert } from 'react-native';
import { Heart, Send, Share2 } from 'lucide-react-native';
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
        <View style={styles.card}>
            <View style={styles.cardHeader}>
                <Text style={styles.title}>{item.title}</Text>
                <TouchableOpacity onPress={() => onShare(item)}>
                    <Share2 size={20} color="#94a3b8" />
                </TouchableOpacity>
            </View>
            <Text style={styles.body}>{item.body}</Text>
            {/* Tags */}
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
                        size={18}
                        color={liked ? "#ef4444" : "#94a3b8"}
                        fill={liked ? "#ef4444" : "none"}
                    />
                    <Text style={[styles.reactionCount, liked && styles.reactionCountActive]}>
                        {count} SubhanAllah
                    </Text>
                </TouchableOpacity>
            </View>
        </View>
    );
};

export function TestimoniesTab() {
    const [selectedTopic, setSelectedTopic] = useState('All');
    const [sharingQuote, setSharingQuote] = useState<Testimony | null>(null);
    const viewShotRef = useRef<View>(null);

    const filteredStories = selectedTopic === 'All'
        ? initialTestimonies
        : initialTestimonies.filter(t => t.tags.includes(selectedTopic));

    const handleShareStory = async () => {
        // Simple submission via email
        Linking.openURL('mailto:tahajjud.stories@gmail.com?subject=My Tahajjud Story&body=Here is my story...');

        // Check for achievement - giving it for clicking share (intent to contribute)
        const newlyUnlocked = await checkAchievements('story', 1);
        if (newlyUnlocked) {
            Alert.alert(
                "Achievement Unlocked! 🏅",
                `Congratulations! You earned the "${newlyUnlocked.title}" badge for sharing your story.\n\n${newlyUnlocked.description}`,
                [{ text: "MashAllah!" }]
            );
        }
    };

    const handleShareQuote = async (item: Testimony) => {
        setSharingQuote(item);

        // Longer timeout to ensure the view is fully rendered on all devices
        setTimeout(async () => {
            try {
                if (viewShotRef.current) {
                    const uri = await captureRef(viewShotRef, {
                        format: "png",
                        quality: 1.0,
                        result: "tmpfile",
                    });

                    await Share.share({
                        url: uri,
                        message: Platform.OS === 'android' ? `"${item.body}"\n\n— ${item.title}` : undefined,
                    });
                }
            } catch (error) {
                console.error("Snapshot failed", error);
                Alert.alert("Error", "Could not generate shareable card. Please try again.");
            } finally {
                // Keep the quote set for a bit longer or don't clear it at all to avoid flickering
            }
        }, 800);
    };

    return (
        <SafeAreaView style={styles.safeArea}>
            <View style={styles.container}>
                <View style={styles.header}>
                    <Text style={styles.headerTitle}>Tahajjud Testimonies</Text>
                    <Text style={styles.headerSubtitle}>Real stories of hope and miracles</Text>
                </View>

                {/* Topics Filter */}
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

                <TouchableOpacity style={styles.fab} onPress={handleShareStory}>
                    <Send color="white" size={24} style={{ marginRight: 8 }} />
                    <Text style={styles.fabText}>Share Story</Text>
                </TouchableOpacity>

                {/* Hidden Capture View - Moved off-screen but kept opacity: 1 and always mounted */}
                <View
                    collapsable={false}
                    style={{
                        position: 'absolute',
                        left: -5000,
                        top: 0,
                        width: 1080,
                        height: 1080,
                    }}
                >
                    <QuoteShareCard
                        ref={viewShotRef}
                        testimony={sharingQuote}
                    />
                </View>
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
    listContent: {
        paddingHorizontal: 16,
        paddingBottom: 100, // Space for FAB
    },
    card: {
        backgroundColor: 'rgba(255, 255, 255, 0.03)',
        borderRadius: 16,
        padding: 20,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.05)',
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 12,
    },
    title: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#f8fafc',
        flex: 1,
        marginRight: 12,
        fontFamily: 'System',
    },
    body: {
        fontSize: 16,
        color: '#cbd5e1',
        lineHeight: 26,
        marginBottom: 16,
    },
    tagsContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        marginBottom: 16,
    },
    tagBadge: {
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
    },
    tagText: {
        color: '#94a3b8',
        fontSize: 12,
    },
    topicsContainer: {
        maxHeight: 50,
        marginBottom: 16,
    },
    topicsContent: {
        paddingHorizontal: 24,
        gap: 8,
    },
    topicPill: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
    },
    topicPillActive: {
        backgroundColor: '#f8fafc',
        borderColor: '#f8fafc',
    },
    topicText: {
        color: '#94a3b8',
        fontSize: 14,
        fontWeight: '500',
    },
    topicTextActive: {
        color: '#020617',
        fontWeight: '600',
    },
    footer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-end',
        borderTopWidth: 1,
        borderTopColor: 'rgba(255, 255, 255, 0.05)',
        paddingTop: 16,
    },
    author: {
        fontSize: 14,
        color: '#94a3b8',
        fontWeight: '600',
    },
    location: {
        fontSize: 12,
        color: '#64748b',
        marginTop: 2,
    },
    reactionButton: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: 20,
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
    },
    reactionButtonActive: {
        backgroundColor: 'rgba(239, 68, 68, 0.1)',
    },
    reactionCount: {
        marginLeft: 6,
        fontSize: 12,
        color: '#94a3b8',
        fontWeight: '500',
    },
    reactionCountActive: {
        color: '#ef4444',
    },
    fab: {
        position: 'absolute',
        bottom: 100,
        alignSelf: 'center',
        backgroundColor: '#4f46e5',
        paddingVertical: 14,
        paddingHorizontal: 24,
        borderRadius: 30,
        flexDirection: 'row',
        alignItems: 'center',
        elevation: 8,
        shadowColor: '#4f46e5',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
    },
    fabText: {
        color: 'white',
        fontWeight: 'bold',
        fontSize: 16,
    },
});
