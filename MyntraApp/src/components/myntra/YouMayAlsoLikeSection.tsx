import { Ionicons } from '@expo/vector-icons';
import React from 'react';
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
import { RecommendationProduct } from '@/types/store';

export interface YouMayAlsoLikeSectionProps {
  products: RecommendationProduct[];
  isPersonalized?: boolean;
  title?: string;
  subtitle?: string;
  isLoading?: boolean;
  error?: string | null;
  wishlistIds: Set<string>;
  onOpenProduct: (product: Product) => void;
  onToggleWishlist: (product: Product) => void;
  onQuickAddToBag: (product: Product) => void;
  onRefresh?: () => void;
  onRetry?: () => void;
}

export const YouMayAlsoLikeSection: React.FC<YouMayAlsoLikeSectionProps> = ({
  products,
  isPersonalized = false,
  title = 'YOU MAY ALSO LIKE',
  subtitle,
  isLoading = false,
  error = null,
  wishlistIds,
  onOpenProduct,
  onToggleWishlist,
  onQuickAddToBag,
  onRefresh,
  onRetry,
}) => {
  const { colors, isDark } = useTheme();

  // 1. Loading Skeleton State
  if (isLoading && products.length === 0) {
    return (
      <View
        style={[
          styles.container,
          {
            backgroundColor: colors.surface,
            borderColor: colors.divider,
          },
        ]}>
        <View style={styles.headerRow}>
          <View style={styles.titleWithIcon}>
            <Ionicons name="sparkles" size={16} color={colors.primary} />
            <Text style={[styles.title, { color: colors.text }]}>YOU MAY ALSO LIKE</Text>
          </View>
        </View>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          Curating personalized styles for you...
        </Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}>
          {[1, 2, 3].map((key) => (
            <View
              key={`skeleton-${key}`}
              style={[
                styles.skeletonCard,
                {
                  backgroundColor: colors.surfaceSecondary,
                  borderColor: colors.cardBorder,
                },
              ]}>
              <View
                style={[
                  styles.skeletonImage,
                  { backgroundColor: colors.inputBackground },
                ]}>
                <ActivityIndicator size="small" color={colors.primary} />
              </View>
              <View style={styles.skeletonDetails}>
                <View
                  style={[
                    styles.skeletonLine,
                    { backgroundColor: colors.inputBackground, width: '60%' },
                  ]}
                />
                <View
                  style={[
                    styles.skeletonLine,
                    { backgroundColor: colors.inputBackground, width: '90%', marginTop: 6 },
                  ]}
                />
                <View
                  style={[
                    styles.skeletonLine,
                    { backgroundColor: colors.inputBackground, width: '40%', marginTop: 8 },
                  ]}
                />
              </View>
            </View>
          ))}
        </ScrollView>
      </View>
    );
  }

  // 2. Error State with Retry
  if (error && products.length === 0) {
    return (
      <View
        style={[
          styles.container,
          {
            backgroundColor: colors.surface,
            borderColor: colors.divider,
          },
        ]}>
        <View style={styles.headerRow}>
          <View style={styles.titleWithIcon}>
            <Ionicons name="sparkles" size={16} color={colors.primary} />
            <Text style={[styles.title, { color: colors.text }]}>YOU MAY ALSO LIKE</Text>
          </View>
        </View>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle-outline" size={24} color={colors.textMuted} />
          <Text style={[styles.errorText, { color: colors.textSecondary }]}>{error}</Text>
          {onRetry && (
            <TouchableOpacity
              style={[styles.retryButton, { backgroundColor: colors.primary }]}
              onPress={onRetry}
              activeOpacity={0.8}>
              <Text style={styles.retryText}>Retry Recommendations</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  }

  // 3. Empty State (Hide gracefully if no products)
  if (products.length === 0) {
    return null;
  }

  const effectiveSubtitle =
    subtitle ||
    (isPersonalized
      ? 'Handpicked styles tailored to your tastes & browsing'
      : 'Popular & trending picks handpicked from our collection');

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
        <View style={styles.headerLeftWrap}>
          <View style={styles.titleWithIcon}>
            <Ionicons name="sparkles" size={16} color={colors.primary} />
            <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
            {isPersonalized ? (
              <View style={[styles.badgePill, { backgroundColor: '#fff0f3', borderColor: '#ffd1dc' }]}>
                <Ionicons name="finger-print-outline" size={10} color={MyntraColors.primary} />
                <Text style={styles.badgeText}>Personalized</Text>
              </View>
            ) : (
              <View style={[styles.badgePill, { backgroundColor: '#eff6ff', borderColor: '#bfdbfe' }]}>
                <Ionicons name="flame-outline" size={10} color="#2563eb" />
                <Text style={[styles.badgeText, { color: '#2563eb' }]}>Trending</Text>
              </View>
            )}
          </View>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]} numberOfLines={1}>
            {effectiveSubtitle}
          </Text>
        </View>

        {onRefresh && (
          <TouchableOpacity
            onPress={onRefresh}
            style={[styles.refreshBtn, { borderColor: colors.cardBorder }]}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityLabel="Refresh recommendations">
            <Ionicons name="refresh-outline" size={13} color={colors.textSecondary} />
            <Text style={[styles.refreshText, { color: colors.textSecondary }]}>REFRESH</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Horizontal Scroll of Recommended Products */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}>
        {products.map((p) => {
          const isWishlisted = wishlistIds.has(p.id);
          const ratingVal = typeof p.rating === 'number' ? p.rating : 4.2;
          const ratingCountStr = p.ratingCount || ((p as any).reviewCount ? `${(p as any).reviewCount}` : '1.2k');

          return (
            <TouchableOpacity
              key={`rec-${p.id}`}
              style={[
                styles.card,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.cardBorder,
                },
              ]}
              onPress={() => onOpenProduct(p)}
              activeOpacity={0.9}
              accessibilityLabel={`View recommended ${p.brand} ${p.name}`}>
              {/* Product Image (3:4 ratio) */}
              <View
                style={[
                  styles.imageWrapper,
                  { backgroundColor: colors.surfaceSecondary },
                ]}>
                <Image
                  source={{ uri: p.image }}
                  style={styles.image}
                  resizeMode="cover"
                />

                {/* Recommendation Reason Pill Overlay */}
                {Boolean(p.recommendationReason) && (
                  <View style={styles.reasonBadge}>
                    <Text style={styles.reasonBadgeText} numberOfLines={1}>
                      {p.recommendationReason}
                    </Text>
                  </View>
                )}

                {/* Rating Badge Overlay */}
                <View
                  style={[
                    styles.ratingPill,
                    {
                      backgroundColor: isDark
                        ? 'rgba(30, 31, 36, 0.92)'
                        : 'rgba(255, 255, 255, 0.92)',
                      borderColor: colors.cardBorder,
                    },
                  ]}>
                  <Text style={[styles.ratingNumber, { color: colors.text }]}>
                    {ratingVal.toFixed(1)}
                  </Text>
                  <Ionicons name="star" size={8} color={colors.ratingGreen} />
                  <Text style={[styles.ratingPipe, { color: colors.textMuted }]}>|</Text>
                  <Text style={[styles.ratingTotal, { color: colors.textSecondary }]}>
                    {ratingCountStr}
                  </Text>
                </View>

                {/* Wishlist Button */}
                <TouchableOpacity
                  style={[
                    styles.wishlistBtn,
                    {
                      backgroundColor: isDark
                        ? colors.surfaceElevated
                        : 'rgba(255, 255, 255, 0.9)',
                    },
                    isWishlisted && styles.wishlistBtnActive,
                  ]}
                  onPress={() => onToggleWishlist(p)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  accessibilityLabel={isWishlisted ? 'Remove from wishlist' : 'Add to wishlist'}>
                  <Ionicons
                    name={isWishlisted ? 'heart' : 'heart-outline'}
                    size={15}
                    color={isWishlisted ? colors.primary : colors.textSecondary}
                  />
                </TouchableOpacity>
              </View>

              {/* Product Info */}
              <View style={styles.details}>
                <Text style={[styles.brand, { color: colors.text }]} numberOfLines={1}>
                  {p.brand}
                </Text>
                <Text style={[styles.name, { color: colors.textSecondary }]} numberOfLines={1}>
                  {p.name}
                </Text>

                {/* Price Row */}
                <View style={styles.priceRow}>
                  <Text style={[styles.price, { color: colors.text }]}>₹{p.price}</Text>
                  {p.originalPrice > p.price && (
                    <Text style={[styles.originalPrice, { color: colors.textMuted }]}>
                      ₹{p.originalPrice}
                    </Text>
                  )}
                  {p.discountPercent > 0 && (
                    <Text style={styles.discount}>({p.discountPercent}% OFF)</Text>
                  )}
                </View>

                {/* Quick Add To Bag CTA */}
                <TouchableOpacity
                  style={[styles.quickAddBtn, { borderColor: colors.primary }]}
                  onPress={() => onQuickAddToBag(p)}
                  activeOpacity={0.8}
                  accessibilityLabel={`Add ${p.name} to bag`}>
                  <Ionicons name="bag-add-outline" size={13} color={colors.primary} />
                  <Text style={[styles.quickAddText, { color: colors.primary }]}>
                    ADD TO BAG
                  </Text>
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
    marginVertical: Spacing.sm,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
    borderTopWidth: 1,
    borderBottomWidth: 1,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.sm,
  },
  headerLeftWrap: {
    flex: 1,
    paddingRight: Spacing.sm,
  },
  titleWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  title: {
    fontFamily: 'Inter_700Bold',
    fontSize: 13,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  badgePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    borderWidth: 1,
  },
  badgeText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 10,
    color: MyntraColors.primary,
  },
  subtitle: {
    fontFamily: 'Inter_400Regular',
    fontSize: 11,
    marginTop: 2,
  },
  refreshBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
  },
  refreshText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 10,
    letterSpacing: 0.5,
  },
  scrollContent: {
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.xs,
    gap: 12,
  },
  card: {
    width: 154,
    borderRadius: 8,
    borderWidth: 1,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  imageWrapper: {
    width: '100%',
    aspectRatio: 3 / 4,
    position: 'relative',
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  reasonBadge: {
    position: 'absolute',
    top: 6,
    left: 6,
    right: 34,
    backgroundColor: 'rgba(20, 20, 24, 0.85)',
    paddingHorizontal: 6,
    paddingVertical: 2.5,
    borderRadius: 4,
  },
  reasonBadgeText: {
    color: '#ffffff',
    fontFamily: 'Inter_600SemiBold',
    fontSize: 9,
    letterSpacing: 0.2,
  },
  ratingPill: {
    position: 'absolute',
    bottom: 6,
    left: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 0.5,
  },
  ratingNumber: {
    fontFamily: 'Inter_700Bold',
    fontSize: 9,
  },
  ratingPipe: {
    fontSize: 8,
    marginHorizontal: 1,
  },
  ratingTotal: {
    fontFamily: 'Inter_400Regular',
    fontSize: 8,
  },
  wishlistBtn: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
    elevation: 2,
  },
  wishlistBtnActive: {
    backgroundColor: '#fff0f3',
  },
  details: {
    padding: 8,
  },
  brand: {
    fontFamily: 'Inter_700Bold',
    fontSize: 11,
    textTransform: 'uppercase',
  },
  name: {
    fontFamily: 'Inter_400Regular',
    fontSize: 11,
    marginTop: 1,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
    marginTop: 4,
    flexWrap: 'wrap',
  },
  price: {
    fontFamily: 'Inter_700Bold',
    fontSize: 12,
  },
  originalPrice: {
    fontFamily: 'Inter_400Regular',
    fontSize: 10,
    textDecorationLine: 'line-through',
  },
  discount: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 9,
    color: '#03a685',
  },
  quickAddBtn: {
    marginTop: 8,
    borderWidth: 1,
    borderRadius: 4,
    paddingVertical: 5,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  quickAddText: {
    fontFamily: 'Inter_700Bold',
    fontSize: 10,
    letterSpacing: 0.5,
  },
  skeletonCard: {
    width: 154,
    borderRadius: 8,
    borderWidth: 1,
    overflow: 'hidden',
  },
  skeletonImage: {
    width: '100%',
    aspectRatio: 3 / 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  skeletonDetails: {
    padding: 8,
  },
  skeletonLine: {
    height: 10,
    borderRadius: 4,
  },
  errorContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.md,
    gap: 8,
  },
  errorText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    textAlign: 'center',
  },
  retryButton: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: 6,
  },
  retryText: {
    color: '#ffffff',
    fontFamily: 'Inter_600SemiBold',
    fontSize: 11,
  },
});
