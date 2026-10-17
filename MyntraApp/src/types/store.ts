import { Product } from '@/data/mock-data';

export interface CartItem {
  id: string;
  productId: string;
  product: Product;
  size: string;
  color?: string;
  quantity: number;
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

export interface Order {
  id: string;
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
  paymentStatus?: 'Paid' | 'Pending' | 'Refunded';
  trackingSteps: OrderTrackingStep[];
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

