import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
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

const SUPPORTED_LANGUAGES = [
  { code: 'en-IN', label: 'English (IN)', badge: 'EN' },
  { code: 'hi-IN', label: 'हिन्दी', badge: 'HI' },
  { code: 'mr-IN', label: 'मराठी', badge: 'MR' },
];

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
  const [selectedLang, setSelectedLang] = useState<string>('en-IN');
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState<string>('');
  const [interimText, setInterimText] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string>('');

  // Animated values initialized via useState (React 19 / Compiler compliant)
  const [pulseAnim] = useState(() => new Animated.Value(1));
  const [barAnim1] = useState(() => new Animated.Value(12));
  const [barAnim2] = useState(() => new Animated.Value(22));
  const [barAnim3] = useState(() => new Animated.Value(34));
  const [barAnim4] = useState(() => new Animated.Value(18));
  const [barAnim5] = useState(() => new Animated.Value(26));

  const recognitionRef = useRef<any>(null);
  const recognitionStatusRef = useRef<'idle' | 'starting' | 'listening' | 'stopping'>('idle');
  const silenceTimerRef = useRef<any>(null);
  const latestTranscriptRef = useRef<string>('');
  const inputRef = useRef<TextInput>(null);

  // Stable callback refs to insulate recognition from parent 1-second interval re-renders
  const onCloseRef = useRef(onClose);
  const onApplyVoiceQueryRef = useRef(onApplyVoiceQuery);

  useEffect(() => {
    onCloseRef.current = onClose;
    onApplyVoiceQueryRef.current = onApplyVoiceQuery;
  }, [onClose, onApplyVoiceQuery]);

  // Check speech recognition capability
  const isWebSpeechSupported = useMemo(() => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const SpeechRecognition =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      return !!SpeechRecognition;
    }
    return false;
  }, []);

  // Native recognition teardown only (does not set state during render/effects)
  const stopNativeRecognitionOnly = useCallback(() => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }

    if (recognitionRef.current) {
      const rec = recognitionRef.current;
      recognitionRef.current = null;
      recognitionStatusRef.current = 'stopping';
      try {
        rec.stop();
      } catch {
        try {
          rec.abort();
        } catch {
          // ignore
        }
      }
    }
    recognitionStatusRef.current = 'idle';
  }, []);

  // Safe stop speech recognition with state update
  const stopSpeechRecognition = useCallback(() => {
    stopNativeRecognitionOnly();
    setIsListening(false);
  }, [stopNativeRecognitionOnly]);

  // Submit recognized query and dismiss
  const submitVoiceQuery = useCallback(
    (queryText: string) => {
      const q = queryText.trim();
      if (!q) return;

      stopSpeechRecognition();
      setTranscript('');
      setInterimText('');
      setErrorMsg('');
      latestTranscriptRef.current = '';
      onApplyVoiceQueryRef.current?.(q);
      onCloseRef.current?.();
    },
    [stopSpeechRecognition]
  );

  const handleClose = useCallback(() => {
    stopSpeechRecognition();
    setTranscript('');
    setInterimText('');
    setErrorMsg('');
    latestTranscriptRef.current = '';
    onCloseRef.current?.();
  }, [stopSpeechRecognition]);

  // Start real-time speech recognition
  const startSpeechRecognition = useCallback(
    (isUserGesture = false) => {
      setErrorMsg('');

      if (
        recognitionStatusRef.current === 'starting' ||
        recognitionStatusRef.current === 'listening'
      ) {
        return;
      }

      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        const SpeechRecognition =
          (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

        if (SpeechRecognition) {
          try {
            stopSpeechRecognition();

            recognitionStatusRef.current = 'starting';
            const recognition = new SpeechRecognition();
            // continuous allows user to speak full phrase without early cutoff
            recognition.continuous = true;
            recognition.interimResults = true;
            recognition.maxAlternatives = 1;
            recognition.lang = selectedLang;

            recognition.onstart = () => {
              recognitionStatusRef.current = 'listening';
              setIsListening(true);
              setErrorMsg('');
            };

            recognition.onresult = (event: any) => {
              let interim = '';
              let final = '';

              for (let i = event.resultIndex; i < event.results.length; ++i) {
                const text = event.results[i][0]?.transcript || '';
                if (event.results[i].isFinal) {
                  final += text;
                } else {
                  interim += text;
                }
              }

              const combined = (final || interim || '').trim();
              if (combined) {
                setTranscript(combined);
                setInterimText(interim);
                latestTranscriptRef.current = combined;

                // Reset debounce timer: if user stops speaking for 1.8s, submit automatically
                if (silenceTimerRef.current) {
                  clearTimeout(silenceTimerRef.current);
                }
                silenceTimerRef.current = setTimeout(() => {
                  if (latestTranscriptRef.current.trim()) {
                    submitVoiceQuery(latestTranscriptRef.current);
                  }
                }, 1800);
              }
            };

            recognition.onerror = (event: any) => {
              recognitionStatusRef.current = 'idle';
              setIsListening(false);

              if (event.error === 'aborted') {
                return;
              }
              if (event.error === 'not-allowed') {
                setErrorMsg(
                  isUserGesture
                    ? 'Microphone blocked. Please click the 🔒 icon in the browser address bar to allow microphone access.'
                    : 'Tap microphone icon below to speak.'
                );
              } else if (event.error === 'no-speech') {
                setErrorMsg('No speech detected. Tap microphone to speak.');
              } else {
                setErrorMsg(
                  isUserGesture
                    ? `Speech error (${event.error}). Please tap again to retry.`
                    : 'Tap microphone below to start speaking.'
                );
              }
            };

            recognition.onend = () => {
              recognitionStatusRef.current = 'idle';
              setIsListening(false);
            };

            recognitionRef.current = recognition;
            recognition.start();
            return;
          } catch (e: any) {
            recognitionStatusRef.current = 'idle';
            setIsListening(false);
            if (e?.name !== 'AbortError') {
              setErrorMsg('Tap microphone below to speak.');
            }
            return;
          }
        }
      }

      // Fallback state on native mobile devices without WebSpeech
      setIsListening(true);
    },
    [selectedLang, stopSpeechRecognition, submitVoiceQuery]
  );

  // Modal visibility lifecycle - insulated strictly to `visible` and `selectedLang`
  useEffect(() => {
    if (visible) {
      // Soft start recognition
      const timer = setTimeout(() => {
        startSpeechRecognition(false);
      }, 150);

      // Focus native keyboard voice input if WebSpeech is not available
      if (!isWebSpeechSupported) {
        setTimeout(() => {
          inputRef.current?.focus();
        }, 300);
      }

      return () => {
        clearTimeout(timer);
        stopNativeRecognitionOnly();
      };
    } else {
      stopNativeRecognitionOnly();
    }
  }, [
    visible,
    selectedLang,
    isWebSpeechSupported,
    startSpeechRecognition,
    stopNativeRecognitionOnly,
  ]);

  // Pulsing animation for microphone button
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

  // Visualizer sound bar bouncing animation while listening
  useEffect(() => {
    let barLoop: Animated.CompositeAnimation | null = null;
    if (visible && isListening) {
      const createBarAnim = (anim: Animated.Value, minH: number, maxH: number, duration: number) =>
        Animated.loop(
          Animated.sequence([
            Animated.timing(anim, {
              toValue: maxH,
              duration,
              easing: Easing.inOut(Easing.ease),
              useNativeDriver: false,
            }),
            Animated.timing(anim, {
              toValue: minH,
              duration,
              easing: Easing.inOut(Easing.ease),
              useNativeDriver: false,
            }),
          ])
        );

      barLoop = Animated.parallel([
        createBarAnim(barAnim1, 8, 32, 400),
        createBarAnim(barAnim2, 12, 40, 500),
        createBarAnim(barAnim3, 16, 44, 350),
        createBarAnim(barAnim4, 10, 36, 450),
        createBarAnim(barAnim5, 8, 30, 380),
      ]);
      barLoop.start();
    } else {
      barAnim1.setValue(12);
      barAnim2.setValue(22);
      barAnim3.setValue(34);
      barAnim4.setValue(18);
      barAnim5.setValue(26);
    }

    return () => {
      barLoop?.stop();
    };
  }, [visible, isListening, barAnim1, barAnim2, barAnim3, barAnim4, barAnim5]);

  // Toggle listening explicitly from user gesture
  const handleToggleListening = () => {
    if (isListening) {
      stopSpeechRecognition();
    } else {
      startSpeechRecognition(true);
    }
  };

  const handleSelectQuery = (text: string) => {
    setTranscript(text);
    stopSpeechRecognition();
    setTimeout(() => {
      submitVoiceQuery(text);
    }, 400);
  };

  const handleManualSubmit = () => {
    const q = transcript.trim() || interimText.trim();
    if (q) {
      submitVoiceQuery(q);
    }
  };

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={handleClose}>
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
            <View style={[styles.liveDot, isListening && styles.liveDotActive]} />
            <Text style={styles.sheetTitle}>
              {isWebSpeechSupported ? 'REAL-TIME VOICE SEARCH' : 'VOICE SEARCH'}
            </Text>
          </View>

          {/* Language selector chips */}
          {isWebSpeechSupported && (
            <View style={styles.langSelectorRow}>
              {SUPPORTED_LANGUAGES.map((lang) => {
                const isSelected = selectedLang === lang.code;
                return (
                  <TouchableOpacity
                    key={lang.code}
                    style={[styles.langChip, isSelected && styles.langChipActive]}
                    onPress={() => {
                      if (selectedLang !== lang.code) {
                        setSelectedLang(lang.code);
                      }
                    }}
                    activeOpacity={0.8}>
                    <Text style={[styles.langChipText, isSelected && styles.langChipTextActive]}>
                      {lang.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

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

          {/* Real-time Dynamic Audio Visualizer Bars */}
          {isListening && (
            <View style={styles.soundBarRow}>
              <Animated.View style={[styles.soundBar, { height: barAnim1 }]} />
              <Animated.View style={[styles.soundBar, { height: barAnim2 }]} />
              <Animated.View style={[styles.soundBar, { height: barAnim3 }]} />
              <Animated.View style={[styles.soundBar, { height: barAnim4 }]} />
              <Animated.View style={[styles.soundBar, { height: barAnim5 }]} />
            </View>
          )}

          {/* Real-time recognized text preview & Search button */}
          {transcript.length > 0 && (
            <View style={styles.recognizedBox}>
              <Text style={styles.recognizedLabel}>RECOGNIZED QUERY</Text>
              <Text style={styles.recognizedText}>{`\u201C${transcript}\u201D`}</Text>
              <View style={styles.actionButtonsRow}>
                <TouchableOpacity
                  style={styles.searchNowBtn}
                  onPress={handleManualSubmit}
                  activeOpacity={0.8}>
                  <Ionicons name="search" size={16} color={MyntraColors.white} />
                  <Text style={styles.searchNowBtnText}>Search Now</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.retryBtn}
                  onPress={() => {
                    setTranscript('');
                    setInterimText('');
                    startSpeechRecognition(true);
                  }}
                  activeOpacity={0.8}>
                  <Ionicons name="refresh" size={15} color={MyntraColors.textSecondary} />
                  <Text style={styles.retryBtnText}>Retry</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Fallback speech text box with phone keyboard voice typing support */}
          {!isWebSpeechSupported && (
            <View style={styles.nativeVoiceInputContainer}>
              <View style={styles.nativeVoiceBadge}>
                <Ionicons name="phone-portrait-outline" size={14} color={MyntraColors.primary} />
                <Text style={styles.nativeVoiceBadgeText}>
                  Tap 🎙️ on phone keyboard to speak
                </Text>
              </View>
              <View style={styles.nativeVoiceInputRow}>
                <TextInput
                  ref={inputRef}
                  style={styles.nativeVoiceInput}
                  placeholder="Speak via mobile keyboard mic..."
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
    zIndex: 10,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#9ca3af',
  },
  liveDotActive: {
    backgroundColor: '#10b981',
  },
  sheetTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: MyntraColors.textMuted,
    letterSpacing: 1.5,
  },
  langSelectorRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  langChip: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 16,
    backgroundColor: MyntraColors.surface,
    borderWidth: 1,
    borderColor: '#e4e4e7',
  },
  langChipActive: {
    backgroundColor: '#fff0f3',
    borderColor: MyntraColors.primary,
  },
  langChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: MyntraColors.textMuted,
  },
  langChipTextActive: {
    color: MyntraColors.primary,
    fontWeight: '700',
  },
  sheetSubtitle: {
    fontSize: 15,
    fontWeight: '700',
    color: MyntraColors.text,
    marginTop: 2,
    textAlign: 'center',
    paddingHorizontal: 20,
    minHeight: 24,
  },
  micCircleContainer: {
    width: 130,
    height: 130,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 14,
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
    backgroundColor: '#ff3f6c',
  },
  soundBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 44,
    marginBottom: 10,
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
    marginBottom: 10,
  },
  actionButtonsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
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
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: MyntraColors.surface,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e4e4e7',
  },
  retryBtnText: {
    color: MyntraColors.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
  nativeVoiceInputContainer: {
    width: '100%',
    marginBottom: 14,
  },
  nativeVoiceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginBottom: 6,
  },
  nativeVoiceBadgeText: {
    fontSize: 12,
    color: MyntraColors.textSecondary,
    fontWeight: '600',
  },
  nativeVoiceInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    backgroundColor: MyntraColors.surface,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 6,
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
