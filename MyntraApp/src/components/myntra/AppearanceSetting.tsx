import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { Spacing, ThemeMode } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

interface AppearanceSettingProps {
  onThemeChanged?: (mode: ThemeMode) => void;
}

export const AppearanceSetting: React.FC<AppearanceSettingProps> = ({
  onThemeChanged,
}) => {
  const { colors, isDark, themeMode, activeTheme, systemScheme, setThemeMode } =
    useTheme();

  const handleSelectMode = async (mode: ThemeMode) => {
    await setThemeMode(mode);
    if (onThemeChanged) {
      onThemeChanged(mode);
    }
  };

  const options: {
    mode: ThemeMode;
    title: string;
    description: string;
    icon: keyof typeof Ionicons.glyphMap;
    tag?: string;
  }[] = [
    {
      mode: 'system',
      title: 'System Default',
      description: `Follows device OS appearance (Currently ${systemScheme === 'dark' ? 'Dark' : 'Light'})`,
      icon: 'phone-portrait-outline',
      tag: 'AUTO',
    },
    {
      mode: 'light',
      title: 'Light Mode',
      description: 'Classic clean Myntra shopping look with vibrant pink accents',
      icon: 'sunny-outline',
    },
    {
      mode: 'dark',
      title: 'Dark Mode',
      description: 'Sleek OLED-friendly dark palette, easy on eyes in dim light',
      icon: 'moon-outline',
    },
  ];

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.surface,
          borderColor: colors.cardBorder,
        },
      ]}>
      {/* Section Header */}
      <View style={styles.headerRow}>
        <View style={styles.headerTitleRow}>
          <View
            style={[
              styles.headerIconCircle,
              { backgroundColor: colors.primaryLight },
            ]}>
            <Ionicons
              name="color-palette-outline"
              size={18}
              color={colors.primary}
            />
          </View>
          <View>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              APPEARANCE & THEME
            </Text>
            <Text
              style={[styles.sectionSubtitle, { color: colors.textSecondary }]}>
              Active Theme: {activeTheme === 'dark' ? 'Dark Mode 🌙' : 'Light Mode ☀️'}
              {themeMode === 'system' ? ' (System Synced)' : ' (Manual)'}
            </Text>
          </View>
        </View>
      </View>

      {/* Theme Option Selector Rows */}
      <View style={styles.optionsList}>
        {options.map((opt) => {
          const isSelected = themeMode === opt.mode;

          return (
            <TouchableOpacity
              key={opt.mode}
              activeOpacity={0.75}
              onPress={() => handleSelectMode(opt.mode)}
              accessibilityRole="radio"
              accessibilityState={{ selected: isSelected }}
              accessibilityLabel={`${opt.title} theme option`}
              style={[
                styles.optionCard,
                {
                  backgroundColor: isSelected
                    ? colors.primaryLight
                    : colors.inputBackground,
                  borderColor: isSelected
                    ? colors.primary
                    : colors.cardBorder,
                },
              ]}>
              {/* Icon Container */}
              <View
                style={[
                  styles.optionIconContainer,
                  {
                    backgroundColor: isSelected
                      ? colors.primary
                      : colors.surfaceElevated,
                  },
                ]}>
                <Ionicons
                  name={opt.icon}
                  size={18}
                  color={isSelected ? '#ffffff' : colors.text}
                />
              </View>

              {/* Text Info */}
              <View style={styles.optionTextContainer}>
                <View style={styles.titleWithTag}>
                  <Text
                    style={[
                      styles.optionTitle,
                      {
                        color: isSelected ? colors.primaryDark : colors.text,
                        fontWeight: isSelected ? '700' : '600',
                      },
                    ]}>
                    {opt.title}
                  </Text>
                  {opt.tag && (
                    <View
                      style={[
                        styles.tagBadge,
                        {
                          backgroundColor: isSelected
                            ? colors.primary
                            : colors.cardBorder,
                        },
                      ]}>
                      <Text
                        style={[
                          styles.tagText,
                          {
                            color: isSelected
                              ? '#ffffff'
                              : colors.textSecondary,
                          },
                        ]}>
                        {opt.tag}
                      </Text>
                    </View>
                  )}
                </View>
                <Text
                  style={[
                    styles.optionDesc,
                    { color: colors.textSecondary },
                  ]}>
                  {opt.description}
                </Text>
              </View>

              {/* Radio Circle Checkmark */}
              <View
                style={[
                  styles.radioCircle,
                  {
                    borderColor: isSelected
                      ? colors.primary
                      : colors.textMuted,
                    backgroundColor: isSelected
                      ? colors.primary
                      : 'transparent',
                  },
                ]}>
                {isSelected && (
                  <Ionicons name="checkmark" size={13} color="#ffffff" />
                )}
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginHorizontal: Spacing.lg,
    marginVertical: Spacing.sm,
    padding: Spacing.lg,
    borderRadius: 12,
    borderWidth: 1,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  headerRow: {
    marginBottom: Spacing.md,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  headerIconCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  sectionSubtitle: {
    fontSize: 11,
    marginTop: 2,
  },
  optionsList: {
    gap: Spacing.sm,
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: 10,
    borderWidth: 1.5,
  },
  optionIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  optionTextContainer: {
    flex: 1,
    marginRight: Spacing.sm,
  },
  titleWithTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  optionTitle: {
    fontSize: 13,
  },
  tagBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  tagText: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  optionDesc: {
    fontSize: 10.5,
    marginTop: 3,
    lineHeight: 14,
  },
  radioCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
