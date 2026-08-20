import React, { useState } from 'react';
import { StyleSheet, TouchableOpacity, ScrollView, View, TextInput, ActivityIndicator } from 'react-native';
import { useRouter, Stack, useLocalSearchParams } from 'expo-router';
import { ThemedText } from '@/components/themed-text';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuthStore } from '@/store/auth-store';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn } from 'react-native-reanimated';
import { triggerGoogleAuth } from '@/services/google-auth';

export default function AuthLoginScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ email?: string }>();
  const { draftEmail, draftPassword, setAuthDraft, login, loginLocal } = useAuthStore();

  const [email, setEmail] = useState(params.email || draftEmail || '');
  const [password, setPassword] = useState(draftPassword || '');
  const [securePassword, setSecurePassword] = useState(true);

  const [emailFocused, setEmailFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);

  const [loginError, setLoginError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleEmailChange = (val: string) => {
    setEmail(val);
    setAuthDraft({ draftEmail: val });
  };

  const handlePasswordChange = (val: string) => {
    setPassword(val);
    setAuthDraft({ draftPassword: val });
  };

  const handlePasswordLogin = async () => {
    if (!email.trim() || !password.trim()) {
      setLoginError('Please enter your email and password');
      return;
    }
    setIsLoading(true);
    setLoginError(null);
    try {
      await login(email.trim(), password);
      const { isOnboarded } = useAuthStore.getState();
      if (isOnboarded) {
        router.replace('/(tabs)/home' as any);
      } else {
        router.replace('/(auth)/create-profile' as any);
      }
    } catch (err: any) {
      const detail = err?.detail || err?.message || '';
      if (detail === 'email_unverified' || detail.includes('unverified')) {
        router.replace({ pathname: '/(auth)/verify-email' as any, params: { email: email.trim() } });
      } else if (err?.message === 'Network Error' || (err?.status === undefined && err?.message?.includes('Network'))) {
        loginLocal(email);
        router.replace('/(tabs)/home' as any);
      } else {
        setLoginError(detail || 'Incorrect password or invalid email. Please check your credentials.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenForgotPassword = () => {
    router.push({ pathname: '/(auth)/forgot-password' as any, params: { email: email.trim() } });
  };

  return (
    <View style={styles.container}>
      {/* Ambient background glow effects */}
      <View style={styles.ambientGlow1} pointerEvents="none" />
      <View style={styles.ambientGlow2} pointerEvents="none" />

      {/* Deep Gradient Fade overlay */}
      <LinearGradient
        colors={['rgba(0,0,0,0.1)', '#000000']}
        style={styles.fadeOverlay}
        pointerEvents="none"
      />

      <Stack.Screen options={{ headerShown: false }} />

      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom', 'left', 'right']}>
        <Animated.View entering={FadeIn.duration(400)} style={styles.mainWrapper}>
          {/* Header Row */}
          <View style={styles.headerRow}>
            <TouchableOpacity
              activeOpacity={0.6}
              style={styles.backButton}
              onPress={() => router.replace('/(auth)/welcome' as any)}
            >
              <Ionicons name="chevron-back" size={24} color="#00E5FF" />
            </TouchableOpacity>

            <View style={styles.logoCenter}>
              <ThemedText style={styles.logoText}>
                <ThemedText style={styles.logoZen}>ZEN</ThemedText>
                <ThemedText style={styles.logoWill}>WILL</ThemedText>
              </ThemedText>
            </View>

            <View style={{ width: 40 }} />
          </View>

          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.contentContainer}>
              <View style={styles.titleSection}>
                <ThemedText style={styles.stepText}>Secure Access</ThemedText>
                <ThemedText style={styles.title}>Welcome Back</ThemedText>
                <ThemedText style={styles.subtitle}>
                  Sign in with your Email ID and Password to continue your self-mastery.
                </ThemedText>
              </View>

              {/* Error Banner with Forgot Password option */}
              {loginError && (
                <View style={styles.errorCard}>
                  <Ionicons name="alert-circle" size={20} color="#FF4D4D" style={{ marginRight: 8, marginTop: 2 }} />
                  <View style={{ flex: 1 }}>
                    <ThemedText style={styles.errorText}>{loginError}</ThemedText>
                    <TouchableOpacity
                      style={styles.forgotPassErrorBtn}
                      activeOpacity={0.7}
                      onPress={handleOpenForgotPassword}
                    >
                      <ThemedText style={styles.forgotPassErrorText}>
                        Forgot password? Reset via OTP →
                      </ThemedText>
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              {/* Form Controls */}
              <View style={styles.formContainer}>
                {/* Email Field */}
                <View style={[styles.inputCard, emailFocused && styles.inputCardFocused]}>
                  <Ionicons
                    name="mail-outline"
                    size={20}
                    color={emailFocused ? '#00E5FF' : 'rgba(255,255,255,0.4)'}
                    style={styles.inputIcon}
                  />
                  <TextInput
                    style={styles.textInput}
                    placeholder="Email Address"
                    placeholderTextColor="rgba(255,255,255,0.3)"
                    value={email}
                    onChangeText={handleEmailChange}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    onFocus={() => setEmailFocused(true)}
                    onBlur={() => setEmailFocused(false)}
                  />
                </View>

                {/* Password Field */}
                <View style={[styles.inputCard, passwordFocused && styles.inputCardFocused]}>
                  <Ionicons
                    name="lock-closed-outline"
                    size={20}
                    color={passwordFocused ? '#00E5FF' : 'rgba(255,255,255,0.4)'}
                    style={styles.inputIcon}
                  />
                  <TextInput
                    style={styles.textInput}
                    placeholder="Password"
                    placeholderTextColor="rgba(255,255,255,0.3)"
                    secureTextEntry={securePassword}
                    value={password}
                    onChangeText={handlePasswordChange}
                    autoCapitalize="none"
                    onFocus={() => setPasswordFocused(true)}
                    onBlur={() => setPasswordFocused(false)}
                  />
                  <TouchableOpacity
                    style={styles.eyeToggle}
                    onPress={() => setSecurePassword(!securePassword)}
                  >
                    <Ionicons
                      name={securePassword ? 'eye-off-outline' : 'eye-outline'}
                      size={18}
                      color="rgba(255,255,255,0.5)"
                    />
                  </TouchableOpacity>
                </View>

                {/* Forgot Password Link */}
                <TouchableOpacity
                  style={styles.forgotPasswordRow}
                  activeOpacity={0.7}
                  onPress={handleOpenForgotPassword}
                >
                  <ThemedText style={styles.forgotPasswordText}>
                    Forgot Password?
                  </ThemedText>
                </TouchableOpacity>
              </View>

              {/* Submit Buttons */}
              <View style={styles.actionSection}>
                <TouchableOpacity
                  style={styles.primaryButton}
                  activeOpacity={0.85}
                  onPress={handlePasswordLogin}
                  disabled={isLoading}
                >
                  <LinearGradient
                    colors={['#00E5FF', '#3B82F6']}
                    style={styles.buttonGradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                  >
                    {isLoading ? (
                      <ActivityIndicator color="#000" size="small" />
                    ) : (
                      <ThemedText style={styles.primaryButtonText}>
                        Sign In
                      </ThemedText>
                    )}
                  </LinearGradient>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.switchAuthLink}
                  onPress={() => router.push('/(auth)/register' as any)}
                >
                  <ThemedText style={styles.switchAuthText}>
                    Don't have an account? <ThemedText style={styles.switchAuthHighlight}>Sign Up</ThemedText>
                  </ThemedText>
                </TouchableOpacity>

                {/* Or Continue with Google */}
                <View style={{ marginTop: 24, alignItems: 'center' }}>
                  <TouchableOpacity
                    activeOpacity={0.8}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      backgroundColor: '#111216',
                      borderWidth: 1,
                      borderColor: 'rgba(255, 255, 255, 0.1)',
                      borderRadius: 14,
                      paddingVertical: 12,
                      paddingHorizontal: 20,
                      gap: 10,
                    }}
                    onPress={() => triggerGoogleAuth()}
                  >
                    <Ionicons name="logo-google" size={18} color="#4285F4" />
                    <ThemedText style={{ color: '#ffffff', fontWeight: '600', fontSize: 14 }}>
                      Sign In with Google
                    </ThemedText>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </ScrollView>
        </Animated.View>
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
  safeArea: {
    flex: 1,
  },
  mainWrapper: {
    flex: 1,
  },
  ambientGlow1: {
    position: 'absolute',
    top: -80,
    right: -80,
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: 'rgba(0, 229, 255, 0.12)',
  },
  ambientGlow2: {
    position: 'absolute',
    bottom: -100,
    left: -100,
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: 'rgba(99, 102, 241, 0.12)',
  },
  fadeOverlay: {
    ...StyleSheet.absoluteFill,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  backButton: {
    backgroundColor: 'transparent',
    padding: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoCenter: {
    alignItems: 'center',
  },
  logoText: {
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: 2,
  },
  logoZen: {
    color: '#ffffff',
  },
  logoWill: {
    color: '#00E5FF',
  },
  scrollContent: {
    flexGrow: 1,
    alignItems: 'center',
  },
  contentContainer: {
    width: '100%',
    maxWidth: 440,
    paddingHorizontal: 20,
    paddingBottom: 40,
    paddingTop: 10,
  },
  titleSection: {
    marginBottom: 24,
    gap: 4,
  },
  stepText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#00E5FF',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  title: {
    fontSize: 28,
    fontWeight: '900',
    color: '#ffffff',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.6)',
    lineHeight: 18,
    marginTop: 4,
  },
  errorCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    borderRadius: 14,
    padding: 12,
    marginBottom: 16,
  },
  errorText: {
    color: '#EF4444',
    fontSize: 12.5,
    fontWeight: '600',
    lineHeight: 17,
  },
  forgotPassErrorBtn: {
    marginTop: 6,
  },
  forgotPassErrorText: {
    color: '#00E5FF',
    fontSize: 12,
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
  formContainer: {
    gap: 14,
  },
  inputCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 14,
    height: 52,
  },
  inputCardFocused: {
    borderColor: '#00E5FF',
    backgroundColor: 'rgba(0, 229, 255, 0.05)',
  },
  inputIcon: {
    marginRight: 10,
  },
  textInput: {
    flex: 1,
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '500',
  },
  eyeToggle: {
    padding: 6,
  },
  forgotPasswordRow: {
    alignSelf: 'flex-end',
    paddingVertical: 2,
  },
  forgotPasswordText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#00E5FF',
  },
  actionSection: {
    marginTop: 24,
    gap: 12,
  },
  primaryButton: {
    borderRadius: 14,
    overflow: 'hidden',
  },
  buttonGradient: {
    height: 52,
    justifyContent: 'center',
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#000000',
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 0.3,
  },
  switchAuthLink: {
    alignItems: 'center',
    marginTop: 12,
  },
  switchAuthText: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.6)',
  },
  switchAuthHighlight: {
    color: '#00E5FF',
    fontWeight: '800',
  },
});
