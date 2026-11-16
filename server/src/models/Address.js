const db = require('../db');

class Address {
  static getAddressesMap() {
    const data = db.read();
    return data.addresses || {};
  }

  static findByUserId(userId) {
    if (!userId) return [];
    const map = this.getAddressesMap();
    const list = map[userId] || [];
    return Array.isArray(list) ? list : [];
  }

  static findById(id, userId) {
    if (!id || !userId) return null;
    const userAddresses = this.findByUserId(userId);
    return userAddresses.find((a) => a.id === id) || null;
  }

  static create(userId, data) {
    if (!userId) {
      throw new Error('Authentication required: userId is missing.');
    }

    const {
      name,
      mobile,
      pincode,
      address,
      locality,
      city,
      state,
      addressType = 'Home',
      isDefault = false,
    } = data;

    const cleanName = (name || '').trim();
    const cleanMobile = (mobile || '').toString().trim().replace(/\D/g, '');
    const cleanPincode = (pincode || '').toString().trim().replace(/\D/g, '');
    const cleanAddress = (address || '').trim();

    if (!cleanName || !cleanMobile || !cleanPincode || !cleanAddress) {
      const err = new Error('Name, mobile number, pincode, and address are required.');
      err.status = 400;
      throw err;
    }

    if (cleanMobile.length !== 10) {
      const err = new Error('Mobile number must be a valid 10-digit number.');
      err.status = 400;
      throw err;
    }

    if (cleanPincode.length !== 6) {
      const err = new Error('PIN code must be a valid 6-digit number.');
      err.status = 400;
      throw err;
    }

    const dbData = db.read();
    if (!dbData.addresses) dbData.addresses = {};
    if (!Array.isArray(dbData.addresses[userId])) {
      dbData.addresses[userId] = [];
    }

    const userAddresses = dbData.addresses[userId];
    const shouldBeDefault = Boolean(isDefault) || userAddresses.length === 0;

    if (shouldBeDefault) {
      userAddresses.forEach((a) => {
        a.isDefault = false;
      });
    }

    const now = new Date().toISOString();
    const newAddress = {
      id: `addr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      userId,
      name: cleanName,
      mobile: cleanMobile,
      pincode: cleanPincode,
      address: cleanAddress,
      locality: (locality || '').trim(),
      city: (city || 'Mumbai').trim(),
      state: (state || 'Maharashtra').trim(),
      addressType: addressType === 'Work' ? 'Work' : 'Home',
      isDefault: shouldBeDefault,
      createdAt: now,
      updatedAt: now,
    };

    userAddresses.unshift(newAddress);
    db.write(dbData);

    return { address: newAddress, addresses: userAddresses };
  }

  static update(id, userId, updates) {
    if (!id || !userId) {
      const err = new Error('Address ID and authenticated user are required.');
      err.status = 400;
      throw err;
    }

    const dbData = db.read();
    if (!dbData.addresses) dbData.addresses = {};
    const userAddresses = dbData.addresses[userId] || [];

    // Check if the address exists globally in any user's list
    let existsGlobally = false;
    for (const [uid, addrs] of Object.entries(dbData.addresses)) {
      if (Array.isArray(addrs) && addrs.some((a) => a.id === id)) {
        existsGlobally = true;
        if (uid !== userId) {
          const err = new Error('Forbidden: You do not have permission to modify this address.');
          err.status = 403;
          throw err;
        }
        break;
      }
    }

    const index = userAddresses.findIndex((a) => a.id === id);
    if (index === -1) {
      const err = new Error('Address not found.');
      err.status = 404;
      throw err;
    }

    const current = userAddresses[index];
    const now = new Date().toISOString();

    if (updates.isDefault) {
      userAddresses.forEach((a) => {
        a.isDefault = false;
      });
    }

    const updated = {
      ...current,
      name: updates.name ? updates.name.trim() : current.name,
      mobile: updates.mobile ? updates.mobile.toString().trim().replace(/\D/g, '') : current.mobile,
      pincode: updates.pincode ? updates.pincode.toString().trim().replace(/\D/g, '') : current.pincode,
      address: updates.address ? updates.address.trim() : current.address,
      locality: updates.locality !== undefined ? (updates.locality || '').trim() : current.locality,
      city: updates.city ? updates.city.trim() : current.city,
      state: updates.state ? updates.state.trim() : current.state,
      addressType: updates.addressType === 'Work' ? 'Work' : updates.addressType === 'Home' ? 'Home' : current.addressType,
      isDefault: updates.isDefault !== undefined ? Boolean(updates.isDefault) : current.isDefault,
      updatedAt: now,
    };

    userAddresses[index] = updated;
    db.write(dbData);

    return { address: updated, addresses: userAddresses };
  }

  static delete(id, userId) {
    if (!id || !userId) {
      const err = new Error('Address ID and authenticated user are required.');
      err.status = 400;
      throw err;
    }

    const dbData = db.read();
    if (!dbData.addresses) dbData.addresses = {};
    const userAddresses = dbData.addresses[userId] || [];

    // Verify ownership across all users
    for (const [uid, addrs] of Object.entries(dbData.addresses)) {
      if (Array.isArray(addrs) && addrs.some((a) => a.id === id)) {
        if (uid !== userId) {
          const err = new Error('Forbidden: You do not have permission to delete this address.');
          err.status = 403;
          throw err;
        }
        break;
      }
    }

    const index = userAddresses.findIndex((a) => a.id === id);
    if (index === -1) {
      const err = new Error('Address not found.');
      err.status = 404;
      throw err;
    }

    const wasDefault = userAddresses[index].isDefault;
    userAddresses.splice(index, 1);

    // If deleted address was default and other addresses remain, make the first one default
    if (wasDefault && userAddresses.length > 0) {
      userAddresses[0].isDefault = true;
    }

    dbData.addresses[userId] = userAddresses;
    db.write(dbData);

    return { success: true, addresses: userAddresses };
  }

  static setDefault(id, userId) {
    if (!id || !userId) {
      const err = new Error('Address ID and authenticated user are required.');
      err.status = 400;
      throw err;
    }

    const dbData = db.read();
    if (!dbData.addresses) dbData.addresses = {};
    const userAddresses = dbData.addresses[userId] || [];

    // Verify ownership
    for (const [uid, addrs] of Object.entries(dbData.addresses)) {
      if (Array.isArray(addrs) && addrs.some((a) => a.id === id)) {
        if (uid !== userId) {
          const err = new Error('Forbidden: You do not have permission to modify this address.');
          err.status = 403;
          throw err;
        }
        break;
      }
    }

    const index = userAddresses.findIndex((a) => a.id === id);
    if (index === -1) {
      const err = new Error('Address not found.');
      err.status = 404;
      throw err;
    }

    userAddresses.forEach((a) => {
      a.isDefault = a.id === id;
    });

    dbData.addresses[userId] = userAddresses;
    db.write(dbData);

    return { success: true, addresses: userAddresses };
  }
}

module.exports = Address;
