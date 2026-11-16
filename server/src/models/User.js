const db = require('../db');
const bcrypt = require('bcryptjs');

class User {
  static sanitize(user) {
    if (!user) return null;
    const { passwordHash, ...safe } = user;
    return {
      ...safe,
      themePreference: safe.themePreference || 'system',
      // Backward compatibility aliases for existing React Native frontend
      name: safe.fullName || safe.name,
      fullName: safe.fullName || safe.name,
      mobile: safe.mobileNumber || safe.mobile,
      mobileNumber: safe.mobileNumber || safe.mobile,
    };
  }

  static findAll() {
    const data = db.read();
    return data.users || [];
  }

  static findById(id) {
    const users = this.findAll();
    return users.find((u) => u.id === id) || null;
  }

  static findByEmail(email) {
    if (!email) return null;
    const normalized = email.trim().toLowerCase();
    const users = this.findAll();
    return (
      users.find((u) => u.email && u.email.trim().toLowerCase() === normalized) ||
      null
    );
  }

  static findByMobile(mobile) {
    if (!mobile) return null;
    const clean = mobile.trim().replace(/\D/g, '');
    const users = this.findAll();
    return (
      users.find((u) => {
        const uClean = (u.mobileNumber || u.mobile || '').replace(/\D/g, '');
        return uClean === clean;
      }) || null
    );
  }

  static findByEmailOrMobile(identifier) {
    if (!identifier) return null;
    const clean = identifier.trim();
    if (clean.includes('@')) {
      return this.findByEmail(clean);
    }
    return this.findByMobile(clean) || this.findByEmail(clean);
  }

  static async create({
    fullName,
    email,
    mobileNumber,
    password,
    gender = 'Men',
    profileImage = null,
    themePreference = 'system',
  }) {
    const data = db.read();
    const users = data.users || [];

    const cleanName = fullName.trim();
    const cleanEmail = email ? email.trim().toLowerCase() : null;
    const cleanMobile = mobileNumber ? mobileNumber.trim().replace(/\D/g, '') : '';

    // Generate salt and hash password (10 rounds)
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const now = new Date().toISOString();
    const newUser = {
      id: `usr_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
      fullName: cleanName,
      name: cleanName,
      email: cleanEmail,
      mobileNumber: cleanMobile,
      mobile: cleanMobile,
      passwordHash,
      gender: gender || 'Men',
      role: 'customer',
      status: 'active',
      insiderPoints: 100, // 100 Welcome Insider Points
      profileImage: profileImage || null,
      themePreference: ['system', 'light', 'dark'].includes(themePreference)
        ? themePreference
        : 'system',
      createdAt: now,
      updatedAt: now,
    };

    users.push(newUser);
    data.users = users;
    db.write(data);

    return newUser;
  }

  static async comparePassword(plainPassword, passwordHash) {
    if (!plainPassword || !passwordHash) return false;
    return bcrypt.compare(plainPassword, passwordHash);
  }

  static update(id, updates) {
    const data = db.read();
    const users = data.users || [];
    const index = users.findIndex((u) => u.id === id);

    if (index === -1) return null;

    // Disallow overwriting id, passwordHash directly via this method
    const { id: _, passwordHash: __, ...allowedUpdates } = updates;

    const existing = users[index];
    const updatedUser = {
      ...existing,
      ...allowedUpdates,
      fullName: allowedUpdates.fullName || allowedUpdates.name || existing.fullName,
      name: allowedUpdates.fullName || allowedUpdates.name || existing.name,
      updatedAt: new Date().toISOString(),
    };

    users[index] = updatedUser;
    data.users = users;
    db.write(data);

    return updatedUser;
  }

  static async updatePassword(id, newPassword) {
    const data = db.read();
    const users = data.users || [];
    const index = users.findIndex((u) => u.id === id);

    if (index === -1) return null;

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(newPassword, salt);

    users[index] = {
      ...users[index],
      passwordHash,
      updatedAt: new Date().toISOString(),
    };

    data.users = users;
    db.write(data);

    return User.sanitize(users[index]);
  }
}

module.exports = User;
