import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

import { authService } from './auth-service';

import {
  AVAILABLE_COUPONS,
  BrandSpotlight,
  CATEGORIES,
  Category,
  CURATED_COLLECTIONS,
  CuratedCollection,
  DEFAULT_BANK_OFFERS,
  Product,
  PRODUCTS,
  PROMO_BANNERS,
  PromoBannerData,
  SUBCATEGORIES,
  TOP_BRANDS,
} from '@/data/mock-data';
import {
  BankOffer,
  CartItem,
  Coupon,
  DeliveryAddress,
  FilterState,
  InsiderInfo,
  Order,
} from '@/types/store';

const STORE_KEYS = {
  WISHLIST_GUEST: '@myntra_wishlist_guest',
  WISHLIST_LEGACY: '@myntra_wishlist',
  WISHLIST_USER_PREFIX: '@myntra_wishlist_user_',
  WISHLIST_COLLECTIONS: '@myntra_wishlist_collections',
  CART: '@myntra_cart',
  CART_GUEST: '@myntra_cart_guest',
  CART_LEGACY: '@myntra_cart',
  CART_USER_PREFIX: '@myntra_cart_user_',
  ORDERS: '@myntra_orders',
  ADDRESSES: '@myntra_addresses',
  RECENTLY_VIEWED: '@myntra_recently_viewed',
  RECENT_SEARCHES: '@myntra_recent_searches',
};

const DEFAULT_ADDRESSES: DeliveryAddress[] = [
  {
    id: 'addr-default',
    name: 'Aryak Sharma',
    mobile: '9876543210',
    pincode: '400001',
    address: 'Flat 402, Sea Green Apartments, Nariman Point',
    locality: 'Opposite Express Towers',
    city: 'Mumbai',
    state: 'Maharashtra',
    addressType: 'Home',
    isDefault: true,
  },
];

const getApiBaseUrl = (): string => {
  if (process.env.EXPO_PUBLIC_API_URL) {
    return process.env.EXPO_PUBLIC_API_URL;
  }
  // If running in Expo Go on physical device or emulator, extract the computer's LAN IP from hostUri
  const hostUri = Constants.expoConfig?.hostUri;
  if (hostUri) {
    const host = hostUri.split(':')[0];
    if (host) {
      return `http://${host}:5000/api`;
    }
  }
  if (Platform.OS === 'android') {
    return 'http://10.0.2.2:5000/api';
  }
  return 'http://localhost:5000/api';
};

const getAuthHeaders = async (): Promise<Record<string, string>> => {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  const token = await authService.getToken();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
};

class StoreService {
  /* ========================================================
   * 1. CATEGORY & PRODUCT API METHODS
   * ======================================================== */

  /**
   * Fetch home screen curated data from GET /api/home
   */
  async fetchHomeData(): Promise<{
    banners: PromoBannerData[];
    categories: Category[];
    featuredProducts: Product[];
    trendingProducts: Product[];
    dealOfDayProducts: Product[];
    curatedCollections: CuratedCollection[];
    topBrands: BrandSpotlight[];
    bankOffers: BankOffer[];
  }> {
    try {
      const response = await fetch(`${getApiBaseUrl()}/home`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });

      if (response.ok) {
        const json = await response.json();
        if (json.success) {
          return {
            banners: json.banners || json.data?.banners || PROMO_BANNERS,
            categories: json.categories || json.data?.categories || CATEGORIES,
            featuredProducts:
              json.featuredProducts || json.data?.featuredProducts || PRODUCTS.slice(0, 8),
            trendingProducts:
              json.trendingProducts || json.data?.trendingProducts || PRODUCTS.filter((p) => p.isTrending),
            dealOfDayProducts:
              json.dealOfDayProducts || json.data?.dealOfDayProducts || PRODUCTS.filter((p) => p.isDealOfDay || p.discountPercent >= 50),
            curatedCollections:
              json.curatedCollections || json.data?.curatedCollections || CURATED_COLLECTIONS,
            topBrands: json.topBrands || json.data?.topBrands || TOP_BRANDS,
            bankOffers: json.bankOffers || json.data?.bankOffers || DEFAULT_BANK_OFFERS,
          };
        }
      }
    } catch (e) {
      console.warn('Backend /home API unreachable, using cached catalog:', e);
    }

    return {
      banners: PROMO_BANNERS,
      categories: CATEGORIES,
      featuredProducts: PRODUCTS.filter((p) => p.isBestseller || p.isRecommended).slice(0, 8),
      trendingProducts: PRODUCTS.filter((p) => p.isTrending).slice(0, 8),
      dealOfDayProducts: PRODUCTS.filter((p) => p.isDealOfDay || p.discountPercent >= 50).slice(0, 8),
      curatedCollections: CURATED_COLLECTIONS,
      topBrands: TOP_BRANDS,
      bankOffers: DEFAULT_BANK_OFFERS,
    };
  }

  /**
   * Fetch dynamic bank & payment offers from GET /api/offers
   */
  async fetchBankOffers(): Promise<BankOffer[]> {
    try {
      const response = await fetch(`${getApiBaseUrl()}/offers`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });
      if (response.ok) {
        const json = await response.json();
        if (json.success && Array.isArray(json.offers)) {
          return json.offers;
        }
      }
    } catch (e) {
      console.warn('Backend /offers unreachable, using default bank offers:', e);
    }
    return DEFAULT_BANK_OFFERS;
  }

  /**
   * Fetch active discount coupons from GET /api/coupons
   */
  async fetchCoupons(): Promise<Coupon[]> {
    try {
      const response = await fetch(`${getApiBaseUrl()}/coupons`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });
      if (response.ok) {
        const json = await response.json();
        if (json.success && Array.isArray(json.coupons)) {
          return json.coupons;
        }
      }
    } catch (e) {
      console.warn('Backend /coupons unreachable, using default coupons:', e);
    }
    return AVAILABLE_COUPONS;
  }

  /**
   * Fetch VIP Insider details & perks from GET /api/insider
   */
  async fetchInsiderData(): Promise<InsiderInfo> {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${getApiBaseUrl()}/insider`, {
        method: 'GET',
        headers,
      });
      if (response.ok) {
        const json = await response.json();
        if (json.success) {
          return {
            superCoins: json.superCoins ?? 250,
            tier: json.tier || 'GOLD TIER',
            tierSubtitle: json.tierSubtitle || 'Select Tier Member',
            pointsRule: json.pointsRule || 'Earn 10 SuperCoins for every ₹100 spent on all purchases.',
            perks: json.perks || [],
          };
        }
      }
    } catch (e) {
      console.warn('Backend /insider unreachable, using default insider data:', e);
    }
    return {
      superCoins: 250,
      tier: 'GOLD TIER',
      tierSubtitle: 'Select Tier Member',
      pointsRule: 'Earn 10 SuperCoins for every ₹100 spent on all purchases.',
      perks: [
        {
          id: 'perk-1',
          icon: 'airplane-outline',
          title: 'Free Express Delivery',
          description: 'No minimum order required',
          status: 'ACTIVE',
        },
        {
          id: 'perk-2',
          icon: 'alarm-outline',
          title: 'Early Sale Access',
          description: 'Enter mega sales 24 hrs early',
          status: 'ACTIVE',
        },
        {
          id: 'perk-3',
          icon: 'gift-outline',
          title: '₹500 Birthday Voucher',
          description: 'Gift voucher credited every year',
          status: 'CLAIMABLE',
        },
      ],
    };
  }

  /**
   * Fetch subcategories dictionary & banners from GET /api/categories/subcategories
   */
  async fetchSubcategories(): Promise<{
    subcategories: Record<string, string[]>;
    categoryBanners: Record<string, { title: string; tag: string }>;
  }> {
    try {
      const response = await fetch(`${getApiBaseUrl()}/categories/subcategories`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });
      if (response.ok) {
        const json = await response.json();
        if (json.success) {
          return {
            subcategories: json.subcategories || SUBCATEGORIES,
            categoryBanners: json.categoryBanners || {},
          };
        }
      }
    } catch (e) {
      console.warn('Backend /categories/subcategories unreachable:', e);
    }
    return {
      subcategories: SUBCATEGORIES,
      categoryBanners: {},
    };
  }

  /**
   * Fetch trending search keywords & popular categories from GET /api/search/popular
   */
  async fetchPopularSearches(): Promise<{
    popularCategories: { id: string; name: string; icon: string }[];
    trendingSearches: string[];
  }> {
    try {
      const response = await fetch(`${getApiBaseUrl()}/search/popular`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });
      if (response.ok) {
        const json = await response.json();
        if (json.success) {
          return {
            popularCategories: json.popularCategories || [],
            trendingSearches: json.trendingSearches || [],
          };
        }
      }
    } catch (e) {
      console.warn('Backend /search/popular unreachable:', e);
    }
    return {
      popularCategories: [
        { id: 'pop-1', name: 'T-Shirts', icon: 'shirt-outline' },
        { id: 'pop-2', name: 'Kurtas', icon: 'sparkles-outline' },
        { id: 'pop-3', name: 'Dresses', icon: 'woman-outline' },
        { id: 'pop-4', name: 'Jeans', icon: 'cut-outline' },
        { id: 'pop-5', name: 'Shoes', icon: 'footsteps-outline' },
        { id: 'pop-6', name: 'Watches', icon: 'watch-outline' },
        { id: 'pop-7', name: 'Handbags', icon: 'bag-handle-outline' },
        { id: 'pop-8', name: 'Beauty', icon: 'color-palette-outline' },
      ],
      trendingSearches: [
        'Oversized T-Shirts',
        'Cotton Kurtis Under 799',
        'Sneakers For Men',
        'Floral Maxi Dress',
        'Smartwatches On Sale',
        'Denim Jackets',
      ],
    };
  }

  /**
   * Fetch all active categories from GET /api/categories
   */
  async fetchCategories(): Promise<Category[]> {
    try {
      const response = await fetch(`${getApiBaseUrl()}/categories`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });

      if (response.ok) {
        const json = await response.json();
        if (json.success && Array.isArray(json.categories)) {
          return json.categories;
        }
      }
    } catch (e) {
      console.warn('Backend /categories API unreachable, using cached categories:', e);
    }
    return CATEGORIES;
  }

  /**
   * Fetch category by ID from GET /api/categories/:id
   */
  async fetchCategoryById(categoryId: string): Promise<Category | null> {
    try {
      const response = await fetch(`${getApiBaseUrl()}/categories/${categoryId}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });

      if (response.ok) {
        const json = await response.json();
        if (json.success && json.category) {
          return json.category;
        }
      }
    } catch (e) {
      console.warn('Backend /categories/:id unreachable:', e);
    }
    return CATEGORIES.find((c) => c.id.toLowerCase() === categoryId.toLowerCase()) || null;
  }

  /**
   * Fetch products belonging to a category from GET /api/categories/:id/products
   */
  async fetchCategoryProducts(
    categoryId: string,
    options?: { search?: string; sortBy?: string }
  ): Promise<Product[]> {
    try {
      const params = new URLSearchParams();
      if (options?.search) params.append('search', options.search);
      if (options?.sortBy) params.append('sortBy', options.sortBy);

      const qs = params.toString() ? `?${params.toString()}` : '';
      const response = await fetch(`${getApiBaseUrl()}/categories/${categoryId}/products${qs}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });

      if (response.ok) {
        const json = await response.json();
        if (json.success && Array.isArray(json.products)) {
          return json.products;
        }
      }
    } catch (e) {
      console.warn('Backend /categories/:id/products unreachable:', e);
    }

    // Local fallback
    const clean = categoryId.toLowerCase();
    if (clean === 'all') return PRODUCTS;
    return PRODUCTS.filter(
      (p) => p.category.toLowerCase() === clean
    );
  }

  /**
   * Fetch products with multi-facet filters from GET /api/products
   */
  async fetchProducts(
    filters?: Partial<FilterState> & {
      search?: string;
      page?: number;
      limit?: number;
    }
  ): Promise<{ products: Product[]; total: number }> {
    try {
      const params = new URLSearchParams();
      if (filters?.category) params.append('category', filters.category);
      if (filters?.subcategory) params.append('subcategory', filters.subcategory);
      if (filters?.search) params.append('search', filters.search);
      if (filters?.brands && filters.brands.length > 0)
        params.append('brands', filters.brands.join(','));
      if (filters?.sortBy) params.append('sortBy', filters.sortBy);
      if (filters?.sizes && filters.sizes.length > 0)
        params.append('sizes', filters.sizes.join(','));
      if (filters?.priceRange) {
        params.append('minPrice', filters.priceRange[0].toString());
        params.append('maxPrice', filters.priceRange[1].toString());
      }
      if (filters?.minRating) params.append('minRating', filters.minRating.toString());
      if (filters?.page) params.append('page', filters.page.toString());
      if (filters?.limit) params.append('limit', filters.limit.toString());

      const qs = params.toString() ? `?${params.toString()}` : '';
      const response = await fetch(`${getApiBaseUrl()}/products${qs}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });

      if (response.ok) {
        const json = await response.json();
        if (json.success && Array.isArray(json.products)) {
          return { products: json.products, total: json.total || json.products.length };
        }
      }
    } catch (e) {
      console.warn('Backend /products API unreachable, using cached catalog:', e);
    }

    return { products: PRODUCTS, total: PRODUCTS.length };
  }

  /**
   * Fetch one product by its actual ID from GET /api/products/:id
   */
  async fetchProductById(productId: string): Promise<Product | null> {
    try {
      const response = await fetch(`${getApiBaseUrl()}/products/${productId}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });

      if (response.ok) {
        const json = await response.json();
        if (json.success && json.product) {
          return json.product;
        }
      }
    } catch (e) {
      console.warn('Backend /products/:id unreachable:', e);
    }

    return PRODUCTS.find((p) => p.id === productId) || null;
  }

  /* ========================================================
   * 2. WISHLIST API METHODS
   * ======================================================== */

  private getWishlistStorageKey(userId?: string): string {
    return userId ? `${STORE_KEYS.WISHLIST_USER_PREFIX}${userId}` : STORE_KEYS.WISHLIST_GUEST;
  }

  /**
   * Load wishlisted product IDs.
   * If user is authenticated, calls GET /api/wishlist and synchronizes local storage.
   */
  async getWishlist(userId?: string): Promise<string[]> {
    const token = await authService.getToken();

    if (token && userId) {
      try {
        const headers = await getAuthHeaders();
        const response = await fetch(`${getApiBaseUrl()}/wishlist`, {
          method: 'GET',
          headers,
        });

        if (response.ok) {
          const json = await response.json();
          if (json.success && Array.isArray(json.productIds)) {
            // Save to local cache
            await this.saveWishlist(json.productIds, userId);
            return json.productIds;
          }
        }
      } catch (e) {
        console.warn('Failed to fetch wishlist from API, using local cache:', e);
      }
    }

    // Guest or Offline fallback
    try {
      const key = this.getWishlistStorageKey(userId);
      const data = await AsyncStorage.getItem(key);
      if (data) {
        return JSON.parse(data);
      }

      if (!userId) {
        const legacyData = await AsyncStorage.getItem(STORE_KEYS.WISHLIST_LEGACY);
        if (legacyData) {
          const parsed = JSON.parse(legacyData);
          await AsyncStorage.setItem(STORE_KEYS.WISHLIST_GUEST, JSON.stringify(parsed));
          return parsed;
        }
      }
    } catch {}

    return [];
  }

  /**
   * Save wishlist IDs to storage with deduplication
   */
  async saveWishlist(ids: string[], userId?: string): Promise<void> {
    try {
      const key = this.getWishlistStorageKey(userId);
      const uniqueIds = Array.from(new Set(ids));
      await AsyncStorage.setItem(key, JSON.stringify(uniqueIds));
    } catch (e) {
      console.warn('Failed to save wishlist:', e);
    }
  }

  /**
   * Add a product ID to wishlist via POST /api/wishlist (or guest storage)
   */
  async addToWishlist(productId: string, userId?: string): Promise<string[]> {
    const token = await authService.getToken();

    if (token && userId) {
      try {
        const headers = await getAuthHeaders();
        const response = await fetch(`${getApiBaseUrl()}/wishlist`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ productId }),
        });

        if (response.ok) {
          const json = await response.json();
          if (json.success && Array.isArray(json.productIds)) {
            await this.saveWishlist(json.productIds, userId);
            return json.productIds;
          }
        }
      } catch (e) {
        console.warn('Wishlist add API error, saving locally:', e);
      }
    }

    // Guest / local update
    const current = await this.getWishlist(userId);
    const updated = Array.from(new Set([...current, productId]));
    await this.saveWishlist(updated, userId);
    return updated;
  }

  /**
   * Remove a product ID from wishlist via DELETE /api/wishlist/:productId (or guest storage)
   */
  async removeFromWishlist(productId: string, userId?: string): Promise<string[]> {
    const token = await authService.getToken();

    if (token && userId) {
      try {
        const headers = await getAuthHeaders();
        const response = await fetch(`${getApiBaseUrl()}/wishlist/${productId}`, {
          method: 'DELETE',
          headers,
        });

        if (response.ok) {
          const json = await response.json();
          if (json.success && Array.isArray(json.productIds)) {
            await this.saveWishlist(json.productIds, userId);
            return json.productIds;
          }
        }
      } catch (e) {
        console.warn('Wishlist delete API error, removing locally:', e);
      }
    }

    // Guest / local update
    const current = await this.getWishlist(userId);
    const updated = current.filter((id) => id !== productId);
    await this.saveWishlist(updated, userId);
    return updated;
  }

  /**
   * Merge guest wishlist into user account upon login and clear guest wishlist
   */
  async mergeGuestWishlist(userId: string): Promise<string[]> {
    try {
      const guestKey = STORE_KEYS.WISHLIST_GUEST;
      let guestIds: string[] = [];
      const guestData = await AsyncStorage.getItem(guestKey);
      if (guestData) {
        guestIds = JSON.parse(guestData);
      }

      const token = await authService.getToken();

      // If user has token and guest items exist, sync to backend
      if (token && guestIds.length > 0) {
        const headers = await getAuthHeaders();
        for (const pid of guestIds) {
          try {
            await fetch(`${getApiBaseUrl()}/wishlist`, {
              method: 'POST',
              headers,
              body: JSON.stringify({ productId: pid }),
            });
          } catch {}
        }
        await AsyncStorage.removeItem(STORE_KEYS.WISHLIST_GUEST);
        await AsyncStorage.removeItem(STORE_KEYS.WISHLIST_LEGACY);
        return await this.getWishlist(userId);
      }

      // Local fallback merge
      const userKey = this.getWishlistStorageKey(userId);
      const userData = await AsyncStorage.getItem(userKey);
      const userIds: string[] = userData ? JSON.parse(userData) : [];
      const mergedList = Array.from(new Set([...userIds, ...guestIds]));

      await AsyncStorage.setItem(userKey, JSON.stringify(mergedList));
      await AsyncStorage.removeItem(STORE_KEYS.WISHLIST_GUEST);
      await AsyncStorage.removeItem(STORE_KEYS.WISHLIST_LEGACY);

      return mergedList;
    } catch (e) {
      console.warn('Failed to merge guest wishlist:', e);
      return await this.getWishlist(userId);
    }
  }

  async clearWishlist(userId?: string): Promise<void> {
    try {
      const key = this.getWishlistStorageKey(userId);
      await AsyncStorage.setItem(key, JSON.stringify([]));
    } catch (e) {
      console.warn('Failed to clear wishlist:', e);
    }
  }

  async getWishlistCollections(): Promise<Record<string, string>> {
    try {
      const data = await AsyncStorage.getItem(STORE_KEYS.WISHLIST_COLLECTIONS);
      return data ? JSON.parse(data) : {};
    } catch {
      return {};
    }
  }

  async saveProductCollection(productId: string, collectionName: string): Promise<Record<string, string>> {
    try {
      const collections = await this.getWishlistCollections();
      collections[productId] = collectionName;
      await AsyncStorage.setItem(STORE_KEYS.WISHLIST_COLLECTIONS, JSON.stringify(collections));
      return collections;
    } catch (e) {
      console.warn('Failed to save product collection:', e);
      return {};
    }
  }

  async removeProductCollection(productId: string): Promise<Record<string, string>> {
    try {
      const collections = await this.getWishlistCollections();
      delete collections[productId];
      await AsyncStorage.setItem(STORE_KEYS.WISHLIST_COLLECTIONS, JSON.stringify(collections));
      return collections;
    } catch (e) {
      console.warn('Failed to remove product collection:', e);
      return {};
    }
  }

  /* ========================================================
   * 3. SHOPPING BAG API METHODS
   * ======================================================== */

  private getCartStorageKey(userId?: string): string {
    return userId ? `${STORE_KEYS.CART_USER_PREFIX}${userId}` : STORE_KEYS.CART_GUEST;
  }

  /**
   * Load shopping cart items.
   * If authenticated, calls GET /api/bag with Bearer token.
   */
  async getCart(userId?: string): Promise<CartItem[]> {
    const token = await authService.getToken();

    if (token && userId) {
      try {
        const headers = await getAuthHeaders();
        const response = await fetch(`${getApiBaseUrl()}/bag`, {
          method: 'GET',
          headers,
        });

        if (response.ok) {
          const json = await response.json();
          if (json.success && Array.isArray(json.items)) {
            await this.saveCart(json.items, userId);
            return json.items;
          }
        }
      } catch (e) {
        console.warn('Failed to fetch bag from API, using local cache:', e);
      }
    }

    // Guest / local fallback
    try {
      const key = this.getCartStorageKey(userId);
      const data = await AsyncStorage.getItem(key);
      if (data) {
        return JSON.parse(data);
      }

      if (!userId) {
        const legacyData = await AsyncStorage.getItem(STORE_KEYS.CART_LEGACY);
        if (legacyData) {
          const parsed = JSON.parse(legacyData);
          await AsyncStorage.setItem(STORE_KEYS.CART_GUEST, JSON.stringify(parsed));
          return parsed;
        }
      }
    } catch {}

    return [];
  }

  async saveCart(items: CartItem[], userId?: string): Promise<void> {
    try {
      const key = this.getCartStorageKey(userId);
      await AsyncStorage.setItem(key, JSON.stringify(items));
    } catch (e) {
      console.warn('Failed to save cart:', e);
    }
  }

  /**
   * Add a product to bag via POST /api/bag/items (or guest storage)
   */
  async addToCart(
    product: Product,
    size: string,
    color?: string,
    quantity: number = 1,
    userId?: string
  ): Promise<CartItem[]> {
    const token = await authService.getToken();

    if (token && userId) {
      try {
        const headers = await getAuthHeaders();
        const response = await fetch(`${getApiBaseUrl()}/bag/items`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            productId: product.id,
            size,
            color: color || product.colors[0],
            quantity,
          }),
        });

        if (response.ok) {
          const json = await response.json();
          if (json.success && Array.isArray(json.items)) {
            await this.saveCart(json.items, userId);
            return json.items;
          }
        }
      } catch (e) {
        console.warn('Bag add API error, saving locally:', e);
      }
    }

    // Guest / local update
    const cart = await this.getCart(userId);
    const existingIndex = cart.findIndex(
      (item) =>
        item.productId === product.id &&
        item.size === size &&
        (!color || item.color === color)
    );

    if (existingIndex > -1) {
      cart[existingIndex].quantity += quantity;
    } else {
      cart.push({
        id: `cart-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        productId: product.id,
        product,
        size,
        color: color || product.colors[0],
        quantity,
      });
    }

    await this.saveCart(cart, userId);
    return cart;
  }

  /**
   * Update quantity of a cart item via PATCH /api/bag/items/:id (or guest storage)
   */
  async updateCartQuantity(
    cartItemIdOrProdId: string,
    newQty: number,
    userId?: string
  ): Promise<CartItem[]> {
    const token = await authService.getToken();

    if (token && userId) {
      try {
        const headers = await getAuthHeaders();
        const response = await fetch(
          `${getApiBaseUrl()}/bag/items/${cartItemIdOrProdId}`,
          {
            method: 'PATCH',
            headers,
            body: JSON.stringify({ quantity: newQty }),
          }
        );

        if (response.ok) {
          const json = await response.json();
          if (json.success && Array.isArray(json.items)) {
            await this.saveCart(json.items, userId);
            return json.items;
          }
        }
      } catch (e) {
        console.warn('Bag update API error, updating locally:', e);
      }
    }

    // Guest / local update
    let cart = await this.getCart(userId);
    if (newQty <= 0) {
      cart = cart.filter(
        (item) => item.id !== cartItemIdOrProdId && item.productId !== cartItemIdOrProdId
      );
    } else {
      cart = cart.map((item) =>
        item.id === cartItemIdOrProdId || item.productId === cartItemIdOrProdId
          ? { ...item, quantity: newQty }
          : item
      );
    }
    await this.saveCart(cart, userId);
    return cart;
  }

  async updateCartItemVariant(
    cartItemId: string,
    newSize: string,
    newColor?: string,
    userId?: string
  ): Promise<CartItem[]> {
    let cart = await this.getCart(userId);
    const targetItem = cart.find((i) => i.id === cartItemId);
    if (!targetItem) return cart;

    const existingIndex = cart.findIndex(
      (i) =>
        i.id !== cartItemId &&
        i.productId === targetItem.productId &&
        i.size === newSize &&
        (!newColor || i.color === newColor)
    );

    if (existingIndex > -1) {
      cart[existingIndex].quantity += targetItem.quantity;
      cart = cart.filter((i) => i.id !== cartItemId);
    } else {
      cart = cart.map((i) =>
        i.id === cartItemId
          ? {
              ...i,
              size: newSize,
              color: newColor || i.color,
            }
          : i
      );
    }

    await this.saveCart(cart, userId);
    return cart;
  }

  /**
   * Remove a single item from cart via DELETE /api/bag/items/:id (or guest storage)
   */
  async removeFromCart(cartItemIdOrProdId: string, userId?: string): Promise<CartItem[]> {
    const token = await authService.getToken();

    if (token && userId) {
      try {
        const headers = await getAuthHeaders();
        const response = await fetch(
          `${getApiBaseUrl()}/bag/items/${cartItemIdOrProdId}`,
          {
            method: 'DELETE',
            headers,
          }
        );

        if (response.ok) {
          const json = await response.json();
          if (json.success && Array.isArray(json.items)) {
            await this.saveCart(json.items, userId);
            return json.items;
          }
        }
      } catch (e) {
        console.warn('Bag delete API error, removing locally:', e);
      }
    }

    const cart = await this.getCart(userId);
    const filtered = cart.filter(
      (item) => item.id !== cartItemIdOrProdId && item.productId !== cartItemIdOrProdId
    );
    await this.saveCart(filtered, userId);
    return filtered;
  }

  /**
   * Clear all items in cart via DELETE /api/bag (or guest storage)
   */
  async clearCart(userId?: string): Promise<void> {
    const token = await authService.getToken();

    if (token && userId) {
      try {
        const headers = await getAuthHeaders();
        await fetch(`${getApiBaseUrl()}/bag`, {
          method: 'DELETE',
          headers,
        });
      } catch (e) {
        console.warn('Bag clear API error:', e);
      }
    }

    await this.saveCart([], userId);
  }

  /**
   * Merge guest cart into user account upon login, combining line items with matching variants
   */
  async mergeGuestCart(userId: string): Promise<CartItem[]> {
    try {
      const guestKey = STORE_KEYS.CART_GUEST;
      let guestCart: CartItem[] = [];
      const guestData = await AsyncStorage.getItem(guestKey);
      if (guestData) {
        guestCart = JSON.parse(guestData);
      }

      const token = await authService.getToken();

      // If user has token and guest items exist, sync to backend
      if (token && guestCart.length > 0) {
        const headers = await getAuthHeaders();
        for (const item of guestCart) {
          try {
            await fetch(`${getApiBaseUrl()}/bag/items`, {
              method: 'POST',
              headers,
              body: JSON.stringify({
                productId: item.productId,
                size: item.size,
                color: item.color,
                quantity: item.quantity,
              }),
            });
          } catch {}
        }
        await AsyncStorage.removeItem(STORE_KEYS.CART_GUEST);
        await AsyncStorage.removeItem(STORE_KEYS.CART_LEGACY);
        return await this.getCart(userId);
      }

      // Local fallback merge
      const userKey = this.getCartStorageKey(userId);
      const userData = await AsyncStorage.getItem(userKey);
      const userCart: CartItem[] = userData ? JSON.parse(userData) : [];

      const mergedCart = [...userCart];
      guestCart.forEach((gItem) => {
        const matchIndex = mergedCart.findIndex(
          (uItem) =>
            uItem.productId === gItem.productId &&
            uItem.size === gItem.size &&
            uItem.color === gItem.color
        );
        if (matchIndex > -1) {
          mergedCart[matchIndex].quantity += gItem.quantity;
        } else {
          mergedCart.push(gItem);
        }
      });

      await AsyncStorage.setItem(userKey, JSON.stringify(mergedCart));
      await AsyncStorage.removeItem(STORE_KEYS.CART_GUEST);
      await AsyncStorage.removeItem(STORE_KEYS.CART_LEGACY);

      return mergedCart;
    } catch (e) {
      console.warn('Failed to merge guest cart:', e);
      return await this.getCart(userId);
    }
  }

  /* ========================================================
   * 4. ORDERS & ADDRESSES & RECENT
   * ======================================================== */

  async getOrders(userId?: string): Promise<Order[]> {
    try {
      const data = await AsyncStorage.getItem(STORE_KEYS.ORDERS);
      const all: Order[] = data ? JSON.parse(data) : [];
      if (userId) {
        return all.filter((o) => !o.userId || o.userId === userId);
      }
      return all;
    } catch {
      return [];
    }
  }

  async placeOrder(
    items: CartItem[],
    shippingAddress: string = 'Home, Mumbai, Maharashtra - 400001',
    appliedCouponCode?: string,
    couponDiscount: number = 0,
    paymentMethod: string = 'Cash on Delivery / UPI',
    userId?: string
  ): Promise<Order> {
    let allOrders: Order[] = [];
    try {
      const data = await AsyncStorage.getItem(STORE_KEYS.ORDERS);
      if (data) {
        allOrders = JSON.parse(data);
      }
    } catch {
      allOrders = [];
    }

    const totalMRP = items.reduce(
      (acc, item) => acc + (item.product?.originalPrice || item.product?.price || 0) * item.quantity,
      0
    );
    const totalSellingPrice = items.reduce(
      (acc, item) => acc + (item.product?.price || 0) * item.quantity,
      0
    );
    const discountAmount = totalMRP - totalSellingPrice;
    const isFreeDelivery =
      totalSellingPrice >= 799 || appliedCouponCode === 'FREEDEL';
    const deliveryFee = isFreeDelivery ? 0 : 49;
    const finalAmount = Math.max(
      0,
      totalSellingPrice - couponDiscount + deliveryFee
    );

    const deliveryDateObj = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
    const deliveryDateStr = deliveryDateObj.toLocaleDateString('en-IN', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });

    const isCod =
      paymentMethod.toLowerCase().includes('cash on delivery') ||
      paymentMethod.toLowerCase().includes('cod');

    const newOrder: Order = {
      id: `MYN-${Math.floor(100000 + Math.random() * 900000)}`,
      userId: userId || undefined,
      date: new Date().toISOString(),
      items: [...items],
      totalMRP,
      totalAmount: finalAmount,
      discountAmount,
      couponDiscount,
      appliedCoupon: appliedCouponCode,
      deliveryFee,
      status: 'Confirmed',
      deliveryDate: deliveryDateStr,
      shippingAddress,
      paymentMethod,
      paymentStatus: isCod ? 'Pending' : 'Paid',
      trackingSteps: [
        {
          title: 'Order Confirmed',
          date: 'Today',
          completed: true,
          active: false,
        },
        {
          title: 'Shipped from Warehouse',
          date: 'Expected Tomorrow',
          completed: false,
          active: true,
        },
        {
          title: 'Out for Delivery',
          date: `By ${deliveryDateStr}`,
          completed: false,
          active: false,
        },
        {
          title: 'Delivered',
          date: deliveryDateStr,
          completed: false,
          active: false,
        },
      ],
    };

    allOrders.unshift(newOrder);
    await AsyncStorage.setItem(STORE_KEYS.ORDERS, JSON.stringify(allOrders));

    await this.clearCart(userId);

    return newOrder;
  }

  async cancelOrder(orderId: string, reason?: string): Promise<boolean> {
    try {
      const data = await AsyncStorage.getItem(STORE_KEYS.ORDERS);
      const all: Order[] = data ? JSON.parse(data) : [];
      let found = false;

      const updated = all.map((o) => {
        if (
          o.id === orderId &&
          o.status !== 'Delivered' &&
          o.status !== 'Cancelled' &&
          o.status !== 'Returned'
        ) {
          found = true;
          const cancelTitle = reason ? `Cancelled (${reason})` : 'Order Cancelled';
          return {
            ...o,
            status: 'Cancelled' as const,
            paymentStatus: o.paymentStatus === 'Paid' ? ('Refunded' as const) : o.paymentStatus,
            trackingSteps: [
              ...o.trackingSteps.map((s) => ({ ...s, active: false })),
              {
                title: cancelTitle,
                date: 'Today',
                completed: true,
                active: false,
              },
            ],
          };
        }
        return o;
      });

      if (found) {
        await AsyncStorage.setItem(STORE_KEYS.ORDERS, JSON.stringify(updated));
        return true;
      }
      return false;
    } catch (e) {
      console.warn('Failed to cancel order:', e);
      return false;
    }
  }

  async returnOrder(
    orderId: string,
    actionType: 'return' | 'exchange' = 'return',
    reason: string = 'Size/fit issue'
  ): Promise<boolean> {
    try {
      const data = await AsyncStorage.getItem(STORE_KEYS.ORDERS);
      const all: Order[] = data ? JSON.parse(data) : [];
      let found = false;

      const updated = all.map((o) => {
        if (o.id === orderId && o.status === 'Delivered') {
          found = true;
          const stepTitle =
            actionType === 'exchange'
              ? `Exchange Requested (${reason})`
              : `Return Initiated (${reason})`;
          return {
            ...o,
            status: 'Returned' as const,
            paymentStatus: actionType === 'return' ? ('Refunded' as const) : o.paymentStatus,
            trackingSteps: [
              ...o.trackingSteps,
              {
                title: stepTitle,
                date: 'Pickup in 1-2 business days',
                completed: true,
                active: false,
              },
            ],
          };
        }
        return o;
      });

      if (found) {
        await AsyncStorage.setItem(STORE_KEYS.ORDERS, JSON.stringify(updated));
        return true;
      }
      return false;
    } catch (e) {
      console.warn('Failed to return order:', e);
      return false;
    }
  }

  async getAddresses(): Promise<DeliveryAddress[]> {
    try {
      const data = await AsyncStorage.getItem(STORE_KEYS.ADDRESSES);
      if (!data) {
        await AsyncStorage.setItem(
          STORE_KEYS.ADDRESSES,
          JSON.stringify(DEFAULT_ADDRESSES)
        );
        return DEFAULT_ADDRESSES;
      }
      return JSON.parse(data);
    } catch {
      return DEFAULT_ADDRESSES;
    }
  }

  async saveAddress(address: DeliveryAddress): Promise<DeliveryAddress[]> {
    const addresses = await this.getAddresses();
    if (address.isDefault) {
      addresses.forEach((a) => (a.isDefault = false));
    }
    const existingIndex = addresses.findIndex((a) => a.id === address.id);
    if (existingIndex >= 0) {
      addresses[existingIndex] = address;
    } else {
      addresses.push(address);
    }
    await AsyncStorage.setItem(STORE_KEYS.ADDRESSES, JSON.stringify(addresses));
    return addresses;
  }

  async deleteAddress(addressId: string): Promise<DeliveryAddress[]> {
    const addresses = await this.getAddresses();
    const filtered = addresses.filter((a) => a.id !== addressId);
    if (filtered.length > 0 && !filtered.some((a) => a.isDefault)) {
      filtered[0].isDefault = true;
    }
    await AsyncStorage.setItem(STORE_KEYS.ADDRESSES, JSON.stringify(filtered));
    return filtered;
  }

  async setDefaultAddress(addressId: string): Promise<DeliveryAddress[]> {
    const addresses = await this.getAddresses();
    const updated = addresses.map((a) => ({
      ...a,
      isDefault: a.id === addressId,
    }));
    await AsyncStorage.setItem(STORE_KEYS.ADDRESSES, JSON.stringify(updated));
    return updated;
  }

  async getRecentlyViewed(): Promise<string[]> {
    try {
      const data = await AsyncStorage.getItem(STORE_KEYS.RECENTLY_VIEWED);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  async addRecentlyViewed(productId: string): Promise<string[]> {
    try {
      let ids = await this.getRecentlyViewed();
      ids = [productId, ...ids.filter((id) => id !== productId)].slice(0, 10);
      await AsyncStorage.setItem(STORE_KEYS.RECENTLY_VIEWED, JSON.stringify(ids));
      return ids;
    } catch {
      return [];
    }
  }

  async clearRecentlyViewed(): Promise<void> {
    try {
      await AsyncStorage.setItem(STORE_KEYS.RECENTLY_VIEWED, JSON.stringify([]));
    } catch (e) {
      console.warn('Failed to clear recently viewed:', e);
    }
  }

  async getRecentSearches(): Promise<string[]> {
    try {
      const data = await AsyncStorage.getItem(STORE_KEYS.RECENT_SEARCHES);
      return data
        ? JSON.parse(data)
        : ['Roadster T-Shirt', 'Sneakers', 'Denim Jacket', 'Kurta Set', 'Serum'];
    } catch {
      return [];
    }
  }

  async addRecentSearch(query: string): Promise<string[]> {
    const trimmed = query.trim();
    if (!trimmed) return await this.getRecentSearches();

    try {
      let searches = await this.getRecentSearches();
      searches = [
        trimmed,
        ...searches.filter((s) => s.toLowerCase() !== trimmed.toLowerCase()),
      ].slice(0, 8);
      await AsyncStorage.setItem(
        STORE_KEYS.RECENT_SEARCHES,
        JSON.stringify(searches)
      );
      return searches;
    } catch {
      return [];
    }
  }

  async removeRecentSearch(query: string): Promise<string[]> {
    try {
      let searches = await this.getRecentSearches();
      searches = searches.filter(
        (s) => s.toLowerCase() !== query.toLowerCase()
      );
      await AsyncStorage.setItem(
        STORE_KEYS.RECENT_SEARCHES,
        JSON.stringify(searches)
      );
      return searches;
    } catch {
      return [];
    }
  }

  async clearRecentSearches(): Promise<void> {
    try {
      await AsyncStorage.setItem(
        STORE_KEYS.RECENT_SEARCHES,
        JSON.stringify([])
      );
    } catch (e) {
      console.warn('Failed to clear searches:', e);
    }
  }

  /* ========================================================
   * 5. REAL-TIME RAZORPAY PAYMENT METHODS
   * ======================================================== */

  async getRazorpayKey(): Promise<string> {
    try {
      const res = await fetch(`${getApiBaseUrl()}/payment/key`);
      if (res.ok) {
        const data = await res.json();
        return data.keyId || 'rzp_test_placeholder';
      }
    } catch {}
    return 'rzp_test_placeholder';
  }

  async createRazorpayOrder(amount: number, receipt?: string): Promise<{
    success: boolean;
    orderId: string;
    amount: number;
    currency: string;
    keyId: string;
    isLive?: boolean;
    error?: string;
  }> {
    try {
      const res = await fetch(`${getApiBaseUrl()}/payment/create-order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount, receipt }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        return data;
      }
      return { success: false, orderId: '', amount: 0, currency: 'INR', keyId: '', error: data.error };
    } catch (err: any) {
      return {
        success: false,
        orderId: '',
        amount: 0,
        currency: 'INR',
        keyId: '',
        error: err?.message || 'Payment network error',
      };
    }
  }

  async verifyRazorpayPayment(
    orderId: string,
    paymentId: string,
    signature: string
  ): Promise<{ success: boolean; verified: boolean; error?: string }> {
    try {
      const res = await fetch(`${getApiBaseUrl()}/payment/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          razorpay_order_id: orderId,
          razorpay_payment_id: paymentId,
          razorpay_signature: signature,
        }),
      });
      const data = await res.json();
      return { success: res.ok && data.success, verified: Boolean(data.verified), error: data.error };
    } catch (err: any) {
      return { success: false, verified: false, error: err?.message };
    }
  }
}

export const storeService = new StoreService();
