import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, FlatList, StyleSheet, Platform } from 'react-native';
import { X, Check, Search } from 'lucide-react-native';
import { useTheme } from '../context/ThemeContext';
import { haptic } from '../utils/haptic';
import { t } from '../utils/i18n';
import { COUNTRIES, flagEmoji } from '../utils/countries';

interface Props {
    visible: boolean;
    onClose: () => void;
    countryCode: string | null;
    onSelect: (code: string | null) => void;
}

/**
 * Country search + select overlay — extracted from the Leaderboard (the
 * first place this shipped) so the Dua Wall compose flow can offer the same
 * picker without duplicating it. Plain View, not a nested <Modal>: every
 * caller already presents this from inside an already-open Modal, and iOS
 * only allows one modal per presenter (see DuaWall's compose overlay notes).
 */
export function CountryPickerOverlay({ visible, onClose, countryCode, onSelect }: Props) {
    const { colors } = useTheme();
    const [search, setSearch] = useState('');

    if (!visible) return null;

    const filtered = search.trim()
        ? COUNTRIES.filter(c => c.name.toLowerCase().includes(search.trim().toLowerCase()))
        : COUNTRIES;

    return (
        <View style={styles.pickerOverlay}>
            <View style={styles.pickerHeader}>
                <View style={[styles.pickerSearchBox, { borderColor: colors.accent + '33' }]}>
                    <Search size={15} color="#64748b" />
                    <TextInput
                        value={search}
                        onChangeText={setSearch}
                        placeholder={t('leaderboard.searchCountry')}
                        placeholderTextColor="#3d4f68"
                        style={[styles.pickerSearchInput, { color: colors.primaryText }]}
                        autoFocus
                        autoCapitalize="none"
                    />
                </View>
                <TouchableOpacity
                    onPress={onClose}
                    style={styles.iconBtn}
                    hitSlop={{ top: 14, bottom: 14, left: 14, right: 14 }}
                    accessibilityLabel="Close"
                    accessibilityRole="button"
                >
                    <X size={20} color="#94a3b8" />
                </TouchableOpacity>
            </View>
            <TouchableOpacity
                onPress={() => { haptic.light(); onSelect(null); }}
                style={styles.countryRow}
                activeOpacity={0.7}
            >
                <Text style={styles.countryRowText}>{t('leaderboard.noCountry')}</Text>
                {!countryCode && <Check size={16} color={colors.accent} />}
            </TouchableOpacity>
            <FlatList
                data={filtered}
                keyExtractor={c => c.code}
                keyboardShouldPersistTaps="handled"
                renderItem={({ item }) => (
                    <TouchableOpacity
                        onPress={() => { haptic.light(); onSelect(item.code); }}
                        style={styles.countryRow}
                        activeOpacity={0.7}
                    >
                        <Text style={styles.countryRowFlag}>{flagEmoji(item.code)}</Text>
                        <Text style={[styles.countryRowText, { flex: 1 }]}>{item.name}</Text>
                        {countryCode === item.code && <Check size={16} color={colors.accent} />}
                    </TouchableOpacity>
                )}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    pickerOverlay: {
        position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: '#040714', zIndex: 10,
        paddingTop: Platform.OS === 'ios' ? 56 : 16,
    },
    pickerHeader: {
        flexDirection: 'row', alignItems: 'center', gap: 10,
        paddingHorizontal: 16, paddingBottom: 12,
    },
    pickerSearchBox: {
        flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8,
        borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 9,
        backgroundColor: 'rgba(255,255,255,0.03)',
    },
    pickerSearchInput: { flex: 1, fontSize: 14 },
    iconBtn: {
        width: 38, height: 38, borderRadius: 19,
        backgroundColor: 'rgba(255,255,255,0.05)',
        alignItems: 'center', justifyContent: 'center',
    },
    countryRow: {
        flexDirection: 'row', alignItems: 'center', gap: 12,
        paddingHorizontal: 20, paddingVertical: 13,
        borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(255,255,255,0.06)',
    },
    countryRowFlag: { fontSize: 20 },
    countryRowText: { fontSize: 14, fontWeight: '600', color: '#e2e8f0' },
});
