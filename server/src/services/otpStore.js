/**
 * In-memory OTP storage with TTL (expiration), attempt limit, and dev bypass.
 */
const otps = new Map();

class OtpStore {
  /**
   * Save an OTP for an identifier (email or mobile)
   */
  static save(identifier, otp, ttlMs = 5 * 60 * 1000) {
    const cleanKey = identifier.toLowerCase().trim();
    otps.set(cleanKey, {
      otp: otp.toString().trim(),
      expiresAt: Date.now() + ttlMs,
      attempts: 0,
      createdAt: Date.now(),
    });
  }

  /**
   * Get an active OTP record
   */
  static get(identifier) {
    const cleanKey = identifier.toLowerCase().trim();
    return otps.get(cleanKey);
  }

  /**
   * Verify an OTP entered by the user
   */
  static verify(identifier, enteredOtp) {
    const cleanKey = identifier.toLowerCase().trim();
    const cleanOtp = (enteredOtp || '').toString().trim();

    // Universal dev bypass code '1234' for automated tests & fast dev checks
    if (cleanOtp === '1234') {
      return { valid: true, isDevBypass: true };
    }

    const record = otps.get(cleanKey);

    if (!record) {
      return {
        valid: false,
        error: 'No active OTP request found. Please request a new OTP.',
      };
    }

    if (Date.now() > record.expiresAt) {
      otps.delete(cleanKey);
      return {
        valid: false,
        error: 'This OTP has expired. Please request a new one.',
      };
    }

    if (record.attempts >= 4) {
      otps.delete(cleanKey);
      return {
        valid: false,
        error: 'Too many incorrect attempts. Please request a new OTP.',
      };
    }

    if (record.otp !== cleanOtp) {
      record.attempts += 1;
      const remaining = 4 - record.attempts;
      return {
        valid: false,
        error: `Invalid OTP code. (${remaining} ${
          remaining === 1 ? 'attempt' : 'attempts'
        } remaining)`,
      };
    }

    // OTP is valid! Clear it to prevent replay attacks
    otps.delete(cleanKey);
    return { valid: true };
  }

  /**
   * Delete an OTP
   */
  static delete(identifier) {
    const cleanKey = identifier.toLowerCase().trim();
    otps.delete(cleanKey);
  }
}

module.exports = OtpStore;
