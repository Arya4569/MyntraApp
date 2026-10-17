import React from 'react';
import {
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { MyntraColors, Spacing } from '@/constants/myntra-theme';
import { CATEGORIES, Category } from '@/data/mock-data';

interface CategoryListProps {
  categories?: Category[];
  selectedCategoryId: string;
  onSelectCategory: (category: Category) => void;
  onExploreAll?: () => void;
}

export const CategoryList: React.FC<CategoryListProps> = ({
  categories = CATEGORIES,
  selectedCategoryId,
  onSelectCategory,
  onExploreAll,
}) => {
  return (
    <View style={styles.container}>
      {/* Section Header */}
      <View style={styles.headerRow}>
        <View style={styles.headerLeft}>
          <Text style={styles.sectionTitle}>SHOP BY CATEGORY</Text>
          <Text style={styles.sectionSubtitle}>Curated styles for everyone</Text>
        </View>
        <TouchableOpacity
          onPress={onExploreAll}
          activeOpacity={0.7}
          accessibilityLabel="Explore all categories">
          <Text style={styles.viewAllText}>EXPLORE ALL</Text>
        </TouchableOpacity>
      </View>

      {/* Horizontal Scroll Categories */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}>
        {categories.map((category) => {
          const isSelected = selectedCategoryId === category.id;

          return (
            <TouchableOpacity
              key={category.id}
              activeOpacity={0.75}
              onPress={() => onSelectCategory(category)}
              style={styles.categoryCard}>
              {/* Circular Avatar with Active Ring */}
              <View
                style={[
                  styles.imageWrapper,
                  isSelected && styles.imageWrapperSelected,
                ]}>
                <Image
                  source={{ uri: category.image }}
                  style={styles.image}
                  resizeMode="cover"
                />
                {category.tag && (
                  <View
                    style={[
                      styles.tagBadge,
                      isSelected && styles.tagBadgeSelected,
                    ]}>
                    <Text style={styles.tagText}>{category.tag}</Text>
                  </View>
                )}
              </View>

              {/* Category Name */}
              <Text
                style={[
                  styles.categoryName,
                  isSelected && styles.categoryNameSelected,
                ]}
                numberOfLines={1}>
                {category.name}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingVertical: Spacing.sm,
    backgroundColor: MyntraColors.white,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.sm,
  },
  headerLeft: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: MyntraColors.text,
    letterSpacing: 0.8,
  },
  sectionSubtitle: {
    fontSize: 11,
    color: MyntraColors.textSecondary,
    marginTop: 1,
  },
  viewAllText: {
    fontSize: 11,
    fontWeight: '700',
    color: MyntraColors.primary,
    letterSpacing: 0.3,
  },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
    gap: 14,
    paddingVertical: 6,
  },
  categoryCard: {
    alignItems: 'center',
    width: 68,
  },
  imageWrapper: {
    width: 66,
    height: 66,
    borderRadius: 33,
    padding: 2.5,
    backgroundColor: MyntraColors.white,
    borderWidth: 1.5,
    borderColor: '#e8e8ec',
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  imageWrapperSelected: {
    borderColor: MyntraColors.primary,
    borderWidth: 2.5,
    shadowColor: MyntraColors.primary,
    shadowOpacity: 0.25,
    shadowRadius: 5,
  },
  image: {
    width: '100%',
    height: '100%',
    borderRadius: 30,
  },
  tagBadge: {
    position: 'absolute',
    bottom: -4,
    alignSelf: 'center',
    backgroundColor: '#282c3f',
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: MyntraColors.white,
  },
  tagBadgeSelected: {
    backgroundColor: MyntraColors.primary,
  },
  tagText: {
    color: MyntraColors.white,
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  categoryName: {
    fontSize: 11,
    fontWeight: '600',
    color: MyntraColors.text,
    marginTop: 8,
    textAlign: 'center',
  },
  categoryNameSelected: {
    color: MyntraColors.primary,
    fontWeight: '800',
  },
});
