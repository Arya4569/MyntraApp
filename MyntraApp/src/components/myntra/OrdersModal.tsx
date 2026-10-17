import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { MyntraColors, Spacing } from '@/constants/myntra-theme';
import { storeService } from '@/services/store-service';
import { Order } from '@/types/store';

export type OrderFilterTab = 'all' | 'active' | 'delivered' | 'cancelled';

export interface OrdersModalProps {
  visible: boolean;
  onClose: () => void;
  onStartShopping: () => void;
  userId?: string;
  initialOrderId?: string;
}

const CANCEL_REASONS = [
  'Incorrect size or color selected',
  'Delivery time is too long',
  'Found better price elsewhere',
  'Ordered by mistake',
  "Changed my mind / Don't need it anymore",
];

const RETURN_REASONS = [
  'Size too small / tight',
  'Size too large / loose',
  'Quality or fabric not as expected',
  'Item received was damaged / defective',
  'Different from image or description',
];

export const OrdersModal: React.FC<OrdersModalProps> = ({
  visible,
  onClose,
  onStartShopping,
  userId,
  initialOrderId,
}) => {
  // Orders state
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Active filter tab & search query
  const [activeTab, setActiveTab] = useState<OrderFilterTab>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Selected Order for expanded details / tracking
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
  const [detailsModalOrder, setDetailsModalOrder] = useState<Order | null>(null);

  // Cancel order modal
  const [cancelOrderTarget, setCancelOrderTarget] = useState<Order | null>(null);
  const [selectedCancelReason, setSelectedCancelReason] = useState(CANCEL_REASONS[0]);
  const [isCancelling, setIsCancelling] = useState(false);

  // Return / Exchange modal
  const [returnOrderTarget, setReturnOrderTarget] = useState<Order | null>(null);
  const [returnType, setReturnType] = useState<'return' | 'exchange'>('return');
  const [selectedReturnReason, setSelectedReturnReason] = useState(RETURN_REASONS[0]);
  const [isSubmittingReturn, setIsSubmittingReturn] = useState(false);

  // User feedback toast/banner
  const [feedbackMessage, setFeedbackMessage] = useState<{
    text: string;
    isError?: boolean;
  } | null>(null);

  const showFeedback = useCallback((text: string, isError = false) => {
    setFeedbackMessage({ text, isError });
    setTimeout(() => {
      setFeedbackMessage(null);
    }, 3500);
  }, []);

  // Load orders from storage
  const loadOrders = useCallback(async (isPullRefresh = false) => {
    if (isPullRefresh) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }
    setLoadError(null);

    try {
      const data = await storeService.getOrders(userId);
      setOrders(data);
      if (isPullRefresh) {
        showFeedback('Order list updated');
      }
    } catch {
      setLoadError('Unable to load orders. Please try again.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [userId, showFeedback]);

  // Reset modal state when visible changes
  const [prevVisible, setPrevVisible] = useState(visible);
  if (visible !== prevVisible) {
    setPrevVisible(visible);
    if (!visible) {
      setDetailsModalOrder(null);
      setExpandedOrderId(null);
      setCancelOrderTarget(null);
      setReturnOrderTarget(null);
      setSearchQuery('');
    }
  }

  // Load when visible via async external query
  useEffect(() => {
    let isMounted = true;
    if (visible) {
      storeService
        .getOrders(userId)
        .then((data) => {
          if (isMounted) {
            setOrders(data);
            setIsLoading(false);
          }
        })
        .catch(() => {
          if (isMounted) {
            setLoadError('Unable to load orders. Please try again.');
            setIsLoading(false);
          }
        });
    }
    return () => {
      isMounted = false;
    };
  }, [visible, userId]);

  // Support opening initialOrderId if specified
  const [prevInitialOrderId, setPrevInitialOrderId] = useState(initialOrderId);
  if (initialOrderId !== prevInitialOrderId) {
    setPrevInitialOrderId(initialOrderId);
    if (initialOrderId && orders.length > 0) {
      const target = orders.find((o) => o.id === initialOrderId);
      if (target) {
        setDetailsModalOrder(target);
      }
    }
  }

  // Status helper checkers
  const isOrderActive = (status: Order['status']) => {
    return (
      status === 'Placed' ||
      status === 'Confirmed' ||
      status === 'Shipped' ||
      status === 'Out for Delivery'
    );
  };

  const isOrderDelivered = (status: Order['status']) => {
    return status === 'Delivered';
  };

  const isOrderCancelledOrReturned = (status: Order['status']) => {
    return status === 'Cancelled' || status === 'Returned';
  };

  // Counts for tabs
  const counts = useMemo(() => {
    return {
      all: orders.length,
      active: orders.filter((o) => isOrderActive(o.status)).length,
      delivered: orders.filter((o) => isOrderDelivered(o.status)).length,
      cancelled: orders.filter((o) => isOrderCancelledOrReturned(o.status)).length,
    };
  }, [orders]);

  // Filtered orders list
  const filteredOrders = useMemo(() => {
    let result = orders;

    // Filter by tab
    if (activeTab === 'active') {
      result = result.filter((o) => isOrderActive(o.status));
    } else if (activeTab === 'delivered') {
      result = result.filter((o) => isOrderDelivered(o.status));
    } else if (activeTab === 'cancelled') {
      result = result.filter((o) => isOrderCancelledOrReturned(o.status));
    }

    // Filter by search query
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      result = result.filter(
        (o) =>
          o.id.toLowerCase().includes(q) ||
          o.items.some(
            (item) =>
              item.product?.name?.toLowerCase().includes(q) ||
              item.product?.brand?.toLowerCase().includes(q)
          )
      );
    }

    return result;
  }, [orders, activeTab, searchQuery]);

  // Cancel order execution
  const handleConfirmCancel = async () => {
    if (!cancelOrderTarget) return;
    setIsCancelling(true);
    try {
      const ok = await storeService.cancelOrder(
        cancelOrderTarget.id,
        selectedCancelReason
      );
      if (ok) {
        showFeedback(`Order #${cancelOrderTarget.id} was cancelled successfully.`);
        // Update local order list and currently viewed details if any
        setOrders((prev) =>
          prev.map((o) => {
            if (o.id === cancelOrderTarget.id) {
              const updated: Order = {
                ...o,
                status: 'Cancelled',
                paymentStatus: o.paymentStatus === 'Paid' ? 'Refunded' : o.paymentStatus,
                trackingSteps: [
                  ...o.trackingSteps.map((s) => ({ ...s, active: false })),
                  {
                    title: `Cancelled (${selectedCancelReason})`,
                    date: 'Today',
                    completed: true,
                    active: false,
                  },
                ],
              };
              if (detailsModalOrder && detailsModalOrder.id === o.id) {
                setDetailsModalOrder(updated);
              }
              return updated;
            }
            return o;
          })
        );
        setCancelOrderTarget(null);
      } else {
        showFeedback(
          'Unable to cancel this order. Backend policy only allows cancellation prior to dispatch and delivery.',
          true
        );
      }
    } catch {
      showFeedback('Cancellation failed. Please check your network and retry.', true);
    } finally {
      setIsCancelling(false);
    }
  };

  // Return / Exchange execution
  const handleConfirmReturn = async () => {
    if (!returnOrderTarget) return;
    setIsSubmittingReturn(true);
    try {
      const ok = await storeService.returnOrder(
        returnOrderTarget.id,
        returnType,
        selectedReturnReason
      );
      if (ok) {
        const actionLabel = returnType === 'exchange' ? 'Exchange request' : 'Return';
        showFeedback(
          `${actionLabel} for #${returnOrderTarget.id} initiated. Courier pickup scheduled in 1-2 business days.`
        );
        // Update local order list and currently viewed details if any
        setOrders((prev) =>
          prev.map((o) => {
            if (o.id === returnOrderTarget.id) {
              const updated: Order = {
                ...o,
                status: 'Returned',
                paymentStatus: returnType === 'return' ? 'Refunded' : o.paymentStatus,
                trackingSteps: [
                  ...o.trackingSteps,
                  {
                    title:
                      returnType === 'exchange'
                        ? `Exchange Requested (${selectedReturnReason})`
                        : `Return Initiated (${selectedReturnReason})`,
                    date: 'Pickup in 1-2 business days',
                    completed: true,
                    active: false,
                  },
                ],
              };
              if (detailsModalOrder && detailsModalOrder.id === o.id) {
                setDetailsModalOrder(updated);
              }
              return updated;
            }
            return o;
          })
        );
        setReturnOrderTarget(null);
      } else {
        showFeedback(
          'Return request could not be processed. Backend policy requires Delivered status.',
          true
        );
      }
    } catch {
      showFeedback('Return submission failed. Please try again.', true);
    } finally {
      setIsSubmittingReturn(false);
    }
  };

  // Status visual badge styling
  const getStatusBadge = (status: Order['status']) => {
    switch (status) {
      case 'Delivered':
        return {
          bg: '#ecfdf5',
          text: '#047857',
          icon: 'checkmark-circle' as const,
          label: 'DELIVERED',
        };
      case 'Out for Delivery':
        return {
          bg: '#fff7ed',
          text: '#c2410c',
          icon: 'bicycle-outline' as const,
          label: 'OUT FOR DELIVERY',
        };
      case 'Shipped':
        return {
          bg: '#eff6ff',
          text: '#1d4ed8',
          icon: 'airplane-outline' as const,
          label: 'SHIPPED',
        };
      case 'Confirmed':
      case 'Placed':
        return {
          bg: '#f0fdfa',
          text: '#0f766e',
          icon: 'checkmark' as const,
          label: status.toUpperCase(),
        };
      case 'Cancelled':
        return {
          bg: '#fef2f2',
          text: '#b91c1c',
          icon: 'close-circle' as const,
          label: 'CANCELLED',
        };
      case 'Returned':
        return {
          bg: '#faf5ff',
          text: '#7e22ce',
          icon: 'repeat-outline' as const,
          label: 'RETURNED',
        };
      default:
        return {
          bg: '#f3f4f6',
          text: '#374151',
          icon: 'cube-outline' as const,
          label: status,
        };
    }
  };

  const formatDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheetContainer}>
          {/* ============================================================== */}
          {/* SCREEN 1: FULL ORDER DETAILS VIEW (when an order is selected)  */}
          {/* ============================================================== */}
          {detailsModalOrder ? (
            <View style={styles.detailsContainer}>
              {/* Header Bar */}
              <View style={styles.detailsHeader}>
                <TouchableOpacity
                  onPress={() => setDetailsModalOrder(null)}
                  style={styles.detailsBackBtn}
                  activeOpacity={0.7}
                  accessibilityLabel="Back to orders">
                  <Ionicons name="arrow-back" size={22} color={MyntraColors.text} />
                </TouchableOpacity>

                <View style={styles.detailsHeaderCenter}>
                  <Text style={styles.detailsHeaderTitle}>ORDER DETAILS</Text>
                  <Text style={styles.detailsHeaderId}>#{detailsModalOrder.id}</Text>
                </View>

                <TouchableOpacity
                  onPress={onClose}
                  style={styles.detailsBackBtn}
                  activeOpacity={0.7}
                  accessibilityLabel="Close orders">
                  <Ionicons name="close" size={22} color={MyntraColors.text} />
                </TouchableOpacity>
              </View>

              {/* Feedback toast */}
              {feedbackMessage && (
                <View
                  style={[
                    styles.feedbackBanner,
                    feedbackMessage.isError
                      ? styles.feedbackBannerError
                      : styles.feedbackBannerSuccess,
                  ]}>
                  <Ionicons
                    name={
                      feedbackMessage.isError
                        ? 'alert-circle'
                        : 'checkmark-circle'
                    }
                    size={16}
                    color={feedbackMessage.isError ? '#b91c1c' : '#047857'}
                  />
                  <Text
                    style={[
                      styles.feedbackBannerText,
                      feedbackMessage.isError
                        ? styles.feedbackBannerTextError
                        : styles.feedbackBannerTextSuccess,
                    ]}>
                    {feedbackMessage.text}
                  </Text>
                </View>
              )}

              {/* Scrollable details */}
              <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.detailsScrollContent}>
                {/* 1. Status Overview Banner */}
                {(() => {
                  const statusBadge = getStatusBadge(detailsModalOrder.status);
                  return (
                    <View style={styles.detailStatusCard}>
                      <View style={styles.detailStatusTopRow}>
                        <View
                          style={[
                            styles.statusBadge,
                            { backgroundColor: statusBadge.bg },
                          ]}>
                          <Ionicons
                            name={statusBadge.icon}
                            size={14}
                            color={statusBadge.text}
                          />
                          <Text
                            style={[
                              styles.statusBadgeText,
                              { color: statusBadge.text },
                            ]}>
                            {statusBadge.label}
                          </Text>
                        </View>
                        <Text style={styles.detailOrderDate}>
                          Placed: {formatDate(detailsModalOrder.date)}
                        </Text>
                      </View>

                      <Text style={styles.detailDeliveryHeadline}>
                        {detailsModalOrder.status === 'Delivered'
                          ? `Delivered on ${detailsModalOrder.deliveryDate}`
                          : detailsModalOrder.status === 'Cancelled'
                          ? 'This order was cancelled.'
                          : detailsModalOrder.status === 'Returned'
                          ? 'Return processed. Refund issued.'
                          : `Arriving by ${detailsModalOrder.deliveryDate}`}
                      </Text>
                      <Text style={styles.detailDeliverySub}>
                        {detailsModalOrder.status === 'Delivered'
                          ? 'Thank you for shopping with Myntra! 14-day easy return or exchange eligible.'
                          : detailsModalOrder.status === 'Cancelled'
                          ? 'As requested, your order has been cancelled and any paid amount is refunded.'
                          : detailsModalOrder.status === 'Returned'
                          ? 'Pickup will be completed by delivery partner. Refund credited within 24-48 hours.'
                          : 'Your package is on track. Live updates will reflect below.'}
                      </Text>
                    </View>
                  );
                })()}

                {/* 2. Shipment Tracking Stepper */}
                {detailsModalOrder.trackingSteps && detailsModalOrder.trackingSteps.length > 0 && (
                  <View style={styles.detailSectionCard}>
                    <View style={styles.sectionHeaderRow}>
                      <Ionicons name="git-commit-outline" size={17} color={MyntraColors.primary} />
                      <Text style={styles.sectionHeaderTitle}>SHIPMENT TRACKING</Text>
                    </View>

                    <View style={styles.stepperContainer}>
                      {detailsModalOrder.trackingSteps.map((step, sIdx) => {
                        const isLast = sIdx === detailsModalOrder.trackingSteps.length - 1;
                        return (
                          <View key={sIdx} style={styles.stepperRow}>
                            <View style={styles.stepperTrackCol}>
                              <View
                                style={[
                                  styles.stepperDot,
                                  step.completed && styles.stepperDotCompleted,
                                  step.active && styles.stepperDotActive,
                                ]}>
                                {step.completed ? (
                                  <Ionicons name="checkmark" size={10} color="#fff" />
                                ) : step.active ? (
                                  <View style={styles.stepperDotInnerActive} />
                                ) : null}
                              </View>
                              {!isLast && (
                                <View
                                  style={[
                                    styles.stepperLine,
                                    step.completed && styles.stepperLineCompleted,
                                  ]}
                                />
                              )}
                            </View>

                            <View style={styles.stepperInfoCol}>
                              <Text
                                style={[
                                  styles.stepperTitle,
                                  step.completed && styles.stepperTitleCompleted,
                                  step.active && styles.stepperTitleActive,
                                ]}>
                                {step.title}
                              </Text>
                              <Text style={styles.stepperDate}>{step.date}</Text>
                            </View>
                          </View>
                        );
                      })}
                    </View>
                  </View>
                )}

                {/* 3. Items Ordered Card */}
                <View style={styles.detailSectionCard}>
                  <View style={styles.sectionHeaderRow}>
                    <Ionicons name="bag-check-outline" size={17} color={MyntraColors.primary} />
                    <Text style={styles.sectionHeaderTitle}>
                      ITEMS ORDERED ({detailsModalOrder.items.length})
                    </Text>
                  </View>

                  <View style={styles.detailItemsList}>
                    {detailsModalOrder.items.map((item, idx) => (
                      <View key={idx} style={styles.detailItemCard}>
                        <Image
                          source={{
                            uri:
                              item.product?.image ||
                              'https://images.unsplash.com/photo-1521572267360-ee0c2909d518',
                          }}
                          style={styles.detailProductImage}
                        />
                        <View style={styles.detailProductInfo}>
                          <Text style={styles.detailProductBrand}>
                            {item.product?.brand || 'MYNTRA BRAND'}
                          </Text>
                          <Text style={styles.detailProductName} numberOfLines={2}>
                            {item.product?.name || 'Fashion Apparel'}
                          </Text>
                          <View style={styles.detailMetaPillsRow}>
                            <View style={styles.metaPill}>
                              <Text style={styles.metaPillLabel}>Size: </Text>
                              <Text style={styles.metaPillVal}>{item.size}</Text>
                            </View>
                            {item.color ? (
                              <View style={styles.metaPill}>
                                <Text style={styles.metaPillLabel}>Color: </Text>
                                <Text style={styles.metaPillVal}>{item.color}</Text>
                              </View>
                            ) : null}
                            <View style={styles.metaPill}>
                              <Text style={styles.metaPillLabel}>Qty: </Text>
                              <Text style={styles.metaPillVal}>{item.quantity}</Text>
                            </View>
                          </View>
                          <View style={styles.detailPriceRow}>
                            <Text style={styles.detailItemFinalPrice}>
                              ₹{(item.product?.price || 0) * item.quantity}
                            </Text>
                            {item.product?.originalPrice &&
                              item.product.originalPrice > item.product.price && (
                                <Text style={styles.detailItemOriginalPrice}>
                                  ₹{item.product.originalPrice * item.quantity}
                                </Text>
                              )}
                          </View>
                        </View>
                      </View>
                    ))}
                  </View>
                </View>

                {/* 4. Delivery Address */}
                <View style={styles.detailSectionCard}>
                  <View style={styles.sectionHeaderRow}>
                    <Ionicons name="location-outline" size={17} color={MyntraColors.primary} />
                    <Text style={styles.sectionHeaderTitle}>DELIVERY ADDRESS</Text>
                  </View>
                  <Text style={styles.detailAddressFull}>
                    {detailsModalOrder.shippingAddress}
                  </Text>
                </View>

                {/* 5. Price Breakdown Card */}
                <View style={styles.detailSectionCard}>
                  <View style={styles.sectionHeaderRow}>
                    <Ionicons name="receipt-outline" size={17} color={MyntraColors.primary} />
                    <Text style={styles.sectionHeaderTitle}>PRICE DETAILS</Text>
                  </View>

                  <View style={styles.priceRowItem}>
                    <Text style={styles.priceRowLabel}>Total MRP</Text>
                    <Text style={styles.priceRowVal}>₹{detailsModalOrder.totalMRP}</Text>
                  </View>

                  {detailsModalOrder.discountAmount > 0 && (
                    <View style={styles.priceRowItem}>
                      <Text style={styles.priceRowLabel}>Discount on MRP</Text>
                      <Text style={styles.priceRowDiscount}>
                        -₹{detailsModalOrder.discountAmount}
                      </Text>
                    </View>
                  )}

                  {detailsModalOrder.appliedCoupon && (
                    <View style={styles.priceRowItem}>
                      <View style={styles.couponTagRow}>
                        <Text style={styles.priceRowLabel}>Coupon Applied</Text>
                        <View style={styles.appliedCouponPill}>
                          <Text style={styles.appliedCouponPillText}>
                            {detailsModalOrder.appliedCoupon}
                          </Text>
                        </View>
                      </View>
                      <Text style={styles.priceRowDiscount}>
                        -₹{detailsModalOrder.couponDiscount}
                      </Text>
                    </View>
                  )}

                  <View style={styles.priceRowItem}>
                    <Text style={styles.priceRowLabel}>Delivery Fee</Text>
                    <Text
                      style={[
                        styles.priceRowVal,
                        detailsModalOrder.deliveryFee === 0 && styles.priceRowFree,
                      ]}>
                      {detailsModalOrder.deliveryFee === 0
                        ? 'FREE'
                        : `₹${detailsModalOrder.deliveryFee}`}
                    </Text>
                  </View>

                  <View style={[styles.priceRowItem, styles.priceRowTotal]}>
                    <Text style={styles.priceTotalLabel}>Total Amount Paid</Text>
                    <Text style={styles.priceTotalVal}>₹{detailsModalOrder.totalAmount}</Text>
                  </View>
                </View>

                {/* 6. Payment Method & Status Card */}
                <View style={styles.detailSectionCard}>
                  <View style={styles.sectionHeaderRow}>
                    <Ionicons name="card-outline" size={17} color={MyntraColors.primary} />
                    <Text style={styles.sectionHeaderTitle}>PAYMENT MODE</Text>
                  </View>

                  <View style={styles.paymentInfoRow}>
                    <View style={styles.paymentMethodLeft}>
                      <Ionicons
                        name={
                          detailsModalOrder.paymentMethod.toLowerCase().includes('cash')
                            ? 'cash-outline'
                            : 'card-outline'
                        }
                        size={18}
                        color={MyntraColors.text}
                      />
                      <Text style={styles.paymentMethodTitle}>
                        {detailsModalOrder.paymentMethod}
                      </Text>
                    </View>

                    <View
                      style={[
                        styles.paymentStatusPill,
                        detailsModalOrder.paymentStatus === 'Paid'
                          ? styles.paymentStatusPillPaid
                          : detailsModalOrder.paymentStatus === 'Refunded'
                          ? styles.paymentStatusPillRefunded
                          : styles.paymentStatusPillPending,
                      ]}>
                      <Text
                        style={[
                          styles.paymentStatusPillText,
                          detailsModalOrder.paymentStatus === 'Paid'
                            ? styles.paymentStatusTextPaid
                            : detailsModalOrder.paymentStatus === 'Refunded'
                            ? styles.paymentStatusTextRefunded
                            : styles.paymentStatusTextPending,
                        ]}>
                        {detailsModalOrder.paymentStatus ||
                          (detailsModalOrder.paymentMethod.toLowerCase().includes('cash')
                            ? 'PENDING COD'
                            : 'PAID')}
                      </Text>
                    </View>
                  </View>
                </View>

                {/* 7. Action CTA Buttons in Details */}
                <View style={styles.detailsActionsSection}>
                  {isOrderActive(detailsModalOrder.status) && (
                    <TouchableOpacity
                      onPress={() => setCancelOrderTarget(detailsModalOrder)}
                      style={styles.detailsCancelOrderBtn}
                      activeOpacity={0.8}>
                      <Ionicons name="close-circle-outline" size={18} color="#dc2626" />
                      <Text style={styles.detailsCancelOrderText}>CANCEL ORDER</Text>
                    </TouchableOpacity>
                  )}

                  {isOrderDelivered(detailsModalOrder.status) && (
                    <TouchableOpacity
                      onPress={() => {
                        setReturnOrderTarget(detailsModalOrder);
                        setReturnType('return');
                      }}
                      style={styles.detailsReturnOrderBtn}
                      activeOpacity={0.8}>
                      <Ionicons name="repeat-outline" size={18} color="#fff" />
                      <Text style={styles.detailsReturnOrderText}>RETURN OR EXCHANGE</Text>
                    </TouchableOpacity>
                  )}

                  <TouchableOpacity
                    onPress={() => setDetailsModalOrder(null)}
                    style={styles.detailsBackToListBtn}
                    activeOpacity={0.8}>
                    <Ionicons name="list-outline" size={18} color={MyntraColors.text} />
                    <Text style={styles.detailsBackToListText}>BACK TO MY ORDERS</Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            </View>
          ) : (
            /* ============================================================== */
            /* SCREEN 2: MAIN ORDERS LIST VIEW                                */
            /* ============================================================== */
            <>
              {/* 1. Header Bar */}
              <View style={styles.header}>
                <View style={styles.headerLeft}>
                  <Text style={styles.headerTitle}>MY ORDERS</Text>
                  <Text style={styles.orderCount}>
                    {counts.all} {counts.all === 1 ? 'Order' : 'Orders'} Placed
                  </Text>
                </View>

                <View style={styles.headerActions}>
                  <TouchableOpacity
                    onPress={() => loadOrders(true)}
                    style={styles.headerIconBtn}
                    activeOpacity={0.7}
                    accessibilityLabel="Refresh orders">
                    <Ionicons name="refresh-outline" size={20} color={MyntraColors.text} />
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={onClose}
                    style={styles.headerIconBtn}
                    activeOpacity={0.7}
                    accessibilityLabel="Close orders">
                    <Ionicons name="close" size={22} color={MyntraColors.text} />
                  </TouchableOpacity>
                </View>
              </View>

              {/* 2. Feedback Notification Toast */}
              {feedbackMessage && (
                <View
                  style={[
                    styles.feedbackBanner,
                    feedbackMessage.isError
                      ? styles.feedbackBannerError
                      : styles.feedbackBannerSuccess,
                  ]}>
                  <Ionicons
                    name={
                      feedbackMessage.isError
                        ? 'alert-circle'
                        : 'checkmark-circle'
                    }
                    size={16}
                    color={feedbackMessage.isError ? '#b91c1c' : '#047857'}
                  />
                  <Text
                    style={[
                      styles.feedbackBannerText,
                      feedbackMessage.isError
                        ? styles.feedbackBannerTextError
                        : styles.feedbackBannerTextSuccess,
                    ]}>
                    {feedbackMessage.text}
                  </Text>
                </View>
              )}

              {/* 3. Search Bar */}
              <View style={styles.searchBarContainer}>
                <View style={styles.searchInputWrap}>
                  <Ionicons name="search-outline" size={16} color={MyntraColors.textMuted} />
                  <TextInput
                    style={styles.searchInput}
                    placeholder="Search by Order ID, Product, or Brand"
                    placeholderTextColor={MyntraColors.textMuted}
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                  />
                  {searchQuery.length > 0 && (
                    <TouchableOpacity onPress={() => setSearchQuery('')} activeOpacity={0.7}>
                      <Ionicons name="close-circle" size={16} color={MyntraColors.textMuted} />
                    </TouchableOpacity>
                  )}
                </View>
              </View>

              {/* 4. Filter Tabs Bar */}
              <View style={styles.tabsContainer}>
                {(
                  [
                    { key: 'all', label: 'All', count: counts.all },
                    { key: 'active', label: 'Active', count: counts.active },
                    { key: 'delivered', label: 'Delivered', count: counts.delivered },
                    { key: 'cancelled', label: 'Cancelled', count: counts.cancelled },
                  ] as const
                ).map((tab) => {
                  const isActive = activeTab === tab.key;
                  return (
                    <TouchableOpacity
                      key={tab.key}
                      onPress={() => setActiveTab(tab.key)}
                      style={[styles.tabBtn, isActive && styles.tabBtnActive]}
                      activeOpacity={0.8}>
                      <Text style={[styles.tabBtnText, isActive && styles.tabBtnTextActive]}>
                        {tab.label}
                      </Text>
                      {tab.count > 0 && (
                        <View
                          style={[
                            styles.tabCountBadge,
                            isActive && styles.tabCountBadgeActive,
                          ]}>
                          <Text
                            style={[
                              styles.tabCountText,
                              isActive && styles.tabCountTextActive,
                            ]}>
                            {tab.count}
                          </Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* 5. Main Content: Loading, Error, Empty, or Orders List */}
              {isLoading ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="large" color={MyntraColors.primary} />
                  <Text style={styles.loadingText}>Fetching your orders...</Text>
                </View>
              ) : loadError ? (
                <View style={styles.errorContainer}>
                  <Ionicons name="alert-circle-outline" size={44} color="#dc2626" />
                  <Text style={styles.errorTitle}>Failed to Load Orders</Text>
                  <Text style={styles.errorSub}>{loadError}</Text>
                  <TouchableOpacity
                    onPress={() => loadOrders()}
                    style={styles.retryBtn}
                    activeOpacity={0.8}>
                    <Text style={styles.retryBtnText}>RETRY</Text>
                  </TouchableOpacity>
                </View>
              ) : filteredOrders.length === 0 ? (
                <View style={styles.emptyContainer}>
                  <View style={styles.emptyIconCircle}>
                    <Ionicons name="cube-outline" size={44} color={MyntraColors.primary} />
                  </View>
                  <Text style={styles.emptyTitle}>
                    {orders.length === 0
                      ? 'NO ORDERS PLACED YET'
                      : 'NO MATCHING ORDERS FOUND'}
                  </Text>
                  <Text style={styles.emptySub}>
                    {orders.length === 0
                      ? 'Explore the latest fashion collections and trends. Place your first order with exclusive offers!'
                      : 'No orders match your selected filter or search query. Try changing the tab or clearing the search.'}
                  </Text>
                  {orders.length === 0 ? (
                    <TouchableOpacity
                      onPress={() => {
                        onClose();
                        onStartShopping();
                      }}
                      style={styles.startShoppingBtn}
                      activeOpacity={0.85}>
                      <Text style={styles.startShoppingText}>START SHOPPING</Text>
                      <Ionicons name="arrow-forward" size={15} color="#fff" style={{ marginLeft: 4 }} />
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity
                      onPress={() => {
                        setActiveTab('all');
                        setSearchQuery('');
                      }}
                      style={styles.startShoppingBtn}
                      activeOpacity={0.85}>
                      <Text style={styles.startShoppingText}>SHOW ALL ORDERS</Text>
                    </TouchableOpacity>
                  )}
                </View>
              ) : (
                <ScrollView
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={styles.scrollContent}
                  refreshControl={
                    <RefreshControl
                      refreshing={isRefreshing}
                      onRefresh={() => loadOrders(true)}
                      colors={[MyntraColors.primary]}
                    />
                  }>
                  {filteredOrders.map((order) => {
                    const isExpanded = expandedOrderId === order.id;
                    const statusBadge = getStatusBadge(order.status);
                    const orderDate = formatDate(order.date);
                    const cancellable = isOrderActive(order.status);
                    const returnable = isOrderDelivered(order.status);

                    return (
                      <View key={order.id} style={styles.orderCard}>
                        {/* Order Top Bar: ID, Date, Status */}
                        <TouchableOpacity
                          onPress={() => setDetailsModalOrder(order)}
                          style={styles.orderTopBar}
                          activeOpacity={0.85}>
                          <View style={styles.orderTopLeft}>
                            <View style={styles.orderIdBadge}>
                              <Text style={styles.orderIdText}>{order.id}</Text>
                            </View>
                            <Text style={styles.orderDateText}>Placed on {orderDate}</Text>
                          </View>

                          <View
                            style={[
                              styles.statusBadge,
                              { backgroundColor: statusBadge.bg },
                            ]}>
                            <Ionicons
                              name={statusBadge.icon}
                              size={13}
                              color={statusBadge.text}
                            />
                            <Text
                              style={[
                                styles.statusBadgeText,
                                { color: statusBadge.text },
                              ]}>
                              {statusBadge.label}
                            </Text>
                          </View>
                        </TouchableOpacity>

                        {/* Delivery Status Strip */}
                        <TouchableOpacity
                          onPress={() => setDetailsModalOrder(order)}
                          style={styles.deliveryEstimateStrip}
                          activeOpacity={0.85}>
                          <Ionicons
                            name={
                              order.status === 'Delivered'
                                ? 'checkmark-done-circle'
                                : order.status === 'Cancelled'
                                ? 'close-circle'
                                : 'time-outline'
                            }
                            size={15}
                            color={
                              order.status === 'Delivered'
                                ? MyntraColors.ratingGreen
                                : order.status === 'Cancelled'
                                ? '#dc2626'
                                : MyntraColors.primary
                            }
                          />
                          <Text style={styles.deliveryEstimateText}>
                            {order.status === 'Delivered'
                              ? `Delivered on ${order.deliveryDate}`
                              : order.status === 'Cancelled'
                              ? 'This order has been cancelled.'
                              : order.status === 'Returned'
                              ? 'Return processed. Refund issued to payment method.'
                              : `Estimated Delivery by ${order.deliveryDate}`}
                          </Text>
                        </TouchableOpacity>

                        {/* Order Items Preview - Clickable to open Order Details */}
                        <TouchableOpacity
                          onPress={() => setDetailsModalOrder(order)}
                          style={styles.itemsContainer}
                          activeOpacity={0.85}>
                          {order.items.map((item, idx) => (
                            <View key={idx} style={styles.orderItemRow}>
                              <Image
                                source={{
                                  uri:
                                    item.product?.image ||
                                    'https://images.unsplash.com/photo-1521572267360-ee0c2909d518',
                                }}
                                style={styles.orderItemImage}
                              />
                              <View style={styles.orderItemInfo}>
                                <Text style={styles.orderItemBrand}>
                                  {item.product?.brand || 'MYNTRA'}
                                </Text>
                                <Text style={styles.orderItemName} numberOfLines={1}>
                                  {item.product?.name || 'Fashion Product'}
                                </Text>
                                <View style={styles.orderItemMetaRow}>
                                  <Text style={styles.orderItemMeta}>
                                    Size: <Text style={styles.orderItemMetaBold}>{item.size}</Text>
                                  </Text>
                                  {item.color && (
                                    <Text style={styles.orderItemMeta}>
                                      {' '}• Color: <Text style={styles.orderItemMetaBold}>{item.color}</Text>
                                    </Text>
                                  )}
                                  <Text style={styles.orderItemMeta}>
                                    {' '}• Qty: <Text style={styles.orderItemMetaBold}>{item.quantity}</Text>
                                  </Text>
                                </View>
                                <Text style={styles.orderItemPrice}>
                                  ₹{(item.product?.price || 0) * item.quantity}
                                </Text>
                              </View>
                            </View>
                          ))}
                        </TouchableOpacity>

                        {/* Order Financial & Payment Row */}
                        <View style={styles.orderFinancialRow}>
                          <View>
                            <Text style={styles.financialLabel}>Total Paid</Text>
                            <Text style={styles.financialAmount}>₹{order.totalAmount}</Text>
                          </View>

                          <View style={styles.paymentMethodCol}>
                            <Text style={styles.financialLabel}>Payment Method</Text>
                            <View style={styles.paymentMethodRow}>
                              <Ionicons
                                name={
                                  order.paymentMethod.toLowerCase().includes('cash')
                                    ? 'cash-outline'
                                    : 'card-outline'
                                }
                                size={14}
                                color={MyntraColors.textSecondary}
                              />
                              <Text style={styles.paymentMethodText} numberOfLines={1}>
                                {order.paymentMethod}
                              </Text>
                            </View>
                          </View>

                          <View style={styles.paymentStatusBadge}>
                            <Text
                              style={[
                                styles.paymentStatusText,
                                order.paymentStatus === 'Paid'
                                  ? styles.paymentStatusPaid
                                  : order.paymentStatus === 'Refunded'
                                  ? styles.paymentStatusRefunded
                                  : styles.paymentStatusPending,
                              ]}>
                              {order.paymentStatus ||
                                (order.paymentMethod.toLowerCase().includes('cash')
                                  ? 'PENDING COD'
                                  : 'PAID')}
                            </Text>
                          </View>
                        </View>

                        {/* Quick Tracking Timeline Strip (if expanded inline) */}
                        {isExpanded && order.trackingSteps && order.trackingSteps.length > 0 && (
                          <View style={styles.trackingTimelineSection}>
                            <Text style={styles.timelineHeader}>SHIPMENT PROGRESS</Text>
                            <View style={styles.timelineList}>
                              {order.trackingSteps.map((step, sIdx) => {
                                const isLast = sIdx === order.trackingSteps.length - 1;
                                return (
                                  <View key={sIdx} style={styles.timelineRow}>
                                    <View style={styles.timelineLeftTrack}>
                                      <View
                                        style={[
                                          styles.timelineDot,
                                          step.completed && styles.timelineDotDone,
                                          step.active && styles.timelineDotActive,
                                        ]}>
                                        {step.completed && (
                                          <Ionicons name="checkmark" size={10} color="#fff" />
                                        )}
                                      </View>
                                      {!isLast && (
                                        <View
                                          style={[
                                            styles.timelineLine,
                                            step.completed && styles.timelineLineDone,
                                          ]}
                                        />
                                      )}
                                    </View>
                                    <View style={styles.timelineTextCol}>
                                      <Text
                                        style={[
                                          styles.timelineTitle,
                                          step.completed && styles.timelineTitleDone,
                                        ]}>
                                        {step.title}
                                      </Text>
                                      <Text style={styles.timelineDate}>{step.date}</Text>
                                    </View>
                                  </View>
                                );
                              })}
                            </View>
                          </View>
                        )}

                        {/* Action Buttons Bar */}
                        <View style={styles.cardActionsBar}>
                          {/* View Details Button */}
                          <TouchableOpacity
                            onPress={() => setDetailsModalOrder(order)}
                            style={styles.actionBtnOutline}
                            activeOpacity={0.75}>
                            <Ionicons name="receipt-outline" size={14} color={MyntraColors.text} />
                            <Text style={styles.actionBtnOutlineText}>VIEW DETAILS</Text>
                          </TouchableOpacity>

                          {/* Track Shipment Button */}
                          <TouchableOpacity
                            onPress={() => setExpandedOrderId(isExpanded ? null : order.id)}
                            style={[
                              styles.actionBtnOutline,
                              isExpanded && styles.actionBtnOutlineActive,
                            ]}
                            activeOpacity={0.75}>
                            <Ionicons
                              name="location-outline"
                              size={14}
                              color={isExpanded ? MyntraColors.primary : MyntraColors.text}
                            />
                            <Text
                              style={[
                                styles.actionBtnOutlineText,
                                isExpanded && styles.actionBtnOutlineTextActive,
                              ]}>
                              {isExpanded ? 'HIDE TRACKING' : 'TRACK ORDER'}
                            </Text>
                          </TouchableOpacity>

                          {/* Cancel Order Action */}
                          {cancellable && (
                            <TouchableOpacity
                              onPress={() => setCancelOrderTarget(order)}
                              style={styles.actionBtnDanger}
                              activeOpacity={0.75}>
                              <Text style={styles.actionBtnDangerText}>CANCEL</Text>
                            </TouchableOpacity>
                          )}

                          {/* Return / Exchange Action */}
                          {returnable && (
                            <TouchableOpacity
                              onPress={() => {
                                setReturnOrderTarget(order);
                                setReturnType('return');
                              }}
                              style={styles.actionBtnPrimary}
                              activeOpacity={0.8}>
                              <Text style={styles.actionBtnPrimaryText}>RETURN / EXCHANGE</Text>
                            </TouchableOpacity>
                          )}
                        </View>
                      </View>
                    );
                  })}
                </ScrollView>
              )}
            </>
          )}

          {/* ============================================================== */}
          {/* DIALOG 1: CANCEL ORDER REASON PICKER OVERLAY                   */}
          {/* ============================================================== */}
          {cancelOrderTarget && (
            <View style={styles.subOverlay}>
              <View style={styles.subCard}>
                <View style={styles.subHeader}>
                  <View>
                    <Text style={styles.subTitle}>Cancel Order?</Text>
                    <Text style={styles.subOrderId}>#{cancelOrderTarget.id}</Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => setCancelOrderTarget(null)}
                    style={styles.subCloseBtn}
                    activeOpacity={0.7}>
                    <Ionicons name="close" size={20} color={MyntraColors.text} />
                  </TouchableOpacity>
                </View>

                <Text style={styles.reasonPromptText}>
                  Please choose a reason for cancellation:
                </Text>

                <View style={styles.reasonsList}>
                  {CANCEL_REASONS.map((r) => {
                    const isSel = selectedCancelReason === r;
                    return (
                      <TouchableOpacity
                        key={r}
                        onPress={() => setSelectedCancelReason(r)}
                        style={[styles.reasonOptionRow, isSel && styles.reasonOptionRowSelected]}
                        activeOpacity={0.7}>
                        <Ionicons
                          name={isSel ? 'radio-button-on' : 'radio-button-off'}
                          size={17}
                          color={isSel ? MyntraColors.primary : MyntraColors.textMuted}
                        />
                        <Text
                          style={[
                            styles.reasonOptionText,
                            isSel && styles.reasonOptionTextSelected,
                          ]}>
                          {r}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <View style={styles.subActionsRow}>
                  <TouchableOpacity
                    onPress={() => setCancelOrderTarget(null)}
                    style={styles.subCancelBtn}
                    activeOpacity={0.8}>
                    <Text style={styles.subCancelBtnText}>KEEP ORDER</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={handleConfirmCancel}
                    disabled={isCancelling}
                    style={styles.subDangerBtn}
                    activeOpacity={0.8}>
                    {isCancelling ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Text style={styles.subDangerBtnText}>CONFIRM CANCELLATION</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )}

          {/* ============================================================== */}
          {/* DIALOG 2: RETURN / EXCHANGE OVERLAY                            */}
          {/* ============================================================== */}
          {returnOrderTarget && (
            <View style={styles.subOverlay}>
              <View style={styles.subCard}>
                <View style={styles.subHeader}>
                  <View>
                    <Text style={styles.subTitle}>Return / Exchange Request</Text>
                    <Text style={styles.subOrderId}>#{returnOrderTarget.id}</Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => setReturnOrderTarget(null)}
                    style={styles.subCloseBtn}
                    activeOpacity={0.7}>
                    <Ionicons name="close" size={20} color={MyntraColors.text} />
                  </TouchableOpacity>
                </View>

                {/* Return vs Exchange Toggle */}
                <View style={styles.returnTypeToggleRow}>
                  <TouchableOpacity
                    onPress={() => setReturnType('return')}
                    style={[
                      styles.returnTypeBtn,
                      returnType === 'return' && styles.returnTypeBtnActive,
                    ]}
                    activeOpacity={0.8}>
                    <Text
                      style={[
                        styles.returnTypeText,
                        returnType === 'return' && styles.returnTypeTextActive,
                      ]}>
                      RETURN & REFUND
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => setReturnType('exchange')}
                    style={[
                      styles.returnTypeBtn,
                      returnType === 'exchange' && styles.returnTypeBtnActive,
                    ]}
                    activeOpacity={0.8}>
                    <Text
                      style={[
                        styles.returnTypeText,
                        returnType === 'exchange' && styles.returnTypeTextActive,
                      ]}>
                      EXCHANGE SIZE
                    </Text>
                  </TouchableOpacity>
                </View>

                <Text style={styles.reasonPromptText}>
                  Select reason for {returnType === 'return' ? 'return' : 'exchange'}:
                </Text>

                <View style={styles.reasonsList}>
                  {RETURN_REASONS.map((r) => {
                    const isSel = selectedReturnReason === r;
                    return (
                      <TouchableOpacity
                        key={r}
                        onPress={() => setSelectedReturnReason(r)}
                        style={[styles.reasonOptionRow, isSel && styles.reasonOptionRowSelected]}
                        activeOpacity={0.7}>
                        <Ionicons
                          name={isSel ? 'radio-button-on' : 'radio-button-off'}
                          size={17}
                          color={isSel ? MyntraColors.primary : MyntraColors.textMuted}
                        />
                        <Text
                          style={[
                            styles.reasonOptionText,
                            isSel && styles.reasonOptionTextSelected,
                          ]}>
                          {r}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <View style={styles.subActionsRow}>
                  <TouchableOpacity
                    onPress={() => setReturnOrderTarget(null)}
                    style={styles.subCancelBtn}
                    activeOpacity={0.8}>
                    <Text style={styles.subCancelBtnText}>CANCEL</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={handleConfirmReturn}
                    disabled={isSubmittingReturn}
                    style={styles.subPrimaryBtn}
                    activeOpacity={0.8}>
                    {isSubmittingReturn ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Text style={styles.subPrimaryBtnText}>
                        SUBMIT {returnType.toUpperCase()}
                      </Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )}
        </View>
      </View>
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
  sheetContainer: {
    width: '100%',
    maxWidth: Platform.OS === 'web' ? 540 : undefined,
    height: Platform.OS === 'web' ? '95%' : '96%',
    backgroundColor: '#f5f5f7',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: 'hidden',
  },
  // Main List Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: 14,
    backgroundColor: MyntraColors.white,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f3',
  },
  headerLeft: {
    gap: 2,
  },
  headerTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: MyntraColors.text,
    letterSpacing: 0.8,
  },
  orderCount: {
    fontSize: 11,
    color: MyntraColors.textSecondary,
    fontWeight: '600',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  headerIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Feedback Banner
  feedbackBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  feedbackBannerSuccess: {
    backgroundColor: '#f0fdf4',
    borderBottomColor: '#bbf7d0',
  },
  feedbackBannerError: {
    backgroundColor: '#fef2f2',
    borderBottomColor: '#fecaca',
  },
  feedbackBannerText: {
    flex: 1,
    fontSize: 11.5,
    fontWeight: '600',
  },
  feedbackBannerTextSuccess: {
    color: '#047857',
  },
  feedbackBannerTextError: {
    color: '#b91c1c',
  },
  // Search Bar
  searchBarContainer: {
    backgroundColor: MyntraColors.white,
    paddingHorizontal: Spacing.md,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f3',
  },
  searchInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f7',
    borderRadius: 8,
    paddingHorizontal: 10,
    height: 38,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 12.5,
    color: MyntraColors.text,
  },
  // Filter Tabs Bar
  tabsContainer: {
    flexDirection: 'row',
    backgroundColor: MyntraColors.white,
    paddingHorizontal: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: '#eaeaee',
  },
  tabBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 11,
    marginRight: 18,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabBtnActive: {
    borderBottomColor: MyntraColors.primary,
  },
  tabBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: MyntraColors.textSecondary,
  },
  tabBtnTextActive: {
    color: MyntraColors.primary,
    fontWeight: '800',
  },
  tabCountBadge: {
    backgroundColor: '#f0f0f4',
    borderRadius: 8,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  tabCountBadgeActive: {
    backgroundColor: '#fff0f3',
  },
  tabCountText: {
    fontSize: 10,
    color: MyntraColors.textSecondary,
    fontWeight: '700',
  },
  tabCountTextActive: {
    color: MyntraColors.primary,
  },
  // Status states
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
    gap: 12,
  },
  loadingText: {
    fontSize: 12.5,
    color: MyntraColors.textSecondary,
    fontWeight: '600',
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 30,
    gap: 8,
  },
  errorTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#dc2626',
  },
  errorSub: {
    fontSize: 12,
    color: MyntraColors.textSecondary,
    textAlign: 'center',
  },
  retryBtn: {
    marginTop: 12,
    backgroundColor: MyntraColors.primary,
    paddingHorizontal: 22,
    paddingVertical: 10,
    borderRadius: 6,
  },
  retryBtnText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '800',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl,
    gap: 8,
  },
  emptyIconCircle: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: '#fff0f3',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: MyntraColors.text,
    letterSpacing: 0.6,
  },
  emptySub: {
    fontSize: 11.5,
    color: MyntraColors.textSecondary,
    textAlign: 'center',
    maxWidth: 280,
    lineHeight: 17,
  },
  startShoppingBtn: {
    marginTop: 14,
    backgroundColor: MyntraColors.primary,
    paddingHorizontal: 24,
    paddingVertical: 11,
    borderRadius: 6,
    flexDirection: 'row',
    alignItems: 'center',
  },
  startShoppingText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  scrollContent: {
    padding: Spacing.md,
    paddingBottom: 40,
    gap: 12,
  },
  // Order Card in List
  orderCard: {
    backgroundColor: MyntraColors.white,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e8e8ec',
    overflow: 'hidden',
  },
  orderTopBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f2f2f4',
  },
  orderTopLeft: {
    gap: 3,
  },
  orderIdBadge: {
    backgroundColor: '#f1f1f4',
    alignSelf: 'flex-start',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  orderIdText: {
    fontSize: 11,
    fontWeight: '800',
    color: MyntraColors.text,
  },
  orderDateText: {
    fontSize: 10.5,
    color: MyntraColors.textSecondary,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  deliveryEstimateStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#fafafc',
    borderBottomWidth: 1,
    borderBottomColor: '#f2f2f4',
  },
  deliveryEstimateText: {
    fontSize: 11,
    fontWeight: '700',
    color: MyntraColors.text,
  },
  itemsContainer: {
    padding: 12,
    gap: 10,
  },
  orderItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  orderItemImage: {
    width: 50,
    height: 64,
    borderRadius: 4,
    backgroundColor: '#f0f0f3',
  },
  orderItemInfo: {
    flex: 1,
  },
  orderItemBrand: {
    fontSize: 11.5,
    fontWeight: '800',
    color: MyntraColors.text,
  },
  orderItemName: {
    fontSize: 11,
    color: MyntraColors.textSecondary,
    marginTop: 1,
  },
  orderItemMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  orderItemMeta: {
    fontSize: 10.5,
    color: MyntraColors.textMuted,
  },
  orderItemMetaBold: {
    color: MyntraColors.text,
    fontWeight: '700',
  },
  orderItemPrice: {
    fontSize: 12,
    fontWeight: '800',
    color: MyntraColors.text,
    marginTop: 2,
  },
  orderFinancialRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#f2f2f4',
    backgroundColor: '#fafbfc',
  },
  financialLabel: {
    fontSize: 10,
    color: MyntraColors.textMuted,
    fontWeight: '600',
  },
  financialAmount: {
    fontSize: 13,
    fontWeight: '900',
    color: MyntraColors.text,
    marginTop: 1,
  },
  paymentMethodCol: {
    flex: 1,
    paddingHorizontal: 12,
  },
  paymentMethodRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 1,
  },
  paymentMethodText: {
    fontSize: 11,
    color: MyntraColors.textSecondary,
    fontWeight: '600',
  },
  paymentStatusBadge: {
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 4,
    backgroundColor: '#f1f1f4',
  },
  paymentStatusText: {
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  paymentStatusPaid: {
    color: '#047857',
  },
  paymentStatusRefunded: {
    color: '#7e22ce',
  },
  paymentStatusPending: {
    color: '#c2410c',
  },
  // Inline Tracking Accordion
  trackingTimelineSection: {
    borderTopWidth: 1,
    borderTopColor: '#f2f2f4',
    padding: 12,
    backgroundColor: '#fff',
  },
  timelineHeader: {
    fontSize: 10.5,
    fontWeight: '800',
    color: MyntraColors.textMuted,
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  timelineList: {
    paddingLeft: 4,
  },
  timelineRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  timelineLeftTrack: {
    alignItems: 'center',
    width: 20,
  },
  timelineDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: '#c0c2cc',
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  timelineDotDone: {
    borderColor: MyntraColors.ratingGreen,
    backgroundColor: MyntraColors.ratingGreen,
  },
  timelineDotActive: {
    borderColor: MyntraColors.primary,
    backgroundColor: '#fff',
  },
  timelineLine: {
    width: 2,
    height: 22,
    backgroundColor: '#e2e2e6',
    marginVertical: 2,
  },
  timelineLineDone: {
    backgroundColor: MyntraColors.ratingGreen,
  },
  timelineTextCol: {
    flex: 1,
    marginLeft: 8,
    paddingBottom: 8,
  },
  timelineTitle: {
    fontSize: 11,
    fontWeight: '600',
    color: MyntraColors.textSecondary,
  },
  timelineTitleDone: {
    fontWeight: '700',
    color: MyntraColors.text,
  },
  timelineDate: {
    fontSize: 10,
    color: MyntraColors.textMuted,
    marginTop: 1,
  },
  // Action Bar on List Item
  cardActionsBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f3',
    backgroundColor: MyntraColors.white,
  },
  actionBtnOutline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#d2d3da',
    backgroundColor: '#fff',
  },
  actionBtnOutlineActive: {
    borderColor: MyntraColors.primary,
    backgroundColor: '#fff4f6',
  },
  actionBtnOutlineText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: MyntraColors.text,
  },
  actionBtnOutlineTextActive: {
    color: MyntraColors.primary,
  },
  actionBtnDanger: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#fca5a5',
    backgroundColor: '#fff',
    marginLeft: 'auto',
  },
  actionBtnDangerText: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#dc2626',
  },
  actionBtnPrimary: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 6,
    backgroundColor: MyntraColors.primary,
    marginLeft: 'auto',
  },
  actionBtnPrimaryText: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#fff',
  },

  // ==============================================================
  // FULL ORDER DETAILS VIEW STYLING
  // ==============================================================
  detailsContainer: {
    flex: 1,
    backgroundColor: '#f5f5f7',
  },
  detailsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: MyntraColors.white,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f3',
  },
  detailsBackBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailsHeaderCenter: {
    alignItems: 'center',
  },
  detailsHeaderTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: MyntraColors.text,
    letterSpacing: 0.8,
  },
  detailsHeaderId: {
    fontSize: 11,
    fontWeight: '700',
    color: MyntraColors.textSecondary,
    marginTop: 1,
  },
  detailsScrollContent: {
    padding: 12,
    paddingBottom: 40,
    gap: 12,
  },
  detailStatusCard: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e8e8ec',
    gap: 6,
  },
  detailStatusTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  detailOrderDate: {
    fontSize: 11,
    color: MyntraColors.textMuted,
    fontWeight: '600',
  },
  detailDeliveryHeadline: {
    fontSize: 14,
    fontWeight: '800',
    color: MyntraColors.text,
  },
  detailDeliverySub: {
    fontSize: 11.5,
    color: MyntraColors.textSecondary,
    lineHeight: 16,
  },
  detailSectionCard: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e8e8ec',
    gap: 10,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f4',
    paddingBottom: 8,
  },
  sectionHeaderTitle: {
    fontSize: 11.5,
    fontWeight: '800',
    color: MyntraColors.text,
    letterSpacing: 0.5,
  },
  // Stepper in details
  stepperContainer: {
    paddingLeft: 4,
    paddingTop: 4,
  },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  stepperTrackCol: {
    alignItems: 'center',
    width: 22,
  },
  stepperDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#d1d5db',
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperDotCompleted: {
    borderColor: MyntraColors.ratingGreen,
    backgroundColor: MyntraColors.ratingGreen,
  },
  stepperDotActive: {
    borderColor: MyntraColors.primary,
    backgroundColor: '#fff',
  },
  stepperDotInnerActive: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: MyntraColors.primary,
  },
  stepperLine: {
    width: 2,
    height: 28,
    backgroundColor: '#e5e7eb',
    marginVertical: 2,
  },
  stepperLineCompleted: {
    backgroundColor: MyntraColors.ratingGreen,
  },
  stepperInfoCol: {
    flex: 1,
    marginLeft: 10,
    paddingBottom: 14,
  },
  stepperTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: MyntraColors.textSecondary,
  },
  stepperTitleCompleted: {
    fontWeight: '700',
    color: MyntraColors.text,
  },
  stepperTitleActive: {
    fontWeight: '800',
    color: MyntraColors.primary,
  },
  stepperDate: {
    fontSize: 10.5,
    color: MyntraColors.textMuted,
    marginTop: 2,
  },
  // Items in details
  detailItemsList: {
    gap: 12,
  },
  detailItemCard: {
    flexDirection: 'row',
    gap: 12,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  detailProductImage: {
    width: 60,
    height: 78,
    borderRadius: 6,
    backgroundColor: '#f0f0f3',
  },
  detailProductInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  detailProductBrand: {
    fontSize: 12,
    fontWeight: '800',
    color: MyntraColors.text,
  },
  detailProductName: {
    fontSize: 11.5,
    color: MyntraColors.textSecondary,
    marginTop: 2,
  },
  detailMetaPillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 4,
  },
  metaPill: {
    flexDirection: 'row',
    backgroundColor: '#f3f4f6',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  metaPillLabel: {
    fontSize: 10,
    color: MyntraColors.textMuted,
  },
  metaPillVal: {
    fontSize: 10,
    fontWeight: '700',
    color: MyntraColors.text,
  },
  detailPriceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  detailItemFinalPrice: {
    fontSize: 13,
    fontWeight: '900',
    color: MyntraColors.text,
  },
  detailItemOriginalPrice: {
    fontSize: 11,
    color: MyntraColors.textMuted,
    textDecorationLine: 'line-through',
  },
  // Address in details
  detailAddressFull: {
    fontSize: 12,
    color: MyntraColors.textSecondary,
    lineHeight: 18,
  },
  // Price breakdown in details
  priceRowItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 3,
  },
  priceRowLabel: {
    fontSize: 11.5,
    color: MyntraColors.textSecondary,
  },
  priceRowVal: {
    fontSize: 11.5,
    fontWeight: '600',
    color: MyntraColors.text,
  },
  priceRowFree: {
    color: MyntraColors.ratingGreen,
    fontWeight: '700',
  },
  priceRowDiscount: {
    fontSize: 11.5,
    fontWeight: '700',
    color: MyntraColors.ratingGreen,
  },
  couponTagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  appliedCouponPill: {
    backgroundColor: '#fff0f3',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  appliedCouponPillText: {
    fontSize: 9.5,
    fontWeight: '800',
    color: MyntraColors.primary,
  },
  priceRowTotal: {
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    paddingTop: 8,
    marginTop: 6,
  },
  priceTotalLabel: {
    fontSize: 12.5,
    fontWeight: '800',
    color: MyntraColors.text,
  },
  priceTotalVal: {
    fontSize: 14,
    fontWeight: '900',
    color: MyntraColors.text,
  },
  // Payment row in details
  paymentInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  paymentMethodLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  paymentMethodTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: MyntraColors.text,
  },
  paymentStatusPill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  paymentStatusPillPaid: {
    backgroundColor: '#ecfdf5',
  },
  paymentStatusPillRefunded: {
    backgroundColor: '#faf5ff',
  },
  paymentStatusPillPending: {
    backgroundColor: '#fff7ed',
  },
  paymentStatusPillText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  paymentStatusTextPaid: {
    color: '#047857',
  },
  paymentStatusTextRefunded: {
    color: '#7e22ce',
  },
  paymentStatusTextPending: {
    color: '#c2410c',
  },
  // Bottom actions in details
  detailsActionsSection: {
    gap: 10,
    marginTop: 6,
  },
  detailsCancelOrderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#fff',
    borderWidth: 1.5,
    borderColor: '#fca5a5',
    paddingVertical: 12,
    borderRadius: 8,
  },
  detailsCancelOrderText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#dc2626',
    letterSpacing: 0.5,
  },
  detailsReturnOrderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: MyntraColors.primary,
    paddingVertical: 12,
    borderRadius: 8,
  },
  detailsReturnOrderText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: 0.5,
  },
  detailsBackToListBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#d2d3da',
    paddingVertical: 11,
    borderRadius: 8,
  },
  detailsBackToListText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: MyntraColors.text,
  },

  // ==============================================================
  // OVERLAY DIALOGS (Cancel & Return)
  // ==============================================================
  subOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
    zIndex: 999,
  },
  subCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 8,
  },
  subHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f3',
    paddingBottom: 10,
  },
  subTitle: {
    fontSize: 14.5,
    fontWeight: '800',
    color: MyntraColors.text,
  },
  subOrderId: {
    fontSize: 11,
    color: MyntraColors.textSecondary,
    fontWeight: '600',
    marginTop: 2,
  },
  subCloseBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reasonPromptText: {
    fontSize: 11.5,
    color: MyntraColors.textSecondary,
    marginBottom: 8,
  },
  reasonsList: {
    gap: 6,
    marginBottom: 14,
  },
  reasonOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 9,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#fff',
  },
  reasonOptionRowSelected: {
    borderColor: MyntraColors.primary,
    backgroundColor: '#fff4f6',
  },
  reasonOptionText: {
    fontSize: 11.5,
    color: MyntraColors.text,
    flex: 1,
  },
  reasonOptionTextSelected: {
    fontWeight: '700',
    color: MyntraColors.text,
  },
  subActionsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  subCancelBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#d1d5db',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  subCancelBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: MyntraColors.text,
  },
  subDangerBtn: {
    flex: 1.4,
    paddingVertical: 10,
    borderRadius: 6,
    backgroundColor: '#dc2626',
    alignItems: 'center',
    justifyContent: 'center',
  },
  subDangerBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: 0.4,
  },
  subPrimaryBtn: {
    flex: 1.4,
    paddingVertical: 10,
    borderRadius: 6,
    backgroundColor: MyntraColors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  subPrimaryBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: 0.4,
  },
  returnTypeToggleRow: {
    flexDirection: 'row',
    backgroundColor: '#f3f4f6',
    borderRadius: 6,
    padding: 3,
    marginBottom: 10,
  },
  returnTypeBtn: {
    flex: 1,
    paddingVertical: 7,
    alignItems: 'center',
    borderRadius: 4,
  },
  returnTypeBtnActive: {
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  returnTypeText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: MyntraColors.textSecondary,
  },
  returnTypeTextActive: {
    color: MyntraColors.primary,
    fontWeight: '800',
  },
});
