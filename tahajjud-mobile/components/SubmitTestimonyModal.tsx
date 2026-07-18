import React, { useState } from 'react';
import {
    Modal, View, Text, TextInput, TouchableOpacity, ScrollView,
    KeyboardAvoidingView, Platform, ActivityIndicator, Alert, StyleSheet,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../context/ThemeContext';
import { TestimonySubmission, SubmittedTestimony } from '../utils/testimonySubmission';
import { storyTopics } from '../data/testimonies';
import { haptic } from '../utils/haptic';
import { t } from '../utils/i18n';

interface Props { visible: boolean; onClose: () => void; }

// "All" is a filter pill, not a tag — exclude it from the picker.
const PICKABLE_TAGS = storyTopics.filter(t => t !== 'All');

export function SubmitTestimonyModal({ visible, onClose }: Props) {
    const { colors } = useTheme();
    const [title, setTitle] = useState('');
    const [body, setBody] = useState('');
    const [author, setAuthor] = useState('');
    const [location, setLocation] = useState('');
    const [tags, setTags] = useState<string[]>([]);
    const [submitting, setSubmitting] = useState(false);

    const reset = () => {
        setTitle(''); setBody(''); setAuthor(''); setLocation(''); setTags([]);
    };

    const toggleTag = (tag: string) => {
        haptic.light();
        setTags(prev => prev.includes(tag)
            ? prev.filter(t => t !== tag)
            : prev.length >= 3 ? prev : [...prev, tag]);
    };

    const handleSubmit = async () => {
        if (submitting) return;
        setSubmitting(true);
        const data: SubmittedTestimony = { title, body, author, location, tags };
        const result = await TestimonySubmission.submit(data);
        setSubmitting(false);

        if (!result.ok) {
            const msg: Record<string, string> = {
                'too-short':       t('submitTestimony.tooShort'),
                'too-long':        t('submitTestimony.tooLong'),
                'profanity':       t('submitTestimony.profanity'),
                'missing-tag':     t('submitTestimony.missingTag'),
                'not-signed-in':   t('submitTestimony.notSignedIn'),
                'firestore-error': t('submitTestimony.firestoreError'),
            };
            Alert.alert(t('submitTestimony.couldNotSubmitTitle'), msg[result.error ?? 'firestore-error'] ?? t('submitTestimony.tryAgain'));
            return;
        }

        haptic.success();
        reset();
        onClose();
        Alert.alert(
            t('submitTestimony.jazakAllahKhair'),
            t('submitTestimony.reviewBody'),
        );
    };

    return (
        <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
            <LinearGradient colors={['#06091e', '#040714']} style={styles.root}>
                <KeyboardAvoidingView
                    style={{ flex: 1 }}
                    // 'padding' breaks inside pageSheet on iOS (sheet has its
                    // own top inset). 'height' is a safer no-op there and lets
                    // the ScrollView's automaticallyAdjustKeyboardInsets do
                    // the actual work. Still useful on Android where this
                    // attribute drives the avoidance.
                    behavior={Platform.OS === 'ios' ? undefined : 'height'}
                >
                    {/* Header */}
                    <View style={styles.header}>
                        <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                            <Text style={[styles.cancel, { color: colors.secondaryText }]}>{t('btn.cancel')}</Text>
                        </TouchableOpacity>
                        <Text style={[styles.title, { color: colors.primaryText }]}>{t('testimoniesTab.shareYourStory')}</Text>
                        <TouchableOpacity onPress={handleSubmit} disabled={submitting} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                            {submitting
                                ? <ActivityIndicator size="small" color={colors.accent} />
                                : <Text style={[styles.submit, { color: colors.accent }]}>{t('submitTestimony.submitBtn')}</Text>
                            }
                        </TouchableOpacity>
                    </View>

                    <ScrollView
                        contentContainerStyle={styles.content}
                        keyboardShouldPersistTaps="handled"
                        // Native iOS keyboard avoidance — adjusts scroll insets
                        // automatically when keyboard appears. Works correctly
                        // with pageSheet (where KeyboardAvoidingView's padding
                        // math gets thrown off by the sheet's top inset).
                        automaticallyAdjustKeyboardInsets
                        keyboardDismissMode="interactive"
                    >
                        <Text style={[styles.intro, { color: colors.secondaryText }]}>
                            {t('submitTestimony.introText')}
                        </Text>

                        {/* Title */}
                        <Field label={t('submitTestimony.titleLabel')}>
                            <TextInput
                                value={title}
                                onChangeText={setTitle}
                                placeholder={t('submitTestimony.titlePlaceholder')}
                                placeholderTextColor="#475569"
                                style={[styles.input, { color: colors.primaryText }]}
                                maxLength={90}
                            />
                        </Field>

                        {/* Story body */}
                        <Field label={t('submitTestimony.storyLabel')}>
                            <TextInput
                                value={body}
                                onChangeText={setBody}
                                multiline
                                placeholder={t('submitTestimony.storyPlaceholder')}
                                placeholderTextColor="#475569"
                                style={[styles.input, styles.textarea, { color: colors.primaryText }]}
                                maxLength={2100}
                                textAlignVertical="top"
                            />
                            <Text style={[styles.counter, { color: colors.secondaryText }]}>
                                {body.length} / 2000
                            </Text>
                        </Field>

                        {/* Author + Location row */}
                        <View style={styles.row}>
                            <View style={{ flex: 1 }}>
                                <Field label={t('submitTestimony.nameLabel')}>
                                    <TextInput
                                        value={author}
                                        onChangeText={setAuthor}
                                        placeholder={t('submitTestimony.anonymousPlaceholder')}
                                        placeholderTextColor="#475569"
                                        style={[styles.input, { color: colors.primaryText }]}
                                        maxLength={40}
                                    />
                                </Field>
                            </View>
                            <View style={{ width: 12 }} />
                            <View style={{ flex: 1 }}>
                                <Field label={t('submitTestimony.locationLabel')}>
                                    <TextInput
                                        value={location}
                                        onChangeText={setLocation}
                                        placeholder="London, UK"
                                        placeholderTextColor="#475569"
                                        style={[styles.input, { color: colors.primaryText }]}
                                        maxLength={40}
                                    />
                                </Field>
                            </View>
                        </View>

                        {/* Tags */}
                        <Field label={t('submitTestimony.topicsLabel', { n: tags.length })}>
                            <View style={styles.tagsWrap}>
                                {PICKABLE_TAGS.map(t => {
                                    const selected = tags.includes(t);
                                    return (
                                        <TouchableOpacity
                                            key={t}
                                            onPress={() => toggleTag(t)}
                                            style={[
                                                styles.tag,
                                                selected
                                                    ? { backgroundColor: colors.accent, borderColor: colors.accent }
                                                    : { borderColor: 'rgba(255,255,255,0.10)' },
                                            ]}
                                        >
                                            <Text style={[styles.tagText, { color: selected ? '#0a1228' : '#cbd5e1' }]}>
                                                {t}
                                            </Text>
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>
                        </Field>
                    </ScrollView>
                </KeyboardAvoidingView>
            </LinearGradient>
        </Modal>
    );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <View style={{ marginBottom: 18 }}>
            <Text style={styles.fieldLabel}>{label.toUpperCase()}</Text>
            {children}
        </View>
    );
}

const styles = StyleSheet.create({
    root: { flex: 1 },
    header: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        padding: 20, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)',
    },
    title: { fontSize: 14, fontWeight: '700' },
    cancel: { fontSize: 14, fontWeight: '600' },
    submit: { fontSize: 14, fontWeight: '800' },
    content: { padding: 20, paddingBottom: 300 },
    intro: { fontSize: 13, lineHeight: 19, marginBottom: 24 },
    row: { flexDirection: 'row' },
    fieldLabel: {
        color: '#64748b', fontSize: 11, fontWeight: '800', letterSpacing: 1.2,
        marginBottom: 8,
    },
    input: {
        backgroundColor: 'rgba(255,255,255,0.04)',
        borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
        paddingHorizontal: 14, paddingVertical: 12, fontSize: 15,
    },
    textarea: { minHeight: 180 },
    counter: { fontSize: 11, marginTop: 4, textAlign: 'right' },
    tagsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    tag: {
        paddingHorizontal: 14, paddingVertical: 8, borderRadius: 16, borderWidth: 1,
    },
    tagText: { fontSize: 12, fontWeight: '700' },
});
