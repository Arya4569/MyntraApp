/**
 * Transactional SQLite Persistence Layer for Cart & Transaction-Critical Operations
 * Powered by Node.js 22/25 built-in node:sqlite with ACID compliance, WAL mode,
 * immediate write locks, rollback support, and automatic JSON migration.
 * Includes resilient JSON fallback for Node environments < 22.
 */
let DatabaseSync = null;
try {
  DatabaseSync = require('node:sqlite').DatabaseSync;
} catch (e) {
  DatabaseSync = null;
}

const path = require('path');
const fs = require('fs');

const DATA_DIR = path.join(__dirname, '..', '..', 'data');
const SQLITE_FILE = path.join(DATA_DIR, 'myntra.sqlite');
const JSON_DB_FILE = path.join(DATA_DIR, 'db.json');

class SqliteManager {
  constructor() {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }

    if (DatabaseSync) {
      try {
        this.db = new DatabaseSync(SQLITE_FILE);
        this.init();
        this.migrateFromJson();
        this.isSqliteActive = true;
      } catch (e) {
        console.warn('[SQLite] Notice initializing SQLite:', e.message);
        this.isSqliteActive = false;
      }
    } else {
      console.warn('[SQLite] node:sqlite not available on this Node version. Operating in resilient JSON sync mode.');
      this.isSqliteActive = false;
    }
  }

  init() {
    if (!this.db) return;
    // 1. Enable WAL mode for high concurrency
    this.db.exec('PRAGMA journal_mode = WAL;');
    this.db.exec('PRAGMA busy_timeout = 5000;');
    this.db.exec('PRAGMA foreign_keys = ON;');

    // 2. Schema for Shopping Bag Items
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS cart_items (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        product_id TEXT NOT NULL,
        size TEXT NOT NULL,
        color TEXT,
        quantity INTEGER NOT NULL DEFAULT 1,
        saved_price REAL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE(user_id, product_id, size)
      );
    `);

    // 3. Schema for Save For Later Items
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS saved_for_later (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        product_id TEXT NOT NULL,
        size TEXT NOT NULL,
        color TEXT,
        quantity INTEGER NOT NULL DEFAULT 1,
        saved_price REAL,
        saved_at TEXT NOT NULL,
        UNIQUE(user_id, product_id, size)
      );
    `);

    // 4. Schema for Migration Meta
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS _migration_meta (
        key TEXT PRIMARY KEY,
        migrated_at TEXT NOT NULL
      );
    `);
  }

  migrateFromJson() {
    if (!this.db) return;
    try {
      const migrated = this.db.prepare('SELECT key FROM _migration_meta WHERE key = ?').get('json_cart_migrated');
      if (migrated) return;

      if (fs.existsSync(JSON_DB_FILE)) {
        const raw = fs.readFileSync(JSON_DB_FILE, 'utf8');
        const data = JSON.parse(raw);
        const bags = data.bags || {};
        const saved = data.savedForLater || {};

        this.transaction(() => {
          const insertCart = this.db.prepare(`
            INSERT OR REPLACE INTO cart_items (id, user_id, product_id, size, color, quantity, saved_price, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          `);

          for (const [userId, items] of Object.entries(bags)) {
            if (Array.isArray(items)) {
              for (const item of items) {
                const now = new Date().toISOString();
                insertCart.run(
                  item.id || `cart_${userId}_${item.productId}_${item.size || 'M'}`,
                  userId,
                  item.productId,
                  item.size || 'M',
                  item.color || 'Standard',
                  item.quantity || 1,
                  item.savedPrice || null,
                  item.addedAt || now,
                  now
                );
              }
            }
          }

          const insertSaved = this.db.prepare(`
            INSERT OR REPLACE INTO saved_for_later (id, user_id, product_id, size, color, quantity, saved_price, saved_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `);

          for (const [userId, items] of Object.entries(saved)) {
            if (Array.isArray(items)) {
              for (const item of items) {
                insertSaved.run(
                  item.id || `saved_${userId}_${item.productId}_${item.size || 'M'}`,
                  userId,
                  item.productId,
                  item.size || 'M',
                  item.color || 'Standard',
                  item.quantity || 1,
                  item.savedPrice || null,
                  item.savedAt || new Date().toISOString()
                );
              }
            }
          }

          this.db.prepare('INSERT INTO _migration_meta (key, migrated_at) VALUES (?, ?)').run(
            'json_cart_migrated',
            new Date().toISOString()
          );
        });

        console.log('[SQLite] Successfully migrated existing cart & saved_for_later data from db.json');
      }
    } catch (e) {
      console.warn('[SQLite] Notice during JSON migration:', e.message);
    }
  }

  readJson() {
    try {
      if (fs.existsSync(JSON_DB_FILE)) {
        return JSON.parse(fs.readFileSync(JSON_DB_FILE, 'utf8'));
      }
    } catch (e) {}
    return { bags: {}, savedForLater: {} };
  }

  writeJson(data) {
    try {
      fs.writeFileSync(JSON_DB_FILE, JSON.stringify(data, null, 2), 'utf8');
    } catch (e) {}
  }

  transaction(fn) {
    if (this.isSqliteActive && this.db) {
      this.db.exec('BEGIN IMMEDIATE;');
      try {
        const result = fn(this.db);
        this.db.exec('COMMIT;');
        return result;
      } catch (err) {
        try {
          this.db.exec('ROLLBACK;');
        } catch (rbErr) {}
        throw err;
      }
    } else {
      return fn(null);
    }
  }

  // --- Cart Operations ---

  getCartItems(userId) {
    if (!userId) return [];
    if (!this.isSqliteActive || !this.db) {
      const data = this.readJson();
      const items = data.bags?.[userId] || [];
      return items.map((r) => ({
        id: r.id,
        productId: r.productId,
        size: r.size,
        color: r.color,
        quantity: Number(r.quantity),
        savedPrice: r.savedPrice !== null && r.savedPrice !== undefined ? Number(r.savedPrice) : undefined,
        addedAt: r.addedAt || r.createdAt,
      }));
    }

    const rows = this.db.prepare(`
      SELECT id, product_id AS productId, size, color, quantity, saved_price AS savedPrice, created_at AS addedAt
      FROM cart_items
      WHERE user_id = ?
      ORDER BY updated_at DESC
    `).all(userId);

    return rows.map((r) => ({
      id: r.id,
      productId: r.productId,
      size: r.size,
      color: r.color,
      quantity: Number(r.quantity),
      savedPrice: r.savedPrice !== null ? Number(r.savedPrice) : undefined,
      addedAt: r.addedAt,
    }));
  }

  getSavedItems(userId) {
    if (!userId) return [];
    if (!this.isSqliteActive || !this.db) {
      const data = this.readJson();
      const items = data.savedForLater?.[userId] || [];
      return items.map((r) => ({
        id: r.id,
        productId: r.productId,
        size: r.size,
        color: r.color,
        quantity: Number(r.quantity),
        savedPrice: r.savedPrice !== null && r.savedPrice !== undefined ? Number(r.savedPrice) : undefined,
        savedAt: r.savedAt,
      }));
    }

    const rows = this.db.prepare(`
      SELECT id, product_id AS productId, size, color, quantity, saved_price AS savedPrice, saved_at AS savedAt
      FROM saved_for_later
      WHERE user_id = ?
      ORDER BY saved_at DESC
    `).all(userId);

    return rows.map((r) => ({
      id: r.id,
      productId: r.productId,
      size: r.size,
      color: r.color,
      quantity: Number(r.quantity),
      savedPrice: r.savedPrice !== null ? Number(r.savedPrice) : undefined,
      savedAt: r.savedAt,
    }));
  }

  addItem(userId, { productId, size, color, quantity = 1, price = null, availableStock = 10 }) {
    if (!this.isSqliteActive || !this.db) {
      const data = this.readJson();
      if (!data.bags) data.bags = {};
      if (!data.bags[userId]) data.bags[userId] = [];
      const existing = data.bags[userId].find((i) => i.productId === productId && i.size === size);
      if (existing) {
        const newQty = Number(existing.quantity) + Number(quantity);
        if (newQty > availableStock) {
          throw new Error(`Cannot add more. You already have ${existing.quantity} in your bag and only ${availableStock} are available in stock.`);
        }
        if (newQty > 10) throw new Error('Maximum purchase limit is 10 units per item.');
        existing.quantity = newQty;
        this.writeJson(data);
        return { id: existing.id, isUpdated: true, quantity: newQty };
      }
      if (quantity > availableStock) {
        throw new Error(`Only ${availableStock} unit(s) available in stock. Cannot add ${quantity}.`);
      }
      if (quantity > 10) throw new Error('Maximum purchase limit is 10 units per item.');
      const id = `item_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
      const item = {
        id,
        productId,
        size,
        color: color || 'Standard',
        quantity: Number(quantity),
        savedPrice: price,
        addedAt: new Date().toISOString(),
      };
      data.bags[userId].unshift(item);
      this.writeJson(data);
      return { id, isUpdated: false, quantity };
    }

    return this.transaction(() => {
      const existing = this.db.prepare(`
        SELECT id, quantity, saved_price
        FROM cart_items
        WHERE user_id = ? AND product_id = ? AND size = ?
      `).get(userId, productId, size);

      const now = new Date().toISOString();

      if (existing) {
        const newQty = Number(existing.quantity) + Number(quantity);
        if (newQty > availableStock) {
          throw new Error(`Cannot add more. You already have ${existing.quantity} in your bag and only ${availableStock} are available in stock.`);
        }
        if (newQty > 10) {
          throw new Error('Maximum purchase limit is 10 units per item.');
        }

        this.db.prepare(`
          UPDATE cart_items
          SET quantity = ?, color = ?, saved_price = COALESCE(?, saved_price), updated_at = ?
          WHERE id = ?
        `).run(newQty, color, price, now, existing.id);

        return { id: existing.id, isUpdated: true, quantity: newQty };
      } else {
        if (quantity > availableStock) {
          throw new Error(`Only ${availableStock} unit(s) available in stock. Cannot add ${quantity}.`);
        }
        if (quantity > 10) {
          throw new Error('Maximum purchase limit is 10 units per item.');
        }

        const id = `item_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
        this.db.prepare(`
          INSERT INTO cart_items (id, user_id, product_id, size, color, quantity, saved_price, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(id, userId, productId, size, color, quantity, price, now, now);

        return { id, isUpdated: false, quantity };
      }
    });
  }

  updateItem(userId, itemIdOrProdId, { quantity, size, color, availableStock = 10 }) {
    if (!this.isSqliteActive || !this.db) {
      const data = this.readJson();
      const items = data.bags?.[userId] || [];
      const item = items.find((i) => i.id === itemIdOrProdId || i.productId === itemIdOrProdId);
      if (!item) throw new Error('Item not found in bag.');
      const newQty = quantity !== undefined ? Number(quantity) : Number(item.quantity);
      if (newQty > availableStock) throw new Error(`Only ${availableStock} unit(s) available in stock.`);
      if (newQty > 10) throw new Error('Maximum purchase limit is 10 units per item.');
      item.quantity = newQty;
      if (size !== undefined) item.size = String(size).trim();
      if (color !== undefined) item.color = String(color).trim();
      this.writeJson(data);
      return { id: item.id, quantity: newQty, size: item.size, color: item.color };
    }

    return this.transaction(() => {
      const item = this.db.prepare(`
        SELECT id, product_id, size, color, quantity
        FROM cart_items
        WHERE user_id = ? AND (id = ? OR product_id = ?)
      `).get(userId, itemIdOrProdId, itemIdOrProdId);

      if (!item) {
        throw new Error('Item not found in bag.');
      }

      const newQty = quantity !== undefined ? Number(quantity) : Number(item.quantity);
      if (newQty > availableStock) {
        throw new Error(`Only ${availableStock} unit(s) available in stock.`);
      }
      if (newQty > 10) {
        throw new Error('Maximum purchase limit is 10 units per item.');
      }

      const newSize = size !== undefined ? String(size).trim() : item.size;
      const newColor = color !== undefined ? String(color).trim() : item.color;
      const now = new Date().toISOString();

      // Check variant conflict if size changed
      if (newSize !== item.size) {
        const conflict = this.db.prepare(`
          SELECT id, quantity
          FROM cart_items
          WHERE user_id = ? AND product_id = ? AND size = ? AND id != ?
        `).get(userId, item.product_id, newSize, item.id);

        if (conflict) {
          const mergedQty = Math.min(10, Math.min(availableStock, Number(conflict.quantity) + newQty));
          this.db.prepare(`
            UPDATE cart_items
            SET quantity = ?, updated_at = ?
            WHERE id = ?
          `).run(mergedQty, now, conflict.id);

          this.db.prepare('DELETE FROM cart_items WHERE id = ?').run(item.id);
          return { id: conflict.id, merged: true, quantity: mergedQty };
        }
      }

      this.db.prepare(`
        UPDATE cart_items
        SET quantity = ?, size = ?, color = ?, updated_at = ?
        WHERE id = ?
      `).run(newQty, newSize, newColor, now, item.id);

      return { id: item.id, quantity: newQty, size: newSize, color: newColor };
    });
  }

  removeItem(userId, itemIdOrProdId) {
    if (!this.isSqliteActive || !this.db) {
      const data = this.readJson();
      const items = data.bags?.[userId] || [];
      const idx = items.findIndex((i) => i.id === itemIdOrProdId || i.productId === itemIdOrProdId);
      if (idx === -1) return null;
      const [removed] = items.splice(idx, 1);
      this.writeJson(data);
      return removed;
    }

    return this.transaction(() => {
      const item = this.db.prepare(`
        SELECT id, product_id, size, color, quantity, saved_price
        FROM cart_items
        WHERE user_id = ? AND (id = ? OR product_id = ?)
      `).get(userId, itemIdOrProdId, itemIdOrProdId);

      if (!item) {
        return null;
      }

      this.db.prepare('DELETE FROM cart_items WHERE id = ?').run(item.id);
      return {
        id: item.id,
        productId: item.product_id,
        size: item.size,
        color: item.color,
        quantity: item.quantity,
      };
    });
  }

  clearCart(userId) {
    if (!this.isSqliteActive || !this.db) {
      const data = this.readJson();
      const count = data.bags?.[userId]?.length || 0;
      if (data.bags) data.bags[userId] = [];
      this.writeJson(data);
      return { removedCount: count };
    }

    return this.transaction(() => {
      const count = this.db.prepare('SELECT count(*) AS count FROM cart_items WHERE user_id = ?').get(userId);
      this.db.prepare('DELETE FROM cart_items WHERE user_id = ?').run(userId);
      return { removedCount: count ? count.count : 0 };
    });
  }

  saveForLater(userId, itemIdOrProdId) {
    if (!this.isSqliteActive || !this.db) {
      const data = this.readJson();
      if (!data.bags) data.bags = {};
      if (!data.savedForLater) data.savedForLater = {};
      if (!data.savedForLater[userId]) data.savedForLater[userId] = [];
      const items = data.bags[userId] || [];
      const idx = items.findIndex((i) => i.id === itemIdOrProdId || i.productId === itemIdOrProdId);
      if (idx === -1) throw new Error('Item not found in bag.');
      const [item] = items.splice(idx, 1);
      const savedId = `saved_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
      const savedItem = { ...item, id: savedId, savedAt: new Date().toISOString() };
      data.savedForLater[userId].unshift(savedItem);
      this.writeJson(data);
      return savedItem;
    }

    return this.transaction(() => {
      const item = this.db.prepare(`
        SELECT id, product_id, size, color, quantity, saved_price
        FROM cart_items
        WHERE user_id = ? AND (id = ? OR product_id = ?)
      `).get(userId, itemIdOrProdId, itemIdOrProdId);

      if (!item) {
        throw new Error('Item not found in bag.');
      }

      const now = new Date().toISOString();
      const savedId = `saved_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;

      this.db.prepare(`
        INSERT INTO saved_for_later (id, user_id, product_id, size, color, quantity, saved_price, saved_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(user_id, product_id, size) DO UPDATE SET
          quantity = excluded.quantity,
          saved_price = excluded.saved_price,
          saved_at = excluded.saved_at
      `).run(savedId, userId, item.product_id, item.size, item.color, item.quantity, item.saved_price, now);

      this.db.prepare('DELETE FROM cart_items WHERE id = ?').run(item.id);

      return {
        savedId,
        productId: item.product_id,
        size: item.size,
        color: item.color,
        quantity: item.quantity,
      };
    });
  }

  moveToCart(userId, itemIdOrProdId, availableStock = 10) {
    if (!this.isSqliteActive || !this.db) {
      const data = this.readJson();
      if (!data.bags) data.bags = {};
      if (!data.bags[userId]) data.bags[userId] = [];
      const savedList = data.savedForLater?.[userId] || [];
      const idx = savedList.findIndex((i) => i.id === itemIdOrProdId || i.productId === itemIdOrProdId);
      if (idx === -1) throw new Error('Item not found in Saved for Later.');
      if (availableStock <= 0) throw new Error('Cannot move to bag: Item is out of stock.');
      const [saved] = savedList.splice(idx, 1);
      const cartId = `item_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
      const cartItem = { ...saved, id: cartId, quantity: Math.min(Number(saved.quantity), availableStock) };
      data.bags[userId].unshift(cartItem);
      this.writeJson(data);
      return cartItem;
    }

    return this.transaction(() => {
      const saved = this.db.prepare(`
        SELECT id, product_id, size, color, quantity, saved_price
        FROM saved_for_later
        WHERE user_id = ? AND (id = ? OR product_id = ?)
      `).get(userId, itemIdOrProdId, itemIdOrProdId);

      if (!saved) {
        throw new Error('Item not found in Saved for Later.');
      }

      if (availableStock <= 0) {
        throw new Error('Cannot move to bag: Item is out of stock.');
      }

      const now = new Date().toISOString();
      const cartId = `item_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
      const targetQty = Math.min(Number(saved.quantity), availableStock);

      this.db.prepare(`
        INSERT INTO cart_items (id, user_id, product_id, size, color, quantity, saved_price, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(user_id, product_id, size) DO UPDATE SET
          quantity = MIN(10, cart_items.quantity + excluded.quantity),
          updated_at = excluded.updated_at
      `).run(cartId, userId, saved.product_id, saved.size, saved.color, targetQty, saved.saved_price, now, now);

      this.db.prepare('DELETE FROM saved_for_later WHERE id = ?').run(saved.id);

      return {
        cartId,
        productId: saved.product_id,
        size: saved.size,
        color: saved.color,
        quantity: targetQty,
      };
    });
  }

  removeSavedItem(userId, itemIdOrProdId) {
    if (!this.isSqliteActive || !this.db) {
      const data = this.readJson();
      const savedList = data.savedForLater?.[userId] || [];
      const idx = savedList.findIndex((i) => i.id === itemIdOrProdId || i.productId === itemIdOrProdId);
      if (idx === -1) return null;
      const [removed] = savedList.splice(idx, 1);
      this.writeJson(data);
      return removed;
    }

    return this.transaction(() => {
      const item = this.db.prepare(`
        SELECT id, product_id, size
        FROM saved_for_later
        WHERE user_id = ? AND (id = ? OR product_id = ?)
      `).get(userId, itemIdOrProdId, itemIdOrProdId);

      if (!item) {
        return null;
      }

      this.db.prepare('DELETE FROM saved_for_later WHERE id = ?').run(item.id);
      return { id: item.id };
    });
  }

  mergeGuestCart(userId, { cartItems = [], savedForLaterItems = [] }) {
    if (!this.isSqliteActive || !this.db) {
      const data = this.readJson();
      if (!data.bags) data.bags = {};
      if (!data.bags[userId]) data.bags[userId] = [];
      for (const item of cartItems) {
        if (!item.productId) continue;
        const existing = data.bags[userId].find((i) => i.productId === item.productId && i.size === item.size);
        if (existing) {
          existing.quantity = Math.min(10, Number(existing.quantity) + Number(item.quantity || 1));
        } else {
          data.bags[userId].unshift(item);
        }
      }
      this.writeJson(data);
      return { mergedCount: cartItems.length };
    }

    return this.transaction(() => {
      let mergedCount = 0;
      const now = new Date().toISOString();

      const insertCart = this.db.prepare(`
        INSERT INTO cart_items (id, user_id, product_id, size, color, quantity, saved_price, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(user_id, product_id, size) DO UPDATE SET
          quantity = MIN(10, cart_items.quantity + excluded.quantity),
          updated_at = excluded.updated_at
      `);

      for (const item of cartItems) {
        if (!item.productId) continue;
        const id = item.id || `cart_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
        insertCart.run(
          id,
          userId,
          item.productId,
          item.size || 'M',
          item.color || 'Default',
          Number(item.quantity) || 1,
          item.savedPrice || null,
          now,
          now
        );
        mergedCount++;
      }

      const insertSaved = this.db.prepare(`
        INSERT INTO saved_for_later (id, user_id, product_id, size, color, quantity, saved_price, saved_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(user_id, product_id, size) DO UPDATE SET
          quantity = excluded.quantity,
          saved_at = excluded.saved_at
      `);

      for (const item of savedForLaterItems) {
        if (!item.productId) continue;
        const id = item.id || `saved_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
        insertSaved.run(
          id,
          userId,
          item.productId,
          item.size || 'M',
          item.color || 'Default',
          Number(item.quantity) || 1,
          item.savedPrice || null,
          now
        );
      }

      return { mergedCount };
    });
  }

  getAllBags() {
    if (!this.isSqliteActive || !this.db) {
      return this.readJson().bags || {};
    }
    const rows = this.db.prepare(`
      SELECT user_id, id, product_id AS productId, size, color, quantity, saved_price AS savedPrice, created_at AS addedAt
      FROM cart_items
    `).all();
    const bags = {};
    for (const r of rows) {
      if (!bags[r.user_id]) bags[r.user_id] = [];
      bags[r.user_id].push({
        id: r.id,
        productId: r.productId,
        size: r.size,
        color: r.color,
        quantity: Number(r.quantity),
        savedPrice: r.savedPrice !== null ? Number(r.savedPrice) : undefined,
        addedAt: r.addedAt,
      });
    }
    return bags;
  }

  getAllSaved() {
    if (!this.isSqliteActive || !this.db) {
      return this.readJson().savedForLater || {};
    }
    const rows = this.db.prepare(`
      SELECT user_id, id, product_id AS productId, size, color, quantity, saved_price AS savedPrice, saved_at AS savedAt
      FROM saved_for_later
    `).all();
    const saved = {};
    for (const r of rows) {
      if (!saved[r.user_id]) saved[r.user_id] = [];
      saved[r.user_id].push({
        id: r.id,
        productId: r.productId,
        size: r.size,
        color: r.color,
        quantity: Number(r.quantity),
        savedPrice: r.savedPrice !== null ? Number(r.savedPrice) : undefined,
        savedAt: r.savedAt,
      });
    }
    return saved;
  }
}

module.exports = new SqliteManager();
