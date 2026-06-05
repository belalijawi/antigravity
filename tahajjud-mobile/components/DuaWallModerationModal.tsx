import React, { useEffect, useState } from 'react';
import {
    Modal, View, Text, TouchableOpacity, StyleSheet, ScrollView,
    ActivityIndicator, Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { X, Eye, EyeOff, Trash2, RefreshCw, AlertTriangle, Flag } from 'lucide-react-native';
import { useTheme } from '../context/ThemeContext';
import { DuaWall, PublicDua } from '../utils/duaWall';
import { isCurrentUserAdmin } from '../utils/admins';
import { haptic } from '../utils/haptic';
import { formatDistanceToNowStrict } from 'date-fns';

interface Props { visible: boolean; onClose: () => void; }

export function DuaWallModerationModal({ visible, onClose }: Props) {
    const { colors } = useTheme();
    const [duas, setDuas] = useState<PublicDua[]>([]);
    const [loading, setLoading] = useState(true);
    const [working, setWorking] = useState<string | null>(null);

    // Defense in depth: refuse to render for non-admins regardless of how
    // the modal was mounted. Real security is server-side in firestore.rules.
    if (!isCurrentUserAdmin()) return null;

    const load = async () => {
        setLoading(true);
        const list = await DuaWall.adminListAll(200);
        setDuas(list);
        setLoading(false);
    };

    useEffect(() => {
        if (visible) load();
    }, [visible]);

    const handleHide = async (item: PublicDua) => {
        setWorking(item.id);
        const ok = await DuaWall.adminSetHidden(item.id, true);
        setWorking(null);
        if (ok) {
            haptic.light();
            setDuas(prev => prev.map(d => d.id === item.id ? { ...d, hidden: true } : d));
        } else {
            Alert.alert('Action failed', 'Check your admin permissions and try again.');
        }
    };

    const handleUnhide = async (item: PublicDua) => {
        setWorking(item.id);
        const ok = await DuaWall.adminSetHidden(item.id, false);
        setWorking(null);
        if (ok) {
            haptic.light();
            setDuas(prev => prev.map(d => d.id === item.id ? { ...d, hidden: false } : d));
        }
    };

    const handleDelete = (item: PublicDua) => {
        Alert.alert(
            'Delete this dua?',
            'This permanently removes the post. It cannot be undone.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete', style: 'destructive', onPress: async () => {
                        setWorking(item.id);
                        const ok = await DuaWall.adminDelete(item.id);
                        setWorking(null);
                        if (ok) {
                            haptic.success();
                            setDuas(prev => prev.filter(d => d.id !== item.id));
                        }
                    },
                },
            ],
        );
    };

    const flagged = duas.filter(d => d.reportCount > 0).length;
    const hidden = duas.filter(d => d.hidden).length;

    return (
        <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
            <LinearGradient colors={['#06091e', '#040714']} style={styles.root}>

                <View style={styles.header}>
                    <TouchableOpacity onPress={onClose} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
                        <X size={20} color={colors.secondaryText} />
                    </TouchableOpacity>
                    <View style={styles.headerCenter}>
                        <Text style={[styles.title, { color: colors.primaryText }]}>Dua Wall Moderation</Text>
                        <Text style={[styles.subtitle, { color: colors.secondaryText }]}>
                            {duas.length} total · {flagged} flagged · {hidden} hidden
                        </Text>
                    </View>
                    <TouchableOpacity onPress={load} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
                        <RefreshCw size={18} color={colors.accent} />
                    </TouchableOpacity>
                </View>

                {loading ? (
                    <View style={styles.center}>
                        <ActivityIndicator color={colors.accent} />
                    </View>
                ) : duas.length === 0 ? (
                    <View style={styles.center}>
                        <Text style={styles.emptyEmoji}>🌙</Text>
                        <Text style={[styles.emptyTitle, { color: colors.primaryText }]}>No duas to moderate</Text>
                        <Text style={[styles.emptyBody, { color: colors.secondaryText }]}>
                            All clear. New posts will appear here as they arrive.
                        </Text>
                    </View>
                ) : (
                    <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
                        {duas.map(item => (
                            <View
                                key={item.id}
                                style={[
                                    styles.card,
                                    {
                                        borderColor: item.reportCount > 0
                                            ? '#ef444466'
                                            : item.hidden
                                                ? '#94a3b833'
                                                : 'rgba(255,255,255,0.07)',
                                        opacity: item.hidden ? 0.6 : 1,
                                    },
                                ]}
                            >
                                {/* Status row */}
                                <View style={styles.statusRow}>
                                    {item.reportCount > 0 && (
                                        <View style={[styles.badge, { backgroundColor: '#ef444422', borderColor: '#ef444466' }]}>
                                            <Flag size={10} color="#ef4444" />
                                            <Text style={[styles.badgeText, { color: '#ef4444' }]}>
                                                {item.reportCount} {item.reportCount === 1 ? 'report' : 'reports'}
                                            </Text>
                                        </View>
                                    )}
                                    {item.hidden && (
                                        <View style={[styles.badge, { backgroundColor: '#94a3b822', borderColor: '#94a3b855' }]}>
                                            <EyeOff size={10} color="#94a3b8" />
                                            <Text style={[styles.badgeText, { color: '#94a3b8' }]}>Hidden</Text>
                                        </View>
                                    )}
                                    {item.ameenCount > 0 && (
                                        <View style={[styles.badge, { backgroundColor: colors.accent + '22', borderColor: colors.accent + '44' }]}>
                                            <Text style={[styles.badgeText, { color: colors.accent }]}>
                                                {item.ameenCount} {item.ameenCount === 1 ? 'Ameen' : 'Ameens'}
                                            </Text>
                                        </View>
                                    )}
                                </View>

                                {/* The dua text itself */}
                                <Text style={[styles.duaText, { color: colors.primaryText }]}>{item.text}</Text>

                                <Text style={[styles.timestamp, { color: colors.secondaryText }]}>
                                    {formatDistanceToNowStrict(item.createdAt)} ago
                                </Text>

                                {/* Action buttons */}
                                <View style={styles.actions}>
                                    {item.hidden ? (
                                        <TouchableOpacity
                                            onPress={() => handleUnhide(item)}
                                            disabled={working === item.id}
                                            style={[styles.btn, { borderColor: colors.accent + '55', backgroundColor: colors.accent + '14' }]}
                                        >
                                            <Eye size={14} color={colors.accent} />
                                            <Text style={[styles.btnText, { color: colors.accent }]}>Unhide</Text>
                                        </TouchableOpacity>
                                    ) : (
                                        <TouchableOpacity
                                            onPress={() => handleHide(item)}
                                            disabled={working === item.id}
                                            style={[styles.btn, { borderColor: 'rgba(255,255,255,0.10)', backgroundColor: 'rgba(255,255,255,0.04)' }]}
                                        >
                                            <EyeOff size={14} color="#cbd5e1" />
                                            <Text style={[styles.btnText, { color: '#cbd5e1' }]}>Hide</Text>
                                        </TouchableOpacity>
                                    )}
                                    <TouchableOpacity
                                        onPress={() => handleDelete(item)}
                                        disabled={working === item.id}
                                        style={[styles.btn, { borderColor: '#ef444466', backgroundColor: '#ef444414' }]}
                                    >
                                        {working === item.id
                                            ? <ActivityIndicator size="small" color="#ef4444" />
                                            : <>
                                                <Trash2 size={14} color="#ef4444" />
                                                <Text style={[styles.btnText, { color: '#ef4444' }]}>Delete</Text>
                                              </>
                                        }
                                    </TouchableOpacity>
                                </View>
                            </View>
                        ))}

                        {/* Info footer */}
                        <View style={[styles.infoBox, { borderColor: colors.accent + '22' }]}>
                            <AlertTriangle size={14} color={colors.accent} />
                            <Text style={[styles.infoText, { color: colors.secondaryText }]}>
                                Duas auto-hide after 5 reports. You can manually hide, unhide, or delete any dua here. Sorted with most-reported first.
                            </Text>
                        </View>
                    </ScrollView>
                )}
            </LinearGradient>
        </Modal>
    );
}

const styles = StyleSheet.create({
    root: { flex: 1 },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 20,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.06)',
    },
    headerCenter: { flex: 1, alignItems: 'center' },
    title: { fontSize: 15, fontWeight: '800' },
    subtitle: { fontSize: 11, fontWeight: '600', marginTop: 3 },

    center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
    emptyEmoji: { fontSize: 32, marginBottom: 16 },
    emptyTitle: { fontSize: 17, fontWeight: '800', marginBottom: 6 },
    emptyBody: { fontSize: 13, textAlign: 'center' },

    list: { padding: 16, gap: 12 },

    card: {
        padding: 16,
        borderRadius: 14,
        borderWidth: 1,
        backgroundColor: 'rgba(255,255,255,0.02)',
    },

    statusRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 },
    badge: {
        flexDirection: 'row', alignItems: 'center', gap: 4,
        paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, borderWidth: 1,
    },
    badgeText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },

    duaText: { fontSize: 14, lineHeight: 21, marginBottom: 10 },
    timestamp: { fontSize: 11, fontWeight: '600', marginBottom: 14 },

    actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8 },
    btn: {
        flexDirection: 'row', alignItems: 'center', gap: 6,
        paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12, borderWidth: 1,
    },
    btnText: { fontSize: 13, fontWeight: '800' },

    infoBox: {
        flexDirection: 'row', alignItems: 'flex-start', gap: 8,
        padding: 12, borderRadius: 12, borderWidth: 1,
        backgroundColor: 'rgba(255,255,255,0.02)',
        marginTop: 16, marginBottom: 40,
    },
    infoText: { flex: 1, fontSize: 11, lineHeight: 17, fontWeight: '500' },
});
