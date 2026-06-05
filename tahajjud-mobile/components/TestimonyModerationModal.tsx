import React, { useEffect, useState } from 'react';
import {
    Modal, View, Text, TouchableOpacity, StyleSheet, ScrollView,
    ActivityIndicator, Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Check, Trash2, X, RefreshCw } from 'lucide-react-native';
import { useTheme } from '../context/ThemeContext';
import { TestimonySubmission, PendingTestimony } from '../utils/testimonySubmission';
import { isCurrentUserAdmin } from '../utils/admins';
import { haptic } from '../utils/haptic';
import { format } from 'date-fns';

interface Props { visible: boolean; onClose: () => void; }

export function TestimonyModerationModal({ visible, onClose }: Props) {
    const { colors } = useTheme();
    const [pending, setPending] = useState<PendingTestimony[]>([]);
    const [loading, setLoading] = useState(true);
    const [working, setWorking] = useState<string | null>(null);

    // Defense in depth: even if this modal is mounted by a non-admin path,
    // refuse to render. The actual security boundary is firestore.rules —
    // this just prevents any UI leak.
    if (!isCurrentUserAdmin()) return null;

    const load = async () => {
        setLoading(true);
        const list = await TestimonySubmission.listPending();
        setPending(list);
        setLoading(false);
    };

    useEffect(() => {
        if (visible) load();
    }, [visible]);

    const handleApprove = async (item: PendingTestimony) => {
        setWorking(item.id);
        const ok = await TestimonySubmission.approve(item);
        setWorking(null);
        if (ok) {
            haptic.success();
            setPending(prev => prev.filter(p => p.id !== item.id));
        } else {
            Alert.alert('Approval failed', 'Check your Firestore rules and try again.');
        }
    };

    const handleReject = (item: PendingTestimony) => {
        Alert.alert(
            'Reject submission?',
            'This will delete the submission permanently.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Reject', style: 'destructive', onPress: async () => {
                        setWorking(item.id);
                        const ok = await TestimonySubmission.reject(item.id);
                        setWorking(null);
                        if (ok) {
                            haptic.light();
                            setPending(prev => prev.filter(p => p.id !== item.id));
                        }
                    },
                },
            ],
        );
    };

    return (
        <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
            <LinearGradient colors={['#06091e', '#040714']} style={styles.root}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={onClose} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
                        <X size={20} color={colors.secondaryText} />
                    </TouchableOpacity>
                    <Text style={[styles.title, { color: colors.primaryText }]}>
                        Pending Submissions{pending.length > 0 ? ` (${pending.length})` : ''}
                    </Text>
                    <TouchableOpacity onPress={load} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
                        <RefreshCw size={18} color={colors.accent} />
                    </TouchableOpacity>
                </View>

                {loading ? (
                    <View style={styles.center}>
                        <ActivityIndicator color={colors.accent} />
                    </View>
                ) : pending.length === 0 ? (
                    <View style={styles.center}>
                        <Text style={styles.emptyEmoji}>📭</Text>
                        <Text style={[styles.emptyTitle, { color: colors.primaryText }]}>Queue is empty</Text>
                        <Text style={[styles.emptyBody, { color: colors.secondaryText }]}>
                            New submissions will appear here.
                        </Text>
                    </View>
                ) : (
                    <ScrollView contentContainerStyle={styles.list}>
                        {pending.map(item => (
                            <View key={item.id} style={[styles.card, { borderColor: 'rgba(255,255,255,0.07)' }]}>
                                <Text style={[styles.itemTitle, { color: colors.primaryText }]}>
                                    {item.title}
                                </Text>
                                <Text style={[styles.itemMeta, { color: colors.secondaryText }]}>
                                    {item.author}{item.location ? ` · ${item.location}` : ''}
                                    {' · '}{format(item.submittedAt, 'MMM d, h:mm a')}
                                </Text>

                                <View style={styles.tagsRow}>
                                    {item.tags.map(t => (
                                        <View key={t} style={[styles.tag, { borderColor: colors.accent + '44' }]}>
                                            <Text style={[styles.tagText, { color: colors.accent }]}>{t}</Text>
                                        </View>
                                    ))}
                                </View>

                                <Text style={[styles.body, { color: colors.primaryText }]}>
                                    {item.body}
                                </Text>

                                <View style={styles.actions}>
                                    <TouchableOpacity
                                        onPress={() => handleReject(item)}
                                        disabled={working === item.id}
                                        style={[styles.btn, { borderColor: 'rgba(239,68,68,0.4)', backgroundColor: 'rgba(239,68,68,0.08)' }]}
                                    >
                                        <Trash2 size={14} color="#ef4444" />
                                        <Text style={[styles.btnText, { color: '#ef4444' }]}>Reject</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        onPress={() => handleApprove(item)}
                                        disabled={working === item.id}
                                        style={[styles.btn, { backgroundColor: colors.accent, borderColor: colors.accent }]}
                                    >
                                        {working === item.id
                                            ? <ActivityIndicator size="small" color="#0a1228" />
                                            : <>
                                                <Check size={14} color="#0a1228" strokeWidth={3} />
                                                <Text style={[styles.btnText, { color: '#0a1228' }]}>Approve</Text>
                                              </>
                                        }
                                    </TouchableOpacity>
                                </View>
                            </View>
                        ))}
                    </ScrollView>
                )}
            </LinearGradient>
        </Modal>
    );
}

const styles = StyleSheet.create({
    root: { flex: 1 },
    header: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        padding: 20, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)',
    },
    title: { fontSize: 14, fontWeight: '700' },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
    emptyEmoji: { fontSize: 32, marginBottom: 16 },
    emptyTitle: { fontSize: 16, fontWeight: '800', marginBottom: 6 },
    emptyBody: { fontSize: 13, textAlign: 'center' },
    list: { padding: 16, gap: 14 },
    card: {
        padding: 16, borderRadius: 14, borderWidth: 1,
        backgroundColor: 'rgba(255,255,255,0.02)',
    },
    itemTitle: { fontSize: 16, fontWeight: '800', marginBottom: 4 },
    itemMeta: { fontSize: 11, marginBottom: 10 },
    tagsRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginBottom: 12 },
    tag: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 8, borderWidth: 1 },
    tagText: { fontSize: 10, fontWeight: '800' },
    body: { fontSize: 13, lineHeight: 20, marginBottom: 14 },
    actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8 },
    btn: {
        flexDirection: 'row', alignItems: 'center', gap: 6,
        paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12, borderWidth: 1,
    },
    btnText: { fontSize: 13, fontWeight: '800' },
});
