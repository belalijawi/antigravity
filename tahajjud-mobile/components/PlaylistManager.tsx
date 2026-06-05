import React, { useEffect, useState, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Modal,
    TouchableOpacity,
    FlatList,
    Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { X, Play, Pencil, Trash2, Plus, ListMusic, Lock } from 'lucide-react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { QuranPlaylist, QuranPlaylists } from '../utils/quranPlaylists';
import { QuranService, SurahMeta } from '../services/QuranService';
import { PlaylistBuilder } from './PlaylistBuilder';
import { useTheme } from '../context/ThemeContext';
import { usePurchases } from '../context/PurchasesContext';
import { haptic } from '../utils/haptic';

interface Props {
    visible: boolean;
    onClose: () => void;
    onPlay: (playlist: QuranPlaylist) => void;
}

export function PlaylistManager({ visible, onClose, onPlay }: Props) {
    const { colors, cardBg, blurIntensity } = useTheme();
    const { isPremium, openPaywall } = usePurchases();
    const [playlists, setPlaylists] = useState<QuranPlaylist[]>([]);
    const [surahMap, setSurahMap] = useState<Record<number, SurahMeta>>({});
    const [builderVisible, setBuilderVisible] = useState(false);
    const [editingPlaylist, setEditingPlaylist] = useState<QuranPlaylist | undefined>(undefined);

    // Load surah names for display
    useEffect(() => {
        QuranService.getSurahList().then(list => {
            const m: Record<number, SurahMeta> = {};
            list.forEach(s => { m[s.number] = s; });
            setSurahMap(m);
        });
    }, []);

    const loadPlaylists = useCallback(async () => {
        const all = await QuranPlaylists.getAll();
        setPlaylists(all);
    }, []);

    useEffect(() => {
        if (visible) loadPlaylists();
    }, [visible, loadPlaylists]);

    const handleDelete = (playlist: QuranPlaylist) => {
        haptic.medium();
        Alert.alert(
            'Delete Playlist',
            `Delete "${playlist.name}"? This cannot be undone.`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                        await QuranPlaylists.delete(playlist.id);
                        haptic.success();
                        loadPlaylists();
                    },
                },
            ]
        );
    };

    const handleEdit = (playlist: QuranPlaylist) => {
        haptic.light();
        setEditingPlaylist(playlist);
        setBuilderVisible(true);
    };

    const handleNewPlaylist = () => {
        haptic.light();
        setEditingPlaylist(undefined);
        setBuilderVisible(true);
    };

    const handleBuilderSave = async (playlist: QuranPlaylist) => {
        await QuranPlaylists.save(playlist);
        setBuilderVisible(false);
        setEditingPlaylist(undefined);
        loadPlaylists();
    };

    const handlePlay = (playlist: QuranPlaylist) => {
        haptic.success();
        onPlay(playlist);
        onClose();
    };

    const getSurahPreview = (surahNumbers: number[]): string => {
        const names = surahNumbers
            .slice(0, 3)
            .map(n => surahMap[n]?.englishName ?? `#${n}`)
            .join(', ');
        return names + (surahNumbers.length > 3 ? '…' : '');
    };

    // Paywall gate
    if (!isPremium) {
        return (
            <Modal
                visible={visible}
                animationType="slide"
                presentationStyle="pageSheet"
                onRequestClose={onClose}
            >
                <View style={styles.root}>
                    <LinearGradient
                        colors={['#060d1f', '#0a1628', '#060d1f']}
                        style={StyleSheet.absoluteFill}
                    />
                    <SafeAreaView style={{ flex: 1 }} edges={['top', 'left', 'right']}>
                        <View style={styles.header}>
                            <TouchableOpacity onPress={onClose} style={styles.headerIconBtn}>
                                <X size={22} color="#94a3b8" />
                            </TouchableOpacity>
                            <Text style={styles.headerTitle}>My Playlists</Text>
                            <View style={{ width: 36 }} />
                        </View>

                        <View style={styles.paywallContainer}>
                            <View style={[styles.paywallIconWrap, { borderColor: colors.accent + '44', backgroundColor: colors.accent + '11' }]}>
                                <Lock size={36} color={colors.accent} />
                            </View>
                            <Text style={styles.paywallTitle}>Premium Feature</Text>
                            <Text style={styles.paywallBody}>
                                Quran Playlists let you create custom sequences of surahs for continuous recitation. Upgrade to Premium to unlock.
                            </Text>
                            <TouchableOpacity
                                onPress={() => { onClose(); openPaywall(); }}
                                style={[styles.upgradeButton, { backgroundColor: colors.accent }]}
                            >
                                <Text style={styles.upgradeButtonText}>Unlock Premium</Text>
                            </TouchableOpacity>
                        </View>
                    </SafeAreaView>
                </View>
            </Modal>
        );
    }

    const renderItem = ({ item }: { item: QuranPlaylist }) => (
        <View style={styles.card}>
            <BlurView
                intensity={Math.round(15 * blurIntensity)}
                tint="dark"
                style={[StyleSheet.absoluteFill, { backgroundColor: cardBg }]}
            />
            <LinearGradient
                colors={['rgba(255,255,255,0.04)', 'transparent']}
                style={StyleSheet.absoluteFill}
            />

            <TouchableOpacity
                style={[styles.playBtn, { backgroundColor: colors.accent }]}
                onPress={() => handlePlay(item)}
            >
                <Play size={18} color="#000" fill="#000" style={{ marginLeft: 2 }} />
            </TouchableOpacity>

            <View style={styles.cardBody}>
                <Text style={styles.cardName} numberOfLines={1}>{item.name}</Text>
                <Text style={styles.cardSubtitle} numberOfLines={1}>
                    {item.surahNumbers.length} {item.surahNumbers.length === 1 ? 'surah' : 'surahs'} · {getSurahPreview(item.surahNumbers)}
                </Text>
            </View>

            <View style={styles.cardActions}>
                <TouchableOpacity onPress={() => handleEdit(item)} style={styles.actionBtn}>
                    <Pencil size={16} color="#64748b" />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => handleDelete(item)} style={styles.actionBtn}>
                    <Trash2 size={16} color="#ef4444" />
                </TouchableOpacity>
            </View>
        </View>
    );

    return (
        <Modal
            visible={visible}
            animationType="slide"
            presentationStyle="pageSheet"
            onRequestClose={onClose}
        >
            <View style={styles.root}>
                <LinearGradient
                    colors={['#060d1f', '#0a1628', '#060d1f']}
                    style={StyleSheet.absoluteFill}
                />
                <SafeAreaView style={{ flex: 1 }} edges={['top', 'left', 'right']}>
                    {/* Header */}
                    <View style={styles.header}>
                        <TouchableOpacity onPress={onClose} style={styles.headerIconBtn}>
                            <X size={22} color="#94a3b8" />
                        </TouchableOpacity>
                        <Text style={styles.headerTitle}>My Playlists</Text>
                        <TouchableOpacity
                            onPress={handleNewPlaylist}
                            style={[styles.newButton, { borderColor: colors.accent + '55', backgroundColor: colors.accent + '15' }]}
                        >
                            <Plus size={14} color={colors.accent} strokeWidth={2.5} />
                            <Text style={[styles.newButtonText, { color: colors.accent }]}>New</Text>
                        </TouchableOpacity>
                    </View>

                    {/* List or empty state */}
                    {playlists.length === 0 ? (
                        <View style={styles.emptyContainer}>
                            <View style={[styles.emptyIconWrap, { borderColor: 'rgba(255,255,255,0.08)', backgroundColor: 'rgba(255,255,255,0.04)' }]}>
                                <ListMusic size={40} color="#334155" />
                            </View>
                            <Text style={styles.emptyTitle}>No playlists yet</Text>
                            <Text style={styles.emptyBody}>Tap + New to create your first Quran playlist.</Text>
                            <TouchableOpacity
                                onPress={handleNewPlaylist}
                                style={[styles.emptyCreateBtn, { backgroundColor: colors.accent }]}
                            >
                                <Plus size={16} color="#000" strokeWidth={2.5} />
                                <Text style={styles.emptyCreateText}>Create Playlist</Text>
                            </TouchableOpacity>
                        </View>
                    ) : (
                        <FlatList
                            data={playlists}
                            keyExtractor={item => item.id}
                            renderItem={renderItem}
                            contentContainerStyle={styles.listContent}
                            showsVerticalScrollIndicator={false}
                        />
                    )}
                </SafeAreaView>

                {/* PlaylistBuilder lives inside this modal so iOS can present it */}
                <PlaylistBuilder
                    visible={builderVisible}
                    onClose={() => {
                        setBuilderVisible(false);
                        setEditingPlaylist(undefined);
                    }}
                    onSave={handleBuilderSave}
                    editPlaylist={editingPlaylist}
                />
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    root: {
        flex: 1,
        backgroundColor: '#060d1f',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 16,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.07)',
    },
    headerIconBtn: {
        width: 36,
        height: 36,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 18,
        backgroundColor: 'rgba(255,255,255,0.06)',
    },
    headerTitle: {
        flex: 1,
        textAlign: 'center',
        color: '#f8fafc',
        fontSize: 17,
        fontWeight: '800',
        letterSpacing: 0.2,
    },
    newButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 12,
        paddingVertical: 7,
        borderRadius: 20,
        borderWidth: 1,
    },
    newButtonText: {
        fontSize: 13,
        fontWeight: '800',
    },
    listContent: {
        padding: 20,
        paddingBottom: 60,
        gap: 12,
    },
    card: {
        flexDirection: 'row',
        alignItems: 'center',
        height: 76,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.07)',
        overflow: 'hidden',
        paddingHorizontal: 14,
        gap: 12,
    },
    playBtn: {
        width: 42,
        height: 42,
        borderRadius: 21,
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
    },
    cardBody: {
        flex: 1,
    },
    cardName: {
        color: '#f8fafc',
        fontSize: 15,
        fontWeight: '800',
    },
    cardSubtitle: {
        color: '#64748b',
        fontSize: 12,
        fontWeight: '600',
        marginTop: 3,
    },
    cardActions: {
        flexDirection: 'row',
        gap: 4,
    },
    actionBtn: {
        width: 36,
        height: 36,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 18,
        backgroundColor: 'rgba(255,255,255,0.04)',
    },
    emptyContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 40,
        gap: 12,
    },
    emptyIconWrap: {
        width: 80,
        height: 80,
        borderRadius: 40,
        borderWidth: 1,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 4,
    },
    emptyTitle: {
        color: '#f8fafc',
        fontSize: 20,
        fontWeight: '800',
        textAlign: 'center',
    },
    emptyBody: {
        color: '#64748b',
        fontSize: 14,
        fontWeight: '600',
        textAlign: 'center',
        lineHeight: 20,
    },
    emptyCreateBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginTop: 8,
        paddingHorizontal: 20,
        paddingVertical: 12,
        borderRadius: 24,
    },
    emptyCreateText: {
        color: '#000',
        fontSize: 15,
        fontWeight: '800',
    },
    // Paywall styles
    paywallContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 40,
        gap: 16,
    },
    paywallIconWrap: {
        width: 88,
        height: 88,
        borderRadius: 44,
        borderWidth: 1,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 8,
    },
    paywallTitle: {
        color: '#f8fafc',
        fontSize: 24,
        fontWeight: '900',
        textAlign: 'center',
    },
    paywallBody: {
        color: '#94a3b8',
        fontSize: 15,
        fontWeight: '600',
        textAlign: 'center',
        lineHeight: 22,
    },
    upgradeButton: {
        marginTop: 8,
        paddingHorizontal: 32,
        paddingVertical: 14,
        borderRadius: 28,
    },
    upgradeButtonText: {
        color: '#000',
        fontSize: 16,
        fontWeight: '900',
    },
});
