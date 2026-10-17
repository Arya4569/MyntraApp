import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import {
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

interface HelpCenterModalProps {
  visible: boolean;
  onClose: () => void;
}

interface FAQItem {
  id: string;
  category: string;
  q: string;
  a: string;
}

const FAQS: FAQItem[] = [
  {
    id: 'f1',
    category: 'Delivery',
    q: 'How do I check the delivery status of my order?',
    a: 'Go to your Profile tab and tap "Orders". Click on any order card to see real-time shipment milestones from confirmed to delivered.',
  },
  {
    id: 'f2',
    category: 'Delivery',
    q: 'What is the estimated delivery time for my area?',
    a: 'Most orders are delivered within 1 to 3 business days. You can also enter your 6-digit PIN code on any product page for live delivery estimation.',
  },
  {
    id: 'f3',
    category: 'Returns',
    q: 'What is Myntra’s return and exchange policy?',
    a: 'We offer a 14-day hassle-free return and exchange guarantee on unworn, unwashed apparel and lifestyle items with original tags intact.',
  },
  {
    id: 'f4',
    category: 'Returns',
    q: 'How long does a refund take after cancellation or return?',
    a: 'Refunds for digital UPI and Card payments are processed within 2-4 business days. COD refunds can be transferred directly to your bank account.',
  },
  {
    id: 'f5',
    category: 'Payments',
    q: 'Which payment methods are accepted?',
    a: 'We accept Cash on Delivery (COD), UPI (Google Pay, PhonePe, Paytm), and major Credit/Debit cards.',
  },
  {
    id: 'f6',
    category: 'Coupons',
    q: 'How do I apply coupon codes for discounts?',
    a: 'In your Shopping Bag, tap "View Offers" or enter coupon codes like MYNTRA500 or FIRSTBUY to enjoy instant discounts.',
  },
  {
    id: 'f7',
    category: 'Account',
    q: 'How do I update my name or email?',
    a: 'Visit the Profile tab and tap "Manage Account" to update your full name, email address, or preferences.',
  },
];

export const HelpCenterModal: React.FC<HelpCenterModalProps> = ({
  visible,
  onClose,
}) => {
  const [search, setSearch] = useState('');
  const [selectedTopic, setSelectedTopic] = useState('All');
  const [expandedId, setExpandedId] = useState<string | null>('f1');

  const topics = ['All', 'Delivery', 'Returns', 'Payments', 'Coupons', 'Account'];

  const filtered = FAQS.filter((item) => {
    const matchesTopic =
      selectedTopic === 'All' || item.category === selectedTopic;
    const q = search.trim().toLowerCase();
    const matchesSearch =
      q === '' ||
      item.q.toLowerCase().includes(q) ||
      item.a.toLowerCase().includes(q);
    return matchesTopic && matchesSearch;
  });

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
              <Text style={styles.headerTitle}>HELP CENTER & 24x7 FAQS</Text>
              <Text style={styles.headerSub}>Find answers or connect with support</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={22} color={MyntraColors.text} />
            </TouchableOpacity>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}>
            {/* Search FAQ Input */}
            <View style={styles.searchBox}>
              <Ionicons name="search-outline" size={18} color={MyntraColors.textMuted} />
              <TextInput
                style={styles.input}
                placeholder="Type your question or issue..."
                placeholderTextColor={MyntraColors.textMuted}
                value={search}
                onChangeText={setSearch}
              />
              {search.length > 0 && (
                <TouchableOpacity onPress={() => setSearch('')}>
                  <Ionicons name="close-circle" size={16} color={MyntraColors.textMuted} />
                </TouchableOpacity>
              )}
            </View>

            {/* Quick Contact Support Banner */}
            <View style={styles.supportCard}>
              <View style={styles.supportCardLeft}>
                <Ionicons name="headset-outline" size={24} color={MyntraColors.primary} />
                <View>
                  <Text style={styles.supportTitle}>Need Immediate Assistance?</Text>
                  <Text style={styles.supportSub}>
                    Support: support@myntra.com • 080-61561999
                  </Text>
                </View>
              </View>
            </View>

            {/* Topic Filter Pills */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.topicsRow}>
              {topics.map((t) => (
                <TouchableOpacity
                  key={t}
                  onPress={() => setSelectedTopic(t)}
                  style={[
                    styles.topicPill,
                    selectedTopic === t && styles.topicPillActive,
                  ]}>
                  <Text
                    style={[
                      styles.topicText,
                      selectedTopic === t && styles.topicTextActive,
                    ]}>
                    {t}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* FAQ Accordions */}
            <View style={styles.faqList}>
              {filtered.map((item) => {
                const isExpanded = expandedId === item.id;
                return (
                  <View key={item.id} style={styles.faqCard}>
                    <TouchableOpacity
                      onPress={() => setExpandedId(isExpanded ? null : item.id)}
                      style={styles.faqHeader}
                      activeOpacity={0.8}>
                      <Text style={styles.faqQ}>{item.q}</Text>
                      <Ionicons
                        name={isExpanded ? 'chevron-up' : 'chevron-down'}
                        size={18}
                        color={MyntraColors.textMuted}
                      />
                    </TouchableOpacity>
                    {isExpanded && (
                      <View style={styles.faqAnswerContainer}>
                        <Text style={styles.faqA}>{item.a}</Text>
                      </View>
                    )}
                  </View>
                );
              })}
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
    alignItems: 'center',
  },
  sheetContainer: {
    width: '100%',
    maxWidth: Platform.OS === 'web' ? 480 : undefined,
    height: '88%',
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
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e2e2e6',
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 42,
    marginBottom: 12,
    gap: 8,
  },
  input: {
    flex: 1,
    fontSize: 13,
    color: MyntraColors.text,
    outlineStyle: 'none' as any,
  },
  supportCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff4f6',
    borderWidth: 1,
    borderColor: '#ffcdd7',
    borderRadius: 8,
    padding: 12,
    marginBottom: 14,
  },
  supportCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  supportTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: MyntraColors.primary,
  },
  supportSub: {
    fontSize: 10.5,
    color: MyntraColors.textSecondary,
    marginTop: 2,
  },
  topicsRow: {
    gap: 8,
    paddingBottom: 14,
  },
  topicPill: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#d2d3da',
  },
  topicPillActive: {
    borderColor: MyntraColors.primary,
    backgroundColor: MyntraColors.primary,
  },
  topicText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: MyntraColors.textSecondary,
  },
  topicTextActive: {
    color: '#fff',
    fontWeight: '800',
  },
  faqList: {
    gap: 10,
  },
  faqCard: {
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e8e8ec',
    overflow: 'hidden',
  },
  faqHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    gap: 10,
  },
  faqQ: {
    flex: 1,
    fontSize: 12.5,
    fontWeight: '700',
    color: MyntraColors.text,
    lineHeight: 17,
  },
  faqAnswerContainer: {
    paddingHorizontal: 12,
    paddingBottom: 12,
    borderTopWidth: 1,
    borderTopColor: '#f2f2f4',
    paddingTop: 8,
    backgroundColor: '#fafafb',
  },
  faqA: {
    fontSize: 12,
    color: MyntraColors.textSecondary,
    lineHeight: 18,
  },
});
