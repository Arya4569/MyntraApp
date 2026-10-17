import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import {
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { MyntraColors, Spacing } from '@/constants/myntra-theme';
import { FilterState, SortOption } from '@/types/store';

interface FilterModalProps {
  visible: boolean;
  filters: FilterState;
  availableBrands: string[];
  availableCategories: string[];
  availableSizes: string[];
  totalResultsCount: number;
  onClose: () => void;
  onApplyFilters: (updated: FilterState) => void;
  onResetFilters: () => void;
  initialTab?: FilterTab;
}

export type FilterTab = 'sort' | 'category' | 'brand' | 'price' | 'discount' | 'rating' | 'size';

export const FilterModal: React.FC<FilterModalProps> = ({
  visible,
  filters,
  availableBrands,
  availableCategories,
  availableSizes,
  totalResultsCount,
  onClose,
  onApplyFilters,
  onResetFilters,
  initialTab = 'sort',
}) => {
  const [activeTab, setActiveTab] = useState<FilterTab>(initialTab);
  const [draft, setDraft] = useState<FilterState>(filters);

  // Sync draft and tab whenever modal opens
  React.useEffect(() => {
    if (!visible) return;
    const timer = setTimeout(() => {
      setDraft(filters);
      if (initialTab) {
        setActiveTab(initialTab);
      }
    }, 0);
    return () => clearTimeout(timer);
  }, [visible, filters, initialTab]);

  const toggleBrand = (brand: string) => {
    const exists = draft.brands.includes(brand);
    setDraft({
      ...draft,
      brands: exists
        ? draft.brands.filter((b) => b !== brand)
        : [...draft.brands, brand],
    });
  };

  const toggleSize = (size: string) => {
    const exists = draft.sizes.includes(size);
    setDraft({
      ...draft,
      sizes: exists
        ? draft.sizes.filter((s) => s !== size)
        : [...draft.sizes, size],
    });
  };

  const setPriceRange = (range?: [number, number]) => {
    setDraft({ ...draft, priceRange: range });
  };

  const setMinDiscount = (disc?: number) => {
    setDraft({ ...draft, minDiscount: disc });
  };

  const setMinRating = (rating?: number) => {
    setDraft({ ...draft, minRating: rating });
  };

  const setSortBy = (sort: SortOption) => {
    setDraft({ ...draft, sortBy: sort });
  };

  const setCategory = (cat?: string) => {
    setDraft({ ...draft, category: cat });
  };

  const handleApply = () => {
    onApplyFilters(draft);
    onClose();
  };

  const handleClear = () => {
    onResetFilters();
    onClose();
  };

  const sortOptions: { label: string; value: SortOption }[] = [
    { label: 'Recommended', value: 'recommended' },
    { label: 'Price: Low to High', value: 'price_low_high' },
    { label: 'Price: High to Low', value: 'price_high_low' },
    { label: 'Customer Rating', value: 'rating' },
    { label: 'Newest Arrivals', value: 'newest' },
  ];

  const priceRanges: { label: string; value?: [number, number] }[] = [
    { label: 'All Prices', value: undefined },
    { label: 'Under ₹999', value: [0, 999] },
    { label: '₹1,000 to ₹1,999', value: [1000, 1999] },
    { label: '₹2,000 to ₹3,999', value: [2000, 3999] },
    { label: '₹4,000 and Above', value: [4000, 50000] },
  ];

  const discountTiers: { label: string; value?: number }[] = [
    { label: 'All Discounts', value: undefined },
    { label: '30% and Above', value: 30 },
    { label: '50% and Above', value: 50 },
    { label: '60% and Above', value: 60 },
    { label: '70% and Above', value: 70 },
  ];

  const ratingTiers: { label: string; value?: number }[] = [
    { label: 'All Ratings', value: undefined },
    { label: '4.5 ★ & Above', value: 4.5 },
    { label: '4.0 ★ & Above', value: 4.0 },
    { label: '3.5 ★ & Above', value: 3.5 },
  ];

  // Count active filter chips
  const activeFilterCount =
    (draft.category && draft.category !== 'all' ? 1 : 0) +
    draft.brands.length +
    (draft.priceRange ? 1 : 0) +
    (draft.minDiscount ? 1 : 0) +
    (draft.minRating ? 1 : 0) +
    draft.sizes.length;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={styles.title}>SORT & FILTER</Text>
              <Text style={styles.subtitle}>
                {totalResultsCount} products found
                {activeFilterCount > 0 ? ` • ${activeFilterCount} applied` : ''}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.7}>
              <Ionicons name="close" size={22} color={MyntraColors.text} />
            </TouchableOpacity>
          </View>

          {/* Main 2-Column Split: Tabs on Left, Values on Right */}
          <View style={styles.contentRow}>
            {/* Left Rail: Filter Tabs */}
            <View style={styles.leftRail}>
              <TouchableOpacity
                onPress={() => setActiveTab('sort')}
                style={[styles.tabItem, activeTab === 'sort' && styles.tabItemActive]}>
                <Text style={[styles.tabLabel, activeTab === 'sort' && styles.tabLabelActive]}>
                  Sort By
                </Text>
                <Text style={styles.tabIndicator}>
                  {sortOptions.find((s) => s.value === draft.sortBy)?.label}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setActiveTab('category')}
                style={[styles.tabItem, activeTab === 'category' && styles.tabItemActive]}>
                <Text style={[styles.tabLabel, activeTab === 'category' && styles.tabLabelActive]}>
                  Category
                </Text>
                {draft.category && draft.category !== 'all' && (
                  <View style={styles.dotBadge} />
                )}
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setActiveTab('brand')}
                style={[styles.tabItem, activeTab === 'brand' && styles.tabItemActive]}>
                <Text style={[styles.tabLabel, activeTab === 'brand' && styles.tabLabelActive]}>
                  Brand
                </Text>
                {draft.brands.length > 0 && (
                  <Text style={styles.tabBadge}>{draft.brands.length}</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setActiveTab('price')}
                style={[styles.tabItem, activeTab === 'price' && styles.tabItemActive]}>
                <Text style={[styles.tabLabel, activeTab === 'price' && styles.tabLabelActive]}>
                  Price
                </Text>
                {draft.priceRange && <View style={styles.dotBadge} />}
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setActiveTab('discount')}
                style={[styles.tabItem, activeTab === 'discount' && styles.tabItemActive]}>
                <Text style={[styles.tabLabel, activeTab === 'discount' && styles.tabLabelActive]}>
                  Discount
                </Text>
                {draft.minDiscount && <View style={styles.dotBadge} />}
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setActiveTab('rating')}
                style={[styles.tabItem, activeTab === 'rating' && styles.tabItemActive]}>
                <Text style={[styles.tabLabel, activeTab === 'rating' && styles.tabLabelActive]}>
                  Rating
                </Text>
                {draft.minRating && <View style={styles.dotBadge} />}
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setActiveTab('size')}
                style={[styles.tabItem, activeTab === 'size' && styles.tabItemActive]}>
                <Text style={[styles.tabLabel, activeTab === 'size' && styles.tabLabelActive]}>
                  Size
                </Text>
                {draft.sizes.length > 0 && (
                  <Text style={styles.tabBadge}>{draft.sizes.length}</Text>
                )}
              </TouchableOpacity>
            </View>

            {/* Right Panel: Values */}
            <ScrollView
              style={styles.rightContent}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.rightScroll}>
              {/* SORT BY */}
              {activeTab === 'sort' && (
                <View>
                  {sortOptions.map((opt) => {
                    const isSelected = draft.sortBy === opt.value;
                    return (
                      <TouchableOpacity
                        key={opt.value}
                        onPress={() => setSortBy(opt.value)}
                        style={styles.optionRow}
                        activeOpacity={0.7}>
                        <View style={[styles.radioOuter, isSelected && styles.radioOuterSelected]}>
                          {isSelected && <View style={styles.radioInner} />}
                        </View>
                        <Text style={[styles.optionLabel, isSelected && styles.optionLabelBold]}>
                          {opt.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}

              {/* CATEGORY */}
              {activeTab === 'category' && (
                <View>
                  <TouchableOpacity
                    onPress={() => setCategory('all')}
                    style={styles.optionRow}
                    activeOpacity={0.7}>
                    <View
                      style={[
                        styles.radioOuter,
                        (!draft.category || draft.category === 'all') &&
                          styles.radioOuterSelected,
                      ]}>
                      {(!draft.category || draft.category === 'all') && (
                        <View style={styles.radioInner} />
                      )}
                    </View>
                    <Text
                      style={[
                        styles.optionLabel,
                        (!draft.category || draft.category === 'all') &&
                          styles.optionLabelBold,
                      ]}>
                      All Categories
                    </Text>
                  </TouchableOpacity>
                  {availableCategories.map((cat) => {
                    const isSelected = draft.category?.toLowerCase() === cat.toLowerCase();
                    return (
                      <TouchableOpacity
                        key={cat}
                        onPress={() => setCategory(cat)}
                        style={styles.optionRow}
                        activeOpacity={0.7}>
                        <View style={[styles.radioOuter, isSelected && styles.radioOuterSelected]}>
                          {isSelected && <View style={styles.radioInner} />}
                        </View>
                        <Text style={[styles.optionLabel, isSelected && styles.optionLabelBold]}>
                          {cat}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}

              {/* BRAND */}
              {activeTab === 'brand' && (
                <View>
                  {availableBrands.map((brand) => {
                    const isChecked = draft.brands.includes(brand);
                    return (
                      <TouchableOpacity
                        key={brand}
                        onPress={() => toggleBrand(brand)}
                        style={styles.optionRow}
                        activeOpacity={0.7}>
                        <View style={[styles.checkbox, isChecked && styles.checkboxChecked]}>
                          {isChecked && <Ionicons name="checkmark" size={14} color="#fff" />}
                        </View>
                        <Text style={[styles.optionLabel, isChecked && styles.optionLabelBold]}>
                          {brand}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}

              {/* PRICE */}
              {activeTab === 'price' && (
                <View>
                  {priceRanges.map((pr, index) => {
                    const isSelected =
                      (!draft.priceRange && !pr.value) ||
                      (draft.priceRange &&
                        pr.value &&
                        draft.priceRange[0] === pr.value[0] &&
                        draft.priceRange[1] === pr.value[1]);
                    return (
                      <TouchableOpacity
                        key={index}
                        onPress={() => setPriceRange(pr.value)}
                        style={styles.optionRow}
                        activeOpacity={0.7}>
                        <View style={[styles.radioOuter, isSelected && styles.radioOuterSelected]}>
                          {isSelected && <View style={styles.radioInner} />}
                        </View>
                        <Text style={[styles.optionLabel, isSelected && styles.optionLabelBold]}>
                          {pr.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}

              {/* DISCOUNT */}
              {activeTab === 'discount' && (
                <View>
                  {discountTiers.map((dt, index) => {
                    const isSelected = draft.minDiscount === dt.value;
                    return (
                      <TouchableOpacity
                        key={index}
                        onPress={() => setMinDiscount(dt.value)}
                        style={styles.optionRow}
                        activeOpacity={0.7}>
                        <View style={[styles.radioOuter, isSelected && styles.radioOuterSelected]}>
                          {isSelected && <View style={styles.radioInner} />}
                        </View>
                        <Text style={[styles.optionLabel, isSelected && styles.optionLabelBold]}>
                          {dt.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}

              {/* RATING */}
              {activeTab === 'rating' && (
                <View>
                  {ratingTiers.map((rt, index) => {
                    const isSelected = draft.minRating === rt.value;
                    return (
                      <TouchableOpacity
                        key={index}
                        onPress={() => setMinRating(rt.value)}
                        style={styles.optionRow}
                        activeOpacity={0.7}>
                        <View style={[styles.radioOuter, isSelected && styles.radioOuterSelected]}>
                          {isSelected && <View style={styles.radioInner} />}
                        </View>
                        <Text style={[styles.optionLabel, isSelected && styles.optionLabelBold]}>
                          {rt.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}

              {/* SIZES */}
              {activeTab === 'size' && (
                <View style={styles.sizesGrid}>
                  {availableSizes.map((sz) => {
                    const isSelected = draft.sizes.includes(sz);
                    return (
                      <TouchableOpacity
                        key={sz}
                        onPress={() => toggleSize(sz)}
                        style={[styles.sizePill, isSelected && styles.sizePillSelected]}
                        activeOpacity={0.8}>
                        <Text
                          style={[styles.sizePillText, isSelected && styles.sizePillTextSelected]}>
                          {sz}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
            </ScrollView>
          </View>

          {/* Sticky Footer: Reset & Apply Buttons */}
          <View style={styles.footer}>
            <TouchableOpacity
              onPress={handleClear}
              style={styles.clearBtn}
              activeOpacity={0.8}>
              <Text style={styles.clearBtnText}>CLEAR ALL</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleApply}
              style={styles.applyBtn}
              activeOpacity={0.85}>
              <Text style={styles.applyBtnText}>
                APPLY FILTERS {activeFilterCount > 0 ? `(${activeFilterCount})` : ''}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  container: {
    width: '100%',
    maxWidth: Platform.OS === 'web' ? 480 : undefined,
    height: '84%',
    backgroundColor: MyntraColors.white,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#ebebec',
  },
  title: {
    fontSize: 14,
    fontWeight: '800',
    color: MyntraColors.text,
    letterSpacing: 0.8,
  },
  subtitle: {
    fontSize: 11,
    color: MyntraColors.textSecondary,
    marginTop: 2,
  },
  closeBtn: {
    padding: 4,
  },
  contentRow: {
    flex: 1,
    flexDirection: 'row',
  },
  leftRail: {
    width: 125,
    backgroundColor: '#f7f7f9',
    borderRightWidth: 1,
    borderRightColor: '#ebebec',
  },
  tabItem: {
    paddingVertical: 15,
    paddingHorizontal: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: '#e9e9ee',
    position: 'relative',
  },
  tabItemActive: {
    backgroundColor: MyntraColors.white,
    borderLeftWidth: 3.5,
    borderLeftColor: MyntraColors.primary,
  },
  tabLabel: {
    fontSize: 12.5,
    fontWeight: '600',
    color: MyntraColors.textSecondary,
  },
  tabLabelActive: {
    color: MyntraColors.primary,
    fontWeight: '800',
  },
  tabIndicator: {
    fontSize: 10,
    color: MyntraColors.textMuted,
    marginTop: 2,
  },
  tabBadge: {
    position: 'absolute',
    right: 8,
    top: 14,
    backgroundColor: MyntraColors.primary,
    color: '#fff',
    fontSize: 9,
    fontWeight: '800',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 8,
  },
  dotBadge: {
    position: 'absolute',
    right: 10,
    top: 20,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: MyntraColors.primary,
  },
  rightContent: {
    flex: 1,
    backgroundColor: MyntraColors.white,
  },
  rightScroll: {
    padding: Spacing.lg,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f3f5',
    gap: 12,
  },
  radioOuter: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.5,
    borderColor: '#c0c2cc',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioOuterSelected: {
    borderColor: MyntraColors.primary,
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: MyntraColors.primary,
  },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: '#c0c2cc',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: MyntraColors.primary,
    borderColor: MyntraColors.primary,
  },
  optionLabel: {
    fontSize: 13,
    color: MyntraColors.text,
  },
  optionLabelBold: {
    fontWeight: '700',
    color: MyntraColors.primary,
  },
  sizesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  sizePill: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#d5d6dd',
    backgroundColor: '#fff',
  },
  sizePillSelected: {
    borderColor: MyntraColors.primary,
    backgroundColor: '#fff1f4',
  },
  sizePillText: {
    fontSize: 12,
    fontWeight: '600',
    color: MyntraColors.text,
  },
  sizePillTextSelected: {
    color: MyntraColors.primary,
    fontWeight: '800',
  },
  footer: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: '#ebebec',
    paddingHorizontal: Spacing.lg,
    paddingVertical: 12,
    gap: 12,
    backgroundColor: MyntraColors.white,
  },
  clearBtn: {
    flex: 1,
    height: 46,
    borderWidth: 1,
    borderColor: '#d2d3da',
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clearBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: MyntraColors.textSecondary,
    letterSpacing: 0.5,
  },
  applyBtn: {
    flex: 2,
    height: 46,
    backgroundColor: MyntraColors.primary,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: MyntraColors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  applyBtnText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
});
