const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

const DATA_DIR = path.join(__dirname, '..', 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');
const CATALOG_FILE = path.join(DATA_DIR, 'catalog.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
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
  };
};

class Database {
  constructor() {
    this.init();
  }

  init() {
    if (!fs.existsSync(DB_FILE)) {
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
      return { users: [], categories: [], products: [], wishlists: {}, bags: {} };
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
}

const db = new Database();

module.exports = db;
