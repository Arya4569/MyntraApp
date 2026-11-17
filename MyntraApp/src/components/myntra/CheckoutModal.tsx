import { Ionicons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
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

import { MyntraColors, Spacing } from '@/constants/myntra-theme';
import { useAuth } from '@/context/AuthContext';
import { AVAILABLE_COUPONS } from '@/data/mock-data';
import { storeService } from '@/services/store-service';
import { CartItem, DeliveryAddress, Order } from '@/types/store';

export interface CheckoutModalProps {
  visible: boolean;
  cartItems: CartItem[];
  totalMRP: number;
  totalSellingPrice: number;
  couponDiscount: number;
  appliedCoupon?: string;
  deliveryFee: number;
  finalPayable: number;
  onClose: () => void;
  onOrderSuccess: (order: Order) => void;
  embedded?: boolean;
}

type PaymentMethodType = 'razorpay' | 'cod' | 'upi' | 'card' | 'netbanking';
type UpiAppType = 'Google Pay' | 'PhonePe' | 'Paytm UPI' | 'BHIM UPI' | 'Custom UPI ID';

export const CheckoutModal: React.FC<CheckoutModalProps> = ({
  visible,
  cartItems,
  totalMRP,
  totalSellingPrice,
  couponDiscount: initialCouponDiscount = 0,
  appliedCoupon: initialAppliedCoupon,
  deliveryFee: initialDeliveryFee = 0,
  finalPayable: initialFinalPayable = 0,
  onClose,
  onOrderSuccess,
  embedded = false,
}) => {
  const { user } = useAuth();

  // 1. Saved Addresses & Selection State
  const [addresses, setAddresses] = useState<DeliveryAddress[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<string>('');
  const [showAddAddressForm, setShowAddAddressForm] = useState(false);
  const [editingAddress, setEditingAddress] = useState<DeliveryAddress | null>(null);

  // Address Form Fields
  const [formName, setFormName] = useState(user?.name || '');
  const [formMobile, setFormMobile] = useState(user?.mobile || '');
  const [formPincode, setFormPincode] = useState('');
  const [formAddress, setFormAddress] = useState('');
  const [formLocality, setFormLocality] = useState('');
  const [formCity, setFormCity] = useState('Mumbai');
  const [formState, setFormState] = useState('Maharashtra');
  const [formType, setFormType] = useState<'Home' | 'Work'>('Home');
  const [formIsDefault, setFormIsDefault] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // 2. Order Summary Accordion
  const [isItemsExpanded, setIsItemsExpanded] = useState(true);

  // 3. Coupons & Offers State
  const [appliedCouponCode, setAppliedCouponCode] = useState<string | undefined>(
    initialAppliedCoupon
  );
  const [customCouponInput, setCustomCouponInput] = useState('');
  const [couponError, setCouponError] = useState<string | null>(null);
  const [couponSuccessMessage, setCouponSuccessMessage] = useState<string | null>(null);
  const [showCouponsList, setShowCouponsList] = useState(false);

  // 4. Payment Selection State
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethodType>('razorpay');
  const [selectedUpiApp, setSelectedUpiApp] = useState<UpiAppType>('Google Pay');
  const [customUpiId, setCustomUpiId] = useState('');
  const [upiVerified, setUpiVerified] = useState(false);

  // Card Inputs
  const [cardNumber, setCardNumber] = useState('');
  const [cardHolder, setCardHolder] = useState(user?.name || '');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvv, setCardCvv] = useState('');

  // Net Banking selection
  const [selectedBank, setSelectedBank] = useState('HDFC Bank');

  // 5. Order Placement Submission State
  const [isPlacing, setIsPlacing] = useState(false);
  const [orderError, setOrderError] = useState<string | null>(null);
  const [unconfiguredNoticeOrder, setUnconfiguredNoticeOrder] = useState<Order | null>(null);

  // Load saved addresses on open
  useEffect(() => {
    let isMounted = true;
    if (visible) {
      storeService.getAddresses().then((list) => {
        if (isMounted) {
          setAddresses(list);
          const defaultAddr = list.find((a) => a.isDefault) || list[0];
          setSelectedAddressId(defaultAddr ? defaultAddr.id : '');
        }
      });
    }
    return () => {
      isMounted = false;
    };
  }, [visible, user?.id]);

  // Sync user profile name/mobile if loaded
  const [prevUser, setPrevUser] = useState(user);
  if (user !== prevUser) {
    setPrevUser(user);
    if (user && !formName) {
      setFormName(user.name);
      setFormMobile(user.mobile);
      setCardHolder(user.name);
    }
  }

  // Derived financial calculations
  const calculatedMRP = useMemo(() => {
    return cartItems.reduce(
      (acc, item) =>
        acc + (item.product?.originalPrice || item.product?.price || 0) * item.quantity,
      0
    );
  }, [cartItems]);

  const calculatedSellingPrice = useMemo(() => {
    return cartItems.reduce(
      (acc, item) => acc + (item.product?.price || 0) * item.quantity,
      0
    );
  }, [cartItems]);

  const mrpDiscount = calculatedMRP - calculatedSellingPrice;

  // Active coupon object
  const activeCouponObj = useMemo(() => {
    if (!appliedCouponCode) return null;
    return AVAILABLE_COUPONS.find(
      (c) => c.code.toUpperCase() === appliedCouponCode.toUpperCase()
    ) || null;
  }, [appliedCouponCode]);

  // Dynamic coupon discount
  const activeCouponDiscount = useMemo(() => {
    if (!activeCouponObj) return 0;
    if (calculatedSellingPrice < activeCouponObj.minOrder) return 0;
    if (activeCouponObj.discountType === 'percentage') {
      return Math.min(
        600,
        Math.round((calculatedSellingPrice * activeCouponObj.discountValue) / 100)
      );
    }
    return activeCouponObj.discountValue;
  }, [activeCouponObj, calculatedSellingPrice]);

  // Delivery fee logic: Free if >= 799 or FREEDEL coupon applied
  const isFreeDelivery =
    calculatedSellingPrice >= 799 || appliedCouponCode === 'FREEDEL';
  const effectiveDeliveryFee = isFreeDelivery ? 0 : 49;

  // Final total payable
  const finalPayableAmount = Math.max(
    0,
    calculatedSellingPrice - activeCouponDiscount + effectiveDeliveryFee
  );

  const totalSavings =
    mrpDiscount + activeCouponDiscount + (isFreeDelivery ? 49 : 0);

  // Delivery date estimate (3 days)
  const [deliveryDateString] = useState(() => {
    const d = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
    return d.toLocaleDateString('en-IN', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  });

  // Handle Address Management
  const handleStartAddNewAddress = () => {
    setEditingAddress(null);
    setFormName(user?.name || '');
    setFormMobile(user?.mobile || '');
    setFormPincode('');
    setFormAddress('');
    setFormLocality('');
    setFormCity('Mumbai');
    setFormState('Maharashtra');
    setFormType('Home');
    setFormIsDefault(addresses.length === 0);
    setFormError(null);
    setShowAddAddressForm(true);
  };

  const handleStartEditAddress = (addr: DeliveryAddress) => {
    setEditingAddress(addr);
    setFormName(addr.name);
    setFormMobile(addr.mobile);
    setFormPincode(addr.pincode);
    setFormAddress(addr.address);
    setFormLocality(addr.locality || '');
    setFormCity(addr.city);
    setFormState(addr.state);
    setFormType(addr.addressType);
    setFormIsDefault(addr.isDefault);
    setFormError(null);
    setShowAddAddressForm(true);
  };

  const handleSaveAddress = async () => {
    if (!formName.trim() || !formMobile.trim() || !formPincode.trim() || !formAddress.trim()) {
      setFormError('Please fill in all mandatory fields marked with (*).');
      return;
    }
    const cleanMobile = formMobile.replace(/\D/g, '');
    if (cleanMobile.length !== 10) {
      setFormError('Please enter a valid 10-digit mobile number.');
      return;
    }
    const cleanPincode = formPincode.replace(/\D/g, '');
    if (cleanPincode.length !== 6) {
      setFormError('Please enter a valid 6-digit Indian PIN code.');
      return;
    }

    const addrToSave: DeliveryAddress = {
      id: editingAddress ? editingAddress.id : `addr-${Date.now()}`,
      name: formName.trim(),
      mobile: cleanMobile,
      pincode: cleanPincode,
      address: formAddress.trim(),
      locality: formLocality.trim() || undefined,
      city: formCity.trim() || 'Mumbai',
      state: formState.trim() || 'Maharashtra',
      addressType: formType,
      isDefault: formIsDefault || addresses.length === 0,
    };

    try {
      const updatedList = await storeService.saveAddress(addrToSave);
      setAddresses(updatedList);
      setSelectedAddressId(addrToSave.id);
      setShowAddAddressForm(false);
      setEditingAddress(null);
      setFormError(null);
    } catch {
      setFormError('Failed to save address. Please check inputs and retry.');
    }
  };

  // Handle Coupon Apply
  const handleApplyCouponCode = (codeToApply: string) => {
    const cleanCode = codeToApply.trim().toUpperCase();
    setCouponError(null);
    setCouponSuccessMessage(null);

    if (!cleanCode) {
      setCouponError('Please enter a coupon code.');
      return;
    }

    const found = AVAILABLE_COUPONS.find((c) => c.code === cleanCode);
    if (!found) {
      setCouponError(`Coupon "${cleanCode}" is not recognized or has expired.`);
      return;
    }

    if (calculatedSellingPrice < found.minOrder) {
      setCouponError(
        `Coupon "${cleanCode}" requires a minimum order of ₹${found.minOrder}. Add ₹${
          found.minOrder - calculatedSellingPrice
        } more to apply.`
      );
      return;
    }

    setAppliedCouponCode(cleanCode);
    setCustomCouponInput('');
    setShowCouponsList(false);
    setCouponSuccessMessage(`Coupon ${cleanCode} applied successfully! 🎉`);
    setTimeout(() => setCouponSuccessMessage(null), 3500);
  };

  const handleRemoveCoupon = () => {
    setAppliedCouponCode(undefined);
    setCouponError(null);
    setCouponSuccessMessage(null);
  };

  // Card Number Formatting
  const handleCardNumberChange = (val: string) => {
    const clean = val.replace(/\D/g, '').slice(0, 16);
    const parts = clean.match(/[\s\S]{1,4}/g) || [];
    setCardNumber(parts.join(' '));
  };

  const handleCardExpiryChange = (val: string) => {
    const clean = val.replace(/\D/g, '').slice(0, 4);
    if (clean.length > 2) {
      setCardExpiry(`${clean.slice(0, 2)}/${clean.slice(2)}`);
    } else {
      setCardExpiry(clean);
    }
  };

  // Final Order Submission
  const handleConfirmOrder = async () => {
    if (isPlacing) return;

    if (cartItems.length === 0) {
      setOrderError('Your shopping bag is empty. Please add items before placing order.');
      return;
    }

    const chosenAddress =
      addresses.find((a) => a.id === selectedAddressId) || addresses[0];
    if (!chosenAddress) {
      setOrderError('Please select or add a delivery address to place your order.');
      return;
    }

    // Payment validation
    if (paymentMethod === 'card') {
      const cleanCard = cardNumber.replace(/\D/g, '');
      if (cleanCard.length < 15) {
        setOrderError('Please enter a valid 16-digit credit/debit card number.');
        return;
      }
      if (!cardExpiry.trim() || cardExpiry.trim().length < 5) {
        setOrderError('Please enter a valid card expiry date (MM/YY).');
        return;
      }
      if (cardCvv.trim().length < 3) {
        setOrderError('Please enter a valid 3-digit CVV security code.');
        return;
      }
    } else if (paymentMethod === 'upi' && selectedUpiApp === 'Custom UPI ID') {
      if (!customUpiId.includes('@')) {
        setOrderError('Please enter a valid UPI ID (e.g. yourname@okhdfcbank).');
        return;
      }
    }

    const addressStr = `${chosenAddress.name}, ${chosenAddress.address}${
      chosenAddress.locality ? ', ' + chosenAddress.locality : ''
    }, ${chosenAddress.city}, ${chosenAddress.state} - ${chosenAddress.pincode} (Mobile: ${
      chosenAddress.mobile
    })`;

    // 1. Real-time Razorpay Flow
    if (paymentMethod === 'razorpay') {
      setOrderError(null);
      setIsPlacing(true);

      try {
        // Step 1: Create a pending order on the backend BEFORE initiating payment
        const pendingOrder = await storeService.placeOrder(
          cartItems,
          addressStr,
          appliedCouponCode,
          activeCouponDiscount,
          'Razorpay (Pending Payment)',
          user?.id
        );

        if (!pendingOrder || !pendingOrder.id) {
          throw new Error('Failed to create pending order record on backend.');
        }

        // Step 2: Create Razorpay gateway order tied to the internal order ID
        const rzpOrder = await storeService.createRazorpayOrder(
          finalPayableAmount,
          undefined,
          pendingOrder.id
        );

        if (!rzpOrder.success || (!rzpOrder.orderId && !rzpOrder.keyId)) {
          throw new Error(rzpOrder.error || 'Failed to initialize Razorpay payment gateway.');
        }

        const isLiveKey = Boolean(
          rzpOrder.isLive &&
          rzpOrder.keyId &&
          !rzpOrder.keyId.includes('placeholder')
        );

        // If credentials are placeholder / unconfigured in server/.env:
        // Do NOT simulate fake success! Inform the user honestly, keep order safely as Pending
        if (!isLiveKey) {
          setIsPlacing(false);
          setUnconfiguredNoticeOrder(pendingOrder);
          return;
        }

        // Step 3: Web / PWA checkout via official Razorpay checkout.js modal
        if (Platform.OS === 'web' && typeof window !== 'undefined') {
          const loadScript = (): Promise<boolean> => {
            return new Promise((resolve) => {
              if ((window as any).Razorpay) return resolve(true);
              const script = document.createElement('script');
              script.src = 'https://checkout.razorpay.com/v1/checkout.js';
              script.async = true;
              script.onload = () => resolve(true);
              script.onerror = () => resolve(false);
              document.body.appendChild(script);
            });
          };

          const scriptLoaded = await loadScript();
          if (scriptLoaded && (window as any).Razorpay) {
            const options: any = {
              key: rzpOrder.keyId,
              amount: rzpOrder.amount,
              currency: rzpOrder.currency || 'INR',
              name: 'Myntra Fashion',
              description: `Payment for Order #${pendingOrder.id}`,
              image: 'https://assets.myntassets.com/assets/images/retaillabs/2023/2/28/a9cd936f-5b65-4f47-8a61-9c8dfb5a6c4b1677567702582-Myntra-logo.png',
              handler: async function (response: any) {
                try {
                  const verifyRes = await storeService.verifyRazorpayPayment(
                    response.razorpay_order_id || rzpOrder.orderId || `pay_${Date.now()}`,
                    response.razorpay_payment_id,
                    response.razorpay_signature || 'direct_payment_signature',
                    pendingOrder.id,
                    finalPayableAmount,
                    user?.id
                  );
                  if (verifyRes.verified || verifyRes.success) {
                    const freshOrder = await storeService.getOrderById(pendingOrder.id);
                    onOrderSuccess(freshOrder || { ...pendingOrder, paymentStatus: 'Paid', status: 'Confirmed' });
                  } else {
                    await storeService.reportPaymentFailure(pendingOrder.id, 'Invalid HMAC SHA256 payment signature');
                    setOrderError('Payment verification failed: Invalid transaction signature. Order preserved as Failed.');
                  }
                } catch {
                  // Fallback: If verification network call failed, since payment succeeded on Razorpay, mark order as confirmed locally
                  const freshOrder = await storeService.getOrderById(pendingOrder.id);
                  onOrderSuccess(freshOrder || { ...pendingOrder, paymentStatus: 'Paid', status: 'Confirmed' });
                } finally {
                  setIsPlacing(false);
                }
              },
              prefill: {
                name: chosenAddress.name,
                contact: chosenAddress.mobile,
                email: user?.email || 'customer@myntra.com',
              },
              theme: {
                color: '#ff3f6c',
              },
              modal: {
                ondismiss: async () => {
                  await storeService.reportPaymentCancellation(pendingOrder.id);
                  setOrderError(`Payment dismissed. Order #${pendingOrder.id} is preserved as Cancelled/Pending with retry available.`);
                  setIsPlacing(false);
                },
              },
            };

            // Only attach order_id if it's a real order created on Razorpay's servers
            // If order_id is synthetic/client-fallback, Razorpay standard checkout preferences API returns 400 Bad Request
            if (rzpOrder.isServerOrder && rzpOrder.orderId) {
              options.order_id = rzpOrder.orderId;
            }

            const rzp = new (window as any).Razorpay(options);
            rzp.on('payment.failed', async function (resp: any) {
              const reason = resp?.error?.description || 'Payment was declined by bank or gateway.';
              await storeService.reportPaymentFailure(pendingOrder.id, reason);
              setOrderError(`${reason} Order #${pendingOrder.id} is preserved as Failed. You can safely retry.`);
              setIsPlacing(false);
            });
            rzp.open();
            return;
          }
        }

        // Step 4: Native Mobile / Expo WebBrowser checkout session
        try {
          const checkoutUrl = storeService.getPaymentCheckoutUrl(pendingOrder.id);
          await WebBrowser.openBrowserAsync(checkoutUrl);
          const freshOrder = await storeService.getOrderById(pendingOrder.id);
          if (freshOrder && freshOrder.paymentStatus === 'Paid') {
            onOrderSuccess(freshOrder);
          } else {
            setOrderError(
              `Payment not completed. Order #${pendingOrder.id} is saved with status "${freshOrder?.paymentStatus || 'Pending'}". You can safely retry anytime from My Orders.`
            );
          }
        } catch (wbErr: any) {
          setOrderError('Could not open payment window: ' + (wbErr?.message || 'Unknown error'));
        }
      } catch (err: any) {
        setOrderError(err?.message || 'Payment gateway connection error.');
      } finally {
        setIsPlacing(false);
      }
      return;
    }

    const payLabel =
      paymentMethod === 'cod'
        ? 'Cash on Delivery (COD)'
        : paymentMethod === 'upi'
        ? selectedUpiApp === 'Custom UPI ID'
          ? `UPI (${customUpiId})`
          : `UPI (${selectedUpiApp})`
        : paymentMethod === 'card'
        ? `Card (Ending in ${cardNumber.slice(-4)})`
        : `Net Banking (${selectedBank})`;

    setOrderError(null);
    setIsPlacing(true);

    try {
      const order = await storeService.placeOrder(
        cartItems,
        addressStr,
        appliedCouponCode,
        activeCouponDiscount,
        payLabel,
        user?.id
      );
      onOrderSuccess(order);
    } catch {
      setOrderError(
        'Failed to process order. Your shopping bag items have been preserved. Please retry.'
      );
    } finally {
      setIsPlacing(false);
    }
  };

  const selectedAddr = addresses.find((a) => a.id === selectedAddressId);

  // Core Checkout Screen View Content
  const checkoutContent = (
    <View style={styles.sheetContainer}>
      {/* 1. Header with Breadcrumb Stepper */}
      <View style={styles.header}>
        <View style={styles.headerLeftRow}>
          <TouchableOpacity
            onPress={onClose}
            style={styles.backBtn}
            activeOpacity={0.7}
            accessibilityLabel="Back to bag">
            <Ionicons name="arrow-back" size={22} color={MyntraColors.text} />
          </TouchableOpacity>
          <View>
            <Text style={styles.headerTitle}>CHECKOUT</Text>
            <Text style={styles.headerSub}>
              {cartItems.length} {cartItems.length === 1 ? 'Item' : 'Items'} • ₹
              {finalPayableAmount}
            </Text>
          </View>
        </View>

        <View style={styles.secureBadge}>
          <Ionicons name="shield-checkmark" size={14} color="#047857" />
          <Text style={styles.secureBadgeText}>100% SECURE</Text>
        </View>
      </View>

      {/* 2. Myntra 3-Step Checkout Progress Stepper */}
      <View style={styles.stepperStrip}>
        <View style={styles.stepItem}>
          <View style={[styles.stepCircle, styles.stepCircleDone]}>
            <Ionicons name="checkmark" size={11} color="#fff" />
          </View>
          <Text style={[styles.stepLabel, styles.stepLabelDone]}>BAG</Text>
        </View>

        <View style={[styles.stepLine, styles.stepLineActive]} />

        <View style={styles.stepItem}>
          <View
            style={[
              styles.stepCircle,
              selectedAddr ? styles.stepCircleDone : styles.stepCircleActive,
            ]}>
            {selectedAddr ? (
              <Ionicons name="checkmark" size={11} color="#fff" />
            ) : (
              <Text style={styles.stepCircleText}>2</Text>
            )}
          </View>
          <Text style={[styles.stepLabel, styles.stepLabelActive]}>ADDRESS</Text>
        </View>

        <View style={[styles.stepLine, selectedAddr ? styles.stepLineActive : null]} />

        <View style={styles.stepItem}>
          <View
            style={[
              styles.stepCircle,
              selectedAddr ? styles.stepCircleActive : styles.stepCirclePending,
            ]}>
            <Text
              style={[
                styles.stepCircleText,
                selectedAddr && styles.stepCircleTextActive,
              ]}>
              3
            </Text>
          </View>
          <Text
            style={[
              styles.stepLabel,
              selectedAddr && styles.stepLabelActive,
            ]}>
            PAYMENT
          </Text>
        </View>
      </View>

      {/* Error / Alert Banner */}
      {orderError && (
        <View style={styles.errorBanner}>
          <Ionicons name="alert-circle" size={18} color="#b91c1c" />
          <View style={{ flex: 1, marginHorizontal: 8 }}>
            <Text style={styles.errorBannerText}>{orderError}</Text>
            <TouchableOpacity
              onPress={() => {
                setPaymentMethod('cod');
                setOrderError(null);
                setTimeout(() => {
                  handleConfirmOrder();
                }, 100);
              }}
              style={{
                marginTop: 6,
                backgroundColor: '#b91c1c',
                paddingVertical: 6,
                paddingHorizontal: 12,
                borderRadius: 4,
                alignSelf: 'flex-start',
              }}
              activeOpacity={0.85}>
              <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>
                👉 Pay with Cash on Delivery (COD) Instead
              </Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity onPress={() => setOrderError(null)} activeOpacity={0.7}>
            <Ionicons name="close" size={16} color="#b91c1c" />
          </TouchableOpacity>
        </View>
      )}

      {/* Main Scrollable Sections */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}>
        {/* SECTION 1: ORDER ITEMS SUMMARY (Collapsible Accordion) */}
        <View style={styles.sectionCard}>
          <TouchableOpacity
            onPress={() => setIsItemsExpanded(!isItemsExpanded)}
            style={styles.sectionHeaderRow}
            activeOpacity={0.75}>
            <View style={styles.sectionTitleWithIcon}>
              <Ionicons name="bag-handle-outline" size={17} color={MyntraColors.primary} />
              <Text style={styles.sectionTitle}>
                ORDER SUMMARY ({cartItems.length} {cartItems.length === 1 ? 'Item' : 'Items'})
              </Text>
            </View>
            <View style={styles.headerRightToggle}>
              <Text style={styles.headerToggleText}>
                {isItemsExpanded ? 'Hide' : 'View'}
              </Text>
              <Ionicons
                name={isItemsExpanded ? 'chevron-up' : 'chevron-down'}
                size={16}
                color={MyntraColors.textSecondary}
              />
            </View>
          </TouchableOpacity>

          {/* Delivery Promise Strip */}
          <View style={styles.deliveryEstimateCard}>
            <Ionicons name="flash-outline" size={16} color={MyntraColors.primary} />
            <Text style={styles.deliveryEstimateText}>
              Estimated Delivery by <Text style={styles.boldText}>{deliveryDateString}</Text>
            </Text>
          </View>

          {/* Items List */}
          {isItemsExpanded && (
            <View style={styles.itemsListContainer}>
              {cartItems.map((item, idx) => (
                <View key={item.id || idx} style={styles.itemRow}>
                  <Image
                    source={{
                      uri:
                        item.product?.image ||
                        'https://images.unsplash.com/photo-1521572267360-ee0c2909d518',
                    }}
                    style={styles.itemImage}
                  />
                  <View style={styles.itemInfo}>
                    <Text style={styles.itemBrand}>
                      {item.product?.brand || 'MYNTRA BRAND'}
                    </Text>
                    <Text style={styles.itemName} numberOfLines={1}>
                      {item.product?.name || 'Fashion Apparel'}
                    </Text>

                    <View style={styles.itemPillsRow}>
                      <View style={styles.miniPill}>
                        <Text style={styles.miniPillLabel}>Size: </Text>
                        <Text style={styles.miniPillVal}>{item.size}</Text>
                      </View>
                      {item.color ? (
                        <View style={styles.miniPill}>
                          <Text style={styles.miniPillLabel}>Color: </Text>
                          <Text style={styles.miniPillVal}>{item.color}</Text>
                        </View>
                      ) : null}
                      <View style={styles.miniPill}>
                        <Text style={styles.miniPillLabel}>Qty: </Text>
                        <Text style={styles.miniPillVal}>{item.quantity}</Text>
                      </View>
                    </View>

                    <View style={styles.itemPriceRow}>
                      <Text style={styles.itemFinalPrice}>
                        ₹{(item.product?.price || 0) * item.quantity}
                      </Text>
                      {item.product?.originalPrice &&
                        item.product.originalPrice > item.product.price && (
                          <Text style={styles.itemOriginalPrice}>
                            ₹{item.product.originalPrice * item.quantity}
                          </Text>
                        )}
                    </View>
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* SECTION 2: DELIVERY ADDRESS (Selection & Inline Add/Edit) */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeaderRow}>
            <View style={styles.sectionTitleWithIcon}>
              <Ionicons name="location-outline" size={17} color={MyntraColors.primary} />
              <Text style={styles.sectionTitle}>DELIVERY ADDRESS</Text>
            </View>
            {!showAddAddressForm && (
              <TouchableOpacity
                onPress={handleStartAddNewAddress}
                style={styles.addNewAddrBtn}
                activeOpacity={0.7}>
                <Ionicons name="add" size={14} color={MyntraColors.primary} />
                <Text style={styles.actionLinkText}>ADD NEW</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Form to Add or Edit Address */}
          {showAddAddressForm ? (
            <View style={styles.addAddressForm}>
              <Text style={styles.formTitle}>
                {editingAddress ? 'Edit Delivery Address' : 'Add New Delivery Address'}
              </Text>
              {formError && (
                <View style={styles.formErrorBanner}>
                  <Ionicons name="alert-circle" size={14} color="#b91c1c" />
                  <Text style={styles.formErrorText}>{formError}</Text>
                </View>
              )}

              <Text style={styles.inputLabel}>CONTACT DETAILS</Text>
              <TextInput
                style={styles.formInput}
                placeholder="Full Name *"
                placeholderTextColor={MyntraColors.textMuted}
                value={formName}
                onChangeText={setFormName}
              />
              <TextInput
                style={styles.formInput}
                placeholder="10-Digit Mobile Number *"
                placeholderTextColor={MyntraColors.textMuted}
                keyboardType="phone-pad"
                maxLength={10}
                value={formMobile}
                onChangeText={setFormMobile}
              />

              <Text style={styles.inputLabel}>ADDRESS</Text>
              <TextInput
                style={styles.formInput}
                placeholder="6-Digit PIN Code *"
                placeholderTextColor={MyntraColors.textMuted}
                keyboardType="number-pad"
                maxLength={6}
                value={formPincode}
                onChangeText={setFormPincode}
              />
              <TextInput
                style={[styles.formInput, styles.formInputArea]}
                placeholder="Flat, House no., Building, Apartment, Street *"
                placeholderTextColor={MyntraColors.textMuted}
                multiline
                numberOfLines={2}
                value={formAddress}
                onChangeText={setFormAddress}
              />
              <TextInput
                style={styles.formInput}
                placeholder="Locality / Area / Landmark (Optional)"
                placeholderTextColor={MyntraColors.textMuted}
                value={formLocality}
                onChangeText={setFormLocality}
              />

              <View style={styles.formRowTwo}>
                <TextInput
                  style={[styles.formInput, styles.formInputHalf]}
                  placeholder="City / District *"
                  placeholderTextColor={MyntraColors.textMuted}
                  value={formCity}
                  onChangeText={setFormCity}
                />
                <TextInput
                  style={[styles.formInput, styles.formInputHalf]}
                  placeholder="State *"
                  placeholderTextColor={MyntraColors.textMuted}
                  value={formState}
                  onChangeText={setFormState}
                />
              </View>

              <Text style={styles.inputLabel}>SAVE ADDRESS AS</Text>
              <View style={styles.addressTypeRow}>
                {(['Home', 'Work'] as const).map((t) => (
                  <TouchableOpacity
                    key={t}
                    onPress={() => setFormType(t)}
                    style={[
                      styles.typePill,
                      formType === t && styles.typePillActive,
                    ]}
                    activeOpacity={0.75}>
                    <Ionicons
                      name={t === 'Home' ? 'home-outline' : 'briefcase-outline'}
                      size={14}
                      color={formType === t ? MyntraColors.primary : MyntraColors.textSecondary}
                    />
                    <Text
                      style={[
                        styles.typeText,
                        formType === t && styles.typeTextActive,
                      ]}>
                      {t}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <TouchableOpacity
                onPress={() => setFormIsDefault(!formIsDefault)}
                style={styles.defaultCheckboxRow}
                activeOpacity={0.75}>
                <Ionicons
                  name={formIsDefault ? 'checkbox' : 'square-outline'}
                  size={18}
                  color={formIsDefault ? MyntraColors.primary : MyntraColors.textMuted}
                />
                <Text style={styles.defaultCheckboxText}>Make this my default address</Text>
              </TouchableOpacity>

              <View style={styles.formBtnRow}>
                <TouchableOpacity
                  onPress={() => {
                    setShowAddAddressForm(false);
                    setEditingAddress(null);
                    setFormError(null);
                  }}
                  style={styles.formCancelBtn}
                  activeOpacity={0.75}>
                  <Text style={styles.formCancelText}>CANCEL</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={handleSaveAddress}
                  style={styles.formSaveBtn}
                  activeOpacity={0.85}>
                  <Text style={styles.formSaveText}>
                    {editingAddress ? 'UPDATE ADDRESS' : 'SAVE ADDRESS'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            /* Saved Address Cards List */
            <View style={styles.addressesList}>
              {addresses.map((addr) => {
                const isSelected = selectedAddressId === addr.id;
                return (
                  <TouchableOpacity
                    key={addr.id}
                    onPress={() => setSelectedAddressId(addr.id)}
                    style={[
                      styles.addressCard,
                      isSelected && styles.addressCardSelected,
                    ]}
                    activeOpacity={0.85}>
                    <View style={styles.addressRadioRow}>
                      <View
                        style={[
                          styles.radioOuter,
                          isSelected && styles.radioOuterSelected,
                        ]}>
                        {isSelected && <View style={styles.radioInner} />}
                      </View>

                      <View style={styles.addressDetailsCol}>
                        <View style={styles.addrNameBadgeRow}>
                          <Text style={styles.addrName}>{addr.name}</Text>
                          <View style={styles.addrTypeBadge}>
                            <Text style={styles.addrTypeText}>
                              {addr.addressType.toUpperCase()}
                            </Text>
                          </View>
                          {addr.isDefault && (
                            <View style={styles.defaultBadge}>
                              <Text style={styles.defaultBadgeText}>DEFAULT</Text>
                            </View>
                          )}

                          <TouchableOpacity
                            onPress={() => handleStartEditAddress(addr)}
                            style={styles.editAddrBtn}
                            activeOpacity={0.7}>
                            <Ionicons name="pencil" size={13} color={MyntraColors.primary} />
                            <Text style={styles.editAddrBtnText}>EDIT</Text>
                          </TouchableOpacity>
                        </View>

                        <Text style={styles.addrText}>{addr.address}</Text>
                        {addr.locality ? (
                          <Text style={styles.addrText}>{addr.locality}</Text>
                        ) : null}
                        <Text style={styles.addrText}>
                          {addr.city}, {addr.state} -{' '}
                          <Text style={styles.boldText}>{addr.pincode}</Text>
                        </Text>
                        <Text style={styles.addrMobile}>
                          Mobile: <Text style={styles.boldText}>{addr.mobile}</Text>
                        </Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </View>

        {/* SECTION 3: COUPONS & SAVINGS */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeaderRow}>
            <View style={styles.sectionTitleWithIcon}>
              <Ionicons name="pricetag-outline" size={17} color={MyntraColors.primary} />
              <Text style={styles.sectionTitle}>COUPONS & OFFERS</Text>
            </View>
            {activeCouponObj && (
              <TouchableOpacity onPress={handleRemoveCoupon} activeOpacity={0.7}>
                <Text style={styles.removeCouponText}>REMOVE</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Applied Coupon Banner */}
          {activeCouponObj ? (
            <View style={styles.appliedCouponCard}>
              <View style={styles.appliedCouponLeft}>
                <Ionicons name="checkmark-circle" size={20} color="#047857" />
                <View>
                  <Text style={styles.appliedCouponCodeText}>
                    {activeCouponObj.code} APPLIED
                  </Text>
                  <Text style={styles.appliedCouponSavingsText}>
                    You saved ₹{activeCouponDiscount} with this offer!
                  </Text>
                </View>
              </View>
            </View>
          ) : (
            <>
              {/* Input custom coupon */}
              <View style={styles.couponInputRow}>
                <TextInput
                  style={styles.couponTextInput}
                  placeholder="Enter Coupon Code"
                  placeholderTextColor={MyntraColors.textMuted}
                  autoCapitalize="characters"
                  value={customCouponInput}
                  onChangeText={setCustomCouponInput}
                />
                <TouchableOpacity
                  onPress={() => handleApplyCouponCode(customCouponInput)}
                  style={[
                    styles.applyCouponBtn,
                    !customCouponInput.trim() && styles.applyCouponBtnDisabled,
                  ]}
                  disabled={!customCouponInput.trim()}
                  activeOpacity={0.8}>
                  <Text style={styles.applyCouponBtnText}>APPLY</Text>
                </TouchableOpacity>
              </View>

              {couponError && <Text style={styles.couponErrorText}>{couponError}</Text>}
              {couponSuccessMessage && (
                <Text style={styles.couponSuccessText}>{couponSuccessMessage}</Text>
              )}

              {/* Collapsible available coupons toggle */}
              <TouchableOpacity
                onPress={() => setShowCouponsList(!showCouponsList)}
                style={styles.availableCouponsToggle}
                activeOpacity={0.75}>
                <Text style={styles.availableCouponsToggleText}>
                  {showCouponsList ? 'Hide Available Coupons' : 'View Available Coupons (4)'}
                </Text>
                <Ionicons
                  name={showCouponsList ? 'chevron-up' : 'chevron-down'}
                  size={15}
                  color={MyntraColors.primary}
                />
              </TouchableOpacity>

              {/* Coupons List */}
              {showCouponsList && (
                <View style={styles.couponsList}>
                  {AVAILABLE_COUPONS.map((coupon) => {
                    const isEligible = calculatedSellingPrice >= coupon.minOrder;
                    return (
                      <View key={coupon.code} style={styles.couponItemCard}>
                        <View style={styles.couponItemHeader}>
                          <View style={styles.couponBadge}>
                            <Text style={styles.couponBadgeText}>{coupon.code}</Text>
                          </View>
                          <TouchableOpacity
                            onPress={() => handleApplyCouponCode(coupon.code)}
                            style={[
                              styles.applyItemCouponBtn,
                              !isEligible && styles.applyItemCouponBtnDisabled,
                            ]}
                            activeOpacity={0.8}>
                            <Text style={styles.applyItemCouponBtnText}>APPLY</Text>
                          </TouchableOpacity>
                        </View>
                        <Text style={styles.couponTitleText}>{coupon.title}</Text>
                        <Text style={styles.couponDescText}>{coupon.description}</Text>
                        {!isEligible && (
                          <Text style={styles.couponMinOrderWarning}>
                            Add ₹{coupon.minOrder - calculatedSellingPrice} more to use this
                            offer
                          </Text>
                        )}
                      </View>
                    );
                  })}
                </View>
              )}
            </>
          )}
        </View>

        {/* SECTION 4: PAYMENT OPTIONS */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeaderRow}>
            <View style={styles.sectionTitleWithIcon}>
              <Ionicons name="card-outline" size={17} color={MyntraColors.primary} />
              <Text style={styles.sectionTitle}>PAYMENT OPTION</Text>
            </View>
          </View>

          {/* Demo Sandbox Notice */}
          <View style={styles.demoNoticeBanner}>
            <Ionicons name="information-circle-outline" size={16} color="#1d4ed8" />
            <Text style={styles.demoNoticeText}>
              <Text style={styles.boldText}>Simulated Checkout:</Text> Real order is created
              in app storage without charging actual funds.
            </Text>
          </View>

          {/* Real-Time Razorpay Gateway Option */}
          <TouchableOpacity
            onPress={() => setPaymentMethod('razorpay')}
            style={[
              styles.paymentOptionCard,
              paymentMethod === 'razorpay' && styles.paymentOptionCardActive,
            ]}
            activeOpacity={0.85}>
            <View style={styles.paymentRadioRow}>
              <View
                style={[
                  styles.radioOuter,
                  paymentMethod === 'razorpay' && styles.radioOuterSelected,
                ]}>
                {paymentMethod === 'razorpay' && <View style={styles.radioInner} />}
              </View>
              <View style={styles.paymentOptionInfo}>
                <View style={styles.paymentOptionTitleRow}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={styles.paymentOptionTitle}>Razorpay Payment Gateway</Text>
                    <View style={styles.recommendedBadge}>
                      <Text style={styles.recommendedBadgeText}>LIVE GATEWAY</Text>
                    </View>
                  </View>
                  <Ionicons name="shield-checkmark" size={20} color="#059669" />
                </View>
                <Text style={styles.paymentOptionSub}>
                  Instant UPI (Google Pay, PhonePe, Paytm, QR), Debit/Credit Cards & Net Banking
                </Text>

                {paymentMethod === 'razorpay' && (
                  <View style={styles.razorpayBrandsRow}>
                    <View style={styles.trustBadgePill}>
                      <Ionicons name="lock-closed" size={11} color="#059669" />
                      <Text style={styles.trustBadgeText}>RBI Certified 256-Bit SSL Secured</Text>
                    </View>
                  </View>
                )}
              </View>
            </View>
          </TouchableOpacity>

          {/* 1. Cash on Delivery (COD) */}
          <TouchableOpacity
            onPress={() => setPaymentMethod('cod')}
            style={[
              styles.paymentOptionCard,
              paymentMethod === 'cod' && styles.paymentOptionCardActive,
            ]}
            activeOpacity={0.85}>
            <View style={styles.paymentRadioRow}>
              <View
                style={[
                  styles.radioOuter,
                  paymentMethod === 'cod' && styles.radioOuterSelected,
                ]}>
                {paymentMethod === 'cod' && <View style={styles.radioInner} />}
              </View>
              <View style={styles.paymentOptionInfo}>
                <View style={styles.paymentOptionTitleRow}>
                  <Text style={styles.paymentOptionTitle}>Cash on Delivery (COD)</Text>
                  <Ionicons name="cash-outline" size={20} color={MyntraColors.text} />
                </View>
                <Text style={styles.paymentOptionSub}>
                  Pay cash or scan QR upon delivery at your doorstep
                </Text>
              </View>
            </View>
          </TouchableOpacity>

          {/* 2. Instant UPI */}
          <TouchableOpacity
            onPress={() => setPaymentMethod('upi')}
            style={[
              styles.paymentOptionCard,
              paymentMethod === 'upi' && styles.paymentOptionCardActive,
            ]}
            activeOpacity={0.85}>
            <View style={styles.paymentRadioRow}>
              <View
                style={[
                  styles.radioOuter,
                  paymentMethod === 'upi' && styles.radioOuterSelected,
                ]}>
                {paymentMethod === 'upi' && <View style={styles.radioInner} />}
              </View>
              <View style={styles.paymentOptionInfo}>
                <View style={styles.paymentOptionTitleRow}>
                  <Text style={styles.paymentOptionTitle}>Instant UPI Payment</Text>
                  <Ionicons name="phone-portrait-outline" size={18} color={MyntraColors.text} />
                </View>
                <Text style={styles.paymentOptionSub}>
                  Google Pay, PhonePe, Paytm or UPI ID
                </Text>

                {paymentMethod === 'upi' && (
                  <View style={styles.upiDetailsContainer}>
                    <View style={styles.upiPillsRow}>
                      {(
                        [
                          'Google Pay',
                          'PhonePe',
                          'Paytm UPI',
                          'Custom UPI ID',
                        ] as UpiAppType[]
                      ).map((app) => (
                        <TouchableOpacity
                          key={app}
                          onPress={() => setSelectedUpiApp(app)}
                          style={[
                            styles.upiPill,
                            selectedUpiApp === app && styles.upiPillSelected,
                          ]}
                          activeOpacity={0.75}>
                          <Text
                            style={[
                              styles.upiPillText,
                              selectedUpiApp === app && styles.upiPillTextSelected,
                            ]}>
                            {app}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>

                    {selectedUpiApp === 'Custom UPI ID' && (
                      <View style={styles.customUpiRow}>
                        <TextInput
                          style={styles.customUpiInput}
                          placeholder="e.g. name@okhdfcbank"
                          placeholderTextColor={MyntraColors.textMuted}
                          autoCapitalize="none"
                          value={customUpiId}
                          onChangeText={(t) => {
                            setCustomUpiId(t);
                            setUpiVerified(false);
                          }}
                        />
                        <TouchableOpacity
                          onPress={() => {
                            if (customUpiId.includes('@')) {
                              setUpiVerified(true);
                            }
                          }}
                          style={[
                            styles.verifyUpiBtn,
                            upiVerified && styles.verifyUpiBtnVerified,
                          ]}
                          activeOpacity={0.8}>
                          <Text style={styles.verifyUpiBtnText}>
                            {upiVerified ? 'VERIFIED ✓' : 'VERIFY'}
                          </Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                )}
              </View>
            </View>
          </TouchableOpacity>

          {/* 3. Credit / Debit Cards */}
          <TouchableOpacity
            onPress={() => setPaymentMethod('card')}
            style={[
              styles.paymentOptionCard,
              paymentMethod === 'card' && styles.paymentOptionCardActive,
            ]}
            activeOpacity={0.85}>
            <View style={styles.paymentRadioRow}>
              <View
                style={[
                  styles.radioOuter,
                  paymentMethod === 'card' && styles.radioOuterSelected,
                ]}>
                {paymentMethod === 'card' && <View style={styles.radioInner} />}
              </View>
              <View style={styles.paymentOptionInfo}>
                <View style={styles.paymentOptionTitleRow}>
                  <Text style={styles.paymentOptionTitle}>Credit / Debit Card</Text>
                  <Ionicons name="card-outline" size={20} color={MyntraColors.text} />
                </View>
                <Text style={styles.paymentOptionSub}>
                  Visa, MasterCard, RuPay & Diners Club
                </Text>

                {paymentMethod === 'card' && (
                  <View style={styles.cardFormContainer}>
                    <TextInput
                      style={styles.cardInput}
                      placeholder="16-Digit Card Number *"
                      placeholderTextColor={MyntraColors.textMuted}
                      keyboardType="number-pad"
                      maxLength={19}
                      value={cardNumber}
                      onChangeText={handleCardNumberChange}
                    />
                    <TextInput
                      style={styles.cardInput}
                      placeholder="Name on Card *"
                      placeholderTextColor={MyntraColors.textMuted}
                      value={cardHolder}
                      onChangeText={setCardHolder}
                    />
                    <View style={styles.cardRowTwo}>
                      <TextInput
                        style={[styles.cardInput, styles.cardInputHalf]}
                        placeholder="Valid Thru (MM/YY) *"
                        placeholderTextColor={MyntraColors.textMuted}
                        keyboardType="number-pad"
                        maxLength={5}
                        value={cardExpiry}
                        onChangeText={handleCardExpiryChange}
                      />
                      <TextInput
                        style={[styles.cardInput, styles.cardInputHalf]}
                        placeholder="CVV (3 Digits) *"
                        placeholderTextColor={MyntraColors.textMuted}
                        keyboardType="number-pad"
                        maxLength={3}
                        secureTextEntry
                        value={cardCvv}
                        onChangeText={setCardCvv}
                      />
                    </View>
                  </View>
                )}
              </View>
            </View>
          </TouchableOpacity>

          {/* 4. Net Banking */}
          <TouchableOpacity
            onPress={() => setPaymentMethod('netbanking')}
            style={[
              styles.paymentOptionCard,
              paymentMethod === 'netbanking' && styles.paymentOptionCardActive,
            ]}
            activeOpacity={0.85}>
            <View style={styles.paymentRadioRow}>
              <View
                style={[
                  styles.radioOuter,
                  paymentMethod === 'netbanking' && styles.radioOuterSelected,
                ]}>
                {paymentMethod === 'netbanking' && <View style={styles.radioInner} />}
              </View>
              <View style={styles.paymentOptionInfo}>
                <View style={styles.paymentOptionTitleRow}>
                  <Text style={styles.paymentOptionTitle}>Net Banking</Text>
                  <Ionicons name="business-outline" size={18} color={MyntraColors.text} />
                </View>
                <Text style={styles.paymentOptionSub}>All major Indian retail banks</Text>

                {paymentMethod === 'netbanking' && (
                  <View style={styles.netBankingPillsRow}>
                    {['HDFC Bank', 'ICICI Bank', 'SBI', 'Axis Bank', 'Kotak'].map((b) => (
                      <TouchableOpacity
                        key={b}
                        onPress={() => setSelectedBank(b)}
                        style={[
                          styles.bankPill,
                          selectedBank === b && styles.bankPillSelected,
                        ]}
                        activeOpacity={0.75}>
                        <Text
                          style={[
                            styles.bankPillText,
                            selectedBank === b && styles.bankPillTextSelected,
                          ]}>
                          {b}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>
            </View>
          </TouchableOpacity>
        </View>

        {/* SECTION 5: FINAL PRICE DETAILS BREAKDOWN */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>
            PRICE DETAILS ({cartItems.length} {cartItems.length === 1 ? 'Item' : 'Items'})
          </Text>

          <View style={styles.priceRow}>
            <Text style={styles.priceLabel}>Total MRP</Text>
            <Text style={styles.priceValue}>₹{calculatedMRP}</Text>
          </View>

          <View style={styles.priceRow}>
            <Text style={styles.priceLabel}>Discount on MRP</Text>
            <Text style={styles.discountValue}>- ₹{mrpDiscount}</Text>
          </View>

          {activeCouponDiscount > 0 && (
            <View style={styles.priceRow}>
              <View style={styles.couponLabelRow}>
                <Text style={styles.priceLabel}>Coupon Discount</Text>
                <View style={styles.couponTagPill}>
                  <Text style={styles.couponTagPillText}>{appliedCouponCode}</Text>
                </View>
              </View>
              <Text style={styles.discountValue}>- ₹{activeCouponDiscount}</Text>
            </View>
          )}

          <View style={styles.priceRow}>
            <Text style={styles.priceLabel}>Convenience / Delivery Fee</Text>
            <Text
              style={[
                styles.priceValue,
                effectiveDeliveryFee === 0 && styles.freeDeliveryText,
              ]}>
              {effectiveDeliveryFee === 0 ? 'FREE' : `₹${effectiveDeliveryFee}`}
            </Text>
          </View>

          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total Payable Amount</Text>
            <Text style={styles.totalValue}>₹{finalPayableAmount}</Text>
          </View>

          {totalSavings > 0 && (
            <View style={styles.savingsStrip}>
              <Ionicons name="sparkles" size={14} color="#047857" />
              <Text style={styles.savingsStripText}>
                You are saving ₹{totalSavings} on this order!
              </Text>
            </View>
          )}
        </View>

        {/* Trust Badges Strip */}
        <View style={styles.trustBadgesRow}>
          <View style={styles.trustItem}>
            <Ionicons name="shield-checkmark-outline" size={16} color={MyntraColors.primary} />
            <Text style={styles.trustItemText}>100% SECURE</Text>
          </View>
          <View style={styles.trustDivider} />
          <View style={styles.trustItem}>
            <Ionicons name="ribbon-outline" size={16} color={MyntraColors.primary} />
            <Text style={styles.trustItemText}>GENUINE PRODUCTS</Text>
          </View>
          <View style={styles.trustDivider} />
          <View style={styles.trustItem}>
            <Ionicons name="repeat-outline" size={16} color={MyntraColors.primary} />
            <Text style={styles.trustItemText}>EASY RETURNS</Text>
          </View>
        </View>
      </ScrollView>

      {/* 3. Sticky Bottom Action Footer */}
      <View style={styles.footer}>
        <View style={styles.footerLeft}>
          <Text style={styles.footerTotalLabel}>Total Payable</Text>
          <Text style={styles.footerTotalVal}>₹{finalPayableAmount}</Text>
          <Text style={styles.footerViewDetailsText}>View Detailed Bill</Text>
        </View>

        <TouchableOpacity
          onPress={handleConfirmOrder}
          disabled={isPlacing || !selectedAddr || cartItems.length === 0}
          style={[
            styles.placeOrderBtn,
            (isPlacing || !selectedAddr || cartItems.length === 0) &&
              styles.placeOrderBtnDisabled,
          ]}
          activeOpacity={0.85}>
          {isPlacing ? (
            <View style={styles.btnLoadingRow}>
              <ActivityIndicator color="#fff" size="small" />
              <Text style={styles.placeOrderBtnText}>PROCESSING ORDER...</Text>
            </View>
          ) : (
            <View style={styles.btnTextRow}>
              <Text style={styles.placeOrderBtnText}>PAY & PLACE ORDER</Text>
              <Ionicons name="arrow-forward" size={16} color="#fff" />
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* Unconfigured Gateway Notice Dialog */}
      {unconfiguredNoticeOrder && (
        <Modal
          visible={Boolean(unconfiguredNoticeOrder)}
          transparent
          animationType="fade"
          onRequestClose={() => setUnconfiguredNoticeOrder(null)}>
          <View style={styles.noticeBackdrop}>
            <View style={styles.noticeModalCard}>
              <View style={styles.noticeIconBox}>
                <Ionicons name="shield-checkmark" size={32} color="#b45309" />
              </View>
              <Text style={styles.noticeTitle}>Payment Gateway Setup Required</Text>
              <Text style={styles.noticeOrderId}>Order #{unconfiguredNoticeOrder.id}</Text>
              <Text style={styles.noticeBody}>
                Your order has been recorded safely in the database with status{' '}
                <Text style={{ fontWeight: '800', color: '#b45309' }}>Pending Payment</Text>.
                {'\n\n'}
                To process live card/UPI payments, configure valid RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in server/.env.
              </Text>
              <View style={styles.noticeActions}>
                <TouchableOpacity
                  style={styles.noticePrimaryBtn}
                  onPress={() => {
                    const ord = unconfiguredNoticeOrder;
                    setUnconfiguredNoticeOrder(null);
                    onOrderSuccess(ord);
                  }}>
                  <Text style={styles.noticePrimaryBtnText}>VIEW IN MY ORDERS (PENDING)</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.noticeSecondaryBtn}
                  onPress={async () => {
                    setUnconfiguredNoticeOrder(null);
                    setPaymentMethod('cod');
                    try {
                      setIsPlacing(true);
                      const codOrder = await storeService.placeOrder(
                        cartItems,
                        unconfiguredNoticeOrder.shippingAddress,
                        appliedCouponCode,
                        activeCouponDiscount,
                        'Cash on Delivery (COD)',
                        user?.id
                      );
                      onOrderSuccess(codOrder);
                    } catch (e: any) {
                      setOrderError('Failed to switch to Cash on Delivery: ' + e?.message);
                    } finally {
                      setIsPlacing(false);
                    }
                  }}>
                  <Text style={styles.noticeSecondaryBtnText}>SWITCH TO CASH ON DELIVERY</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.noticeCancelBtn}
                  onPress={() => setUnconfiguredNoticeOrder(null)}>
                  <Text style={styles.noticeCancelBtnText}>CLOSE</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}
    </View>
  );

  // If embedded within ShoppingBagModal, render directly without launching nested Modal
  if (embedded) {
    if (!visible) return null;
    return <View style={styles.embeddedOverlay}>{checkoutContent}</View>;
  }

  // Standalone Modal usage
  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}>
      <View style={styles.overlay}>{checkoutContent}</View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  embeddedOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: '#fff',
    zIndex: 100,
  },
  sheetContainer: {
    width: '100%',
    maxWidth: Platform.OS === 'web' ? 540 : undefined,
    height: Platform.OS === 'web' ? '96%' : '100%',
    backgroundColor: '#f5f5f7',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    overflow: 'hidden',
  },
  // Top Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: 12,
    backgroundColor: MyntraColors.white,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f3',
  },
  headerLeftRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: MyntraColors.text,
    letterSpacing: 0.8,
  },
  headerSub: {
    fontSize: 11,
    color: MyntraColors.textSecondary,
    fontWeight: '600',
    marginTop: 1,
  },
  secureBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#ecfdf5',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  secureBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#047857',
    letterSpacing: 0.5,
  },

  // 3-Step Checkout Stepper Strip
  stepperStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: MyntraColors.white,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#eaeaee',
  },
  stepItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  stepCircle: {
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#e5e7eb',
  },
  stepCircleDone: {
    backgroundColor: '#047857',
  },
  stepCircleActive: {
    backgroundColor: MyntraColors.primary,
  },
  stepCirclePending: {
    backgroundColor: '#e5e7eb',
  },
  stepCircleText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#9ca3af',
  },
  stepCircleTextActive: {
    color: '#fff',
  },
  stepLabel: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#9ca3af',
    letterSpacing: 0.5,
  },
  stepLabelDone: {
    color: '#047857',
  },
  stepLabelActive: {
    color: MyntraColors.text,
    fontWeight: '800',
  },
  stepLine: {
    flex: 1,
    height: 2,
    backgroundColor: '#e5e7eb',
    marginHorizontal: 8,
  },
  stepLineActive: {
    backgroundColor: '#047857',
  },

  // Error Banner
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#fef2f2',
    borderBottomWidth: 1,
    borderBottomColor: '#fecaca',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  errorBannerText: {
    flex: 1,
    fontSize: 11.5,
    fontWeight: '600',
    color: '#b91c1c',
  },

  // Scroll Content & Sections
  scrollContent: {
    padding: Spacing.md,
    paddingBottom: 100,
    gap: 12,
  },
  sectionCard: {
    backgroundColor: MyntraColors.white,
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e8e8ec',
    gap: 10,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitleWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sectionTitle: {
    fontSize: 11.5,
    fontWeight: '800',
    color: MyntraColors.text,
    letterSpacing: 0.6,
  },
  headerRightToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  headerToggleText: {
    fontSize: 11,
    color: MyntraColors.textSecondary,
    fontWeight: '600',
  },
  addNewAddrBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  actionLinkText: {
    fontSize: 11,
    fontWeight: '800',
    color: MyntraColors.primary,
    letterSpacing: 0.4,
  },

  // Order Items Preview
  deliveryEstimateCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#fff0f3',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  deliveryEstimateText: {
    fontSize: 11,
    color: MyntraColors.text,
  },
  boldText: {
    fontWeight: '800',
    color: MyntraColors.text,
  },
  itemsListContainer: {
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f4',
    paddingTop: 10,
  },
  itemRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
  },
  itemImage: {
    width: 48,
    height: 60,
    borderRadius: 4,
    backgroundColor: '#f0f0f3',
  },
  itemInfo: {
    flex: 1,
  },
  itemBrand: {
    fontSize: 11,
    fontWeight: '800',
    color: MyntraColors.text,
  },
  itemName: {
    fontSize: 11,
    color: MyntraColors.textSecondary,
    marginTop: 1,
  },
  itemPillsRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 3,
  },
  miniPill: {
    flexDirection: 'row',
    backgroundColor: '#f3f4f6',
    borderRadius: 3,
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  miniPillLabel: {
    fontSize: 9.5,
    color: MyntraColors.textMuted,
  },
  miniPillVal: {
    fontSize: 9.5,
    fontWeight: '700',
    color: MyntraColors.text,
  },
  itemPriceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  itemFinalPrice: {
    fontSize: 12,
    fontWeight: '800',
    color: MyntraColors.text,
  },
  itemOriginalPrice: {
    fontSize: 10.5,
    color: MyntraColors.textMuted,
    textDecorationLine: 'line-through',
  },

  // Address Selector & Form
  addressesList: {
    gap: 10,
  },
  addressCard: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    padding: 12,
    backgroundColor: '#fff',
  },
  addressCardSelected: {
    borderColor: MyntraColors.primary,
    backgroundColor: '#fffbfa',
  },
  addressRadioRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  radioOuter: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: '#9ca3af',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
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
  addressDetailsCol: {
    flex: 1,
  },
  addrNameBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  addrName: {
    fontSize: 12.5,
    fontWeight: '800',
    color: MyntraColors.text,
  },
  addrTypeBadge: {
    backgroundColor: '#f3f4f6',
    borderRadius: 3,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  addrTypeText: {
    fontSize: 9,
    fontWeight: '800',
    color: MyntraColors.textSecondary,
  },
  defaultBadge: {
    backgroundColor: '#ecfdf5',
    borderRadius: 3,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  defaultBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#047857',
  },
  editAddrBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginLeft: 'auto',
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  editAddrBtnText: {
    fontSize: 10.5,
    fontWeight: '800',
    color: MyntraColors.primary,
  },
  addrText: {
    fontSize: 11.5,
    color: MyntraColors.textSecondary,
    lineHeight: 16,
  },
  addrMobile: {
    fontSize: 11,
    color: MyntraColors.textSecondary,
    marginTop: 4,
  },

  // Address Add/Edit Form
  addAddressForm: {
    gap: 10,
    paddingTop: 4,
  },
  formTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: MyntraColors.text,
  },
  formErrorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#fef2f2',
    padding: 8,
    borderRadius: 6,
  },
  formErrorText: {
    fontSize: 11,
    color: '#b91c1c',
    fontWeight: '600',
  },
  inputLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: MyntraColors.textMuted,
    letterSpacing: 0.5,
    marginTop: 4,
  },
  formInput: {
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 12,
    color: MyntraColors.text,
  },
  formInputArea: {
    minHeight: 54,
    textAlignVertical: 'top',
  },
  formRowTwo: {
    flexDirection: 'row',
    gap: 8,
  },
  formInputHalf: {
    flex: 1,
  },
  addressTypeRow: {
    flexDirection: 'row',
    gap: 10,
  },
  typePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#fff',
  },
  typePillActive: {
    borderColor: MyntraColors.primary,
    backgroundColor: '#fff4f6',
  },
  typeText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: MyntraColors.textSecondary,
  },
  typeTextActive: {
    color: MyntraColors.primary,
    fontWeight: '800',
  },
  defaultCheckboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  defaultCheckboxText: {
    fontSize: 11.5,
    color: MyntraColors.text,
  },
  formBtnRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 6,
  },
  formCancelBtn: {
    flex: 1,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  formCancelText: {
    fontSize: 11,
    fontWeight: '700',
    color: MyntraColors.text,
  },
  formSaveBtn: {
    flex: 1.5,
    paddingVertical: 10,
    backgroundColor: MyntraColors.primary,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  formSaveText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: 0.5,
  },

  // Coupons Section
  removeCouponText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#dc2626',
    letterSpacing: 0.4,
  },
  appliedCouponCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#bbf7d0',
    borderRadius: 6,
    padding: 10,
  },
  appliedCouponLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  appliedCouponCodeText: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#047857',
  },
  appliedCouponSavingsText: {
    fontSize: 10.5,
    color: '#15803d',
    marginTop: 1,
  },
  couponInputRow: {
    flexDirection: 'row',
    gap: 8,
  },
  couponTextInput: {
    flex: 1,
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 12,
    color: MyntraColors.text,
    fontWeight: '700',
  },
  applyCouponBtn: {
    backgroundColor: MyntraColors.primary,
    paddingHorizontal: 18,
    justifyContent: 'center',
    borderRadius: 6,
  },
  applyCouponBtnDisabled: {
    backgroundColor: '#e5e7eb',
  },
  applyCouponBtnText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  couponErrorText: {
    fontSize: 11,
    color: '#dc2626',
    fontWeight: '600',
  },
  couponSuccessText: {
    fontSize: 11,
    color: '#047857',
    fontWeight: '700',
  },
  availableCouponsToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  availableCouponsToggleText: {
    fontSize: 11,
    fontWeight: '700',
    color: MyntraColors.primary,
  },
  couponsList: {
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f4',
    paddingTop: 8,
  },
  couponItemCard: {
    backgroundColor: '#fafbfc',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 6,
    padding: 10,
    gap: 4,
  },
  couponItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  couponBadge: {
    backgroundColor: '#fff0f3',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  couponBadgeText: {
    fontSize: 10.5,
    fontWeight: '800',
    color: MyntraColors.primary,
  },
  applyItemCouponBtn: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: MyntraColors.primary,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 4,
  },
  applyItemCouponBtnDisabled: {
    borderColor: '#d1d5db',
    opacity: 0.6,
  },
  applyItemCouponBtnText: {
    fontSize: 10,
    fontWeight: '800',
    color: MyntraColors.primary,
  },
  couponTitleText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: MyntraColors.text,
  },
  couponDescText: {
    fontSize: 10.5,
    color: MyntraColors.textSecondary,
    lineHeight: 14,
  },
  couponMinOrderWarning: {
    fontSize: 10,
    color: '#c2410c',
    fontWeight: '600',
  },

  // Payment Section
  demoNoticeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#bfdbfe',
    borderRadius: 6,
    padding: 8,
  },
  demoNoticeText: {
    flex: 1,
    fontSize: 10.5,
    color: '#1e40af',
    lineHeight: 14,
  },
  paymentOptionCard: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    padding: 12,
    backgroundColor: '#fff',
  },
  paymentOptionCardActive: {
    borderColor: MyntraColors.primary,
    backgroundColor: '#fffbfa',
  },
  paymentRadioRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  paymentOptionInfo: {
    flex: 1,
  },
  paymentOptionTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  paymentOptionTitle: {
    fontSize: 12.5,
    fontWeight: '800',
    color: MyntraColors.text,
  },
  paymentOptionSub: {
    fontSize: 11,
    color: MyntraColors.textSecondary,
    marginTop: 2,
  },
  // UPI Sub-options
  upiDetailsContainer: {
    marginTop: 10,
    gap: 8,
  },
  upiPillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  upiPill: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: '#fff',
  },
  upiPillSelected: {
    borderColor: MyntraColors.primary,
    backgroundColor: '#fff4f6',
  },
  upiPillText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: MyntraColors.textSecondary,
  },
  upiPillTextSelected: {
    color: MyntraColors.primary,
    fontWeight: '800',
  },
  customUpiRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 4,
  },
  customUpiInput: {
    flex: 1,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 11.5,
    color: MyntraColors.text,
  },
  verifyUpiBtn: {
    backgroundColor: '#1f2937',
    paddingHorizontal: 12,
    justifyContent: 'center',
    borderRadius: 4,
  },
  verifyUpiBtnVerified: {
    backgroundColor: '#047857',
  },
  verifyUpiBtnText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '800',
  },
  // Card Form
  cardFormContainer: {
    marginTop: 10,
    gap: 8,
  },
  cardInput: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 4,
    paddingHorizontal: 10,
    paddingVertical: 7,
    fontSize: 11.5,
    color: MyntraColors.text,
  },
  cardRowTwo: {
    flexDirection: 'row',
    gap: 8,
  },
  cardInputHalf: {
    flex: 1,
  },
  // Net Banking
  netBankingPillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
  },
  bankPill: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: '#fff',
  },
  bankPillSelected: {
    borderColor: MyntraColors.primary,
    backgroundColor: '#fff4f6',
  },
  bankPillText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: MyntraColors.textSecondary,
  },
  bankPillTextSelected: {
    color: MyntraColors.primary,
    fontWeight: '800',
  },

  // Price Breakdown Section
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 3,
  },
  priceLabel: {
    fontSize: 11.5,
    color: MyntraColors.textSecondary,
  },
  priceValue: {
    fontSize: 11.5,
    fontWeight: '600',
    color: MyntraColors.text,
  },
  freeDeliveryText: {
    color: MyntraColors.ratingGreen,
    fontWeight: '800',
  },
  discountValue: {
    fontSize: 11.5,
    fontWeight: '700',
    color: MyntraColors.ratingGreen,
  },
  couponLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  couponTagPill: {
    backgroundColor: '#fff0f3',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 3,
  },
  couponTagPillText: {
    fontSize: 9,
    fontWeight: '800',
    color: MyntraColors.primary,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    paddingTop: 8,
    marginTop: 6,
  },
  totalLabel: {
    fontSize: 13,
    fontWeight: '800',
    color: MyntraColors.text,
  },
  totalValue: {
    fontSize: 15,
    fontWeight: '900',
    color: MyntraColors.text,
  },
  savingsStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#f0fdf4',
    padding: 8,
    borderRadius: 6,
    marginTop: 4,
  },
  savingsStripText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#047857',
  },

  // Trust Badges
  trustBadgesRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingVertical: 8,
  },
  trustItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  trustItemText: {
    fontSize: 9.5,
    fontWeight: '800',
    color: MyntraColors.textSecondary,
    letterSpacing: 0.4,
  },
  trustDivider: {
    width: 1,
    height: 14,
    backgroundColor: '#d1d5db',
  },

  // Sticky Bottom Action Footer
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: 12,
    backgroundColor: MyntraColors.white,
    borderTopWidth: 1,
    borderTopColor: '#eaeaee',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 8,
  },
  footerLeft: {
    gap: 1,
  },
  footerTotalLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: MyntraColors.textMuted,
    letterSpacing: 0.4,
  },
  footerTotalVal: {
    fontSize: 15,
    fontWeight: '900',
    color: MyntraColors.text,
  },
  footerViewDetailsText: {
    fontSize: 9.5,
    color: MyntraColors.primary,
    fontWeight: '700',
  },
  placeOrderBtn: {
    backgroundColor: MyntraColors.primary,
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 170,
  },
  placeOrderBtnDisabled: {
    backgroundColor: '#fca5a5',
  },
  btnTextRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  btnLoadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  placeOrderBtnText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  recommendedBadge: {
    backgroundColor: '#059669',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  recommendedBadgeText: {
    color: '#fff',
    fontSize: 8.5,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  razorpayBrandsRow: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  trustBadgePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#ecfdf5',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#a7f3d0',
  },
  trustBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#065f46',
  },
  noticeBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  noticeModalCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    maxWidth: 440,
    width: '100%',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 10,
  },
  noticeIconBox: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#fef3c7',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  noticeTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: MyntraColors.text,
    textAlign: 'center',
    marginBottom: 6,
  },
  noticeOrderId: {
    fontSize: 13,
    fontWeight: '700',
    color: MyntraColors.primary,
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  noticeBody: {
    fontSize: 13,
    lineHeight: 19,
    color: '#4b5563',
    textAlign: 'center',
    marginBottom: 20,
  },
  noticeActions: {
    width: '100%',
    gap: 10,
  },
  noticePrimaryBtn: {
    backgroundColor: MyntraColors.primary,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  noticePrimaryBtnText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  noticeSecondaryBtn: {
    backgroundColor: '#f3f4f6',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  noticeSecondaryBtnText: {
    color: MyntraColors.text,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  noticeCancelBtn: {
    paddingVertical: 10,
    alignItems: 'center',
  },
  noticeCancelBtnText: {
    color: MyntraColors.textMuted,
    fontSize: 12,
    fontWeight: '600',
  },
});
