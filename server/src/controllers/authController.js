const jwt = require('jsonwebtoken');
const User = require('../models/User');
const DeviceToken = require('../models/DeviceToken');
const Notification = require('../models/Notification');
const { JWT_SECRET } = require('../middleware/auth');
const emailService = require('../services/emailService');
const OtpStore = require('../services/otpStore');

const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '30d';

const generateToken = (user) => {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      mobile: user.mobileNumber || user.mobile,
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
};

// 1. REGISTER
exports.register = async (req, res) => {
  try {
    const {
      fullName,
      name,
      email,
      mobileNumber,
      mobile,
      password,
      confirmPassword,
      gender,
      termsAccepted,
    } = req.body;

    const actualName = (fullName || name || '').trim();
    const actualEmail = (email || '').trim().toLowerCase();
    const actualMobile = (mobileNumber || mobile || '').trim().replace(/\D/g, '');

    // Input Validations
    if (!actualName || actualName.length < 2) {
      return res.status(400).json({
        success: false,
        error: 'Please enter a valid full name (minimum 2 characters).',
      });
    }

    if (!actualEmail) {
      return res.status(400).json({
        success: false,
        error: 'Email address is required.',
      });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(actualEmail)) {
      return res.status(400).json({
        success: false,
        error: 'Please enter a valid email address.',
      });
    }

    if (actualMobile && !/^[6-9]\d{9}$/.test(actualMobile)) {
      return res.status(400).json({
        success: false,
        error: 'Please enter a valid 10-digit Indian mobile number.',
      });
    }

    if (!password || password.length < 6) {
      return res.status(400).json({
        success: false,
        error: 'Password must be at least 6 characters long.',
      });
    }

    if (confirmPassword !== undefined && password !== confirmPassword) {
      return res.status(400).json({
        success: false,
        error: 'Passwords do not match.',
      });
    }

    if (termsAccepted === false) {
      return res.status(400).json({
        success: false,
        error: 'You must agree to the Terms of Use and Privacy Policy.',
      });
    }

    // Duplicate Check
    const existingByEmail = User.findByEmail(actualEmail);
    if (existingByEmail) {
      return res.status(400).json({
        success: false,
        error: 'An account with this email address already exists. Please log in.',
      });
    }

    if (actualMobile) {
      const existingByMobile = User.findByMobile(actualMobile);
      if (existingByMobile) {
        return res.status(400).json({
          success: false,
          error: 'An account with this mobile number already exists. Please log in.',
        });
      }
    }

    // Create user
    const newUser = await User.create({
      fullName: actualName,
      email: actualEmail,
      mobileNumber: actualMobile,
      password,
      gender: gender || 'Men',
    });

    const safeUser = User.sanitize(newUser);
    const token = generateToken(newUser);

    // Create personalized welcome notification for the newly registered user
    try {
      Notification.create({
        userId: newUser.id,
        title: 'Welcome to Myntra! 🎉',
        message: `Hi ${actualName}, welcome to Myntra! Enjoy flat ₹500 OFF with code MYNTRA50 on your first fashion order.`,
        category: 'promotion',
        data: { couponCode: 'MYNTRA50', screen: 'offers' },
        idempotencyKey: `welcome_${newUser.id}`,
      });
    } catch (notifErr) {
      console.warn('Notice: Failed to seed welcome notification:', notifErr.message);
    }

    return res.status(201).json({
      success: true,
      message: 'Account created successfully! Welcome to Myntra.',
      user: safeUser,
      token,
    });
  } catch (err) {
    console.error('Registration error:', err);
    return res.status(500).json({
      success: false,
      error: 'An unexpected error occurred while creating your account.',
    });
  }
};

// 2. LOGIN
exports.login = async (req, res) => {
  try {
    const { identifier, email, mobile, password } = req.body;
    const loginTarget = (identifier || email || mobile || '').trim();

    if (!loginTarget) {
      return res.status(400).json({
        success: false,
        error: 'Please enter your registered email address or mobile number.',
      });
    }

    if (!password) {
      return res.status(400).json({
        success: false,
        error: 'Please enter your password.',
      });
    }

    const user = User.findByEmailOrMobile(loginTarget);
    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials. No account found with this email or mobile.',
      });
    }

    const isMatch = await User.comparePassword(password, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        error: 'Incorrect password. Please verify and try again.',
      });
    }

    const safeUser = User.sanitize(user);
    const token = generateToken(user);

    return res.status(200).json({
      success: true,
      message: 'Login successful.',
      user: safeUser,
      token,
    });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({
      success: false,
      error: 'An unexpected server error occurred during login.',
    });
  }
};

// 2B. SEND OTP (Real-time Email OTP via Nodemailer & optional SMS via Fast2SMS)
exports.sendOtp = async (req, res) => {
  try {
    const rawIdentifier = (
      req.body.identifier ||
      req.body.email ||
      req.body.mobile ||
      ''
    )
      .toString()
      .trim();

    if (!rawIdentifier) {
      return res.status(400).json({
        success: false,
        error: 'Please enter a valid email address or mobile number.',
      });
    }

    const isEmail = rawIdentifier.includes('@');
    let cleanEmail = null;
    let cleanMobile = null;
    let user = null;

    if (isEmail) {
      cleanEmail = rawIdentifier.toLowerCase();
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(cleanEmail)) {
        return res.status(400).json({
          success: false,
          error: 'Please enter a valid email address.',
        });
      }
      user = User.findByEmail(cleanEmail);
    } else {
      cleanMobile = rawIdentifier.replace(/\D/g, '');
      if (!/^[6-9]\d{9}$/.test(cleanMobile)) {
        return res.status(400).json({
          success: false,
          error: 'Please enter a valid 10-digit Indian mobile number.',
        });
      }
      user = User.findByMobile(cleanMobile);
      if (user && user.email) {
        cleanEmail = user.email;
      }
    }

    // Generate authentic 4-digit numeric OTP matching Myntra UX
    const code = Math.floor(1000 + Math.random() * 9000).toString();

    // Store in OtpStore for verification
    const targetKey = isEmail ? cleanEmail : cleanMobile;
    OtpStore.save(targetKey, code);
    if (cleanEmail && targetKey !== cleanEmail) {
      OtpStore.save(cleanEmail, code);
    }

    let liveDelivery = false;
    let deliveryMessage = '';

    // 1. Dispatch Email OTP if email is present
    if (cleanEmail) {
      const emailResult = await emailService.sendOtpEmail({
        to: cleanEmail,
        otp: code,
        name: user ? user.fullName || user.name : undefined,
      });
      liveDelivery = emailResult.live;
      deliveryMessage = liveDelivery
        ? `OTP has been sent to your email (${cleanEmail}).`
        : `Email OTP simulation mode.`;
    }

    // 2. Dispatch SMS via Fast2SMS if configured and mobile is present
    const fast2smsKey = process.env.FAST2SMS_API_KEY;
    if (
      cleanMobile &&
      fast2smsKey &&
      !fast2smsKey.includes('placeholder') &&
      fast2smsKey !== 'your_fast2sms_api_key_here'
    ) {
      try {
        const smsRes = await fetch('https://www.fast2sms.com/dev/bulkV2', {
          method: 'POST',
          headers: {
            authorization: fast2smsKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            route: 'otp',
            variables_values: code,
            numbers: cleanMobile,
          }),
        });
        const smsData = await smsRes.json();
        if (smsData && smsData.return) {
          liveDelivery = true;
          deliveryMessage = `OTP sent via SMS to +91 ${cleanMobile}.`;
        }
      } catch (smsErr) {
        console.warn('Fast2SMS dispatch error:', smsErr.message);
      }
    }

    return res.status(200).json({
      success: true,
      isNewUser: !user,
      deliveryType: isEmail ? 'email' : cleanEmail ? 'email+mobile' : 'sms',
      target: isEmail ? cleanEmail : cleanMobile,
      live: liveDelivery,
      // Only include devOtp if live delivery is NOT active, so user is required to check real email/phone
      devOtp: liveDelivery ? undefined : code,
      cooldownSeconds: 30,
      message: deliveryMessage || 'OTP dispatched successfully.',
    });
  } catch (err) {
    console.error('Send OTP error:', err);
    return res.status(500).json({
      success: false,
      error: 'Failed to dispatch OTP. Please try again.',
    });
  }
};

// 2C. OTP LOGIN & VERIFICATION
exports.otpLogin = async (req, res) => {
  try {
    const rawIdentifier = (
      req.body.identifier ||
      req.body.email ||
      req.body.mobile ||
      ''
    )
      .toString()
      .trim();
    const { otp } = req.body;
    const cleanOtp = (otp || '').toString().trim();

    if (!rawIdentifier) {
      return res.status(400).json({
        success: false,
        error: 'Please enter a valid email address or mobile number.',
      });
    }

    if (!cleanOtp) {
      return res.status(400).json({
        success: false,
        error: 'OTP code is required.',
      });
    }

    const isEmail = rawIdentifier.includes('@');
    const cleanKey = isEmail
      ? rawIdentifier.toLowerCase()
      : rawIdentifier.replace(/\D/g, '');

    // Strict validation with OtpStore (and dev '1234' bypass)
    const verification = OtpStore.verify(cleanKey, cleanOtp);
    if (!verification.valid) {
      return res.status(400).json({
        success: false,
        error: verification.error || 'Invalid OTP code.',
      });
    }

    // Look up user by email or mobile
    const user = isEmail
      ? User.findByEmail(cleanKey)
      : User.findByMobile(cleanKey);

    if (!user) {
      // Unregistered identifier -> prompt registration step
      return res.status(200).json({
        success: true,
        isNewUser: true,
        identifier: cleanKey,
        isEmail,
        message: 'Verification successful. Please complete your registration.',
      });
    }

    const safeUser = User.sanitize(user);
    const token = generateToken(user);

    return res.status(200).json({
      success: true,
      isNewUser: false,
      message: 'OTP login successful.',
      user: safeUser,
      token,
    });
  } catch (err) {
    console.error('OTP login error:', err);
    return res.status(500).json({
      success: false,
      error: 'An unexpected error occurred during OTP login.',
    });
  }
};

// 2D. RESET PASSWORD VIA OTP
exports.resetPassword = async (req, res) => {
  try {
    const rawIdentifier = (
      req.body.identifier ||
      req.body.email ||
      req.body.mobile ||
      ''
    )
      .toString()
      .trim();
    const { otp, newPassword } = req.body;
    const cleanOtp = (otp || '').toString().trim();

    if (!rawIdentifier) {
      return res.status(400).json({
        success: false,
        error: 'Please enter your registered email address or mobile number.',
      });
    }

    if (!cleanOtp) {
      return res.status(400).json({
        success: false,
        error: 'OTP code is required.',
      });
    }

    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        error: 'Password must be at least 6 characters long.',
      });
    }

    const isEmail = rawIdentifier.includes('@');
    const cleanKey = isEmail
      ? rawIdentifier.toLowerCase()
      : rawIdentifier.replace(/\D/g, '');

    const verification = OtpStore.verify(cleanKey, cleanOtp);
    if (!verification.valid) {
      return res.status(400).json({
        success: false,
        error: verification.error || 'Invalid OTP code.',
      });
    }

    const user = isEmail
      ? User.findByEmail(cleanKey)
      : User.findByMobile(cleanKey);

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'No account found with this email or mobile number.',
      });
    }

    const updatedSafeUser = await User.updatePassword(user.id, newPassword);
    const token = generateToken(user);

    return res.status(200).json({
      success: true,
      message: 'Password reset successfully. You are now logged in.',
      user: updatedSafeUser,
      token,
    });
  } catch (err) {
    console.error('Reset password error:', err);
    return res.status(500).json({
      success: false,
      error: 'Failed to reset password. Please try again.',
    });
  }
};

// 3. GET CURRENT PROFILE (PROTECTED)
exports.getMe = async (req, res) => {
  try {
    return res.status(200).json({
      success: true,
      user: req.user,
    });
  } catch (err) {
    console.error('Get profile error:', err);
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve profile.',
    });
  }
};

// 4. UPDATE CURRENT PROFILE (PROTECTED)
exports.updateProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const { fullName, name, email, gender, profileImage, themePreference } = req.body;

    const updates = {};
    if (fullName || name) updates.fullName = (fullName || name).trim();
    if (gender) updates.gender = gender;
    if (profileImage !== undefined) updates.profileImage = profileImage;

    if (themePreference !== undefined) {
      const valid = ['system', 'light', 'dark'];
      if (!valid.includes(themePreference)) {
        return res.status(400).json({
          success: false,
          error: `Invalid themePreference. Allowed values: ${valid.join(', ')}`,
        });
      }
      updates.themePreference = themePreference;
    }

    if (email) {
      const cleanEmail = email.trim().toLowerCase();
      const existing = User.findByEmail(cleanEmail);
      if (existing && existing.id !== userId) {
        return res.status(400).json({
          success: false,
          error: 'This email is already in use by another account.',
        });
      }
      updates.email = cleanEmail;
    }

    const updated = User.update(userId, updates);
    if (!updated) {
      return res.status(404).json({
        success: false,
        error: 'User not found.',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Profile updated successfully.',
      user: User.sanitize(updated),
    });
  } catch (err) {
    console.error('Update profile error:', err);
    return res.status(500).json({
      success: false,
      error: 'Failed to update profile.',
    });
  }
};

// 5. GET USER PREFERENCES (PROTECTED)
exports.getPreferences = async (req, res) => {
  try {
    const user = User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found.',
      });
    }

    return res.status(200).json({
      success: true,
      preferences: {
        themePreference: user.themePreference || 'system',
      },
    });
  } catch (err) {
    console.error('Get preferences error:', err);
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve preferences.',
    });
  }
};

// 6. UPDATE USER PREFERENCES (PROTECTED)
exports.updatePreferences = async (req, res) => {
  try {
    const { themePreference } = req.body;
    const valid = ['system', 'light', 'dark'];
    if (!themePreference || !valid.includes(themePreference)) {
      return res.status(400).json({
        success: false,
        error: `Invalid themePreference. Allowed values: ${valid.join(', ')}`,
      });
    }

    const updated = User.update(req.user.id, { themePreference });
    if (!updated) {
      return res.status(404).json({
        success: false,
        error: 'User not found.',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Theme preference saved successfully.',
      preferences: {
        themePreference: updated.themePreference || 'system',
      },
      user: User.sanitize(updated),
    });
  } catch (err) {
    console.error('Update preferences error:', err);
    return res.status(500).json({
      success: false,
      error: 'Failed to save theme preference.',
    });
  }
};

// 7. LOGOUT
exports.logout = async (req, res) => {
  try {
    const userId = req.user?.id;
    const { pushToken } = req.body || {};

    if (pushToken) {
      DeviceToken.deactivate(pushToken, userId);
    } else if (userId) {
      DeviceToken.deactivateForUser(userId);
    }
  } catch (err) {
    console.warn('Error clearing device tokens on logout:', err);
  }

  return res.status(200).json({
    success: true,
    message: 'Logged out successfully.',
  });
};

// 8. SEND SMS (Fast2SMS)
exports.sendSms = async (req, res) => {
  try {
    const { mobile, otp } = req.body;
    const cleanMobile = (mobile || '').trim().replace(/\D/g, '');
    const cleanOtp = (otp || '').toString().trim();

    if (!cleanMobile || !cleanOtp) {
      return res.status(400).json({
        success: false,
        error: 'Mobile number and OTP are required.',
      });
    }

    const fast2smsKey = process.env.FAST2SMS_API_KEY;
    if (!fast2smsKey || fast2smsKey.includes('placeholder')) {
      return res.status(200).json({
        success: true,
        smsSent: false,
        message: 'FAST2SMS_API_KEY not configured in server/.env.',
      });
    }

    const response = await fetch('https://www.fast2sms.com/dev/bulkV2', {
      method: 'POST',
      headers: {
        'authorization': fast2smsKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        route: 'otp',
        variables_values: cleanOtp,
        numbers: cleanMobile,
      }),
    });

    const result = await response.json();
    return res.status(200).json({
      success: true,
      smsSent: Boolean(result.return),
      message: result.message || 'SMS processed.',
    });
  } catch (err) {
    console.error('Error dispatching SMS via Fast2SMS:', err);
    return res.status(500).json({
      success: false,
      error: 'Failed to dispatch SMS.',
    });
  }
};
