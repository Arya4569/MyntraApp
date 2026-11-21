import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Image,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { CheckoutModal } from './CheckoutModal';

import { Spacing } from '@/constants/myntra-theme';
import { useAuth } from '@/context/AuthContext';
import { AVAILABLE_COUPONS, Product, PRODUCTS } from '@/data/mock-data';
import { useTheme } from '@/hooks/use-theme';
import { storeService } from '@/services/store-service';
import { CartItem, Coupon, DeliveryAddress, Order } from '@/types/store';

interface ShoppingBagModalProps {
  visible: boolean;
  cartItems: CartItem[];
  savedForLaterItems?: CartItem[];
  onClose: () => void;
  onUpdateQuantity: (cartItemId: string, newQty: number) => Promise<void>;
  onRemoveItem: (cartItemId: string) => Promise<void>;
  onSaveForLater?: (cartItemId: string) => Promise<void>;
  onMoveSavedToBag?: (savedItemId: string) => Promise<void>;
  onRemoveSavedItem?: (savedItemId: string) => Promise<void>;
  onOrderPlaced: (order: Order) => void;
  onOpenAuth: () => void;
  onStartShopping?: () => void;
  onMoveToWishlist?: (cartItem: CartItem) => Promise<void>;
  onPressProduct?: (product: Product) => void;
  onClearBag?: () => Promise<void>;
  onUpdateVariant?: (cartItemId: string, newSize: string, newColor?: string) => Promise<void>;
  onAddToCart?: (product: Product, size: string, color?: string) => Promise<void>;
  onGoToOrders?: () => void;
  allProducts?: Product[];
  onRefreshBag?: () => Promise<void>;
}

export const ShoppingBagModal: React.FC<ShoppingBagModalProps> = ({
  visible,
  cartItems,
  savedForLaterItems = [],
  onClose,
  onUpdateQuantity,
  onRemoveItem,
  onSaveForLater,
  onMoveSavedToBag,
  onRemoveSavedItem,
  onOrderPlaced,
  onOpenAuth,
  onStartShopping,
  onMoveToWishlist,
  onPressProduct,
  onClearBag,
  onUpdateVariant,
  onAddToCart,
  onGoToOrders,
  allProducts = PRODUCTS,
  onRefreshBag,
}) => {
  const { isAuthenticated, user } = useAuth();
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => createStyles(colors, isDark), [colors, isDark]);

  // 1. Coupon State
  const [availableCoupons, setAvailableCoupons] = useState<Coupon[]>(AVAILABLE_COUPONS);
  const [couponCodeInput, setCouponCodeInput] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<Coupon | null>(null);
  const [couponMessage, setCouponMessage] = useState<{
    text: string;
    isError: boolean;
  } | null>(null);
  const [showCouponsSheet, setShowCouponsSheet] = useState(false);

  useEffect(() => {
    if (visible) {
      let isMounted = true;
      const loadCoupons = async () => {
        try {
          const remoteCoupons = await storeService.fetchCoupons();
          if (isMounted && remoteCoupons?.length > 0) {
            setAvailableCoupons(remoteCoupons);
          }
        } catch {
          // fallback
        }
      };
      loadCoupons();
      return () => {
        isMounted = false;
      };
    }
  }, [visible]);

  // 2. Checkout Modal & Order State
  const [showCheckout, setShowCheckout] = useState(false);
  const [confirmedOrder, setConfirmedOrder] = useState<Order | null>(null);

  // 3. Delivery Address / Pincode State
  const [deliveryPincode, setDeliveryPincode] = useState('400001');
  const [deliveryCity, setDeliveryCity] = useState('Mumbai');
  const [showAddressPicker, setShowAddressPicker] = useState(false);
  const [savedAddresses, setSavedAddresses] = useState<DeliveryAddress[]>([]);
  const [selectedAddress, setSelectedAddress] = useState<DeliveryAddress | null>(null);
  const [pincodeInput, setPincodeInput] = useState('400001');

  // 4. Variant Change Bottom Sheet
  const [variantModalItem, setVariantModalItem] = useState<CartItem | null>(null);
  const [tempSelectedSize, setTempSelectedSize] = useState<string>('');

  // 5. Remove Confirmation & Undo State
  const [itemToRemove, setItemToRemove] = useState<CartItem | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [lastRemovedItem, setLastRemovedItem] = useState<CartItem | null>(null);
  const [showUndoSnackbar, setShowUndoSnackbar] = useState(false);

  // Load addresses on open
  useEffect(() => {
    let isMounted = true;
    if (visible) {
      storeService.getAddresses().then((addrs) => {
        if (isMounted) {
          setSavedAddresses(addrs);
          const def = addrs.find((a) => a.isDefault) || addrs[0];
          if (def) {
            setSelectedAddress(def);
            setDeliveryPincode(def.pincode);
            setDeliveryCity(def.city);
          } else {
            setSelectedAddress(null);
          }
        }
      });
    }
    return () => {
      isMounted = false;
    };
  }, [visible, user?.id]);

  // Price Calculations (Derived strictly from cart data)
  const totalMRP = cartItems.reduce(
    (acc, item) => acc + item.product.originalPrice * item.quantity,
    0
  );
  const totalSellingPrice = cartItems.reduce(
    (acc, item) => acc + item.product.price * item.quantity,
    0
  );
  const totalMRPDiscount = totalMRP - totalSellingPrice;

  // Coupon Calculation
  let couponDiscount = 0;
  if (appliedCoupon) {
    if (totalSellingPrice >= appliedCoupon.minOrder) {
      if (appliedCoupon.discountType === 'flat') {
        couponDiscount = appliedCoupon.discountValue;
      } else {
        couponDiscount = Math.round(
          (totalSellingPrice * appliedCoupon.discountValue) / 100
        );
      }
    }
  }

  // Delivery Free threshold (₹799 standard)
  const isFreeDelivery =
    totalSellingPrice >= 799 ||
    totalSellingPrice === 0 ||
    appliedCoupon?.code === 'FREEDEL';
  const deliveryFee = isFreeDelivery ? 0 : 49;
  const finalPayable = Math.max(
    0,
    totalSellingPrice - couponDiscount + deliveryFee
  );
  const totalSavings = totalMRPDiscount + couponDiscount;

  // Catalog recommendations for empty cart and footer carousel
  const recommendedPicks = React.useMemo(() => {
    const inCartIds = new Set(cartItems.map((c) => c.productId));
    const catalogSource = allProducts && allProducts.length > 0 ? allProducts : PRODUCTS;
    return catalogSource.filter((p) => !inCartIds.has(p.id)).slice(0, 6);
  }, [cartItems, allProducts]);

  // Apply Coupon
  const handleApplyCouponCode = (codeToApply: string) => {
    const code = codeToApply.trim().toUpperCase();
    const found = availableCoupons.find((c) => c.code.toUpperCase() === code);

    if (!found) {
      setCouponMessage({
        text: `Invalid coupon code "${code}". Tap "View Coupons" for active offers.`,
        isError: true,
      });
      return;
    }

    if (totalSellingPrice < found.minOrder) {
      setCouponMessage({
        text: `Add ₹${found.minOrder - totalSellingPrice} more to your cart to use ${found.code}.`,
        isError: true,
      });
      return;
    }

    setAppliedCoupon(found);
    setCouponCodeInput(found.code);
    setCouponMessage({
      text: `Coupon ${found.code} applied! You saved ${found.title}! 🎉`,
      isError: false,
    });
    setShowCouponsSheet(false);
  };

  const handleRemoveCoupon = () => {
    setAppliedCoupon(null);
    setCouponCodeInput('');
    setCouponMessage(null);
  };

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isValidatingCheckout, setIsValidatingCheckout] = useState(false);

  // Stepper handlers
  const handleDecrement = (item: CartItem) => {
    if (item.quantity === 1) {
      setItemToRemove(item);
    } else {
      onUpdateQuantity(item.id, item.quantity - 1);
    }
  };

  const handleIncrement = (item: CartItem) => {
    const maxStock = item.availableStock ?? item.product.stockCount ?? 10;
    if (item.quantity >= maxStock) {
      Alert.alert(
        'Stock Limit Reached',
        `Only ${maxStock} unit(s) available in stock for "${item.product.name}".`
      );
      return;
    }
    onUpdateQuantity(item.id, item.quantity + 1);
  };

  // Remove Item with Undo
  const handleConfirmRemoveItem = async () => {
    if (!itemToRemove) return;
    const item = itemToRemove;
    setItemToRemove(null);
    setLastRemovedItem(item);
    setShowUndoSnackbar(true);

    await onRemoveItem(item.id);

    // Auto-dismiss undo snackbar after 4.5 seconds
    setTimeout(() => {
      setShowUndoSnackbar(false);
    }, 4500);
  };

  // Undo Item Removal
  const handleUndoRemoval = async () => {
    if (!lastRemovedItem) return;
    const item = lastRemovedItem;
    setLastRemovedItem(null);
    setShowUndoSnackbar(false);

    if (onAddToCart) {
      await onAddToCart(item.product, item.size, item.color);
    }
  };

  // Change Variant (Size)
  const handleOpenVariantPicker = (item: CartItem) => {
    setVariantModalItem(item);
    setTempSelectedSize(item.size);
  };

  const handleSaveVariant = async () => {
    if (!variantModalItem || !tempSelectedSize) return;
    if (onUpdateVariant) {
      await onUpdateVariant(variantModalItem.id, tempSelectedSize, variantModalItem.color);
    }
    setVariantModalItem(null);
  };

  // Change Address / Pincode
  const handleApplyPincode = () => {
    const clean = pincodeInput.replace(/\D/g, '');
    if (clean.length === 6) {
      setDeliveryPincode(clean);
      setDeliveryCity('Verified Location');
      setShowAddressPicker(false);
    } else {
      Alert.alert('Invalid PIN Code', 'Please enter a valid 6-digit Indian PIN code.');
    }
  };

  const handleProceedToCheckout = async () => {
    if (!isAuthenticated) {
      onOpenAuth();
      return;
    }

    setIsValidatingCheckout(true);
    try {
      const validation = await storeService.validateCart();
      if (!validation.valid) {
        const outOfStockIssue = validation.issues.find(
          (i) => i.type === 'OUT_OF_STOCK' || i.type === 'DISCONTINUED'
        );
        if (outOfStockIssue) {
          Alert.alert(
            'Item Unavailable',
            `${outOfStockIssue.message}\nPlease remove or save this item for later before proceeding.`
          );
          setIsValidatingCheckout(false);
          return;
        }

        const stockExceeded = validation.issues.find((i) => i.type === 'STOCK_EXCEEDED');
        if (stockExceeded) {
          Alert.alert(
            'Stock Limit Exceeded',
            `${stockExceeded.message}\nPlease update item quantity before proceeding.`
          );
          setIsValidatingCheckout(false);
          return;
        }
      }

      if (validation.hasPriceChanges) {
        const priceIssue = validation.issues.find((i) => i.type === 'PRICE_CHANGED');
        Alert.alert(
          'Price Updated',
          priceIssue
            ? priceIssue.message
            : 'Item prices have been refreshed with latest catalog prices.'
        );
      }
    } catch (e) {
      console.warn('Checkout validation notice:', e);
    } finally {
      setIsValidatingCheckout(false);
    }

    setShowCheckout(true);
  };

  const handleOrderConfirmed = (order: Order) => {
    setConfirmedOrder(order);
    setShowCheckout(false);
    onOrderPlaced(order);
  };

  const handleCloseAll = () => {
    setConfirmedOrder(null);
    setShowCheckout(false);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={handleCloseAll}>
      <View style={styles.overlay}>
        <View style={styles.sheetContainer}>
          {/* 1. Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <TouchableOpacity onPress={handleCloseAll} style={styles.backBtn} activeOpacity={0.7}>
                <Ionicons name="arrow-back" size={22} color={colors.text} />
              </TouchableOpacity>
              <View>
                <Text style={styles.headerTitle}>MY BAG</Text>
                <Text style={styles.itemCount}>
                  {cartItems.reduce((acc, i) => acc + i.quantity, 0)} {cartItems.length === 1 ? 'Item' : 'Items'}
                </Text>
              </View>
            </View>

            <View style={styles.headerRight}>
              {onRefreshBag && !confirmedOrder && (
                <TouchableOpacity
                  onPress={async () => {
                    setIsRefreshing(true);
                    try {
                      await onRefreshBag();
                    } finally {
                      setIsRefreshing(false);
                    }
                  }}
                  style={styles.headerActionBtn}
                  activeOpacity={0.7}
                  accessibilityLabel="Refresh shopping bag">
                  <Ionicons
                    name="sync-outline"
                    size={20}
                    color={isRefreshing ? colors.primary : colors.textMuted}
                  />
                </TouchableOpacity>
              )}
              {cartItems.length > 0 && !confirmedOrder && onClearBag && (
                <TouchableOpacity
                  onPress={() => setShowClearConfirm(true)}
                  style={styles.headerActionBtn}
                  activeOpacity={0.7}
                  accessibilityLabel="Clear shopping bag">
                  <Ionicons name="trash-outline" size={20} color={colors.textMuted} />
                </TouchableOpacity>
              )}
              <TouchableOpacity
                onPress={handleCloseAll}
                style={styles.headerActionBtn}
                activeOpacity={0.7}
                accessibilityLabel="Close bag">
                <Ionicons name="close" size={22} color={colors.text} />
              </TouchableOpacity>
            </View>
          </View>

          {/* 2. Empty Bag Experience (when both cart and saved items are empty) */}
          {cartItems.length === 0 && savedForLaterItems.length === 0 && !confirmedOrder && (
            <ScrollView
              style={styles.emptyScroll}
              contentContainerStyle={styles.emptyContainer}
              showsVerticalScrollIndicator={false}>
              <View style={styles.emptyIconCircle}>
                <Ionicons
                  name="bag-handle-outline"
                  size={52}
                  color={colors.primary}
                />
              </View>
              <Text style={styles.emptyTitle}>YOUR SHOPPING BAG IS EMPTY</Text>
              <Text style={styles.emptySubtitle}>
                There is nothing in your bag. Discover trending styles and fill your bag with fashion favorites.
              </Text>
              <TouchableOpacity
                onPress={() => {
                  onClose();
                  onStartShopping?.();
                }}
                style={styles.startShoppingBtn}
                activeOpacity={0.85}>
                <Text style={styles.startShoppingBtnText}>CONTINUE SHOPPING</Text>
              </TouchableOpacity>

              {/* Recommendations for Empty Cart */}
              {recommendedPicks.length > 0 && (
                <View style={styles.emptyRecSection}>
                  <Text style={styles.emptyRecTitle}>POPULAR PICKS FOR YOU</Text>
                  <Text style={styles.emptyRecSubtitle}>Trending styles ready to add to your bag</Text>
                  <View style={styles.emptyRecGrid}>
                    {recommendedPicks.map((product) => (
                      <View key={`empty-rec-${product.id}`} style={styles.emptyRecCard}>
                        <TouchableOpacity
                          activeOpacity={0.9}
                          onPress={() => {
                            onClose();
                            onPressProduct?.(product);
                          }}>
                          <Image source={{ uri: product.image }} style={styles.emptyRecImage} />
                          <View style={styles.emptyRecDetails}>
                            <Text style={styles.emptyRecBrand} numberOfLines={1}>
                              {product.brand}
                            </Text>
                            <Text style={styles.emptyRecName} numberOfLines={1}>
                              {product.name}
                            </Text>
                            <Text style={styles.emptyRecPrice}>₹{product.price}</Text>
                          </View>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.emptyRecAddBtn}
                          onPress={() => {
                            const defSize = product.sizes[0] || 'One Size';
                            onAddToCart?.(product, defSize, product.colors[0]);
                          }}
                          activeOpacity={0.8}>
                          <Ionicons name="bag-add" size={13} color={colors.primary} />
                          <Text style={styles.emptyRecAddText}>ADD TO BAG</Text>
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                </View>
              )}
            </ScrollView>
          )}

          {/* 3. Placed Order Confirmation View */}
          {confirmedOrder && (
            <View style={styles.confirmedContainer}>
              <View style={styles.confirmedIconCircle}>
                <Ionicons
                  name="checkmark-circle"
                  size={58}
                  color={colors.ratingGreen}
                />
              </View>
              <Text style={styles.confirmedTitle}>ORDER PLACED SUCCESSFULLY!</Text>
              <Text style={styles.confirmedId}>Order #{confirmedOrder.id}</Text>
              <Text style={styles.confirmedSub}>
                Thank you! Your order has been placed and will be delivered by{' '}
                <Text style={styles.confirmedDateBold}>
                  {confirmedOrder.deliveryDate}
                </Text>.
              </Text>

              <View style={styles.orderSummaryCard}>
                <View style={styles.orderSummaryRow}>
                  <Text style={styles.orderSummaryLabel}>Items Placed</Text>
                  <Text style={styles.orderSummaryVal}>
                    {confirmedOrder.items.length} Items
                  </Text>
                </View>
                <View style={styles.orderSummaryRow}>
                  <Text style={styles.orderSummaryLabel}>Payment</Text>
                  <Text style={styles.orderSummaryVal}>
                    {confirmedOrder.paymentMethod}
                  </Text>
                </View>
                <View style={styles.orderSummaryRow}>
                  <Text style={styles.orderSummaryLabel}>Amount Paid</Text>
                  <Text style={styles.orderSummaryTotal}>
                    ₹{confirmedOrder.totalAmount}
                  </Text>
                </View>
              </View>

              <View style={styles.confirmedButtonsRow}>
                {onGoToOrders && (
                  <TouchableOpacity
                    onPress={() => {
                      setConfirmedOrder(null);
                      setShowCheckout(false);
                      onClose();
                      onGoToOrders();
                    }}
                    style={styles.trackInOrdersBtn}
                    activeOpacity={0.85}>
                    <Ionicons name="cube-outline" size={16} color="#fff" />
                    <Text style={styles.trackInOrdersBtnText}>VIEW IN MY ORDERS</Text>
                  </TouchableOpacity>
                )}

                <TouchableOpacity
                  onPress={handleCloseAll}
                  style={styles.trackOrderBtn}
                  activeOpacity={0.85}>
                  <Text style={styles.trackOrderBtnText}>CONTINUE SHOPPING</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* 4. Active Cart & Save for Later Experience */}
          {(cartItems.length > 0 || savedForLaterItems.length > 0) && !confirmedOrder && (
            <>
              <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.scrollContent}>
                {/* Notice when active cart is empty but saved items exist */}
                {cartItems.length === 0 && (
                  <View style={styles.emptyCartWithSavedCard}>
                    <Ionicons name="bag-outline" size={32} color={colors.textMuted} />
                    <Text style={styles.emptyCartWithSavedTitle}>Your Active Bag is Empty</Text>
                    <Text style={styles.emptyCartWithSavedSub}>
                      You have {savedForLaterItems.length} item{savedForLaterItems.length === 1 ? '' : 's'} in your Save for Later list below. Move items to your bag when you are ready to checkout.
                    </Text>
                  </View>
                )}

                {cartItems.length > 0 && (
                  <>
                {/* Delivery Address / PIN Code Strip */}
                <View style={styles.deliveryBanner}>
                  <View style={styles.deliveryBannerLeft}>
                    <Ionicons name="location-outline" size={18} color={colors.text} />
                    <View style={styles.deliveryBannerTextCol}>
                      <Text style={styles.deliveryToLabel}>
                        Deliver to: <Text style={styles.deliveryToBold}>{selectedAddress ? selectedAddress.name : 'Current Location'}</Text>, {deliveryCity ? `${deliveryCity} - ` : ''}{deliveryPincode}
                      </Text>
                      <Text style={styles.deliveryEstimate}>
                        Express delivery in 2-3 business days
                      </Text>
                    </View>
                  </View>
                  <TouchableOpacity
                    onPress={() => setShowAddressPicker(true)}
                    style={styles.changeAddressBtn}
                    activeOpacity={0.7}>
                    <Text style={styles.changeAddressText}>CHANGE</Text>
                  </TouchableOpacity>
                </View>

                {/* Free Delivery Progress Strip */}
                <View style={styles.freeDelStrip}>
                  <View style={styles.freeDelIconRow}>
                    <Ionicons
                      name="car-outline"
                      size={16}
                      color={isFreeDelivery ? colors.ratingGreen : colors.primary}
                    />
                    <Text style={styles.freeDelText}>
                      {isFreeDelivery
                        ? '🎉 Yay! FREE Delivery applied on this order.'
                        : `Add ₹${799 - totalSellingPrice} more to get FREE Delivery!`}
                    </Text>
                  </View>
                  {!isFreeDelivery && (
                    <View style={styles.progressBarBg}>
                      <View
                        style={[
                          styles.progressBarFill,
                          { width: `${Math.min(100, (totalSellingPrice / 799) * 100)}%` },
                        ]}
                      />
                    </View>
                  )}
                </View>

                {/* Cart Line Items */}
                <View style={styles.itemsList}>
                  {cartItems.map((item) => {
                    const lineMRP = item.product.originalPrice * item.quantity;
                    const lineSelling = item.product.price * item.quantity;
                    const hasDiscount = lineMRP > lineSelling;

                    return (
                      <View key={item.id} style={styles.itemCard}>
                        <TouchableOpacity
                          activeOpacity={0.9}
                          onPress={() => onPressProduct?.(item.product)}
                          style={styles.imageCol}>
                          <Image
                            source={{ uri: item.product.image }}
                            style={styles.itemImage}
                            resizeMode="cover"
                          />
                        </TouchableOpacity>

                        <View style={styles.itemInfo}>
                          {/* Brand & Remove Cross */}
                          <View style={styles.itemHeaderRow}>
                            <Text style={styles.itemBrand} numberOfLines={1}>
                              {item.product.brand}
                            </Text>
                            <TouchableOpacity
                              onPress={() => setItemToRemove(item)}
                              style={styles.removeCrossBtn}
                              activeOpacity={0.7}
                              accessibilityLabel="Remove item">
                              <Ionicons
                                name="close"
                                size={17}
                                color={colors.textMuted}
                              />
                            </TouchableOpacity>
                          </View>

                          {/* Product Title */}
                          <Text style={styles.itemName} numberOfLines={1}>
                            {item.product.name}
                          </Text>

                          {/* Interactive Variant Selectors */}
                          <View style={styles.variantSelectorsRow}>
                            <TouchableOpacity
                              style={styles.variantPickerBtn}
                              onPress={() => handleOpenVariantPicker(item)}
                              activeOpacity={0.75}>
                              <Text style={styles.variantPickerText}>
                                Size: <Text style={styles.variantPickerBold}>{item.size}</Text>
                              </Text>
                              <Ionicons name="chevron-down" size={12} color={colors.textSecondary} />
                            </TouchableOpacity>

                            {item.color && (
                              <View style={styles.colorPill}>
                                <Text style={styles.colorPillText}>{item.color}</Text>
                              </View>
                            )}
                          </View>

                          {/* Price & Quantity Stepper */}
                          <View style={styles.itemPriceAndQtyRow}>
                            <View style={styles.priceCol}>
                              <View style={styles.priceRow}>
                                <Text style={styles.itemPrice}>₹{lineSelling}</Text>
                                {hasDiscount && (
                                  <Text style={styles.itemOriginalPrice}>₹{lineMRP}</Text>
                                )}
                              </View>
                              {item.product.discountPercent > 0 && (
                                <Text style={styles.itemDiscountText}>
                                  {item.product.discountPercent}% OFF
                                </Text>
                              )}
                            </View>

                            {/* Stepper */}
                            <View style={styles.stepperContainer}>
                              <TouchableOpacity
                                onPress={() => handleDecrement(item)}
                                style={styles.stepperBtn}
                                activeOpacity={0.7}
                                accessibilityLabel="Decrease quantity">
                                <Ionicons name="remove" size={14} color={colors.text} />
                              </TouchableOpacity>
                              <Text style={styles.stepperQty}>{item.quantity}</Text>
                              <TouchableOpacity
                                onPress={() => handleIncrement(item)}
                                disabled={
                                  (item.availableStock !== undefined
                                    ? item.availableStock
                                    : item.product.stockCount ?? 10) <= item.quantity
                                }
                                style={[
                                  styles.stepperBtn,
                                  (item.availableStock !== undefined
                                    ? item.availableStock
                                    : item.product.stockCount ?? 10) <= item.quantity &&
                                    styles.stepperBtnDisabled,
                                ]}
                                activeOpacity={0.7}
                                accessibilityLabel="Increase quantity">
                                <Ionicons
                                  name="add"
                                  size={14}
                                  color={
                                    (item.availableStock !== undefined
                                      ? item.availableStock
                                      : item.product.stockCount ?? 10) <= item.quantity
                                      ? colors.textMuted
                                      : colors.text
                                  }
                                />
                              </TouchableOpacity>
                            </View>
                          </View>

                          {/* Stock & Delivery Reassurance */}
                          <View style={styles.assuranceRow}>
                            {item.isOutOfStock ? (
                              <Text style={styles.outOfStockBadge}>⚠️ Out of Stock</Text>
                            ) : (item.availableStock !== undefined
                                ? item.availableStock
                                : item.product.stockCount ?? 10) <= 3 ? (
                              <Text style={styles.lowStockText}>
                                🔥 Only{' '}
                                {item.availableStock !== undefined
                                  ? item.availableStock
                                  : item.product.stockCount ?? 10}{' '}
                                left in stock!
                              </Text>
                            ) : (
                              <Text style={styles.inStockText}>✓ In Stock</Text>
                            )}
                            <Text style={styles.assuranceDot}>•</Text>
                            <Text style={styles.returnText}>14 Days Returnable</Text>
                          </View>

                          {/* Move to Wishlist & Save for Later Action Buttons */}
                          <View style={styles.itemActionsBottomRow}>
                            <TouchableOpacity
                              onPress={async () => {
                                if (onSaveForLater) {
                                  await onSaveForLater(item.id);
                                }
                              }}
                              style={styles.saveForLaterBtn}
                              activeOpacity={0.75}>
                              <Ionicons
                                name="bookmark-outline"
                                size={14}
                                color={colors.textSecondary}
                              />
                              <Text style={styles.saveForLaterText}>SAVE FOR LATER</Text>
                            </TouchableOpacity>

                            <View style={styles.actionDivider} />

                            <TouchableOpacity
                              onPress={async () => {
                                if (onMoveToWishlist) {
                                  await onMoveToWishlist(item);
                                }
                              }}
                              style={styles.moveToWishlistBtn}
                              activeOpacity={0.75}>
                              <Ionicons
                                name="heart-outline"
                                size={14}
                                color={colors.primary}
                              />
                              <Text style={styles.moveToWishlistText}>MOVE TO WISHLIST</Text>
                            </TouchableOpacity>
                          </View>
                        </View>
                      </View>
                    );
                  })}
                </View>

                {/* 5. Coupons & Offers Section */}
                <View style={styles.couponsCard}>
                  <View style={styles.couponHeaderRow}>
                    <View style={styles.couponHeaderLeft}>
                      <Ionicons
                        name="pricetag-outline"
                        size={16}
                        color={colors.primary}
                      />
                      <Text style={styles.couponSectionTitle}>COUPONS & OFFERS</Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => setShowCouponsSheet(!showCouponsSheet)}
                      activeOpacity={0.7}>
                      <Text style={styles.viewCouponsLink}>
                        {showCouponsSheet ? 'HIDE OFFERS' : 'VIEW OFFERS'}
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {/* Input and Apply */}
                  <View style={styles.couponInputRow}>
                    <TextInput
                      style={styles.couponInput}
                      placeholder="Enter Coupon Code (e.g. MYNTRA500)"
                      placeholderTextColor={colors.textMuted}
                      autoCapitalize="characters"
                      value={couponCodeInput}
                      onChangeText={setCouponCodeInput}
                    />
                    {appliedCoupon ? (
                      <TouchableOpacity
                        onPress={handleRemoveCoupon}
                        style={styles.removeCouponBtn}>
                        <Text style={styles.removeCouponText}>REMOVE</Text>
                      </TouchableOpacity>
                    ) : (
                      <TouchableOpacity
                        onPress={() => handleApplyCouponCode(couponCodeInput)}
                        style={styles.applyCouponBtn}>
                        <Text style={styles.applyCouponText}>APPLY</Text>
                      </TouchableOpacity>
                    )}
                  </View>

                  {/* Feedback Message */}
                  {couponMessage && (
                    <Text
                      style={[
                        styles.couponFeedback,
                        couponMessage.isError
                          ? styles.couponFeedbackError
                          : styles.couponFeedbackSuccess,
                      ]}>
                      {couponMessage.text}
                    </Text>
                  )}

                  {/* Available Coupons Drawer */}
                  {showCouponsSheet && (
                    <View style={styles.availableCouponsList}>
                      {availableCoupons.map((cp) => {
                        const isApplicable = totalSellingPrice >= cp.minOrder;
                        const isAlreadyApplied = appliedCoupon?.code === cp.code;

                        return (
                          <View key={cp.code} style={styles.couponOfferCard}>
                            <View style={styles.couponOfferTop}>
                              <View style={styles.couponBadge}>
                                <Text style={styles.couponBadgeCode}>
                                  {cp.code}
                                </Text>
                              </View>
                              {isAlreadyApplied ? (
                                <Text style={styles.appliedStatus}>APPLIED</Text>
                              ) : (
                                <TouchableOpacity
                                  onPress={() => handleApplyCouponCode(cp.code)}
                                  disabled={!isApplicable}
                                  style={[
                                    styles.offerApplyBtn,
                                    !isApplicable && styles.offerApplyBtnDisabled,
                                  ]}>
                                  <Text style={styles.offerApplyBtnText}>
                                    APPLY
                                  </Text>
                                </TouchableOpacity>
                              )}
                            </View>
                            <Text style={styles.couponOfferTitle}>{cp.title}</Text>
                            <Text style={styles.couponOfferDesc}>
                              {cp.description}
                            </Text>
                          </View>
                        );
                      })}
                    </View>
                  )}
                </View>

                {/* 6. Price Summary Card */}
                <View style={styles.priceSummaryCard}>
                  <Text style={styles.priceSummaryTitle}>PRICE DETAILS ({cartItems.length} Items)</Text>

                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Total MRP</Text>
                    <Text style={styles.summaryValue}>₹{totalMRP}</Text>
                  </View>

                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Discount on MRP</Text>
                    <Text style={styles.summaryDiscount}>
                      - ₹{totalMRPDiscount}
                    </Text>
                  </View>

                  {couponDiscount > 0 && (
                    <View style={styles.summaryRow}>
                      <Text style={styles.summaryLabel}>
                        Coupon Discount ({appliedCoupon?.code})
                      </Text>
                      <Text style={styles.summaryDiscount}>
                        - ₹{couponDiscount}
                      </Text>
                    </View>
                  )}

                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Delivery Fee</Text>
                    <Text
                      style={[
                        styles.summaryValue,
                        deliveryFee === 0 && styles.freeDeliveryLabel,
                      ]}>
                      {deliveryFee === 0 ? 'FREE' : `₹${deliveryFee}`}
                    </Text>
                  </View>

                  <View style={styles.totalRow}>
                    <Text style={styles.totalLabel}>Total Amount</Text>
                    <Text style={styles.totalValue}>₹{finalPayable}</Text>
                  </View>

                  {totalSavings > 0 && (
                    <View style={styles.savingsTag}>
                      <Ionicons
                        name="checkmark-circle"
                        size={14}
                        color={colors.ratingGreen}
                      />
                      <Text style={styles.savingsTagText}>
                        You are saving ₹{totalSavings} on this order!
                      </Text>
                    </View>
                  )}
                </View>
                  </>
                )}

                {/* Save For Later Section */}
                {savedForLaterItems.length > 0 && (
                  <View style={styles.savedSectionContainer}>
                    <View style={styles.savedHeaderRow}>
                      <View style={styles.savedHeaderLeft}>
                        <Ionicons name="bookmark" size={15} color={colors.primary} />
                        <Text style={styles.savedSectionTitle}>
                          SAVED FOR LATER ({savedForLaterItems.length})
                        </Text>
                      </View>
                      <Text style={styles.savedNoticeText}>NOT INCLUDED IN CHECKOUT</Text>
                    </View>
                    <Text style={styles.savedSubtitle}>
                      Items moved here are preserved and will not be charged unless restored to your bag.
                    </Text>

                    {savedForLaterItems.map((sItem) => {
                      const isOOS =
                        sItem.isOutOfStock ||
                        (sItem.availableStock !== undefined && sItem.availableStock <= 0) ||
                        (sItem.product.stockCount !== undefined && sItem.product.stockCount <= 0);
                      const isUnavailable = sItem.isAvailable === false;
                      const hasPriceChange = sItem.priceChanged && sItem.savedPrice !== undefined;
                      const priceDiff = sItem.priceDiff || 0;

                      return (
                        <View key={`saved-${sItem.id}`} style={styles.savedItemCard}>
                          {/* Left image column */}
                          <TouchableOpacity
                            style={styles.savedImageCol}
                            activeOpacity={0.88}
                            onPress={() => {
                              onClose();
                              onPressProduct?.(sItem.product);
                            }}>
                            <Image
                              source={{ uri: sItem.product.image }}
                              style={styles.savedItemImage}
                              resizeMode="cover"
                            />
                            {(isOOS || isUnavailable) && (
                              <View style={styles.outOfStockOverlay}>
                                <Text style={styles.outOfStockOverlayText}>
                                  {isUnavailable ? 'UNAVAILABLE' : 'OUT OF STOCK'}
                                </Text>
                              </View>
                            )}
                          </TouchableOpacity>

                          {/* Right product details */}
                          <View style={styles.savedItemInfo}>
                            <View>
                              <View style={styles.savedItemTopRow}>
                                <Text style={styles.savedItemBrand} numberOfLines={1}>
                                  {sItem.product.brand}
                                </Text>
                                <TouchableOpacity
                                  onPress={() => onRemoveSavedItem?.(sItem.id)}
                                  style={styles.removeSavedCrossBtn}
                                  activeOpacity={0.7}
                                  accessibilityLabel="Remove saved item">
                                  <Ionicons name="close" size={16} color={colors.textMuted} />
                                </TouchableOpacity>
                              </View>

                              <Text style={styles.savedItemName} numberOfLines={1}>
                                {sItem.product.name}
                              </Text>

                              <View style={styles.savedVariantRow}>
                                <View style={styles.savedVariantBadge}>
                                  <Text style={styles.savedVariantBadgeText}>Size: {sItem.size}</Text>
                                </View>
                                {sItem.color && (
                                  <View style={styles.savedVariantBadge}>
                                    <Text style={styles.savedVariantBadgeText}>{sItem.color}</Text>
                                  </View>
                                )}
                              </View>

                              <View style={styles.savedPriceRow}>
                                <Text style={styles.savedPrice}>₹{sItem.product.price}</Text>
                                {sItem.product.originalPrice > sItem.product.price && (
                                  <Text style={styles.savedOriginalPrice}>
                                    ₹{sItem.product.originalPrice}
                                  </Text>
                                )}
                                {sItem.product.discountPercent > 0 && (
                                  <Text style={styles.savedDiscountText}>
                                    {sItem.product.discountPercent}% OFF
                                  </Text>
                                )}
                              </View>

                              {hasPriceChange && (
                                <View style={styles.priceDropPill}>
                                  <Ionicons
                                    name={priceDiff > 0 ? 'arrow-up' : 'arrow-down'}
                                    size={10}
                                    color={priceDiff > 0 ? '#d9534f' : '#03a685'}
                                  />
                                  <Text
                                    style={[
                                      styles.priceDropPillText,
                                      priceDiff > 0 && { color: '#d9534f' },
                                    ]}>
                                    {priceDiff > 0
                                      ? `Price increased by ₹${priceDiff}`
                                      : `Price dropped by ₹${Math.abs(priceDiff)}!`}
                                  </Text>
                                </View>
                              )}

                              {isUnavailable ? (
                                <Text style={styles.savedStatusOutOfStock}>
                                  ⚠️ Discontinued or unavailable
                                </Text>
                              ) : isOOS ? (
                                <Text style={styles.savedStatusOutOfStock}>
                                  ⚠️ Currently Out of Stock
                                </Text>
                              ) : (
                                <Text style={styles.savedStatusInStock}>✓ In Stock</Text>
                              )}
                            </View>

                            {/* Action Buttons */}
                            <View style={styles.savedActionsRow}>
                              <TouchableOpacity
                                onPress={() => onRemoveSavedItem?.(sItem.id)}
                                style={styles.savedRemoveBtn}
                                activeOpacity={0.7}>
                                <Text style={styles.savedRemoveBtnText}>REMOVE</Text>
                              </TouchableOpacity>

                              <TouchableOpacity
                                onPress={async () => {
                                  if (isUnavailable || isOOS) {
                                    Alert.alert(
                                      'Cannot Move to Bag',
                                      isUnavailable
                                        ? 'This product is no longer available in the catalogue.'
                                        : 'This item is currently out of stock. Please check back later.'
                                    );
                                    return;
                                  }
                                  if (onMoveSavedToBag) {
                                    await onMoveSavedToBag(sItem.id);
                                  }
                                }}
                                disabled={isUnavailable || isOOS}
                                style={[
                                  styles.savedMoveBtn,
                                  (isUnavailable || isOOS) && styles.savedMoveBtnDisabled,
                                ]}
                                activeOpacity={0.8}>
                                <Ionicons
                                  name="bag-add-outline"
                                  size={13}
                                  color={isUnavailable || isOOS ? colors.textMuted : '#fff'}
                                />
                                <Text
                                  style={[
                                    styles.savedMoveBtnText,
                                    (isUnavailable || isOOS) && styles.savedMoveBtnTextDisabled,
                                  ]}>
                                  MOVE TO BAG
                                </Text>
                              </TouchableOpacity>
                            </View>
                          </View>
                        </View>
                      );
                    })}
                  </View>
                )}

                {/* 7. Catalog Carousel below cart items */}
                {recommendedPicks.length > 0 && (
                  <View style={styles.bottomRecSection}>
                    <Text style={styles.bottomRecTitle}>YOU MAY ALSO LIKE</Text>
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={styles.bottomRecScroll}>
                      {recommendedPicks.map((rec) => (
                        <TouchableOpacity
                          key={`rec-cart-${rec.id}`}
                          style={styles.bottomRecCard}
                          onPress={() => {
                            onClose();
                            onPressProduct?.(rec);
                          }}
                          activeOpacity={0.88}>
                          <Image source={{ uri: rec.image }} style={styles.bottomRecImage} />
                          <View style={styles.bottomRecInfo}>
                            <Text style={styles.bottomRecBrand} numberOfLines={1}>{rec.brand}</Text>
                            <Text style={styles.bottomRecName} numberOfLines={1}>{rec.name}</Text>
                            <Text style={styles.bottomRecPrice}>₹{rec.price}</Text>
                          </View>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>
                )}
              </ScrollView>

              {/* 8. Sticky Bottom Action Bar */}
              {cartItems.length > 0 ? (
                <View style={styles.footer}>
                  <View style={styles.footerPriceBlock}>
                    <Text style={styles.footerTotalLabel}>Total Amount</Text>
                    <Text style={styles.footerTotalPrice}>₹{finalPayable}</Text>
                  </View>

                  <TouchableOpacity
                    onPress={handleProceedToCheckout}
                    style={styles.checkoutBtn}
                    activeOpacity={0.85}>
                    <Text style={styles.checkoutBtnText}>PROCEED TO CHECKOUT</Text>
                    <Ionicons name="arrow-forward" size={16} color="#fff" />
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.footer}>
                  <TouchableOpacity
                    onPress={onClose}
                    style={[styles.checkoutBtn, { flex: 1, justifyContent: 'center' }]}
                    activeOpacity={0.85}>
                    <Text style={styles.checkoutBtnText}>CONTINUE SHOPPING</Text>
                  </TouchableOpacity>
                </View>
              )}
            </>
          )}

          {/* 9. Floating Undo Removal Snackbar */}
          {showUndoSnackbar && lastRemovedItem && (
            <View style={styles.undoSnackbar}>
              <Text style={styles.undoText}>
                Removed &quot;{lastRemovedItem.product.name}&quot;
              </Text>
              <TouchableOpacity onPress={handleUndoRemoval} style={styles.undoBtn}>
                <Text style={styles.undoBtnText}>UNDO</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* 10. Remove Item Confirmation Modal */}
          {itemToRemove && (
            <Modal transparent visible={itemToRemove !== null} animationType="fade">
              <View style={styles.modalOverlay}>
                <View style={styles.confirmCard}>
                  <Text style={styles.confirmTitle}>Remove item from Bag?</Text>
                  <Text style={styles.confirmSubtitle}>
                    Are you sure you want to remove &quot;{itemToRemove.product.name}&quot; from your shopping bag?
                  </Text>
                  <View style={styles.confirmRow}>
                    <TouchableOpacity
                      style={styles.confirmCancelBtn}
                      onPress={() => setItemToRemove(null)}>
                      <Text style={styles.confirmCancelText}>CANCEL</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.confirmRemoveBtn}
                      onPress={handleConfirmRemoveItem}>
                      <Text style={styles.confirmRemoveText}>REMOVE</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            </Modal>
          )}

          {/* 11. Clear Entire Bag Confirmation Modal */}
          {showClearConfirm && (
            <Modal transparent visible={showClearConfirm} animationType="fade">
              <View style={styles.modalOverlay}>
                <View style={styles.confirmCard}>
                  <Text style={styles.confirmTitle}>Empty Shopping Bag?</Text>
                  <Text style={styles.confirmSubtitle}>
                    Are you sure you want to remove all {cartItems.length} items from your shopping bag?
                  </Text>
                  <View style={styles.confirmRow}>
                    <TouchableOpacity
                      style={styles.confirmCancelBtn}
                      onPress={() => setShowClearConfirm(false)}>
                      <Text style={styles.confirmCancelText}>CANCEL</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.confirmRemoveBtn}
                      onPress={async () => {
                        setShowClearConfirm(false);
                        if (onClearBag) await onClearBag();
                      }}>
                      <Text style={styles.confirmRemoveText}>EMPTY BAG</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            </Modal>
          )}

          {/* 12. Size / Variant Selector Bottom Sheet */}
          {variantModalItem && (
            <Modal transparent visible={variantModalItem !== null} animationType="slide">
              <TouchableOpacity
                style={styles.modalOverlay}
                activeOpacity={1}
                onPress={() => setVariantModalItem(null)}>
                <View style={styles.variantSheetCard}>
                  <View style={styles.variantSheetHeader}>
                    <Text style={styles.variantSheetTitle}>SELECT SIZE</Text>
                    <TouchableOpacity onPress={() => setVariantModalItem(null)}>
                      <Ionicons name="close" size={20} color={colors.text} />
                    </TouchableOpacity>
                  </View>

                  <View style={styles.sizePillsRow}>
                    {variantModalItem.product.sizes.map((sz) => {
                      const isSel = tempSelectedSize === sz;
                      return (
                        <TouchableOpacity
                          key={sz}
                          style={[styles.sizePill, isSel && styles.sizePillSelected]}
                          onPress={() => setTempSelectedSize(sz)}
                          activeOpacity={0.8}>
                          <Text style={[styles.sizePillText, isSel && styles.sizePillTextSelected]}>
                            {sz}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  <TouchableOpacity
                    style={styles.confirmVariantBtn}
                    onPress={handleSaveVariant}
                    activeOpacity={0.85}>
                    <Text style={styles.confirmVariantText}>UPDATE SIZE</Text>
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            </Modal>
          )}

          {/* 13. Address / Pincode Change Bottom Sheet */}
          {showAddressPicker && (
            <Modal transparent visible={showAddressPicker} animationType="slide">
              <TouchableOpacity
                style={styles.modalOverlay}
                activeOpacity={1}
                onPress={() => setShowAddressPicker(false)}>
                <View style={styles.addressSheetCard}>
                  <View style={styles.addressSheetHeader}>
                    <Text style={styles.addressSheetTitle}>DELIVERY DETAILS</Text>
                    <TouchableOpacity onPress={() => setShowAddressPicker(false)}>
                      <Ionicons name="close" size={20} color={colors.text} />
                    </TouchableOpacity>
                  </View>

                  {/* Manual Pincode Input */}
                  <View style={styles.pincodeInputRow}>
                    <TextInput
                      style={styles.pincodeInput}
                      placeholder="Enter 6-digit PIN Code"
                      placeholderTextColor={colors.textMuted}
                      keyboardType="number-pad"
                      maxLength={6}
                      value={pincodeInput}
                      onChangeText={setPincodeInput}
                    />
                    <TouchableOpacity style={styles.checkPincodeBtn} onPress={handleApplyPincode}>
                      <Text style={styles.checkPincodeText}>CHECK</Text>
                    </TouchableOpacity>
                  </View>

                  {/* Saved addresses selection if user has any */}
                  {savedAddresses.length > 0 && (
                    <View style={styles.savedAddressesList}>
                      <Text style={styles.savedAddrHeading}>SAVED ADDRESSES</Text>
                      {savedAddresses.map((addr) => {
                        const isChosen = selectedAddress?.id === addr.id;
                        return (
                          <TouchableOpacity
                            key={addr.id}
                            style={[styles.addrCard, isChosen && styles.addrCardActive]}
                            onPress={() => {
                              setSelectedAddress(addr);
                              setDeliveryPincode(addr.pincode);
                              setDeliveryCity(addr.city);
                              setShowAddressPicker(false);
                            }}>
                            <Ionicons
                              name={isChosen ? 'radio-button-on' : 'radio-button-off'}
                              size={18}
                              color={isChosen ? colors.primary : colors.textMuted}
                            />
                            <View style={styles.addrTextCol}>
                              <Text style={styles.addrName}>{addr.name} ({addr.addressType})</Text>
                              <Text style={styles.addrLine} numberOfLines={1}>
                                {addr.address}, {addr.city} - {addr.pincode}
                              </Text>
                            </View>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  )}
                </View>
              </TouchableOpacity>
            </Modal>
          )}

          {/* 14. Checkout Flow Modal */}
          <CheckoutModal
            visible={showCheckout}
            embedded={true}
            cartItems={cartItems}
            totalMRP={totalMRP}
            totalSellingPrice={totalSellingPrice}
            couponDiscount={couponDiscount}
            appliedCoupon={appliedCoupon?.code}
            deliveryFee={deliveryFee}
            finalPayable={finalPayable}
            onClose={() => setShowCheckout(false)}
            onOrderSuccess={handleOrderConfirmed}
          />
        </View>
      </View>
    </Modal>
  );
};

const createStyles = (colors: any, isDark: boolean) => StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    height: '92%',
    display: 'flex',
    flexDirection: 'column',
    maxWidth: Platform.OS === 'web' ? 480 : undefined,
    width: '100%',
    alignSelf: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
    backgroundColor: colors.surface,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  backBtn: {
    padding: 2,
  },
  headerTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: 0.8,
  },
  itemCount: {
    fontSize: 11,
    color: colors.textSecondary,
    fontWeight: '600',
    marginTop: 1,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerActionBtn: {
    padding: 6,
  },
  deliveryBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  deliveryBannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  deliveryBannerTextCol: {
    flex: 1,
  },
  deliveryToLabel: {
    fontSize: 12,
    color: colors.text,
  },
  deliveryToBold: {
    fontWeight: '800',
  },
  deliveryEstimate: {
    fontSize: 10,
    color: colors.textSecondary,
    marginTop: 1,
  },
  changeAddressBtn: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  changeAddressText: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.primary,
  },
  freeDelStrip: {
    backgroundColor: isDark ? colors.surfaceElevated : '#fff7f9',
    paddingHorizontal: Spacing.md,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: isDark ? colors.border : '#ffe5eb',
  },
  freeDelIconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  freeDelText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.text,
  },
  progressBarBg: {
    height: 4,
    backgroundColor: isDark ? colors.border : '#ffd1dc',
    borderRadius: 2,
    marginTop: 6,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: colors.primary,
  },
  scrollContent: {
    paddingBottom: 110,
  },
  itemsList: {
    paddingHorizontal: Spacing.sm,
    paddingTop: Spacing.sm,
    gap: 10,
  },
  itemCard: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    gap: 12,
  },
  imageCol: {
    width: 85,
    height: 115,
    borderRadius: 6,
    overflow: 'hidden',
    backgroundColor: colors.surfaceElevated,
  },
  itemImage: {
    width: '100%',
    height: '100%',
  },
  itemInfo: {
    flex: 1,
    justifyContent: 'space-between',
  },
  itemHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  itemBrand: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.text,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  removeCrossBtn: {
    padding: 2,
  },
  itemName: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 2,
  },
  variantSelectorsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 6,
  },
  variantPickerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: isDark ? colors.surfaceElevated : '#f3f4f6',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  variantPickerText: {
    fontSize: 10.5,
    color: colors.textSecondary,
  },
  variantPickerBold: {
    fontWeight: '800',
    color: colors.text,
  },
  colorPill: {
    backgroundColor: isDark ? colors.surfaceElevated : '#f3f4f6',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  colorPillText: {
    fontSize: 10.5,
    color: colors.textSecondary,
  },
  itemPriceAndQtyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  priceCol: {
    flexDirection: 'column',
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
  },
  itemPrice: {
    fontSize: 13.5,
    fontWeight: '800',
    color: colors.text,
  },
  itemOriginalPrice: {
    fontSize: 11,
    color: colors.textMuted,
    textDecorationLine: 'line-through',
  },
  itemDiscountText: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#e65100',
    marginTop: 1,
  },
  stepperContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 6,
    overflow: 'hidden',
  },
  stepperBtn: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: isDark ? colors.surfaceElevated : '#f8fafc',
  },
  stepperQty: {
    minWidth: 26,
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '800',
    color: colors.text,
  },
  assuranceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 6,
  },
  lowStockText: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#e65100',
  },
  inStockText: {
    fontSize: 9.5,
    fontWeight: '700',
    color: colors.ratingGreen,
  },
  assuranceDot: {
    fontSize: 9,
    color: colors.textMuted,
  },
  returnText: {
    fontSize: 9.5,
    color: colors.textMuted,
  },
  itemActionsBottomRow: {
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
    paddingTop: 6,
  },
  moveToWishlistBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  moveToWishlistText: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.primary,
    letterSpacing: 0.5,
  },
  couponsCard: {
    backgroundColor: colors.surface,
    marginHorizontal: Spacing.sm,
    marginTop: Spacing.md,
    borderRadius: 8,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  couponHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  couponHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  couponSectionTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: 0.6,
  },
  viewCouponsLink: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.primary,
  },
  couponInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 6,
    overflow: 'hidden',
  },
  couponInput: {
    flex: 1,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 12,
    color: colors.text,
    fontWeight: '600',
  },
  applyCouponBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  applyCouponText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '800',
  },
  removeCouponBtn: {
    backgroundColor: '#ffebee',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  removeCouponText: {
    color: '#e53935',
    fontSize: 11,
    fontWeight: '800',
  },
  couponFeedback: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 6,
  },
  couponFeedbackError: {
    color: '#e53935',
  },
  couponFeedbackSuccess: {
    color: colors.ratingGreen,
  },
  availableCouponsList: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
    gap: 8,
  },
  couponOfferCard: {
    backgroundColor: isDark ? colors.surfaceElevated : '#fafbfc',
    borderRadius: 6,
    padding: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  couponOfferTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  couponBadge: {
    backgroundColor: isDark ? colors.surfaceElevated : '#fff0f3',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: isDark ? colors.border : '#ffd1dc',
  },
  couponBadgeCode: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.primary,
  },
  appliedStatus: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.ratingGreen,
  },
  offerApplyBtn: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    backgroundColor: colors.primary,
    borderRadius: 4,
  },
  offerApplyBtnDisabled: {
    backgroundColor: '#ccc',
  },
  offerApplyBtnText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '800',
  },
  couponOfferTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.text,
    marginTop: 4,
  },
  couponOfferDesc: {
    fontSize: 9.5,
    color: colors.textSecondary,
    marginTop: 2,
  },
  priceSummaryCard: {
    backgroundColor: colors.surface,
    marginHorizontal: Spacing.sm,
    marginTop: Spacing.md,
    borderRadius: 8,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  priceSummaryTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.textMuted,
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  summaryLabel: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  summaryValue: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.text,
  },
  summaryDiscount: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.ratingGreen,
  },
  freeDeliveryLabel: {
    color: colors.ratingGreen,
    fontWeight: '800',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 10,
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
  },
  totalLabel: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.text,
  },
  totalValue: {
    fontSize: 14,
    fontWeight: '900',
    color: colors.text,
  },
  savingsTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: isDark ? 'rgba(46, 125, 50, 0.2)' : '#edf7ed',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 4,
    marginTop: 10,
  },
  savingsTagText: {
    fontSize: 11,
    fontWeight: '700',
    color: isDark ? '#4ade80' : '#2e7d32',
  },
  bottomRecSection: {
    marginTop: Spacing.lg,
    paddingVertical: Spacing.md,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
  },
  bottomRecTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.textMuted,
    letterSpacing: 0.8,
    paddingHorizontal: Spacing.md,
    marginBottom: 8,
  },
  bottomRecScroll: {
    paddingHorizontal: Spacing.md,
    gap: 10,
  },
  bottomRecCard: {
    width: 110,
    backgroundColor: colors.surface,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    overflow: 'hidden',
  },
  bottomRecImage: {
    width: '100%',
    height: 125,
    backgroundColor: colors.surfaceElevated,
  },
  bottomRecInfo: {
    padding: 6,
  },
  bottomRecBrand: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.text,
  },
  bottomRecName: {
    fontSize: 9,
    color: colors.textSecondary,
    marginTop: 1,
  },
  bottomRecPrice: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.text,
    marginTop: 2,
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
    paddingHorizontal: Spacing.md,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  footerPriceBlock: {
    flexDirection: 'column',
  },
  footerTotalLabel: {
    fontSize: 10,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  footerTotalPrice: {
    fontSize: 16,
    fontWeight: '900',
    color: colors.text,
  },
  checkoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.primary,
    paddingHorizontal: 22,
    paddingVertical: 13,
    borderRadius: 8,
  },
  checkoutBtnText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  emptyScroll: {
    flex: 1,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingTop: 40,
    paddingBottom: 60,
  },
  emptyIconCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: isDark ? colors.surfaceElevated : '#fff0f3',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: 0.6,
  },
  emptySubtitle: {
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 18,
    maxWidth: 270,
  },
  startShoppingBtn: {
    marginTop: Spacing.lg,
    backgroundColor: colors.primary,
    paddingHorizontal: 26,
    paddingVertical: 12,
    borderRadius: 24,
  },
  startShoppingBtnText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  emptyRecSection: {
    width: '100%',
    marginTop: Spacing.xl,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
  },
  emptyRecTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: 0.6,
  },
  emptyRecSubtitle: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 2,
    marginBottom: 10,
  },
  emptyRecGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    justifyContent: 'space-between',
  },
  emptyRecCard: {
    width: '48%',
    backgroundColor: colors.surface,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    overflow: 'hidden',
    marginBottom: 8,
  },
  emptyRecImage: {
    width: '100%',
    height: 140,
    backgroundColor: colors.surfaceElevated,
  },
  emptyRecDetails: {
    padding: 6,
  },
  emptyRecBrand: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.text,
    textTransform: 'uppercase',
  },
  emptyRecName: {
    fontSize: 10,
    color: colors.textSecondary,
    marginTop: 1,
  },
  emptyRecPrice: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.text,
    marginTop: 2,
  },
  emptyRecAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
    paddingVertical: 7,
    backgroundColor: isDark ? colors.surfaceElevated : '#fff7f9',
  },
  emptyRecAddText: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.primary,
  },
  confirmedContainer: {
    flex: 1,
    alignItems: 'center',
    padding: Spacing.xl,
    paddingTop: 50,
  },
  confirmedIconCircle: {
    marginBottom: Spacing.md,
  },
  confirmedTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: 0.6,
  },
  confirmedId: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary,
    marginTop: 4,
  },
  confirmedSub: {
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 18,
    maxWidth: 290,
  },
  confirmedDateBold: {
    fontWeight: '800',
    color: colors.text,
  },
  orderSummaryCard: {
    width: '100%',
    backgroundColor: isDark ? colors.surfaceElevated : '#f8fafc',
    borderRadius: 8,
    padding: Spacing.md,
    marginTop: Spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 6,
  },
  orderSummaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  orderSummaryLabel: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  orderSummaryVal: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.text,
  },
  orderSummaryTotal: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.primary,
  },
  confirmedButtonsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: Spacing.xl,
    justifyContent: 'center',
    width: '100%',
  },
  trackInOrdersBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 6,
  },
  trackInOrdersBtnText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  trackOrderBtn: {
    backgroundColor: isDark ? colors.surfaceElevated : '#1f2937',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  trackOrderBtnText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  undoSnackbar: {
    position: 'absolute',
    bottom: 75,
    left: Spacing.md,
    right: Spacing.md,
    backgroundColor: isDark ? colors.surfaceElevated : '#1e293b',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 6,
    zIndex: 999,
  },
  undoText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
  },
  undoBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  undoBtnText: {
    color: '#ff4081',
    fontWeight: '800',
    fontSize: 12,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.lg,
  },
  confirmCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: Spacing.lg,
    width: '100%',
    maxWidth: 340,
    alignItems: 'center',
  },
  confirmTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.text,
    textAlign: 'center',
  },
  confirmSubtitle: {
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 18,
  },
  confirmRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 18,
    width: '100%',
  },
  confirmCancelBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  confirmCancelText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  confirmRemoveBtn: {
    flex: 1,
    backgroundColor: '#e53935',
    paddingVertical: 10,
    borderRadius: 6,
    alignItems: 'center',
  },
  confirmRemoveText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '800',
  },
  variantSheetCard: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: Spacing.lg,
    width: '100%',
    maxWidth: 480,
    marginTop: 'auto',
  },
  variantSheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  variantSheetTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: 0.6,
  },
  sizePillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    paddingVertical: 16,
  },
  sizePill: {
    minWidth: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  sizePillSelected: {
    borderColor: colors.primary,
    backgroundColor: isDark ? colors.surfaceElevated : '#fff0f3',
  },
  sizePillText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.text,
  },
  sizePillTextSelected: {
    color: colors.primary,
    fontWeight: '800',
  },
  confirmVariantBtn: {
    backgroundColor: colors.primary,
    paddingVertical: 12,
    borderRadius: 6,
    alignItems: 'center',
  },
  confirmVariantText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  addressSheetCard: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: Spacing.lg,
    width: '100%',
    maxWidth: 480,
    marginTop: 'auto',
  },
  addressSheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  addressSheetTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.text,
  },
  pincodeInputRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 14,
  },
  pincodeInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 12,
    color: colors.text,
  },
  checkPincodeBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: 16,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkPincodeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '800',
  },
  savedAddressesList: {
    marginTop: 16,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
    paddingTop: 12,
    gap: 8,
  },
  savedAddrHeading: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.textMuted,
    letterSpacing: 0.6,
  },
  addrCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 10,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.border,
  },
  addrCardActive: {
    borderColor: colors.primary,
    backgroundColor: isDark ? colors.surfaceElevated : '#fff7f9',
  },
  addrTextCol: {
    flex: 1,
  },
  addrName: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.text,
  },
  addrLine: {
    fontSize: 10,
    color: colors.textSecondary,
    marginTop: 1,
  },
  actionDivider: {
    width: 1,
    height: 14,
    backgroundColor: colors.divider,
  },
  saveForLaterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 2,
  },
  saveForLaterText: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.textSecondary,
    letterSpacing: 0.5,
  },
  outOfStockBadge: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#d9534f',
  },
  stepperBtnDisabled: {
    opacity: 0.35,
  },
  savedSectionContainer: {
    backgroundColor: colors.surface,
    marginHorizontal: Spacing.sm,
    marginTop: Spacing.md,
    borderRadius: 8,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  savedHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  savedHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  savedSectionTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: 0.5,
  },
  savedNoticeText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textMuted,
  },
  savedSubtitle: {
    fontSize: 11,
    color: colors.textSecondary,
    marginBottom: 12,
  },
  savedItemCard: {
    flexDirection: 'row',
    backgroundColor: isDark ? colors.surfaceElevated : '#fcfcfd',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 10,
    marginBottom: 10,
    gap: 12,
  },
  savedImageCol: {
    width: 80,
    height: 106,
    borderRadius: 6,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: colors.border,
  },
  savedItemImage: {
    width: '100%',
    height: '100%',
  },
  outOfStockOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(217, 83, 79, 0.92)',
    paddingVertical: 3,
    alignItems: 'center',
  },
  outOfStockOverlayText: {
    color: '#fff',
    fontSize: 8.5,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  savedItemInfo: {
    flex: 1,
    justifyContent: 'space-between',
  },
  savedItemTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  savedItemBrand: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: 0.5,
  },
  removeSavedCrossBtn: {
    padding: 2,
  },
  savedItemName: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  savedVariantRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
  },
  savedVariantBadge: {
    backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#f0f0f2',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  savedVariantBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.text,
  },
  savedPriceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
  },
  savedPrice: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.text,
  },
  savedOriginalPrice: {
    fontSize: 11,
    color: colors.textMuted,
    textDecorationLine: 'line-through',
  },
  savedDiscountText: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.ratingGreen,
  },
  priceDropPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: isDark ? 'rgba(3,166,133,0.15)' : '#e6f7f3',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginTop: 4,
    alignSelf: 'flex-start',
  },
  priceDropPillText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#03a685',
  },
  savedStatusOutOfStock: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#d9534f',
    marginTop: 4,
  },
  savedStatusInStock: {
    fontSize: 10.5,
    fontWeight: '700',
    color: colors.ratingGreen,
    marginTop: 4,
  },
  savedActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
    paddingTop: 8,
  },
  savedRemoveBtn: {
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  savedRemoveBtnText: {
    fontSize: 10.5,
    fontWeight: '800',
    color: colors.textMuted,
    letterSpacing: 0.5,
  },
  savedMoveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.primary,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 4,
  },
  savedMoveBtnDisabled: {
    backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#e5e5ea',
  },
  savedMoveBtnText: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: 0.5,
  },
  savedMoveBtnTextDisabled: {
    color: colors.textMuted,
  },
  emptyCartWithSavedCard: {
    backgroundColor: colors.surface,
    marginHorizontal: Spacing.sm,
    marginTop: Spacing.sm,
    borderRadius: 8,
    padding: Spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  emptyCartWithSavedTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.text,
    marginTop: 6,
  },
  emptyCartWithSavedSub: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 2,
    textAlign: 'center',
  },
});
