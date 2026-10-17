import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { MyntraColors, Spacing } from '@/constants/myntra-theme';
import { PROMO_BANNERS, PromoBannerData } from '@/data/mock-data';

interface PromoBannerProps {
  banners?: PromoBannerData[];
  onPressBanner?: (banner: PromoBannerData) => void;
}

export const PromoBanner: React.FC<PromoBannerProps> = ({
  banners = PROMO_BANNERS,
  onPressBanner,
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const activeBanners = banners && banners.length > 0 ? banners : PROMO_BANNERS;
  const banner = activeBanners[currentIndex] || activeBanners[0];

  const handleNext = () => {
    setCurrentIndex((prev) => (prev + 1) % activeBanners.length);
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity
        activeOpacity={0.9}
        onPress={() => {
          onPressBanner?.(banner);
          handleNext();
        }}
        style={styles.bannerCard}>
        {/* Decorative background shapes */}
        <View style={styles.circleDecoration} />
        <View style={styles.squareDecoration} />

        {/* Top Tag & Timer Row */}
        <View style={styles.topRow}>
          <View style={styles.tagBadge}>
            <Text style={styles.tagText}>{banner.tag}</Text>
          </View>
          <View style={styles.timerBadge}>
            <Ionicons name="time-outline" size={12} color="#ffffff" />
            <Text style={styles.timerText}>{banner.endsIn}</Text>
          </View>
        </View>

        {/* Center Sale Details */}
        <View style={styles.contentContainer}>
          <Text style={styles.heading}>{banner.title}</Text>
          <Text style={styles.subtitle}>{banner.subtitle}</Text>

          <View style={styles.discountRow}>
            <View style={styles.discountPill}>
              <Text style={styles.discountText}>{banner.discount}</Text>
            </View>
            <View style={styles.codePill}>
              <Text style={styles.codeLabel}>USE CODE:</Text>
              <Text style={styles.codeValue}>{banner.code}</Text>
            </View>
          </View>
        </View>

        {/* Bottom CTA Row */}
        <View style={styles.bottomRow}>
          <View style={styles.ctaButton}>
            <Text style={styles.ctaText}>SHOP THE SALE</Text>
            <Ionicons name="arrow-forward" size={14} color={MyntraColors.primary} />
          </View>

          {/* Pagination Indicators */}
          <View style={styles.paginationRow}>
            {PROMO_BANNERS.map((item, idx) => (
              <TouchableOpacity
                key={item.id}
                onPress={() => setCurrentIndex(idx)}
                style={[
                  styles.dot,
                  idx === currentIndex ? styles.activeDot : styles.inactiveDot,
                ]}
              />
            ))}
          </View>
        </View>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
  },
  bannerCard: {
    backgroundColor: '#1d1323', // Rich dark base with pink accents
    borderRadius: 16,
    padding: Spacing.lg,
    overflow: 'hidden',
    position: 'relative',
    borderWidth: 1,
    borderColor: '#ff3f6c40',
    shadowColor: MyntraColors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 4,
  },
  circleDecoration: {
    position: 'absolute',
    top: -40,
    right: -40,
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: '#ff3f6c25',
  },
  squareDecoration: {
    position: 'absolute',
    bottom: -30,
    left: -20,
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#ff527b18',
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  tagBadge: {
    backgroundColor: MyntraColors.primary,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  tagText: {
    color: MyntraColors.white,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  timerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#ffffff20',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  timerText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '600',
  },
  contentContainer: {
    marginVertical: 4,
  },
  heading: {
    color: '#ffffff',
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  subtitle: {
    color: '#f0adb9',
    fontSize: 13,
    fontWeight: '600',
    marginTop: 2,
    letterSpacing: 0.5,
  },
  discountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 10,
  },
  discountPill: {
    backgroundColor: MyntraColors.white,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 8,
  },
  discountText: {
    color: MyntraColors.primary,
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  codePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#ffffff60',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  codeLabel: {
    color: '#ffffffbb',
    fontSize: 10,
    fontWeight: '600',
  },
  codeValue: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 14,
  },
  ctaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: MyntraColors.white,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  ctaText: {
    color: MyntraColors.primary,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  paginationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dot: {
    height: 6,
    borderRadius: 3,
  },
  activeDot: {
    width: 18,
    backgroundColor: MyntraColors.primary,
  },
  inactiveDot: {
    width: 6,
    backgroundColor: '#ffffff40',
  },
});
