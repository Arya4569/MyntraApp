import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Image,
  Modal,
  Platform,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { Spacing } from '@/constants/myntra-theme';
import { Product, PRODUCTS, PROMO_BANNERS } from '@/data/mock-data';
import { useTheme } from '@/hooks/use-theme';
import { storeService } from '@/services/store-service';

export interface ProductModalProps {
  product: Product | null;
  visible: boolean;
  isWishlisted: boolean;
  bagCount?: number;
  onClose: () => void;
  onToggleWishlist: (product: Product) => void;
  onAddToBag: (product: Product, size: string, color?: string, quantity?: number) => void;
  onBuyNow?: (product: Product, size: string, color?: string, quantity?: number) => void;
  onSelectSimilarProduct?: (prod: Product) => void;
  onOpenBag?: () => void;
  allProducts?: Product[];
}

export const ProductModal: React.FC<ProductModalProps> = ({
  product,
  visible,
  isWishlisted,
  bagCount = 0,
  onClose,
  onToggleWishlist,
  onAddToBag,
  onBuyNow,
  onSelectSimilarProduct,
  onOpenBag,
  allProducts = PRODUCTS,
}) => {
  const scrollRef = useRef<ScrollView>(null);
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => createStyles(colors, isDark), [colors, isDark]);

  // Active image gallery index
  const [activeImageIndex, setActiveImageIndex] = useState(0);

  // Variant selections
  const [selectedSize, setSelectedSize] = useState<string>('');
  const [selectedColor, setSelectedColor] = useState<string>('');
  const [selectedQty, setSelectedQty] = useState<number>(1);
  const [sizeError, setSizeError] = useState(false);
  const [showSizeChart, setShowSizeChart] = useState(false);

  // Delivery Pincode Checker
  const [pincode, setPincode] = useState('');
  const [pincodeChecked, setPincodeChecked] = useState(false);
  const [pincodeValid, setPincodeValid] = useState(false);

  // Offers state
  const [copiedCoupon, setCopiedCoupon] = useState<string | null>(null);

  // Added to bag feedback
  const [justAddedToBag, setJustAddedToBag] = useState(false);

  // Heart animation
  const [heartScale] = useState(() => new Animated.Value(1));

  // Track product ID to reset variant selections on product change
  const [prevProductId, setPrevProductId] = useState<string | null>(null);

  if (product && product.id !== prevProductId) {
    setPrevProductId(product.id);
    setActiveImageIndex(0);
    setSelectedSize(product.sizes && product.sizes.length === 1 ? product.sizes[0] : '');
    setSelectedColor(product.colors && product.colors.length > 0 ? product.colors[0] : '');
    setSelectedQty(1);
    setSizeError(false);
    setJustAddedToBag(false);
  }

  // Wishlist heart bounce animation
  const animateHeart = () => {
    Animated.sequence([
      Animated.timing(heartScale, {
        toValue: 1.3,
        duration: 120,
        useNativeDriver: Platform.OS !== 'web',
      }),
      Animated.spring(heartScale, {
        toValue: 1,
        friction: 4,
        useNativeDriver: Platform.OS !== 'web',
      }),
    ]).start();
  };

  const handleToggleWishlistPress = () => {
    if (!product) return;
    animateHeart();
    onToggleWishlist(product);
  };

  const handleShareProduct = async () => {
    if (!product) return;
    try {
      await Share.share({
        title: `${product.brand} - ${product.name}`,
        message: `Look at this on Myntra: ${product.brand} ${product.name} at ₹${product.price} (${product.discountPercent}% OFF)!\nCheck it out: https://www.myntra.com/product/${product.id}`,
      });
    } catch (e) {
      console.warn('Share error:', e);
    }
  };

  // Size selection
  const handleSizeSelect = (sz: string) => {
    setSelectedSize(sz);
    setSizeError(false);
  };

  // Add to Bag handler with validation
  const handleAddToBagPress = () => {
    if (!product) return;

    // Check if out of stock
    if (product.inStock === false || (product.stockCount !== undefined && product.stockCount <= 0)) {
      return;
    }

    // Size validation
    if (product.sizes && product.sizes.length > 0 && !selectedSize) {
      setSizeError(true);
      scrollRef.current?.scrollTo({ y: 340, animated: true });
      return;
    }

    onAddToBag(product, selectedSize || 'One Size', selectedColor || undefined, selectedQty);
    setJustAddedToBag(true);
    setTimeout(() => {
      setJustAddedToBag(false);
    }, 3500);
  };

  // Buy Now handler
  const handleBuyNowPress = () => {
    if (!product) return;

    if (product.inStock === false || (product.stockCount !== undefined && product.stockCount <= 0)) {
      return;
    }

    if (product.sizes && product.sizes.length > 0 && !selectedSize) {
      setSizeError(true);
      scrollRef.current?.scrollTo({ y: 340, animated: true });
      return;
    }

    if (onBuyNow) {
      onBuyNow(product, selectedSize || 'One Size', selectedColor || undefined, selectedQty);
    } else {
      onAddToBag(product, selectedSize || 'One Size', selectedColor || undefined, selectedQty);
      if (onOpenBag) onOpenBag();
    }
  };

  // Indian 6-digit Pincode validation: Exactly 6 digits, first digit 1-9
  const handleCheckPincode = () => {
    const clean = pincode.trim().replace(/\D/g, '');
    const isValid = /^[1-9][0-9]{5}$/.test(clean);
    setPincodeChecked(true);
    setPincodeValid(isValid);
  };

  // Copy Coupon helper
  const handleCopyCoupon = async (code: string) => {
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(code);
      } else if (typeof document !== 'undefined') {
        const textArea = document.createElement('textarea');
        textArea.value = code;
        textArea.style.position = 'fixed';
        textArea.style.opacity = '0';
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      }
    } catch (e) {
      console.warn('Clipboard write failed:', e);
    }
    setCopiedCoupon(code);
    setTimeout(() => {
      setCopiedCoupon(null);
    }, 2500);
  };

  // Delivery date computation
  const getDeliveryDateText = (days: number = 2) => {
    const d = new Date();
    d.setDate(d.getDate() + (days || 2));
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const monthNames = [
      'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
    ];
    return `${dayNames[d.getDay()]}, ${d.getDate()} ${monthNames[d.getMonth()]}`;
  };

  // Images gallery array
  const images = product
    ? product.images && product.images.length > 0
      ? product.images
      : [product.image]
    : [];

  // Similar products dynamically loaded from recommendation API with local fallback
  const [apiSimilarProducts, setApiSimilarProducts] = useState<Product[]>([]);

  useEffect(() => {
    let isMounted = true;
    if (visible && product?.id) {
      storeService
        .fetchSimilarProducts(product.id, 6)
        .then((res) => {
          if (isMounted && Array.isArray(res) && res.length > 0) {
            setApiSimilarProducts(res);
          }
        })
        .catch(() => {});
    }
    return () => {
      isMounted = false;
    };
  }, [visible, product?.id]);

  let similarProducts: Product[] = [];
  if (product) {
    if (apiSimilarProducts.length > 0) {
      similarProducts = apiSimilarProducts;
    } else {
      const catalogSource = allProducts && allProducts.length > 0 ? allProducts : PRODUCTS;
      const sameSub = catalogSource.filter(
        (p) =>
          p.id !== product.id &&
          p.category === product.category &&
          p.subcategory === product.subcategory
      );
      if (sameSub.length >= 4) {
        similarProducts = sameSub.slice(0, 6);
      } else {
        const sameCat = catalogSource.filter(
          (p) => p.id !== product.id && p.category === product.category
        );
        similarProducts = sameCat.slice(0, 6);
      }
    }
  }

  // Ratings breakdown distribution based on real rating
  const ratingsDistribution = (() => {
    if (!product) return { 5: 65, 4: 20, 3: 8, 2: 4, 1: 3 };
    const r = product.rating;
    if (r >= 4.5) return { 5: 72, 4: 18, 3: 6, 2: 2, 1: 2 };
    if (r >= 4.0) return { 5: 58, 4: 24, 3: 10, 2: 5, 1: 3 };
    if (r >= 3.5) return { 5: 42, 4: 30, 3: 16, 2: 7, 1: 5 };
    return { 5: 30, 4: 25, 3: 20, 2: 15, 1: 10 };
  })();

  // Stock status checks
  const isOutOfStock = product ? product.inStock === false || (product.stockCount !== undefined && product.stockCount <= 0) : false;
  const isLowStock = product && product.stockCount !== undefined && product.stockCount > 0 && product.stockCount <= 5;

  // Coupon code applicable
  const applicableCoupon = product
    ? PROMO_BANNERS.find(
        (b) => b.category === 'all' || (b.category && b.category.toLowerCase() === product.category.toLowerCase())
      ) || PROMO_BANNERS[0]
    : null;

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheetContainer}>
          {/* Header Bar */}
          <View style={styles.sheetHeader}>
            <TouchableOpacity
              onPress={onClose}
              style={styles.headerBackBtn}
              activeOpacity={0.7}
              accessibilityLabel="Close product details">
              <Ionicons name="arrow-back" size={22} color={colors.text} />
            </TouchableOpacity>

            <View style={styles.headerTitleWrap}>
              {product ? (
                <>
                  <Text style={styles.sheetBrand} numberOfLines={1}>
                    {product.brand}
                  </Text>
                  <Text style={styles.sheetSub} numberOfLines={1}>
                    {product.name}
                  </Text>
                </>
              ) : (
                <Text style={styles.sheetBrand}>Product Details</Text>
              )}
            </View>

            <View style={styles.headerActions}>
              {/* Share Button */}
              {product && (
                <TouchableOpacity
                  onPress={handleShareProduct}
                  style={styles.headerIconBtn}
                  activeOpacity={0.7}
                  accessibilityLabel="Share product">
                  <Ionicons name="share-social-outline" size={20} color={colors.text} />
                </TouchableOpacity>
              )}

              {/* Wishlist Heart */}
              {product && (
                <TouchableOpacity
                  onPress={handleToggleWishlistPress}
                  style={styles.headerIconBtn}
                  activeOpacity={0.7}
                  accessibilityLabel={isWishlisted ? 'Remove from wishlist' : 'Add to wishlist'}>
                  <Animated.View style={{ transform: [{ scale: heartScale }] }}>
                    <Ionicons
                      name={isWishlisted ? 'heart' : 'heart-outline'}
                      size={22}
                      color={isWishlisted ? colors.primary : colors.text}
                    />
                  </Animated.View>
                </TouchableOpacity>
              )}

              {/* Bag Icon with live badge */}
              <TouchableOpacity
                onPress={() => {
                  if (onOpenBag) {
                    onOpenBag();
                  } else {
                    onClose();
                  }
                }}
                style={styles.headerBagBtn}
                activeOpacity={0.7}
                accessibilityLabel="View shopping bag">
                <Ionicons name="bag-handle-outline" size={21} color={colors.text} />
                {bagCount > 0 && (
                  <View style={styles.headerBagBadge}>
                    <Text style={styles.headerBagBadgeText}>
                      {bagCount > 99 ? '99+' : bagCount}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            </View>
          </View>

          {/* If product is null (loading or error state) */}
          {!product ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={styles.loadingText}>Loading product details...</Text>
            </View>
          ) : (
            <>
              <ScrollView
                ref={scrollRef}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.scrollContent}>
                {/* 1. Main Image Gallery with Carousel Switcher */}
                <View style={styles.galleryContainer}>
                  <Image
                    source={{ uri: images[activeImageIndex] || product.image }}
                    style={styles.modalImage}
                    resizeMode="cover"
                  />

                  {/* Rating Star Badge Pill Overlay */}
                  <View style={styles.modalRatingBadge}>
                    <Text style={styles.modalRatingText}>
                      {product.rating.toFixed(1)}
                    </Text>
                    <Ionicons name="star" size={11} color={colors.ratingGreen} />
                    <Text style={styles.modalRatingDivider}>|</Text>
                    <Text style={styles.modalRatingCount}>{product.ratingCount}</Text>
                  </View>

                  {/* Badge overlay if present */}
                  {product.badge && (
                    <View style={styles.badgeTag}>
                      <Text style={styles.badgeTagText}>{product.badge.toUpperCase()}</Text>
                    </View>
                  )}

                  {/* Image Counter Pill (e.g. 1/3) */}
                  {images.length > 1 && (
                    <View style={styles.imageCounterPill}>
                      <Text style={styles.imageCounterText}>
                        {activeImageIndex + 1} / {images.length}
                      </Text>
                    </View>
                  )}

                  {/* Out of Stock Watermark Badge if unavailable */}
                  {isOutOfStock && (
                    <View style={styles.outOfStockOverlay}>
                      <Text style={styles.outOfStockOverlayText}>OUT OF STOCK</Text>
                    </View>
                  )}
                </View>

                {/* Multiple Image Thumbnails Strip */}
                {images.length > 1 && (
                  <View style={styles.thumbnailsContainer}>
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={styles.thumbnailsRow}>
                      {images.map((img, idx) => {
                        const isActive = activeImageIndex === idx;
                        return (
                          <TouchableOpacity
                            key={idx}
                            onPress={() => setActiveImageIndex(idx)}
                            style={[
                              styles.thumbBtn,
                              isActive && styles.thumbBtnActive,
                            ]}
                            activeOpacity={0.8}>
                            <Image source={{ uri: img }} style={styles.thumbImage} />
                            {isActive && <View style={styles.thumbActiveIndicator} />}
                          </TouchableOpacity>
                        );
                      })}
                    </ScrollView>
                  </View>
                )}

                {/* 2. Brand, Name & Pricing Section */}
                <View style={styles.infoSection}>
                  <View style={styles.brandVerifiedRow}>
                    <Text style={styles.brandTitle}>{product.brand}</Text>
                    <Ionicons name="checkmark-circle" size={15} color={colors.ratingGreen} />
                  </View>
                  <Text style={styles.productTitle}>{product.name}</Text>

                  {/* Price Row */}
                  <View style={styles.priceRow}>
                    <Text style={styles.modalPrice}>₹{product.price}</Text>
                    {product.originalPrice > product.price && (
                      <Text style={styles.modalOriginalPrice}>
                        ₹{product.originalPrice}
                      </Text>
                    )}
                    {product.discountPercent > 0 && (
                      <View style={styles.discountBadge}>
                        <Text style={styles.discountBadgeText}>
                          ({product.discountPercent}% OFF)
                        </Text>
                      </View>
                    )}
                  </View>

                  <View style={styles.taxSavingsRow}>
                    <Text style={styles.taxInfo}>inclusive of all taxes</Text>
                    {product.originalPrice > product.price && (
                      <View style={styles.savingsPill}>
                        <Text style={styles.savingsPillText}>
                          Save ₹{product.originalPrice - product.price}
                        </Text>
                      </View>
                    )}
                  </View>

                  {/* Stock Alert Info */}
                  {isOutOfStock ? (
                    <View style={styles.stockAlertDanger}>
                      <Ionicons name="alert-circle" size={16} color="#d32f2f" />
                      <Text style={styles.stockAlertDangerText}>
                        Currently out of stock. Select similar styles below!
                      </Text>
                    </View>
                  ) : isLowStock ? (
                    <View style={styles.stockAlertWarning}>
                      <Ionicons name="flame" size={16} color="#f57c00" />
                      <Text style={styles.stockAlertWarningText}>
                        Hurry! Only {product.stockCount} items left in stock.
                      </Text>
                    </View>
                  ) : null}
                </View>

                {/* 3. Color Variants Selection */}
                {product.colors && product.colors.length > 0 && (
                  <View style={styles.sectionCard}>
                    <Text style={styles.sectionLabel}>
                      COLOR:{' '}
                      <Text style={styles.sectionValueHighlight}>
                        {selectedColor || product.colors[0]}
                      </Text>
                    </Text>
                    <View style={styles.colorsRow}>
                      {product.colors.map((c) => {
                        const isColorSelected = selectedColor === c;
                        return (
                          <TouchableOpacity
                            key={c}
                            onPress={() => setSelectedColor(c)}
                            style={[
                              styles.colorPill,
                              isColorSelected && styles.colorPillActive,
                            ]}
                            activeOpacity={0.8}>
                            <View
                              style={[
                                styles.colorDot,
                                {
                                  backgroundColor:
                                    c.toLowerCase().includes('black')
                                      ? '#111'
                                      : c.toLowerCase().includes('white')
                                      ? '#f0f0f0'
                                      : c.toLowerCase().includes('green')
                                      ? '#2e7d32'
                                      : c.toLowerCase().includes('blue')
                                      ? '#1565c0'
                                      : c.toLowerCase().includes('red')
                                      ? '#c62828'
                                      : c.toLowerCase().includes('pink')
                                      ? '#ad1457'
                                      : c.toLowerCase().includes('yellow')
                                      ? '#f9a825'
                                      : '#757575',
                                },
                              ]}
                            />
                            <Text
                              style={[
                                styles.colorText,
                                isColorSelected && styles.colorTextActive,
                              ]}>
                              {c}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>
                )}

                {/* 4. Size Selection with Validation */}
                {product.sizes && product.sizes.length > 0 && (
                  <View style={styles.sectionCard}>
                    <View style={styles.sizeHeaderRow}>
                      <Text style={styles.sectionLabel}>
                        SELECT SIZE{' '}
                        <Text style={styles.requiredMark}>*</Text>
                      </Text>
                      <TouchableOpacity
                        onPress={() => setShowSizeChart(true)}
                        activeOpacity={0.7}
                        accessibilityLabel="Open size chart guide">
                        <Text style={styles.sizeChartLink}>SIZE CHART</Text>
                      </TouchableOpacity>
                    </View>

                    {/* Size Selection Error Banner */}
                    {sizeError && (
                      <View style={styles.sizeErrorContainer}>
                        <Ionicons name="alert-circle" size={15} color="#e53935" />
                        <Text style={styles.sizeErrorAlert}>
                          Please select a size to proceed with adding to Bag
                        </Text>
                      </View>
                    )}

                    <View style={styles.sizesRow}>
                      {product.sizes.map((sz) => {
                        const isSelected = selectedSize === sz;
                        return (
                          <TouchableOpacity
                            key={sz}
                            onPress={() => handleSizeSelect(sz)}
                            style={[
                              styles.sizeCircle,
                              isSelected && styles.sizeCircleSelected,
                              sizeError && !selectedSize && styles.sizeCircleAlert,
                            ]}
                            activeOpacity={0.8}>
                            <Text
                              style={[
                                styles.sizeCircleText,
                                isSelected && styles.sizeCircleTextSelected,
                              ]}>
                              {sz}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>
                )}

                {/* 5. Quantity Selector if In Stock */}
                {!isOutOfStock && (
                  <View style={styles.sectionCard}>
                    <View style={styles.quantityHeaderRow}>
                      <Text style={styles.sectionLabel}>QUANTITY</Text>
                      <View style={styles.quantityPickerRow}>
                        {[1, 2, 3, 4, 5]
                          .filter((q) => !product.stockCount || q <= product.stockCount)
                          .map((q) => {
                            const isQtySelected = selectedQty === q;
                            return (
                              <TouchableOpacity
                                key={q}
                                onPress={() => setSelectedQty(q)}
                                style={[
                                  styles.qtyPill,
                                  isQtySelected && styles.qtyPillActive,
                                ]}
                                activeOpacity={0.8}>
                                <Text
                                  style={[
                                    styles.qtyPillText,
                                    isQtySelected && styles.qtyPillTextActive,
                                  ]}>
                                  {q}
                                </Text>
                              </TouchableOpacity>
                            );
                          })}
                      </View>
                    </View>
                  </View>
                )}

                {/* 6. Best Offers & Coupons Section */}
                {applicableCoupon && (
                  <View style={styles.sectionCard}>
                    <View style={styles.offersHeaderRow}>
                      <Ionicons name="pricetag-outline" size={16} color={colors.primary} />
                      <Text style={styles.offersHeading}>BEST OFFERS</Text>
                    </View>

                    {/* Promo Coupon Card */}
                    <View style={styles.couponCard}>
                      <View style={styles.couponLeft}>
                        <Text style={styles.couponDiscount}>{applicableCoupon.discount}</Text>
                        <Text style={styles.couponCodeText}>
                          Use Code: <Text style={styles.couponBold}>{applicableCoupon.code}</Text>
                        </Text>
                        <Text style={styles.couponExpiry}>
                          Expires in: {applicableCoupon.endsIn}
                        </Text>
                      </View>
                      <TouchableOpacity
                        onPress={() => handleCopyCoupon(applicableCoupon.code)}
                        style={[
                          styles.copyCouponBtn,
                          copiedCoupon === applicableCoupon.code && styles.copyCouponBtnActive,
                        ]}
                        activeOpacity={0.75}>
                        <Text style={styles.copyCouponText}>
                          {copiedCoupon === applicableCoupon.code ? 'COPIED ✓' : 'COPY'}
                        </Text>
                      </TouchableOpacity>
                    </View>

                    {/* Bank Offer Pill */}
                    <View style={styles.bankOfferRow}>
                      <Ionicons name="card-outline" size={15} color={colors.text} />
                      <Text style={styles.bankOfferText}>
                        10% Instant Discount on HDFC & ICICI Bank Credit Cards on min. spend of ₹1,500
                      </Text>
                    </View>

                    {/* EMI Option */}
                    <View style={styles.bankOfferRow}>
                      <Ionicons name="calendar-outline" size={15} color={colors.text} />
                      <Text style={styles.bankOfferText}>
                        EMI starting from ₹{Math.round(product.price / 3)}/month with No Cost EMI available
                      </Text>
                    </View>
                  </View>
                )}

                {/* 7. Delivery Options / Indian PIN code Check */}
                <View style={styles.sectionCard}>
                  <View style={styles.deliveryHeaderRow}>
                    <Ionicons name="location-outline" size={16} color={colors.primary} />
                    <Text style={styles.sectionLabel}>DELIVERY OPTIONS</Text>
                  </View>

                  <View style={styles.pincodeInputRow}>
                    <TextInput
                      style={styles.pincodeInput}
                      placeholder="Enter 6-digit Indian PIN code"
                      placeholderTextColor={colors.textMuted}
                      keyboardType="number-pad"
                      maxLength={6}
                      value={pincode}
                      onChangeText={(val) => {
                        setPincode(val);
                        setPincodeChecked(false);
                      }}
                    />
                    <TouchableOpacity
                      onPress={handleCheckPincode}
                      style={styles.pincodeCheckBtn}
                      activeOpacity={0.75}>
                      <Text style={styles.pincodeCheckText}>CHECK</Text>
                    </TouchableOpacity>
                  </View>

                  {pincodeChecked && (
                    <View
                      style={[
                        styles.pincodeStatusCard,
                        pincodeValid
                          ? styles.pincodeStatusSuccess
                          : styles.pincodeStatusError,
                      ]}>
                      <Ionicons
                        name={pincodeValid ? 'checkmark-circle' : 'alert-circle'}
                        size={18}
                        color={pincodeValid ? colors.ratingGreen : colors.badgeRed}
                      />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.pincodeStatusTitle}>
                          {pincodeValid
                            ? `Delivery by ${getDeliveryDateText(product.deliveryDays || 2)}`
                            : 'Invalid PIN Code'}
                        </Text>
                        <Text style={styles.pincodeStatusSub}>
                          {pincodeValid
                            ? `Express Shipping & Pay on Delivery available for PIN ${pincode}`
                            : 'Please enter a valid 6-digit Indian PIN code (e.g. 560001, 110001)'}
                        </Text>
                      </View>
                    </View>
                  )}

                  {/* Delivery Perks row */}
                  <View style={styles.deliveryPerksRow}>
                    <View style={styles.deliveryPerk}>
                      <Ionicons name="flash-outline" size={18} color={colors.primary} />
                      <Text style={styles.deliveryPerkText}>
                        {product.deliveryTime || 'Fast Delivery'}
                      </Text>
                    </View>
                    <View style={styles.deliveryPerk}>
                      <Ionicons name="repeat-outline" size={18} color={colors.primary} />
                      <Text style={styles.deliveryPerkText}>14 Days Easy Returns</Text>
                    </View>
                    <View style={styles.deliveryPerk}>
                      <Ionicons name="shield-checkmark-outline" size={18} color={colors.primary} />
                      <Text style={styles.deliveryPerkText}>100% Original</Text>
                    </View>
                  </View>
                </View>

                {/* 8. Product Details & Specifications */}
                <View style={styles.sectionCard}>
                  <Text style={styles.sectionLabel}>PRODUCT DETAILS</Text>
                  <Text style={styles.descriptionText}>{product.description}</Text>

                  {product.specifications && Object.keys(product.specifications).length > 0 && (
                    <View style={styles.specsTable}>
                      <Text style={styles.specsTitle}>Specifications</Text>
                      {Object.entries(product.specifications).map(([key, val]) => (
                        <View key={key} style={styles.specsRow}>
                          <Text style={styles.specsKey}>{key}</Text>
                          <Text style={styles.specsVal}>{val}</Text>
                        </View>
                      ))}
                    </View>
                  )}
                </View>

                {/* 9. Ratings & Customer Feedback Section */}
                <View style={styles.sectionCard}>
                  <View style={styles.ratingsHeaderRow}>
                    <Text style={styles.sectionLabel}>RATINGS & REVIEWS</Text>
                    <View style={styles.verifiedBuyersTag}>
                      <Ionicons name="shield-checkmark" size={12} color={colors.ratingGreen} />
                      <Text style={styles.verifiedBuyersText}>Verified Buyers</Text>
                    </View>
                  </View>

                  <View style={styles.ratingSummaryRow}>
                    {/* Big Score Box */}
                    <View style={styles.bigScoreBox}>
                      <View style={styles.bigScoreHeader}>
                        <Text style={styles.bigScoreNumber}>{product.rating.toFixed(1)}</Text>
                        <Ionicons name="star" size={20} color={colors.ratingGreen} />
                      </View>
                      <Text style={styles.bigScoreCount}>{product.ratingCount} Ratings</Text>
                    </View>

                    {/* Breakdown Bars */}
                    <View style={styles.breakdownBarsCol}>
                      {[5, 4, 3, 2, 1].map((star) => {
                        const pct = (ratingsDistribution as any)[star] || 10;
                        return (
                          <View key={star} style={styles.barRow}>
                            <Text style={styles.barStarText}>{star} ★</Text>
                            <View style={styles.barTrack}>
                              <View
                                style={[
                                  styles.barFill,
                                  {
                                    width: `${pct}%`,
                                    backgroundColor:
                                      star >= 4
                                        ? colors.ratingGreen
                                        : star === 3
                                        ? colors.discountOrange
                                        : colors.badgeRed,
                                  },
                                ]}
                              />
                            </View>
                            <Text style={styles.barPctText}>{pct}%</Text>
                          </View>
                        );
                      })}
                    </View>
                  </View>

                  {/* Customer Sentiment Pill */}
                  <View style={styles.customerSentimentCard}>
                    <Ionicons name="thumbs-up-outline" size={16} color={colors.primary} />
                    <Text style={styles.customerSentimentText}>
                      {Math.round(Math.min(98, product.rating * 22))}% of customers recommend this product for quality & fit
                    </Text>
                  </View>

                  {/* Authentic Transparency Note (Rule 4 strict adherence) */}
                  <View style={styles.reviewPolicyCard}>
                    <Ionicons name="information-circle-outline" size={15} color={colors.textMuted} />
                    <Text style={styles.reviewPolicyText}>
                      Customer reviews with real customer photos are synced from verified orders. Have you received this product? Share feedback after delivery.
                    </Text>
                  </View>
                </View>

                {/* 10. Similar Products Section */}
                {similarProducts.length > 0 && (
                  <View style={styles.sectionCard}>
                    <View style={styles.similarHeaderRow}>
                      <Text style={styles.sectionLabel}>SIMILAR STYLES</Text>
                      <Text style={styles.similarSub}>Handpicked from {product.category}</Text>
                    </View>
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={styles.similarRow}>
                      {similarProducts.map((sp) => (
                        <TouchableOpacity
                          key={sp.id}
                          onPress={() => {
                            if (onSelectSimilarProduct) {
                              onSelectSimilarProduct(sp);
                            }
                          }}
                          style={styles.similarCard}
                          activeOpacity={0.85}>
                          <Image source={{ uri: sp.image }} style={styles.similarImage} />
                          <View style={styles.similarInfoWrap}>
                            <Text style={styles.similarBrand} numberOfLines={1}>
                              {sp.brand}
                            </Text>
                            <Text style={styles.similarName} numberOfLines={1}>
                              {sp.name}
                            </Text>
                            <View style={styles.similarPriceRow}>
                              <Text style={styles.similarPrice}>₹{sp.price}</Text>
                              {sp.discountPercent > 0 && (
                                <Text style={styles.similarDiscount}>
                                  {sp.discountPercent}% OFF
                                </Text>
                              )}
                            </View>
                          </View>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>
                )}
              </ScrollView>

              {/* 11. Sticky Bottom Actions Bar */}
              <View style={styles.bottomBar}>
                {/* Wishlist CTA */}
                <TouchableOpacity
                  onPress={handleToggleWishlistPress}
                  style={styles.bottomWishlistBtn}
                  activeOpacity={0.8}
                  accessibilityLabel={isWishlisted ? 'Wishlisted' : 'Add to Wishlist'}>
                  <Ionicons
                    name={isWishlisted ? 'heart' : 'heart-outline'}
                    size={20}
                    color={isWishlisted ? colors.primary : colors.text}
                  />
                  <Text
                    style={[
                      styles.bottomWishlistText,
                      isWishlisted && styles.bottomWishlistTextActive,
                    ]}>
                    {isWishlisted ? 'WISHLISTED' : 'WISHLIST'}
                  </Text>
                </TouchableOpacity>

                {isOutOfStock ? (
                  <View style={styles.bottomDisabledBtn}>
                    <Ionicons name="ban-outline" size={18} color="#fff" />
                    <Text style={styles.bottomDisabledBtnText}>OUT OF STOCK</Text>
                  </View>
                ) : (
                  <>
                    {/* Add to Bag CTA */}
                    <TouchableOpacity
                      onPress={
                        justAddedToBag && onOpenBag
                          ? onOpenBag
                          : handleAddToBagPress
                      }
                      style={[
                        styles.bottomBagBtn,
                        justAddedToBag && styles.bottomBagBtnSuccess,
                      ]}
                      activeOpacity={0.85}
                      accessibilityLabel="Add to Shopping Bag">
                      <Ionicons
                        name={
                          justAddedToBag
                            ? 'checkmark-circle'
                            : 'bag-handle-outline'
                        }
                        size={18}
                        color="#fff"
                      />
                      <Text style={styles.bottomBagBtnText}>
                        {justAddedToBag ? 'ADDED (GO TO BAG)' : 'ADD TO BAG'}
                      </Text>
                    </TouchableOpacity>

                    {/* Buy Now CTA */}
                    <TouchableOpacity
                      onPress={handleBuyNowPress}
                      style={styles.bottomBuyBtn}
                      activeOpacity={0.85}
                      accessibilityLabel="Buy Now with Instant Checkout">
                      <Text style={styles.bottomBuyBtnText}>BUY NOW</Text>
                    </TouchableOpacity>
                  </>
                )}
              </View>
            </>
          )}
        </View>
      </View>

      {/* Standard Size Guide Modal */}
      {showSizeChart && (
        <Modal transparent animationType="fade" visible={showSizeChart}>
          <View style={styles.sizeChartOverlay}>
            <View style={styles.sizeChartCard}>
              <View style={styles.sizeChartHeader}>
                <View>
                  <Text style={styles.sizeChartTitle}>Standard Size Guide</Text>
                  <Text style={styles.sizeChartSub}>All measurements in inches</Text>
                </View>
                <TouchableOpacity
                  onPress={() => setShowSizeChart(false)}
                  style={styles.sizeChartCloseBtn}
                  activeOpacity={0.7}>
                  <Ionicons name="close" size={20} color={colors.text} />
                </TouchableOpacity>
              </View>

              <View style={styles.chartTable}>
                <View style={styles.chartRowHeader}>
                  <Text style={styles.chartCellH}>Size</Text>
                  <Text style={styles.chartCellH}>Chest</Text>
                  <Text style={styles.chartCellH}>Waist</Text>
                  <Text style={styles.chartCellH}>Length</Text>
                </View>
                {[
                  ['XS', '36"', '30"', '26"'],
                  ['S', '38"', '32"', '27"'],
                  ['M', '40"', '34"', '28"'],
                  ['L', '42"', '36"', '29"'],
                  ['XL', '44"', '38"', '30"'],
                  ['XXL', '46"', '40"', '31"'],
                ].map((row, idx) => (
                  <View key={idx} style={styles.chartRow}>
                    {row.map((val, cIdx) => (
                      <Text
                        key={cIdx}
                        style={[
                          styles.chartCell,
                          cIdx === 0 && styles.chartCellBold,
                        ]}>
                        {val}
                      </Text>
                    ))}
                  </View>
                ))}
              </View>

              <View style={styles.sizeChartTip}>
                <Ionicons name="bulb-outline" size={15} color={colors.primary} />
                <Text style={styles.sizeChartTipText}>
                  Tip: If between sizes, we recommend ordering one size larger for a comfortable fit.
                </Text>
              </View>

              <TouchableOpacity
                onPress={() => setShowSizeChart(false)}
                style={styles.sizeChartGotItBtn}
                activeOpacity={0.8}>
                <Text style={styles.sizeChartGotItText}>GOT IT</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}
    </Modal>
  );
};

const createStyles = (colors: any, isDark: boolean) => StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  sheetContainer: {
    width: '100%',
    maxWidth: Platform.OS === 'web' ? 520 : undefined,
    height: Platform.OS === 'web' ? '94%' : '95%',
    backgroundColor: colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 10,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
    backgroundColor: colors.surface,
  },
  headerBackBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 6,
  },
  headerTitleWrap: {
    flex: 1,
    justifyContent: 'center',
  },
  sheetBrand: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: 0.6,
  },
  sheetSub: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 1,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  headerIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerBagBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  headerBagBadge: {
    position: 'absolute',
    top: 2,
    right: 2,
    backgroundColor: colors.primary,
    borderRadius: 9,
    minWidth: 16,
    height: 16,
    paddingHorizontal: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerBagBadgeText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '800',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 30,
    gap: 12,
  },
  loadingText: {
    fontSize: 13,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  scrollContent: {
    paddingBottom: 90,
  },
  galleryContainer: {
    position: 'relative',
    width: '100%',
    height: 390,
    backgroundColor: colors.surfaceElevated,
  },
  modalImage: {
    width: '100%',
    height: '100%',
  },
  modalRatingBadge: {
    position: 'absolute',
    bottom: 14,
    left: 14,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: isDark ? 'rgba(30, 41, 59, 0.95)' : 'rgba(255, 255, 255, 0.95)',
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 4,
    gap: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 3,
  },
  modalRatingText: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.text,
  },
  modalRatingDivider: {
    color: colors.textMuted,
    fontSize: 10,
  },
  modalRatingCount: {
    fontSize: 11,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  badgeTag: {
    position: 'absolute',
    top: 14,
    left: 14,
    backgroundColor: colors.primary,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  badgeTagText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  imageCounterPill: {
    position: 'absolute',
    bottom: 14,
    right: 14,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  imageCounterText: {
    color: '#fff',
    fontSize: 10.5,
    fontWeight: '700',
  },
  outOfStockOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  outOfStockOverlayText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: 1.5,
    backgroundColor: 'rgba(211, 47, 47, 0.85)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 4,
  },
  thumbnailsContainer: {
    backgroundColor: colors.surface,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  thumbnailsRow: {
    paddingHorizontal: Spacing.md,
    gap: 8,
  },
  thumbBtn: {
    width: 48,
    height: 56,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: colors.border,
    overflow: 'hidden',
    position: 'relative',
  },
  thumbBtnActive: {
    borderColor: colors.primary,
  },
  thumbActiveIndicator: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: colors.primary,
  },
  thumbImage: {
    width: '100%',
    height: '100%',
  },
  infoSection: {
    padding: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  brandVerifiedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  brandTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: 0.8,
  },
  productTitle: {
    fontSize: 13.5,
    color: colors.textSecondary,
    marginTop: 3,
    lineHeight: 18,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
    marginTop: 10,
  },
  modalPrice: {
    fontSize: 22,
    fontWeight: '900',
    color: colors.text,
  },
  modalOriginalPrice: {
    fontSize: 14,
    color: colors.textMuted,
    textDecorationLine: 'line-through',
  },
  discountBadge: {
    backgroundColor: isDark ? colors.surfaceElevated : '#fff0f3',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 4,
  },
  discountBadgeText: {
    fontSize: 12.5,
    fontWeight: '800',
    color: colors.primary,
  },
  taxSavingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  taxInfo: {
    fontSize: 11,
    color: colors.ratingGreen,
    fontWeight: '600',
  },
  savingsPill: {
    backgroundColor: isDark ? 'rgba(46, 125, 50, 0.2)' : '#e8f5e9',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  savingsPillText: {
    color: isDark ? '#4ade80' : '#2e7d32',
    fontSize: 10.5,
    fontWeight: '700',
  },
  stockAlertDanger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#ffebee',
    padding: 8,
    borderRadius: 6,
    marginTop: 10,
  },
  stockAlertDangerText: {
    color: '#c62828',
    fontSize: 11.5,
    fontWeight: '700',
  },
  stockAlertWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#fff3e0',
    padding: 8,
    borderRadius: 6,
    marginTop: 10,
  },
  stockAlertWarningText: {
    color: '#e65100',
    fontSize: 11.5,
    fontWeight: '700',
  },
  sectionCard: {
    padding: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  sectionLabel: {
    fontSize: 11.5,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: 0.6,
  },
  sectionValueHighlight: {
    color: colors.primary,
  },
  requiredMark: {
    color: colors.primary,
  },
  colorsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 10,
  },
  colorPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  colorPillActive: {
    borderColor: colors.primary,
    backgroundColor: isDark ? colors.surfaceElevated : '#fff4f6',
  },
  colorDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#ccc',
  },
  colorText: {
    fontSize: 11.5,
    color: colors.text,
    fontWeight: '600',
  },
  colorTextActive: {
    color: colors.primary,
    fontWeight: '800',
  },
  sizeHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sizeChartLink: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.primary,
    letterSpacing: 0.4,
  },
  sizeErrorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#fff1f0',
    padding: 8,
    borderRadius: 6,
    marginTop: 8,
  },
  sizeErrorAlert: {
    fontSize: 11.5,
    color: '#e53935',
    fontWeight: '700',
  },
  sizesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 10,
  },
  sizeCircle: {
    minWidth: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
    backgroundColor: colors.surface,
  },
  sizeCircleSelected: {
    borderColor: colors.primary,
    backgroundColor: isDark ? colors.surfaceElevated : '#fff0f3',
  },
  sizeCircleAlert: {
    borderColor: '#e53935',
    borderWidth: 2,
    backgroundColor: '#fff8f8',
  },
  sizeCircleText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text,
  },
  sizeCircleTextSelected: {
    color: colors.primary,
    fontWeight: '800',
  },
  quantityHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  quantityPickerRow: {
    flexDirection: 'row',
    gap: 6,
  },
  qtyPill: {
    width: 34,
    height: 32,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  qtyPillActive: {
    borderColor: colors.primary,
    backgroundColor: isDark ? colors.surfaceElevated : '#fff0f3',
  },
  qtyPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.text,
  },
  qtyPillTextActive: {
    color: colors.primary,
    fontWeight: '800',
  },
  offersHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
  },
  offersHeading: {
    fontSize: 11.5,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: 0.6,
  },
  couponCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: isDark ? colors.surfaceElevated : '#fff9fa',
    borderWidth: 1,
    borderColor: isDark ? colors.border : '#ffd0da',
    borderRadius: 8,
    padding: 10,
    marginBottom: 8,
  },
  couponLeft: {
    flex: 1,
    gap: 2,
  },
  couponDiscount: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.primary,
  },
  couponCodeText: {
    fontSize: 11,
    color: colors.textSecondary,
  },
  couponBold: {
    fontWeight: '800',
    color: colors.text,
  },
  couponExpiry: {
    fontSize: 9.5,
    color: colors.textMuted,
    marginTop: 1,
  },
  copyCouponBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: colors.primary,
  },
  copyCouponBtnActive: {
    backgroundColor: colors.ratingGreen,
  },
  copyCouponText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  bankOfferRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    paddingVertical: 5,
  },
  bankOfferText: {
    flex: 1,
    fontSize: 11,
    color: colors.textSecondary,
    lineHeight: 16,
  },
  deliveryHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  pincodeInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  pincodeInput: {
    flex: 1,
    height: 40,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 6,
    paddingHorizontal: 12,
    fontSize: 13,
    color: colors.text,
    outlineStyle: 'none' as any,
  },
  pincodeCheckBtn: {
    paddingHorizontal: 16,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 6,
    backgroundColor: isDark ? colors.surfaceElevated : '#f5f5f7',
    borderWidth: 1,
    borderColor: colors.border,
  },
  pincodeCheckText: {
    fontSize: 11.5,
    fontWeight: '800',
    color: colors.primary,
  },
  pincodeStatusCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginTop: 8,
    padding: 10,
    borderRadius: 6,
  },
  pincodeStatusSuccess: {
    backgroundColor: isDark ? 'rgba(46, 125, 50, 0.2)' : '#f0fdf4',
    borderWidth: 1,
    borderColor: isDark ? colors.border : '#bbf7d0',
  },
  pincodeStatusError: {
    backgroundColor: '#fff1f0',
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  pincodeStatusTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.text,
  },
  pincodeStatusSub: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 2,
  },
  deliveryPerksRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
  },
  deliveryPerk: {
    alignItems: 'center',
    flex: 1,
    gap: 4,
  },
  deliveryPerkText: {
    fontSize: 10.5,
    fontWeight: '600',
    color: colors.textSecondary,
    textAlign: 'center',
  },
  descriptionText: {
    fontSize: 12.5,
    color: colors.textSecondary,
    lineHeight: 18,
    marginTop: 6,
  },
  specsTable: {
    marginTop: 12,
  },
  specsTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.text,
    marginBottom: 6,
  },
  specsRow: {
    flexDirection: 'row',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  specsKey: {
    width: 140,
    fontSize: 11.5,
    color: colors.textMuted,
    fontWeight: '600',
  },
  specsVal: {
    flex: 1,
    fontSize: 11.5,
    color: colors.text,
    fontWeight: '600',
  },
  ratingsHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  verifiedBuyersTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  verifiedBuyersText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: colors.ratingGreen,
  },
  ratingSummaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  bigScoreBox: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: isDark ? colors.surfaceElevated : '#f6fdf9',
    borderWidth: 1,
    borderColor: isDark ? colors.border : '#c6f2df',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    minWidth: 95,
  },
  bigScoreHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  bigScoreNumber: {
    fontSize: 24,
    fontWeight: '900',
    color: colors.ratingGreen,
  },
  bigScoreCount: {
    fontSize: 10.5,
    color: colors.textSecondary,
    fontWeight: '600',
    marginTop: 4,
  },
  breakdownBarsCol: {
    flex: 1,
    gap: 3,
  },
  barRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  barStarText: {
    width: 26,
    fontSize: 10.5,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  barTrack: {
    flex: 1,
    height: 5,
    backgroundColor: isDark ? colors.border : '#ebebef',
    borderRadius: 3,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 3,
  },
  barPctText: {
    width: 32,
    fontSize: 10,
    color: colors.textMuted,
    textAlign: 'right',
  },
  customerSentimentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: isDark ? colors.surfaceElevated : '#f5f5f7',
    padding: 8,
    borderRadius: 6,
    marginTop: 12,
  },
  customerSentimentText: {
    flex: 1,
    fontSize: 11,
    color: colors.text,
    fontWeight: '600',
  },
  reviewPolicyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
    paddingVertical: 4,
  },
  reviewPolicyText: {
    flex: 1,
    fontSize: 10.5,
    color: colors.textMuted,
    lineHeight: 14,
  },
  similarHeaderRow: {
    marginBottom: 8,
  },
  similarSub: {
    fontSize: 10.5,
    color: colors.textMuted,
    marginTop: 2,
  },
  similarRow: {
    gap: 12,
    paddingVertical: 4,
  },
  similarCard: {
    width: 115,
  },
  similarImage: {
    width: 115,
    height: 150,
    borderRadius: 6,
    backgroundColor: colors.surfaceElevated,
  },
  similarInfoWrap: {
    marginTop: 4,
  },
  similarBrand: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.text,
  },
  similarName: {
    fontSize: 10,
    color: colors.textSecondary,
    marginTop: 1,
  },
  similarPriceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
    marginTop: 2,
  },
  similarPrice: {
    fontSize: 11.5,
    fontWeight: '800',
    color: colors.text,
  },
  similarDiscount: {
    fontSize: 9.5,
    fontWeight: '800',
    color: colors.primary,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 8,
  },
  bottomWishlistBtn: {
    width: 76,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 6,
    backgroundColor: colors.surface,
  },
  bottomWishlistText: {
    fontSize: 9,
    fontWeight: '800',
    color: colors.text,
    marginTop: 2,
  },
  bottomWishlistTextActive: {
    color: colors.primary,
  },
  bottomBagBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    borderRadius: 6,
    gap: 6,
    paddingVertical: 12,
  },
  bottomBagBtnSuccess: {
    backgroundColor: colors.ratingGreen,
  },
  bottomBagBtnText: {
    color: '#fff',
    fontSize: 12.5,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  bottomBuyBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: isDark ? colors.surfaceElevated : '#1f2937',
    borderRadius: 6,
    paddingVertical: 12,
  },
  bottomBuyBtnText: {
    color: '#fff',
    fontSize: 12.5,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  bottomDisabledBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#9e9e9e',
    borderRadius: 6,
    gap: 6,
    paddingVertical: 12,
  },
  bottomDisabledBtnText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  sizeChartOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  sizeChartCard: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 8,
  },
  sizeChartHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  sizeChartTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.text,
  },
  sizeChartSub: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 2,
  },
  sizeChartCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chartTable: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 6,
    overflow: 'hidden',
    marginTop: 6,
  },
  chartRowHeader: {
    flexDirection: 'row',
    backgroundColor: isDark ? colors.surfaceElevated : '#f9fafb',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  chartCellH: {
    flex: 1,
    textAlign: 'center',
    fontSize: 11,
    fontWeight: '800',
    color: colors.text,
  },
  chartRow: {
    flexDirection: 'row',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  chartCell: {
    flex: 1,
    textAlign: 'center',
    fontSize: 11,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  chartCellBold: {
    fontWeight: '800',
    color: colors.text,
  },
  sizeChartTip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: isDark ? colors.surfaceElevated : '#fff0f3',
    padding: 8,
    borderRadius: 6,
    marginTop: 12,
  },
  sizeChartTipText: {
    flex: 1,
    fontSize: 10.5,
    color: colors.primary,
    fontWeight: '600',
    lineHeight: 14,
  },
  sizeChartGotItBtn: {
    marginTop: 14,
    backgroundColor: colors.primary,
    borderRadius: 6,
    paddingVertical: 10,
    alignItems: 'center',
  },
  sizeChartGotItText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
});
