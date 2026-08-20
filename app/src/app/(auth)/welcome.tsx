import React, { useState, useEffect, useRef, useMemo } from 'react';
import { StyleSheet, TouchableOpacity, View, Animated, Platform, Dimensions, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuthStore } from '@/store/auth-store';
import { triggerGoogleAuth } from '@/services/google-auth';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const SLIDES = [
  {
    image: require('../../../assets/images/neural_brain_silhouette.png'),
    headline: "Unleash the\nPotential of\nYour Mind",
    highlight: "Your Mind",
    subheading: "ZenWill is your AI-powered companion for mental strength, clarity, and lasting transformation."
  },
  {
    image: require('../../../assets/images/neural_brain_focus.png'),
    headline: "Master the\nFocus of\nYour Intent",
    highlight: "Your Intent",
    subheading: "Train your attention span, quiet the noise, and align your daily habits with deep work."
  },
  {
    image: require('../../../assets/images/neural_brain_discipline.png'),
    headline: "Forge the\nStrength of\nYour Will",
    highlight: "Your Will",
    subheading: "Build mental resilience, track urge patterns, and break habits before they become automated."
  },
  {
    image: require('../../../assets/images/neural_brain_vision.png'),
    headline: "Expand the\nHorizon of\nYour Vision",
    highlight: "Your Vision",
    subheading: "Connect with your long-term identity and design monthly missions to achieve self-mastery."
  }
];

export default function AuthWelcomeScreen() {
  const router = useRouter();
  const loginWithGoogle = useAuthStore((state) => state.loginWithGoogle);
  const [currentSlide, setCurrentSlide] = useState(0);
  const fadeAnim = useMemo(() => new Animated.Value(1), []);

  // Auto-play slides every 7 seconds with a smooth cross-dissolve fade out / fade in animation
  useEffect(() => {
    const timer = setInterval(() => {
      // Fade out
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 500,
        useNativeDriver: true,
      }).start(() => {
        // Change slide index once fully invisible
        setCurrentSlide((prev) => (prev + 1) % SLIDES.length);
        // Fade in
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }).start();
      });
    }, 7000);

    return () => clearInterval(timer);
  }, [fadeAnim]);

  const slide = SLIDES[currentSlide];
  const headlineParts = slide.headline.split(slide.highlight);

  return (
    <View style={styles.container}>
      {/* Background Mind Image (Animated opacity based on transition state) */}
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        <Animated.Image
          source={slide.image}
          style={[styles.backgroundImage, {
            opacity: fadeAnim.interpolate({
              inputRange: [0, 1],
              outputRange: [0, 0.85] // Maintain custom max opacity bounds
            })
          }]}
        />
      </View>

      {/* Luxury Vignette Fade Overlay to Dark Grey/Black */}
      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.4)', '#000000', '#000000']}
        style={styles.fadeOverlay}
        pointerEvents="none"
      />

      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom', 'left', 'right']}>
        {/* Top Logo - ZEN in white, WILL in blue */}
        <View style={styles.logoContainer}>
          <ThemedText style={styles.logoText}>
            <ThemedText style={styles.logoZen}>ZEN</ThemedText>
            <ThemedText style={styles.logoWill}>WILL</ThemedText>
          </ThemedText>
        </View>

        {/* Outer ScrollView to ensure responsiveness across all phone screens */}
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          {/* Content Area */}
          <View style={styles.contentContainer}>

            {/* Animated content box to transition quotes cleanly */}
            <Animated.View style={[styles.textGroupContainer, { opacity: fadeAnim }]}>
              <View style={styles.headlineBox}>
                <ThemedText style={styles.headline}>
                  {headlineParts[0]}
                  <ThemedText style={styles.highlightText}>{slide.highlight}</ThemedText>
                  {headlineParts[1]}
                </ThemedText>
              </View>

              <View style={styles.subheadingBox}>
                <ThemedText style={styles.subheading}>
                  {slide.subheading}
                </ThemedText>
              </View>
            </Animated.View>

            {/* Action Buttons with subtle blue glowing touch */}
            <View style={styles.buttonGroup}>
              {/* Get Started Button */}
              <TouchableOpacity
                activeOpacity={0.85}
                style={styles.btnPrimaryContainer}
                onPress={() => router.push('/(auth)/register' as any)}
              >
                <LinearGradient
                  colors={['#1F2126', '#101114']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 0, y: 1 }}
                  style={styles.btnPrimaryGradient}
                >
                  <ThemedText style={styles.btnPrimaryText}>Get Started</ThemedText>
                </LinearGradient>
              </TouchableOpacity>

              {/* I already have an account Button */}
              <TouchableOpacity
                activeOpacity={0.8}
                style={styles.btnSecondary}
                onPress={() => router.push('/(auth)/login' as any)}
              >
                <ThemedText style={styles.btnSecondaryText}>I already have an account</ThemedText>
              </TouchableOpacity>
            </View>

            {/* Divider */}
            <View style={styles.dividerRow}>
              <View style={styles.dividerLine} />
              <ThemedText style={styles.dividerText}>or continue with</ThemedText>
              <View style={styles.dividerLine} />
            </View>

            {/* Social Row */}
            <View style={styles.socialRow}>
              {/* Google */}
              <TouchableOpacity
                activeOpacity={0.75}
                style={styles.socialButton}
                onPress={() => triggerGoogleAuth()}
              >
                <ThemedText style={styles.socialIconTextG}>G</ThemedText>
              </TouchableOpacity>

              {/* Email */}
              <TouchableOpacity
                activeOpacity={0.75}
                style={styles.socialButton}
                onPress={() => router.push('/(auth)/login' as any)}
              >
                <ThemedText style={styles.socialIconTextMail}>✉</ThemedText>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
    overflow: 'hidden',
  },
  backgroundImage: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    width: '100%',
    height: SCREEN_HEIGHT * 0.60,
  },
  fadeOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
  },
  safeArea: {
    flex: 1,
  },
  logoContainer: {
    alignItems: 'center',
    paddingTop: Spacing.two,
    height: 50,
    zIndex: 10,
  },
  logoText: {
    fontSize: 24,
    fontFamily: Platform.select({ ios: 'Didot', android: 'serif', default: 'serif' }),
    fontWeight: '800',
    letterSpacing: 3,
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  logoZen: {
    color: '#ffffff',
  },
  logoWill: {
    color: '#00A8FF', // Signature Electric Blue Logo portion
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'flex-end',
  },
  contentContainer: {
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.four,
    justifyContent: 'flex-end',
  },
  textGroupContainer: {
    minHeight: 180,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.three,
    gap: Spacing.two,
  },
  headlineBox: {
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 90,
  },
  headline: {
    fontSize: SCREEN_HEIGHT < 700 ? 26 : 30,
    fontFamily: Platform.select({ ios: 'Georgia', android: 'serif', default: 'serif' }),
    fontStyle: 'italic',
    fontWeight: '800',
    color: '#ffffff',
    textAlign: 'center',
    lineHeight: SCREEN_HEIGHT < 700 ? 34 : 38,
    letterSpacing: -0.2,
    textShadowColor: 'rgba(0, 0, 0, 0.95)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
  },
  highlightText: {
    color: '#00A8FF', // Elegant electric blue accent inside quote
    fontStyle: 'italic',
    fontWeight: '800',
    textShadowColor: 'rgba(0, 0, 0, 0.95)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
  },
  subheadingBox: {
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 50,
  },
  subheading: {
    fontSize: SCREEN_HEIGHT < 700 ? 13 : 15,
    color: 'rgba(255, 255, 255, 0.85)',
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: Spacing.three,
    textShadowColor: 'rgba(0, 0, 0, 0.95)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
  },
  buttonGroup: {
    gap: Spacing.two,
  },
  btnPrimaryContainer: {
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(0, 168, 255, 0.35)', // Glowing blue frame
  },
  btnPrimaryGradient: {
    paddingVertical: SCREEN_HEIGHT < 700 ? 14 : 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnPrimaryText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 16,
  },
  btnSecondary: {
    backgroundColor: 'rgba(255, 255, 255, 0.01)',
    borderRadius: 16,
    paddingVertical: SCREEN_HEIGHT < 700 ? 14 : 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  btnSecondaryText: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontWeight: '600',
    fontSize: 15,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    marginVertical: SCREEN_HEIGHT < 700 ? 14 : 20,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  dividerText: {
    color: 'rgba(255, 255, 255, 0.3)',
    fontSize: 12,
  },
  socialRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
    marginBottom: Spacing.one,
  },
  socialButton: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: '#111215',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.04)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  socialIconText: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 22,
    fontWeight: '600',
  },
  socialIconTextG: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 20,
    fontWeight: '600',
  },
  socialIconTextMail: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 20,
    fontWeight: '600',
  },
});
