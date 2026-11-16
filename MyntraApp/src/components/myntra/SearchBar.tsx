import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import {
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { MyntraColors, Spacing } from '@/constants/myntra-theme';
import { useTheme } from '@/hooks/use-theme';

interface SearchBarProps {
  value: string;
  onChangeText: (text: string) => void;
  onClear?: () => void;
  onPress?: () => void;
  onPressCamera?: () => void;
  onPressMic?: () => void;
  placeholder?: string;
  editable?: boolean;
}

export const SearchBar: React.FC<SearchBarProps> = ({
  value,
  onChangeText,
  onClear,
  onPress,
  onPressCamera,
  onPressMic,
  placeholder = 'Search for products, brands and more',
  editable = true,
}) => {
  const { colors, isDark } = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: colors.surface }]}>
      <TouchableOpacity
        activeOpacity={onPress ? 0.9 : 1}
        onPress={onPress}
        style={[
          styles.inputContainer,
          {
            backgroundColor: colors.inputBackground,
            borderColor: colors.cardBorder,
          },
        ]}>
        {/* Search Icon */}
        <Ionicons
          name="search-outline"
          size={20}
          color={colors.textMuted}
          style={styles.searchIcon}
        />

        {/* Text Input */}
        <TextInput
          style={[styles.input, { color: colors.text }]}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.placeholder}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
          editable={editable && !onPress}
          pointerEvents={onPress ? 'none' : 'auto'}
        />

        {/* Clear Button or Visual Search Accents */}
        {value.length > 0 ? (
          <TouchableOpacity
            style={styles.actionIcon}
            onPress={onClear ? onClear : () => onChangeText('')}
            activeOpacity={0.7}>
            <Ionicons
              name="close-circle"
              size={18}
              color={MyntraColors.textSecondary}
            />
          </TouchableOpacity>
        ) : (
          <View style={styles.extraIconsRow}>
            <TouchableOpacity
              style={styles.actionIcon}
              onPress={(e) => {
                e.stopPropagation?.();
                onPressCamera?.();
              }}
              activeOpacity={0.7}
              accessibilityLabel="Search by photo">
              <Ionicons
                name="camera-outline"
                size={19}
                color={MyntraColors.primary}
              />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.actionIcon}
              onPress={(e) => {
                e.stopPropagation?.();
                onPressMic?.();
              }}
              activeOpacity={0.7}
              accessibilityLabel="Voice search">
              <Ionicons
                name="mic-outline"
                size={19}
                color={MyntraColors.primary}
              />
            </TouchableOpacity>
          </View>
        )}
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    backgroundColor: MyntraColors.white,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: MyntraColors.surface,
    borderRadius: 24,
    paddingHorizontal: Spacing.md,
    height: 44,
    borderWidth: 1,
    borderColor: '#e2e2e6',
  },
  searchIcon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    fontSize: 14,
    color: MyntraColors.text,
    paddingVertical: 0,
    outlineStyle: 'none' as any, // for web clean outline
  },
  extraIconsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  actionIcon: {
    padding: 4,
  },
});
