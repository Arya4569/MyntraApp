import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { MyntraColors, Spacing } from '@/constants/myntra-theme';
import { Product } from '@/data/mock-data';
import { useTheme } from '@/hooks/use-theme';

export interface RecentlyViewedSectionProps {
  products: Product[];
  continueShoppingProducts?: Product[];
  hasPurchaseHistory?: boolean;
  isLoading?: boolean;
  error?: string | null;
  wishlistIds: Set<string>;
  onOpenProduct: (product: Product) => void;
  onToggleWishlist: (product: Product) => void;
  onQuickAddToBag: (product: Product) => void;
  onClearHistory: () => void;
  onRetry?: () => void;
  onExploreTrending?: () => void;
}

export const RecentlyViewedSection: React.FC<RecentlyViewedSectionProps> = ({
  products,
  continueShoppingProducts = [],
  hasPurchaseHistory = false,
  isLoading = false,
  error = null,
  wishlistIds,
  onOpenProduct,
  onToggleWishlist,
  onQuickAddToBag,
  onClearHistory,
  onRetry,
  onExploreTrending,
}) => {
  const { colors, isDark } = useTheme();
  // If user has purchase history and there are unpurchased items, default to 'continue' tab
  const canShowContinueTab = hasPurchaseHistory && continueShoppingProducts.length > 0;
  const [activeTab, setActiveTab] = useState<'continue' | 'all'>(
    canShowContinueTab ? 'continue' : 'all'
  );

  // Sync activeTab if continueShoppingProducts changes
  const effectiveTab = canShowContinueTab ? activeTab : 'all';
  const displayedProducts =
    effectiveTab === 'continue' ? continueShoppingProducts : products;

  // 1. Loading State
  if (isLoading && products.length === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.headerRow}>
          <View style={styles.titleWithIcon}>
            <Ionicons name="time-outline" size={16} color={MyntraColors.primary} />
            <Text style={styles.title}>RECENTLY VIEWED</Text>
          </View>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color={MyntraColors.primary} />
          <Text style={styles.loadingText}>Syncing your recent activity...</Text>
        </View>
      </View>
    );
  }

  // 2. Error State
  if (error && products.length === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.headerRow}>
          <View style={styles.titleWithIcon}>
            <Ionicons name="time-outline" size={16} color={MyntraColors.primary} />
            <Text style={styles.title}>RECENTLY VIEWED</Text>
          </View>
        </View>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle-outline" size={24} color={MyntraColors.textMuted} />
          <Text style={styles.errorText}>{error}</Text>
          {onRetry && (
            <TouchableOpacity style={styles.retryButton} onPress={onRetry} activeOpacity={0.8}>
              <Text style={styles.retryText}>Retry</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  }

  // 3. Empty State (Hide if not viewed anything)
  if (products.length === 0) {
    return null;
  }

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.surface,
          borderColor: colors.divider,
        },
      ]}>
      {/* Header Row */}
      <View style={styles.headerRow}>
        <View>
          <View style={styles.titleWithIcon}>
            <Ionicons
              name={effectiveTab === 'continue' ? 'bag-check-outline' : 'eye-outline'}
              size={16}
              color={colors.primary}
            />
            <Text style={[styles.title, { color: colors.text }]}>
              {effectiveTab === 'continue' ? 'CONTINUE SHOPPING' : 'RECENTLY VIEWED'}
            </Text>
            <View style={styles.countPill}>
              <Text style={styles.countText}>{displayedProducts.length}</Text>
            </View>
          </View>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            {effectiveTab === 'continue'
              ? 'Unpurchased items waiting in your browsing history'
              : 'Pick up right where you left off'}
          </Text>
        </View>

        <TouchableOpacity
          onPress={onClearHistory}
          style={styles.clearBtn}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityLabel="Clear recently viewed history">
          <Ionicons name="trash-outline" size={12} color={colors.textSecondary} />
          <Text style={[styles.clearText, { color: colors.textSecondary }]}>CLEAR</Text>
        </TouchableOpacity>
      </View>

      {/* Segmented Filter Tabs (if continue shopping is available) */}
      {canShowContinueTab && (
        <View style={styles.tabsRow}>
          <TouchableOpacity
            style={[
              styles.tabPill,
              { backgroundColor: colors.inputBackground, borderColor: colors.cardBorder },
              effectiveTab === 'continue' && styles.tabPillActive,
            ]}
            onPress={() => setActiveTab('continue')}
            activeOpacity={0.8}>
            <Ionicons
              name="cart-outline"
              size={12}
              color={effectiveTab === 'continue' ? '#ffffff' : colors.text}
            />
            <Text
              style={[
                styles.tabText,
                { color: colors.text },
                effectiveTab === 'continue' && styles.tabTextActive,
              ]}>
              Continue Shopping ({continueShoppingProducts.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.tabPill,
              { backgroundColor: colors.inputBackground, borderColor: colors.cardBorder },
              effectiveTab === 'all' && styles.tabPillActive,
            ]}
            onPress={() => setActiveTab('all')}
            activeOpacity={0.8}>
            <Ionicons
              name="time-outline"
              size={12}
              color={effectiveTab === 'all' ? '#ffffff' : colors.text}
            />
            <Text
              style={[
                styles.tabText,
                { color: colors.text },
                effectiveTab === 'all' && styles.tabTextActive,
              ]}>
              All Viewed ({products.length})
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Horizontal Scroll of Products */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}>
        {displayedProducts.map((p) => {
          const isWishlisted = wishlistIds.has(p.id);

          return (
            <TouchableOpacity
              key={`recent-${p.id}`}
              style={[
                styles.card,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.cardBorder,
                },
              ]}
              onPress={() => onOpenProduct(p)}
              activeOpacity={0.9}
              accessibilityLabel={`View ${p.brand} ${p.name}`}>
              {/* Product Image */}
              <View
                style={[
                  styles.imageContainer,
                  { backgroundColor: colors.surfaceSecondary },
                ]}>
                <Image
                  source={{ uri: p.image }}
                  style={styles.productImage}
                  resizeMode="cover"
                />

                {/* Discount Badge */}
                {p.discountPercent > 0 && (
                  <View style={styles.discountBadge}>
                    <Text style={styles.discountText}>{p.discountPercent}% OFF</Text>
                  </View>
                )}

                {/* Floating Wishlist Button */}
                <TouchableOpacity
                  style={[
                    styles.wishlistBtn,
                    {
                      backgroundColor: isDark
                        ? colors.surfaceElevated
                        : 'rgba(255, 255, 255, 0.92)',
                    },
                  ]}
                  onPress={(e) => {
                    e.stopPropagation();
                    onToggleWishlist(p);
                  }}
                  activeOpacity={0.8}
                  accessibilityLabel={isWishlisted ? 'Remove from Wishlist' : 'Add to Wishlist'}>
                  <Ionicons
                    name={isWishlisted ? 'heart' : 'heart-outline'}
                    size={15}
                    color={isWishlisted ? colors.primary : colors.textSecondary}
                  />
                </TouchableOpacity>

                {/* Rating Pill */}
                {p.rating !== undefined && p.rating > 0 && (
                  <View style={styles.ratingBadge}>
                    <Text style={styles.ratingText}>{p.rating.toFixed(1)}</Text>
                    <Ionicons name="star" size={9} color={MyntraColors.white} />
                  </View>
                )}
              </View>

              {/* Product Meta */}
              <View style={styles.detailsContainer}>
                <Text
                  style={[styles.brand, { color: colors.text }]}
                  numberOfLines={1}>
                  {p.brand}
                </Text>
                <Text
                  style={[styles.name, { color: colors.textSecondary }]}
                  numberOfLines={1}>
                  {p.name}
                </Text>

                {/* Pricing Row */}
                <View style={styles.priceRow}>
                  <Text style={[styles.price, { color: colors.text }]}>₹{p.price}</Text>
                  {p.originalPrice > p.price && (
                    <Text style={[styles.originalPrice, { color: colors.textMuted }]}>
                      ₹{p.originalPrice}
                    </Text>
                  )}
                </View>

                {/* Quick Add To Bag Action */}
                <TouchableOpacity
                  style={[
                    styles.quickAddBtn,
                    {
                      backgroundColor: isDark ? colors.surfaceSecondary : '#fff5f7',
                      borderColor: colors.primary,
                    },
                  ]}
                  onPress={(e) => {
                    e.stopPropagation();
                    onQuickAddToBag(p);
                  }}
                  activeOpacity={0.8}
                  accessibilityLabel={`Add ${p.name} to bag`}>
                  <Ionicons name="bag-handle-outline" size={12} color={colors.primary} />
                  <Text style={[styles.quickAddText, { color: colors.primary }]}>+ BAG</Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginTop: Spacing.lg,
    paddingVertical: Spacing.xs,
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#f0f0f4',
    paddingBottom: Spacing.sm,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.xs,
    paddingTop: Spacing.sm,
  },
  titleWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  title: {
    fontSize: 13,
    fontWeight: '800',
    color: MyntraColors.text,
    letterSpacing: 0.8,
  },
  subtitle: {
    fontSize: 10,
    color: MyntraColors.textSecondary,
    marginTop: 2,
    paddingLeft: 22,
  },
  countPill: {
    backgroundColor: '#fff0f3',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 10,
  },
  countText: {
    fontSize: 10,
    fontWeight: '800',
    color: MyntraColors.primary,
  },
  clearBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingVertical: 4,
    paddingHorizontal: 6,
    borderRadius: 4,
    backgroundColor: '#f5f5f8',
  },
  clearText: {
    fontSize: 10,
    fontWeight: '800',
    color: MyntraColors.textSecondary,
    letterSpacing: 0.5,
  },
  tabsRow: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.lg,
    gap: 8,
    marginTop: Spacing.sm,
    marginBottom: 4,
  },
  tabPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 16,
    backgroundColor: '#f0f0f5',
  },
  tabPillActive: {
    backgroundColor: MyntraColors.text,
  },
  tabText: {
    fontSize: 11,
    fontWeight: '700',
    color: MyntraColors.text,
  },
  tabTextActive: {
    color: MyntraColors.white,
  },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    gap: 12,
  },
  card: {
    width: 138,
    backgroundColor: MyntraColors.white,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e8e8ec',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  imageContainer: {
    width: '100%',
    height: 145,
    backgroundColor: '#f6f6f8',
    position: 'relative',
  },
  productImage: {
    width: '100%',
    height: '100%',
  },
  discountBadge: {
    position: 'absolute',
    bottom: 6,
    left: 6,
    backgroundColor: 'rgba(255, 63, 108, 0.95)',
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 3,
  },
  discountText: {
    color: MyntraColors.white,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  wishlistBtn: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
    elevation: 2,
  },
  ratingBadge: {
    position: 'absolute',
    top: 6,
    left: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: 'rgba(3, 166, 133, 0.9)',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 3,
  },
  ratingText: {
    color: MyntraColors.white,
    fontSize: 9,
    fontWeight: '800',
  },
  detailsContainer: {
    padding: 8,
  },
  brand: {
    fontSize: 11,
    fontWeight: '800',
    color: MyntraColors.text,
    textTransform: 'uppercase',
  },
  name: {
    fontSize: 10.5,
    color: MyntraColors.textSecondary,
    marginTop: 2,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 4,
  },
  price: {
    fontSize: 12,
    fontWeight: '800',
    color: MyntraColors.text,
  },
  originalPrice: {
    fontSize: 9.5,
    color: MyntraColors.textMuted,
    textDecorationLine: 'line-through',
  },
  quickAddBtn: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 5,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#ff3f6c',
    backgroundColor: '#fff5f7',
  },
  quickAddText: {
    fontSize: 10,
    fontWeight: '800',
    color: MyntraColors.primary,
    letterSpacing: 0.5,
  },
  loadingContainer: {
    paddingVertical: Spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  loadingText: {
    fontSize: 11,
    color: MyntraColors.textSecondary,
  },
  errorContainer: {
    paddingVertical: Spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  errorText: {
    fontSize: 11,
    color: MyntraColors.textSecondary,
  },
  retryButton: {
    marginTop: 4,
    paddingHorizontal: 12,
    paddingVertical: 4,
    backgroundColor: MyntraColors.primary,
    borderRadius: 4,
  },
  retryText: {
    color: MyntraColors.white,
    fontSize: 11,
    fontWeight: '700',
  },
});
