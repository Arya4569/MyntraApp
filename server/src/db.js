const fs = require('fs');
const path = require('path');
const os = require('os');
const bcrypt = require('bcryptjs');

const DATA_DIR = path.join(__dirname, '..', 'data');
const CATALOG_FILE = path.join(DATA_DIR, 'catalog.json');
const SEED_DB_FILE = path.join(DATA_DIR, 'db.json');

// On serverless environments (e.g. Vercel, AWS Lambda), write to writable /tmp
const isServerless = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
const DB_FILE = isServerless ? path.join(os.tmpdir(), 'myntra_db.json') : SEED_DB_FILE;

// Ensure data directory exists if running locally
if (!isServerless && !fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const loadCatalogData = () => {
  try {
    if (fs.existsSync(CATALOG_FILE)) {
      const raw = fs.readFileSync(CATALOG_FILE, 'utf-8');
      return JSON.parse(raw);
    }
  } catch (e) {
    console.warn('Failed to read catalog.json:', e);
  }
  return {
    categories: [],
    products: [],
    promoBanners: [],
    curatedCollections: [],
    topBrands: [],
    coupons: [],
    bankOffers: [],
    insiderData: {},
    subcategories: {},
    categoryBanners: {},
    popularCategories: [],
    trendingSearches: [],
  };
};

const getInitialData = () => {
  const salt = bcrypt.genSaltSync(10);
  const passwordHash = bcrypt.hashSync('Password123!', salt);

  const catalog = loadCatalogData();

  const formattedProducts = (catalog.products || []).map((p) => ({
    ...p,
    categoryId: (p.category || 'all').toLowerCase(),
    inStock: p.inStock !== false,
    stockCount: p.stockCount || 45,
  }));

  return {
    users: [
      {
        id: 'usr-demo-1',
        fullName: 'Aryak Sharma',
        name: 'Aryak Sharma',
        email: 'aryak@fashion.dev',
        mobileNumber: '9876543210',
        mobile: '9876543210',
        passwordHash,
        gender: 'Men',
        role: 'customer',
        status: 'active',
        insiderPoints: 240,
        profileImage: null,
        createdAt: '2025-08-15T10:00:00.000Z',
        updatedAt: '2025-08-15T10:00:00.000Z',
      },
    ],
    categories: catalog.categories || [],
    products: formattedProducts,
    promoBanners: catalog.promoBanners || [],
    curatedCollections: catalog.curatedCollections || [],
    topBrands: catalog.topBrands || [],
    coupons: catalog.coupons || [],
    bankOffers: catalog.bankOffers || [],
    insiderData: catalog.insiderData || {},
    subcategories: catalog.subcategories || {},
    categoryBanners: catalog.categoryBanners || {},
    popularCategories: catalog.popularCategories || [],
    trendingSearches: catalog.trendingSearches || [],
    wishlists: {
      'usr-demo-1': ['prod-1', 'prod-3'],
    },
    bags: {
      'usr-demo-1': [
        {
          id: 'item-demo-1',
          productId: 'prod-1',
          size: 'M',
          color: 'Olive Green',
          quantity: 1,
        },
      ],
    },
    savedForLater: {
      'usr-demo-1': [],
    },
    recentlyViewed: {
      'usr-demo-1': ['prod-1', 'prod-2'],
    },
    addresses: {
      'usr-demo-1': [
        {
          id: 'addr-demo-1',
          userId: 'usr-demo-1',
          name: 'Aryak Sharma',
          mobile: '9876543210',
          pincode: '400001',
          address: 'Flat 402, Sea Green Apartments, Nariman Point',
          locality: 'Opposite Express Towers',
          city: 'Mumbai',
          state: 'Maharashtra',
          addressType: 'Home',
          isDefault: true,
          createdAt: '2025-08-15T10:00:00.000Z',
          updatedAt: '2025-08-15T10:00:00.000Z',
        },
      ],
    },
    notifications: [
      {
        id: 'notif-seed-1',
        userId: 'usr-demo-1',
        title: 'Order Confirmed! 🎉',
        message: 'Your order #MYN-582910 of ₹1,499 has been placed successfully and is being packed.',
        category: 'order',
        data: { orderId: 'MYN-582910', screen: 'orders' },
        read: false,
        createdAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
        readAt: null,
      },
      {
        id: 'notif-seed-2',
        userId: 'usr-demo-1',
        title: 'Price Drop Alert! 🏷️',
        message: 'Roadster Casual Shirt from your Wishlist is now 55% OFF at ₹499!',
        category: 'wishlist',
        data: { productId: 'prod-1', screen: 'product' },
        read: false,
        createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
        readAt: null,
      },
      {
        id: 'notif-seed-3',
        userId: 'usr-demo-1',
        title: 'Out for Delivery 🚚',
        message: 'Your order #MYN-582910 is out for delivery with courier partner Ekart.',
        category: 'shipping',
        data: { orderId: 'MYN-582910', screen: 'orders' },
        read: true,
        createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
        readAt: new Date(Date.now() - 22 * 60 * 60 * 1000).toISOString(),
      },
      {
        id: 'notif-seed-4',
        userId: 'usr-demo-1',
        title: 'Exclusive VIP Offer ✦',
        message: 'Myntra Insider perk unlocked: Use code INSIDER20 for an extra 20% discount!',
        category: 'promotion',
        data: { couponCode: 'INSIDER20', screen: 'offers' },
        read: true,
        createdAt: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(),
        readAt: new Date(Date.now() - 40 * 60 * 1000).toISOString(),
      },
    ],
    deviceTokens: [],
    notificationPreferences: {
      'usr-demo-1': {
        orderUpdates: true,
        paymentUpdates: true,
        wishlistPriceDrops: true,
        stockAlerts: true,
        promotions: true,
        cartReminders: true,
        updatedAt: '2026-08-15T10:00:00.000Z',
      },
    },
    notificationLogs: [],
    orders: [
      {
        id: 'MYN-582910',
        userId: 'usr-demo-1',
        date: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
        items: [
          {
            id: 'ord-item-1',
            product: {
              id: 'prod-1',
              name: 'Roadster Casual Cotton Shirt',
              brand: 'Roadster',
              price: 499,
              originalPrice: 1199,
              discountPercent: 58,
              image: 'https://images.unsplash.com/photo-1596755094514-f87e34085b2c?w=600&auto=format&fit=crop&q=80',
              category: 'Men',
              rating: 4.3,
              reviewCount: 1250,
              inStock: true,
            },
            size: 'M',
            color: 'Olive Green',
            quantity: 1,
          },
        ],
        totalMRP: 1199,
        totalAmount: 499,
        discountAmount: 700,
        couponDiscount: 0,
        deliveryFee: 0,
        status: 'Confirmed',
        deliveryDate: 'Expected Tomorrow',
        shippingAddress: 'Flat 402, Sea Green Apartments, Nariman Point, Mumbai - 400001',
        paymentMethod: 'UPI / Razorpay',
        paymentStatus: 'Paid',
        trackingSteps: [
          { title: 'Order Confirmed', date: 'Yesterday', completed: true, active: false },
          { title: 'Shipped from Warehouse', date: 'Yesterday', completed: true, active: false },
          { title: 'Out for Delivery', date: 'Today', completed: true, active: true },
          { title: 'Delivered', date: 'Expected Tomorrow', completed: false, active: false },
        ],
      },
    ],
    auditLogs: [],
    processedPaymentEvents: [],
  };
};

class Database {
  constructor() {
    this.init();
  }

  init() {
    if (!fs.existsSync(DB_FILE)) {
      if (isServerless && fs.existsSync(SEED_DB_FILE)) {
        try {
          fs.copyFileSync(SEED_DB_FILE, DB_FILE);
          return;
        } catch (e) {
          console.warn('Could not copy seed database to tmp:', e);
        }
      }
      const initialData = getInitialData();
      fs.writeFileSync(DB_FILE, JSON.stringify(initialData, null, 2), 'utf-8');
      return;
    }

    // Ensure existing db.json has categories, products, wishlists, and bags
    try {
      const current = JSON.parse(fs.readFileSync(DB_FILE, 'utf-8'));
      let needsSave = false;
      const catalog = loadCatalogData();

      if (!current.categories || current.categories.length === 0) {
        current.categories = catalog.categories || [];
        needsSave = true;
      }
      if (!current.products || current.products.length === 0) {
        current.products = (catalog.products || []).map((p) => ({
          ...p,
          categoryId: (p.category || 'all').toLowerCase(),
          inStock: p.inStock !== false,
          stockCount: p.stockCount || 45,
        }));
        needsSave = true;
      }
      if (!current.promoBanners) {
        current.promoBanners = catalog.promoBanners || [];
        needsSave = true;
      }
      if (!current.curatedCollections) {
        current.curatedCollections = catalog.curatedCollections || [];
        needsSave = true;
      }
      if (!current.topBrands) {
        current.topBrands = catalog.topBrands || [];
        needsSave = true;
      }
      if (!current.coupons) {
        current.coupons = catalog.coupons || [];
        needsSave = true;
      }
      if (!current.bankOffers || current.bankOffers.length === 0) {
        current.bankOffers = catalog.bankOffers || [];
        needsSave = true;
      }
      if (!current.insiderData || !current.insiderData.perks) {
        current.insiderData = catalog.insiderData || {};
        needsSave = true;
      }
      if (!current.subcategories) {
        current.subcategories = catalog.subcategories || {};
        needsSave = true;
      }
      if (!current.categoryBanners) {
        current.categoryBanners = catalog.categoryBanners || {};
        needsSave = true;
      }
      if (!current.popularCategories || current.popularCategories.length === 0) {
        current.popularCategories = catalog.popularCategories || [];
        needsSave = true;
      }
      if (!current.trendingSearches || current.trendingSearches.length === 0) {
        current.trendingSearches = catalog.trendingSearches || [];
        needsSave = true;
      }
      if (!current.wishlists) {
        current.wishlists = { 'usr-demo-1': ['prod-1', 'prod-3'] };
        needsSave = true;
      }
      if (!current.bags) {
        current.bags = {
          'usr-demo-1': [
            {
              id: 'item-demo-1',
              productId: 'prod-1',
              size: 'M',
              color: 'Olive Green',
              quantity: 1,
            },
          ],
        };
        needsSave = true;
      }
      if (!current.recentlyViewed) {
        current.recentlyViewed = { 'usr-demo-1': ['prod-1', 'prod-2'] };
        needsSave = true;
      }
      if (!current.savedForLater) {
        current.savedForLater = { 'usr-demo-1': [] };
        needsSave = true;
      }
      if (!current.addresses) {
        const initial = getInitialData();
        current.addresses = initial.addresses || { 'usr-demo-1': [] };
        needsSave = true;
      }
      if (!current.notifications) {
        const initial = getInitialData();
        current.notifications = initial.notifications || [];
        needsSave = true;
      }
      if (!current.deviceTokens) {
        current.deviceTokens = [];
        needsSave = true;
      }
      if (!current.notificationPreferences) {
        current.notificationPreferences = {
          'usr-demo-1': {
            orderUpdates: true,
            paymentUpdates: true,
            wishlistPriceDrops: true,
            stockAlerts: true,
            promotions: true,
            cartReminders: true,
            updatedAt: '2026-08-15T10:00:00.000Z',
          },
        };
        needsSave = true;
      }
      if (!current.notificationLogs) {
        current.notificationLogs = [];
        needsSave = true;
      }
      if (!current.orders) {
        const initial = getInitialData();
        current.orders = initial.orders || [];
        needsSave = true;
      }
      if (!current.auditLogs) {
        current.auditLogs = [];
        needsSave = true;
      }
      if (!current.processedPaymentEvents) {
        current.processedPaymentEvents = [];
        needsSave = true;
      }

      if (needsSave) {
        fs.writeFileSync(DB_FILE, JSON.stringify(current, null, 2), 'utf-8');
      }
    } catch (e) {
      console.error('Error synchronizing database schemas:', e);
    }
  }

  read() {
    try {
      if (!fs.existsSync(DB_FILE)) {
        this.init();
      }
      const raw = fs.readFileSync(DB_FILE, 'utf-8');
      return JSON.parse(raw);
    } catch (err) {
      console.error('Error reading database:', err);
      return {
        users: [],
        categories: [],
        products: [],
        wishlists: {},
        bags: {},
        savedForLater: {},
        recentlyViewed: {},
        addresses: {},
        notifications: [],
        deviceTokens: [],
        notificationPreferences: {},
        notificationLogs: [],
        orders: [],
        auditLogs: [],
        processedPaymentEvents: [],
      };
    }
  }

  write(data) {
    try {
      const tempFile = `${DB_FILE}.tmp`;
      fs.writeFileSync(tempFile, JSON.stringify(data, null, 2), 'utf-8');
      fs.renameSync(tempFile, DB_FILE);
      return true;
    } catch (err) {
      console.error('Error writing database:', err);
      return false;
    }
  }

  transaction(fn) {
    const data = this.read();
    const result = fn(data);
    this.write(data);
    return result;
  }
}

const db = new Database();

module.exports = db;
