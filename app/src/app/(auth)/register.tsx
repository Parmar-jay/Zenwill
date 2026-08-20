import React, { useState } from 'react';
import { StyleSheet, TouchableOpacity, ScrollView, View, TextInput, ActivityIndicator } from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { ThemedText } from '@/components/themed-text';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuthStore } from '@/store/auth-store';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn } from 'react-native-reanimated';
import { triggerGoogleAuth } from '@/services/google-auth';

export default function AuthRegisterScreen() {
  const router = useRouter();
  const { draftEmail, draftName, draftPassword, setAuthDraft, register, requestOtp, registerLocal } = useAuthStore();

  const [fullName, setFullName] = useState(draftName || '');
  const [email, setEmail] = useState(draftEmail || '');
  const [password, setPassword] = useState(draftPassword || '');
  const [securePassword, setSecurePassword] = useState(true);

  const [nameFocused, setNameFocused] = useState(false);
  const [emailFocused, setEmailFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);

  const [regError, setRegError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleFullNameChange = (val: string) => {
    setFullName(val);
    setAuthDraft({ draftName: val });
  };

  const handleEmailChange = (val: string) => {
    setEmail(val);
    setAuthDraft({ draftEmail: val });
  };

  const handlePasswordChange = (val: string) => {
    setPassword(val);
    setAuthDraft({ draftPassword: val });
  };

  const handleRegister = async () => {
    if (isLoading) return;

    const trimmedEmail = email.trim();
    const trimmedName = fullName.trim();

    if (!trimmedName) {
      setRegError('Please enter your full name');
      return;
    }
    if (!trimmedEmail || !trimmedEmail.includes('@')) {
      setRegError('Please enter a valid email address');
      return;
    }
    if (!password || password.length < 6) {
      setRegError('Password must be at least 6 characters long');
      return;
    }

    setIsLoading(true);
    setRegError(null);

    try {
      await register(trimmedEmail, password, trimmedName);
      await requestOtp(trimmedEmail).catch(() => {});
      router.replace({ pathname: '/(auth)/verify-email' as any, params: { email: trimmedEmail, name: trimmedName } });
    } catch (err: any) {
      const detail = err?.detail || err?.message || '';
      if (detail.includes('already registered') || detail.includes('exists')) {
        setRegError('Account already exists with this email. Please sign in.');
      } else if (err?.message === 'Network Error' || (err?.status === undefined && err?.message?.includes('Network'))) {
        registerLocal(trimmedEmail);
        router.replace('/(auth)/create-profile' as any);
      } else {
        setRegError(detail || 'Registration failed. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
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
                <ThemedText style={styles.stepText}>Account Creation</ThemedText>
                <ThemedText style={styles.title}>Join ZenWill</ThemedText>
                <ThemedText style={styles.subtitle}>
                  Create your account to start tracking habits, breaking urges, and building mental strength.
                </ThemedText>
              </View>

              {regError ? (
                <View style={styles.errorBanner}>
                  <Ionicons name="alert-circle-outline" size={18} color="#EF4444" />
                  <ThemedText style={styles.errorText}>{regError}</ThemedText>
                </View>
              ) : null}

              {/* Form Inputs */}
              <View style={styles.formContainer}>
                {/* Full Name Input */}
                <View style={[styles.inputCard, nameFocused && styles.inputCardFocused]}>
                  <Ionicons
                    name="person-outline"
                    size={20}
                    color={nameFocused ? '#00E5FF' : 'rgba(255,255,255,0.4)'}
                    style={styles.inputIcon}
                  />
                  <TextInput
                    style={styles.textInput}
                    placeholder="Full Name"
                    placeholderTextColor="rgba(255,255,255,0.3)"
                    value={fullName}
                    onChangeText={handleFullNameChange}
                    autoCapitalize="words"
                    onFocus={() => setNameFocused(true)}
                    onBlur={() => setNameFocused(false)}
                  />
                </View>

                {/* Email Input */}
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

                {/* Password Input */}
                <View style={[styles.inputCard, passwordFocused && styles.inputCardFocused]}>
                  <Ionicons
                    name="lock-closed-outline"
                    size={20}
                    color={passwordFocused ? '#00E5FF' : 'rgba(255,255,255,0.4)'}
                    style={styles.inputIcon}
                  />
                  <TextInput
                    style={styles.textInput}
                    placeholder="Password (6+ chars)"
                    placeholderTextColor="rgba(255,255,255,0.3)"
                    value={password}
                    onChangeText={handlePasswordChange}
                    secureTextEntry={securePassword}
                    onFocus={() => setPasswordFocused(true)}
                    onBlur={() => setPasswordFocused(false)}
                  />
                  <TouchableOpacity
                    onPress={() => setSecurePassword(!securePassword)}
                    style={styles.eyeBtn}
                  >
                    <Ionicons
                      name={securePassword ? 'eye-outline' : 'eye-off-outline'}
                      size={20}
                      color="rgba(255,255,255,0.4)"
                    />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Submit Buttons */}
              <View style={styles.actionSection}>
                <TouchableOpacity
                  style={[styles.primaryButton, isLoading && { opacity: 0.7 }]}
                  activeOpacity={0.85}
                  onPress={handleRegister}
                  disabled={isLoading}
                >
                  <LinearGradient
                    colors={['#00E5FF', '#3B82F6']}
                    style={styles.buttonGradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                  >
                    {isLoading ? (
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <ActivityIndicator size="small" color="#ffffff" style={{ marginRight: 8 }} />
                        <ThemedText style={styles.primaryButtonText}>Creating Account...</ThemedText>
                      </View>
                    ) : (
                      <ThemedText style={styles.primaryButtonText}>Create Account</ThemedText>
                    )}
                  </LinearGradient>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.switchAuthLink}
                  onPress={() => router.push('/(auth)/login' as any)}
                >
                  <ThemedText style={styles.switchAuthText}>
                    Already have an account? <ThemedText style={styles.switchAuthHighlight}>Sign In</ThemedText>
                  </ThemedText>
                </TouchableOpacity>

                {/* Google Sign In */}
                <View style={{ marginTop: 24, alignItems: 'center' }}>
                  <ThemedText style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, marginBottom: 12 }}>
                    Or register with Google
                  </ThemedText>
                  <TouchableOpacity
                    style={styles.googleBtn}
                    activeOpacity={0.8}
                    onPress={() => triggerGoogleAuth()}
                  >
                    <ThemedText style={{ color: '#ffffff', fontWeight: '700', fontSize: 16 }}>G</ThemedText>
                    <ThemedText style={{ color: '#ffffff', fontWeight: '600', fontSize: 14, marginLeft: 8 }}>
                      Continue with Google
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
  safeArea: {
    flex: 1,
  },
  mainWrapper: {
    flex: 1,
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
    fontWeight: '800',
    letterSpacing: 2,
  },
  logoZen: {
    color: '#ffffff',
  },
  logoWill: {
    color: '#00E5FF',
  },
  scrollContent: {
    paddingBottom: 40,
  },
  contentContainer: {
    paddingHorizontal: 24,
    paddingTop: 12,
  },
  titleSection: {
    marginBottom: 24,
  },
  stepText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#00E5FF',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginBottom: 4,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#ffffff',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.6)',
    lineHeight: 20,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239,68,68,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.3)',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 16,
    gap: 8,
  },
  errorText: {
    color: '#EF4444',
    fontSize: 13,
    flex: 1,
  },
  formContainer: {
    gap: 14,
    marginBottom: 24,
  },
  inputCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0F1117',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 14,
    paddingHorizontal: 14,
    height: 52,
  },
  inputCardFocused: {
    borderColor: '#00E5FF',
    backgroundColor: '#121622',
  },
  inputIcon: {
    marginRight: 10,
  },
  textInput: {
    flex: 1,
    color: '#ffffff',
    fontSize: 15,
    height: '100%',
  },
  eyeBtn: {
    padding: 6,
  },
  actionSection: {
    gap: 16,
  },
  primaryButton: {
    borderRadius: 14,
    overflow: 'hidden',
  },
  buttonGradient: {
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  switchAuthLink: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  switchAuthText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 14,
  },
  switchAuthHighlight: {
    color: '#00E5FF',
    fontWeight: '700',
  },
  googleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#161922',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 14,
    height: 48,
    width: '100%',
  },
});
