import React, { useState, useRef, useEffect } from 'react';
import Svg, { Path } from 'react-native-svg';
import {
  StyleSheet, TouchableOpacity, ScrollView, View,
  Platform, ActivityIndicator, PanResponder,
} from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn, FadeInDown, FadeInUp } from 'react-native-reanimated';
import { useAuthStore } from '@/store/auth-store';
import { useOnboardingStore } from '@/store/onboarding-store';
import { profileApi } from '@/services/profile-api';

export default function AuthOnboardingCompleteScreen() {
  const router = useRouter();
  const completeOnboarding = useAuthStore((s) => s.completeOnboarding);
  const profile = useOnboardingStore();
  const updateProfile = useOnboardingStore((s) => s.updateProfile);

  const alreadySigned = !!profile.isPledgeSigned || !!profile.signature;
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [paths, setPaths] = useState<string[]>([]);
  const [currentPath, setCurrentPath] = useState<string>('');
  const [isSigned, setIsSigned] = useState<boolean>(alreadySigned);
  const [scrollEnabled, setScrollEnabled] = useState<boolean>(true);
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 145 });

  const canvasRef = useRef<View>(null);

  // Prevent web touch scrolling specifically while touching the scratch pad canvas
  useEffect(() => {
    if (Platform.OS === 'web' && canvasRef.current) {
      const el = canvasRef.current as unknown as HTMLElement;
      const preventDefaultTouch = (e: TouchEvent) => {
        if (e.cancelable) {
          e.preventDefault();
        }
      };
      el.addEventListener('touchstart', preventDefaultTouch, { passive: false });
      el.addEventListener('touchmove', preventDefaultTouch, { passive: false });
      return () => {
        el.removeEventListener('touchstart', preventDefaultTouch);
        el.removeEventListener('touchmove', preventDefaultTouch);
      };
    }
  }, []);

  const pointsRef = useRef<{ x: number; y: number }[]>([]);
  const currentPathStrRef = useRef<string>('');

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onStartShouldSetPanResponderCapture: () => true,
      onMoveShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponderCapture: () => true,
      onPanResponderTerminationRequest: () => false,
      onShouldBlockNativeResponder: () => true,
      onPanResponderGrant: (evt) => {
        setScrollEnabled(false);
        const { locationX, locationY } = evt.nativeEvent;
        if (locationX !== undefined && locationY !== undefined) {
          const pt = { x: locationX, y: locationY };
          pointsRef.current = [pt];
          const initialStr = `M ${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`;
          currentPathStrRef.current = initialStr;
          setCurrentPath(initialStr);
          setIsSigned(true);
        }
      },
      onPanResponderMove: (evt) => {
        const { locationX, locationY } = evt.nativeEvent;
        if (locationX === undefined || locationY === undefined) return;
        const pts = pointsRef.current;
        if (pts.length === 0) {
          const pt = { x: locationX, y: locationY };
          pointsRef.current = [pt];
          currentPathStrRef.current = `M ${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`;
          setCurrentPath(currentPathStrRef.current);
          return;
        }

        const lastPt = pts[pts.length - 1];
        const dist = Math.hypot(locationX - lastPt.x, locationY - lastPt.y);
        // Distance throttling: skip micro-jitter points closer than 2.5px
        if (dist < 2.5) return;

        const newPt = { x: locationX, y: locationY };
        pts.push(newPt);

        // Smooth midpoint quadratic curve algorithm
        const midX = (lastPt.x + newPt.x) / 2;
        const midY = (lastPt.y + newPt.y) / 2;
        const curveSegment = ` Q ${lastPt.x.toFixed(1)} ${lastPt.y.toFixed(1)}, ${midX.toFixed(1)} ${midY.toFixed(1)}`;
        
        currentPathStrRef.current += curveSegment;
        setCurrentPath(currentPathStrRef.current);
      },
      onPanResponderRelease: () => {
        setScrollEnabled(true);
        const finalizedStr = currentPathStrRef.current;
        const pts = pointsRef.current;
        if (finalizedStr) {
          // If tap single dot without move, append small line so dot is visible
          const strokePath = pts.length === 1 
            ? `${finalizedStr} L ${(pts[0].x + 0.5).toFixed(1)} ${(pts[0].y + 0.5).toFixed(1)}` 
            : finalizedStr;
          setPaths((prev) => [...prev, strokePath]);
        }
        pointsRef.current = [];
        currentPathStrRef.current = '';
        setCurrentPath('');
      },
      onPanResponderTerminate: () => {
        setScrollEnabled(true);
        const finalizedStr = currentPathStrRef.current;
        const pts = pointsRef.current;
        if (finalizedStr) {
          const strokePath = pts.length === 1 
            ? `${finalizedStr} L ${(pts[0].x + 0.5).toFixed(1)} ${(pts[0].y + 0.5).toFixed(1)}` 
            : finalizedStr;
          setPaths((prev) => [...prev, strokePath]);
        }
        pointsRef.current = [];
        currentPathStrRef.current = '';
        setCurrentPath('');
      },
    })
  ).current;

  const handleEnterApp = async () => {
    if (!isSigned || isSubmitting) return;

    setIsSubmitting(true);

    const generatedSig = `UNIQUE_PLEDGE_SIG_${Date.now()}_${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
    const signatureString = paths.length > 0 ? paths.join(' ') : (profile.signature || generatedSig);

    updateProfile({
      signature: signatureString,
      isPledgeSigned: true,
    });

    try {
      const currentState = useOnboardingStore.getState();
      const { updateProfile: _, resetProfile: __, ...onboardingData } = currentState;
      await profileApi.submitOnboarding({
        ...onboardingData,
        signature: signatureString,
        isPledgeSigned: true,
      });
    } catch (err) {
      console.warn('Backend onboarding submission log (local persistence active):', err);
    } finally {
      setIsSubmitting(false);
    }

    completeOnboarding();
    router.replace('/(tabs)/home' as any);
  };

  return (
    <View style={styles.container}>
      {/* Background ambient glows */}
      <View style={styles.glow1} pointerEvents="none" />
      <View style={styles.glow2} pointerEvents="none" />
      <View style={styles.glow3} pointerEvents="none" />

      <Stack.Screen options={{ headerShown: false }} />

      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom', 'left', 'right']}>
        <Animated.View entering={FadeIn.duration(500)} style={styles.mainWrapper}>
          <ScrollView
            scrollEnabled={scrollEnabled}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.responsiveContainer}>
              {/* ── HERO HEADER ────────────────────────────────────────── */}
              <Animated.View entering={FadeInUp.duration(600)} style={styles.heroSection}>
                <View style={styles.heroTopRow}>
                  <View style={styles.heroBadge}>
                    <Ionicons name="checkmark-done" size={14} color="#00C851" style={{ marginRight: 4 }} />
                    <ThemedText style={styles.heroBadgeText}>READY TO START</ThemedText>
                  </View>
                </View>

                <ThemedText style={styles.heroGreeting}>
                  {profile.firstName ? `Welcome, ${profile.firstName}` : 'Welcome'}
                </ThemedText>
                <ThemedText style={styles.heroTitle}>
                  Your Promise to{'\n'}
                  <ThemedText style={styles.heroTitleAccent}>Build Self-Control.</ThemedText>
                </ThemedText>
                <ThemedText style={styles.heroSubtitle}>
                  Your setup is complete! Read your simple promise below and sign your name to enter ZenWill.
                </ThemedText>
              </Animated.View>

              {/* ── COVENANT OF SELF-HONESTY CARD ─────────────────────── */}
              <Animated.View entering={FadeInDown.duration(400).delay(150)}>
                <View style={styles.oathCard}>
                  <View style={styles.oathHeaderRow}>
                    <Ionicons name="shield-outline" size={20} color="#00A8FF" />
                    <ThemedText style={styles.oathHeaderTitle}>Promise of Self-Honesty</ThemedText>
                  </View>

                  <View style={styles.oathDivider} />

                  <ThemedText style={styles.oathBodyText}>
                    The streak days and numbers in this app are here to guide you, but what really matters is your <ThemedText style={styles.oathHighlight}>real mental strength</ThemedText> and daily self-control.
                  </ThemedText>

                  <ThemedText style={styles.oathBodyText}>
                    Be completely honest with yourself every day. Fake check-ins or false tracking will not help you grow — <ThemedText style={styles.oathWarning}>they only hide weaknesses from yourself</ThemedText>.
                  </ThemedText>

                  <ThemedText style={styles.oathBodyText}>
                    Real freedom from unwanted habits comes from being honest, facing reality, and building your self-control step by step.
                  </ThemedText>
                </View>
              </Animated.View>

              {/* ── COMPACT SQUARE SIGNATURE PAD ───────────────────────── */}
              <Animated.View entering={FadeInDown.duration(400).delay(250)}>
                <View style={styles.signatureSquareCard}>
                  <View style={styles.sigCardHeader}>
                    <ThemedText style={styles.signatureTitle}>Sign Your Promise</ThemedText>
                    {isSigned && (
                      <View style={styles.signedBadge}>
                        <Ionicons name="checkmark-circle" size={13} color="#00C851" />
                        <ThemedText style={styles.signedBadgeText}>Signed</ThemedText>
                      </View>
                    )}
                  </View>
                  <ThemedText style={styles.signatureDesc}>
                    Sign inside the box below with your finger to confirm your promise to yourself.
                  </ThemedText>

                  {/* Compact Canvas - Scroll locking gesture responder */}
                  <View
                    ref={canvasRef}
                    style={[styles.canvasSquareWrapper, { touchAction: 'none' } as any]}
                    onTouchStart={(e) => {
                      setScrollEnabled(false);
                      e.stopPropagation?.();
                    }}
                    onTouchEnd={() => {
                      setScrollEnabled(true);
                    }}
                    onTouchCancel={() => {
                      setScrollEnabled(true);
                    }}
                    onLayout={(e) => {
                      const { width, height } = e.nativeEvent.layout;
                      if (width > 0 && height > 0) {
                        setCanvasSize({ width, height });
                      }
                    }}
                    {...panResponder.panHandlers}
                  >
                    {paths.length === 0 && !currentPath && (
                      <View style={styles.canvasPlaceholder} pointerEvents="none">
                        <Ionicons
                          name={alreadySigned ? 'checkmark-circle-outline' : 'create-outline'}
                          size={22}
                          color={alreadySigned ? '#00C851' : 'rgba(255,255,255,0.2)'}
                        />
                        <ThemedText style={[styles.canvasPlaceholderText, alreadySigned && { color: '#00C851', fontWeight: '700' }]}>
                          {alreadySigned ? '✓ Promise Already Signed (Tap Clear to Re-sign)' : 'Sign your name here with your finger'}
                        </ThemedText>
                      </View>
                    )}

                    <Svg
                      width="100%"
                      height="100%"
                      viewBox={canvasSize.width > 0 ? `0 0 ${canvasSize.width} ${canvasSize.height}` : undefined}
                      style={[StyleSheet.absoluteFill, { width: '100%', height: '100%' }]}
                      pointerEvents="none"
                    >
                      {paths.map((p, i) => (
                        <Path key={i} d={p} stroke="#00A8FF" strokeWidth={3.2} strokeLinecap="round" strokeLinejoin="round" fill="none" />
                      ))}
                      {currentPath ? (
                        <Path d={currentPath} stroke="#00A8FF" strokeWidth={3.2} strokeLinecap="round" strokeLinejoin="round" fill="none" />
                      ) : null}
                    </Svg>
                  </View>

                  <View style={styles.sigFooterActions}>
                    <TouchableOpacity
                      activeOpacity={0.7}
                      style={styles.clearBtn}
                      onPress={() => {
                        setPaths([]);
                        setCurrentPath('');
                        setIsSigned(false);
                        pointsRef.current = [];
                        currentPathStrRef.current = '';
                      }}
                    >
                      <Ionicons name="refresh-outline" size={14} color="rgba(255,255,255,0.6)" />
                      <ThemedText style={styles.clearBtnText}>Clear Signature</ThemedText>
                    </TouchableOpacity>

                    {isSigned && (
                      <ThemedText style={styles.sealConfirmationText}>✓ Promise Signed</ThemedText>
                    )}
                  </View>
                </View>
              </Animated.View>

              {/* ── SUBMIT CTA ─────────────────────────────────────────── */}
              <Animated.View entering={FadeInUp.duration(400).delay(350)} style={styles.ctaSection}>
                <TouchableOpacity
                  activeOpacity={0.88}
                  style={[styles.btnContainer, (!isSigned || isSubmitting) && styles.btnDisabled]}
                  onPress={handleEnterApp}
                  disabled={!isSigned || isSubmitting}
                >
                  <LinearGradient
                    colors={['#00A8FF', '#0052D4']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.btnGradient}
                  >
                    {isSubmitting ? (
                      <ActivityIndicator color="#ffffff" size="small" />
                    ) : (
                      <>
                        <ThemedText style={[styles.btnText, !isSigned && styles.btnTextDisabled]}>
                          {isSigned ? 'Confirm Promise & Start' : 'Sign Above to Start'}
                        </ThemedText>
                        <ThemedText style={[styles.btnArrow, !isSigned && styles.btnTextDisabled]}>➔</ThemedText>
                      </>
                    )}
                  </LinearGradient>
                </TouchableOpacity>
                <ThemedText style={styles.ctaNote}>
                  Your journey to strong self-control starts today.
                </ThemedText>
              </Animated.View>
            </View>
          </ScrollView>
        </Animated.View>
      </SafeAreaView>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000000', overflow: 'hidden' },
  glow1: {
    position: 'absolute',
    top: -80,
    right: -80,
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: 'rgba(0, 229, 255, 0.12)',
  },
  glow2: {
    position: 'absolute',
    bottom: -100,
    left: -100,
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: 'rgba(99, 102, 241, 0.12)',
  },
  glow3: {
    position: 'absolute',
    top: '40%',
    left: '30%',
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: 'rgba(0, 229, 255, 0.05)',
  },
  safeArea: { flex: 1 },
  mainWrapper: { flex: 1 },
  scrollContent: { flexGrow: 1, paddingBottom: 50 },
  responsiveContainer: { width: '100%', maxWidth: 600, alignSelf: 'center' },

  // Hero Section
  heroSection: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.four,
    paddingBottom: Spacing.three,
  },
  heroTopRow: { marginBottom: 14 },
  heroBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    backgroundColor: 'rgba(0,200,81,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(0,200,81,0.25)',
  },
  heroBadgeText: { color: '#00C851', fontSize: 10, fontWeight: '800', letterSpacing: 1.2 },
  heroGreeting: {
    color: 'rgba(255,255,255,0.5)', fontSize: 16,
    fontWeight: '500', marginBottom: 4,
  },
  heroTitle: {
    fontSize: 34, fontWeight: '800', color: '#ffffff',
    letterSpacing: -1, lineHeight: 40, marginBottom: 10,
    fontFamily: Platform.select({ ios: 'Didot', android: 'serif', default: 'serif' }),
  },
  heroTitleAccent: { color: '#00A8FF' },
  heroSubtitle: {
    fontSize: 14, color: 'rgba(255,255,255,0.45)',
    lineHeight: 21, fontWeight: '400',
  },

  // Oath Card
  oathCard: {
    marginHorizontal: Spacing.four,
    marginTop: 10,
    backgroundColor: '#0E0F12',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(0,168,255,0.18)',
    padding: 16,
    gap: 12,
  },
  oathHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  oathHeaderTitle: {
    color: '#00A8FF',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  oathDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.06)',
    marginVertical: 2,
  },
  oathBodyText: {
    color: 'rgba(255,255,255,0.65)',
    fontSize: 13,
    lineHeight: 21,
    fontWeight: '400',
  },
  oathHighlight: {
    color: '#ffffff',
    fontWeight: '700',
  },
  oathWarning: {
    color: '#FF6B35',
    fontWeight: '700',
  },

  // Compact Square Signature Card (Low padding, sleek square design)
  signatureSquareCard: {
    marginHorizontal: Spacing.four,
    marginTop: 18,
    backgroundColor: '#0E0F12',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    padding: 14,
  },
  sigCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  signatureTitle: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  signatureDesc: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 12,
    lineHeight: 16,
    marginBottom: 10,
  },
  canvasSquareWrapper: {
    height: 145,
    backgroundColor: '#070709',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(0,168,255,0.15)',
    overflow: 'hidden',
    position: 'relative',
  },
  canvasPlaceholder: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  canvasPlaceholderText: {
    color: 'rgba(255,255,255,0.25)',
    fontSize: 12,
    marginTop: 4,
    fontWeight: '500',
  },
  sigFooterActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
  },
  clearBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  clearBtnText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 11,
    fontWeight: '600',
  },
  signedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0,200,81,0.1)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  signedBadgeText: {
    color: '#00C851',
    fontSize: 11,
    fontWeight: '700',
  },
  sealConfirmationText: {
    color: '#00C851',
    fontSize: 12,
    fontWeight: '700',
  },

  // CTA Section
  ctaSection: { paddingHorizontal: Spacing.four, marginTop: 22 },
  btnContainer: { borderRadius: 20, overflow: 'hidden' },
  btnGradient: {
    paddingVertical: 16,
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8,
  },
  btnText: {
    color: '#ffffff', fontWeight: '800', fontSize: 16, letterSpacing: 0.3,
  },
  btnArrow: { color: '#ffffff', fontSize: 16, fontWeight: 'bold' },
  ctaNote: {
    color: 'rgba(255,255,255,0.25)', fontSize: 12,
    textAlign: 'center', marginTop: 12, fontWeight: '500',
  },
  btnDisabled: {
    opacity: 0.5,
  },
  btnTextDisabled: {
    color: 'rgba(255,255,255,0.35)',
  },
});
