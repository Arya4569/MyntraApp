import { Ionicons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import React, { useCallback, useEffect, useState } from 'react';
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

import { Spacing } from '@/constants/myntra-theme';
import { useTheme } from '@/context/ThemeContext';
import { ThemeTokens } from '@/constants/theme';
import { storeService } from '@/services/store-service';
import {
  Order,
  OrderFilterOptions,
  OrderPaginationMeta,
  ReorderSummary,
} from '@/types/store';

export type OrderFilterTab = 'all' | 'active' | 'delivered' | 'cancelled';
export type OrderDateRange = 'all' | 'last30days' | 'last6months' | 'thisyear';
export type OrderSortBy = 'date_desc' | 'date_asc' | 'amount_desc' | 'amount_asc';

export interface OrdersModalProps {
  visible: boolean;
  onClose: () => void;
  onStartShopping: () => void;
  onViewBag?: () => void;
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
  onViewBag,
  userId,
  initialOrderId,
}) => {
  // Orders & Pagination State
  const [orders, setOrders] = useState<Order[]>([]);
  const [pagination, setPagination] = useState<OrderPaginationMeta>({
    page: 1,
    limit: 8,
    total: 0,
    totalPages: 1,
    hasMore: false,
  });
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isLoadingMore, setIsLoadingMore] = useState<boolean>(false);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Filters, Sort & Search State
  const [activeTab, setActiveTab] = useState<OrderFilterTab>('all');
  const [dateRange, setDateRange] = useState<OrderDateRange>('all');
  const [sortBy, setSortBy] = useState<OrderSortBy>('date_desc');
  const [paymentMethod, setPaymentMethod] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showFiltersBar, setShowFiltersBar] = useState(false);
  const { colors, isDark } = useTheme();
  const styles = React.useMemo(() => createStyles(colors, isDark), [colors, isDark]);

  // Selected Order for expanded details / tracking
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
  const [detailsModalOrder, setDetailsModalOrder] = useState<Order | null>(null);

  // Reorder State
  const [isReorderingId, setIsReorderingId] = useState<string | null>(null);
  const [reorderFeedback, setReorderFeedback] = useState<ReorderSummary | null>(null);

  // Invoice State
  const [isDownloadingInvoiceId, setIsDownloadingInvoiceId] = useState<string | null>(null);
  const [invoiceDownloadProgress, setInvoiceDownloadProgress] = useState<{ [orderId: string]: number }>({});
  const [isRetryingPaymentId, setIsRetryingPaymentId] = useState<string | null>(null);

  // Cancel order modal
  const [cancelOrderTarget, setCancelOrderTarget] = useState<Order | null>(null);
  const [selectedCancelReason, setSelectedCancelReason] = useState(CANCEL_REASONS[0]);
  const [isCancelling, setIsCancelling] = useState(false);

  // Return / Exchange modal
  const [returnOrderTarget, setReturnOrderTarget] = useState<Order | null>(null);
  const [returnType, setReturnType] = useState<'return' | 'exchange'>('return');
  const [selectedReturnReason, setSelectedReturnReason] = useState(RETURN_REASONS[0]);
  const [exchangeSize, setExchangeSize] = useState<string>('L');
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
    }, 4500);
  }, []);

  // Fetch orders from backend with server-side pagination, sorting & filters
  const fetchOrders = useCallback(
    async (
      pageToLoad = 1,
      isPullRefresh = false,
      tab = activeTab,
      range = dateRange,
      sort = sortBy,
      query = searchQuery,
      pm = paymentMethod
    ) => {
      if (pageToLoad === 1) {
        if (isPullRefresh) {
          setIsRefreshing(true);
        } else {
          setIsLoading(true);
        }
      } else {
        setIsLoadingMore(true);
      }
      setLoadError(null);

      try {
        const filterOptions: OrderFilterOptions = {
          page: pageToLoad,
          limit: 8,
          status: tab,
          paymentMethod: pm !== 'all' ? pm : undefined,
          sortBy: sort,
          dateRange: range,
          search: query.trim() || undefined,
        };

        const res = await storeService.getOrderHistory(filterOptions);
        if (pageToLoad === 1) {
          setOrders(res.orders);
        } else {
          setOrders((prev) => {
            const existingIds = new Set(prev.map((o) => o.id));
            const newUnique = res.orders.filter((o) => !existingIds.has(o.id));
            return [...prev, ...newUnique];
          });
        }
        setPagination(res.pagination);

        if (isPullRefresh) {
          showFeedback('Orders updated successfully');
        }
      } catch (err: any) {
        setLoadError(err?.message || 'Unable to load orders. Please try again.');
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
        setIsLoadingMore(false);
      }
    },
    [activeTab, dateRange, paymentMethod, sortBy, searchQuery, showFeedback]
  );

  // Reset modal state when visible changes
  const [prevVisible, setPrevVisible] = useState(visible);
  if (visible !== prevVisible) {
    setPrevVisible(visible);
    if (!visible) {
      setDetailsModalOrder(null);
      setExpandedOrderId(null);
      setCancelOrderTarget(null);
      setReturnOrderTarget(null);
      setReorderFeedback(null);
      setSearchQuery('');
    }
  }

  // Reload when visible or when filters/sorting/search change
  useEffect(() => {
    if (visible) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      fetchOrders(1, false, activeTab, dateRange, sortBy, searchQuery, paymentMethod);
    }
  }, [visible, activeTab, dateRange, paymentMethod, sortBy, searchQuery, fetchOrders]);

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

  // Load next page
  const handleLoadMore = () => {
    if (!isLoadingMore && pagination.hasMore) {
      fetchOrders(pagination.page + 1, false, activeTab, dateRange, sortBy, searchQuery);
    }
  };

  // Helper status checkers
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

  const getPaymentBadgeDetails = (paymentStatus?: string, paymentMethod = '') => {
    const isCod = paymentMethod.toLowerCase().includes('cash');
    switch (paymentStatus) {
      case 'Paid':
        return {
          bg: '#ecfdf5',
          text: '#047857',
          border: '#a7f3d0',
          label: 'PAID',
          icon: 'checkmark-circle' as const,
        };
      case 'Failed':
        return {
          bg: '#fef2f2',
          text: '#dc2626',
          border: '#fecaca',
          label: 'PAYMENT FAILED',
          icon: 'alert-circle' as const,
        };
      case 'Cancelled':
        return {
          bg: '#f3f4f6',
          text: '#4b5563',
          border: '#e5e7eb',
          label: 'PAYMENT CANCELLED',
          icon: 'close-circle' as const,
        };
      case 'Refund Pending':
        return {
          bg: '#eff6ff',
          text: '#1d4ed8',
          border: '#bfdbfe',
          label: 'REFUND PENDING',
          icon: 'time-outline' as const,
        };
      case 'Refunded':
        return {
          bg: '#faf5ff',
          text: '#7e22ce',
          border: '#e9d5ff',
          label: 'REFUNDED',
          icon: 'repeat-outline' as const,
        };
      case 'Pending':
      default:
        return {
          bg: '#fffbeb',
          text: '#b45309',
          border: '#fde68a',
          label: isCod ? 'PENDING COD' : 'PAYMENT PENDING',
          icon: 'hourglass-outline' as const,
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

  // Reorder execution
  const handleReorder = async (order: Order) => {
    setIsReorderingId(order.id);
    setReorderFeedback(null);
    try {
      const res = await storeService.reorder(order.id);
      if (res.success && res.summary) {
        setReorderFeedback(res.summary);
        if (res.summary.addedCount > 0) {
          showFeedback(`✓ ${res.summary.addedCount} item(s) added to your shopping bag.`);
        } else {
          showFeedback('None of the items from this order are currently available in stock.', true);
        }
      } else {
        showFeedback(res.error || 'Unable to reorder items at this moment.', true);
      }
    } catch {
      showFeedback('Network error while processing reorder request.', true);
    } finally {
      setIsReorderingId(null);
    }
  };

  // Invoice Download / View execution with real file download, progress & sharing
  const handleDownloadInvoice = async (order: Order) => {
    setIsDownloadingInvoiceId(order.id);
    setInvoiceDownloadProgress((prev) => ({ ...prev, [order.id]: 0 }));
    showFeedback(`Preparing tax invoice for Order #${order.id}...`);

    try {
      const res = await storeService.downloadInvoicePdf(order.id, (progress) => {
        setInvoiceDownloadProgress((prev) => ({ ...prev, [order.id]: progress }));
      });

      if (res.success) {
        showFeedback(
          Platform.OS === 'web'
            ? `✓ Tax invoice for Order #${order.id} downloaded.`
            : `✓ Tax invoice for Order #${order.id} saved & ready to share/print.`
        );
      } else {
        showFeedback(res.error || 'Failed to download invoice. Please try again.', true);
      }
    } catch (err: any) {
      showFeedback(err?.message || 'Failed to download invoice. Please try again.', true);
    } finally {
      setIsDownloadingInvoiceId(null);
      setInvoiceDownloadProgress((prev) => {
        const next = { ...prev };
        delete next[order.id];
        return next;
      });
    }
  };

  // Safe payment retry flow for Pending / Failed online orders
  const handleRetryPayment = async (order: Order) => {
    setIsRetryingPaymentId(order.id);
    showFeedback(`Initializing secure payment retry for Order #${order.id}...`);

    try {
      const rzpOrder = await storeService.createRazorpayOrder(
        order.totalAmount,
        undefined,
        order.id
      );

      if (!rzpOrder.success || !rzpOrder.orderId) {
        throw new Error(rzpOrder.error || 'Failed to initialize payment retry session.');
      }

      const isLiveKey = Boolean(
        rzpOrder.isLive &&
        rzpOrder.keyId &&
        !rzpOrder.keyId.includes('placeholder')
      );

      if (!isLiveKey) {
        showFeedback('Live Razorpay credentials (RAZORPAY_KEY_ID & SECRET) are not yet configured in server/.env.', true);
        return;
      }

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

        const loaded = await loadScript();
        if (loaded && (window as any).Razorpay) {
          const options = {
            key: rzpOrder.keyId,
            amount: rzpOrder.amount,
            currency: rzpOrder.currency || 'INR',
            name: 'Myntra Fashion',
            description: `Payment Retry for Order #${order.id}`,
            image: 'https://assets.myntassets.com/assets/images/retaillabs/2023/2/28/a9cd936f-5b65-4f47-8a61-9c8dfb5a6c4b1677567702582-Myntra-logo.png',
            order_id: rzpOrder.orderId,
            handler: async function (response: any) {
              try {
                const verifyRes = await storeService.verifyRazorpayPayment(
                  response.razorpay_order_id || rzpOrder.orderId,
                  response.razorpay_payment_id,
                  response.razorpay_signature,
                  order.id,
                  order.totalAmount
                );
                if (verifyRes.verified || verifyRes.success) {
                  showFeedback(`✓ Payment successful for Order #${order.id}!`);
                  fetchOrders(pagination.page, false);
                  if (detailsModalOrder?.id === order.id) {
                    const fresh = await storeService.getOrderById(order.id);
                    if (fresh) setDetailsModalOrder(fresh);
                  }
                } else {
                  await storeService.reportPaymentFailure(order.id, 'Signature mismatch');
                  showFeedback('Payment verification failed. Order marked as Failed.', true);
                }
              } catch (e: any) {
                showFeedback(e?.message || 'Verification failed.', true);
              }
            },
            modal: {
              ondismiss: async () => {
                await storeService.reportPaymentCancellation(order.id);
                showFeedback('Payment retry was cancelled.');
              },
            },
          };
          const rzp = new (window as any).Razorpay(options);
          rzp.open();
          return;
        }
      }

      // Native Mobile / Expo WebBrowser checkout session
      const checkoutUrl = storeService.getPaymentCheckoutUrl(order.id);
      await WebBrowser.openBrowserAsync(checkoutUrl);
      const freshOrder = await storeService.getOrderById(order.id);
      if (freshOrder?.paymentStatus === 'Paid') {
        showFeedback(`✓ Payment successfully verified for Order #${order.id}!`);
      } else {
        showFeedback(`Order #${order.id} payment status: ${freshOrder?.paymentStatus || 'Pending'}.`);
      }
      fetchOrders(pagination.page, false);
      if (detailsModalOrder?.id === order.id && freshOrder) {
        setDetailsModalOrder(freshOrder);
      }
    } catch (err: any) {
      showFeedback(err?.message || 'Failed to retry payment.', true);
    } finally {
      setIsRetryingPaymentId(null);
    }
  };

  // Cancel order execution
  const handleConfirmCancel = async () => {
    if (!cancelOrderTarget) return;
    setIsCancelling(true);
    try {
      const res = await storeService.cancelOrder(
        cancelOrderTarget.id,
        selectedCancelReason
      );

      if (res.success && res.order) {
        showFeedback(`Order #${cancelOrderTarget.id} was cancelled successfully.`);
        setOrders((prev) =>
          prev.map((o) => (o.id === cancelOrderTarget.id ? res.order! : o))
        );
        if (detailsModalOrder && detailsModalOrder.id === cancelOrderTarget.id) {
          setDetailsModalOrder(res.order);
        }
        setCancelOrderTarget(null);
      } else {
        showFeedback(
          res.error || 'Unable to cancel this order. Only un-delivered orders can be cancelled.',
          true
        );
      }
    } catch {
      showFeedback('Cancellation request failed. Please check network and retry.', true);
    } finally {
      setIsCancelling(false);
    }
  };

  // Return / Exchange execution
  const handleConfirmReturn = async () => {
    if (!returnOrderTarget) return;
    setIsSubmittingReturn(true);
    try {
      const res = await storeService.returnOrder(
        returnOrderTarget.id,
        returnType,
        selectedReturnReason,
        returnType === 'exchange' ? exchangeSize : undefined
      );

      if (res.success && res.order) {
        const actionLabel = returnType === 'exchange' ? 'Exchange request' : 'Return';
        showFeedback(
          `${actionLabel} for #${returnOrderTarget.id} initiated. Courier pickup scheduled in 1-2 business days.`
        );
        setOrders((prev) =>
          prev.map((o) => (o.id === returnOrderTarget.id ? res.order! : o))
        );
        if (detailsModalOrder && detailsModalOrder.id === returnOrderTarget.id) {
          setDetailsModalOrder(res.order);
        }
        setReturnOrderTarget(null);
      } else {
        showFeedback(
          res.error || 'Return request could not be processed. Orders must be Delivered and within 14 days.',
          true
        );
      }
    } catch {
      showFeedback('Return submission failed. Please try again.', true);
    } finally {
      setIsSubmittingReturn(false);
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
                  <Ionicons name="arrow-back" size={22} color={colors.text} />
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
                  <Ionicons name="close" size={22} color={colors.text} />
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
                          ? 'Return processed. Refund issued to payment mode.'
                          : `Arriving by ${detailsModalOrder.deliveryDate}`}
                      </Text>
                      <Text style={styles.detailDeliverySub}>
                        {detailsModalOrder.status === 'Delivered'
                          ? 'Thank you for shopping with Myntra! 14-day easy return or exchange eligible.'
                          : detailsModalOrder.status === 'Cancelled'
                          ? detailsModalOrder.cancelReason
                            ? `Reason: ${detailsModalOrder.cancelReason}. Safe refund initiated.`
                            : 'Order cancelled. Refund initiated to original payment mode.'
                          : detailsModalOrder.status === 'Returned'
                          ? 'Pickup will be completed by courier partner. Inspection & refund processed.'
                          : 'Your package is safely packed and dispatched. Live tracking below.'}
                      </Text>

                      {/* Invoice Quick CTA in Details */}
                      <View style={styles.invoiceCtaRow}>
                        <TouchableOpacity
                          onPress={() => handleDownloadInvoice(detailsModalOrder)}
                          disabled={isDownloadingInvoiceId === detailsModalOrder.id}
                          style={styles.invoiceBtnTop}
                          activeOpacity={0.8}>
                          {isDownloadingInvoiceId === detailsModalOrder.id ? (
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                              <ActivityIndicator size="small" color={colors.primary} />
                              <Text style={styles.invoiceBtnTopText}>
                                {invoiceDownloadProgress[detailsModalOrder.id] !== undefined
                                  ? `DOWNLOADING (${invoiceDownloadProgress[detailsModalOrder.id]}%)...`
                                  : 'GENERATING PDF...'}
                              </Text>
                            </View>
                          ) : (
                            <>
                              <Ionicons name="document-text-outline" size={15} color={colors.primary} />
                              <Text style={styles.invoiceBtnTopText}>DOWNLOAD TAX INVOICE (PDF)</Text>
                            </>
                          )}
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                })()}

                {/* 2. Shipment Tracking Stepper */}
                {detailsModalOrder.trackingSteps && detailsModalOrder.trackingSteps.length > 0 && (
                  <View style={styles.detailSectionCard}>
                    <View style={styles.sectionHeaderRow}>
                      <Ionicons name="git-commit-outline" size={17} color={colors.primary} />
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

                {/* 3. Items Ordered Card with Persisted Snapshots */}
                <View style={styles.detailSectionCard}>
                  <View style={styles.sectionHeaderRow}>
                    <Ionicons name="bag-check-outline" size={17} color={colors.primary} />
                    <Text style={styles.sectionHeaderTitle}>
                      ITEMS ORDERED ({detailsModalOrder.items.length})
                    </Text>
                  </View>

                  <View style={styles.detailItemsList}>
                    {detailsModalOrder.items.map((item, idx) => {
                      const prod = item.product || {};
                      const itemPrice = prod.price || item.product?.price || 0;
                      const origPrice = prod.originalPrice || item.product?.originalPrice || itemPrice;
                      const sellerName = (prod as any).seller?.name || `${prod.brand || 'Retail'} Authorized Partner`;

                      return (
                        <View key={idx} style={styles.detailItemCard}>
                          <Image
                            source={{
                              uri:
                                prod.image ||
                                'https://images.unsplash.com/photo-1521572267360-ee0c2909d518',
                            }}
                            style={styles.detailProductImage}
                          />
                          <View style={styles.detailProductInfo}>
                            <Text style={styles.detailProductBrand}>
                              {prod.brand || 'MYNTRA'}
                            </Text>
                            <Text style={styles.detailProductName} numberOfLines={2}>
                              {prod.name || 'Fashion Apparel'}
                            </Text>
                            <Text style={styles.detailSellerText}>
                              Sold by: <Text style={styles.detailSellerBold}>{sellerName}</Text>
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
                                ₹{itemPrice * item.quantity}
                              </Text>
                              {origPrice > itemPrice && (
                                <Text style={styles.detailItemOriginalPrice}>
                                  ₹{origPrice * item.quantity}
                                </Text>
                              )}
                            </View>
                          </View>
                        </View>
                      );
                    })}
                  </View>
                </View>

                {/* 4. Delivery Address */}
                <View style={styles.detailSectionCard}>
                  <View style={styles.sectionHeaderRow}>
                    <Ionicons name="location-outline" size={17} color={colors.primary} />
                    <Text style={styles.sectionHeaderTitle}>DELIVERY ADDRESS</Text>
                  </View>
                  <Text style={styles.detailAddressFull}>
                    {detailsModalOrder.shippingAddress}
                  </Text>
                </View>

                {/* 5. Price Breakdown Card */}
                <View style={styles.detailSectionCard}>
                  <View style={styles.sectionHeaderRow}>
                    <Ionicons name="receipt-outline" size={17} color={colors.primary} />
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

                  <Text style={styles.taxInclusiveNote}>
                    * All prices are inclusive of Goods and Services Taxes (GST).
                  </Text>
                </View>

                {/* 6. Payment Method & Status Card */}
                <View style={styles.detailSectionCard}>
                  <View style={styles.sectionHeaderRow}>
                    <Ionicons name="card-outline" size={17} color={colors.primary} />
                    <Text style={styles.sectionHeaderTitle}>PAYMENT MODE & STATUS</Text>
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
                        color={colors.text}
                      />
                      <Text style={styles.paymentMethodTitle}>
                        {detailsModalOrder.paymentMethod}
                      </Text>
                    </View>

                    {(() => {
                      const pBadge = getPaymentBadgeDetails(
                        detailsModalOrder.paymentStatus,
                        detailsModalOrder.paymentMethod
                      );
                      return (
                        <View
                          style={[
                            styles.paymentStatusPill,
                            {
                              backgroundColor: pBadge.bg,
                              borderColor: pBadge.border,
                              borderWidth: 1,
                            },
                          ]}>
                          <Ionicons
                            name={pBadge.icon}
                            size={13}
                            color={pBadge.text}
                            style={{ marginRight: 4 }}
                          />
                          <Text
                            style={[
                              styles.paymentStatusPillText,
                              { color: pBadge.text },
                            ]}>
                            {pBadge.label}
                          </Text>
                        </View>
                      );
                    })()}
                  </View>

                  {/* Retry Payment Button in Payment Card */}
                  {detailsModalOrder.paymentStatus !== 'Paid' &&
                    detailsModalOrder.paymentStatus !== 'Refunded' &&
                    !detailsModalOrder.paymentMethod.toLowerCase().includes('cash') &&
                    detailsModalOrder.status !== 'Cancelled' && (
                      <TouchableOpacity
                        onPress={() => handleRetryPayment(detailsModalOrder)}
                        disabled={isRetryingPaymentId === detailsModalOrder.id}
                        style={{
                          marginTop: 12,
                          backgroundColor: colors.primary,
                          flexDirection: 'row',
                          alignItems: 'center',
                          justifyContent: 'center',
                          paddingVertical: 10,
                          borderRadius: 6,
                          gap: 6,
                        }}
                        activeOpacity={0.85}>
                        {isRetryingPaymentId === detailsModalOrder.id ? (
                          <ActivityIndicator size="small" color="#fff" />
                        ) : (
                          <>
                            <Ionicons name="card" size={16} color="#fff" />
                            <Text
                              style={{
                                color: '#fff',
                                fontSize: 12,
                                fontWeight: '800',
                                letterSpacing: 0.5,
                              }}>
                              RETRY ONLINE PAYMENT
                            </Text>
                          </>
                        )}
                      </TouchableOpacity>
                    )}
                </View>

                {/* 7. Action CTA Buttons in Details */}
                <View style={styles.detailsActionsSection}>
                  {/* Reorder Button */}
                  <TouchableOpacity
                    onPress={() => handleReorder(detailsModalOrder)}
                    disabled={isReorderingId === detailsModalOrder.id}
                    style={styles.detailsReorderBtn}
                    activeOpacity={0.8}>
                    {isReorderingId === detailsModalOrder.id ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <>
                        <Ionicons name="reload-outline" size={18} color="#fff" />
                        <Text style={styles.detailsReorderText}>REORDER ITEMS</Text>
                      </>
                    )}
                  </TouchableOpacity>

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
                    <Ionicons name="list-outline" size={18} color={colors.text} />
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
                    {pagination.total} {pagination.total === 1 ? 'Order' : 'Orders'} Found
                  </Text>
                </View>

                <View style={styles.headerActions}>
                  <TouchableOpacity
                    onPress={() => setShowFiltersBar(!showFiltersBar)}
                    style={[
                      styles.headerIconBtn,
                      showFiltersBar && styles.headerIconBtnActive,
                    ]}
                    activeOpacity={0.7}
                    accessibilityLabel="Toggle filters">
                    <Ionicons
                      name="options-outline"
                      size={20}
                      color={showFiltersBar ? colors.primary : colors.text}
                    />
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => fetchOrders(1, true)}
                    style={styles.headerIconBtn}
                    activeOpacity={0.7}
                    accessibilityLabel="Refresh orders">
                    <Ionicons name="refresh-outline" size={20} color={colors.text} />
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={onClose}
                    style={styles.headerIconBtn}
                    activeOpacity={0.7}
                    accessibilityLabel="Close orders">
                    <Ionicons name="close" size={22} color={colors.text} />
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

              {/* 3. Reorder Result Banner (with View Bag CTA) */}
              {reorderFeedback && (
                <View style={styles.reorderResultBanner}>
                  <View style={styles.reorderResultLeft}>
                    <Ionicons name="bag-check" size={20} color="#047857" />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.reorderResultTitle}>
                        {reorderFeedback.addedCount} item(s) added to your Bag!
                      </Text>
                      {reorderFeedback.unavailableCount > 0 && (
                        <Text style={styles.reorderResultSub}>
                          {reorderFeedback.unavailableCount} item(s) were out of stock and omitted.
                        </Text>
                      )}
                      {reorderFeedback.priceChangedCount > 0 && (
                        <Text style={styles.reorderResultSub}>
                          Current prices updated for {reorderFeedback.priceChangedCount} item(s).
                        </Text>
                      )}
                    </View>
                  </View>
                  {onViewBag && (
                    <TouchableOpacity
                      onPress={() => {
                        onClose();
                        onViewBag();
                      }}
                      style={styles.viewBagBtn}
                      activeOpacity={0.8}>
                      <Text style={styles.viewBagBtnText}>GO TO BAG</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}

              {/* 4. Search Bar */}
              <View style={styles.searchBarContainer}>
                <View style={styles.searchInputWrap}>
                  <Ionicons name="search-outline" size={16} color={colors.textMuted} />
                  <TextInput
                    style={styles.searchInput}
                    placeholder="Search by Order ID, Product, or Brand"
                    placeholderTextColor={colors.textMuted}
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                  />
                  {searchQuery.length > 0 && (
                    <TouchableOpacity onPress={() => setSearchQuery('')} activeOpacity={0.7}>
                      <Ionicons name="close-circle" size={16} color={colors.textMuted} />
                    </TouchableOpacity>
                  )}
                </View>
              </View>

              {/* 5. Filter Tabs Bar */}
              <View style={styles.tabsContainer}>
                {(
                  [
                    { key: 'all', label: 'All' },
                    { key: 'active', label: 'Active' },
                    { key: 'delivered', label: 'Delivered' },
                    { key: 'cancelled', label: 'Cancelled' },
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
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* 6. Sorting & Date Range Filter Strip (Collapsible) */}
              {showFiltersBar && (
                <View style={styles.extraFiltersStrip}>
                  {/* Date Range Chips */}
                  <View style={styles.filterGroup}>
                    <Text style={styles.filterGroupLabel}>TIME PERIOD:</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsScroll}>
                      {(
                        [
                          { key: 'all', label: 'All Time' },
                          { key: 'last30days', label: 'Last 30 Days' },
                          { key: 'last6months', label: 'Last 6 Months' },
                          { key: 'thisyear', label: 'This Year' },
                        ] as const
                      ).map((item) => (
                        <TouchableOpacity
                          key={item.key}
                          onPress={() => setDateRange(item.key)}
                          style={[styles.chip, dateRange === item.key && styles.chipActive]}
                          activeOpacity={0.7}>
                          <Text style={[styles.chipText, dateRange === item.key && styles.chipTextActive]}>
                            {item.label}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>

                  {/* Payment Method Filter Chips */}
                  <View style={styles.filterGroup}>
                    <Text style={styles.filterGroupLabel}>PAYMENT METHOD:</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsScroll}>
                      {(
                        [
                          { key: 'all', label: 'All Methods' },
                          { key: 'upi', label: 'UPI' },
                          { key: 'card', label: 'Cards' },
                          { key: 'netbanking', label: 'Net Banking' },
                          { key: 'cod', label: 'Cash on Delivery' },
                        ] as const
                      ).map((item) => (
                        <TouchableOpacity
                          key={item.key}
                          onPress={() => setPaymentMethod(item.key)}
                          style={[styles.chip, paymentMethod === item.key && styles.chipActive]}
                          activeOpacity={0.7}>
                          <Text style={[styles.chipText, paymentMethod === item.key && styles.chipTextActive]}>
                            {item.label}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>

                  {/* Sorting Chips */}
                  <View style={styles.filterGroup}>
                    <Text style={styles.filterGroupLabel}>SORT BY:</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsScroll}>
                      {(
                        [
                          { key: 'date_desc', label: 'Newest First' },
                          { key: 'date_asc', label: 'Oldest First' },
                          { key: 'amount_desc', label: 'Price: High to Low' },
                          { key: 'amount_asc', label: 'Price: Low to High' },
                        ] as const
                      ).map((item) => (
                        <TouchableOpacity
                          key={item.key}
                          onPress={() => setSortBy(item.key)}
                          style={[styles.chip, sortBy === item.key && styles.chipActive]}
                          activeOpacity={0.7}>
                          <Text style={[styles.chipText, sortBy === item.key && styles.chipTextActive]}>
                            {item.label}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>
                </View>
              )}

              {/* 7. Main Content: Loading, Error, Empty, or Orders List */}
              {isLoading ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="large" color={colors.primary} />
                  <Text style={styles.loadingText}>Fetching orders from server...</Text>
                </View>
              ) : loadError ? (
                <View style={styles.errorContainer}>
                  <Ionicons name="alert-circle-outline" size={44} color="#dc2626" />
                  <Text style={styles.errorTitle}>Failed to Load Orders</Text>
                  <Text style={styles.errorSub}>{loadError}</Text>
                  <TouchableOpacity
                    onPress={() => fetchOrders(1)}
                    style={styles.retryBtn}
                    activeOpacity={0.8}>
                    <Text style={styles.retryBtnText}>RETRY</Text>
                  </TouchableOpacity>
                </View>
              ) : orders.length === 0 ? (
                <View style={styles.emptyContainer}>
                  <View style={styles.emptyIconCircle}>
                    <Ionicons name="cube-outline" size={44} color={colors.primary} />
                  </View>
                  <Text style={styles.emptyTitle}>
                    {activeTab === 'all' && !searchQuery
                      ? 'NO ORDERS PLACED YET'
                      : 'NO MATCHING ORDERS FOUND'}
                  </Text>
                  <Text style={styles.emptySub}>
                    {activeTab === 'all' && !searchQuery
                      ? 'Explore the latest fashion collections and trends. Place your first order with exclusive offers!'
                      : 'No orders match your selected filter or search query. Try changing filters or clearing search.'}
                  </Text>
                  {activeTab === 'all' && !searchQuery ? (
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
                        setDateRange('all');
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
                      onRefresh={() => fetchOrders(1, true)}
                      colors={[colors.primary]}
                    />
                  }>
                  {orders.map((order) => {
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
                                ? colors.ratingGreen
                                : order.status === 'Cancelled'
                                ? '#dc2626'
                                : colors.primary
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
                          {order.items.map((item, idx) => {
                            const prod = item.product || {};
                            const unitPrice = prod.price || (item as any).unitPrice || 0;
                            return (
                              <View key={idx} style={styles.orderItemRow}>
                                <Image
                                  source={{
                                    uri:
                                      prod.image ||
                                      'https://images.unsplash.com/photo-1521572267360-ee0c2909d518',
                                  }}
                                  style={styles.orderItemImage}
                                />
                                <View style={styles.orderItemInfo}>
                                  <Text style={styles.orderItemBrand}>
                                    {prod.brand || 'MYNTRA'}
                                  </Text>
                                  <Text style={styles.orderItemName} numberOfLines={1}>
                                    {prod.name || 'Fashion Product'}
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
                                    ₹{unitPrice * item.quantity}
                                  </Text>
                                </View>
                              </View>
                            );
                          })}
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
                                color={colors.textSecondary}
                              />
                              <Text style={styles.paymentMethodText} numberOfLines={1}>
                                {order.paymentMethod}
                              </Text>
                            </View>
                          </View>

                          {(() => {
                            const pBadge = getPaymentBadgeDetails(
                              order.paymentStatus,
                              order.paymentMethod
                            );
                            return (
                              <View
                                style={[
                                  styles.paymentStatusBadge,
                                  {
                                    backgroundColor: pBadge.bg,
                                    borderColor: pBadge.border,
                                    borderWidth: 1,
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                  },
                                ]}>
                                <Ionicons
                                  name={pBadge.icon}
                                  size={11}
                                  color={pBadge.text}
                                  style={{ marginRight: 3 }}
                                />
                                <Text
                                  style={[
                                    styles.paymentStatusText,
                                    { color: pBadge.text, fontWeight: '700' },
                                  ]}>
                                  {pBadge.label}
                                </Text>
                              </View>
                            );
                          })()}
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
                          {/* Pay Now Button (Only for Pending / Failed online orders) */}
                          {order.paymentStatus !== 'Paid' &&
                            order.paymentStatus !== 'Refunded' &&
                            !order.paymentMethod.toLowerCase().includes('cash') &&
                            order.status !== 'Cancelled' && (
                              <TouchableOpacity
                                onPress={() => handleRetryPayment(order)}
                                disabled={isRetryingPaymentId === order.id}
                                style={[
                                  styles.actionBtnOutline,
                                  { backgroundColor: colors.primaryLight, borderColor: colors.primary },
                                ]}
                                activeOpacity={0.75}>
                                {isRetryingPaymentId === order.id ? (
                                  <ActivityIndicator size="small" color={colors.primary} />
                                ) : (
                                  <>
                                    <Ionicons name="card" size={12} color={colors.primary} />
                                    <Text
                                      style={[
                                        styles.actionBtnOutlineText,
                                        { color: colors.primary, fontWeight: '800' },
                                      ]}>
                                      PAY NOW
                                    </Text>
                                  </>
                                )}
                              </TouchableOpacity>
                            )}

                          {/* View Details */}
                          <TouchableOpacity
                            onPress={() => setDetailsModalOrder(order)}
                            style={styles.actionBtnOutline}
                            activeOpacity={0.75}>
                            <Ionicons name="receipt-outline" size={13} color={colors.text} />
                            <Text style={styles.actionBtnOutlineText}>DETAILS</Text>
                          </TouchableOpacity>

                          {/* Invoice PDF Button */}
                          <TouchableOpacity
                            onPress={() => handleDownloadInvoice(order)}
                            disabled={isDownloadingInvoiceId === order.id}
                            style={styles.actionBtnOutline}
                            activeOpacity={0.75}>
                            {isDownloadingInvoiceId === order.id ? (
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                <ActivityIndicator size="small" color={colors.primary} />
                                <Text
                                  style={[
                                    styles.actionBtnOutlineText,
                                    { color: colors.primary, fontSize: 10 },
                                  ]}>
                                  {invoiceDownloadProgress[order.id] !== undefined
                                    ? `${invoiceDownloadProgress[order.id]}%`
                                    : 'PDF'}
                                </Text>
                              </View>
                            ) : (
                              <>
                                <Ionicons name="document-outline" size={13} color={colors.primary} />
                                <Text style={[styles.actionBtnOutlineText, { color: colors.primary }]}>
                                  INVOICE
                                </Text>
                              </>
                            )}
                          </TouchableOpacity>

                          {/* Reorder Button */}
                          <TouchableOpacity
                            onPress={() => handleReorder(order)}
                            disabled={isReorderingId === order.id}
                            style={styles.actionBtnReorder}
                            activeOpacity={0.75}>
                            {isReorderingId === order.id ? (
                              <ActivityIndicator size="small" color="#fff" />
                            ) : (
                              <>
                                <Ionicons name="reload-outline" size={12} color="#fff" />
                                <Text style={styles.actionBtnReorderText}>REORDER</Text>
                              </>
                            )}
                          </TouchableOpacity>

                          {/* Track Order Toggle */}
                          <TouchableOpacity
                            onPress={() => setExpandedOrderId(isExpanded ? null : order.id)}
                            style={[
                              styles.actionBtnOutline,
                              isExpanded && styles.actionBtnOutlineActive,
                            ]}
                            activeOpacity={0.75}>
                            <Ionicons
                              name="location-outline"
                              size={13}
                              color={isExpanded ? colors.primary : colors.text}
                            />
                            <Text
                              style={[
                                styles.actionBtnOutlineText,
                                isExpanded && styles.actionBtnOutlineTextActive,
                              ]}>
                              {isExpanded ? 'HIDE' : 'TRACK'}
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
                              <Text style={styles.actionBtnPrimaryText}>RETURN</Text>
                            </TouchableOpacity>
                          )}
                        </View>
                      </View>
                    );
                  })}

                  {/* Server-Side Pagination: Load More */}
                  {pagination.hasMore && (
                    <View style={styles.paginationSection}>
                      <TouchableOpacity
                        onPress={handleLoadMore}
                        disabled={isLoadingMore}
                        style={styles.loadMoreBtn}
                        activeOpacity={0.8}>
                        {isLoadingMore ? (
                          <ActivityIndicator size="small" color={colors.primary} />
                        ) : (
                          <>
                            <Text style={styles.loadMoreText}>LOAD MORE ORDERS</Text>
                            <Ionicons name="chevron-down" size={16} color={colors.primary} />
                          </>
                        )}
                      </TouchableOpacity>
                      <Text style={styles.paginationSummary}>
                        Showing {orders.length} of {pagination.total} orders
                      </Text>
                    </View>
                  )}
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
                    <Ionicons name="close" size={20} color={colors.text} />
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
                          color={isSel ? colors.primary : colors.textMuted}
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
                    <Ionicons name="close" size={20} color={colors.text} />
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

                {returnType === 'exchange' && (
                  <View style={styles.exchangeSizeContainer}>
                    <Text style={styles.exchangeSizeLabel}>Select Replacement Size:</Text>
                    <View style={styles.exchangeSizeRow}>
                      {['S', 'M', 'L', 'XL', 'XXL'].map((sz) => (
                        <TouchableOpacity
                          key={sz}
                          onPress={() => setExchangeSize(sz)}
                          style={[
                            styles.exchangeSizeChip,
                            exchangeSize === sz && styles.exchangeSizeChipActive,
                          ]}>
                          <Text
                            style={[
                              styles.exchangeSizeChipText,
                              exchangeSize === sz && styles.exchangeSizeChipTextActive,
                            ]}>
                            {sz}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                )}

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
                          color={isSel ? colors.primary : colors.textMuted}
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

const createStyles = (colors: ThemeTokens, isDark: boolean) => StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  sheetContainer: {
    width: '100%',
    maxWidth: Platform.OS === 'web' ? 580 : undefined,
    height: Platform.OS === 'web' ? '95%' : '96%',
    backgroundColor: colors.background,
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
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerLeft: {
    gap: 2,
  },
  headerTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: 0.8,
  },
  orderCount: {
    fontSize: 11,
    color: colors.textSecondary,
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
  headerIconBtnActive: {
    backgroundColor: colors.primaryLight,
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
    backgroundColor: isDark ? '#064e3b' : '#f0fdf4',
    borderBottomColor: '#bbf7d0',
  },
  feedbackBannerError: {
    backgroundColor: isDark ? '#450a0a' : '#fef2f2',
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
  // Reorder Result Banner
  reorderResultBanner: {
    backgroundColor: isDark ? '#064e3b' : '#ecfdf5',
    borderBottomWidth: 1,
    borderBottomColor: '#a7f3d0',
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  reorderResultLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  reorderResultTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#065f46',
  },
  reorderResultSub: {
    fontSize: 10.5,
    color: '#047857',
    marginTop: 2,
  },
  viewBagBtn: {
    backgroundColor: '#047857',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 6,
  },
  viewBagBtnText: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: 0.5,
  },
  // Search Bar
  searchBarContainer: {
    backgroundColor: colors.surface,
    paddingHorizontal: Spacing.md,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  searchInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    borderRadius: 8,
    paddingHorizontal: 10,
    height: 38,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 12.5,
    color: colors.text,
  },
  // Filter Tabs Bar
  tabsContainer: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    paddingHorizontal: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  tabBtn: {
    paddingVertical: 11,
    marginRight: 20,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabBtnActive: {
    borderBottomColor: colors.primary,
  },
  tabBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  tabBtnTextActive: {
    color: colors.primary,
    fontWeight: '800',
  },
  // Extra Filters (Collapsible)
  extraFiltersStrip: {
    backgroundColor: colors.surface,
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#e8e8ec',
    gap: 8,
  },
  filterGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  filterGroupLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.textMuted,
    width: 80,
  },
  chipsScroll: {
    gap: 6,
    paddingRight: 10,
  },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 14,
    backgroundColor: '#f2f2f5',
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActive: {
    backgroundColor: colors.primaryLight,
    borderColor: colors.primary,
  },
  chipText: {
    fontSize: 10.5,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  chipTextActive: {
    color: colors.primary,
    fontWeight: '800',
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
    color: colors.textSecondary,
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
    color: colors.textSecondary,
    textAlign: 'center',
  },
  retryBtn: {
    marginTop: 12,
    backgroundColor: colors.primary,
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
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: 0.6,
  },
  emptySub: {
    fontSize: 11.5,
    color: colors.textSecondary,
    textAlign: 'center',
    maxWidth: 280,
    lineHeight: 17,
  },
  startShoppingBtn: {
    marginTop: 14,
    backgroundColor: colors.primary,
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
    backgroundColor: colors.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
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
    color: colors.text,
  },
  orderDateText: {
    fontSize: 10.5,
    color: colors.textSecondary,
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
    color: colors.text,
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
    backgroundColor: colors.backgroundElement,
  },
  orderItemInfo: {
    flex: 1,
  },
  orderItemBrand: {
    fontSize: 11.5,
    fontWeight: '800',
    color: colors.text,
  },
  orderItemName: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 1,
  },
  orderItemMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  orderItemMeta: {
    fontSize: 10.5,
    color: colors.textMuted,
  },
  orderItemMetaBold: {
    color: colors.text,
    fontWeight: '700',
  },
  orderItemPrice: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.text,
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
    color: colors.textMuted,
    fontWeight: '600',
  },
  financialAmount: {
    fontSize: 13,
    fontWeight: '900',
    color: colors.text,
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
    color: colors.textSecondary,
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
    backgroundColor: colors.surface,
  },
  timelineHeader: {
    fontSize: 10.5,
    fontWeight: '800',
    color: colors.textMuted,
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
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timelineDotDone: {
    borderColor: colors.ratingGreen,
    backgroundColor: colors.ratingGreen,
  },
  timelineDotActive: {
    borderColor: colors.primary,
    backgroundColor: colors.surface,
  },
  timelineLine: {
    width: 2,
    height: 22,
    backgroundColor: '#e2e2e6',
    marginVertical: 2,
  },
  timelineLineDone: {
    backgroundColor: colors.ratingGreen,
  },
  timelineTextCol: {
    flex: 1,
    marginLeft: 8,
    paddingBottom: 8,
  },
  timelineTitle: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  timelineTitleDone: {
    fontWeight: '700',
    color: colors.text,
  },
  timelineDate: {
    fontSize: 10,
    color: colors.textMuted,
    marginTop: 1,
  },
  // Action Bar on List Item
  cardActionsBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    padding: 10,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f3',
    backgroundColor: colors.surface,
    flexWrap: 'wrap',
  },
  actionBtnOutline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#d2d3da',
    backgroundColor: colors.surface,
  },
  actionBtnOutlineActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  actionBtnOutlineText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.text,
  },
  actionBtnOutlineTextActive: {
    color: colors.primary,
  },
  actionBtnReorder: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#0f766e',
  },
  actionBtnReorderText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: 0.4,
  },
  actionBtnDanger: {
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#fca5a5',
    backgroundColor: colors.surface,
    marginLeft: 'auto',
  },
  actionBtnDangerText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#dc2626',
  },
  actionBtnPrimary: {
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: colors.primary,
    marginLeft: 'auto',
  },
  actionBtnPrimaryText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#fff',
  },
  // Pagination
  paginationSection: {
    alignItems: 'center',
    paddingVertical: 14,
    gap: 8,
  },
  loadMoreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  loadMoreText: {
    fontSize: 11.5,
    fontWeight: '800',
    color: colors.primary,
    letterSpacing: 0.5,
  },
  paginationSummary: {
    fontSize: 11,
    color: colors.textMuted,
    fontWeight: '600',
  },

  // ==============================================================
  // FULL ORDER DETAILS VIEW STYLING
  // ==============================================================
  detailsContainer: {
    flex: 1,
    backgroundColor: colors.background,
  },
  detailsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
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
    color: colors.text,
    letterSpacing: 0.8,
  },
  detailsHeaderId: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textSecondary,
    marginTop: 1,
  },
  detailsScrollContent: {
    padding: 12,
    paddingBottom: 40,
    gap: 12,
  },
  detailStatusCard: {
    backgroundColor: colors.surface,
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
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
    color: colors.textMuted,
    fontWeight: '600',
  },
  detailDeliveryHeadline: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.text,
  },
  detailDeliverySub: {
    fontSize: 11.5,
    color: colors.textSecondary,
    lineHeight: 16,
  },
  invoiceCtaRow: {
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#f2f2f4',
    paddingTop: 8,
  },
  invoiceBtnTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.primaryLight,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  invoiceBtnTopText: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.primary,
    letterSpacing: 0.5,
  },
  detailSectionCard: {
    backgroundColor: colors.surface,
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 10,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingBottom: 8,
  },
  sectionHeaderTitle: {
    fontSize: 11.5,
    fontWeight: '800',
    color: colors.text,
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
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperDotCompleted: {
    borderColor: colors.ratingGreen,
    backgroundColor: colors.ratingGreen,
  },
  stepperDotActive: {
    borderColor: colors.primary,
    backgroundColor: colors.surface,
  },
  stepperDotInnerActive: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
  },
  stepperLine: {
    width: 2,
    height: 28,
    backgroundColor: '#e5e7eb',
    marginVertical: 2,
  },
  stepperLineCompleted: {
    backgroundColor: colors.ratingGreen,
  },
  stepperInfoCol: {
    flex: 1,
    marginLeft: 10,
    paddingBottom: 14,
  },
  stepperTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  stepperTitleCompleted: {
    fontWeight: '700',
    color: colors.text,
  },
  stepperTitleActive: {
    fontWeight: '800',
    color: colors.primary,
  },
  stepperDate: {
    fontSize: 10.5,
    color: colors.textMuted,
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
    backgroundColor: colors.backgroundElement,
  },
  detailProductInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  detailProductBrand: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.text,
  },
  detailProductName: {
    fontSize: 11.5,
    color: colors.textSecondary,
    marginTop: 2,
  },
  detailSellerText: {
    fontSize: 10.5,
    color: colors.textMuted,
    marginTop: 2,
  },
  detailSellerBold: {
    color: colors.textSecondary,
    fontWeight: '700',
  },
  detailMetaPillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 4,
  },
  metaPill: {
    flexDirection: 'row',
    backgroundColor: colors.backgroundElement,
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  metaPillLabel: {
    fontSize: 10,
    color: colors.textMuted,
  },
  metaPillVal: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.text,
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
    color: colors.text,
  },
  detailItemOriginalPrice: {
    fontSize: 11,
    color: colors.textMuted,
    textDecorationLine: 'line-through',
  },
  // Address in details
  detailAddressFull: {
    fontSize: 12,
    color: colors.textSecondary,
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
    color: colors.textSecondary,
  },
  priceRowVal: {
    fontSize: 11.5,
    fontWeight: '600',
    color: colors.text,
  },
  priceRowFree: {
    color: colors.ratingGreen,
    fontWeight: '700',
  },
  priceRowDiscount: {
    fontSize: 11.5,
    fontWeight: '700',
    color: colors.ratingGreen,
  },
  couponTagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  appliedCouponPill: {
    backgroundColor: colors.primaryLight,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  appliedCouponPillText: {
    fontSize: 9.5,
    fontWeight: '800',
    color: colors.primary,
  },
  priceRowTotal: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 8,
    marginTop: 6,
  },
  priceTotalLabel: {
    fontSize: 12.5,
    fontWeight: '800',
    color: colors.text,
  },
  priceTotalVal: {
    fontSize: 14,
    fontWeight: '900',
    color: colors.text,
  },
  taxInclusiveNote: {
    fontSize: 10,
    color: colors.textMuted,
    fontStyle: 'italic',
    marginTop: 6,
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
    color: colors.text,
  },
  paymentStatusPill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  paymentStatusPillPaid: {
    backgroundColor: isDark ? '#064e3b' : '#ecfdf5',
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
  detailsReorderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#0f766e',
    paddingVertical: 12,
    borderRadius: 8,
  },
  detailsReorderText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: 0.5,
  },
  detailsCancelOrderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: colors.surface,
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
    backgroundColor: colors.primary,
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
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: '#d2d3da',
    paddingVertical: 11,
    borderRadius: 8,
  },
  detailsBackToListText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: colors.text,
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
    backgroundColor: colors.surface,
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
    borderBottomColor: colors.border,
    paddingBottom: 10,
  },
  subTitle: {
    fontSize: 14.5,
    fontWeight: '800',
    color: colors.text,
  },
  subOrderId: {
    fontSize: 11,
    color: colors.textSecondary,
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
    color: colors.textSecondary,
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
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  reasonOptionRowSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  reasonOptionText: {
    fontSize: 11.5,
    color: colors.text,
    flex: 1,
  },
  reasonOptionTextSelected: {
    fontWeight: '700',
    color: colors.text,
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
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  subCancelBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.text,
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
    backgroundColor: colors.primary,
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
    backgroundColor: colors.backgroundElement,
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
    backgroundColor: colors.surface,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  returnTypeText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  returnTypeTextActive: {
    color: colors.primary,
    fontWeight: '800',
  },
  exchangeSizeContainer: {
    marginBottom: 10,
    backgroundColor: '#f9f9fa',
    padding: 10,
    borderRadius: 8,
  },
  exchangeSizeLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 6,
  },
  exchangeSizeRow: {
    flexDirection: 'row',
    gap: 8,
  },
  exchangeSizeChip: {
    width: 38,
    height: 34,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  exchangeSizeChipActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  exchangeSizeChipText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  exchangeSizeChipTextActive: {
    color: colors.primary,
    fontWeight: '800',
  },
});
