import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import {
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { MyntraColors, Spacing } from '@/constants/myntra-theme';
import { Product } from '@/data/mock-data';

interface ProductCardProps {
  product: Product;
  isWishlisted: boolean;
  onToggleWishlist: (product: Product) => void;
  onPressCard: (product: Product) => void;
}

export const ProductCard: React.FC<ProductCardProps> = ({
  product,
  isWishlisted,
  onToggleWishlist,
  onPressCard,
}) => {
  return (
    <TouchableOpacity
      activeOpacity={0.92}
      onPress={() => onPressCard(product)}
      style={styles.cardContainer}>
      {/* Product Image Section with 3:4 Fashion Ratio */}
      <View style={styles.imageContainer}>
        <Image
          source={{ uri: product.image }}
          style={styles.image}
          resizeMode="cover"
        />

        {/* Rating Pill Overlay */}
        <View style={styles.ratingBadge}>
          <Text style={styles.ratingText}>{product.rating.toFixed(1)}</Text>
          <Ionicons name="star" size={9} color={MyntraColors.ratingGreen} />
          <Text style={styles.ratingDivider}>|</Text>
          <Text style={styles.ratingCountText}>{product.ratingCount}</Text>
        </View>

        {/* Wishlist Heart Icon Button */}
        <TouchableOpacity
          accessibilityLabel={isWishlisted ? 'Remove from wishlist' : 'Add to wishlist'}
          activeOpacity={0.75}
          onPress={() => onToggleWishlist(product)}
          style={[
            styles.wishlistButton,
            isWishlisted && styles.wishlistButtonActive,
          ]}>
          <Ionicons
            name={isWishlisted ? 'heart' : 'heart-outline'}
            size={18}
            color={isWishlisted ? MyntraColors.primary : MyntraColors.textSecondary}
          />
        </TouchableOpacity>
      </View>

      {/* Product Details Section */}
      <View style={styles.detailsContainer}>
        {/* Brand Name */}
        <Text style={styles.brandName} numberOfLines={1}>
          {product.brand}
        </Text>

        {/* Product Title */}
        <Text style={styles.productName} numberOfLines={1}>
          {product.name}
        </Text>

        {/* Price Row: Current, Original, and Discount */}
        <View style={styles.priceRow}>
          <Text style={styles.currentPrice}>₹{product.price}</Text>
          {product.originalPrice > product.price && (
            <Text style={styles.originalPrice}>₹{product.originalPrice}</Text>
          )}
          {product.discountPercent > 0 && (
            <Text style={styles.discountText}>
              ({product.discountPercent}% OFF)
            </Text>
          )}
        </View>

        {/* Fast Delivery Badge */}
        <View style={styles.deliveryRow}>
          <Ionicons name="flash-outline" size={10} color={MyntraColors.accent} />
          <Text style={styles.deliveryText} numberOfLines={1}>
            {product.deliveryTime}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  cardContainer: {
    backgroundColor: MyntraColors.white,
    borderRadius: 10,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#eaeaec',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2,
    marginBottom: Spacing.md,
  },
  imageContainer: {
    width: '100%',
    aspectRatio: 3 / 4,
    backgroundColor: '#f5f5f7',
    position: 'relative',
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  ratingBadge: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.94)',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    gap: 3,
    borderWidth: 0.5,
    borderColor: '#e8e8ea',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 1,
  },
  ratingText: {
    fontSize: 10,
    fontWeight: '800',
    color: MyntraColors.text,
  },
  ratingDivider: {
    fontSize: 9,
    color: MyntraColors.textMuted,
  },
  ratingCountText: {
    fontSize: 9,
    fontWeight: '600',
    color: MyntraColors.textSecondary,
  },
  wishlistButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 0.5,
    borderColor: '#e8e8ea',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  wishlistButtonActive: {
    backgroundColor: '#fff0f3',
    borderColor: '#ffc1cf',
  },
  detailsContainer: {
    padding: 9,
  },
  brandName: {
    fontSize: 12,
    fontWeight: '800',
    color: MyntraColors.text,
    letterSpacing: 0.4,
  },
  productName: {
    fontSize: 12,
    color: MyntraColors.textSecondary,
    marginTop: 2,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
    marginTop: 5,
    flexWrap: 'wrap',
  },
  currentPrice: {
    fontSize: 13.5,
    fontWeight: '800',
    color: MyntraColors.text,
  },
  originalPrice: {
    fontSize: 10.5,
    color: MyntraColors.textMuted,
    textDecorationLine: 'line-through',
  },
  discountText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: MyntraColors.primary,
  },
  deliveryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: 4,
  },
  deliveryText: {
    fontSize: 10,
    color: MyntraColors.textSecondary,
    fontWeight: '500',
  },
});
