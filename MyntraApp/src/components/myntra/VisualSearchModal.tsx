import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import React, { useState } from 'react';
import {
  Alert,
  Image,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { MyntraColors, Spacing } from '@/constants/myntra-theme';
import { Product } from '@/data/mock-data';

interface VisualSearchModalProps {
  visible: boolean;
  onClose: () => void;
  onSelectProduct: (product: Product) => void;
  onApplyCategoryOrQuery: (categoryOrQuery: string) => void;
  products?: Product[];
}

interface FashionPreset {
  id: string;
  title: string;
  category: string;
  query: string;
  image: string;
  detectedTags: string[];
}

const PRESET_STYLES: FashionPreset[] = [
  {
    id: 'preset-1',
    title: 'Vintage Denim Trucker',
    category: 'Men',
    query: 'Denim Jacket',
    image: 'https://images.unsplash.com/photo-1551028719-00167b16eac5?w=600&auto=format&fit=crop&q=80',
    detectedTags: ['Denim Jacket', 'Vintage Wash', 'Casual Wear'],
  },
  {
    id: 'preset-2',
    title: 'Floral Summer Tiered Dress',
    category: 'Women',
    query: 'Floral Dress',
    image: 'https://images.unsplash.com/photo-1595777457583-95e059d581b8?w=600&auto=format&fit=crop&q=80',
    detectedTags: ['Tiered Dress', 'Floral Pastel', 'Summer Vibe'],
  },
  {
    id: 'preset-3',
    title: 'Court Minimalist Sneakers',
    category: 'Sports',
    query: 'Sneakers',
    image: 'https://images.unsplash.com/photo-1549298916-b41d501d3772?w=600&auto=format&fit=crop&q=80',
    detectedTags: ['White Sneakers', 'Athletic Streetwear', 'Leather Finish'],
  },
  {
    id: 'preset-4',
    title: 'Festive Anarkali Suit',
    category: 'Women',
    query: 'Anarkali Kurta',
    image: 'https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=600&auto=format&fit=crop&q=80',
    detectedTags: ['Zari Embroidered', 'Ethnic Festive', 'Anarkali'],
  },
  {
    id: 'preset-5',
    title: 'Vegan Leather Tote Bag',
    category: 'Women',
    query: 'Handbag',
    image: 'https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=600&auto=format&fit=crop&q=80',
    detectedTags: ['Vegan Leather', 'Tan Brown', 'Structured Handbag'],
  },
];

export const VisualSearchModal: React.FC<VisualSearchModalProps> = ({
  visible,
  onClose,
  onSelectProduct,
  onApplyCategoryOrQuery,
  products = [],
}) => {
  const [isScanning, setIsScanning] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState<FashionPreset | null>(null);
  const [flashOn, setFlashOn] = useState(false);
  const [cameraFacing, setCameraFacing] = useState<'back' | 'front'>('back');
  const [matchingResults, setMatchingResults] = useState<Product[]>([]);

  const handleClose = () => {
    setIsScanning(false);
    setSelectedPreset(null);
    setMatchingResults([]);
    onClose();
  };

  const handleSimulateScan = (preset: FashionPreset) => {
    setSelectedPreset(preset);
    setIsScanning(true);
    setMatchingResults([]);

    setTimeout(() => {
      setIsScanning(false);
      const queryLower = preset.query.toLowerCase();
      const matches = products.filter(
        (p) =>
          p.name.toLowerCase().includes(queryLower) ||
          p.subcategory.toLowerCase().includes(queryLower) ||
          p.category.toLowerCase() === preset.category.toLowerCase()
      );
      setMatchingResults(matches.slice(0, 4));
    }, 1200);
  };

  const handlePickImageWeb = () => {
    if (typeof document !== 'undefined') {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.onchange = (e: any) => {
        const file = e.target?.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
          const dataUri = event.target?.result as string;
          if (dataUri) {
            processUploadedImage(file.name, dataUri);
          }
        };
        reader.readAsDataURL(file);
      };
      input.click();
    }
  };

  const handleLaunchCamera = async () => {
    if (Platform.OS === 'web') {
      handlePickImageWeb();
      return;
    }

    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(
          'Camera Permission Required',
          'Please allow Myntra to access your camera to scan outfit photos for visual search.',
          [{ text: 'OK' }]
        );
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.85,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        processUploadedImage(asset.fileName || 'camera_outfit.jpg', asset.uri);
      }
    } catch (err: any) {
      console.warn('Native camera launch failed:', err?.message);
      handleNativeCameraFallback('camera');
    }
  };

  const handlePickGallery = async () => {
    if (Platform.OS === 'web') {
      handlePickImageWeb();
      return;
    }

    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(
          'Gallery Permission Required',
          'Please allow Myntra to access your photos to select an outfit for visual search.',
          [{ text: 'OK' }]
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.85,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        processUploadedImage(asset.fileName || 'gallery_outfit.jpg', asset.uri);
      }
    } catch (err: any) {
      console.warn('Native gallery launch failed:', err?.message);
      handleNativeCameraFallback('gallery');
    }
  };

  const handleNativeCameraFallback = (mode: 'camera' | 'gallery') => {
    Alert.alert(
      mode === 'camera' ? 'Visual Search Outfit Scanner' : 'Select Outfit Photo',
      'Choose a sample fashion look to test visual search, or take a snapshot:',
      [
        {
          text: 'Vintage Denim Jacket',
          onPress: () => handleSimulateScan(PRESET_STYLES[0]),
        },
        {
          text: 'Summer Floral Dress',
          onPress: () => handleSimulateScan(PRESET_STYLES[1]),
        },
        {
          text: 'Court Minimalist Sneakers',
          onPress: () => handleSimulateScan(PRESET_STYLES[2]),
        },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  const handlePickImage = () => {
    if (Platform.OS === 'web') {
      handlePickImageWeb();
    } else {
      Alert.alert('Scan or Upload Outfit', 'Choose how you want to add an outfit photo:', [
        { text: '📷 Take Photo', onPress: handleLaunchCamera },
        { text: '🖼️ Choose from Gallery', onPress: handlePickGallery },
        { text: 'Cancel', style: 'cancel' },
      ]);
    }
  };

  const processUploadedImage = (fileName: string, imageUri: string) => {
    const cleanName = fileName.toLowerCase();

    let detectedCategory = 'All';
    let detectedQuery = 'Trending';
    let tags = ['Visual Match', 'Custom Outfit'];

    if (
      cleanName.includes('shirt') ||
      cleanName.includes('tshirt') ||
      cleanName.includes('tee') ||
      cleanName.includes('top')
    ) {
      detectedCategory = 'Men';
      detectedQuery = 'T-Shirt';
      tags = ['Cotton T-Shirt', 'Casual Wear', 'Comfort Fit'];
    } else if (
      cleanName.includes('dress') ||
      cleanName.includes('gown') ||
      cleanName.includes('frock') ||
      cleanName.includes('skirt')
    ) {
      detectedCategory = 'Women';
      detectedQuery = 'Dress';
      tags = ['Chic Dress', 'Floral Pastel', 'Summer Vibe'];
    } else if (
      cleanName.includes('kurta') ||
      cleanName.includes('saree') ||
      cleanName.includes('ethnic') ||
      cleanName.includes('anarkali')
    ) {
      detectedCategory = 'Women';
      detectedQuery = 'Kurta';
      tags = ['Ethnic Kurta', 'Festive Zari', 'Traditional'];
    } else if (
      cleanName.includes('shoe') ||
      cleanName.includes('sneaker') ||
      cleanName.includes('boot') ||
      cleanName.includes('footwear') ||
      cleanName.includes('sandal')
    ) {
      detectedCategory = 'Sports';
      detectedQuery = 'Sneakers';
      tags = ['Sneakers', 'Streetwear', 'Athletic Grip'];
    } else if (
      cleanName.includes('jean') ||
      cleanName.includes('denim') ||
      cleanName.includes('pant') ||
      cleanName.includes('trouser')
    ) {
      detectedCategory = 'Men';
      detectedQuery = 'Jeans';
      tags = ['Denim Jeans', 'Washed Finish', 'Casual Wear'];
    } else if (
      cleanName.includes('jacket') ||
      cleanName.includes('coat') ||
      cleanName.includes('hoodie') ||
      cleanName.includes('blazer')
    ) {
      detectedCategory = 'Men';
      detectedQuery = 'Jacket';
      tags = ['Denim Bomber', 'Outerwear', 'Smart Casual'];
    } else if (
      cleanName.includes('bag') ||
      cleanName.includes('purse') ||
      cleanName.includes('tote') ||
      cleanName.includes('backpack')
    ) {
      detectedCategory = 'Women';
      detectedQuery = 'Bag';
      tags = ['Handbag', 'Vegan Leather', 'Structured Bag'];
    } else if (
      cleanName.includes('watch') ||
      cleanName.includes('time') ||
      cleanName.includes('clock')
    ) {
      detectedCategory = 'Men';
      detectedQuery = 'Watch';
      tags = ['Chronograph Watch', 'Leather Strap', 'Formal'];
    }

    const uploadedPreset: FashionPreset = {
      id: `upload-${Date.now()}`,
      title: 'Uploaded Outfit Photo',
      category: detectedCategory,
      query: detectedQuery,
      image: imageUri,
      detectedTags: tags,
    };

    setSelectedPreset(uploadedPreset);
    setIsScanning(true);
    setMatchingResults([]);

    setTimeout(() => {
      setIsScanning(false);
      const queryLower = detectedQuery.toLowerCase();
      let matches = products.filter(
        (p) =>
          p.name.toLowerCase().includes(queryLower) ||
          p.subcategory.toLowerCase().includes(queryLower) ||
          (p.brand && p.brand.toLowerCase().includes(queryLower)) ||
          p.category.toLowerCase() === detectedCategory.toLowerCase()
      );
      if (matches.length === 0) {
        matches = products.slice(0, 6);
      }
      setMatchingResults(matches.slice(0, 6));
    }, 1200);
  };

  const handleApplyPreset = (preset: FashionPreset) => {
    onApplyCategoryOrQuery(preset.query);
    handleClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={handleClose}>
      <View style={styles.container}>
        {/* Header Bar */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.headerBtn}
            onPress={handleClose}
            activeOpacity={0.7}
            accessibilityLabel="Close photo search">
            <Ionicons name="close" size={24} color={MyntraColors.white} />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>PHOTO SEARCH</Text>
            <Text style={styles.headerSubtitle}>Scan any outfit to shop similar styles</Text>
          </View>
          <TouchableOpacity
            style={styles.headerBtn}
            onPress={() => setFlashOn((prev) => !prev)}
            activeOpacity={0.7}>
            <Ionicons
              name={flashOn ? 'flash' : 'flash-off-outline'}
              size={20}
              color={flashOn ? '#ffdf00' : MyntraColors.white}
            />
          </TouchableOpacity>
        </View>

        {/* Camera Viewfinder Area */}
        <View style={styles.viewfinderContainer}>
          {selectedPreset ? (
            <>
              <Image
                source={{ uri: selectedPreset.image }}
                style={styles.viewfinderImage}
                resizeMode="cover"
              />
              <TouchableOpacity
                style={styles.reUploadBtn}
                onPress={handlePickImage}
                activeOpacity={0.8}>
                <Ionicons name="camera-reverse" size={14} color="#fff" />
                <Text style={styles.reUploadText}>Upload Another</Text>
              </TouchableOpacity>
            </>
          ) : (
            <View style={styles.simulatedCamera}>
              <Ionicons
                name="camera"
                size={54}
                color="rgba(255, 255, 255, 0.4)"
              />
              <Text style={styles.cameraHelpText}>
                Upload any outfit photo or use camera to find matching styles
              </Text>
              <View style={styles.uploadPromptRow}>
                <TouchableOpacity
                  style={styles.uploadPromptBtn}
                  onPress={handleLaunchCamera}
                  activeOpacity={0.85}>
                  <Ionicons name="camera" size={18} color="#fff" />
                  <Text style={styles.uploadPromptText}>TAKE PHOTO</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.uploadPromptBtn, styles.uploadPromptSecondaryBtn]}
                  onPress={handlePickGallery}
                  activeOpacity={0.85}>
                  <Ionicons name="images" size={18} color="#fff" />
                  <Text style={styles.uploadPromptText}>GALLERY</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Viewfinder Corner Framing Brackets */}
          <View style={styles.frameCornerTL} />
          <View style={styles.frameCornerTR} />
          <View style={styles.frameCornerBL} />
          <View style={styles.frameCornerBR} />

          {/* Scanning Animation Laser Line */}
          {isScanning && (
            <View style={styles.scanLaserLine}>
              <View style={styles.scanGlow} />
            </View>
          )}

          {/* Live AI Detection Tags Overlay */}
          {selectedPreset && !isScanning && (
            <View style={styles.detectedTagsBox}>
              <View style={styles.detectedHeader}>
                <Ionicons name="sparkles" size={14} color="#ff3f6c" />
                <Text style={styles.detectedTitle}>AI STYLE DETECTED</Text>
              </View>
              <View style={styles.tagChipsRow}>
                {selectedPreset.detectedTags.map((tag) => (
                  <View key={tag} style={styles.tagChip}>
                    <Text style={styles.tagChipText}>{tag}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Viewfinder Bottom Controls */}
          <View style={styles.cameraControlsRow}>
            <TouchableOpacity
              style={styles.controlSmallBtn}
              onPress={() =>
                setCameraFacing((f) => (f === 'back' ? 'front' : 'back'))
              }
              activeOpacity={0.8}>
              <Ionicons
                name={cameraFacing === 'back' ? 'camera-reverse-outline' : 'camera-outline'}
                size={22}
                color="#fff"
              />
            </TouchableOpacity>

            {/* Shutter / Scan Button */}
            <TouchableOpacity
              style={styles.shutterBtn}
              onPress={handleLaunchCamera}
              activeOpacity={0.85}
              accessibilityLabel="Take photo with camera">
              <View style={styles.shutterInner} />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.controlSmallBtn}
              onPress={handlePickGallery}
              activeOpacity={0.8}
              accessibilityLabel="Choose from gallery">
              <Ionicons name="images-outline" size={22} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Bottom Drawer: Outfit Presets & Matching Products */}
        <View style={styles.bottomDrawer}>
          <Text style={styles.drawerTitle}>
            {matchingResults.length > 0
              ? 'SIMILAR STYLES IN CATALOG'
              : 'TRY SAMPLE FASHION LOOKS'}
          </Text>

          {matchingResults.length > 0 ? (
            <View>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.resultsScroll}>
                {matchingResults.map((item) => (
                  <TouchableOpacity
                    key={`vis-${item.id}`}
                    style={styles.resultCard}
                    onPress={() => {
                      onSelectProduct(item);
                      onClose();
                    }}
                    activeOpacity={0.85}>
                    <Image source={{ uri: item.image }} style={styles.resultImage} />
                    <View style={styles.resultInfo}>
                      <Text style={styles.resultBrand} numberOfLines={1}>
                        {item.brand}
                      </Text>
                      <Text style={styles.resultName} numberOfLines={1}>
                        {item.name}
                      </Text>
                      <Text style={styles.resultPrice}>₹{item.price}</Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {selectedPreset && (
                <TouchableOpacity
                  style={styles.viewAllMatchBtn}
                  onPress={() => handleApplyPreset(selectedPreset)}
                  activeOpacity={0.85}>
                  <Text style={styles.viewAllMatchText}>
                    EXPLORE ALL {selectedPreset.query.toUpperCase()}
                  </Text>
                  <Ionicons name="arrow-forward" size={16} color="#fff" />
                </TouchableOpacity>
              )}
            </View>
          ) : (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.presetsScroll}>
              {PRESET_STYLES.map((preset) => (
                <TouchableOpacity
                  key={preset.id}
                  style={[
                    styles.presetCard,
                    selectedPreset?.id === preset.id && styles.presetCardActive,
                  ]}
                  onPress={() => handleSimulateScan(preset)}
                  activeOpacity={0.85}>
                  <Image source={{ uri: preset.image }} style={styles.presetImage} />
                  <Text style={styles.presetTitle} numberOfLines={1}>
                    {preset.title}
                  </Text>
                  <Text style={styles.presetTagText}>Tap to scan</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  header: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    backgroundColor: '#000',
    borderBottomWidth: 1,
    borderBottomColor: '#222',
    marginTop: Platform.OS === 'android' ? 24 : 0,
  },
  headerBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: {
    alignItems: 'center',
  },
  headerTitle: {
    color: MyntraColors.white,
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  headerSubtitle: {
    color: '#888',
    fontSize: 10,
    marginTop: 1,
  },
  viewfinderContainer: {
    flex: 1,
    backgroundColor: '#121212',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  viewfinderImage: {
    width: '100%',
    height: '100%',
  },
  simulatedCamera: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  cameraHelpText: {
    color: '#777',
    fontSize: 13,
    textAlign: 'center',
    marginTop: 16,
    lineHeight: 18,
  },
  uploadPromptRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 18,
  },
  uploadPromptBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#ff3f6c',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 24,
    shadowColor: '#ff3f6c',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 4,
  },
  uploadPromptSecondaryBtn: {
    backgroundColor: '#333333',
    shadowColor: '#000000',
  },
  uploadPromptText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  reUploadBtn: {
    position: 'absolute',
    top: 20,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(0,0,0,0.65)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    zIndex: 10,
  },
  reUploadText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '600',
  },
  frameCornerTL: {
    position: 'absolute',
    top: 30,
    left: 30,
    width: 32,
    height: 32,
    borderTopWidth: 3,
    borderLeftWidth: 3,
    borderColor: '#ff3f6c',
    borderRadius: 2,
  },
  frameCornerTR: {
    position: 'absolute',
    top: 30,
    right: 30,
    width: 32,
    height: 32,
    borderTopWidth: 3,
    borderRightWidth: 3,
    borderColor: '#ff3f6c',
    borderRadius: 2,
  },
  frameCornerBL: {
    position: 'absolute',
    bottom: 80,
    left: 30,
    width: 32,
    height: 32,
    borderBottomWidth: 3,
    borderLeftWidth: 3,
    borderColor: '#ff3f6c',
    borderRadius: 2,
  },
  frameCornerBR: {
    position: 'absolute',
    bottom: 80,
    right: 30,
    width: 32,
    height: 32,
    borderBottomWidth: 3,
    borderRightWidth: 3,
    borderColor: '#ff3f6c',
    borderRadius: 2,
  },
  scanLaserLine: {
    position: 'absolute',
    top: '45%',
    left: 30,
    right: 30,
    height: 2,
    backgroundColor: '#ff3f6c',
  },
  scanGlow: {
    position: 'absolute',
    top: -6,
    left: 0,
    right: 0,
    height: 14,
    backgroundColor: 'rgba(255, 63, 108, 0.35)',
    borderRadius: 7,
  },
  detectedTagsBox: {
    position: 'absolute',
    top: 40,
    left: 40,
    right: 40,
    backgroundColor: 'rgba(0,0,0,0.75)',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ff3f6c',
  },
  detectedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  detectedTitle: {
    color: '#ff3f6c',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
  },
  tagChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  tagChip: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  tagChipText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
  },
  cameraControlsRow: {
    position: 'absolute',
    bottom: 16,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 30,
  },
  shutterBtn: {
    width: 68,
    height: 68,
    borderRadius: 34,
    borderWidth: 4,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  shutterInner: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#ff3f6c',
  },
  controlSmallBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomDrawer: {
    backgroundColor: '#161616',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingTop: 14,
    paddingBottom: 24,
    borderTopWidth: 1,
    borderTopColor: '#282828',
  },
  drawerTitle: {
    color: '#aaa',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
    paddingHorizontal: Spacing.lg,
    marginBottom: 10,
  },
  presetsScroll: {
    paddingHorizontal: Spacing.lg,
    gap: 12,
  },
  presetCard: {
    width: 100,
    backgroundColor: '#222',
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#333',
  },
  presetCardActive: {
    borderColor: '#ff3f6c',
    borderWidth: 2,
  },
  presetImage: {
    width: '100%',
    height: 90,
  },
  presetTitle: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
    paddingHorizontal: 6,
    paddingTop: 6,
  },
  presetTagText: {
    color: '#ff3f6c',
    fontSize: 9,
    fontWeight: '600',
    paddingHorizontal: 6,
    paddingBottom: 6,
  },
  resultsScroll: {
    paddingHorizontal: Spacing.lg,
    gap: 12,
  },
  resultCard: {
    width: 110,
    backgroundColor: '#222',
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#333',
  },
  resultImage: {
    width: '100%',
    height: 100,
  },
  resultInfo: {
    padding: 6,
  },
  resultBrand: {
    color: '#888',
    fontSize: 10,
    fontWeight: '700',
  },
  resultName: {
    color: '#eee',
    fontSize: 11,
    fontWeight: '600',
  },
  resultPrice: {
    color: '#ff3f6c',
    fontSize: 12,
    fontWeight: '800',
    marginTop: 2,
  },
  viewAllMatchBtn: {
    marginHorizontal: Spacing.lg,
    marginTop: 12,
    backgroundColor: '#ff3f6c',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 8,
    gap: 6,
  },
  viewAllMatchText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
});
