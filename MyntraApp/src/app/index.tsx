import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Image,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AuthModal } from '@/components/myntra/auth/AuthModal';
import { BottomNav, TabKey } from '@/components/myntra/BottomNav';
import { CategoriesScreen } from '@/components/myntra/CategoriesScreen';
import { CategoryList } from '@/components/myntra/CategoryList';
import { FilterModal } from '@/components/myntra/FilterModal';
import { BankOffersModal } from '@/components/myntra/BankOffersModal';
import { GuestProfileScreen } from '@/components/myntra/GuestProfileScreen';
import { Header } from '@/components/myntra/Header';
import { InsiderModal } from '@/components/myntra/InsiderModal';
import { NotificationsModal } from '@/components/myntra/NotificationsModal';
import { ProductGrid } from '@/components/myntra/ProductGrid';
import { ProductModal } from '@/components/myntra/ProductModal';
import { ProfileScreen } from '@/components/myntra/ProfileScreen';
import { PromoBanner } from '@/components/myntra/PromoBanner';
import { RecentlyViewedSection } from '@/components/myntra/RecentlyViewedSection';
import { YouMayAlsoLikeSection } from '@/components/myntra/YouMayAlsoLikeSection';
import { SearchBar } from '@/components/myntra/SearchBar';
import { SearchModal } from '@/components/myntra/SearchModal';
import { ShoppingBagModal } from '@/components/myntra/ShoppingBagModal';
import { VisualSearchModal } from '@/components/myntra/VisualSearchModal';
import { VoiceSearchModal } from '@/components/myntra/VoiceSearchModal';
import { WishlistScreen } from '@/components/myntra/WishlistScreen';
import { MyntraColors, Spacing } from '@/constants/myntra-theme';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/hooks/use-theme';
import {
  BrandSpotlight,
  Category,
  CATEGORIES,
  CURATED_COLLECTIONS,
  CuratedCollection,
  Product,
  PRODUCTS,
  PROMO_BANNERS,
  PromoBannerData,
  TOP_BRANDS,
} from '@/data/mock-data';
import { pushNotificationService } from '@/services/push-notification-service';
import { storeService } from '@/services/store-service';
import { CartItem, FilterState, Order, RecommendationProduct } from '@/types/store';

const DEFAULT_FILTERS: FilterState = {
  brands: [],
  sizes: [],
  colors: [],
  sortBy: 'recommended',
};

export default function HomeScreen() {
  const { colors, isDark } = useTheme();
  const { width } = useWindowDimensions();
  const isDesktop = Platform.OS === 'web' && width >= 768;

  // Authentication State
  const {
    user,
    isAuthenticated,
    logout,
    updateUser,
    isAuthModalVisible,
    openAuthModal,
    closeAuthModal,
  } = useAuth();

  // Authentication Modal Mode ('login' or 'signup')
  const [authModalMode, setAuthModalMode] = useState<'login' | 'signup'>('login');

  const handleOpenLogin = () => {
    setAuthModalMode('login');
    openAuthModal();
  };

  const handleOpenSignUp = () => {
    setAuthModalMode('signup');
    openAuthModal();
  };

  // Navigation & View State
  const [activeTab, setActiveTab] = useState<TabKey>('home');

  // Search & Filtering State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState('all');
  const [filterState, setFilterState] = useState<FilterState>(DEFAULT_FILTERS);
  const [filterModalTab, setFilterModalTab] = useState<
    'sort' | 'category' | 'brand' | 'price' | 'discount' | 'rating' | 'size'
  >('sort');
  const [isFilterModalVisible, setIsFilterModalVisible] = useState(false);
  const [isSearchModalVisible, setIsSearchModalVisible] = useState(false);

  // Real-time Persistent State
  const [wishlistIds, setWishlistIds] = useState<Set<string>>(new Set());
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [savedForLaterItems, setSavedForLaterItems] = useState<CartItem[]>([]);
  const [recentlyViewedIds, setRecentlyViewedIds] = useState<string[]>([]);
  const [isRecentLoading, setIsRecentLoading] = useState<boolean>(false);
  const [recentError, setRecentError] = useState<string | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [isBagModalVisible, setIsBagModalVisible] = useState<boolean>(false);
  const [openOrdersDirectly, setOpenOrdersDirectly] = useState<boolean>(false);

  // Task 6: Personalized Recommendations State
  const [recommendations, setRecommendations] = useState<RecommendationProduct[]>([]);
  const [isRecsLoading, setIsRecsLoading] = useState<boolean>(false);
  const [recsError, setRecsError] = useState<string | null>(null);
  const [recsPersonalized, setRecsPersonalized] = useState<boolean>(false);
  const [recsTitle, setRecsTitle] = useState<string>('YOU MAY ALSO LIKE');
  const [recsSubtitle, setRecsSubtitle] = useState<string>('');

  // Modal & Toast States
  const [activeProductModal, setActiveProductModal] = useState<Product | null>(
    null
  );
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const showToast = useCallback((message: string) => {
    setToastMessage(message);
    setTimeout(() => {
      setToastMessage(null);
    }, 2400);
  }, []);
  const [isVisualSearchVisible, setIsVisualSearchVisible] = useState<boolean>(false);
  const [isVoiceSearchVisible, setIsVoiceSearchVisible] = useState<boolean>(false);
  const [isBankOffersVisible, setIsBankOffersVisible] = useState<boolean>(false);
  const [isInsiderVisible, setIsInsiderVisible] = useState<boolean>(false);
  const [isNotificationsModalVisible, setIsNotificationsModalVisible] = useState<boolean>(false);
  const [unreadNotificationCount, setUnreadNotificationCount] = useState<number>(0);
  const handleUnreadCountChange = useCallback((count: number) => {
    setUnreadNotificationCount(count);
  }, []);

  // Real-time Push Notifications & Unread Count Sync
  useEffect(() => {
    let isMounted = true;

    // 1. Initial unread notification count
    const loadUnreadCount = async () => {
      if (!isAuthenticated || !user?.id) {
        if (isMounted) {
          setUnreadNotificationCount(0);
        }
        return;
      }
      try {
        const count = await storeService.fetchUnreadNotificationCount();
        if (isMounted) {
          setUnreadNotificationCount(count);
        }
      } catch (e) {
        console.warn('Failed to load initial unread notification count:', e);
      }
    };
    loadUnreadCount();

    // 2. Register push token if user is logged in
    if (isAuthenticated && user?.id) {
      pushNotificationService
        .registerForPushNotificationsAsync()
        .then(async ({ token }) => {
          if (token && isMounted) {
            const details = pushNotificationService.getDeviceDetails();
            await storeService.registerDeviceToken(token, details);
            await storeService.syncNotificationPreferencesOnLogin();
          }
        })
        .catch((e) => console.warn('Push registration warning:', e));
    }

    // 3. Foreground push notification listener
    const notifSub = pushNotificationService.addNotificationReceivedListener((notification) => {
      if (!isMounted) return;
      setUnreadNotificationCount((prev) => prev + 1);
      const title = notification.request.content.title;
      if (title) {
        showToast(`🔔 ${title}`);
      }
    });

    // 4. Notification tap listener (background & foreground)
    const responseSub = pushNotificationService.addNotificationResponseReceivedListener((response) => {
      if (!isMounted) return;
      const data = response.notification.request.content.data;
      if (!data) return;

      if (data.category === 'order' || data.orderId) {
        setActiveTab('profile');
        setOpenOrdersDirectly(true);
      } else if (data.category === 'wishlist' || data.productId) {
        const targetProd = PRODUCTS.find((p) => p.id === data.productId);
        if (targetProd) setActiveProductModal(targetProd);
      } else if (data.category === 'cart') {
        setIsBagModalVisible(true);
      } else if (data.category === 'promotion') {
        setIsBankOffersVisible(true);
      }
    });

    // 5. Cold start notification tap handling
    pushNotificationService.getLastNotificationResponse().then((res) => {
      if (res && isMounted) {
        const data = res.notification.request.content.data;
        if (data?.category === 'order' || data?.orderId) {
          setActiveTab('profile');
          setOpenOrdersDirectly(true);
        } else if (data?.productId) {
          const targetProd = PRODUCTS.find((p) => p.id === data.productId);
          if (targetProd) setActiveProductModal(targetProd);
        }
      }
    });

    return () => {
      isMounted = false;
      notifSub.remove();
      responseSub.remove();
    };
  }, [isAuthenticated, user?.id, showToast]);

  // Live Backend API Catalog State
  const [apiCategories, setApiCategories] = useState<Category[]>(CATEGORIES);
  const [apiProducts, setApiProducts] = useState<Product[]>(PRODUCTS);
  const [apiBanners, setApiBanners] = useState<PromoBannerData[]>(PROMO_BANNERS);
  const [apiCollections, setApiCollections] = useState<CuratedCollection[]>(CURATED_COLLECTIONS);
  const [apiBrands, setApiBrands] = useState<BrandSpotlight[]>(TOP_BRANDS);
  // 1. Fetch real Home Screen data from GET /api/home on startup
  useEffect(() => {
    let isMounted = true;
    const loadHomeData = async () => {
      try {
        const homeData = await storeService.fetchHomeData();
        if (isMounted) {
          if (homeData.categories?.length > 0) {
            setApiCategories(homeData.categories);
          }
          if (homeData.banners?.length > 0) {
            setApiBanners(homeData.banners);
          }
          if (homeData.curatedCollections?.length > 0) {
            setApiCollections(homeData.curatedCollections);
          }
          if (homeData.topBrands?.length > 0) {
            setApiBrands(homeData.topBrands);
          }
          // Combine products from API
          const allHomeProducts = [
            ...(homeData.featuredProducts || []),
            ...(homeData.trendingProducts || []),
            ...(homeData.dealOfDayProducts || []),
          ];
          if (allHomeProducts.length > 0) {
            const map = new Map<string, Product>();
            PRODUCTS.forEach((p) => map.set(p.id, p));
            allHomeProducts.forEach((p) => map.set(p.id, p));
            setApiProducts(Array.from(map.values()));
          }
        }
      } catch (err) {
        console.warn('Error loading home API data:', err);
      }
    };

    loadHomeData();
    return () => {
      isMounted = false;
    };
  }, []);

  // 2. Fetch Category Products when a specific category ID is selected from GET /api/categories/:id/products
  useEffect(() => {
    let isMounted = true;
    if (!selectedCategoryId || selectedCategoryId === 'all') return;

    const loadCategoryProducts = async () => {
      try {
        const catProducts = await storeService.fetchCategoryProducts(selectedCategoryId);
        if (isMounted && catProducts.length > 0) {
          setApiProducts((prev) => {
            const map = new Map<string, Product>();
            prev.forEach((p) => map.set(p.id, p));
            catProducts.forEach((p) => map.set(p.id, p));
            return Array.from(map.values());
          });
        }
      } catch (err) {
        console.warn('Error fetching category products from API:', err);
      }
    };

    loadCategoryProducts();
    return () => {
      isMounted = false;
    };
  }, [selectedCategoryId]);

  // Live Deals of the Day Countdown Timer
  const [countdown, setCountdown] = useState({
    hours: '07',
    minutes: '42',
    seconds: '19',
  });

  useEffect(() => {
    const updateCountdown = () => {
      const now = new Date();
      const endOfDay = new Date();
      endOfDay.setHours(23, 59, 59, 999);
      const diff = Math.max(0, endOfDay.getTime() - now.getTime());

      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff / (1000 * 60)) % 60);
      const seconds = Math.floor((diff / 1000) % 60);

      setCountdown({
        hours: hours.toString().padStart(2, '0'),
        minutes: minutes.toString().padStart(2, '0'),
        seconds: seconds.toString().padStart(2, '0'),
      });
    };

    updateCountdown();
    const timer = setInterval(updateCountdown, 1000);
    return () => clearInterval(timer);
  }, []);

  // Track previous userId to detect login, logout, or account switch
  const prevUserIdRef = useRef<string | null | undefined>(undefined);

  // Synchronize and load real-time user data cleanly with complete isolation on auth change
  useEffect(() => {
    let isMounted = true;

    // Immediately reset private state if user logged out or changed account to prevent stale data flash
    if (prevUserIdRef.current !== undefined && prevUserIdRef.current !== user?.id) {
      queueMicrotask(() => {
        if (!isMounted) return;
        setWishlistIds(new Set());
        setCartItems([]);
        setSavedForLaterItems([]);
        setRecentlyViewedIds([]);
        setOrders([]);
        setUnreadNotificationCount(0);
        setRecommendations([]);
      });
    }
    prevUserIdRef.current = user?.id || null;

    const syncAndLoadUserData = async () => {
      setIsRecentLoading(true);
      setRecentError(null);

      try {
        if (user?.id) {
          // User is authenticated:
          // 1. Safely merge any guest cart, wishlist, and recently viewed into user's account
          const [mergedWishlist, mergedBagResult, mergedRecent, userOrders] = await Promise.all([
            storeService.mergeGuestWishlist(user.id),
            storeService.mergeGuestCart(user.id),
            storeService.mergeGuestRecentlyViewed(user.id),
            storeService.getOrders(user.id),
          ]);

          if (isMounted) {
            setWishlistIds(new Set(mergedWishlist));
            setCartItems(mergedBagResult.cart);
            setSavedForLaterItems(mergedBagResult.savedForLater);
            setRecentlyViewedIds(mergedRecent);
            if (Array.isArray(userOrders)) {
              setOrders(userOrders);
            }
          }
        } else {
          // Guest mode: unauthenticated visitors have empty wishlist and empty cart
          storeService.clearWishlist().catch(() => {});
          storeService.clearCart().catch(() => {});
          if (isMounted) {
            setWishlistIds(new Set());
            setCartItems([]);
            setSavedForLaterItems([]);
            setRecentlyViewedIds([]);
            setOrders([]); // Guests have zero orders
          }
        }
      } catch (e) {
        console.warn('Failed to load storage data:', e);
        if (isMounted) {
          setRecentError('Unable to load recently viewed products');
        }
      } finally {
        if (isMounted) {
          setIsRecentLoading(false);
        }
      }
    };

    syncAndLoadUserData();

    return () => {
      isMounted = false;
    };
  }, [user?.id]);

  // Real-time catalog stock and order updates subscription via SSE (strictly isolated to authenticated user)
  useEffect(() => {
    const unsubscribe = storeService.subscribeToRealtimeUpdates({
      onStockUpdate: ({ productId, stockCount, inStock }) => {
        setApiProducts((prev) =>
          prev.map((prod) =>
            prod.id === productId ? { ...prod, stockCount, inStock } : prod
          )
        );
      },
      onOrderUpdate: ({ orderId, status, paymentStatus }) => {
        setOrders((prev) =>
          prev.map((ord) =>
            ord.id === orderId
              ? {
                  ...ord,
                  status: (status as any) || ord.status,
                  paymentStatus: (paymentStatus as any) || ord.paymentStatus,
                }
              : ord
          )
        );
      },
      onNotification: (data: any) => {
        const notif = data?.notification;
        // Strictly verify notification is meant for the logged-in user
        if (user?.id && (!notif?.userId || notif.userId === user.id)) {
          setUnreadNotificationCount((prev) => prev + 1);
          if (notif?.title) {
            showToast(`🔔 ${notif.title}`);
          }
        }
      },
    });

    return () => {
      unsubscribe();
    };
  }, [user?.id, isAuthenticated, showToast]);

  // Compute total real-time quantity of items in bag
  const bagCount = useMemo(() => {
    return cartItems.reduce((acc, item) => acc + item.quantity, 0);
  }, [cartItems]);

  // Open product details modal and record recently viewed (with fresh API fetch by product ID)
  const handleOpenProduct = useCallback(async (product: Product) => {
    setActiveProductModal(product);

    // Track recently viewed product in background without blocking modal UI
    storeService.addRecentlyViewed(product.id, user?.id)
      .then((updated) => {
        if (Array.isArray(updated)) {
          setRecentlyViewedIds((prev) => {
            if (prev.length === updated.length && prev[0] === updated[0]) return prev;
            return updated;
          });
        }
      })
      .catch((e) => {
        console.warn('Failed to add recently viewed product:', e);
      });

    // Fetch freshest product details from backend by actual ID
    try {
      const fresh = await storeService.fetchProductById(product.id);
      if (fresh) {
        setActiveProductModal((current) => (current?.id === fresh.id ? fresh : current));
      }
    } catch {}
  }, [user]);

  // Real-time persistent Wishlist toggle with API integration and rollback
  const handleToggleWishlist = async (product: Product) => {
    if (!isAuthenticated || !user) {
      handleOpenLogin();
      showToast('Please log in to add items to your Wishlist ❤️');
      return;
    }

    const prevIds = new Set(wishlistIds);
    const updated = new Set(wishlistIds);
    const isAdding = !updated.has(product.id);

    if (isAdding) {
      updated.add(product.id);
      showToast('Added to Wishlist ❤️');
    } else {
      updated.delete(product.id);
      showToast('Removed from Wishlist');
    }

    // Optimistic UI update immediately across all screens
    setWishlistIds(updated);

    try {
      let finalIds: string[];
      if (isAdding) {
        finalIds = await storeService.addToWishlist(product.id, user?.id);
      } else {
        finalIds = await storeService.removeFromWishlist(product.id, user?.id);
      }
      if (Array.isArray(finalIds)) {
        setWishlistIds(new Set(finalIds));
      }
    } catch (e) {
      // Revert if saving fails
      setWishlistIds(prevIds);
      showToast('Unable to update wishlist. Reverted.');
      console.warn('Failed to persist wishlist:', e);
    }
  };

  // Move item from Wishlist to Shopping Bag with verified size and color
  const handleMoveWishlistToBag = async (
    product: Product,
    size: string,
    color?: string
  ) => {
    if (!isAuthenticated || !user) {
      handleOpenLogin();
      showToast('Please log in to add items to your Bag 🛍️');
      return;
    }

    try {
      // 1. Add to Bag first
      const updatedCart = await storeService.addToCart(product, size, color, 1, user?.id);
      setCartItems(updatedCart);

      // 2. Remove from Wishlist only after bag addition succeeds
      const updatedWishlist = new Set(wishlistIds);
      updatedWishlist.delete(product.id);
      setWishlistIds(updatedWishlist);
      await storeService.saveWishlist(Array.from(updatedWishlist), user?.id);

      showToast(`Moved "${product.name}" (${size}) to Bag 🛍️`);
    } catch (e) {
      showToast('Could not move item to Bag. Please try again.');
      console.warn('Move to bag error:', e);
    }
  };

  // Clear all items in wishlist with confirmation
  const handleClearWishlist = async () => {
    if (!isAuthenticated || !user) {
      handleOpenLogin();
      return;
    }

    try {
      await storeService.clearWishlist(user?.id);
      setWishlistIds(new Set());
      showToast('Wishlist cleared');
    } catch (e) {
      showToast('Failed to clear wishlist');
      console.warn('Clear wishlist error:', e);
    }
  };

  // Real-time persistent Add to Bag from ProductModal or Catalog
  const handleAddToBag = async (
    product: Product,
    size: string,
    color?: string,
    quantity: number = 1
  ) => {
    if (!isAuthenticated || !user) {
      handleOpenLogin();
      showToast('Please log in to add items to your Bag 🛍️');
      return;
    }

    const updated = await storeService.addToCart(product, size, color, quantity, user?.id);
    setCartItems(updated);
    showToast(`Added "${product.name}" (${size}) to Bag 🛍️`);
  };

  // Instant Buy Now: Add to bag and open bag checkout modal
  const handleBuyNow = async (
    product: Product,
    size: string,
    color?: string,
    quantity: number = 1
  ) => {
    if (!isAuthenticated || !user) {
      handleOpenLogin();
      showToast('Please log in to purchase items 🛍️');
      return;
    }

    const updated = await storeService.addToCart(product, size, color, quantity, user?.id);
    setCartItems(updated);
    setActiveProductModal(null);
    setIsBagModalVisible(true);
    showToast(`Added "${product.name}" (${size}) to Bag 🛍️`);
  };

  // Real-time Cart Quantity Stepper
  const handleUpdateCartQuantity = async (
    cartItemId: string,
    newQty: number
  ) => {
    if (!isAuthenticated || !user) {
      handleOpenLogin();
      return;
    }
    const updated = await storeService.updateCartQuantity(cartItemId, newQty, user?.id);
    setCartItems(updated);
  };

  // Real-time Cart Item Removal
  const handleRemoveCartItem = async (cartItemId: string) => {
    if (!isAuthenticated || !user) return;
    const updated = await storeService.removeFromCart(cartItemId, user?.id);
    setCartItems(updated);
    showToast('Item removed from Bag');
  };

  // Quick Add to Bag from Recently Viewed / Product Cards
  const handleQuickAddToBag = async (product: Product) => {
    if (!isAuthenticated || !user) {
      handleOpenLogin();
      showToast('Please log in to add items to your Bag 🛍️');
      return;
    }
    const size = product.sizes && product.sizes.length > 0 ? product.sizes[0] : 'Free Size';
    const color = product.colors && product.colors.length > 0 ? product.colors[0] : undefined;
    await handleAddToBag(product, size, color, 1);
  };

  // Clear Recently Viewed History
  const handleClearRecentlyViewed = async () => {
    try {
      await storeService.clearRecentlyViewed(user?.id);
      setRecentlyViewedIds([]);
      showToast('Recently viewed history cleared');
    } catch {
      showToast('Could not clear history');
    }
  };

  // Retry loading recently viewed
  const handleRetryRecentlyViewed = async () => {
    setIsRecentLoading(true);
    setRecentError(null);
    try {
      const ids = await storeService.getRecentlyViewed(user?.id);
      setRecentlyViewedIds(ids);
    } catch {
      setRecentError('Unable to sync recently viewed');
    } finally {
      setIsRecentLoading(false);
    }
  };

  // Load Personalized Recommendations
  const loadRecommendations = useCallback(async () => {
    setIsRecsLoading(true);
    setRecsError(null);
    try {
      const res = await storeService.fetchRecommendations({
        limit: 10,
        userId: user?.id,
      });
      if (res && res.success && Array.isArray(res.products)) {
        setRecommendations(res.products);
        setRecsPersonalized(res.isPersonalized);
        setRecsTitle(res.title || 'YOU MAY ALSO LIKE');
        setRecsSubtitle(res.subtitle || '');
      }
    } catch (e: any) {
      console.warn('Failed to load recommendations:', e);
      setRecsError('Could not load recommended styles');
    } finally {
      setIsRecsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    let isMounted = true;
    storeService
      .fetchRecommendations({
        limit: 10,
        userId: user?.id,
      })
      .then((res) => {
        if (isMounted && res && res.success && Array.isArray(res.products)) {
          setRecommendations(res.products);
          setRecsPersonalized(res.isPersonalized);
          setRecsTitle(res.title || 'YOU MAY ALSO LIKE');
          setRecsSubtitle(res.subtitle || '');
        }
      })
      .catch((e) => {
        if (isMounted) {
          console.warn('Failed to load recommendations:', e);
          setRecsError('Could not load recommended styles');
        }
      });

    return () => {
      isMounted = false;
    };
  }, [user?.id]);

  // Move item from Shopping Bag to Wishlist
  const handleMoveCartItemToWishlist = async (cartItem: CartItem) => {
    if (!isAuthenticated || !user) {
      handleOpenLogin();
      showToast('Please log in to add items to your Wishlist ❤️');
      return;
    }

    try {
      // 1. Add product to Wishlist first
      const updatedWishlist = new Set(wishlistIds);
      updatedWishlist.add(cartItem.productId);
      setWishlistIds(updatedWishlist);
      await storeService.saveWishlist(Array.from(updatedWishlist), user?.id);

      // 2. Remove from Bag only after Wishlist persistence succeeds
      const updatedCart = await storeService.removeFromCart(cartItem.id, user?.id);
      setCartItems(updatedCart);

      showToast(`Moved "${cartItem.product.name}" to Wishlist ❤️`);
    } catch (e) {
      showToast('Could not move to Wishlist. Please try again.');
      console.warn('Move to wishlist error:', e);
    }
  };

  // Real-time update of variant (size or color) in Shopping Bag
  const handleUpdateCartItemVariant = async (
    cartItemId: string,
    newSize: string,
    newColor?: string
  ) => {
    try {
      const updated = await storeService.updateCartItemVariant(
        cartItemId,
        newSize,
        newColor,
        user?.id
      );
      setCartItems(updated);
      showToast(`Updated to Size ${newSize}`);
    } catch (e) {
      showToast('Failed to update size');
      console.warn('Update variant error:', e);
    }
  };

  // Clear all items in Shopping Bag
  const handleClearCart = async () => {
    try {
      await storeService.clearCart(user?.id);
      setCartItems([]);
      showToast('Shopping Bag cleared');
    } catch (e) {
      showToast('Failed to clear Shopping Bag');
      console.warn('Clear bag error:', e);
    }
  };

  // Save active bag item for later
  const handleSaveCartItemForLater = async (cartItemId: string) => {
    try {
      const res = await storeService.saveForLater(cartItemId, user?.id);
      setCartItems(res.cart);
      setSavedForLaterItems(res.savedForLater);
      showToast('Moved to Save for Later 📌');
    } catch (e: any) {
      showToast(e.message || 'Failed to save for later');
    }
  };

  // Move item from Save for Later back to Shopping Bag
  const handleMoveSavedItemToBag = async (savedItemId: string) => {
    try {
      const res = await storeService.moveToCartFromSaved(savedItemId, user?.id);
      setCartItems(res.cart);
      setSavedForLaterItems(res.savedForLater);
      showToast('Moved back to Shopping Bag 🛍️');
    } catch (e: any) {
      showToast(e.message || 'Failed to restore to bag');
    }
  };

  // Remove item from Save for Later
  const handleRemoveSavedItem = async (savedItemId: string) => {
    try {
      const updatedSaved = await storeService.removeFromSavedForLater(savedItemId, user?.id);
      setSavedForLaterItems(updatedSaved);
      showToast('Removed from Save for Later');
    } catch (e: any) {
      showToast(e.message || 'Failed to remove saved item');
    }
  };

  // Refresh shopping bag and saved items from trusted backend API
  const handleRefreshBag = async () => {
    try {
      const [freshBag, freshSaved] = await Promise.all([
        storeService.getCart(user?.id),
        storeService.getSavedForLater(user?.id),
      ]);
      setCartItems(freshBag);
      setSavedForLaterItems(freshSaved);
      showToast('Bag updated with latest prices & stock ✓');
    } catch {
      showToast('Could not refresh bag');
    }
  };

  // Filter products based on search query, horizontal category, and multi-facet filter modal
  const filteredProducts = useMemo(() => {
    const list = apiProducts.filter((item) => {
      // 1. Horizontal category pills filter
      if (
        selectedCategoryId !== 'all' &&
        item.category.toLowerCase() !== selectedCategoryId.toLowerCase()
      ) {
        return false;
      }

      // 2. Filter modal category filter
      if (filterState.category && item.category !== filterState.category) {
        return false;
      }

      // 3. Search query filter (matches brand, name, category, or subcategory)
      const query = searchQuery.trim().toLowerCase();
      if (query !== '') {
        const matchesQuery =
          item.name.toLowerCase().includes(query) ||
          item.brand.toLowerCase().includes(query) ||
          item.category.toLowerCase().includes(query) ||
          item.subcategory.toLowerCase().includes(query);
        if (!matchesQuery) return false;
      }

      // 4. Brands filter
      if (filterState.brands && filterState.brands.length > 0) {
        if (!filterState.brands.includes(item.brand)) return false;
      }

      // 5. Price range filter
      if (filterState.priceRange) {
        if (
          item.price < filterState.priceRange[0] ||
          item.price > filterState.priceRange[1]
        ) {
          return false;
        }
      }

      // 6. Minimum discount percent
      if (filterState.minDiscount !== undefined && filterState.minDiscount > 0) {
        if (item.discountPercent < filterState.minDiscount) return false;
      }

      // 7. Minimum customer rating
      if (filterState.minRating !== undefined && filterState.minRating > 0) {
        if (item.rating < filterState.minRating) return false;
      }

      // 8. Size availability
      if (filterState.sizes && filterState.sizes.length > 0) {
        const hasMatchingSize = item.sizes.some((s) =>
          filterState.sizes.includes(s)
        );
        if (!hasMatchingSize) return false;
      }

      return true;
    });

    // Apply sorting
    const sortBy = filterState.sortBy || 'recommended';
    return [...list].sort((a, b) => {
      if (sortBy === 'price_low_high') return a.price - b.price;
      if (sortBy === 'price_high_low') return b.price - a.price;
      if (sortBy === 'rating') return b.rating - a.rating;
      if (sortBy === 'newest')
        return (b.isNewArrival ? 1 : 0) - (a.isNewArrival ? 1 : 0);
      return 0; // recommended
    });
  }, [apiProducts, searchQuery, selectedCategoryId, filterState]);

  // Wishlist products for the Wishlist tab
  const wishlistProducts = useMemo(() => {
    return apiProducts.filter((item) => wishlistIds.has(item.id));
  }, [apiProducts, wishlistIds]);

  // Deals of the Day products
  const dealProducts = useMemo(() => {
    return apiProducts.filter((p) => p.isDealOfDay || p.discountPercent >= 50);
  }, [apiProducts]);

  // Purchased product IDs from user's order history
  const purchasedProductIds = useMemo(() => {
    const ids = new Set<string>();
    orders.forEach((order) => {
      order.items?.forEach((item) => {
        if (item.productId) ids.add(item.productId);
        if (item.product?.id) ids.add(item.product.id);
      });
    });
    return ids;
  }, [orders]);

  // Recently viewed products (deduplicated, newest-first, invalid/out-of-stock filtered)
  const recentlyViewedProducts = useMemo(() => {
    const seen = new Set<string>();
    const list: Product[] = [];
    for (const id of recentlyViewedIds) {
      if (!seen.has(id)) {
        seen.add(id);
        const found = apiProducts.find((p) => p.id === id);
        if (found && found.inStock !== false) {
          list.push(found);
        }
      }
    }
    return list;
  }, [recentlyViewedIds, apiProducts]);

  // Continue shopping products (recently viewed products that user has not yet purchased)
  const continueShoppingProducts = useMemo(() => {
    if (purchasedProductIds.size === 0) return [];
    return recentlyViewedProducts.filter((p) => !purchasedProductIds.has(p.id));
  }, [recentlyViewedProducts, purchasedProductIds]);

  // Available brands for filter modal
  const availableBrands = useMemo(() => {
    return Array.from(new Set(apiProducts.map((p) => p.brand))).sort();
  }, [apiProducts]);

  // Applied filter count for badge
  const appliedFilterCount = useMemo(() => {
    let count = 0;
    if (filterState.category) count++;
    if (filterState.brands && filterState.brands.length > 0)
      count += filterState.brands.length;
    if (filterState.priceRange) count++;
    if (filterState.minDiscount) count++;
    if (filterState.minRating) count++;
    if (filterState.sizes && filterState.sizes.length > 0)
      count += filterState.sizes.length;
    if (filterState.sortBy && filterState.sortBy !== 'recommended') count++;
    return count;
  }, [filterState]);

  // Reset search and category filters
  const handleResetFilters = () => {
    setSearchQuery('');
    setSelectedCategoryId('all');
    setFilterState(DEFAULT_FILTERS);
  };

  // Handle category selection from horizontal slider
  const handleSelectCategory = (cat: Category) => {
    setSelectedCategoryId(cat.id);
    setSearchQuery(''); // Clear search query so products in this category aren't blocked
    setFilterState(DEFAULT_FILTERS); // Reset stale filters
    if (activeTab !== 'home') {
      setActiveTab('home');
    }
  };

  // Handle banner click
  const handlePressBanner = (banner: PromoBannerData) => {
    showToast(`Coupon ${banner.code} activated for ${banner.discount}!`);
  };

  // Handle subcategory click from Categories screen
  const handleSelectSubcategory = (mainCat: string, sub: string) => {
    setSelectedCategoryId(mainCat.toLowerCase());
    setFilterState(DEFAULT_FILTERS);

    const subLower = sub.toLowerCase();
    const matchingProducts = apiProducts.filter(
      (p) =>
        p.category.toLowerCase() === mainCat.toLowerCase() &&
        (p.subcategory.toLowerCase().includes(subLower) ||
          subLower.includes(p.subcategory.toLowerCase()) ||
          p.name.toLowerCase().includes(subLower))
    );

    if (matchingProducts.length > 0) {
      setSearchQuery(sub);
      showToast(`Showing ${matchingProducts.length} items in ${sub}`);
    } else {
      // Fallback gracefully so the screen never displays an empty dead state
      setSearchQuery('');
      showToast(`Showing trending ${mainCat} collection`);
    }

    setActiveTab('home');
  };

  // Curated collection click handler
  const handleSelectCollection = (col: CuratedCollection) => {
    if (col.filterCategory) {
      setSelectedCategoryId(col.filterCategory.toLowerCase());
    }
    if (col.filterSubcategory) {
      setSearchQuery(col.filterSubcategory);
    } else {
      setSearchQuery('');
    }
    showToast(`Exploring "${col.title}"`);
  };

  // Brand spotlight click handler
  const handleSelectBrand = (brand: BrandSpotlight) => {
    setFilterState((prev) => ({
      ...prev,
      brands: [brand.name],
    }));
    showToast(`Filtering by ${brand.name} (${brand.offer})`);
  };

  // Current active category title for filter indicator
  const activeCategoryTitle = useMemo(() => {
    if (searchQuery.trim().length > 0) {
      return `"${searchQuery}"`;
    }
    if (selectedCategoryId !== 'all') {
      return selectedCategoryId.toUpperCase();
    }
    if (filterState.brands && filterState.brands.length > 0) {
      return filterState.brands.join(', ');
    }
    return undefined;
  }, [searchQuery, selectedCategoryId, filterState]);

  return (
    <View style={[styles.webWrapper, { backgroundColor: colors.background }]}>
      <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.surface }]}>
        <StatusBar
          barStyle={colors.statusBarStyle}
          backgroundColor={colors.surface}
        />

        {/* 1. Global Header */}
        <Header
          wishlistCount={isAuthenticated ? wishlistIds.size : 0}
          bagCount={isAuthenticated ? bagCount : 0}
          notificationCount={unreadNotificationCount}
          isAuthenticated={isAuthenticated}
          userName={user?.name}
          activeTab={activeTab}
          onSelectTab={(tab) => {
            if (tab === 'wishlist' && !isAuthenticated) {
              handleOpenLogin();
              showToast('Please log in to view your Wishlist ❤️');
              return;
            }
            setActiveTab(tab);
          }}
          onPressSearch={() => setIsSearchModalVisible(true)}
          onPressNotifications={() => setIsNotificationsModalVisible(true)}
          onPressProfile={() => {
            if (!isAuthenticated) {
              openAuthModal();
            } else {
              setActiveTab('profile');
            }
          }}
          onPressWishlist={() => {
            if (!isAuthenticated) {
              handleOpenLogin();
              showToast('Please log in to view your Wishlist ❤️');
            } else {
              setActiveTab('wishlist');
            }
          }}
          onPressBag={() => {
            if (!isAuthenticated) {
              handleOpenLogin();
              showToast('Please log in to view your Bag 🛍️');
            } else {
              setIsBagModalVisible(true);
            }
          }}
          onPressLogo={() => {
            handleResetFilters();
            setActiveTab('home');
            showToast('Home refreshed 🛍️');
          }}
          onPressInsider={() => setIsInsiderVisible(true)}
        />

        {/* 2. Main Tab View Switcher */}
        <View style={[styles.contentContainer, { backgroundColor: colors.background }]}>
          {activeTab === 'home' && (
            <ScrollView
              style={[styles.scrollView, { backgroundColor: colors.background }]}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.homeScrollContent}>
              {/* Search Bar - opens interactive SearchModal on click */}
              <SearchBar
                value={searchQuery}
                onChangeText={setSearchQuery}
                onClear={() => setSearchQuery('')}
                onPress={() => setIsSearchModalVisible(true)}
                onPressCamera={() => setIsVisualSearchVisible(true)}
                onPressMic={() => setIsVoiceSearchVisible(true)}
              />

              {/* Bank Offers / Deal Strip - Interactive */}
              <TouchableOpacity
                style={[
                  styles.dealStrip,
                  {
                    backgroundColor: isDark ? colors.surfaceElevated : '#fff0f3',
                    borderColor: isDark ? colors.cardBorder : '#ffd8e2',
                  },
                ]}
                onPress={() => setIsBankOffersVisible(true)}
                activeOpacity={0.8}
                accessibilityLabel="View Bank & Payment Offers">
                <Ionicons
                  name="card-outline"
                  size={14}
                  color={colors.primary}
                />
                <Text style={[styles.dealStripText, { color: colors.text }]}>
                  10% Instant Discount on HDFC & ICICI Cards • Code:{' '}
                  <Text style={styles.dealCode}>MYNTRA10</Text>
                </Text>
                <Ionicons
                  name="chevron-forward"
                  size={14}
                  color={colors.primary}
                />
              </TouchableOpacity>

              {/* Promotional Banner */}
              <PromoBanner banners={apiBanners} onPressBanner={handlePressBanner} />

              {/* Shop by Category (Horizontal Scrollable Cards) */}
              <CategoryList
                categories={apiCategories}
                selectedCategoryId={selectedCategoryId}
                onSelectCategory={handleSelectCategory}
                onExploreAll={() => setActiveTab('categories')}
              />

              {/* Deals of the Day (Live Countdown Timer + Deal Cards) */}
              {dealProducts.length > 0 && (
                <View
                  style={[
                    styles.dealsSection,
                    { backgroundColor: colors.surface },
                  ]}>
                  <View style={styles.dealsHeaderRow}>
                    <View style={styles.dealsTitleCol}>
                      <View style={styles.dealsTitleBadgeRow}>
                        <Ionicons name="flame" size={16} color="#ff3f6c" />
                        <Text style={[styles.dealsTitle, { color: colors.text }]}>
                          DEALS OF THE DAY
                        </Text>
                      </View>
                      <Text style={[styles.dealsSubtitle, { color: colors.textSecondary }]}>
                        Unbeatable prices refreshed daily
                      </Text>
                    </View>

                    {/* Live Countdown Badge */}
                    <View style={styles.countdownPill}>
                      <Ionicons
                        name="time-outline"
                        size={12}
                        color={MyntraColors.white}
                      />
                      <Text style={styles.countdownText}>
                        {countdown.hours}h : {countdown.minutes}m :{' '}
                        {countdown.seconds}s
                      </Text>
                    </View>
                  </View>

                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.horizontalScrollContent}>
                    {dealProducts.map((item) => (
                      <TouchableOpacity
                        key={`deal-${item.id}`}
                        style={[
                          styles.dealCard,
                          {
                            backgroundColor: colors.surfaceSecondary,
                            borderColor: colors.cardBorder,
                          },
                        ]}
                        onPress={() => handleOpenProduct(item)}
                        activeOpacity={0.85}>
                        <Image
                          source={{ uri: item.image }}
                          style={styles.dealImage}
                        />
                        <View style={styles.dealBadge}>
                          <Text style={styles.dealBadgeText}>
                            {item.discountPercent}% OFF
                          </Text>
                        </View>
                        <TouchableOpacity
                          style={styles.dealHeartBtn}
                          onPress={(e) => {
                            e.stopPropagation();
                            handleToggleWishlist(item);
                          }}
                          activeOpacity={0.8}
                          accessibilityLabel="Toggle Wishlist">
                          <Ionicons
                            name={isAuthenticated && wishlistIds.has(item.id) ? 'heart' : 'heart-outline'}
                            size={16}
                            color={isAuthenticated && wishlistIds.has(item.id) ? colors.primary : colors.textSecondary}
                          />
                        </TouchableOpacity>
                        <View style={styles.dealInfo}>
                          <Text
                            style={[styles.dealBrand, { color: colors.text }]}
                            numberOfLines={1}>
                            {item.brand}
                          </Text>
                          <Text
                            style={[styles.dealName, { color: colors.textSecondary }]}
                            numberOfLines={1}>
                            {item.name}
                          </Text>
                          <View style={styles.dealPriceRow}>
                            <Text style={[styles.dealPrice, { color: colors.text }]}>
                              ₹{item.price}
                            </Text>
                            <Text style={[styles.dealOrigPrice, { color: colors.textMuted }]}>
                              ₹{item.originalPrice}
                            </Text>
                          </View>
                        </View>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              )}

              {/* Curated Collections Carousel */}
              <View style={[styles.curatedSection, { backgroundColor: colors.surface }]}>
                <View style={styles.sectionHeaderRow}>
                  <View>
                    <Text style={[styles.curatedTitle, { color: colors.text }]}>
                      CURATED THEMES
                    </Text>
                    <Text style={[styles.curatedSubtitle, { color: colors.textSecondary }]}>
                      Handcrafted edits for every aesthetic
                    </Text>
                  </View>
                  <View style={styles.featuredBadge}>
                    <Text style={styles.featuredBadgeText}>EXPLORE</Text>
                  </View>
                </View>

                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.horizontalScrollContent}>
                  {(apiCollections.length > 0 ? apiCollections : CURATED_COLLECTIONS).map((col) => (
                    <TouchableOpacity
                      key={col.id}
                      style={styles.curatedCard}
                      onPress={() => handleSelectCollection(col)}
                      activeOpacity={0.85}>
                      <Image
                        source={{ uri: col.image }}
                        style={styles.curatedImage}
                      />
                      <View style={styles.curatedOverlay}>
                        <View style={styles.curatedTagPill}>
                          <Text style={styles.curatedTagText}>{col.tag}</Text>
                        </View>
                        <Text style={styles.curatedCardTitle}>{col.title}</Text>
                        <Text style={styles.curatedCardSub} numberOfLines={1}>
                          {col.subtitle}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>

              {/* Top Brands Spotlight Carousel */}
              <View style={[styles.brandsSection, { backgroundColor: colors.surface }]}>
                <View style={styles.sectionHeaderRow}>
                  <View>
                    <Text style={[styles.curatedTitle, { color: colors.text }]}>
                      TOP BRANDS SPOTLIGHT
                    </Text>
                    <Text style={[styles.curatedSubtitle, { color: colors.textSecondary }]}>
                      Official brands with special discounts
                    </Text>
                  </View>
                </View>

                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.horizontalScrollContent}>
                  {(apiBrands.length > 0 ? apiBrands : TOP_BRANDS).map((brand) => (
                    <TouchableOpacity
                      key={brand.id}
                      style={[
                        styles.brandCard,
                        {
                          backgroundColor: colors.surfaceSecondary,
                          borderColor: colors.cardBorder,
                        },
                      ]}
                      onPress={() => handleSelectBrand(brand)}
                      activeOpacity={0.85}>
                      <Image
                        source={{ uri: brand.image }}
                        style={styles.brandImage}
                      />
                      <Text style={[styles.brandName, { color: colors.text }]}>{brand.name}</Text>
                      <View style={styles.brandOfferPill}>
                        <Text style={styles.brandOfferText}>{brand.offer}</Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>

              {/* Recently Viewed & Continue Shopping Section */}
              <RecentlyViewedSection
                products={recentlyViewedProducts}
                continueShoppingProducts={continueShoppingProducts}
                hasPurchaseHistory={purchasedProductIds.size > 0}
                isLoading={isRecentLoading}
                error={recentError}
                wishlistIds={wishlistIds}
                onOpenProduct={handleOpenProduct}
                onToggleWishlist={handleToggleWishlist}
                onQuickAddToBag={handleQuickAddToBag}
                onClearHistory={handleClearRecentlyViewed}
                onRetry={handleRetryRecentlyViewed}
              />

              {/* Task 6: Personalized You May Also Like Section */}
              <YouMayAlsoLikeSection
                products={recommendations}
                isPersonalized={recsPersonalized}
                title={recsTitle}
                subtitle={recsSubtitle}
                isLoading={isRecsLoading}
                error={recsError}
                wishlistIds={isAuthenticated ? wishlistIds : new Set()}
                onOpenProduct={handleOpenProduct}
                onToggleWishlist={handleToggleWishlist}
                onQuickAddToBag={handleQuickAddToBag}
                onRefresh={loadRecommendations}
                onRetry={loadRecommendations}
              />

              {/* Trending Products 2-Column Grid with Sort & Filter Action Bar */}
              <ProductGrid
                products={filteredProducts}
                wishlistIds={isAuthenticated ? wishlistIds : new Set()}
                onToggleWishlist={handleToggleWishlist}
                onPressProduct={handleOpenProduct}
                onResetFilters={handleResetFilters}
                activeFilterTitle={activeCategoryTitle}
                onOpenSort={() => {
                  setFilterModalTab('sort');
                  setIsFilterModalVisible(true);
                }}
                onOpenFilter={() => {
                  setFilterModalTab('category');
                  setIsFilterModalVisible(true);
                }}
                appliedFilterCount={appliedFilterCount}
              />
            </ScrollView>
          )}

          {/* Categories Tab */}
          {activeTab === 'categories' && (
            <CategoriesScreen
              products={apiProducts}
              onSelectSubcategory={handleSelectSubcategory}
              onSelectCategory={(cat) => {
                setSelectedCategoryId(cat.toLowerCase());
                setSearchQuery('');
                setFilterState(DEFAULT_FILTERS);
                setActiveTab('home');
                showToast(`Showing all styles in ${cat}`);
              }}
              onPressProduct={handleOpenProduct}
            />
          )}

          {/* Wishlist Tab */}
          {activeTab === 'wishlist' &&
            (isAuthenticated && user ? (
              <WishlistScreen
                wishlistProducts={wishlistProducts}
                allProducts={apiProducts}
                onRemoveFromWishlist={handleToggleWishlist}
                onMoveToBag={handleMoveWishlistToBag}
                onStartShopping={() => setActiveTab('home')}
                onPressProduct={handleOpenProduct}
                onClearWishlist={handleClearWishlist}
              />
            ) : (
              <View style={[styles.emptyGuestWishlistContainer, { backgroundColor: colors.background }]}>
                <View
                  style={[
                    styles.emptyGuestIconCircle,
                    {
                      backgroundColor: isDark
                        ? 'rgba(255, 63, 108, 0.12)'
                        : 'rgba(255, 63, 108, 0.08)',
                    },
                  ]}>
                  <Ionicons name="heart-dislike-outline" size={54} color={colors.primary} />
                </View>
                <Text style={[styles.emptyGuestWishlistTitle, { color: colors.text }]}>
                  PLEASE LOG IN
                </Text>
                <Text style={[styles.emptyGuestWishlistSub, { color: colors.textSecondary }]}>
                  Login to view items in your wishlist and sync them across all devices.
                </Text>
                <TouchableOpacity
                  style={[styles.guestLoginBtn, { backgroundColor: colors.primary }]}
                  onPress={handleOpenLogin}
                  activeOpacity={0.85}>
                  <Text style={styles.guestLoginBtnText}>LOGIN / SIGN UP</Text>
                </TouchableOpacity>
              </View>
            ))}

          {/* Profile Tab: Switches between Authenticated Profile & Guest Profile */}
          {activeTab === 'profile' &&
            (isAuthenticated && user ? (
              <ProfileScreen
                user={user}
                wishlistCount={wishlistIds.size}
                bagCount={bagCount}
                onGoToWishlist={() => setActiveTab('wishlist')}
                onGoToBag={() => setIsBagModalVisible(true)}
                onGoToHome={() => setActiveTab('home')}
                initialShowOrders={openOrdersDirectly}
                onOrdersClosed={() => setOpenOrdersDirectly(false)}
                onLogout={async () => {
                  await logout();
                  setUnreadNotificationCount(0);
                  showToast('Logged out successfully');
                }}
                onUpdateUser={async (updates) => {
                  const ok = await updateUser(updates);
                  if (ok) {
                    showToast('Profile updated successfully');
                  }
                  return ok;
                }}
              />
            ) : (
              <GuestProfileScreen
                onLoginPress={handleOpenLogin}
                onSignUpPress={handleOpenSignUp}
                onGoToWishlist={() => {
                  handleOpenLogin();
                  showToast('Please log in to view your Wishlist ❤️');
                }}
                onGoToBag={() => {
                  handleOpenLogin();
                  showToast('Please log in to view your Bag 🛍️');
                }}
                wishlistCount={0}
                bagCount={0}
              />
            ))}
        </View>

        {/* 3. Bottom Navigation Bar (Rendered on mobile / Expo Go) */}
        {!isDesktop && (
          <BottomNav
            activeTab={activeTab}
            onSelectTab={(tab) => {
              if (tab === 'wishlist' && !isAuthenticated) {
                handleOpenLogin();
                showToast('Please log in to view your Wishlist ❤️');
                return;
              }
              setActiveTab(tab);
            }}
            wishlistCount={isAuthenticated ? wishlistIds.size : 0}
            bagCount={isAuthenticated ? bagCount : 0}
            onPressBag={() => {
              if (!isAuthenticated) {
                handleOpenLogin();
                showToast('Please log in to view your Bag 🛍️');
              } else {
                setIsBagModalVisible(true);
              }
            }}
          />
        )}

        {/* 4. Product Quick-View Modal */}
        <ProductModal
          product={activeProductModal}
          visible={activeProductModal !== null}
          isWishlisted={
            isAuthenticated && activeProductModal
              ? wishlistIds.has(activeProductModal.id)
              : false
          }
          bagCount={isAuthenticated ? bagCount : 0}
          allProducts={apiProducts}
          onClose={() => setActiveProductModal(null)}
          onToggleWishlist={handleToggleWishlist}
          onAddToBag={handleAddToBag}
          onBuyNow={handleBuyNow}
          onSelectSimilarProduct={handleOpenProduct}
          onOpenBag={() => {
            if (!isAuthenticated) {
              handleOpenLogin();
              showToast('Please log in to view your Bag 🛍️');
            } else {
              setActiveProductModal(null);
              setIsBagModalVisible(true);
            }
          }}
        />

        {/* 5. Complete Authentication Modal Wizard */}
        <AuthModal
          visible={isAuthModalVisible}
          initialMode={authModalMode}
          onClose={closeAuthModal}
          onSuccess={(msg) => showToast(msg)}
        />

        {/* 6. Real-time Shopping Bag Modal */}
        <ShoppingBagModal
          visible={isBagModalVisible}
          cartItems={cartItems}
          savedForLaterItems={savedForLaterItems}
          allProducts={apiProducts}
          onClose={() => setIsBagModalVisible(false)}
          onUpdateQuantity={handleUpdateCartQuantity}
          onRemoveItem={handleRemoveCartItem}
          onSaveForLater={handleSaveCartItemForLater}
          onMoveSavedToBag={handleMoveSavedItemToBag}
          onRemoveSavedItem={handleRemoveSavedItem}
          onRefreshBag={handleRefreshBag}
          onMoveToWishlist={handleMoveCartItemToWishlist}
          onClearBag={handleClearCart}
          onUpdateVariant={handleUpdateCartItemVariant}
          onAddToCart={handleAddToBag}
          onPressProduct={(p) => {
            setIsBagModalVisible(false);
            handleOpenProduct(p);
          }}
          onStartShopping={() => {
            setIsBagModalVisible(false);
            setActiveTab('home');
          }}
          onGoToOrders={() => {
            setIsBagModalVisible(false);
            setActiveTab('profile');
            setOpenOrdersDirectly(true);
          }}
          onOrderPlaced={(order) => {
            setCartItems([]);
            setOrders((prev) => [order, ...prev]);
            showToast(`Order #${order.id} placed successfully! 🎉`);
          }}
          onOpenAuth={() => {
            setIsBagModalVisible(false);
            openAuthModal();
          }}
        />

        {/* 7. Interactive Search Modal */}
        <SearchModal
          visible={isSearchModalVisible}
          initialQuery={searchQuery}
          products={apiProducts}
          onClose={() => setIsSearchModalVisible(false)}
          onApplySearchQuery={(q) => {
            setSearchQuery(q);
            setIsSearchModalVisible(false);
          }}
          onSelectProduct={(p) => {
            setIsSearchModalVisible(false);
            handleOpenProduct(p);
          }}
          onPressCamera={() => {
            setIsSearchModalVisible(false);
            setIsVisualSearchVisible(true);
          }}
          onPressMic={() => {
            setIsSearchModalVisible(false);
            setIsVoiceSearchVisible(true);
          }}
        />

        {/* 8. Multi-Facet Filter & Sort Modal */}
        <FilterModal
          visible={isFilterModalVisible}
          onClose={() => setIsFilterModalVisible(false)}
          filters={filterState}
          availableBrands={availableBrands}
          availableCategories={['Men', 'Women', 'Kids', 'Beauty', 'Home', 'Sports']}
          availableSizes={['XS', 'S', 'M', 'L', 'XL', 'XXL']}
          totalResultsCount={filteredProducts.length}
          onApplyFilters={(newFilters) => {
            setFilterState(newFilters);
            setIsFilterModalVisible(false);
            showToast('Filters updated');
          }}
          onResetFilters={() => {
            setFilterState(DEFAULT_FILTERS);
            setIsFilterModalVisible(false);
            showToast('Filters cleared');
          }}
          initialTab={filterModalTab}
        />

        {/* 9. Visual / Photo Search Modal */}
        <VisualSearchModal
          visible={isVisualSearchVisible}
          onClose={() => setIsVisualSearchVisible(false)}
          products={apiProducts}
          onSelectProduct={(p) => {
            setIsVisualSearchVisible(false);
            handleOpenProduct(p);
          }}
          onApplyCategoryOrQuery={(q) => {
            setIsVisualSearchVisible(false);
            setSearchQuery(q);
            setActiveTab('home');
            showToast(`Showing matches for "${q}" 📸`);
          }}
        />

        {/* 10. Voice Search Modal */}
        <VoiceSearchModal
          visible={isVoiceSearchVisible}
          onClose={() => setIsVoiceSearchVisible(false)}
          onApplyVoiceQuery={(q) => {
            setIsVoiceSearchVisible(false);
            setSearchQuery(q);
            setActiveTab('home');
            showToast(`Voice search: "${q}" 🎙️`);
          }}
        />

        {/* 11. Bank Offers Modal */}
        <BankOffersModal
          visible={isBankOffersVisible}
          onClose={() => setIsBankOffersVisible(false)}
          onApplyCode={(code) => {
            showToast(`Bank coupon ${code} applied successfully! 💳`);
          }}
        />

        {/* 12. Myntra Insider VIP Modal */}
        <InsiderModal
          visible={isInsiderVisible}
          onClose={() => setIsInsiderVisible(false)}
          onClaimPerk={(perk) => {
            showToast(`Claimed ${perk}! Added to your account 🌟`);
          }}
        />

        {/* 12B. Real-Time Notification Center Modal */}
        <NotificationsModal
          visible={isNotificationsModalVisible}
          onClose={() => setIsNotificationsModalVisible(false)}
          userId={user?.id}
          onOpenAuth={handleOpenLogin}
          onUnreadCountChange={handleUnreadCountChange}
          onNavigateToOrder={(orderId) => {
            setIsNotificationsModalVisible(false);
            if (isAuthenticated) {
              setActiveTab('profile');
              setOpenOrdersDirectly(true);
            } else {
              openAuthModal();
            }
          }}
          onNavigateToProduct={(productId) => {
            setIsNotificationsModalVisible(false);
            const targetProd =
              apiProducts.find((p) => p.id === productId) ||
              PRODUCTS.find((p) => p.id === productId);
            if (targetProd) {
              handleOpenProduct(targetProd);
            }
          }}
          onNavigateToBag={() => {
            setIsNotificationsModalVisible(false);
            setIsBagModalVisible(true);
          }}
          onNavigateToOffers={(coupon) => {
            setIsNotificationsModalVisible(false);
            setIsBankOffersVisible(true);
            if (coupon) {
              showToast(`Offer coupon "${coupon}" ready to use! 🏷️`);
            }
          }}
        />

        {/* 13. Floating Toast Feedback */}
        {toastMessage && (
          <View style={styles.toastContainer}>
            <Text style={styles.toastText}>{toastMessage}</Text>
          </View>
        )}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  webWrapper: {
    flex: 1,
    backgroundColor: MyntraColors.white,
    alignItems: 'center',
    width: '100%',
  },
  safeArea: {
    flex: 1,
    width: '100%',
    maxWidth: Platform.OS === 'web' ? 1240 : undefined,
    backgroundColor: MyntraColors.white,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
    position: 'relative',
    ...(Platform.OS === 'web'
      ? {
          shadowColor: '#000000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.05,
          shadowRadius: 10,
        }
      : {}),
  },
  contentContainer: {
    flex: 1,
    backgroundColor: MyntraColors.white,
  },
  scrollView: {
    flex: 1,
  },
  homeScrollContent: {
    paddingBottom: Platform.OS === 'web' ? 40 : 85,
  },
  dealStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#fff4f6',
    paddingVertical: 7,
    paddingHorizontal: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: '#ffe0e6',
  },
  dealStripText: {
    fontSize: 11,
    color: MyntraColors.text,
    fontWeight: '600',
  },
  dealCode: {
    color: MyntraColors.primary,
    fontWeight: '800',
  },
  // Deals of the Day styles
  dealsSection: {
    marginTop: Spacing.sm,
    backgroundColor: '#fffdf5',
    paddingVertical: Spacing.md,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#fceecb',
  },
  dealsHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
  },
  dealsTitleCol: {
    flex: 1,
  },
  dealsTitleBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  dealsTitle: {
    fontSize: 13,
    fontWeight: '900',
    color: MyntraColors.text,
    letterSpacing: 0.8,
  },
  dealsSubtitle: {
    fontSize: 10,
    color: MyntraColors.textSecondary,
    marginTop: 2,
  },
  countdownPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#d9183b',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 14,
  },
  countdownText: {
    color: MyntraColors.white,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  horizontalScrollContent: {
    paddingHorizontal: Spacing.lg,
    gap: 12,
  },
  dealCard: {
    width: 130,
    backgroundColor: MyntraColors.white,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#f3e4c4',
    overflow: 'hidden',
    position: 'relative',
  },
  dealImage: {
    width: '100%',
    height: 145,
    backgroundColor: '#f5f5f5',
  },
  dealBadge: {
    position: 'absolute',
    top: 6,
    left: 6,
    backgroundColor: '#d9183b',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  dealBadgeText: {
    color: MyntraColors.white,
    fontSize: 9,
    fontWeight: '800',
  },
  dealHeartBtn: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
    elevation: 2,
  },
  dealInfo: {
    padding: 8,
  },
  dealBrand: {
    fontSize: 11,
    fontWeight: '800',
    color: MyntraColors.text,
  },
  dealName: {
    fontSize: 10,
    color: MyntraColors.textSecondary,
    marginTop: 1,
  },
  dealPriceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  dealPrice: {
    fontSize: 12,
    fontWeight: '800',
    color: MyntraColors.text,
  },
  dealOrigPrice: {
    fontSize: 10,
    color: MyntraColors.textMuted,
    textDecorationLine: 'line-through',
  },
  // Curated collections styles
  curatedSection: {
    marginTop: Spacing.lg,
    paddingVertical: Spacing.xs,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
  },
  curatedTitle: {
    fontSize: 13,
    fontWeight: '900',
    color: MyntraColors.text,
    letterSpacing: 0.8,
  },
  curatedSubtitle: {
    fontSize: 10,
    color: MyntraColors.textSecondary,
    marginTop: 2,
  },
  featuredBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    backgroundColor: '#fff0f3',
    borderWidth: 0.5,
    borderColor: '#ffc1cf',
  },
  featuredBadgeText: {
    fontSize: 9.5,
    fontWeight: '800',
    color: MyntraColors.primary,
    letterSpacing: 0.5,
  },
  curatedCard: {
    width: 175,
    height: 185,
    borderRadius: 10,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#333',
  },
  curatedImage: {
    width: '100%',
    height: '100%',
  },
  curatedOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.65)',
    padding: 10,
  },
  curatedTagPill: {
    backgroundColor: MyntraColors.primary,
    alignSelf: 'flex-start',
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 3,
    marginBottom: 4,
  },
  curatedTagText: {
    color: MyntraColors.white,
    fontSize: 8,
    fontWeight: '800',
  },
  curatedCardTitle: {
    color: MyntraColors.white,
    fontSize: 12,
    fontWeight: '800',
  },
  curatedCardSub: {
    color: '#e0e0e0',
    fontSize: 9.5,
    marginTop: 2,
  },
  // Top Brands styles
  brandsSection: {
    marginTop: Spacing.lg,
    paddingVertical: Spacing.xs,
  },
  brandCard: {
    width: 95,
    alignItems: 'center',
    backgroundColor: MyntraColors.white,
    borderRadius: 8,
    padding: 6,
    borderWidth: 1,
    borderColor: '#eee',
  },
  brandImage: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#f5f5f5',
    marginBottom: 6,
  },
  brandName: {
    fontSize: 11,
    fontWeight: '800',
    color: MyntraColors.text,
  },
  brandOfferPill: {
    marginTop: 3,
    backgroundColor: '#fff0f3',
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 4,
  },
  brandOfferText: {
    color: MyntraColors.primary,
    fontSize: 8,
    fontWeight: '800',
  },
  // Recently Viewed styles
  recentSection: {
    marginTop: Spacing.lg,
    paddingVertical: Spacing.xs,
    backgroundColor: '#fafafc',
    paddingBottom: Spacing.md,
  },
  clearRecentText: {
    fontSize: 10,
    fontWeight: '800',
    color: MyntraColors.textSecondary,
    letterSpacing: 0.5,
  },
  recentCard: {
    width: 90,
    backgroundColor: MyntraColors.white,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#e8e8ec',
    overflow: 'hidden',
    paddingBottom: 6,
    position: 'relative',
  },
  recentImage: {
    width: '100%',
    height: 95,
  },
  recentHeartBtn: {
    position: 'absolute',
    top: 5,
    right: 5,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
    elevation: 2,
  },
  recentBrand: {
    fontSize: 10,
    fontWeight: '800',
    color: MyntraColors.text,
    paddingHorizontal: 4,
    marginTop: 4,
  },
  recentPrice: {
    fontSize: 10,
    fontWeight: '700',
    color: MyntraColors.primary,
    paddingHorizontal: 4,
    marginTop: 1,
  },
  // Floating Toast Feedback
  toastContainer: {
    position: 'absolute',
    bottom: 85,
    alignSelf: 'center',
    backgroundColor: 'rgba(33, 33, 40, 0.95)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 22,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 5,
    elevation: 6,
    zIndex: 999,
  },
  toastText: {
    color: MyntraColors.white,
    fontSize: 12,
    fontWeight: '700',
  },
  // Empty Guest Wishlist View
  emptyGuestWishlistContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 80,
  },
  emptyGuestIconCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  emptyGuestWishlistTitle: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 1.2,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyGuestWishlistSub: {
    fontSize: 13,
    lineHeight: 20,
    textAlign: 'center',
    maxWidth: 300,
    marginBottom: 26,
  },
  guestLoginBtn: {
    paddingHorizontal: 32,
    paddingVertical: 13,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#ff3f6c',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 4,
  },
  guestLoginBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
});
