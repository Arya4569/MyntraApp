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
import { useAuth } from '@/context/AuthContext';
import { storeService } from '@/services/store-service';
import { InsiderInfo, InsiderPerk } from '@/types/store';

interface InsiderModalProps {
  visible: boolean;
  onClose: () => void;
  onClaimPerk?: (perk: string) => void;
}

export const InsiderModal: React.FC<InsiderModalProps> = ({
  visible,
  onClose,
  onClaimPerk,
}) => {
  const { user } = useAuth();
  const [insider, setInsider] = useState<InsiderInfo>({
    superCoins: (user as any)?.insiderPoints ?? 250,
    tier: 'GOLD TIER',
    tierSubtitle: 'Select Tier Member',
    pointsRule: 'Earn 10 SuperCoins for every ₹100 spent on all purchases.',
    perks: [
      {
        id: 'perk-1',
        icon: 'airplane-outline',
        title: 'Free Express Delivery',
        description: 'No minimum order required',
        status: 'ACTIVE',
      },
      {
        id: 'perk-2',
        icon: 'alarm-outline',
        title: 'Early Sale Access',
        description: 'Enter mega sales 24 hrs early',
        status: 'ACTIVE',
      },
      {
        id: 'perk-3',
        icon: 'gift-outline',
        title: '₹500 Birthday Voucher',
        description: 'Gift voucher credited every year',
        status: 'CLAIMABLE',
      },
    ],
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (visible) {
      let isMounted = true;
      const loadInsider = async () => {
        setLoading(true);
        try {
          const data = await storeService.fetchInsiderData();
          if (isMounted) {
            setInsider({
              ...data,
              superCoins: (user as any)?.insiderPoints ?? data.superCoins,
            });
          }
        } catch {
          // fallback stays
        } finally {
          if (isMounted) setLoading(false);
        }
      };
      loadInsider();
      return () => {
        isMounted = false;
      };
    }
  }, [visible, user]);

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
            <View style={styles.insiderLogoBadge}>
              <Text style={styles.insiderLogoText}>M</Text>
            </View>
            <View style={styles.headerTextCol}>
              <Text style={styles.insiderTitle}>MYNTRA INSIDER VIP</Text>
              <Text style={styles.insiderSub}>{insider.tierSubtitle}</Text>
            </View>
            <TouchableOpacity
              style={styles.closeBtn}
              onPress={onClose}
              activeOpacity={0.7}
              accessibilityLabel="Close insider modal">
              <Ionicons name="close" size={20} color={MyntraColors.text} />
            </TouchableOpacity>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}>
            {/* Coins Balance Card */}
            <View style={styles.coinsCard}>
              <View style={styles.coinsRow}>
                <View>
                  <Text style={styles.coinsLabel}>AVAILABLE SUPERCOINS</Text>
                  <Text style={styles.coinsAmount}>
                    {insider.superCoins} 🪙
                  </Text>
                </View>
                <View style={styles.tierPill}>
                  <Text style={styles.tierPillText}>{insider.tier}</Text>
                </View>
              </View>
              <Text style={styles.coinsSub}>{insider.pointsRule}</Text>
            </View>

            {/* VIP Perks */}
            <Text style={styles.sectionHeader}>YOUR EXCLUSIVE PERKS</Text>
            {loading ? (
              <ActivityIndicator size="small" color="#ff3f6c" style={{ marginVertical: 15 }} />
            ) : null}
            <View style={styles.perksList}>
              {(insider.perks || []).map((perk: InsiderPerk) => (
                <View key={perk.id} style={styles.perkCard}>
                  <View style={styles.perkIconCircle}>
                    <Ionicons name={(perk.icon as any) || 'gift-outline'} size={20} color="#ff3f6c" />
                  </View>
                  <View style={styles.perkInfo}>
                    <Text style={styles.perkTitle}>{perk.title}</Text>
                    <Text style={styles.perkSub}>{perk.description}</Text>
                  </View>
                  {perk.status === 'CLAIMABLE' ? (
                    <TouchableOpacity
                      style={styles.claimBtn}
                      onPress={() => {
                        onClaimPerk?.(perk.title);
                        onClose();
                      }}
                      activeOpacity={0.8}>
                      <Text style={styles.claimBtnText}>CLAIM</Text>
                    </TouchableOpacity>
                  ) : (
                    <View style={styles.activeTag}>
                      <Text style={styles.activeTagText}>ACTIVE</Text>
                    </View>
                  )}
                </View>
              ))}
            </View>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: MyntraColors.divider,
    gap: 12,
  },
  insiderLogoBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#1a1a1a',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#ffdf00',
  },
  insiderLogoText: {
    color: '#ffdf00',
    fontSize: 20,
    fontWeight: '900',
    fontStyle: 'italic',
  },
  headerTextCol: {
    flex: 1,
  },
  insiderTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: MyntraColors.text,
    letterSpacing: 1,
  },
  insiderSub: {
    fontSize: 12,
    color: '#ff3f6c',
    fontWeight: '700',
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
  },
  coinsCard: {
    backgroundColor: '#1c1c1e',
    borderRadius: 14,
    padding: 16,
    marginBottom: 20,
  },
  coinsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  coinsLabel: {
    color: '#aaa',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
  },
  coinsAmount: {
    color: '#ffdf00',
    fontSize: 28,
    fontWeight: '900',
    marginTop: 2,
  },
  tierPill: {
    backgroundColor: '#332a00',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#ffdf00',
  },
  tierPillText: {
    color: '#ffdf00',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  coinsSub: {
    color: '#bbb',
    fontSize: 12,
    marginTop: 10,
  },
  sectionHeader: {
    fontSize: 12,
    fontWeight: '800',
    color: MyntraColors.textMuted,
    letterSpacing: 1,
    marginBottom: 12,
  },
  perksList: {
    gap: 10,
  },
  perkCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fafafa',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#eee',
    gap: 12,
  },
  perkIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#fff0f3',
    alignItems: 'center',
    justifyContent: 'center',
  },
  perkInfo: {
    flex: 1,
  },
  perkTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: MyntraColors.text,
  },
  perkSub: {
    fontSize: 11,
    color: MyntraColors.textSecondary,
    marginTop: 2,
  },
  activeTag: {
    backgroundColor: '#e8f5e9',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  activeTagText: {
    color: '#2e7d32',
    fontSize: 10,
    fontWeight: '800',
  },
  claimBtn: {
    backgroundColor: '#ff3f6c',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  claimBtnText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '800',
  },
});
