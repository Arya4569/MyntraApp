import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';

import { MyntraColors, Spacing } from '@/constants/myntra-theme';
import { Product, PRODUCTS } from '@/data/mock-data';
import { useTheme } from '@/hooks/use-theme';
import { storeService } from '@/services/store-service';

export type WishlistSortOption =
  | 'recent'
  | 'price_low_high'
  | 'price_high_low'
  | 'discount'
  | 'rating';

export type WishlistCollectionType =
  | 'All'
  | 'Everyday Fashion'
  | 'Party Wear'
  | 'Footwear'
  | 'Gift Ideas';

interface WishlistScreenProps {
  wishlistProducts: Product[];
  onRemoveFromWishlist: (product: Product) => void;
  onMoveToBag: (product: Product, size: string, color?: string) => Promise<void>;
  onStartShopping: () => void;
  onPressProduct: (product: Product) => void;
  onClearWishlist?: () => void;
  allProducts?: Product[];
}

export const WishlistScreen: React.FC<WishlistScreenProps> = ({
  wishlistProducts,
  onRemoveFromWishlist,
  onMoveToBag,
  onStartShopping,
  onPressProduct,
  onClearWishlist,
  allProducts = PRODUCTS,
}) => {
  const { width } = useWindowDimensions();
  const cardWidth = width >= 1100 ? '23.8%' : (width >= 750 ? '31.8%' : '48.5%');

  // 1. Search & Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchVisible, setIsSearchVisible] = useState(false);
  const [selectedCollection, setSelectedCollection] = useState<WishlistCollectionType>('All');
  const [sortBy, setSortBy] = useState<WishlistSortOption>('recent');
  const [isSortModalVisible, setIsSortModalVisible] = useState(false);
  const [isFilterModalVisible, setIsFilterModalVisible] = useState(false);

  // Active filter state
  const [selectedBrand, setSelectedBrand] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedPriceBracket, setSelectedPriceBracket] = useState<string | null>(null);
  const [inStockOnly, setInStockOnly] = useState(false);

  // 2. Collection assignments { [productId]: collectionName }
  const [collectionsMap, setCollectionsMap] = useState<Record<string, string>>({});

  // 3. Size selection modal state for Move to Bag
  const [sizeModalProduct, setSizeModalProduct] = useState<Product | null>(null);
  const [selectedSize, setSelectedSize] = useState<string>('');
  const [selectedColor, setSelectedColor] = useState<string>('');
  const [sizeError, setSizeError] = useState(false);
  const [isMovingToBag, setIsMovingToBag] = useState(false);

  // 4. More Options modal state
  const [menuProduct, setMenuProduct] = useState<Product | null>(null);

  // 5. Clear wishlist confirmation modal
  const [isClearConfirmVisible, setIsClearConfirmVisible] = useState(false);

  const { colors, isDark } = useTheme();
  const styles = useMemo(() => createStyles(colors, isDark), [colors, isDark]);

  // Load saved collections mapping
  useEffect(() => {
    let isMounted = true;
    storeService.getWishlistCollections().then((map) => {
      if (isMounted) setCollectionsMap(map);
    });
    return () => {
      isMounted = false;
    };
  }, []);

  // Helper to determine collection heuristic if not explicitly set
  const getProductCollection = useCallback((product: Product): WishlistCollectionType => {
    if (collectionsMap[product.id]) {
      return collectionsMap[product.id] as WishlistCollectionType;
    }
    const cat = product.category.toLowerCase();
    const name = product.name.toLowerCase();
    const sub = product.subcategory.toLowerCase();

    if (cat === 'footwear' || sub.includes('shoe') || name.includes('shoe') || name.includes('sneaker')) {
      return 'Footwear';
    }
    if (
      sub.includes('kurta') ||
      sub.includes('lehenga') ||
      sub.includes('dress') ||
      sub.includes('blazer') ||
      name.includes('silk') ||
      name.includes('party') ||
      name.includes('festive')
    ) {
      return 'Party Wear';
    }
    if (
      cat === 'beauty' ||
      name.includes('perfume') ||
      name.includes('fragrance') ||
      name.includes('watch') ||
      name.includes('sunglass') ||
      name.includes('serum')
    ) {
      return 'Gift Ideas';
    }
    return 'Everyday Fashion';
  }, [collectionsMap]);

  // Handle changing collection
  const handleAssignCollection = async (product: Product, collection: WishlistCollectionType) => {
    const updated = await storeService.saveProductCollection(product.id, collection);
    setCollectionsMap(updated);
    setMenuProduct(null);
  };

  // Available brands from wishlisted items
  const availableBrands = useMemo(() => {
    return Array.from(new Set(wishlistProducts.map((p) => p.brand))).sort();
  }, [wishlistProducts]);

  // Available categories from wishlisted items
  const availableCategories = useMemo(() => {
    return Array.from(new Set(wishlistProducts.map((p) => p.category))).sort();
  }, [wishlistProducts]);

  // Filter & Sort Logic
  const filteredProducts = useMemo(() => {
    let list = [...wishlistProducts];

    // 1. Search Query
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.brand.toLowerCase().includes(q) ||
          p.category.toLowerCase().includes(q) ||
          p.subcategory.toLowerCase().includes(q)
      );
    }

    // 2. Collection
    if (selectedCollection !== 'All') {
      list = list.filter((p) => getProductCollection(p) === selectedCollection);
    }

    // 3. Brand
    if (selectedBrand) {
      list = list.filter((p) => p.brand === selectedBrand);
    }

    // 4. Category
    if (selectedCategory) {
      list = list.filter((p) => p.category === selectedCategory);
    }

    // 5. Price Bracket
    if (selectedPriceBracket === 'under_1000') {
      list = list.filter((p) => p.price < 1000);
    } else if (selectedPriceBracket === '1000_1999') {
      list = list.filter((p) => p.price >= 1000 && p.price <= 1999);
    } else if (selectedPriceBracket === '2000_plus') {
      list = list.filter((p) => p.price >= 2000);
    }

    // 6. In Stock Only
    if (inStockOnly) {
      list = list.filter((p) => p.inStock !== false);
    }

    // 7. Sort
    return list.sort((a, b) => {
      if (sortBy === 'price_low_high') return a.price - b.price;
      if (sortBy === 'price_high_low') return b.price - a.price;
      if (sortBy === 'discount') return b.discountPercent - a.discountPercent;
      if (sortBy === 'rating') return b.rating - a.rating;
      return 0; // Default: 'recent' preserved by original order
    });
  }, [
    wishlistProducts,
    searchQuery,
    selectedCollection,
    selectedBrand,
    selectedCategory,
    selectedPriceBracket,
    inStockOnly,
    sortBy,
    getProductCollection,
  ]);

  // Catalog recommendations for empty state and bottom carousel
  const recommendedProducts = useMemo(() => {
    const wishlistedIds = new Set(wishlistProducts.map((p) => p.id));
    const catalogSource = allProducts && allProducts.length > 0 ? allProducts : PRODUCTS;
    return catalogSource.filter((p) => !wishlistedIds.has(p.id)).slice(0, 6);
  }, [wishlistProducts, allProducts]);

  // Active filter count
  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (selectedBrand) count++;
    if (selectedCategory) count++;
    if (selectedPriceBracket) count++;
    if (inStockOnly) count++;
    return count;
  }, [selectedBrand, selectedCategory, selectedPriceBracket, inStockOnly]);

  const clearAllFilters = () => {
    setSelectedBrand(null);
    setSelectedCategory(null);
    setSelectedPriceBracket(null);
    setInStockOnly(false);
    setSearchQuery('');
  };

  // Move to bag trigger
  const handleInitiateMoveToBag = (product: Product) => {
    // If product has 1 size (or 'One Size') and 1 color, move directly
    if (product.sizes.length <= 1) {
      const defaultSize = product.sizes[0] || 'One Size';
      const defaultColor = product.colors[0] || '';
      onMoveToBag(product, defaultSize, defaultColor);
      return;
    }

    // Otherwise, open size selection modal
    setSizeModalProduct(product);
    setSelectedSize(product.sizes.length === 1 ? product.sizes[0] : '');
    setSelectedColor(product.colors[0] || '');
    setSizeError(false);
  };

  // Confirm size and move to bag
  const handleConfirmMoveToBag = async () => {
    if (!sizeModalProduct) return;
    if (!selectedSize) {
      setSizeError(true);
      return;
    }

    try {
      setIsMovingToBag(true);
      await onMoveToBag(sizeModalProduct, selectedSize, selectedColor);
      setSizeModalProduct(null);
      setSelectedSize('');
    } finally {
      setIsMovingToBag(false);
    }
  };

  // Native share wishlist
  const handleShareWishlist = async () => {
    try {
      if (wishlistProducts.length === 0) {
        Alert.alert('Wishlist Empty', 'Add styles to your wishlist before sharing.');
        return;
      }

      const itemTitles = wishlistProducts
        .slice(0, 5)
        .map((p, idx) => `${idx + 1}. ${p.brand} ${p.name} - ₹${p.price}`)
        .join('\n');

      const message = `✨ My Fashion Wishlist on Myntra (${wishlistProducts.length} items):\n\n${itemTitles}${
        wishlistProducts.length > 5 ? `\n...and ${wishlistProducts.length - 5} more styles!` : ''
      }\n\nDiscover trending looks with unbeatable discounts!`;

      await Share.share({
        message,
        title: 'My Fashion Wishlist',
      });
    } catch (e) {
      console.warn('Share error:', e);
    }
  };

  // Share single product
  const handleShareProduct = async (product: Product) => {
    try {
      await Share.share({
        message: `Take a look at this ${product.brand} ${product.name} on Myntra for just ₹${product.price} (${product.discountPercent}% OFF)!`,
        title: `${product.brand} - ${product.name}`,
      });
    } catch (e) {
      console.warn('Product share error:', e);
    }
  };

  // Sort label display
  const getSortLabel = () => {
    switch (sortBy) {
      case 'price_low_high':
        return 'Price: Low to High';
      case 'price_high_low':
        return 'Price: High to Low';
      case 'discount':
        return 'Better Discount';
      case 'rating':
        return 'Customer Rating';
      default:
        return 'Recently Added';
    }
  };

  // Render Empty State
  if (wishlistProducts.length === 0) {
    return (
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.emptyScrollContent}
        showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerTitleRow}>
            <TouchableOpacity onPress={onStartShopping} style={styles.headerBackBtn}>
              <Ionicons name="arrow-back" size={22} color={MyntraColors.text} />
            </TouchableOpacity>
            <View>
              <Text style={styles.headerTitle}>MY WISHLIST</Text>
              <Text style={styles.headerCount}>0 ITEMS</Text>
            </View>
          </View>
        </View>

        {/* Empty State Banner */}
        <View style={styles.emptyContainer}>
          <View style={styles.emptyHeartCircle}>
            <Ionicons name="heart-outline" size={48} color={MyntraColors.primary} />
          </View>
          <Text style={styles.emptyTitle}>YOUR WISHLIST IS EMPTY</Text>
          <Text style={styles.emptySubtitle}>
            Explore our trending fashion collection and shortlist your favorite styles to purchase anytime.
          </Text>
          <TouchableOpacity
            style={styles.exploreButton}
            onPress={onStartShopping}
            activeOpacity={0.85}>
            <Text style={styles.exploreButtonText}>EXPLORE PRODUCTS</Text>
          </TouchableOpacity>
        </View>

        {/* Catalog Recommendations for Empty State */}
        {recommendedProducts.length > 0 && (
          <View style={styles.recommendationSection}>
            <View style={styles.recHeaderRow}>
              <View>
                <Text style={styles.recSectionTitle}>POPULAR PICKS FOR YOU</Text>
                <Text style={styles.recSectionSubtitle}>Top rated styles trending right now</Text>
              </View>
            </View>

            <View style={styles.grid}>
              {recommendedProducts.map((product) => (
                <View key={`rec-${product.id}`} style={styles.itemCard}>
                  <TouchableOpacity
                    activeOpacity={0.92}
                    onPress={() => onPressProduct(product)}
                    style={styles.imageContainer}>
                    <Image
                      source={{ uri: product.image }}
                      style={styles.image}
                      resizeMode="cover"
                    />
                    <TouchableOpacity
                      onPress={() => onRemoveFromWishlist(product)}
                      style={styles.heartButton}
                      activeOpacity={0.8}>
                      <Ionicons
                        name="heart-outline"
                        size={18}
                        color={MyntraColors.primary}
                      />
                    </TouchableOpacity>
                  </TouchableOpacity>

                  <View style={styles.details}>
                    <Text style={styles.brand} numberOfLines={1}>
                      {product.brand}
                    </Text>
                    <Text style={styles.name} numberOfLines={1}>
                      {product.name}
                    </Text>
                    <View style={styles.priceRow}>
                      <Text style={styles.price}>₹{product.price}</Text>
                      {product.originalPrice > product.price && (
                        <Text style={styles.originalPrice}>₹{product.originalPrice}</Text>
                      )}
                      {product.discountPercent > 0 && (
                        <Text style={styles.discountBadge}>
                          ({product.discountPercent}% OFF)
                        </Text>
                      )}
                    </View>
                  </View>

                  <TouchableOpacity
                    onPress={() => handleInitiateMoveToBag(product)}
                    style={styles.moveToBagBtn}
                    activeOpacity={0.85}>
                    <Ionicons name="bag-add-outline" size={14} color={MyntraColors.primary} />
                    <Text style={styles.moveToBagText}>ADD TO BAG</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          </View>
        )}
      </ScrollView>
    );
  }

  return (
    <View style={styles.container}>
      {/* 1. Header with Title, Count, Search, Share & Clear Actions */}
      <View style={styles.header}>
        <View style={styles.headerTitleRow}>
          <TouchableOpacity onPress={onStartShopping} style={styles.headerBackBtn}>
            <Ionicons name="arrow-back" size={22} color={MyntraColors.text} />
          </TouchableOpacity>
          <View>
            <Text style={styles.headerTitle}>MY WISHLIST</Text>
            <Text style={styles.headerCount}>
              {wishlistProducts.length} {wishlistProducts.length === 1 ? 'ITEM' : 'ITEMS'}
            </Text>
          </View>
        </View>

        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.headerIconBtn}
            onPress={() => setIsSearchVisible(!isSearchVisible)}
            activeOpacity={0.7}>
            <Ionicons
              name={isSearchVisible ? 'close' : 'search-outline'}
              size={20}
              color={MyntraColors.text}
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.headerIconBtn}
            onPress={handleShareWishlist}
            activeOpacity={0.7}>
            <Ionicons name="share-social-outline" size={20} color={MyntraColors.text} />
          </TouchableOpacity>

          {onClearWishlist && (
            <TouchableOpacity
              style={styles.headerIconBtn}
              onPress={() => setIsClearConfirmVisible(true)}
              activeOpacity={0.7}>
              <Ionicons name="trash-outline" size={20} color={MyntraColors.textMuted} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* 2. Collapsible Search Bar */}
      {isSearchVisible && (
        <View style={styles.searchContainer}>
          <View style={styles.searchInputWrapper}>
            <Ionicons name="search" size={16} color={MyntraColors.textMuted} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search by brand, item, category..."
              placeholderTextColor={MyntraColors.textMuted}
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoFocus
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Ionicons name="close-circle" size={16} color={MyntraColors.textMuted} />
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}

      {/* 3. Wishlist Collections Bar */}
      <View style={styles.collectionsBar}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.collectionsScroll}>
          {(['All', 'Everyday Fashion', 'Party Wear', 'Footwear', 'Gift Ideas'] as WishlistCollectionType[]).map(
            (col) => {
              const isActive = selectedCollection === col;
              const count =
                col === 'All'
                  ? wishlistProducts.length
                  : wishlistProducts.filter((p) => getProductCollection(p) === col).length;

              return (
                <TouchableOpacity
                  key={col}
                  style={[styles.collectionChip, isActive && styles.collectionChipActive]}
                  onPress={() => setSelectedCollection(col)}
                  activeOpacity={0.8}>
                  <Text
                    style={[
                      styles.collectionChipText,
                      isActive && styles.collectionChipTextActive,
                    ]}>
                    {col} ({count})
                  </Text>
                </TouchableOpacity>
              );
            }
          )}
        </ScrollView>
      </View>

      {/* 4. Sort & Filter Action Bar */}
      <View style={styles.controlsBar}>
        <TouchableOpacity
          style={styles.controlBtn}
          onPress={() => setIsSortModalVisible(true)}
          activeOpacity={0.75}>
          <Ionicons name="swap-vertical" size={15} color={MyntraColors.text} />
          <Text style={styles.controlBtnText} numberOfLines={1}>
            SORT: {getSortLabel()}
          </Text>
          <Ionicons name="chevron-down" size={14} color={MyntraColors.textSecondary} />
        </TouchableOpacity>

        <View style={styles.controlDivider} />

        <TouchableOpacity
          style={styles.controlBtn}
          onPress={() => setIsFilterModalVisible(true)}
          activeOpacity={0.75}>
          <Ionicons name="filter-outline" size={15} color={MyntraColors.text} />
          <Text style={styles.controlBtnText}>
            FILTER {activeFiltersCount > 0 ? `(${activeFiltersCount})` : ''}
          </Text>
          {activeFiltersCount > 0 && <View style={styles.filterDot} />}
        </TouchableOpacity>
      </View>

      {/* 5. Active Filter Chips */}
      {activeFiltersCount > 0 && (
        <View style={styles.activeFiltersBar}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.activeFiltersScroll}>
            {selectedBrand && (
              <TouchableOpacity
                style={styles.activeFilterChip}
                onPress={() => setSelectedBrand(null)}>
                <Text style={styles.activeFilterText}>Brand: {selectedBrand}</Text>
                <Ionicons name="close" size={12} color={MyntraColors.primary} />
              </TouchableOpacity>
            )}
            {selectedCategory && (
              <TouchableOpacity
                style={styles.activeFilterChip}
                onPress={() => setSelectedCategory(null)}>
                <Text style={styles.activeFilterText}>Category: {selectedCategory}</Text>
                <Ionicons name="close" size={12} color={MyntraColors.primary} />
              </TouchableOpacity>
            )}
            {selectedPriceBracket && (
              <TouchableOpacity
                style={styles.activeFilterChip}
                onPress={() => setSelectedPriceBracket(null)}>
                <Text style={styles.activeFilterText}>
                  Price:{' '}
                  {selectedPriceBracket === 'under_1000'
                    ? '< ₹1000'
                    : selectedPriceBracket === '1000_1999'
                    ? '₹1000 - ₹1999'
                    : '₹2000+'}
                </Text>
                <Ionicons name="close" size={12} color={MyntraColors.primary} />
              </TouchableOpacity>
            )}
            {inStockOnly && (
              <TouchableOpacity
                style={styles.activeFilterChip}
                onPress={() => setInStockOnly(false)}>
                <Text style={styles.activeFilterText}>In Stock</Text>
                <Ionicons name="close" size={12} color={MyntraColors.primary} />
              </TouchableOpacity>
            )}
            <TouchableOpacity onPress={clearAllFilters} style={styles.clearAllFiltersBtn}>
              <Text style={styles.clearAllFiltersText}>CLEAR ALL</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      )}

      {/* 6. Wishlist Items 2-Column Grid */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>
        {filteredProducts.length === 0 ? (
          <View style={styles.noMatchContainer}>
            <Ionicons name="search-outline" size={40} color={MyntraColors.textMuted} />
            <Text style={styles.noMatchTitle}>NO SAVED ITEMS MATCH</Text>
            <Text style={styles.noMatchSubtitle}>
              Try clearing your search query or selected filters to see your saved items.
            </Text>
            <TouchableOpacity
              style={styles.resetFiltersBtn}
              onPress={clearAllFilters}
              activeOpacity={0.8}>
              <Text style={styles.resetFiltersBtnText}>RESET FILTERS</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.grid}>
            {filteredProducts.map((product) => {
              const hasDiscount = product.originalPrice > product.price;

              return (
                <View key={product.id} style={[styles.itemCard, { width: cardWidth }]}>
                  {/* Image & Quick Removal Button */}
                  <TouchableOpacity
                    activeOpacity={0.92}
                    onPress={() => onPressProduct(product)}
                    style={styles.imageContainer}>
                    <Image
                      source={{ uri: product.image }}
                      style={styles.image}
                      resizeMode="cover"
                    />

                    {/* Stock Alert Badge */}
                    {product.inStock === false ? (
                      <View style={styles.outOfStockBadge}>
                        <Text style={styles.outOfStockText}>OUT OF STOCK</Text>
                      </View>
                    ) : product.stockCount && product.stockCount < 5 ? (
                      <View style={styles.lowStockBadge}>
                        <Text style={styles.lowStockText}>ONLY {product.stockCount} LEFT</Text>
                      </View>
                    ) : null}

                    {/* Remove Cross Button */}
                    <TouchableOpacity
                      onPress={() => onRemoveFromWishlist(product)}
                      style={styles.removeButton}
                      activeOpacity={0.8}
                      accessibilityLabel="Remove from wishlist">
                      <Ionicons name="close" size={16} color={MyntraColors.text} />
                    </TouchableOpacity>

                    {/* Rating Pill Overlay */}
                    <View style={styles.ratingBadge}>
                      <Text style={styles.ratingText}>{product.rating.toFixed(1)}</Text>
                      <Ionicons name="star" size={9} color={MyntraColors.ratingGreen} />
                      <Text style={styles.ratingDivider}>|</Text>
                      <Text style={styles.ratingCountText}>{product.ratingCount}</Text>
                    </View>
                  </TouchableOpacity>

                  {/* Product Details Section */}
                  <TouchableOpacity
                    activeOpacity={0.9}
                    onPress={() => onPressProduct(product)}
                    style={styles.details}>
                    <View style={styles.brandRow}>
                      <Text style={styles.brand} numberOfLines={1}>
                        {product.brand}
                      </Text>
                      <TouchableOpacity
                        onPress={() => setMenuProduct(product)}
                        style={styles.menuDotsBtn}
                        activeOpacity={0.7}>
                        <Ionicons
                          name="ellipsis-vertical"
                          size={15}
                          color={MyntraColors.textSecondary}
                        />
                      </TouchableOpacity>
                    </View>

                    <Text style={styles.name} numberOfLines={1}>
                      {product.name}
                    </Text>

                    {/* Price Row: Selling, MRP, Discount */}
                    <View style={styles.priceRow}>
                      <Text style={styles.price}>₹{product.price}</Text>
                      {hasDiscount && (
                        <Text style={styles.originalPrice}>₹{product.originalPrice}</Text>
                      )}
                      {product.discountPercent > 0 && (
                        <Text style={styles.discountBadge}>
                          ({product.discountPercent}% OFF)
                        </Text>
                      )}
                    </View>

                    {/* Available Sizes / Collection Tag */}
                    <View style={styles.sizeIndicatorRow}>
                      <Text style={styles.sizeIndicatorText} numberOfLines={1}>
                        {product.sizes.length > 0
                          ? `Sizes: ${product.sizes.join(', ')}`
                          : 'One Size'}
                      </Text>
                    </View>
                  </TouchableOpacity>

                  {/* Move to Bag Action CTA */}
                  <TouchableOpacity
                    onPress={() => handleInitiateMoveToBag(product)}
                    style={styles.moveToBagBtn}
                    activeOpacity={0.85}>
                    <Ionicons name="bag-handle-outline" size={14} color={MyntraColors.primary} />
                    <Text style={styles.moveToBagText}>MOVE TO BAG</Text>
                  </TouchableOpacity>
                </View>
              );
            })}
          </View>
        )}

        {/* 7. Catalog Recommendations at bottom of saved items */}
        {recommendedProducts.length > 0 && (
          <View style={styles.bottomRecSection}>
            <View style={styles.recHeaderRow}>
              <View>
                <Text style={styles.recSectionTitle}>YOU MAY ALSO LIKE</Text>
                <Text style={styles.recSectionSubtitle}>Handpicked styles matching your tastes</Text>
              </View>
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.bottomRecScroll}>
              {recommendedProducts.map((p) => (
                <TouchableOpacity
                  key={`bottom-rec-${p.id}`}
                  style={styles.recCard}
                  onPress={() => onPressProduct(p)}
                  activeOpacity={0.9}>
                  <View style={styles.recImageWrapper}>
                    <Image source={{ uri: p.image }} style={styles.recImage} />
                    <TouchableOpacity
                      style={styles.recHeartBtn}
                      onPress={() => onRemoveFromWishlist(p)}>
                      <Ionicons name="heart-outline" size={16} color={MyntraColors.primary} />
                    </TouchableOpacity>
                  </View>
                  <View style={styles.recInfo}>
                    <Text style={styles.recBrand} numberOfLines={1}>
                      {p.brand}
                    </Text>
                    <Text style={styles.recName} numberOfLines={1}>
                      {p.name}
                    </Text>
                    <Text style={styles.recPrice}>₹{p.price}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}
      </ScrollView>

      {/* 8. Quick Size Selector Modal ("Select Size to Move to Bag") */}
      {sizeModalProduct && (
        <Modal
          visible={sizeModalProduct !== null}
          transparent
          animationType="slide"
          onRequestClose={() => setSizeModalProduct(null)}>
          <View style={styles.modalOverlay}>
            <View style={styles.sizeSheetCard}>
              {/* Sheet Header */}
              <View style={styles.sizeSheetHeader}>
                <View style={styles.sizeSheetProductRow}>
                  <Image
                    source={{ uri: sizeModalProduct.image }}
                    style={styles.sizeSheetThumb}
                  />
                  <View style={styles.sizeSheetDetails}>
                    <Text style={styles.sizeSheetBrand}>{sizeModalProduct.brand}</Text>
                    <Text style={styles.sizeSheetName} numberOfLines={1}>
                      {sizeModalProduct.name}
                    </Text>
                    <View style={styles.sizeSheetPriceRow}>
                      <Text style={styles.sizeSheetPrice}>₹{sizeModalProduct.price}</Text>
                      {sizeModalProduct.originalPrice > sizeModalProduct.price && (
                        <Text style={styles.sizeSheetOrigPrice}>
                          ₹{sizeModalProduct.originalPrice}
                        </Text>
                      )}
                      <Text style={styles.sizeSheetDiscount}>
                        ({sizeModalProduct.discountPercent}% OFF)
                      </Text>
                    </View>
                  </View>
                </View>
                <TouchableOpacity
                  onPress={() => setSizeModalProduct(null)}
                  style={styles.sizeSheetCloseBtn}>
                  <Ionicons name="close" size={22} color={MyntraColors.text} />
                </TouchableOpacity>
              </View>

              {/* Size Selection Grid */}
              <View style={styles.sizeSection}>
                <View style={styles.sizeTitleRow}>
                  <Text style={styles.sizeSectionTitle}>SELECT SIZE</Text>
                  <Text style={styles.sizeFitGuide}>Standard Indian Fit</Text>
                </View>

                {sizeError && (
                  <Text style={styles.sizeErrorAlert}>
                    Please select a size to proceed to bag
                  </Text>
                )}

                <View style={styles.sizePillsGrid}>
                  {sizeModalProduct.sizes.map((sz) => {
                    const isSelected = selectedSize === sz;
                    return (
                      <TouchableOpacity
                        key={sz}
                        style={[
                          styles.sizePill,
                          isSelected && styles.sizePillSelected,
                        ]}
                        onPress={() => {
                          setSelectedSize(sz);
                          setSizeError(false);
                        }}
                        activeOpacity={0.8}>
                        <Text
                          style={[
                            styles.sizePillText,
                            isSelected && styles.sizePillTextSelected,
                          ]}>
                          {sz}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* Color selection if product has multiple colors */}
              {sizeModalProduct.colors.length > 1 && (
                <View style={styles.colorSection}>
                  <Text style={styles.sizeSectionTitle}>SELECT COLOR</Text>
                  <View style={styles.colorPillsRow}>
                    {sizeModalProduct.colors.map((c) => (
                      <TouchableOpacity
                        key={c}
                        style={[
                          styles.colorPill,
                          selectedColor === c && styles.colorPillSelected,
                        ]}
                        onPress={() => setSelectedColor(c)}>
                        <Text
                          style={[
                            styles.colorPillText,
                            selectedColor === c && styles.colorPillTextSelected,
                          ]}>
                          {c}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              )}

              {/* Action Button: Confirm & Move to Bag */}
              <TouchableOpacity
                style={styles.confirmBagBtn}
                onPress={handleConfirmMoveToBag}
                disabled={isMovingToBag}
                activeOpacity={0.85}>
                {isMovingToBag ? (
                  <ActivityIndicator color={MyntraColors.white} size="small" />
                ) : (
                  <>
                    <Ionicons name="bag-handle" size={18} color={MyntraColors.white} />
                    <Text style={styles.confirmBagBtnText}>CONFIRM & MOVE TO BAG</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}

      {/* 9. More Options Bottom Sheet Menu */}
      {menuProduct && (
        <Modal
          visible={menuProduct !== null}
          transparent
          animationType="fade"
          onRequestClose={() => setMenuProduct(null)}>
          <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => setMenuProduct(null)}>
            <View style={styles.menuSheetCard}>
              <View style={styles.menuSheetHeader}>
                <Text style={styles.menuSheetTitle}>Options for {menuProduct.brand}</Text>
                <TouchableOpacity onPress={() => setMenuProduct(null)}>
                  <Ionicons name="close" size={20} color={MyntraColors.text} />
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => {
                  const p = menuProduct;
                  setMenuProduct(null);
                  handleInitiateMoveToBag(p);
                }}>
                <Ionicons name="bag-add-outline" size={20} color={MyntraColors.primary} />
                <Text style={styles.menuItemText}>Move to Bag</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => {
                  const p = menuProduct;
                  setMenuProduct(null);
                  onPressProduct(p);
                }}>
                <Ionicons name="eye-outline" size={20} color={MyntraColors.text} />
                <Text style={styles.menuItemText}>View Product Details</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => {
                  handleShareProduct(menuProduct);
                  setMenuProduct(null);
                }}>
                <Ionicons name="share-outline" size={20} color={MyntraColors.text} />
                <Text style={styles.menuItemText}>Share Product</Text>
              </TouchableOpacity>

              {/* Assign Collection Sub-group */}
              <View style={styles.menuCollectionHeader}>
                <Text style={styles.menuCollectionTitle}>ASSIGN TO COLLECTION</Text>
              </View>
              {(['Everyday Fashion', 'Party Wear', 'Footwear', 'Gift Ideas'] as WishlistCollectionType[]).map(
                (col) => {
                  const isCurrent = getProductCollection(menuProduct) === col;
                  return (
                    <TouchableOpacity
                      key={col}
                      style={styles.menuItem}
                      onPress={() => handleAssignCollection(menuProduct, col)}>
                      <Ionicons
                        name={isCurrent ? 'radio-button-on' : 'radio-button-off'}
                        size={18}
                        color={isCurrent ? MyntraColors.primary : MyntraColors.textMuted}
                      />
                      <Text style={[styles.menuItemText, isCurrent && { fontWeight: '700' }]}>
                        {col}
                      </Text>
                    </TouchableOpacity>
                  );
                }
              )}

              <TouchableOpacity
                style={[styles.menuItem, { borderTopWidth: 1, borderTopColor: MyntraColors.divider }]}
                onPress={() => {
                  const p = menuProduct;
                  setMenuProduct(null);
                  onRemoveFromWishlist(p);
                }}>
                <Ionicons name="trash-outline" size={20} color="#e53935" />
                <Text style={[styles.menuItemText, { color: '#e53935' }]}>
                  Remove from Wishlist
                </Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </Modal>
      )}

      {/* 10. Sort Bottom Sheet Modal */}
      <Modal
        visible={isSortModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setIsSortModalVisible(false)}>
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setIsSortModalVisible(false)}>
          <View style={styles.sheetCard}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>SORT WISHLIST BY</Text>
              <TouchableOpacity onPress={() => setIsSortModalVisible(false)}>
                <Ionicons name="close" size={20} color={MyntraColors.text} />
              </TouchableOpacity>
            </View>

            {[
              { id: 'recent', label: 'Recently Added' },
              { id: 'price_low_high', label: 'Price: Low to High' },
              { id: 'price_high_low', label: 'Price: High to Low' },
              { id: 'discount', label: 'Better Discount' },
              { id: 'rating', label: 'Customer Rating' },
            ].map((option) => {
              const isSelected = sortBy === option.id;
              return (
                <TouchableOpacity
                  key={option.id}
                  style={styles.sortOptionRow}
                  onPress={() => {
                    setSortBy(option.id as WishlistSortOption);
                    setIsSortModalVisible(false);
                  }}>
                  <Text
                    style={[
                      styles.sortOptionText,
                      isSelected && styles.sortOptionTextActive,
                    ]}>
                    {option.label}
                  </Text>
                  <Ionicons
                    name={isSelected ? 'radio-button-on' : 'radio-button-off'}
                    size={20}
                    color={isSelected ? MyntraColors.primary : MyntraColors.textMuted}
                  />
                </TouchableOpacity>
              );
            })}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* 11. Filter Modal */}
      <Modal
        visible={isFilterModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setIsFilterModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.filterSheetCard}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>FILTER SAVED ITEMS</Text>
              <TouchableOpacity onPress={() => setIsFilterModalVisible(false)}>
                <Ionicons name="close" size={20} color={MyntraColors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.filterScroll} showsVerticalScrollIndicator={false}>
              {/* Filter By Brand */}
              <View style={styles.filterBlock}>
                <Text style={styles.filterBlockTitle}>BRANDS</Text>
                <View style={styles.filterPillsWrap}>
                  {availableBrands.map((brand) => {
                    const isSelected = selectedBrand === brand;
                    return (
                      <TouchableOpacity
                        key={brand}
                        style={[styles.filterPill, isSelected && styles.filterPillActive]}
                        onPress={() => setSelectedBrand(isSelected ? null : brand)}>
                        <Text
                          style={[
                            styles.filterPillText,
                            isSelected && styles.filterPillTextActive,
                          ]}>
                          {brand}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* Filter By Category */}
              <View style={styles.filterBlock}>
                <Text style={styles.filterBlockTitle}>CATEGORIES</Text>
                <View style={styles.filterPillsWrap}>
                  {availableCategories.map((cat) => {
                    const isSelected = selectedCategory === cat;
                    return (
                      <TouchableOpacity
                        key={cat}
                        style={[styles.filterPill, isSelected && styles.filterPillActive]}
                        onPress={() => setSelectedCategory(isSelected ? null : cat)}>
                        <Text
                          style={[
                            styles.filterPillText,
                            isSelected && styles.filterPillTextActive,
                          ]}>
                          {cat}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* Filter By Price */}
              <View style={styles.filterBlock}>
                <Text style={styles.filterBlockTitle}>PRICE RANGE</Text>
                <View style={styles.filterPillsWrap}>
                  {[
                    { id: 'under_1000', label: 'Under ₹1,000' },
                    { id: '1000_1999', label: '₹1,000 - ₹1,999' },
                    { id: '2000_plus', label: '₹2,000 & Above' },
                  ].map((bracket) => {
                    const isSelected = selectedPriceBracket === bracket.id;
                    return (
                      <TouchableOpacity
                        key={bracket.id}
                        style={[styles.filterPill, isSelected && styles.filterPillActive]}
                        onPress={() =>
                          setSelectedPriceBracket(isSelected ? null : bracket.id)
                        }>
                        <Text
                          style={[
                            styles.filterPillText,
                            isSelected && styles.filterPillTextActive,
                          ]}>
                          {bracket.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* Filter By Stock Availability */}
              <View style={styles.filterBlock}>
                <Text style={styles.filterBlockTitle}>AVAILABILITY</Text>
                <TouchableOpacity
                  style={[styles.filterPill, inStockOnly && styles.filterPillActive]}
                  onPress={() => setInStockOnly(!inStockOnly)}>
                  <Text
                    style={[
                      styles.filterPillText,
                      inStockOnly && styles.filterPillTextActive,
                    ]}>
                    In Stock Only
                  </Text>
                </TouchableOpacity>
              </View>
            </ScrollView>

            {/* Filter Actions Footer */}
            <View style={styles.filterFooter}>
              <TouchableOpacity
                style={styles.filterClearBtn}
                onPress={clearAllFilters}
                activeOpacity={0.8}>
                <Text style={styles.filterClearBtnText}>CLEAR ALL</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.filterApplyBtn}
                onPress={() => setIsFilterModalVisible(false)}
                activeOpacity={0.85}>
                <Text style={styles.filterApplyBtnText}>APPLY FILTERS</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* 12. Clear All Confirmation Modal */}
      {isClearConfirmVisible && (
        <Modal
          visible={isClearConfirmVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setIsClearConfirmVisible(false)}>
          <View style={styles.modalOverlay}>
            <View style={styles.confirmCard}>
              <View style={styles.confirmIconCircle}>
                <Ionicons name="trash-outline" size={28} color="#e53935" />
              </View>
              <Text style={styles.confirmTitle}>Clear Entire Wishlist?</Text>
              <Text style={styles.confirmSubtitle}>
                Are you sure you want to remove all {wishlistProducts.length} items from your wishlist?
                This action cannot be undone.
              </Text>
              <View style={styles.confirmActionsRow}>
                <TouchableOpacity
                  style={styles.confirmCancelBtn}
                  onPress={() => setIsClearConfirmVisible(false)}
                  activeOpacity={0.8}>
                  <Text style={styles.confirmCancelText}>CANCEL</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.confirmDeleteBtn}
                  onPress={() => {
                    setIsClearConfirmVisible(false);
                    onClearWishlist?.();
                  }}
                  activeOpacity={0.85}>
                  <Text style={styles.confirmDeleteText}>CLEAR ALL</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
};

const createStyles = (colors: any, isDark: boolean) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 110,
  },
  emptyScrollContent: {
    paddingBottom: 80,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: 12,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerBackBtn: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: 0.8,
  },
  headerCount: {
    fontSize: 11,
    color: colors.textSecondary,
    fontWeight: '700',
    marginTop: 1,
    letterSpacing: 0.5,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  headerIconBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
  },
  searchContainer: {
    backgroundColor: colors.surface,
    paddingHorizontal: Spacing.md,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  searchInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: isDark ? colors.surfaceElevated : '#f3f4f6',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: colors.text,
    paddingVertical: 2,
  },
  collectionsBar: {
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  collectionsScroll: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    gap: 8,
  },
  collectionChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: isDark ? colors.surfaceElevated : '#f3f4f6',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  collectionChipActive: {
    backgroundColor: isDark ? colors.surfaceElevated : '#fff0f3',
    borderColor: colors.primary,
  },
  collectionChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  collectionChipTextActive: {
    color: colors.primary,
    fontWeight: '800',
  },
  controlsBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  controlBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 11,
    gap: 6,
  },
  controlDivider: {
    width: 1,
    height: 20,
    backgroundColor: colors.divider,
  },
  controlBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.text,
    letterSpacing: 0.4,
  },
  filterDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.primary,
  },
  activeFiltersBar: {
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  activeFiltersScroll: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 8,
    gap: 8,
    alignItems: 'center',
  },
  activeFilterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  activeFilterText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.primary,
  },
  clearAllFiltersBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  clearAllFiltersText: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.textMuted,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: Spacing.md,
    gap: 10,
    justifyContent: 'space-between',
  },
  itemCard: {
    width: '48.5%',
    backgroundColor: colors.surface,
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.cardBorder,
    marginBottom: 6,
  },
  imageContainer: {
    width: '100%',
    aspectRatio: 3 / 4,
    backgroundColor: colors.surfaceElevated,
    position: 'relative',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  removeButton: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: isDark ? 'rgba(30, 41, 59, 0.95)' : 'rgba(255, 255, 255, 0.95)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
    elevation: 2,
  },
  heartButton: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: isDark ? 'rgba(30, 41, 59, 0.95)' : 'rgba(255, 255, 255, 0.95)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ratingBadge: {
    position: 'absolute',
    bottom: 6,
    left: 6,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: isDark ? 'rgba(30, 41, 59, 0.92)' : 'rgba(255, 255, 255, 0.92)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    gap: 3,
  },
  ratingText: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.text,
  },
  ratingDivider: {
    fontSize: 8,
    color: colors.textMuted,
  },
  ratingCountText: {
    fontSize: 9,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  outOfStockBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 4,
  },
  outOfStockText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  lowStockBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: 'rgba(230, 81, 0, 0.9)',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 4,
  },
  lowStockText: {
    color: '#fff',
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  details: {
    padding: 8,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  brand: {
    flex: 1,
    fontSize: 12,
    fontWeight: '800',
    color: colors.text,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  menuDotsBtn: {
    padding: 2,
  },
  name: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 2,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 5,
    marginTop: 5,
    flexWrap: 'wrap',
  },
  price: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.text,
  },
  originalPrice: {
    fontSize: 10,
    color: colors.textMuted,
    textDecorationLine: 'line-through',
  },
  discountBadge: {
    fontSize: 10,
    fontWeight: '800',
    color: '#e65100',
  },
  sizeIndicatorRow: {
    marginTop: 4,
  },
  sizeIndicatorText: {
    fontSize: 10,
    color: colors.textMuted,
    fontWeight: '500',
  },
  moveToBagBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
    paddingVertical: 10,
    backgroundColor: isDark ? colors.surfaceElevated : '#fff7f9',
  },
  moveToBagText: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.primary,
    letterSpacing: 0.6,
  },
  noMatchContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xxl,
    marginTop: 40,
  },
  noMatchTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.text,
    marginTop: 12,
    letterSpacing: 0.6,
  },
  noMatchSubtitle: {
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 18,
    maxWidth: 280,
  },
  resetFiltersBtn: {
    marginTop: 18,
    backgroundColor: colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  resetFiltersBtnText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '800',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xxl,
    paddingTop: 40,
    backgroundColor: colors.background,
  },
  emptyHeartCircle: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: isDark ? colors.surfaceElevated : '#fff0f3',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.lg,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: 0.8,
  },
  emptySubtitle: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 19,
    maxWidth: 290,
  },
  exploreButton: {
    marginTop: Spacing.xl,
    backgroundColor: colors.primary,
    paddingHorizontal: 28,
    paddingVertical: 13,
    borderRadius: 24,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 3,
  },
  exploreButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  recommendationSection: {
    marginTop: Spacing.lg,
    backgroundColor: colors.surface,
    paddingTop: Spacing.md,
  },
  recHeaderRow: {
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.xs,
  },
  recSectionTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: 0.6,
  },
  recSectionSubtitle: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 2,
  },
  bottomRecSection: {
    marginTop: Spacing.lg,
    backgroundColor: colors.surface,
    paddingVertical: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
  },
  bottomRecScroll: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
    gap: 12,
  },
  recCard: {
    width: 140,
    backgroundColor: colors.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    overflow: 'hidden',
  },
  recImageWrapper: {
    width: '100%',
    height: 160,
    backgroundColor: colors.surfaceElevated,
    position: 'relative',
  },
  recImage: {
    width: '100%',
    height: '100%',
  },
  recHeartBtn: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: isDark ? 'rgba(30, 41, 59, 0.95)' : 'rgba(255,255,255,0.95)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  recInfo: {
    padding: 8,
  },
  recBrand: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.text,
  },
  recName: {
    fontSize: 10,
    color: colors.textSecondary,
    marginTop: 1,
  },
  recPrice: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.text,
    marginTop: 3,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'flex-end',
  },
  sizeSheetCard: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    padding: Spacing.lg,
    maxHeight: '85%',
  },
  sizeSheetHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingBottom: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  sizeSheetProductRow: {
    flexDirection: 'row',
    gap: 12,
    flex: 1,
  },
  sizeSheetThumb: {
    width: 60,
    height: 80,
    borderRadius: 6,
    backgroundColor: colors.surfaceElevated,
  },
  sizeSheetDetails: {
    flex: 1,
    justifyContent: 'center',
  },
  sizeSheetBrand: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.text,
    textTransform: 'uppercase',
  },
  sizeSheetName: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  sizeSheetPriceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
    marginTop: 4,
  },
  sizeSheetPrice: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.text,
  },
  sizeSheetOrigPrice: {
    fontSize: 11,
    color: colors.textMuted,
    textDecorationLine: 'line-through',
  },
  sizeSheetDiscount: {
    fontSize: 11,
    fontWeight: '800',
    color: '#e65100',
  },
  sizeSheetCloseBtn: {
    padding: 4,
  },
  sizeSection: {
    paddingVertical: Spacing.md,
  },
  sizeTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  sizeSectionTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: 0.6,
  },
  sizeFitGuide: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.primary,
  },
  sizeErrorAlert: {
    fontSize: 11,
    color: '#e53935',
    fontWeight: '600',
    marginBottom: 8,
  },
  sizePillsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  sizePill: {
    minWidth: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    backgroundColor: colors.surface,
  },
  sizePillSelected: {
    borderColor: colors.primary,
    backgroundColor: isDark ? colors.surfaceElevated : '#fff0f3',
  },
  sizePillText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text,
  },
  sizePillTextSelected: {
    color: colors.primary,
    fontWeight: '800',
  },
  colorSection: {
    paddingBottom: Spacing.md,
  },
  colorPillsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  colorPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  colorPillSelected: {
    borderColor: colors.primary,
    backgroundColor: isDark ? colors.surfaceElevated : '#fff0f3',
  },
  colorPillText: {
    fontSize: 11,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  colorPillTextSelected: {
    color: colors.primary,
    fontWeight: '700',
  },
  confirmBagBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.primary,
    paddingVertical: 14,
    borderRadius: 8,
    marginTop: Spacing.sm,
  },
  confirmBagBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: 0.8,
  },
  menuSheetCard: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    padding: Spacing.lg,
  },
  menuSheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  menuSheetTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.text,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 13,
  },
  menuItemText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
  },
  menuCollectionHeader: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
    marginBottom: 4,
  },
  menuCollectionTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.textMuted,
    letterSpacing: 0.6,
  },
  sheetCard: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    padding: Spacing.lg,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  sheetTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: 0.6,
  },
  sortOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  sortOptionText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  sortOptionTextActive: {
    color: colors.primary,
    fontWeight: '800',
  },
  filterSheetCard: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    padding: Spacing.lg,
    maxHeight: '80%',
  },
  filterScroll: {
    paddingVertical: Spacing.md,
  },
  filterBlock: {
    marginBottom: Spacing.lg,
  },
  filterBlockTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.textMuted,
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  filterPillsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  filterPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: isDark ? colors.surfaceElevated : '#f3f4f6',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  filterPillActive: {
    backgroundColor: isDark ? colors.surfaceElevated : '#fff0f3',
    borderColor: colors.primary,
  },
  filterPillText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  filterPillTextActive: {
    color: colors.primary,
    fontWeight: '800',
  },
  filterFooter: {
    flexDirection: 'row',
    gap: 12,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
  },
  filterClearBtn: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  filterClearBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.textMuted,
    letterSpacing: 0.6,
  },
  filterApplyBtn: {
    flex: 2,
    backgroundColor: colors.primary,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 6,
  },
  filterApplyBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: 0.6,
  },
  confirmCard: {
    backgroundColor: colors.surface,
    marginHorizontal: Spacing.lg,
    borderRadius: 16,
    padding: Spacing.xl,
    alignItems: 'center',
    marginBottom: 'auto',
    marginTop: 'auto',
  },
  confirmIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#ffebee',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  confirmTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.text,
  },
  confirmSubtitle: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 18,
  },
  confirmActionsRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: Spacing.lg,
    width: '100%',
  },
  confirmCancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    alignItems: 'center',
  },
  confirmCancelText: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.textSecondary,
  },
  confirmDeleteBtn: {
    flex: 1,
    backgroundColor: '#e53935',
    paddingVertical: 12,
    borderRadius: 6,
    alignItems: 'center',
  },
  confirmDeleteText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#fff',
  },
});
