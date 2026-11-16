const db = require('../db');

class DeviceToken {
  static findAll() {
    const data = db.read();
    return data.deviceTokens || [];
  }

  static findByUserId(userId) {
    if (!userId) return [];
    const all = this.findAll();
    return all.filter((t) => t.userId === userId && t.active);
  }

  static findByToken(token) {
    if (!token) return null;
    const all = this.findAll();
    return all.find((t) => t.token === token) || null;
  }

  /**
   * Register or update a device push token for a user.
   * Supports multiple devices per user.
   */
  static register({
    userId,
    token,
    platform = 'android',
    deviceId = null,
    deviceName = null,
  }) {
    if (!userId || !token) {
      throw new Error('userId and token are required to register a device token.');
    }

    const cleanToken = token.trim();
    const dbData = db.read();
    const tokens = dbData.deviceTokens || [];
    const now = new Date().toISOString();

    // Disassociate this push token from any previous user on this device
    tokens.forEach((t) => {
      if (t.token === cleanToken && t.userId !== userId && t.active) {
        t.active = false;
        t.deactivatedReason = 'TransferredToAnotherUser';
        t.updatedAt = now;
      }
    });

    // Check if this token or deviceId already exists for this user
    const existingIndex = tokens.findIndex(
      (t) => (t.token === cleanToken && t.userId === userId) || (deviceId && t.deviceId === deviceId && t.userId === userId)
    );

    if (existingIndex !== -1) {
      // Update existing record
      tokens[existingIndex] = {
        ...tokens[existingIndex],
        userId,
        token: cleanToken,
        platform: platform || tokens[existingIndex].platform || 'android',
        deviceId: deviceId || tokens[existingIndex].deviceId,
        deviceName: deviceName || tokens[existingIndex].deviceName,
        active: true,
        updatedAt: now,
      };
      dbData.deviceTokens = tokens;
      db.write(dbData);
      return tokens[existingIndex];
    }

    // New device token
    const newRecord = {
      id: `tok_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      userId,
      token: cleanToken,
      platform: platform || 'android',
      deviceId: deviceId || `dev_${Math.random().toString(36).substring(2, 9)}`,
      deviceName: deviceName || 'Mobile Device',
      active: true,
      createdAt: now,
      updatedAt: now,
    };

    tokens.push(newRecord);
    dbData.deviceTokens = tokens;
    db.write(dbData);

    return newRecord;
  }

  /**
   * Deactivate a device token (e.g. on logout)
   */
  static deactivate(token, userId) {
    if (!token) return false;
    const dbData = db.read();
    const tokens = dbData.deviceTokens || [];
    let updated = false;

    const modified = tokens.map((t) => {
      if (t.token === token && (!userId || t.userId === userId)) {
        updated = true;
        return {
          ...t,
          active: false,
          deactivatedReason: 'Logout',
          updatedAt: new Date().toISOString(),
        };
      }
      return t;
    });

    if (updated) {
      dbData.deviceTokens = modified;
      db.write(dbData);
    }

    return updated;
  }

  /**
   * Deactivate all device tokens for a specific user upon logout
   */
  static deactivateForUser(userId) {
    if (!userId) return false;
    const dbData = db.read();
    const tokens = dbData.deviceTokens || [];
    let updated = false;
    const now = new Date().toISOString();

    const modified = tokens.map((t) => {
      if (t.userId === userId && t.active) {
        updated = true;
        return {
          ...t,
          active: false,
          deactivatedReason: 'UserLogout',
          updatedAt: now,
        };
      }
      return t;
    });

    if (updated) {
      dbData.deviceTokens = modified;
      db.write(dbData);
    }

    return updated;
  }

  /**
   * Deactivate token globally when Expo returns DeviceNotRegistered
   */
  static deactivateInvalidToken(token) {
    if (!token) return false;
    const dbData = db.read();
    const tokens = dbData.deviceTokens || [];
    let updated = false;

    const modified = tokens.map((t) => {
      if (t.token === token) {
        updated = true;
        return {
          ...t,
          active: false,
          deactivatedReason: 'DeviceNotRegistered',
          updatedAt: new Date().toISOString(),
        };
      }
      return t;
    });

    if (updated) {
      dbData.deviceTokens = modified;
      db.write(dbData);
    }

    return updated;
  }

  /**
   * Find all active tokens across all users (for broadcast promotions)
   */
  static findAllActive() {
    const all = this.findAll();
    return all.filter((t) => t.active);
  }
}

module.exports = DeviceToken;
