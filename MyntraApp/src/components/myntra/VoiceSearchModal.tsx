import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import {
  Animated,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { MyntraColors, Spacing } from '@/constants/myntra-theme';

interface VoiceSearchModalProps {
  visible: boolean;
  onClose: () => void;
  onApplyVoiceQuery: (query: string) => void;
}

const POPULAR_VOICE_QUERIES = [
  'Roadster T-Shirts',
  'Puma Court Sneakers',
  'Linen Wide Leg Trousers',
  'Anarkali Kurta Set',
  'Denim Jacket',
  'Floral Summer Dress',
  'Nike Running Shoes',
  'Leather Handbags',
];

export const VoiceSearchModal: React.FC<VoiceSearchModalProps> = ({
  visible,
  onClose,
  onApplyVoiceQuery,
}) => {
  const [isListening, setIsListening] = useState(true);
  const [transcript, setTranscript] = useState<string>('');
  const [pulseAnim] = useState(new Animated.Value(1));

  useEffect(() => {
    if (visible) {
      // Pulsing microphone wave animation
      const pulseLoop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.35,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }),
        ])
      );
      pulseLoop.start();

      return () => pulseLoop.stop();
    }
  }, [visible, pulseAnim]);

  const handleClose = () => {
    setIsListening(true);
    setTranscript('');
    onClose();
  };

  const handleSelectQuery = (text: string) => {
    setTranscript(text);
    setIsListening(false);
    setTimeout(() => {
      onApplyVoiceQuery(text);
      onClose();
    }, 600);
  };

  const handleToggleListening = () => {
    if (isListening) {
      setIsListening(false);
    } else {
      setIsListening(true);
      setTranscript('');
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      onRequestClose={handleClose}>
      <View style={styles.overlay}>
        <View style={styles.sheetContainer}>
          {/* Close button */}
          <TouchableOpacity
            style={styles.closeBtn}
            onPress={handleClose}
            activeOpacity={0.7}
            accessibilityLabel="Close voice search">
            <Ionicons name="close" size={22} color={MyntraColors.textSecondary} />
          </TouchableOpacity>

          {/* Assistant Header */}
          <Text style={styles.sheetTitle}>VOICE SEARCH</Text>
          <Text style={styles.sheetSubtitle}>
            {isListening
              ? 'Listening... Speak your style or brand'
              : transcript
              ? `Searching for "${transcript}"...`
              : 'Tap microphone to speak'}
          </Text>

          {/* Animated Microphone Hub */}
          <View style={styles.micCircleContainer}>
            {isListening && (
              <>
                <Animated.View
                  style={[
                    styles.micWaveRing,
                    { transform: [{ scale: pulseAnim }], opacity: 0.25 },
                  ]}
                />
                <Animated.View
                  style={[
                    styles.micWaveRing,
                    styles.micWaveOuter,
                    { transform: [{ scale: pulseAnim }], opacity: 0.15 },
                  ]}
                />
              </>
            )}

            <TouchableOpacity
              style={[
                styles.micButton,
                isListening ? styles.micButtonListening : styles.micButtonIdle,
              ]}
              onPress={handleToggleListening}
              activeOpacity={0.85}>
              <Ionicons
                name={isListening ? 'mic' : 'mic-off'}
                size={36}
                color={MyntraColors.white}
              />
            </TouchableOpacity>
          </View>

          {/* Live Audio Visualizer Bars */}
          {isListening && (
            <View style={styles.soundBarRow}>
              <View style={[styles.soundBar, { height: 14 }]} />
              <View style={[styles.soundBar, { height: 26 }]} />
              <View style={[styles.soundBar, { height: 38 }]} />
              <View style={[styles.soundBar, { height: 20 }]} />
              <View style={[styles.soundBar, { height: 32 }]} />
              <View style={[styles.soundBar, { height: 16 }]} />
            </View>
          )}

          {/* Quick Voice Suggestions */}
          <View style={styles.suggestionsSection}>
            <Text style={styles.suggestionsHeader}>OR TAP A POPULAR SEARCH</Text>
            <View style={styles.chipsContainer}>
              {POPULAR_VOICE_QUERIES.map((q) => (
                <TouchableOpacity
                  key={q}
                  style={styles.queryChip}
                  onPress={() => handleSelectQuery(q)}
                  activeOpacity={0.7}>
                  <Ionicons name="search" size={13} color={MyntraColors.primary} />
                  <Text style={styles.queryChipText}>{q}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    backgroundColor: MyntraColors.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 24,
    paddingBottom: 36,
    paddingHorizontal: Spacing.xl,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 10,
  },
  closeBtn: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: MyntraColors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: MyntraColors.textMuted,
    letterSpacing: 1.5,
  },
  sheetSubtitle: {
    fontSize: 16,
    fontWeight: '700',
    color: MyntraColors.text,
    marginTop: 6,
    textAlign: 'center',
  },
  micCircleContainer: {
    width: 130,
    height: 130,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 24,
  },
  micWaveRing: {
    position: 'absolute',
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: MyntraColors.primary,
  },
  micWaveOuter: {
    width: 130,
    height: 130,
    borderRadius: 65,
  },
  micButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: MyntraColors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 8,
  },
  micButtonListening: {
    backgroundColor: MyntraColors.primary,
  },
  micButtonIdle: {
    backgroundColor: '#888',
  },
  soundBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    height: 40,
    marginBottom: 16,
  },
  soundBar: {
    width: 4,
    backgroundColor: MyntraColors.primary,
    borderRadius: 2,
  },
  suggestionsSection: {
    width: '100%',
    marginTop: 8,
  },
  suggestionsHeader: {
    fontSize: 11,
    fontWeight: '800',
    color: MyntraColors.textMuted,
    letterSpacing: 1,
    marginBottom: 10,
    textAlign: 'center',
  },
  chipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'center',
  },
  queryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#fff0f3',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#ffd1dc',
  },
  queryChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: MyntraColors.text,
  },
});
