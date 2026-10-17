import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { MyntraColors, Spacing } from '@/constants/myntra-theme';
import { DEFAULT_BANK_OFFERS } from '@/data/mock-data';
import { storeService } from '@/services/store-service';
import { BankOffer } from '@/types/store';

interface BankOffersModalProps {
  visible: boolean;
  onClose: () => void;
  onApplyCode: (code: string) => void;
  offers?: BankOffer[];
}

export const BankOffersModal: React.FC<BankOffersModalProps> = ({
  visible,
  onClose,
  onApplyCode,
  offers: initialOffers,
}) => {
  const [remoteOffers, setRemoteOffers] = useState<BankOffer[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (visible && (!initialOffers || initialOffers.length === 0)) {
      let isMounted = true;
      const loadOffers = async () => {
        setLoading(true);
        try {
          const fetched = await storeService.fetchBankOffers();
          if (isMounted && fetched?.length > 0) {
            setRemoteOffers(fetched);
          }
        } catch {
          // fallback stays in place
        } finally {
          if (isMounted) setLoading(false);
        }
      };
      loadOffers();
      return () => {
        isMounted = false;
      };
    }
  }, [visible, initialOffers]);

  const offersList =
    initialOffers && initialOffers.length > 0
      ? initialOffers
      : remoteOffers.length > 0
      ? remoteOffers
      : DEFAULT_BANK_OFFERS;
  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheetContainer}>
          {/* Header */}
          <View style={styles.headerRow}>
            <View>
              <Text style={styles.sheetTitle}>BANK & PAYMENT OFFERS</Text>
              <Text style={styles.sheetSubtitle}>
                Exclusive discounts on cards & UPI
              </Text>
            </View>
            <TouchableOpacity
              style={styles.closeBtn}
              onPress={onClose}
              activeOpacity={0.7}
              accessibilityLabel="Close offers">
              <Ionicons name="close" size={20} color={MyntraColors.text} />
            </TouchableOpacity>
          </View>

          {/* Offers List */}
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}>
            {loading ? (
              <ActivityIndicator size="small" color="#ff3f6c" style={{ marginVertical: 20 }} />
            ) : null}
            {(offersList || []).map((offer) => (
              <View key={offer.id} style={styles.offerCard}>
                <View style={styles.cardTopRow}>
                  <View style={[styles.iconCircle, { backgroundColor: offer.color }]}>
                    <Ionicons name={offer.icon as any} size={18} color="#fff" />
                  </View>
                  <View style={styles.bankInfo}>
                    <Text style={styles.bankName}>{offer.bank}</Text>
                    <Text style={styles.offerTitle}>{offer.title}</Text>
                  </View>
                  <TouchableOpacity
                    style={styles.applyBtn}
                    onPress={() => {
                      onApplyCode(offer.code);
                      onClose();
                    }}
                    activeOpacity={0.8}>
                    <Text style={styles.applyBtnText}>APPLY</Text>
                  </TouchableOpacity>
                </View>

                <Text style={styles.offerDesc}>{offer.description}</Text>

                <View style={styles.cardFooter}>
                  <View style={styles.codePill}>
                    <Ionicons name="pricetag" size={12} color={MyntraColors.primary} />
                    <Text style={styles.codeText}>{offer.code}</Text>
                  </View>
                  <Text style={styles.minSpendText}>
                    {offer.minSpend} • {offer.validTill}
                  </Text>
                </View>
              </View>
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    backgroundColor: MyntraColors.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
    paddingTop: 20,
    paddingBottom: 30,
    paddingHorizontal: Spacing.lg,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: MyntraColors.divider,
  },
  sheetTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: MyntraColors.text,
    letterSpacing: 0.5,
  },
  sheetSubtitle: {
    fontSize: 12,
    color: MyntraColors.textSecondary,
    marginTop: 2,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: MyntraColors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    paddingTop: 16,
    gap: 12,
  },
  offerCard: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e8e8e8',
    borderRadius: 12,
    padding: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bankInfo: {
    flex: 1,
  },
  bankName: {
    fontSize: 11,
    fontWeight: '700',
    color: MyntraColors.textMuted,
    textTransform: 'uppercase',
  },
  offerTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: MyntraColors.text,
    marginTop: 1,
  },
  applyBtn: {
    backgroundColor: '#fff0f3',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#ff3f6c',
  },
  applyBtnText: {
    color: '#ff3f6c',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  offerDesc: {
    fontSize: 12,
    color: MyntraColors.textSecondary,
    marginTop: 8,
    lineHeight: 17,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#f4f4f4',
  },
  codePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#fff8f9',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#ffd5dd',
  },
  codeText: {
    fontSize: 11,
    fontWeight: '800',
    color: MyntraColors.primary,
    letterSpacing: 0.5,
  },
  minSpendText: {
    fontSize: 10,
    color: MyntraColors.textMuted,
  },
});
