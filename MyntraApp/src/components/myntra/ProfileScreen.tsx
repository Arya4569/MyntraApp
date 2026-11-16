import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { AddressesModal } from './AddressesModal';
import { AppearanceSetting } from './AppearanceSetting';
import { HelpCenterModal } from './HelpCenterModal';
import { NotificationSettingsSection } from './NotificationSettingsSection';
import { OrdersModal } from './OrdersModal';

import { MyntraColors, Spacing } from '@/constants/myntra-theme';
import { AVAILABLE_COUPONS } from '@/data/mock-data';
import { useTheme } from '@/hooks/use-theme';
import { storeService } from '@/services/store-service';
import { User } from '@/types/auth';

interface ProfileScreenProps {
  user: User;
  wishlistCount: number;
  bagCount: number;
  onGoToWishlist: () => void;
  onGoToBag: () => void;
  onLogout: () => Promise<void>;
  onUpdateUser: (updates: Partial<User>) => Promise<boolean>;
  onGoToHome?: () => void;
  initialShowOrders?: boolean;
  onOrdersClosed?: () => void;
}

export const ProfileScreen: React.FC<ProfileScreenProps> = ({
  user,
  wishlistCount,
  bagCount,
  onGoToWishlist,
  onGoToBag,
  onLogout,
  onUpdateUser,
  onGoToHome,
  initialShowOrders = false,
  onOrdersClosed,
}) => {
  const { colors, isDark } = useTheme();

  // Dynamic order and address counts loaded from persistent store
  const [ordersCount, setOrdersCount] = useState<number>(0);
  const [addressesCount, setAddressesCount] = useState<number>(0);
  const [isLoadingCounts, setIsLoadingCounts] = useState<boolean>(false);

  // Logout confirmation modal state
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  // Sub-screens & modals
  const [showOrders, setShowOrders] = useState(false);
  const [showAddresses, setShowAddresses] = useState(false);
  const [showHelpCenter, setShowHelpCenter] = useState(false);
  const [showPrivacyPolicy, setShowPrivacyPolicy] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const [showCoupons, setShowCoupons] = useState(false);

  // Manage Account edit modal state
  const [showManageAccount, setShowManageAccount] = useState(false);
  const [editName, setEditName] = useState(user.name);
  const [editEmail, setEditEmail] = useState(user.email || '');
  const [editGender, setEditGender] = useState<'Men' | 'Women' | 'Other'>(
    user.gender || 'Men'
  );
  const [isUpdating, setIsUpdating] = useState(false);
  const [updateError, setUpdateError] = useState<string | null>(null);

  // Mask mobile number: e.g. 9876543210 -> +91 98••••••10
  const maskedMobile = useMemo(() => {
    const raw = user.mobile.replace(/\D/g, '');
    if (raw.length === 10) {
      return `+91 ${raw.slice(0, 2)}••••••${raw.slice(8)}`;
    }
    return `+91 ${user.mobile}`;
  }, [user.mobile]);

  // Formatted Member Since date
  const memberSince = useMemo(() => {
    try {
      const d = new Date(user.createdAt);
      if (isNaN(d.getTime())) return '2026';
      return d.toLocaleDateString('en-IN', {
        month: 'short',
        year: 'numeric',
      });
    } catch {
      return '2026';
    }
  }, [user.createdAt]);

  // Load real-time order and address counts
  const loadDynamicProfileCounts = async () => {
    try {
      setIsLoadingCounts(true);
      const [userOrders, userAddresses] = await Promise.all([
        storeService.getOrders(user.id),
        storeService.getAddresses(),
      ]);
      setOrdersCount(userOrders.length);
      setAddressesCount(userAddresses.length);
    } catch (e) {
      console.warn('Failed to load dynamic profile counts:', e);
    } finally {
      setIsLoadingCounts(false);
    }
  };

  useEffect(() => {
    let isMounted = true;
    Promise.all([
      storeService.getOrders(user.id),
      storeService.getAddresses(),
    ])
      .then(([userOrders, userAddresses]) => {
        if (isMounted) {
          setOrdersCount(userOrders.length);
          setAddressesCount(userAddresses.length);
          setIsLoadingCounts(false);
        }
      })
      .catch((e) => {
        console.warn('Failed to load dynamic profile counts:', e);
        if (isMounted) setIsLoadingCounts(false);
      });

    return () => {
      isMounted = false;
    };
  }, [user.id, showOrders, showAddresses]);

  // Respond to initialShowOrders trigger from outside navigation (e.g. checkout success)
  const [prevInitialShowOrders, setPrevInitialShowOrders] = useState(initialShowOrders);
  if (initialShowOrders !== prevInitialShowOrders) {
    setPrevInitialShowOrders(initialShowOrders);
    if (initialShowOrders) {
      setShowOrders(true);
    }
  }

  // Synchronize edit inputs when user changes
  const [prevUser, setPrevUser] = useState(user);
  if (user !== prevUser) {
    setPrevUser(user);
    setEditName(user.name);
    setEditEmail(user.email || '');
    setEditGender(user.gender || 'Men');
  }

  const handleConfirmLogout = async () => {
    setIsLoggingOut(true);
    try {
      await onLogout();
      setShowLogoutConfirm(false);
    } finally {
      setIsLoggingOut(false);
    }
  };

  const handleOpenEditProfile = () => {
    setEditName(user.name);
    setEditEmail(user.email || '');
    setEditGender(user.gender || 'Men');
    setUpdateError(null);
    setShowManageAccount(true);
  };

  const handleSaveAccount = async () => {
    const trimmedName = editName.trim();
    const trimmedEmail = editEmail.trim();

    if (!trimmedName || trimmedName.length < 2) {
      setUpdateError('Full name must be at least 2 characters.');
      return;
    }
    if (
      trimmedEmail &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)
    ) {
      setUpdateError('Please enter a valid email address.');
      return;
    }

    setIsUpdating(true);
    setUpdateError(null);
    try {
      const ok = await onUpdateUser({
        name: trimmedName,
        email: trimmedEmail || undefined,
        gender: editGender,
      });
      if (ok) {
        setShowManageAccount(false);
      } else {
        setUpdateError('Failed to update account. Please try again.');
      }
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}>
      {/* 1. Profile Header Banner */}
      <View style={styles.profileHeader}>
        <View style={styles.avatarCircle}>
          <Text style={styles.avatarText}>
            {user.name ? user.name.charAt(0).toUpperCase() : 'M'}
          </Text>
        </View>

        <View style={styles.profileInfo}>
          <View style={styles.nameRow}>
            <Text style={styles.userName} numberOfLines={1}>
              {user.name}
            </Text>
            <TouchableOpacity
              onPress={handleOpenEditProfile}
              style={styles.editBtn}
              activeOpacity={0.7}>
              <Ionicons name="pencil" size={13} color={MyntraColors.primary} />
              <Text style={styles.editBtnText}>EDIT</Text>
            </TouchableOpacity>
          </View>

          {/* Verified Phone */}
          <View style={styles.verifiedRow}>
            <Text style={styles.userMobile}>{maskedMobile}</Text>
            <View style={styles.verifiedBadge}>
              <Ionicons name="checkmark-circle" size={12} color="#10b981" />
              <Text style={styles.verifiedText}>Verified</Text>
            </View>
          </View>

          {/* User Email */}
          <Text style={styles.userEmail} numberOfLines={1}>
            {user.email || 'No email linked • Tap Edit to add'}
          </Text>

          {/* Insider Tier & Member Since Strip */}
          <View style={styles.metaRow}>
            <View style={styles.insiderBadge}>
              <Ionicons name="sparkles" size={11} color={MyntraColors.primary} />
              <Text style={styles.insiderText}>INSIDER • SELECT</Text>
            </View>
            <Text style={styles.memberSinceText}>
              Member since {memberSince}
            </Text>
          </View>
        </View>
      </View>

      {/* 2. Rewards & Dynamic Stats Strip */}
      <View style={styles.statsBar}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{user.insiderPoints}</Text>
          <Text style={styles.statLabel}>Insider Points</Text>
        </View>

        <View style={styles.statDivider} />

        <TouchableOpacity
          style={styles.statItem}
          onPress={() => setShowOrders(true)}
          activeOpacity={0.7}>
          {isLoadingCounts ? (
            <ActivityIndicator size="small" color={MyntraColors.primary} />
          ) : (
            <Text style={styles.statValue}>{ordersCount}</Text>
          )}
          <Text style={styles.statLabel}>My Orders</Text>
        </TouchableOpacity>

        <View style={styles.statDivider} />

        <TouchableOpacity
          style={styles.statItem}
          onPress={onGoToWishlist}
          activeOpacity={0.7}>
          <Text style={styles.statValue}>{wishlistCount}</Text>
          <Text style={styles.statLabel}>Wishlist</Text>
        </TouchableOpacity>

        <View style={styles.statDivider} />

        <TouchableOpacity
          style={styles.statItem}
          onPress={onGoToBag}
          activeOpacity={0.7}>
          <Text style={styles.statValue}>{bagCount}</Text>
          <Text style={styles.statLabel}>Shopping Bag</Text>
        </TouchableOpacity>
      </View>

      {/* 3. Section: MY ORDERS & ACTIVITY */}
      <View style={styles.sectionCard}>
        <Text style={styles.sectionHeaderTitle}>MY ORDERS & ACTIVITY</Text>

        {/* My Orders */}
        <TouchableOpacity
          onPress={() => setShowOrders(true)}
          style={styles.menuRow}
          activeOpacity={0.7}>
          <View style={styles.menuIconContainer}>
            <Ionicons name="cube-outline" size={20} color={MyntraColors.text} />
          </View>
          <View style={styles.menuTextContainer}>
            <Text style={styles.menuTitle}>My Orders</Text>
            <Text style={styles.menuSubtitle}>
              Check status, delivery milestone & track packages
            </Text>
          </View>
          {ordersCount > 0 && (
            <View style={styles.menuCountBadge}>
              <Text style={styles.menuCountText}>{ordersCount}</Text>
            </View>
          )}
          <Ionicons
            name="chevron-forward"
            size={18}
            color={MyntraColors.textMuted}
          />
        </TouchableOpacity>

        {/* Wishlist */}
        <TouchableOpacity
          onPress={onGoToWishlist}
          style={styles.menuRow}
          activeOpacity={0.7}>
          <View style={styles.menuIconContainer}>
            <Ionicons name="heart-outline" size={20} color={MyntraColors.text} />
          </View>
          <View style={styles.menuTextContainer}>
            <Text style={styles.menuTitle}>Wishlist</Text>
            <Text style={styles.menuSubtitle}>
              Your shortlisted favorite fashion items
            </Text>
          </View>
          {wishlistCount > 0 && (
            <View style={styles.menuCountBadge}>
              <Text style={styles.menuCountText}>{wishlistCount}</Text>
            </View>
          )}
          <Ionicons
            name="chevron-forward"
            size={18}
            color={MyntraColors.textMuted}
          />
        </TouchableOpacity>

        {/* Shopping Bag */}
        <TouchableOpacity
          onPress={onGoToBag}
          style={styles.menuRow}
          activeOpacity={0.7}>
          <View style={styles.menuIconContainer}>
            <Ionicons
              name="bag-handle-outline"
              size={20}
              color={MyntraColors.text}
            />
          </View>
          <View style={styles.menuTextContainer}>
            <Text style={styles.menuTitle}>Shopping Bag</Text>
            <Text style={styles.menuSubtitle}>
              Items saved and ready for checkout
            </Text>
          </View>
          {bagCount > 0 && (
            <View style={styles.menuCountBadge}>
              <Text style={styles.menuCountText}>{bagCount}</Text>
            </View>
          )}
          <Ionicons
            name="chevron-forward"
            size={18}
            color={MyntraColors.textMuted}
          />
        </TouchableOpacity>
      </View>

      {/* 4. Section: ACCOUNT & ADDRESSES */}
      <View style={styles.sectionCard}>
        <Text style={styles.sectionHeaderTitle}>ACCOUNT SETTINGS</Text>

        {/* Manage Personal Information */}
        <TouchableOpacity
          onPress={handleOpenEditProfile}
          style={styles.menuRow}
          activeOpacity={0.7}>
          <View style={styles.menuIconContainer}>
            <Ionicons
              name="person-circle-outline"
              size={20}
              color={MyntraColors.text}
            />
          </View>
          <View style={styles.menuTextContainer}>
            <Text style={styles.menuTitle}>Edit Personal Information</Text>
            <Text style={styles.menuSubtitle}>
              Update full name, email address & gender
            </Text>
          </View>
          <Ionicons
            name="chevron-forward"
            size={18}
            color={MyntraColors.textMuted}
          />
        </TouchableOpacity>

        {/* Saved Delivery Addresses */}
        <TouchableOpacity
          onPress={() => setShowAddresses(true)}
          style={styles.menuRow}
          activeOpacity={0.7}>
          <View style={styles.menuIconContainer}>
            <Ionicons
              name="location-outline"
              size={20}
              color={MyntraColors.text}
            />
          </View>
          <View style={styles.menuTextContainer}>
            <Text style={styles.menuTitle}>Saved Addresses</Text>
            <Text style={styles.menuSubtitle}>
              Home, office & alternate delivery destinations
            </Text>
          </View>
          {addressesCount > 0 && (
            <View style={styles.neutralCountBadge}>
              <Text style={styles.neutralCountText}>{addressesCount}</Text>
            </View>
          )}
          <Ionicons
            name="chevron-forward"
            size={18}
            color={MyntraColors.textMuted}
          />
        </TouchableOpacity>

        {/* Coupons & Offers */}
        <TouchableOpacity
          onPress={() => setShowCoupons(true)}
          style={styles.menuRow}
          activeOpacity={0.7}>
          <View style={styles.menuIconContainer}>
            <Ionicons
              name="pricetag-outline"
              size={20}
              color={MyntraColors.text}
            />
          </View>
          <View style={styles.menuTextContainer}>
            <Text style={styles.menuTitle}>Coupons & Offers</Text>
            <Text style={styles.menuSubtitle}>
              {AVAILABLE_COUPONS.length} active discount vouchers available
            </Text>
          </View>
          <View style={styles.menuCountBadge}>
            <Text style={styles.menuCountText}>
              {AVAILABLE_COUPONS.length} OFFERS
            </Text>
          </View>
          <Ionicons
            name="chevron-forward"
            size={18}
            color={MyntraColors.textMuted}
          />
        </TouchableOpacity>
      </View>

      {/* 5. Section: APPEARANCE & THEME */}
      <AppearanceSetting />

      {/* 5B. Section: NOTIFICATION PREFERENCES */}
      <NotificationSettingsSection userId={user.id} />

      {/* 6. Section: SUPPORT & LEGAL */}
      <View style={styles.sectionCard}>
        <Text style={styles.sectionHeaderTitle}>SUPPORT & LEGAL</Text>

        {/* Help Center */}
        <TouchableOpacity
          onPress={() => setShowHelpCenter(true)}
          style={styles.menuRow}
          activeOpacity={0.7}>
          <View style={styles.menuIconContainer}>
            <Ionicons
              name="help-buoy-outline"
              size={20}
              color={MyntraColors.text}
            />
          </View>
          <View style={styles.menuTextContainer}>
            <Text style={styles.menuTitle}>Help & Support</Text>
            <Text style={styles.menuSubtitle}>
              24x7 FAQs, returns, refunds & customer queries
            </Text>
          </View>
          <Ionicons
            name="chevron-forward"
            size={18}
            color={MyntraColors.textMuted}
          />
        </TouchableOpacity>

        {/* Terms of Use */}
        <TouchableOpacity
          onPress={() => setShowTerms(true)}
          style={styles.menuRow}
          activeOpacity={0.7}>
          <View style={styles.menuIconContainer}>
            <Ionicons
              name="document-text-outline"
              size={20}
              color={MyntraColors.text}
            />
          </View>
          <View style={styles.menuTextContainer}>
            <Text style={styles.menuTitle}>Terms of Use</Text>
            <Text style={styles.menuSubtitle}>
              Service conditions, return window & shopping rules
            </Text>
          </View>
          <Ionicons
            name="chevron-forward"
            size={18}
            color={MyntraColors.textMuted}
          />
        </TouchableOpacity>

        {/* Privacy Policy */}
        <TouchableOpacity
          onPress={() => setShowPrivacyPolicy(true)}
          style={styles.menuRow}
          activeOpacity={0.7}>
          <View style={styles.menuIconContainer}>
            <Ionicons
              name="shield-checkmark-outline"
              size={20}
              color={MyntraColors.text}
            />
          </View>
          <View style={styles.menuTextContainer}>
            <Text style={styles.menuTitle}>Privacy Policy & Security</Text>
            <Text style={styles.menuSubtitle}>
              How we protect your profile data and payment credentials
            </Text>
          </View>
          <Ionicons
            name="chevron-forward"
            size={18}
            color={MyntraColors.textMuted}
          />
        </TouchableOpacity>
      </View>

      {/* 6. LOGOUT BUTTON */}
      <View style={styles.logoutContainer}>
        <TouchableOpacity
          onPress={() => setShowLogoutConfirm(true)}
          style={styles.logoutButton}
          activeOpacity={0.75}>
          <Ionicons name="log-out-outline" size={20} color="#e53935" />
          <Text style={styles.logoutButtonText}>LOG OUT OF ACCOUNT</Text>
        </TouchableOpacity>
        <Text style={styles.versionText}>Myntra Fashion App • Version 2.4.0</Text>
      </View>

      {/* MODAL 1: Logout Confirmation Dialog */}
      <Modal
        visible={showLogoutConfirm}
        transparent
        animationType="fade"
        onRequestClose={() => setShowLogoutConfirm(false)}>
        <View style={styles.dialogOverlay}>
          <View style={styles.dialogCard}>
            <View style={styles.dialogIconCircle}>
              <Ionicons name="log-out" size={26} color="#e53935" />
            </View>

            <Text style={styles.dialogTitle}>Log Out of Myntra?</Text>
            <Text style={styles.dialogMessage}>
              Are you sure you want to log out? Your current session will be
              closed and you will return to the guest shopping state.
            </Text>

            <View style={styles.dialogActionsRow}>
              <TouchableOpacity
                onPress={() => setShowLogoutConfirm(false)}
                disabled={isLoggingOut}
                style={styles.dialogCancelBtn}
                activeOpacity={0.8}>
                <Text style={styles.dialogCancelText}>CANCEL</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleConfirmLogout}
                disabled={isLoggingOut}
                style={styles.dialogLogoutBtn}
                activeOpacity={0.8}>
                {isLoggingOut ? (
                  <ActivityIndicator color={MyntraColors.white} size="small" />
                ) : (
                  <Text style={styles.dialogLogoutText}>LOG OUT</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* MODAL 2: Manage Account & Edit Profile */}
      <Modal
        visible={showManageAccount}
        transparent
        animationType="slide"
        onRequestClose={() => setShowManageAccount(false)}>
        <View style={styles.dialogOverlay}>
          <View style={styles.manageCard}>
            <View style={styles.manageHeader}>
              <View>
                <Text style={styles.manageTitle}>Edit Profile</Text>
                <Text style={styles.manageSubtitle}>
                  Update personal details and shopping preferences
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setShowManageAccount(false)}
                style={styles.manageCloseBtn}
                activeOpacity={0.7}>
                <Ionicons name="close" size={22} color={MyntraColors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.manageBody} showsVerticalScrollIndicator={false}>
              {/* Registered Mobile (Read-only for security) */}
              <View style={styles.manageGroup}>
                <Text style={styles.manageLabel}>Registered Mobile Number</Text>
                <View style={styles.disabledInput}>
                  <Text style={styles.disabledInputText}>+91 {user.mobile}</Text>
                  <View style={styles.lockBadge}>
                    <Ionicons
                      name="lock-closed"
                      size={12}
                      color={MyntraColors.textMuted}
                    />
                    <Text style={styles.lockBadgeText}>Verified & Secured</Text>
                  </View>
                </View>
              </View>

              {/* Full Name */}
              <View style={styles.manageGroup}>
                <Text style={styles.manageLabel}>
                  Full Name <Text style={styles.requiredStar}>*</Text>
                </Text>
                <TextInput
                  style={styles.manageInput}
                  value={editName}
                  onChangeText={setEditName}
                  placeholder="Enter full name"
                  placeholderTextColor={MyntraColors.textMuted}
                />
              </View>

              {/* Email Address */}
              <View style={styles.manageGroup}>
                <Text style={styles.manageLabel}>Email Address</Text>
                <TextInput
                  style={styles.manageInput}
                  value={editEmail}
                  onChangeText={setEditEmail}
                  placeholder="name@example.com"
                  placeholderTextColor={MyntraColors.textMuted}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              </View>

              {/* Gender Selector */}
              <View style={styles.manageGroup}>
                <Text style={styles.manageLabel}>Gender</Text>
                <View style={styles.genderRow}>
                  {(['Men', 'Women', 'Other'] as const).map((g) => {
                    const isSelected = editGender === g;
                    return (
                      <TouchableOpacity
                        key={g}
                        onPress={() => setEditGender(g)}
                        style={[
                          styles.genderPill,
                          isSelected && styles.genderPillActive,
                        ]}
                        activeOpacity={0.7}>
                        <Text
                          style={[
                            styles.genderText,
                            isSelected && styles.genderTextActive,
                          ]}>
                          {g}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {updateError && (
                <View style={styles.errorBanner}>
                  <Ionicons name="alert-circle" size={16} color="#e53935" />
                  <Text style={styles.manageErrorText}>{updateError}</Text>
                </View>
              )}

              {/* Save Button */}
              <TouchableOpacity
                onPress={handleSaveAccount}
                disabled={isUpdating}
                style={styles.saveAccountBtn}
                activeOpacity={0.85}>
                {isUpdating ? (
                  <ActivityIndicator color={MyntraColors.white} size="small" />
                ) : (
                  <Text style={styles.saveAccountText}>SAVE CHANGES</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* MODAL 3: Real Orders Viewer */}
      <OrdersModal
        visible={showOrders}
        onClose={() => {
          setShowOrders(false);
          onOrdersClosed?.();
          loadDynamicProfileCounts();
        }}
        onStartShopping={onGoToHome || onGoToWishlist}
        onViewBag={onGoToBag}
        userId={user.id}
      />

      {/* MODAL 4: Saved Delivery Addresses */}
      <AddressesModal
        visible={showAddresses}
        onClose={() => {
          setShowAddresses(false);
          loadDynamicProfileCounts();
        }}
      />

      {/* MODAL 5: Help Center & FAQs */}
      <HelpCenterModal
        visible={showHelpCenter}
        onClose={() => setShowHelpCenter(false)}
      />

      {/* MODAL 6: Coupons & Offers Drawer */}
      {showCoupons && (
        <Modal
          visible={showCoupons}
          animationType="slide"
          transparent
          onRequestClose={() => setShowCoupons(false)}>
          <View style={styles.dialogOverlay}>
            <View style={styles.manageCard}>
              <View style={styles.manageHeader}>
                <View>
                  <Text style={styles.manageTitle}>Available Coupons</Text>
                  <Text style={styles.manageSubtitle}>
                    Apply at checkout for extra savings
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => setShowCoupons(false)}
                  style={styles.manageCloseBtn}
                  activeOpacity={0.7}>
                  <Ionicons name="close" size={22} color={MyntraColors.text} />
                </TouchableOpacity>
              </View>

              <ScrollView
                style={{ maxHeight: 400, padding: 16 }}
                showsVerticalScrollIndicator={false}>
                {AVAILABLE_COUPONS.map((coupon) => (
                  <View key={coupon.code} style={styles.couponCard}>
                    <View style={styles.couponHeader}>
                      <View style={styles.couponCodeBadge}>
                        <Text style={styles.couponCodeText}>{coupon.code}</Text>
                      </View>
                      <Text style={styles.couponDiscountText}>
                        {coupon.discountType === 'flat'
                          ? `FLAT ₹${coupon.discountValue} OFF`
                          : `${coupon.discountValue}% OFF`}
                      </Text>
                    </View>
                    <Text style={styles.couponTitle}>{coupon.title}</Text>
                    <Text style={styles.couponDesc}>{coupon.description}</Text>
                    <Text style={styles.couponMinOrder}>
                      Minimum order: ₹{coupon.minOrder}
                    </Text>
                  </View>
                ))}
              </ScrollView>

              <TouchableOpacity
                onPress={() => {
                  setShowCoupons(false);
                  onGoToBag();
                }}
                style={[styles.saveAccountBtn, { margin: 16, marginTop: 4 }]}>
                <Text style={styles.saveAccountText}>VIEW IN SHOPPING BAG</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}

      {/* MODAL 7: Terms of Use */}
      {showTerms && (
        <Modal
          visible={showTerms}
          animationType="slide"
          transparent
          onRequestClose={() => setShowTerms(false)}>
          <View style={styles.dialogOverlay}>
            <View style={styles.manageCard}>
              <View style={styles.manageHeader}>
                <Text style={styles.manageTitle}>Terms of Use</Text>
                <TouchableOpacity onPress={() => setShowTerms(false)}>
                  <Ionicons name="close" size={22} color={MyntraColors.text} />
                </TouchableOpacity>
              </View>
              <ScrollView style={{ maxHeight: 340, padding: 18 }}>
                <Text style={styles.legalBodyText}>
                  Welcome to Myntra. By browsing and purchasing through this
                  application, you agree to adhere to our standard customer
                  terms and conditions. All apparel, footwear, and accessory
                  purchases are backed by our genuine 14-day hassle-free return
                  and exchange policy.
                </Text>
                <Text style={[styles.legalBodyText, { marginTop: 12 }]}>
                  Promotional coupons and discounts are subject to valid minimum
                  order thresholds and cannot be transferred or redeemed for
                  cash. Delivery timelines are estimates calculated by our
                  logistics partners.
                </Text>
              </ScrollView>
              <TouchableOpacity
                onPress={() => setShowTerms(false)}
                style={[styles.saveAccountBtn, { margin: 16, marginTop: 4 }]}>
                <Text style={styles.saveAccountText}>I UNDERSTAND</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}

      {/* MODAL 8: Privacy Policy */}
      {showPrivacyPolicy && (
        <Modal
          visible={showPrivacyPolicy}
          animationType="slide"
          transparent
          onRequestClose={() => setShowPrivacyPolicy(false)}>
          <View style={styles.dialogOverlay}>
            <View style={styles.manageCard}>
              <View style={styles.manageHeader}>
                <Text style={styles.manageTitle}>Privacy Policy & Security</Text>
                <TouchableOpacity onPress={() => setShowPrivacyPolicy(false)}>
                  <Ionicons name="close" size={22} color={MyntraColors.text} />
                </TouchableOpacity>
              </View>
              <ScrollView style={{ maxHeight: 340, padding: 18 }}>
                <Text style={styles.legalBodyText}>
                  We prioritize your privacy and account security. Your personal
                  contact info, delivery addresses, order history, and wishlist
                  preferences are stored securely in local encrypted storage. We
                  never share or sell personal customer information to third
                  parties.
                </Text>
                <Text style={[styles.legalBodyText, { marginTop: 12 }]}>
                  Payment transactions are executed through PCI-DSS certified
                  gateways. Raw debit/credit card numbers and CVV codes are never
                  retained on application servers.
                </Text>
              </ScrollView>
              <TouchableOpacity
                onPress={() => setShowPrivacyPolicy(false)}
                style={[styles.saveAccountBtn, { margin: 16, marginTop: 4 }]}>
                <Text style={styles.saveAccountText}>I UNDERSTAND</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f6',
  },
  scrollContent: {
    paddingBottom: 110,
  },
  profileHeader: {
    flexDirection: 'row',
    padding: Spacing.lg,
    backgroundColor: '#fff0f3',
    borderBottomWidth: 1,
    borderBottomColor: '#fbe2e8',
    gap: 14,
    alignItems: 'center',
  },
  avatarCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: MyntraColors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: MyntraColors.primary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  avatarText: {
    fontSize: 28,
    fontWeight: '800',
    color: MyntraColors.white,
  },
  profileInfo: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  userName: {
    fontSize: 18,
    fontWeight: '800',
    color: MyntraColors.text,
    flex: 1,
  },
  editBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: MyntraColors.white,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#ffc1cf',
  },
  editBtnText: {
    fontSize: 10,
    fontWeight: '800',
    color: MyntraColors.primary,
    letterSpacing: 0.5,
  },
  verifiedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 3,
  },
  userMobile: {
    fontSize: 12,
    color: MyntraColors.textSecondary,
    fontWeight: '600',
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: '#e6f9f0',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 8,
  },
  verifiedText: {
    fontSize: 9.5,
    fontWeight: '700',
    color: '#059669',
  },
  userEmail: {
    fontSize: 11,
    color: MyntraColors.textMuted,
    marginTop: 2,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 6,
  },
  insiderBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: MyntraColors.white,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 10,
    borderWidth: 0.5,
    borderColor: '#ffc1cf',
  },
  insiderText: {
    fontSize: 8.5,
    fontWeight: '800',
    color: MyntraColors.primary,
    letterSpacing: 0.4,
  },
  memberSinceText: {
    fontSize: 10,
    color: MyntraColors.textMuted,
  },
  statsBar: {
    flexDirection: 'row',
    backgroundColor: MyntraColors.white,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#ebebee',
    marginBottom: 8,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statValue: {
    fontSize: 15,
    fontWeight: '800',
    color: MyntraColors.primary,
  },
  statLabel: {
    fontSize: 10.5,
    color: MyntraColors.textSecondary,
    marginTop: 2,
    fontWeight: '600',
  },
  statDivider: {
    width: 1,
    height: '60%',
    backgroundColor: '#ebebee',
    alignSelf: 'center',
  },
  sectionCard: {
    backgroundColor: MyntraColors.white,
    paddingHorizontal: Spacing.lg,
    paddingTop: 14,
    paddingBottom: 4,
    marginBottom: 8,
  },
  sectionHeaderTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: MyntraColors.textMuted,
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: '#f2f2f4',
  },
  menuIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: MyntraColors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  menuTextContainer: {
    flex: 1,
  },
  menuTitle: {
    fontSize: 13.5,
    fontWeight: '700',
    color: MyntraColors.text,
  },
  menuSubtitle: {
    fontSize: 11,
    color: MyntraColors.textSecondary,
    marginTop: 2,
  },
  menuCountBadge: {
    backgroundColor: MyntraColors.primary,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 10,
    marginRight: 6,
  },
  menuCountText: {
    color: MyntraColors.white,
    fontSize: 10,
    fontWeight: '800',
  },
  neutralCountBadge: {
    backgroundColor: '#e8e8eb',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 10,
    marginRight: 6,
  },
  neutralCountText: {
    color: MyntraColors.text,
    fontSize: 10,
    fontWeight: '700',
  },
  logoutContainer: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: 16,
    alignItems: 'center',
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    width: '100%',
    height: 48,
    backgroundColor: MyntraColors.white,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#ffcdd2',
  },
  logoutButtonText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#e53935',
    letterSpacing: 0.5,
  },
  versionText: {
    fontSize: 11,
    color: MyntraColors.textMuted,
    marginTop: 12,
  },
  dialogOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  dialogCard: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: MyntraColors.white,
    borderRadius: 14,
    padding: 24,
    alignItems: 'center',
  },
  dialogIconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#ffebee',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  dialogTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: MyntraColors.text,
    textAlign: 'center',
  },
  dialogMessage: {
    fontSize: 12.5,
    color: MyntraColors.textSecondary,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 18,
  },
  dialogActionsRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 22,
    width: '100%',
  },
  dialogCancelBtn: {
    flex: 1,
    height: 44,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: '#d4d5d9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dialogCancelText: {
    fontSize: 13,
    fontWeight: '700',
    color: MyntraColors.text,
  },
  dialogLogoutBtn: {
    flex: 1,
    height: 44,
    borderRadius: 6,
    backgroundColor: '#e53935',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dialogLogoutText: {
    fontSize: 13,
    fontWeight: '800',
    color: MyntraColors.white,
    letterSpacing: 0.5,
  },
  manageCard: {
    width: '100%',
    maxWidth: 440,
    backgroundColor: MyntraColors.white,
    borderRadius: 14,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 8,
  },
  manageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f3',
  },
  manageTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: MyntraColors.text,
  },
  manageSubtitle: {
    fontSize: 11,
    color: MyntraColors.textSecondary,
    marginTop: 2,
  },
  manageCloseBtn: {
    padding: 4,
  },
  manageBody: {
    padding: 18,
    maxHeight: 460,
  },
  manageGroup: {
    marginBottom: 14,
  },
  manageLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: MyntraColors.textSecondary,
    marginBottom: 5,
    textTransform: 'uppercase',
  },
  requiredStar: {
    color: '#e53935',
  },
  disabledInput: {
    height: 44,
    backgroundColor: '#f5f5f6',
    borderRadius: 6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#e8e8ea',
  },
  disabledInputText: {
    fontSize: 13,
    fontWeight: '600',
    color: MyntraColors.textSecondary,
  },
  lockBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  lockBadgeText: {
    fontSize: 10,
    color: MyntraColors.textMuted,
    fontWeight: '600',
  },
  manageInput: {
    height: 44,
    borderWidth: 1.5,
    borderColor: '#d4d5d9',
    borderRadius: 6,
    paddingHorizontal: 12,
    fontSize: 14,
    color: MyntraColors.text,
  },
  genderRow: {
    flexDirection: 'row',
    gap: 10,
  },
  genderPill: {
    flex: 1,
    height: 40,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: '#d4d5d9',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: MyntraColors.white,
  },
  genderPillActive: {
    borderColor: MyntraColors.primary,
    backgroundColor: '#fff0f3',
  },
  genderText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: MyntraColors.textSecondary,
  },
  genderTextActive: {
    color: MyntraColors.primary,
    fontWeight: '800',
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#ffebee',
    padding: 10,
    borderRadius: 6,
    marginBottom: 10,
  },
  manageErrorText: {
    color: '#e53935',
    fontSize: 11.5,
    flex: 1,
    fontWeight: '600',
  },
  saveAccountBtn: {
    backgroundColor: MyntraColors.primary,
    height: 46,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  saveAccountText: {
    color: MyntraColors.white,
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  couponCard: {
    backgroundColor: '#fbfbfb',
    borderWidth: 1,
    borderColor: '#ebebee',
    borderRadius: 8,
    padding: 12,
    marginBottom: 10,
  },
  couponHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  couponCodeBadge: {
    backgroundColor: '#fff0f3',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#ffc1cf',
    borderStyle: 'dashed',
  },
  couponCodeText: {
    fontSize: 12,
    fontWeight: '800',
    color: MyntraColors.primary,
    letterSpacing: 0.8,
  },
  couponDiscountText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#059669',
  },
  couponTitle: {
    fontSize: 12.5,
    fontWeight: '700',
    color: MyntraColors.text,
    marginTop: 4,
  },
  couponDesc: {
    fontSize: 11,
    color: MyntraColors.textSecondary,
    marginTop: 2,
  },
  couponMinOrder: {
    fontSize: 10,
    color: MyntraColors.textMuted,
    marginTop: 4,
    fontStyle: 'italic',
  },
  legalBodyText: {
    fontSize: 12,
    color: '#555',
    lineHeight: 18,
  },
});
