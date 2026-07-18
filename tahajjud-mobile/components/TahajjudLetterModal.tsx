/**
 * Free version — simple write-to-Allah modal shown after Tahajjud log.
 * Saves as a PersonalDua so it appears in the Letters section of DuasTab.
 */
import React, { useState, useRef } from 'react';
import {
    Modal, View, Text, TextInput, TouchableOpacity,
    StyleSheet, KeyboardAvoidingView, Platform, TouchableWithoutFeedback, Keyboard, Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { X, Check } from 'lucide-react-native';
import { useTheme } from '../context/ThemeContext';
import { savePersonalDua } from '../utils/personalDuas';
import { haptic } from '../utils/haptic';
import { getPromptForDate } from '../utils/journalPrompts';
import { format } from 'date-fns';
import { t } from '../utils/i18n';

interface Props {
    visible: boolean;
    onClose: () => void;
}

export function TahajjudLetterModal({ visible, onClose }: Props) {
    const { colors } = useTheme();
    const [text, setText] = useState('');
    const [done, setDone] = useState(false);
    const inputRef = useRef<TextInput>(null);
    const now = new Date();

    const handleSave = async () => {
        const ok = await savePersonalDua({
            id: `tahajjud_letter_${Date.now()}`,
            title: t('letterModal.tahajjudDateTitle', { date: format(now, 'MMM d, yyyy') }),
            arabic: '',
            transliteration: '',
            translation: text.trim() || t('letterModal.noDuaWrittenParen'),
            notes: '',
            createdAt: Date.now(),
        });
        if (!ok) {
            Alert.alert(t('letterModal.saveFailedTitle'), t('letterModal.saveFailedBody'));
            return;
        }
        haptic.success();
        setDone(true);
        setTimeout(() => {
            setDone(false);
            setText('');
            onClose();
        }, 1600);
    };

    const handleClose = () => {
        setText('');
        setDone(false);
        onClose();
    };

    return (
        <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={handleClose}>
            <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
                <LinearGradient colors={['#060d1f', '#0a1228', '#060d1f']} style={{ flex: 1 }}>

                    {!done ? (
                        <>
                            {/* Top bar */}
                            <View style={styles.topBar}>
                                <TouchableOpacity onPress={handleClose} style={styles.closeBtn}>
                                    <X size={18} color="#475569" />
                                </TouchableOpacity>
                                <TouchableOpacity
                                    onPress={handleSave}
                                    style={[styles.saveBtn, { backgroundColor: colors.accent }]}
                                >
                                    <Text style={styles.saveBtnText}>{t('playlistBuilder.saveBtn')}</Text>
                                </TouchableOpacity>
                            </View>

                            {/* Writing area — tapping anywhere outside the
                                TextInput dismisses the keyboard. */}
                            <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
                                <View style={styles.writeArea}>
                                    <Text style={styles.bismillah}>بِسْمِ اللَّهِ</Text>
                                    <Text style={styles.dateLabel}>{format(now, 'EEEE, MMMM d')}</Text>
                                    <Text style={styles.alhamdulillah}>{t('journalModal.alhamdulillahEmoji')}</Text>
                                    <Text style={styles.prompt}>{getPromptForDate()}</Text>
                                    <TextInput
                                        ref={inputRef}
                                        style={styles.input}
                                        placeholder={t('journalModal.writePlaceholder')}
                                        placeholderTextColor="#1e3a5f"
                                        multiline
                                        value={text}
                                        onChangeText={setText}
                                        textAlignVertical="top"
                                        autoFocus
                                    />
                                </View>
                            </TouchableWithoutFeedback>

                            <TouchableOpacity onPress={handleClose} style={styles.skipBtn}>
                                <Text style={styles.skipText}>{t('letterModal.skip')}</Text>
                            </TouchableOpacity>
                        </>
                    ) : (
                        <View style={styles.doneScreen}>
                            <View style={[styles.doneCircle, { borderColor: '#22c55e44', backgroundColor: '#22c55e12' }]}>
                                <Check size={40} color="#22c55e" />
                            </View>
                            <Text style={styles.doneTitle}>{t('journalModal.savedMoon')}</Text>
                            <Text style={styles.doneSub}>{t('journalModal.mayAllahAccept')}</Text>
                        </View>
                    )}
                </LinearGradient>
            </KeyboardAvoidingView>
        </Modal>
    );
}

const styles = StyleSheet.create({
    topBar: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: 20, paddingTop: 20, paddingBottom: 16,
    },
    closeBtn: {
        width: 34, height: 34, borderRadius: 17,
        backgroundColor: 'rgba(255,255,255,0.06)',
        alignItems: 'center', justifyContent: 'center',
    },
    saveBtn: { paddingHorizontal: 20, paddingVertical: 8, borderRadius: 20 },
    saveBtnText: { color: '#fff', fontSize: 14, fontWeight: '800' },
    writeArea: {
        flex: 1, marginHorizontal: 20, padding: 20,
        backgroundColor: 'rgba(255,255,255,0.03)',
        borderRadius: 24, borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.07)', gap: 6,
    },
    bismillah: {
        color: '#1e4d7a', fontSize: 20, textAlign: 'center',
        marginBottom: 4,
        fontFamily: Platform.OS === 'ios' ? 'Arial' : 'serif',
    },
    dateLabel: { color: '#334155', fontSize: 12, fontWeight: '600', textAlign: 'center' },
    alhamdulillah: { color: '#f1f5f9', fontSize: 22, fontWeight: '800', textAlign: 'center', marginBottom: 4 },
    prompt: { color: '#1e4d7a', fontSize: 15, fontStyle: 'italic', fontWeight: '600' },
    input: { flex: 1, color: '#94a3b8', fontSize: 16, lineHeight: 26, minHeight: 160 },
    skipBtn: { alignItems: 'center', paddingVertical: 16 },
    skipText: { color: '#334155', fontSize: 13 },
    doneScreen: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
    doneCircle: {
        width: 100, height: 100, borderRadius: 50,
        borderWidth: 1, alignItems: 'center', justifyContent: 'center',
    },
    doneTitle: { color: '#f1f5f9', fontSize: 28, fontWeight: '800' },
    doneSub: { color: '#475569', fontSize: 15 },
});
