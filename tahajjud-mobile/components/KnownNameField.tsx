import React from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { t } from '../utils/i18n';

interface Props {
    /** Current field value (still the single source of truth the caller submits). */
    name: string;
    onChangeName: (v: string) => void;
    /** From CommunityProfileStore — null until a name has been set anywhere in the app. */
    knownName: string | null;
    /** True once the user has tapped "not you?" to override the known name for this one field. */
    editing: boolean;
    onStartEditing: () => void;
    accent: string;
    /** i18n key with a {name} placeholder, e.g. 'duaWall.postingAs' → "Posting as {name}". */
    prefixKey: string;
    placeholder: string;
    maxLength?: number;
    inputStyle?: any;
    rowStyle?: any;
    autoCapitalize?: 'none' | 'words' | 'sentences' | 'characters';
}

/**
 * Shared "don't ask for the name again" field. A name typed once anywhere
 * (Dua Wall, a comment, the Leaderboard, the Partner circle) is remembered in
 * CommunityProfileStore — every OTHER place that asks for a name should show
 * it back as plain text ("Posting as Yusuf · not you?") instead of an
 * editable box that looks like a fresh, blank question. Only a genuinely new
 * identity (nothing set anywhere yet) sees an actual input.
 */
export function KnownNameField({
    name, onChangeName, knownName, editing, onStartEditing, accent,
    prefixKey, placeholder, maxLength, inputStyle, rowStyle, autoCapitalize,
}: Props) {
    const { colors } = useTheme();

    if (knownName && !editing) {
        return (
            <View style={[styles.row, rowStyle]}>
                <Text style={[styles.prefilledText, { color: colors.secondaryText }]} numberOfLines={1}>
                    {t(prefixKey, { name: name || knownName })}
                </Text>
                <TouchableOpacity
                    onPress={onStartEditing}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    accessibilityRole="button"
                >
                    <Text style={[styles.changeLink, { color: accent }]}>{t('comments.notYou')}</Text>
                </TouchableOpacity>
            </View>
        );
    }

    return (
        <TextInput
            value={name}
            onChangeText={onChangeName}
            placeholder={placeholder}
            placeholderTextColor="#3d4f68"
            style={[styles.defaultInput, { color: colors.primaryText }, inputStyle]}
            maxLength={maxLength}
            autoFocus={editing}
            autoCapitalize={autoCapitalize}
        />
    );
}

const styles = StyleSheet.create({
    row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    prefilledText: { fontSize: 12, flex: 1, flexShrink: 1 },
    changeLink: { fontSize: 11, fontWeight: '600' },
    defaultInput: {
        fontSize: 13, paddingVertical: 8, paddingHorizontal: 10,
    },
});
