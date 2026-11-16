import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { MyntraColors, Spacing } from '@/constants/myntra-theme';
import { useAuth } from '@/context/AuthContext';
import { storeService } from '@/services/store-service';
import { DeliveryAddress } from '@/types/store';

interface AddressesModalProps {
  visible: boolean;
  onClose: () => void;
}

export const AddressesModal: React.FC<AddressesModalProps> = ({
  visible,
  onClose,
}) => {
  const { user } = useAuth();
  const [addresses, setAddresses] = useState<DeliveryAddress[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);

  // Form Fields
  const [name, setName] = useState('');
  const [mobile, setMobile] = useState('');
  const [pincode, setPincode] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [addressType, setAddressType] = useState<'Home' | 'Work'>('Home');
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    if (visible) {
      storeService
        .getAddresses()
        .then((list) => {
          if (isMounted) {
            setAddresses(list);
            setShowAddForm(false);
            setFormError(null);
            setLoading(false);
          }
        })
        .catch(() => {
          if (isMounted) {
            setAddresses([]);
            setShowAddForm(false);
            setFormError(null);
            setLoading(false);
          }
        });
    }
    return () => {
      isMounted = false;
    };
  }, [visible, user?.id]);

  const handleSave = async () => {
    if (!name.trim() || !mobile.trim() || !pincode.trim() || !address.trim()) {
      setFormError('Please enter all required fields.');
      return;
    }
    if (mobile.replace(/\D/g, '').length !== 10) {
      setFormError('Mobile number must be 10 digits.');
      return;
    }
    if (pincode.replace(/\D/g, '').length !== 6) {
      setFormError('PIN code must be 6 digits.');
      return;
    }

    const newAddr: DeliveryAddress = {
      id: `addr-${Date.now()}`,
      name: name.trim(),
      mobile: mobile.trim(),
      pincode: pincode.trim(),
      address: address.trim(),
      city: city.trim() || 'Mumbai',
      state: state.trim() || 'Maharashtra',
      addressType,
      isDefault: addresses.length === 0,
    };

    const updated = await storeService.saveAddress(newAddr);
    setAddresses(updated);
    setShowAddForm(false);
    setFormError(null);
    setName('');
    setMobile('');
    setPincode('');
    setAddress('');
    setCity('');
    setState('');
  };

  const handleDelete = async (id: string) => {
    const updated = await storeService.deleteAddress(id);
    setAddresses(updated);
  };

  const handleSetDefault = async (id: string) => {
    const updated = await storeService.setDefaultAddress(id);
    setAddresses(updated);
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheetContainer}>
          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={styles.headerTitle}>SAVED ADDRESSES</Text>
              <Text style={styles.headerSub}>{addresses.length} Addresses available</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={22} color={MyntraColors.text} />
            </TouchableOpacity>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}>
            {!showAddForm && (
              <TouchableOpacity
                onPress={() => setShowAddForm(true)}
                style={styles.addNewBtn}
                activeOpacity={0.8}>
                <Ionicons name="add-circle-outline" size={18} color={MyntraColors.primary} />
                <Text style={styles.addNewBtnText}>+ ADD NEW ADDRESS</Text>
              </TouchableOpacity>
            )}

            {loading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="small" color={MyntraColors.primary} />
                <Text style={styles.loadingText}>Fetching saved addresses...</Text>
              </View>
            ) : showAddForm ? (
              <View style={styles.formContainer}>
                <Text style={styles.formTitle}>Add New Delivery Address</Text>
                {formError && <Text style={styles.errorText}>{formError}</Text>}

                <TextInput
                  style={styles.input}
                  placeholder="Full Name *"
                  value={name}
                  onChangeText={setName}
                />
                <TextInput
                  style={styles.input}
                  placeholder="10-Digit Mobile Number *"
                  keyboardType="phone-pad"
                  maxLength={10}
                  value={mobile}
                  onChangeText={setMobile}
                />
                <TextInput
                  style={styles.input}
                  placeholder="6-Digit PIN Code *"
                  keyboardType="number-pad"
                  maxLength={6}
                  value={pincode}
                  onChangeText={setPincode}
                />
                <TextInput
                  style={[styles.input, styles.inputArea]}
                  placeholder="House No., Building, Street Address *"
                  multiline
                  value={address}
                  onChangeText={setAddress}
                />
                <View style={styles.rowTwo}>
                  <TextInput
                    style={[styles.input, styles.halfInput]}
                    placeholder="City"
                    value={city}
                    onChangeText={setCity}
                  />
                  <TextInput
                    style={[styles.input, styles.halfInput]}
                    placeholder="State"
                    value={state}
                    onChangeText={setState}
                  />
                </View>

                <View style={styles.typeRow}>
                  {(['Home', 'Work'] as const).map((t) => (
                    <TouchableOpacity
                      key={t}
                      onPress={() => setAddressType(t)}
                      style={[
                        styles.typePill,
                        addressType === t && styles.typePillActive,
                      ]}>
                      <Text
                        style={[
                          styles.typeText,
                          addressType === t && styles.typeTextActive,
                        ]}>
                        {t}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <View style={styles.formActionsRow}>
                  <TouchableOpacity
                    onPress={() => setShowAddForm(false)}
                    style={styles.cancelBtn}>
                    <Text style={styles.cancelBtnText}>CANCEL</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={handleSave} style={styles.saveBtn}>
                    <Text style={styles.saveBtnText}>SAVE ADDRESS</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : addresses.length === 0 ? (
              <View style={styles.emptyContainer}>
                <View style={styles.emptyIconCircle}>
                  <Ionicons name="location-outline" size={38} color={MyntraColors.primary} />
                </View>
                <Text style={styles.emptyTitle}>NO SAVED ADDRESSES YET</Text>
                <Text style={styles.emptySubtitle}>
                  Save your home or work delivery address for faster, one-click checkout.
                </Text>
                <TouchableOpacity
                  onPress={() => setShowAddForm(true)}
                  style={styles.emptyAddBtn}
                  activeOpacity={0.85}>
                  <Ionicons name="add" size={18} color="#fff" />
                  <Text style={styles.emptyAddBtnText}>ADD FIRST ADDRESS</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.addressesList}>
                {addresses.map((addr) => (
                  <View key={addr.id} style={styles.addressCard}>
                    <View style={styles.cardHeader}>
                      <View style={styles.cardTitleWrap}>
                        <Text style={styles.addrName}>{addr.name}</Text>
                        <View style={styles.typeBadge}>
                          <Text style={styles.typeBadgeText}>
                            {addr.addressType.toUpperCase()}
                          </Text>
                        </View>
                        {addr.isDefault && (
                          <View style={styles.defaultBadge}>
                            <Text style={styles.defaultBadgeText}>DEFAULT</Text>
                          </View>
                        )}
                      </View>

                      {addresses.length > 1 && (
                        <TouchableOpacity
                          onPress={() => handleDelete(addr.id)}
                          style={styles.deleteBtn}>
                          <Ionicons name="trash-outline" size={16} color="#e53935" />
                        </TouchableOpacity>
                      )}
                    </View>

                    <Text style={styles.addressLine}>{addr.address}</Text>
                    <Text style={styles.addressLine}>
                      {addr.city}, {addr.state} - {addr.pincode}
                    </Text>
                    <Text style={styles.addressMobile}>Mobile: {addr.mobile}</Text>

                    {!addr.isDefault && (
                      <TouchableOpacity
                        onPress={() => handleSetDefault(addr.id)}
                        style={styles.setDefaultBtn}
                        activeOpacity={0.7}>
                        <Text style={styles.setDefaultText}>MAKE DEFAULT</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                ))}
              </View>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  sheetContainer: {
    width: '100%',
    maxWidth: Platform.OS === 'web' ? 480 : undefined,
    height: '84%',
    backgroundColor: '#f8f8fa',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: 14,
    backgroundColor: MyntraColors.white,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f3',
  },
  headerTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: MyntraColors.text,
    letterSpacing: 0.8,
  },
  headerSub: {
    fontSize: 11,
    color: MyntraColors.textSecondary,
    marginTop: 2,
  },
  closeBtn: {
    padding: 4,
  },
  scrollContent: {
    padding: Spacing.lg,
    paddingBottom: 40,
  },
  addNewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#fff4f6',
    borderWidth: 1,
    borderColor: '#ffc1cf',
    borderRadius: 8,
    paddingVertical: 12,
    marginBottom: Spacing.md,
  },
  addNewBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: MyntraColors.primary,
    letterSpacing: 0.5,
  },
  addressesList: {
    gap: 12,
  },
  addressCard: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e8e8ec',
    borderRadius: 8,
    padding: 14,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  cardTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  addrName: {
    fontSize: 13,
    fontWeight: '800',
    color: MyntraColors.text,
  },
  typeBadge: {
    backgroundColor: '#f0f0f4',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  typeBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: MyntraColors.textSecondary,
  },
  defaultBadge: {
    backgroundColor: '#ecfdf5',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  defaultBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: MyntraColors.ratingGreen,
  },
  deleteBtn: {
    padding: 4,
  },
  addressLine: {
    fontSize: 12,
    color: MyntraColors.textSecondary,
    lineHeight: 16,
  },
  addressMobile: {
    fontSize: 11.5,
    color: MyntraColors.text,
    fontWeight: '600',
    marginTop: 4,
  },
  setDefaultBtn: {
    marginTop: 10,
    alignSelf: 'flex-start',
    paddingVertical: 4,
  },
  setDefaultText: {
    fontSize: 11,
    fontWeight: '800',
    color: MyntraColors.primary,
  },
  formContainer: {
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e8e8ec',
    padding: 14,
    gap: 8,
  },
  formTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: MyntraColors.text,
    marginBottom: 4,
  },
  errorText: {
    color: '#e53935',
    fontSize: 11,
    fontWeight: '600',
  },
  input: {
    height: 40,
    borderWidth: 1,
    borderColor: '#d5d6dd',
    borderRadius: 6,
    paddingHorizontal: 10,
    fontSize: 12.5,
    color: MyntraColors.text,
    outlineStyle: 'none' as any,
  },
  inputArea: {
    height: 60,
    textAlignVertical: 'top',
    paddingTop: 8,
  },
  rowTwo: {
    flexDirection: 'row',
    gap: 8,
  },
  halfInput: {
    flex: 1,
  },
  typeRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  typePill: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#d5d6dd',
  },
  typePillActive: {
    borderColor: MyntraColors.primary,
    backgroundColor: '#fff0f3',
  },
  typeText: {
    fontSize: 11,
    color: MyntraColors.textSecondary,
    fontWeight: '600',
  },
  typeTextActive: {
    color: MyntraColors.primary,
    fontWeight: '800',
  },
  formActionsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
  },
  cancelBtn: {
    flex: 1,
    height: 38,
    borderWidth: 1,
    borderColor: '#d5d6dd',
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: MyntraColors.textSecondary,
  },
  saveBtn: {
    flex: 2,
    height: 38,
    backgroundColor: MyntraColors.primary,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#fff',
  },
  loadingContainer: {
    paddingVertical: 40,
    alignItems: 'center',
    gap: 10,
  },
  loadingText: {
    fontSize: 12,
    color: MyntraColors.textSecondary,
    fontWeight: '600',
  },
  emptyContainer: {
    paddingVertical: 40,
    paddingHorizontal: 20,
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e8e8ec',
    marginTop: 10,
  },
  emptyIconCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: '#fff0f3',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  emptyTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: MyntraColors.text,
    letterSpacing: 0.5,
    marginBottom: 6,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 11.5,
    color: MyntraColors.textSecondary,
    textAlign: 'center',
    lineHeight: 16,
    marginBottom: 20,
    maxWidth: 280,
  },
  emptyAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: MyntraColors.primary,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 6,
  },
  emptyAddBtnText: {
    color: '#fff',
    fontSize: 11.5,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
});
