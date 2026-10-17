const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { JWT_SECRET } = require('../middleware/auth');

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

    if (!actualMobile || !/^[6-9]\d{9}$/.test(actualMobile)) {
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

    const existingByMobile = User.findByMobile(actualMobile);
    if (existingByMobile) {
      return res.status(400).json({
        success: false,
        error: 'An account with this mobile number already exists. Please log in.',
      });
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
    const { fullName, name, email, gender, profileImage } = req.body;

    const updates = {};
    if (fullName || name) updates.fullName = (fullName || name).trim();
    if (gender) updates.gender = gender;
    if (profileImage !== undefined) updates.profileImage = profileImage;

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

// 5. LOGOUT
exports.logout = async (req, res) => {
  return res.status(200).json({
    success: true,
    message: 'Logged out successfully.',
  });
};
