import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { ProductCard } from './ProductCard';

import { MyntraColors, Spacing } from '@/constants/myntra-theme';
import { Product } from '@/data/mock-data';

interface ProductGridProps {
  products: Product[];
  wishlistIds: Set<string>;
  onToggleWishlist: (product: Product) => void;
  onPressProduct: (product: Product) => void;
  onResetFilters?: () => void;
  activeFilterTitle?: string;
  onOpenSort?: () => void;
  onOpenFilter?: () => void;
  appliedFilterCount?: number;
}

export const ProductGrid: React.FC<ProductGridProps> = ({
  products,
  wishlistIds,
  onToggleWishlist,
  onPressProduct,
  onResetFilters,
  activeFilterTitle,
  onOpenSort,
  onOpenFilter,
  appliedFilterCount = 0,
}) => {
  // If no products match the search or category
  if (products.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <View style={styles.emptyIconCircle}>
          <Ionicons
            name="search-outline"
            size={36}
            color={MyntraColors.textMuted}
          />
        </View>
        <Text style={styles.emptyTitle}>NO PRODUCTS FOUND</Text>
        <Text style={styles.emptySubtitle}>
          {"We couldn't find any items matching your search or filters."}
        </Text>
        {onResetFilters && (
          <TouchableOpacity
            style={styles.resetButton}
            onPress={onResetFilters}
            activeOpacity={0.8}>
            <Text style={styles.resetButtonText}>CLEAR FILTERS</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }

  // Split into 2 columns for a clean masonry / equal-column grid
  const leftColumn: Product[] = [];
  const rightColumn: Product[] = [];

  products.forEach((product, index) => {
    if (index % 2 === 0) {
      leftColumn.push(product);
    } else {
      rightColumn.push(product);
    }
  });

  return (
    <View style={styles.container}>
      {/* Sort & Filter Action Bar */}
      {(onOpenSort || onOpenFilter) && (
        <View style={styles.actionBar}>
          {onOpenSort && (
            <TouchableOpacity
              style={styles.actionButton}
              onPress={onOpenSort}
              activeOpacity={0.7}>
              <Ionicons name="swap-vertical" size={15} color={MyntraColors.text} />
              <Text style={styles.actionButtonText}>SORT</Text>
            </TouchableOpacity>
          )}

          {onOpenSort && onOpenFilter && <View style={styles.actionDivider} />}

          {onOpenFilter && (
            <TouchableOpacity
              style={styles.actionButton}
              onPress={onOpenFilter}
              activeOpacity={0.7}>
              <Ionicons name="options-outline" size={15} color={MyntraColors.text} />
              <Text style={styles.actionButtonText}>FILTER</Text>
              {appliedFilterCount > 0 && (
                <View style={styles.filterBadge}>
                  <Text style={styles.filterBadgeText}>{appliedFilterCount}</Text>
                </View>
              )}
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Grid Header */}
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.sectionTitle}>ALL PRODUCTS</Text>
          {activeFilterTitle ? (
            <Text style={styles.activeFilterText}>
              Showing results for{' '}
              <Text style={styles.activeFilterBold}>{activeFilterTitle}</Text>
            </Text>
          ) : (
            <Text style={styles.sectionSubtitle}>
              {products.length} Items • Handpicked for you
            </Text>
          )}
        </View>

        <View style={styles.deliveryBadge}>
          <Ionicons name="sparkles" size={12} color={MyntraColors.primary} />
          <Text style={styles.deliveryBadgeText}>BEST PRICE</Text>
        </View>
      </View>

      {/* Two Column Grid */}
      <View style={styles.gridRow}>
        <View style={styles.column}>
          {leftColumn.map((item) => (
            <ProductCard
              key={item.id}
              product={item}
              isWishlisted={wishlistIds.has(item.id)}
              onToggleWishlist={onToggleWishlist}
              onPressCard={onPressProduct}
            />
          ))}
        </View>
        <View style={styles.column}>
          {rightColumn.map((item) => (
            <ProductCard
              key={item.id}
              product={item}
              isWishlisted={wishlistIds.has(item.id)}
              onToggleWishlist={onToggleWishlist}
              onPressCard={onPressProduct}
            />
          ))}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.xl,
  },
  actionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: MyntraColors.white,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e8e8ec',
    marginBottom: Spacing.md,
    overflow: 'hidden',
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 11,
    gap: 6,
  },
  actionButtonText: {
    fontSize: 12,
    fontWeight: '800',
    color: MyntraColors.text,
    letterSpacing: 0.8,
  },
  actionDivider: {
    width: 1,
    height: 22,
    backgroundColor: '#e8e8ec',
  },
  filterBadge: {
    backgroundColor: MyntraColors.primary,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterBadgeText: {
    color: MyntraColors.white,
    fontSize: 10,
    fontWeight: '800',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: MyntraColors.text,
    letterSpacing: 1,
  },
  sectionSubtitle: {
    fontSize: 11,
    color: MyntraColors.textSecondary,
    marginTop: 2,
  },
  activeFilterText: {
    fontSize: 11,
    color: MyntraColors.textSecondary,
    marginTop: 2,
  },
  activeFilterBold: {
    color: MyntraColors.primary,
    fontWeight: '700',
  },
  deliveryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#fff0f3',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 0.5,
    borderColor: '#ffc1cf',
  },
  deliveryBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: MyntraColors.primary,
    letterSpacing: 0.5,
  },
  gridRow: {
    flexDirection: 'row',
    gap: 12,
  },
  column: {
    flex: 1,
  },
  emptyContainer: {
    padding: Spacing.xxl,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 280,
  },
  emptyIconCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: MyntraColors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: MyntraColors.text,
    letterSpacing: 0.8,
  },
  emptySubtitle: {
    fontSize: 12,
    color: MyntraColors.textSecondary,
    textAlign: 'center',
    marginTop: 4,
    maxWidth: 240,
    lineHeight: 18,
  },
  resetButton: {
    marginTop: Spacing.lg,
    backgroundColor: MyntraColors.primary,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 20,
  },
  resetButtonText: {
    color: MyntraColors.white,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
});
