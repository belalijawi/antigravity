import React, { useEffect, useState, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Modal,
    TouchableOpacity,
    TextInput,
    FlatList,
    ScrollView,
    Platform,
    KeyboardAvoidingView,
    StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { X, Check, Plus } from 'lucide-react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { QuranService, SurahMeta } from '../services/QuranService';
import { fuzzyMatch } from '../utils/fuzzy';
import { QuranPlaylist } from '../utils/quranPlaylists';
import { useTheme } from '../context/ThemeContext';
import { haptic } from '../utils/haptic';

interface Props {
    visible: boolean;
    onClose: () => void;
    onSave: (playlist: QuranPlaylist) => void;
    editPlaylist?: QuranPlaylist;
}

export function PlaylistBuilder({ visible, onClose, onSave, editPlaylist }: Props) {
    const { colors, cardBg, blurIntensity } = useTheme();
    const [name, setName] = useState('');
    const [selected, setSelected] = useState<number[]>([]);
    const [surahs, setSurahs] = useState<SurahMeta[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [filtered, setFiltered] = useState<SurahMeta[]>([]);

    // Load surah list once
    useEffect(() => {
        QuranService.getSurahList().then(list => {
            setSurahs(list);
            setFiltered(list);
        });
    }, []);

    // Pre-fill when editing
    useEffect(() => {
        if (visible) {
            if (editPlaylist) {
                setName(editPlaylist.name);
                setSelected([...editPlaylist.surahNumbers]);
            } else {
                setName('');
                setSelected([]);
            }
            setSearchQuery('');
            setFiltered(surahs);
        }
    }, [visible, editPlaylist]);

    const handleSearch = useCallback((text: string) => {
        setSearchQuery(text);
        if (!text.trim()) {
            setFiltered(surahs);
            return;
        }
        const results = surahs.filter(s =>
            s.number.toString() === text.trim() ||
            fuzzyMatch(text, s.englishName, s.englishNameTranslation, s.name)
        );
        setFiltered(results);
    }, [surahs]);

    const toggleSurah = (num: number) => {
        haptic.light();
        setSelected(prev => {
            if (prev.includes(num)) {
                return prev.filter(n => n !== num);
            }
            return [...prev, num];
        });
    };

    const removeFromStrip = (num: number) => {
        haptic.light();
        setSelected(prev => prev.filter(n => n !== num));
    };

    const handleSave = () => {
        if (!name.trim() || selected.length === 0) return;
        haptic.success();
        const playlist: QuranPlaylist = editPlaylist
            ? { ...editPlaylist, name: name.trim(), surahNumbers: selected }
            : {
                id: `playlist_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
                name: name.trim(),
                surahNumbers: selected,
                createdAt: Date.now(),
            };
        onSave(playlist);
    };

    const canSave = name.trim().length > 0 && selected.length > 0;
    const isEditing = Boolean(editPlaylist);

    // Map for quick lookup
    const surahMap = React.useMemo(() => {
        const m: Record<number, SurahMeta> = {};
        surahs.forEach(s => { m[s.number] = s; });
        return m;
    }, [surahs]);

    const renderSurahRow = ({ item }: { item: SurahMeta }) => {
        const isAdded = selected.includes(item.number);
        return (
            <TouchableOpacity
                style={[styles.surahRow, { borderBottomColor: 'rgba(255,255,255,0.05)' }]}
                onPress={() => toggleSurah(item.number)}
                activeOpacity={0.7}
            >
                <View style={[styles.numberBadge, { borderColor: 'rgba(255,255,255,0.08)' }]}>
                    <Text style={styles.numberText}>{item.number}</Text>
                </View>
                <View style={styles.surahInfo}>
                    <Text style={styles.surahName}>{item.englishName}</Text>
                    <Text style={styles.surahTranslation}>{item.englishNameTranslation}</Text>
                </View>
                <View style={[
                    styles.addButton,
                    isAdded
                        ? { backgroundColor: colors.accent + '22', borderColor: colors.accent + '66' }
                        : { backgroundColor: 'rgba(255,255,255,0.06)', borderColor: 'rgba(255,255,255,0.12)' }
                ]}>
                    {isAdded ? (
                        <Check size={16} color={colors.accent} strokeWidth={2.5} />
                    ) : (
                        <Plus size={16} color="#64748b" strokeWidth={2.5} />
                    )}
                </View>
            </TouchableOpacity>
        );
    };

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

                <KeyboardAvoidingView
                    style={{ flex: 1 }}
                    behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                    keyboardVerticalOffset={0}
                >
                    <SafeAreaView style={{ flex: 1 }} edges={['top', 'left', 'right']}>
                        {/* Header */}
                        <View style={styles.header}>
                            <TouchableOpacity onPress={onClose} style={styles.headerIconBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                                <X size={22} color="#94a3b8" />
                            </TouchableOpacity>
                            <Text style={styles.headerTitle}>
                                {isEditing ? 'Edit Playlist' : 'New Playlist'}
                            </Text>
                            <TouchableOpacity
                                onPress={handleSave}
                                disabled={!canSave}
                                style={[
                                    styles.saveButton,
                                    canSave
                                        ? { backgroundColor: colors.accent }
                                        : { backgroundColor: 'rgba(255,255,255,0.08)' }
                                ]}
                            >
                                <Text style={[styles.saveButtonText, canSave ? { color: '#000' } : { color: '#475569' }]}>
                                    Save
                                </Text>
                            </TouchableOpacity>
                        </View>

                        {/* Name Input */}
                        <View style={styles.nameInputWrapper}>
                            <BlurView
                                intensity={Math.round(12 * blurIntensity)}
                                tint="dark"
                                style={[StyleSheet.absoluteFill, { backgroundColor: cardBg }]}
                            />
                            <TextInput
                                style={styles.nameInput}
                                placeholder="Playlist name..."
                                placeholderTextColor="rgba(255,255,255,0.2)"
                                value={name}
                                onChangeText={setName}
                                returnKeyType="done"
                                maxLength={60}
                            />
                        </View>

                        {/* Selected surahs strip */}
                        {selected.length > 0 && (
                            <View style={styles.stripWrapper}>
                                <ScrollView
                                    horizontal
                                    showsHorizontalScrollIndicator={false}
                                    contentContainerStyle={styles.stripContent}
                                >
                                    {selected.map(num => {
                                        const s = surahMap[num];
                                        if (!s) return null;
                                        return (
                                            <View key={num} style={[styles.chip, { borderColor: colors.accent + '55', backgroundColor: colors.accent + '15' }]}>
                                                <Text style={[styles.chipText, { color: colors.accent }]}>
                                                    {s.englishName}
                                                </Text>
                                                <TouchableOpacity
                                                    onPress={() => removeFromStrip(num)}
                                                    hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                                                >
                                                    <X size={12} color={colors.accent} strokeWidth={2.5} />
                                                </TouchableOpacity>
                                            </View>
                                        );
                                    })}
                                </ScrollView>
                            </View>
                        )}

                        {/* Search */}
                        <View style={styles.searchWrapper}>
                            <BlurView
                                intensity={Math.round(8 * blurIntensity)}
                                tint="dark"
                                style={[StyleSheet.absoluteFill, { backgroundColor: cardBg }]}
                            />
                            <Text style={styles.searchIcon}>🔍</Text>
                            <TextInput
                                style={styles.searchInput}
                                placeholder="Search surahs..."
                                placeholderTextColor="rgba(255,255,255,0.2)"
                                value={searchQuery}
                                onChangeText={handleSearch}
                                returnKeyType="search"
                                maxFontSizeMultiplier={1.2}
                            />
                        </View>

                        {/* Surah list */}
                        <FlatList
                            data={filtered}
                            keyExtractor={item => item.number.toString()}
                            renderItem={renderSurahRow}
                            contentContainerStyle={styles.listContent}
                            showsVerticalScrollIndicator={false}
                            initialNumToRender={20}
                            keyboardShouldPersistTaps="handled"
                        />
                    </SafeAreaView>
                </KeyboardAvoidingView>
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
    saveButton: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
    },
    saveButtonText: {
        fontSize: 14,
        fontWeight: '800',
    },
    nameInputWrapper: {
        marginHorizontal: 20,
        marginTop: 16,
        marginBottom: 8,
        height: 52,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.10)',
        overflow: 'hidden',
        justifyContent: 'center',
    },
    nameInput: {
        color: '#f8fafc',
        fontSize: 16,
        fontWeight: '700',
        paddingHorizontal: 16,
    },
    stripWrapper: {
        marginVertical: 8,
    },
    stripContent: {
        paddingHorizontal: 20,
        gap: 8,
        alignItems: 'center',
    },
    chip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
        borderWidth: 1,
    },
    chipText: {
        fontSize: 12,
        fontWeight: '700',
    },
    searchWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        marginHorizontal: 20,
        marginTop: 6,
        marginBottom: 4,
        minHeight: 48,
        paddingVertical: 8,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.08)',
        overflow: 'hidden',
        paddingHorizontal: 14,
    },
    searchIcon: {
        fontSize: 14,
        marginRight: 8,
    },
    searchInput: {
        flex: 1,
        color: '#f8fafc',
        fontSize: 15,
        lineHeight: 22,
        fontWeight: '600',
    },
    listContent: {
        paddingHorizontal: 20,
        paddingTop: 8,
        paddingBottom: 60,
    },
    surahRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        borderBottomWidth: StyleSheet.hairlineWidth,
    },
    numberBadge: {
        width: 40,
        height: 40,
        borderRadius: 12,
        backgroundColor: 'rgba(255,255,255,0.04)',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        marginRight: 14,
    },
    numberText: {
        color: '#94a3b8',
        fontSize: 13,
        fontWeight: '800',
    },
    surahInfo: {
        flex: 1,
    },
    surahName: {
        color: '#f8fafc',
        fontSize: 15,
        fontWeight: '700',
    },
    surahTranslation: {
        color: '#64748b',
        fontSize: 12,
        fontWeight: '600',
        marginTop: 2,
    },
    addButton: {
        width: 36,
        height: 36,
        borderRadius: 18,
        borderWidth: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
});
