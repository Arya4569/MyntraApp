import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import {
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { MyntraColors, Spacing } from '@/constants/myntra-theme';
import { Product, PRODUCTS } from '@/data/mock-data';
import { storeService } from '@/services/store-service';

interface SearchModalProps {
  visible: boolean;
  initialQuery?: string;
  onClose: () => void;
  onSelectProduct: (product: Product) => void;
  onApplySearchQuery: (query: string) => void;
  products?: Product[];
  onPressCamera?: () => void;
  onPressMic?: () => void;
}

const TRENDING_SEARCHES = [
  'Roadster T-Shirts',
  'Puma Court Sneakers',
  'Linen Wide Leg Trousers',
  'Anarkali Kurta Set',
  'Vitamin C Serum',
  'Nike Running Shoes',
  "Levi's Denim Jacket",
  'Cotton Cushion Covers',
];

const POPULAR_CATEGORIES = [
  { label: 'Men Casuals', query: 'Men' },
  { label: 'Women Dresses', query: 'Dresses' },
  { label: 'Sneakers & Shoes', query: 'Sneakers' },
  { label: 'Indian Festive', query: 'Kurta' },
  { label: 'Beauty & Serums', query: 'Serum' },
  { label: 'Bed Linen & Decor', query: 'Home' },
];

export const SearchModal: React.FC<SearchModalProps> = ({
  visible,
  initialQuery = '',
  onClose,
  onSelectProduct,
  onApplySearchQuery,
  products = PRODUCTS,
  onPressCamera,
  onPressMic,
}) => {
  const [query, setQuery] = useState(initialQuery);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [trendingList, setTrendingList] = useState<string[]>(TRENDING_SEARCHES);
  const [popularCatList, setPopularCatList] = useState<{ label: string; query: string }[]>(POPULAR_CATEGORIES);

  useEffect(() => {
    let isMounted = true;
    if (visible) {
      const timer = setTimeout(() => {
        if (isMounted) setQuery(initialQuery);
      }, 0);
      storeService.getRecentSearches().then((list) => {
        if (isMounted) setRecentSearches(list);
      });
      storeService.fetchPopularSearches().then((res) => {
        if (isMounted) {
          if (res.trendingSearches?.length > 0) {
            setTrendingList(res.trendingSearches);
          }
          if (res.popularCategories?.length > 0) {
            setPopularCatList(
              res.popularCategories.map((c) => ({
                label: c.name,
                query: c.name,
              }))
            );
          }
        }
      }).catch(() => {});
      return () => {
        isMounted = false;
        clearTimeout(timer);
      };
    }
    return () => {
      isMounted = false;
    };
  }, [visible, initialQuery]);

  const handleSearchSubmit = async (textToSearch: string) => {
    const trimmed = textToSearch.trim();
    if (!trimmed) return;
    await storeService.addRecentSearch(trimmed);
    onApplySearchQuery(trimmed);
    onClose();
  };

  const handleRemoveRecent = async (item: string) => {
    const updated = await storeService.removeRecentSearch(item);
    setRecentSearches(updated);
  };

  const handleClearAll = async () => {
    await storeService.clearRecentSearches();
    setRecentSearches([]);
  };

  // Live auto-suggestions based on query
  const suggestions = query.trim().length > 0
    ? products.filter((p) => {
        const q = query.trim().toLowerCase();
        return (
          p.name.toLowerCase().includes(q) ||
          p.brand.toLowerCase().includes(q) ||
          p.subcategory.toLowerCase().includes(q) ||
          p.category.toLowerCase().includes(q)
        );
      }).slice(0, 6)
    : [];

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Top Search Input Bar */}
          <View style={styles.searchBarRow}>
            <TouchableOpacity
              onPress={onClose}
              style={styles.backButton}
              activeOpacity={0.7}>
              <Ionicons name="arrow-back" size={22} color={MyntraColors.text} />
            </TouchableOpacity>

            <View style={styles.inputWrapper}>
              <Ionicons
                name="search-outline"
                size={18}
                color={MyntraColors.textMuted}
                style={styles.searchIcon}
              />
              <TextInput
                style={styles.input}
                placeholder="Search for brands, styles & more"
                placeholderTextColor={MyntraColors.textMuted}
                value={query}
                onChangeText={setQuery}
                onSubmitEditing={() => handleSearchSubmit(query)}
                returnKeyType="search"
                autoFocus
              />
              {query.length > 0 ? (
                <TouchableOpacity
                  onPress={() => setQuery('')}
                  style={styles.clearBtn}
                  activeOpacity={0.7}>
                  <Ionicons
                    name="close-circle"
                    size={18}
                    color={MyntraColors.textMuted}
                  />
                </TouchableOpacity>
              ) : (
                <View style={styles.modalExtraIcons}>
                  {onPressCamera && (
                    <TouchableOpacity
                      onPress={onPressCamera}
                      style={styles.modalActionIcon}
                      activeOpacity={0.7}
                      accessibilityLabel="Search by photo">
                      <Ionicons
                        name="camera-outline"
                        size={19}
                        color={MyntraColors.primary}
                      />
                    </TouchableOpacity>
                  )}
                  {onPressMic && (
                    <TouchableOpacity
                      onPress={onPressMic}
                      style={styles.modalActionIcon}
                      activeOpacity={0.7}
                      accessibilityLabel="Voice search">
                      <Ionicons
                        name="mic-outline"
                        size={19}
                        color={MyntraColors.primary}
                      />
                    </TouchableOpacity>
                  )}
                </View>
              )}
            </View>

            {query.trim().length > 0 && (
              <TouchableOpacity
                onPress={() => handleSearchSubmit(query)}
                style={styles.searchCta}
                activeOpacity={0.7}>
                <Text style={styles.searchCtaText}>SEARCH</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Body Content */}
          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.scrollContent}>
            {/* Live Auto-Suggestions */}
            {query.trim().length > 0 ? (
              <View style={styles.suggestionsContainer}>
                <Text style={styles.sectionHeader}>MATCHING PRODUCTS</Text>
                {suggestions.length > 0 ? (
                  suggestions.map((item) => (
                    <TouchableOpacity
                      key={item.id}
                      style={styles.suggestionRow}
                      onPress={async () => {
                        await storeService.addRecentSearch(item.name);
                        onSelectProduct(item);
                        onClose();
                      }}
                      activeOpacity={0.7}>
                      <Ionicons
                        name="search-outline"
                        size={16}
                        color={MyntraColors.textMuted}
                      />
                      <View style={styles.suggestionTextWrapper}>
                        <Text style={styles.suggestionBrand}>
                          {item.brand}{' '}
                          <Text style={styles.suggestionName}>
                            • {item.name}
                          </Text>
                        </Text>
                        <Text style={styles.suggestionCat}>
                          in {item.category} / {item.subcategory} • ₹{item.price}
                        </Text>
                      </View>
                      <Ionicons
                        name="arrow-forward"
                        size={14}
                        color={MyntraColors.textMuted}
                      />
                    </TouchableOpacity>
                  ))
                ) : (
                  <View style={styles.noMatchContainer}>
                    <Ionicons
                      name="alert-circle-outline"
                      size={28}
                      color={MyntraColors.textMuted}
                    />
                    <Text style={styles.noMatchText}>
                      No direct matches for &quot;{query}&quot;. Press Search to see related results.
                    </Text>
                  </View>
                )}
              </View>
            ) : (
              <>
                {/* Recent Searches */}
                {recentSearches.length > 0 && (
                  <View style={styles.sectionBlock}>
                    <View style={styles.sectionHeaderRow}>
                      <Text style={styles.sectionHeader}>RECENT SEARCHES</Text>
                      <TouchableOpacity onPress={handleClearAll} activeOpacity={0.7}>
                        <Text style={styles.clearAllText}>CLEAR ALL</Text>
                      </TouchableOpacity>
                    </View>
                    <View style={styles.chipsWrap}>
                      {recentSearches.map((item) => (
                        <View key={item} style={styles.recentChip}>
                          <TouchableOpacity
                            onPress={() => handleSearchSubmit(item)}
                            activeOpacity={0.8}
                            style={styles.recentChipBtn}>
                            <Ionicons
                              name="time-outline"
                              size={13}
                              color={MyntraColors.textSecondary}
                            />
                            <Text style={styles.recentChipText}>{item}</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            onPress={() => handleRemoveRecent(item)}
                            style={styles.removeChipBtn}
                            activeOpacity={0.7}>
                            <Ionicons
                              name="close"
                              size={13}
                              color={MyntraColors.textMuted}
                            />
                          </TouchableOpacity>
                        </View>
                      ))}
                    </View>
                  </View>
                )}

                {/* Trending Searches */}
                <View style={styles.sectionBlock}>
                  <Text style={styles.sectionHeader}>TRENDING ON MYNTRA</Text>
                  <View style={styles.chipsWrap}>
                    {trendingList.map((item) => (
                      <TouchableOpacity
                        key={item}
                        onPress={() => handleSearchSubmit(item)}
                        style={styles.trendingChip}
                        activeOpacity={0.8}>
                        <Ionicons
                          name="trending-up-outline"
                          size={13}
                          color={MyntraColors.primary}
                        />
                        <Text style={styles.trendingChipText}>{item}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                {/* Popular Categories */}
                <View style={styles.sectionBlock}>
                  <Text style={styles.sectionHeader}>POPULAR CATEGORIES</Text>
                  <View style={styles.categoriesGrid}>
                    {popularCatList.map((cat) => (
                      <TouchableOpacity
                        key={cat.label}
                        onPress={() => handleSearchSubmit(cat.query)}
                        style={styles.categoryCard}
                        activeOpacity={0.8}>
                        <Ionicons
                          name="shirt-outline"
                          size={16}
                          color={MyntraColors.primary}
                        />
                        <Text style={styles.categoryCardText}>{cat.label}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              </>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'flex-start',
    alignItems: 'center',
  },
  container: {
    width: '100%',
    maxWidth: Platform.OS === 'web' ? 480 : undefined,
    height: '100%',
    backgroundColor: MyntraColors.white,
  },
  searchBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f3',
    backgroundColor: MyntraColors.white,
    gap: 8,
  },
  backButton: {
    padding: 6,
  },
  inputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f7',
    borderRadius: 22,
    paddingHorizontal: 12,
    height: 42,
    borderWidth: 1,
    borderColor: '#e8e8ec',
  },
  searchIcon: {
    marginRight: 6,
  },
  input: {
    flex: 1,
    fontSize: 14,
    color: MyntraColors.text,
    outlineStyle: 'none' as any,
  },
  clearBtn: {
    padding: 4,
  },
  searchCta: {
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  searchCtaText: {
    fontSize: 12,
    fontWeight: '800',
    color: MyntraColors.primary,
    letterSpacing: 0.5,
  },
  scrollContent: {
    padding: Spacing.lg,
    paddingBottom: 40,
  },
  sectionBlock: {
    marginBottom: Spacing.xl,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  sectionHeader: {
    fontSize: 11,
    fontWeight: '800',
    color: MyntraColors.textSecondary,
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  clearAllText: {
    fontSize: 11,
    fontWeight: '700',
    color: MyntraColors.primary,
  },
  chipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  recentChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f6f6f8',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#e5e5ea',
    paddingLeft: 10,
    paddingRight: 6,
    paddingVertical: 6,
  },
  recentChipBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  recentChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: MyntraColors.text,
  },
  removeChipBtn: {
    padding: 3,
    marginLeft: 4,
  },
  trendingChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#fff4f6',
    borderWidth: 1,
    borderColor: '#ffd3dd',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 18,
  },
  trendingChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: MyntraColors.text,
  },
  categoriesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  categoryCard: {
    width: '48%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: MyntraColors.white,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e8e8ed',
  },
  categoryCardText: {
    fontSize: 12,
    fontWeight: '700',
    color: MyntraColors.text,
  },
  suggestionsContainer: {
    marginTop: 4,
  },
  suggestionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f4f4f6',
    gap: 12,
  },
  suggestionTextWrapper: {
    flex: 1,
  },
  suggestionBrand: {
    fontSize: 13,
    fontWeight: '800',
    color: MyntraColors.text,
  },
  suggestionName: {
    fontWeight: '500',
    color: MyntraColors.textSecondary,
  },
  suggestionCat: {
    fontSize: 11,
    color: MyntraColors.textMuted,
    marginTop: 2,
  },
  noMatchContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 36,
    gap: 8,
  },
  noMatchText: {
    fontSize: 12,
    color: MyntraColors.textSecondary,
    textAlign: 'center',
    maxWidth: 240,
    lineHeight: 18,
  },
  modalExtraIcons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingRight: 6,
  },
  modalActionIcon: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
