import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
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
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [pulseAnim] = useState(new Animated.Value(1));

  const recognitionRef = useRef<any>(null);
  const isRecognizingRef = useRef<boolean>(false);
  const inputRef = useRef<TextInput>(null);

  // Check speech recognition capability via useMemo (avoids setState in effect)
  const isWebSpeechSupported = useMemo(() => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const SpeechRecognition =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      return !!SpeechRecognition;
    }
    return false;
  }, []);

  const stopNativeRecognitionOnly = useCallback(() => {
    if (recognitionRef.current) {
      const rec = recognitionRef.current;
      recognitionRef.current = null;
      isRecognizingRef.current = false;
      try {
        rec.abort();
      } catch {
        // Ignore stop error
      }
    }
  }, []);

  const stopSpeechRecognition = useCallback(() => {
    stopNativeRecognitionOnly();
    setIsListening(false);
  }, [stopNativeRecognitionOnly]);

  const handleClose = useCallback(() => {
    stopSpeechRecognition();
    setTranscript('');
    setErrorMsg('');
    onClose();
  }, [stopSpeechRecognition, onClose]);

  const startSpeechRecognition = useCallback(() => {
    setErrorMsg('');
    if (isRecognizingRef.current) {
      return;
    }

    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const SpeechRecognition =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

      if (SpeechRecognition) {
        try {
          stopNativeRecognitionOnly();

          const recognition = new SpeechRecognition();
          recognition.continuous = false;
          recognition.interimResults = true;
          recognition.maxAlternatives = 1;
          recognition.lang = 'en-IN'; // Optimized for Indian English & mixed clothing terms

          recognition.onstart = () => {
            isRecognizingRef.current = true;
            setIsListening(true);
            setErrorMsg('');
          };

          recognition.onresult = (event: any) => {
            let interimTranscript = '';
            let finalTranscript = '';

            for (let i = event.resultIndex; i < event.results.length; ++i) {
              const text = event.results[i][0]?.transcript || '';
              if (event.results[i].isFinal) {
                finalTranscript += text;
              } else {
                interimTranscript += text;
              }
            }

            const current = (finalTranscript || interimTranscript).trim();
            if (current) {
              setTranscript(current);
            }

            if (finalTranscript.trim()) {
              setIsListening(false);
              isRecognizingRef.current = false;
              setTimeout(() => {
                onApplyVoiceQuery(finalTranscript.trim());
                handleClose();
              }, 700);
            }
          };

          recognition.onerror = (event: any) => {
            isRecognizingRef.current = false;
            setIsListening(false);
            if (event.error === 'aborted') {
              // Expected normal cancellation on modal close or toggle
              return;
            }
            if (event.error === 'not-allowed') {
              setErrorMsg('Microphone access denied. Please allow microphone in browser.');
            } else if (event.error === 'no-speech') {
              setErrorMsg('No speech detected. Tap microphone to speak.');
            } else {
              setErrorMsg(`Speech error: ${event.error || 'Please try again'}`);
            }
          };

          recognition.onend = () => {
            isRecognizingRef.current = false;
            setIsListening(false);
          };

          recognitionRef.current = recognition;
          recognition.start();
          return;
        } catch (e: any) {
          isRecognizingRef.current = false;
          setIsListening(false);
          if (e?.name !== 'AbortError') {
            setErrorMsg('Tap microphone to start voice search.');
          }
          return;
        }
      }
    }

    // Default state: activate listening simulation/focus
    setIsListening(true);
  }, [handleClose, onApplyVoiceQuery, stopNativeRecognitionOnly]);

  // Handle modal visibility and speech session lifecycle
  useEffect(() => {
    if (visible) {
      const timer = setTimeout(() => {
        startSpeechRecognition();
      }, 100);
      return () => {
        clearTimeout(timer);
        stopNativeRecognitionOnly();
      };
    } else {
      stopNativeRecognitionOnly();
    }
  }, [visible, startSpeechRecognition, stopNativeRecognitionOnly]);

  // Pulsing animation when listening
  useEffect(() => {
    let pulseLoop: Animated.CompositeAnimation | null = null;
    if (visible && isListening) {
      pulseLoop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.35,
            duration: 800,
            useNativeDriver: Platform.OS !== 'web',
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 800,
            useNativeDriver: Platform.OS !== 'web',
          }),
        ])
      );
      pulseLoop.start();
    } else {
      pulseAnim.setValue(1);
    }

    return () => {
      pulseLoop?.stop();
    };
  }, [visible, isListening, pulseAnim]);

  const handleToggleListening = () => {
    if (isListening) {
      stopSpeechRecognition();
    } else {
      startSpeechRecognition();
    }
  };

  const handleSelectQuery = (text: string) => {
    setTranscript(text);
    stopSpeechRecognition();
    setTimeout(() => {
      onApplyVoiceQuery(text);
      handleClose();
    }, 500);
  };

  const handleManualSubmit = () => {
    if (transcript.trim()) {
      stopSpeechRecognition();
      onApplyVoiceQuery(transcript.trim());
      handleClose();
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
          <View style={styles.badgeRow}>
            <View style={styles.liveDot} />
            <Text style={styles.sheetTitle}>
              {isWebSpeechSupported ? 'REAL-TIME VOICE SEARCH' : 'VOICE SEARCH'}
            </Text>
          </View>

          <Text style={styles.sheetSubtitle}>
            {isListening
              ? 'Listening... Speak your style or brand'
              : transcript
              ? `Heard: "${transcript}"`
              : errorMsg || 'Tap microphone to speak'}
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
                size={38}
                color={MyntraColors.white}
              />
            </TouchableOpacity>
          </View>

          {/* Live Audio Visualizer Bars */}
          {isListening && (
            <View style={styles.soundBarRow}>
              <View style={[styles.soundBar, { height: 16 }]} />
              <View style={[styles.soundBar, { height: 28 }]} />
              <View style={[styles.soundBar, { height: 38 }]} />
              <View style={[styles.soundBar, { height: 22 }]} />
              <View style={[styles.soundBar, { height: 34 }]} />
              <View style={[styles.soundBar, { height: 18 }]} />
            </View>
          )}

          {/* Real-time recognized text preview & Search button */}
          {transcript.length > 0 && (
            <View style={styles.recognizedBox}>
              <Text style={styles.recognizedLabel}>SEARCH QUERY</Text>
              <Text style={styles.recognizedText}>{`\u201C${transcript}\u201D`}</Text>
              <TouchableOpacity
                style={styles.searchNowBtn}
                onPress={handleManualSubmit}
                activeOpacity={0.8}>
                <Ionicons name="search" size={16} color={MyntraColors.white} />
                <Text style={styles.searchNowBtnText}>Search Now</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Fallback speech text box with voice typing support */}
          {!isWebSpeechSupported && (
            <View style={styles.nativeVoiceInputRow}>
              <TextInput
                ref={inputRef}
                style={styles.nativeVoiceInput}
                placeholder="Or speak using phone keyboard mic..."
                placeholderTextColor={MyntraColors.textMuted}
                value={transcript}
                onChangeText={setTranscript}
                returnKeyType="search"
                onSubmitEditing={handleManualSubmit}
              />
              {transcript.trim().length > 0 && (
                <TouchableOpacity
                  style={styles.nativeSendBtn}
                  onPress={handleManualSubmit}>
                  <Ionicons name="arrow-forward" size={18} color={MyntraColors.white} />
                </TouchableOpacity>
              )}
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
                  <Ionicons name="sparkles" size={12} color={MyntraColors.primary} />
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
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    backgroundColor: MyntraColors.white,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: 24,
    paddingBottom: 36,
    paddingHorizontal: Spacing.xl,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 14,
    elevation: 12,
  },
  closeBtn: {
    position: 'absolute',
    top: 18,
    right: 18,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: MyntraColors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10b981',
  },
  sheetTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: MyntraColors.textMuted,
    letterSpacing: 1.5,
  },
  sheetSubtitle: {
    fontSize: 15,
    fontWeight: '700',
    color: MyntraColors.text,
    marginTop: 4,
    textAlign: 'center',
    paddingHorizontal: 20,
    minHeight: 22,
  },
  micCircleContainer: {
    width: 130,
    height: 130,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 18,
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
    backgroundColor: '#71717a',
  },
  soundBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    height: 38,
    marginBottom: 12,
  },
  soundBar: {
    width: 4,
    backgroundColor: MyntraColors.primary,
    borderRadius: 2,
  },
  recognizedBox: {
    width: '100%',
    backgroundColor: '#fff1f2',
    borderRadius: 14,
    padding: 12,
    alignItems: 'center',
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#fecdd3',
  },
  recognizedLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: MyntraColors.primary,
    letterSpacing: 1,
    marginBottom: 4,
  },
  recognizedText: {
    fontSize: 16,
    fontWeight: '700',
    color: MyntraColors.text,
    textAlign: 'center',
    marginBottom: 8,
  },
  searchNowBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: MyntraColors.primary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  searchNowBtnText: {
    color: MyntraColors.white,
    fontSize: 13,
    fontWeight: '700',
  },
  nativeVoiceInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    backgroundColor: MyntraColors.surface,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 6,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#e4e4e7',
  },
  nativeVoiceInput: {
    flex: 1,
    fontSize: 13,
    color: MyntraColors.text,
    paddingVertical: 4,
  },
  nativeSendBtn: {
    backgroundColor: MyntraColors.primary,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  suggestionsSection: {
    width: '100%',
    marginTop: 4,
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
