import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import {
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { MyntraColors, Spacing } from '@/constants/myntra-theme';
import { MainCategory, Product, PRODUCTS, SUBCATEGORIES } from '@/data/mock-data';
import { useTheme } from '@/hooks/use-theme';
import { storeService } from '@/services/store-service';

interface CategoriesScreenProps {
  products?: Product[];
  onSelectSubcategory: (category: MainCategory, sub: string) => void;
  onSelectCategory?: (category: MainCategory) => void;
  onPressProduct?: (product: Product) => void;
}

const CATEGORY_ICONS: Record<string, any> = {
  Men: 'shirt-outline',
  Women: 'flower-outline',
  Kids: 'balloon-outline',
  Beauty: 'sparkles-outline',
  Home: 'bed-outline',
  Sports: 'bicycle-outline',
};

const CATEGORY_BANNERS: Record<string, { title: string; tag: string }> = {
  Men: { title: 'Up to 60% Off on Top Men Fashion', tag: 'TRENDING IN MEN' },
  Women: { title: 'Festive & Western Dresses Flat 50% Off', tag: 'WOMEN SPOTLIGHT' },
  Kids: { title: 'Cute Sets & Footwear From ₹499', tag: 'KIDS CARNIVAL' },
  Beauty: { title: 'Skincare Essentials & Fragrances Min 30% Off', tag: 'GLOW UP DEALS' },
  Home: { title: 'Designer Bedsheets & Cushions Up to 70% Off', tag: 'HOME MAKEOVER' },
  Sports: { title: 'Performance Running Shoes & Activewear', tag: 'ACTIVE ATHLEISURE' },
};

export const CategoriesScreen: React.FC<CategoriesScreenProps> = ({
  products = PRODUCTS,
  onSelectSubcategory,
  onSelectCategory,
  onPressProduct,
}) => {
  const [subcatDict, setSubcatDict] = useState<Record<string, string[]>>(SUBCATEGORIES);
  const [bannersDict, setBannersDict] = useState<Record<string, { title: string; tag: string }>>(CATEGORY_BANNERS);
  const [selectedMainCat, setSelectedMainCat] = useState<MainCategory>('Men');

  const { colors, isDark } = useTheme();

  useEffect(() => {
    let isMounted = true;
    storeService.fetchSubcategories().then((res) => {
      if (isMounted) {
        if (res.subcategories && Object.keys(res.subcategories).length > 0) {
          setSubcatDict(res.subcategories);
        }
        if (res.categoryBanners && Object.keys(res.categoryBanners).length > 0) {
          setBannersDict((prev) => ({ ...prev, ...res.categoryBanners }));
        }
      }
    }).catch(() => {});
    return () => {
      isMounted = false;
    };
  }, []);

  const categoryNames = Object.keys(subcatDict) as MainCategory[];
  const subItems = subcatDict[selectedMainCat] || [];
  const banner = bannersDict[selectedMainCat] || {
    title: 'Explore Best Deals',
    tag: 'FEATURED',
  };

  // Count items matching this department
  const departmentCount = products.filter(
    (p) => p.category.toLowerCase() === selectedMainCat.toLowerCase()
  ).length;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Categories Header */}
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.divider }]}>
        <View>
          <Text style={[styles.headerTitle, { color: colors.text }]}>ALL CATEGORIES</Text>
          <Text style={[styles.headerSub, { color: colors.textSecondary }]}>Explore our 6 curated fashion departments</Text>
        </View>
        <TouchableOpacity
          onPress={() => onSelectCategory?.(selectedMainCat)}
          style={[styles.viewAllBtn, { backgroundColor: isDark ? colors.surfaceElevated : '#fff0f3' }]}
          activeOpacity={0.8}
          accessibilityLabel="Explore all products in this category">
          <Text style={styles.viewAllText}>EXPLORE ALL</Text>
          <Ionicons name="arrow-forward" size={13} color={colors.primary} />
        </TouchableOpacity>
      </View>

      <View style={styles.contentRow}>
        {/* Left Side Rail: 6 Main Departments */}
        <ScrollView
          style={[styles.leftRail, { backgroundColor: isDark ? colors.surfaceElevated : '#f8f8fa', borderRightColor: colors.divider }]}
          showsVerticalScrollIndicator={false}>
          {categoryNames.map((name) => {
            const isActive = selectedMainCat === name;
            const iconName = CATEGORY_ICONS[name] || 'pricetag-outline';
            return (
              <TouchableOpacity
                key={name}
                onPress={() => setSelectedMainCat(name)}
                activeOpacity={0.8}
                style={[
                  styles.railItem,
                  { borderBottomColor: colors.border },
                  isActive && [styles.railItemActive, { backgroundColor: colors.surface }],
                ]}>
                <Ionicons
                  name={iconName}
                  size={18}
                  color={isActive ? colors.primary : colors.textMuted}
                  style={styles.railIcon}
                />
                <Text
                  style={[
                    styles.railText,
                    { color: colors.textSecondary },
                    isActive && styles.railTextActive,
                  ]}>
                  {name}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Right Side: Subcategories Directory */}
        <ScrollView
          style={[styles.rightContent, { backgroundColor: colors.background }]}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.rightScrollContent}>
          {/* Department Banner Card */}
          <TouchableOpacity
            onPress={() => onSelectCategory?.(selectedMainCat)}
            style={[styles.bannerContainer, { backgroundColor: isDark ? colors.surfaceElevated : '#fff4f6', borderColor: isDark ? colors.border : '#ffc1cf' }]}
            activeOpacity={0.85}>
            <Text style={styles.bannerTag}>{banner.tag}</Text>
            <Text style={[styles.bannerHeading, { color: colors.text }]}>{banner.title}</Text>
            <Text style={[styles.bannerSubtext, { color: colors.textSecondary }]}>
              {departmentCount} items available in {selectedMainCat} • Tap to view all
            </Text>
          </TouchableOpacity>

          <View style={styles.subHeaderRow}>
            <Text style={[styles.subHeading, { color: colors.textMuted }]}>SUBCATEGORIES</Text>
            <Text style={[styles.subCount, { color: colors.textMuted }]}>{subItems.length} types</Text>
          </View>

          {subItems.map((sub) => {
            // Count matching products for this subcategory
            const count = products.filter(
              (p) =>
                p.category.toLowerCase() === selectedMainCat.toLowerCase() &&
                (p.subcategory.toLowerCase().includes(sub.toLowerCase()) ||
                  sub.toLowerCase().includes(p.subcategory.toLowerCase()) ||
                  p.name.toLowerCase().includes(sub.toLowerCase()))
            ).length;

            return (
              <TouchableOpacity
                key={sub}
                onPress={() => onSelectSubcategory(selectedMainCat, sub)}
                activeOpacity={0.7}
                style={[styles.subItemRow, { borderBottomColor: colors.border }]}>
                <View style={styles.subItemLeft}>
                  <View style={[styles.subBullet, { backgroundColor: colors.primary }]} />
                  <Text style={[styles.subItemText, { color: colors.text }]}>{sub}</Text>
                </View>
                <View style={styles.subItemRight}>
                  {count > 0 && (
                    <View style={[styles.countPill, { backgroundColor: isDark ? colors.surfaceElevated : '#f3f4f6' }]}>
                      <Text style={[styles.countPillText, { color: colors.textSecondary }]}>{count} items</Text>
                    </View>
                  )}
                  <Ionicons
                    name="chevron-forward"
                    size={15}
                    color={colors.textMuted}
                  />
                </View>
              </TouchableOpacity>
            );
          })}

          {/* Trending picks preview in this department */}
          <View style={[styles.previewSection, { borderTopColor: colors.divider }]}>
            <View style={styles.previewHeaderRow}>
              <Text style={[styles.previewHeading, { color: colors.text }]}>TRENDING IN {selectedMainCat.toUpperCase()}</Text>
              <TouchableOpacity
                onPress={() => onSelectCategory?.(selectedMainCat)}
                activeOpacity={0.8}>
                <Text style={styles.previewViewAll}>VIEW ALL</Text>
              </TouchableOpacity>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.previewScroll}>
              {products.filter((p) => p.category.toLowerCase() === selectedMainCat.toLowerCase())
                .slice(0, 5)
                .map((p) => (
                  <TouchableOpacity
                    key={`cat-prev-${p.id}`}
                    style={[styles.previewCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
                    onPress={() => (onPressProduct ? onPressProduct(p) : onSelectCategory?.(selectedMainCat))}
                    activeOpacity={0.85}>
                    <Image source={{ uri: p.image }} style={[styles.previewImage, { backgroundColor: colors.surfaceElevated }]} />
                    <Text style={[styles.previewBrand, { color: colors.text }]} numberOfLines={1}>
                      {p.brand}
                    </Text>
                    <Text style={styles.previewPrice}>₹{p.price}</Text>
                  </TouchableOpacity>
                ))}
            </ScrollView>
          </View>
        </ScrollView>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: MyntraColors.white,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: MyntraColors.divider,
  },
  headerTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: MyntraColors.text,
    letterSpacing: 0.8,
  },
  headerSub: {
    fontSize: 11,
    color: MyntraColors.textSecondary,
    marginTop: 2,
  },
  viewAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#fff0f3',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  viewAllText: {
    fontSize: 10,
    fontWeight: '800',
    color: MyntraColors.primary,
  },
  contentRow: {
    flex: 1,
    flexDirection: 'row',
  },
  leftRail: {
    width: 110,
    backgroundColor: '#f8f8fa',
    borderRightWidth: 1,
    borderRightColor: MyntraColors.divider,
  },
  railItem: {
    paddingVertical: 16,
    paddingHorizontal: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: '#e6e6e8',
    alignItems: 'center',
  },
  railItemActive: {
    backgroundColor: MyntraColors.white,
    borderLeftWidth: 3.5,
    borderLeftColor: MyntraColors.primary,
  },
  railIcon: {
    marginBottom: 4,
  },
  railText: {
    fontSize: 12,
    fontWeight: '600',
    color: MyntraColors.textSecondary,
    textAlign: 'center',
  },
  railTextActive: {
    color: MyntraColors.primary,
    fontWeight: '800',
  },
  rightContent: {
    flex: 1,
    backgroundColor: MyntraColors.white,
  },
  rightScrollContent: {
    padding: Spacing.lg,
    paddingBottom: 90,
  },
  bannerContainer: {
    backgroundColor: '#fff4f6',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ffc1cf',
    marginBottom: Spacing.lg,
  },
  bannerTag: {
    fontSize: 10,
    fontWeight: '800',
    color: MyntraColors.primary,
    letterSpacing: 0.5,
  },
  bannerHeading: {
    fontSize: 13,
    fontWeight: '800',
    color: MyntraColors.text,
    marginTop: 2,
  },
  bannerSubtext: {
    fontSize: 11,
    color: MyntraColors.textSecondary,
    marginTop: 4,
  },
  subHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  subHeading: {
    fontSize: 11,
    fontWeight: '800',
    color: MyntraColors.textMuted,
    letterSpacing: 0.6,
  },
  subCount: {
    fontSize: 10,
    color: MyntraColors.textMuted,
  },
  subItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f3f5',
  },
  subItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  subBullet: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: MyntraColors.primary,
  },
  subItemText: {
    fontSize: 13,
    fontWeight: '600',
    color: MyntraColors.text,
  },
  subItemRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  countPill: {
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
  },
  countPillText: {
    fontSize: 9.5,
    fontWeight: '700',
    color: MyntraColors.textSecondary,
  },
  previewSection: {
    marginTop: Spacing.lg,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: MyntraColors.divider,
    paddingBottom: Spacing.xxl,
  },
  previewHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  previewHeading: {
    fontSize: 11,
    fontWeight: '800',
    color: MyntraColors.text,
    letterSpacing: 0.6,
  },
  previewViewAll: {
    fontSize: 11,
    fontWeight: '800',
    color: MyntraColors.primary,
  },
  previewScroll: {
    gap: 10,
    paddingVertical: 4,
  },
  previewCard: {
    width: 105,
    backgroundColor: '#fff',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#eaeaec',
    overflow: 'hidden',
  },
  previewImage: {
    width: '100%',
    height: 120,
    backgroundColor: '#f5f5f5',
  },
  previewBrand: {
    fontSize: 10,
    fontWeight: '800',
    color: MyntraColors.text,
    paddingHorizontal: 4,
    marginTop: 4,
  },
  previewPrice: {
    fontSize: 11,
    fontWeight: '800',
    color: MyntraColors.primary,
    paddingHorizontal: 4,
    marginBottom: 4,
  },
});
