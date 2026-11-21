import { Product } from '@/data/mock-data';

export interface CartItem {
  id: string;
  productId: string;
  product: Product;
  size: string;
  color?: string;
  quantity: number;
  savedPrice?: number;
  savedAt?: string;
  addedAt?: string;
  unitPrice?: number;
  originalUnitPrice?: number;
  subtotal?: number;
  itemMRP?: number;
  isAvailable?: boolean;
  isOutOfStock?: boolean;
  isDiscontinued?: boolean;
  availableStock?: number;
  maxQuantity?: number;
  quantityExceedsStock?: boolean;
  variantAvailable?: boolean;
  priceChanged?: boolean;
  priceDiff?: number;
}

export interface BagTotals {
  count: number;
  lineItemsCount: number;
  totalMRP: number;
  subtotal: number;
  discountAmount: number;
  deliveryFee: number;
  finalTotal: number;
  hasOutOfStockItems?: boolean;
  hasPriceChanges?: boolean;
  stockWarnings?: string[];
  savedForLaterCount?: number;
}

export interface CartValidationIssue {
  type: 'OUT_OF_STOCK' | 'STOCK_EXCEEDED' | 'PRICE_CHANGED' | 'VARIANT_UNAVAILABLE' | 'DISCONTINUED';
  itemId?: string;
  productId?: string;
  productName?: string;
  oldPrice?: number;
  currentPrice?: number;
  availableStock?: number;
  requestedQuantity?: number;
  size?: string;
  message: string;
}

export interface CartValidationResult {
  valid: boolean;
  hasPriceChanges: boolean;
  issues: CartValidationIssue[];
  bag?: any;
}

export interface Coupon {
  code: string;
  title: string;
  description: string;
  discountType: 'flat' | 'percentage';
  discountValue: number;
  minOrder: number;
  expiryDate?: string;
}

export interface OrderTrackingStep {
  title: string;
  date: string;
  completed: boolean;
  active: boolean;
}

export interface OrderReturnRequest {
  actionType: 'return' | 'exchange';
  reason: string;
  exchangeSize?: string | null;
  requestedAt: string;
  status: string;
}

export interface OrderAuditEntry {
  id: string;
  orderId?: string;
  eventType: string;
  actor: {
    type: string;
    userId?: string | null;
  };
  details: Record<string, any>;
  timestamp: string;
}

export interface Order {
  id: string;
  invoiceNumber?: string;
  userId?: string;
  date: string;
  items: CartItem[];
  totalMRP: number;
  totalAmount: number;
  discountAmount: number;
  couponDiscount: number;
  appliedCoupon?: string;
  deliveryFee: number;
  status:
    | 'Placed'
    | 'Confirmed'
    | 'Shipped'
    | 'Out for Delivery'
    | 'Delivered'
    | 'Cancelled'
    | 'Returned';
  deliveryDate: string;
  shippingAddress: string;
  paymentMethod: string;
  paymentStatus?: 'Paid' | 'Pending' | 'Refunded' | 'Refund Pending' | 'Failed' | 'Cancelled';
  trackingSteps: OrderTrackingStep[];
  cancelReason?: string;
  cancelledAt?: string;
  returnRequest?: OrderReturnRequest;
  auditTrail?: OrderAuditEntry[];
  createdAt?: string;
  updatedAt?: string;
}

export interface ReorderUnavailableItem {
  productId?: string;
  name: string;
  reason: string;
}

export interface ReorderPriceChange {
  productId?: string;
  name: string;
  oldPrice: number;
  currentPrice: number;
}

export interface ReorderSummary {
  addedCount: number;
  unavailableCount: number;
  priceChangedCount: number;
  addedItems: {
    productId: string;
    name: string;
    brand?: string;
    size: string;
    quantity: number;
    price: number;
  }[];
  unavailableItems: ReorderUnavailableItem[];
  priceChanges: ReorderPriceChange[];
}

export interface OrderPaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasMore: boolean;
}

export interface OrderHistoryResult {
  orders: Order[];
  pagination: OrderPaginationMeta;
  filters?: {
    status?: string;
    sortBy?: string;
    search?: string;
    dateRange?: string | null;
  };
}

export interface OrderFilterOptions {
  page?: number;
  limit?: number;
  status?: string;
  paymentMethod?: string;
  sortBy?: 'date_desc' | 'date_asc' | 'amount_desc' | 'amount_asc';
  search?: string;
  dateRange?: 'all' | 'last30days' | 'last6months' | 'thisyear';
  startDate?: string;
  endDate?: string;
}

export interface DeliveryAddress {
  id: string;
  name: string;
  mobile: string;
  pincode: string;
  address: string;
  locality?: string;
  city: string;
  state: string;
  addressType: 'Home' | 'Work';
  isDefault: boolean;
}

export type SortOption =
  | 'recommended'
  | 'price_low_high'
  | 'price_high_low'
  | 'rating'
  | 'newest';

export interface FilterState {
  category?: string;
  subcategory?: string;
  brands: string[];
  priceRange?: [number, number];
  minDiscount?: number;
  minRating?: number;
  sizes: string[];
  colors: string[];
  sortBy: SortOption;
}

export interface BankOffer {
  id: string;
  bank: string;
  code: string;
  title: string;
  description: string;
  minSpend: string;
  validTill: string;
  icon: string;
  color: string;
}

export interface InsiderPerk {
  id: string;
  icon: string;
  title: string;
  description: string;
  status: 'ACTIVE' | 'CLAIMABLE';
}

export interface InsiderInfo {
  superCoins: number;
  tier: string;
  tierSubtitle: string;
  pointsRule: string;
  perks: InsiderPerk[];
}

export type NotificationCategory =
  | 'order'
  | 'payment'
  | 'shipping'
  | 'wishlist'
  | 'stock'
  | 'promotion'
  | 'cart';

export interface AppNotification {
  id: string;
  userId?: string;
  title: string;
  message: string;
  category: NotificationCategory;
  data?: {
    orderId?: string;
    productId?: string;
    paymentId?: string;
    couponCode?: string;
    screen?: 'orders' | 'product' | 'bag' | 'offers' | 'wishlist';
    [key: string]: any;
  };
  read: boolean;
  createdAt: string;
  readAt?: string | null;
}

export interface NotificationPreferences {
  pushNotificationsEnabled?: boolean;
  devicePushEnabled?: boolean;
  orderUpdates: boolean;
  paymentUpdates: boolean;
  wishlistPriceDrops: boolean;
  stockAlerts: boolean;
  promotions: boolean;
  cartReminders: boolean;
  updatedAt?: string;
}

export interface RecommendationProduct extends Product {
  recommendationReason?: string;
  recommendationScore?: number;
}

export interface RecommendationResult {
  success: boolean;
  isPersonalized: boolean;
  type: 'personalized' | 'trending' | 'empty';
  title: string;
  subtitle: string;
  total: number;
  count: number;
  products: RecommendationProduct[];
  signalsUsed: {
    browsingHistoryCount: number;
    wishlistCount: number;
    orderCount: number;
    cartCount: number;
    topCategories: string[];
  };
}
