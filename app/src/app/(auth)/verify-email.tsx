import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  View,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter, useLocalSearchParams, Stack } from 'expo-router';
import { ThemedText } from '@/components/themed-text';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuthStore } from '@/store/auth-store';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';

export default function VerifyEmailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { draftEmail, draftName, verifyOtp, requestOtp, isLoading, error, clearError } = useAuthStore();

  const targetEmail = (params.email as string) || draftEmail || '';
  const targetName = (params.name as string) || draftName || '';

  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [localError, setLocalError] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(30);
  const [isResending, setIsResending] = useState(false);

  const inputRefs = useRef<Array<TextInput | null>>([]);

  useEffect(() => {
    let timer: any;
    if (resendCooldown > 0) {
      timer = setInterval(() => setResendCooldown((prev) => prev - 1), 1000);
    }
    return () => clearInterval(timer);
  }, [resendCooldown]);

  const handleOtpChange = (text: string, index: number) => {
    setLocalError(null);
    clearError();

    // Handle paste or auto-fill of multiple digits
    const cleanDigits = text.replace(/[^0-9]/g, '');
    if (cleanDigits.length > 1) {
      const newOtp = [...otp];
      for (let i = 0; i < cleanDigits.length && index + i < 6; i++) {
        newOtp[index + i] = cleanDigits[i];
      }
      setOtp(newOtp);
      const nextFocus = Math.min(5, index + cleanDigits.length);
      inputRefs.current[nextFocus]?.focus();

      if (newOtp.every((d) => d.length === 1)) {
        triggerDirectVerification(newOtp.join(''));
      }
      return;
    }

    const singleDigit = cleanDigits.slice(-1);
    const newOtp = [...otp];
    newOtp[index] = singleDigit;
    setOtp(newOtp);

    // Auto-focus next input field
    if (singleDigit && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto-verify if all 6 filled
    if (singleDigit && index === 5 && newOtp.every((d) => d.length === 1)) {
      triggerDirectVerification(newOtp.join(''));
    }
  };

  const handleKeyPress = (e: any, index: number) => {
    if (e.nativeEvent.key === 'Backspace') {
      if (!otp[index] && index > 0) {
        const newOtp = [...otp];
        newOtp[index - 1] = '';
        setOtp(newOtp);
        inputRefs.current[index - 1]?.focus();
      }
    }
  };

  const triggerDirectVerification = async (code: string) => {
    if (isVerifying || isLoading) return;
    setIsVerifying(true);
    setLocalError(null);
    clearError();

    try {
      await verifyOtp(targetEmail, code, targetName);
      router.replace('/(auth)/create-profile' as any);
    } catch (err: any) {
      setLocalError(err?.detail || err?.message || 'Invalid OTP code. Please try again.');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleVerify = async () => {
    const code = otp.join('');
    if (code.length < 6) {
      setLocalError('Please enter all 6 digits of the OTP code');
      return;
    }
    triggerDirectVerification(code);
  };

  const handleResend = async () => {
    if (resendCooldown > 0 || isResending) return;
    setIsResending(true);
    setLocalError(null);
    try {
      await requestOtp(targetEmail);
      setResendCooldown(60);
    } catch (err: any) {
      setLocalError(err?.detail || 'Failed to resend code');
    } finally {
      setIsResending(false);
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
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.mainWrapper}
        >
          {/* Header Row */}
          <View style={styles.headerRow}>
            <TouchableOpacity
              onPress={() => router.replace('/(auth)/register' as any)}
              style={styles.backBtn}
              activeOpacity={0.7}
            >
              <Ionicons name="arrow-back" size={22} color="#ffffff" />
            </TouchableOpacity>
            <ThemedText style={styles.headerTitle}>Verify Email</ThemedText>
            <View style={{ width: 38 }} />
          </View>

          <View style={styles.content}>
            <Animated.View entering={FadeInDown.duration(400)} style={styles.titleCard}>
              <View style={styles.iconCircle}>
                <Ionicons name="mail-open-outline" size={32} color="#00E5FF" />
              </View>
              <ThemedText style={styles.title}>Verification Code Sent</ThemedText>
              <ThemedText style={styles.subtitle}>
                We emailed a 6-digit verification code to{' '}
                <ThemedText style={styles.emailHighlight}>{targetEmail || 'your email'}</ThemedText>. Enter the code below to complete registration.
              </ThemedText>
            </Animated.View>

            {/* Error Message */}
            {(localError || error) && (
              <Animated.View entering={FadeIn} style={styles.errorBox}>
                <Ionicons name="alert-circle" size={16} color="#EF4444" style={{ marginRight: 6 }} />
                <ThemedText style={styles.errorText}>{localError || error}</ThemedText>
              </Animated.View>
            )}

            {/* OTP 6-Digit Code Inputs */}
            <Animated.View entering={FadeInDown.delay(150).duration(400)} style={styles.otpContainer}>
              {otp.map((digit, idx) => (
                <TextInput
                  key={idx}
                  ref={(ref) => { inputRefs.current[idx] = ref; }}
                  style={[
                    styles.otpBox,
                    digit ? styles.otpBoxFilled : null,
                    inputRefs.current[idx]?.isFocused() ? styles.otpBoxFocused : null,
                  ]}
                  value={digit}
                  onChangeText={(text) => handleOtpChange(text, idx)}
                  onKeyPress={(e) => handleKeyPress(e, idx)}
                  keyboardType="number-pad"
                  maxLength={idx === 0 ? 6 : 1}
                  selectTextOnFocus
                />
              ))}
            </Animated.View>

            {/* Verify CTA Button with Loading State */}
            <TouchableOpacity
              style={[styles.primaryButton, (isVerifying || isLoading) && { opacity: 0.7 }]}
              activeOpacity={0.85}
              onPress={handleVerify}
              disabled={isVerifying || isLoading}
            >
              <LinearGradient
                colors={['#00E5FF', '#3B82F6']}
                style={styles.buttonGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                {isVerifying || isLoading ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <ActivityIndicator size="small" color="#ffffff" style={{ marginRight: 8 }} />
                    <ThemedText style={styles.primaryButtonText}>Verifying Code...</ThemedText>
                  </View>
                ) : (
                  <ThemedText style={styles.primaryButtonText}>Verify & Continue</ThemedText>
                )}
              </LinearGradient>
            </TouchableOpacity>

            {/* Resend Code Link */}
            <View style={styles.resendRow}>
              <ThemedText style={styles.resendLabel}>Didn't receive the code?</ThemedText>
              <TouchableOpacity
                onPress={handleResend}
                disabled={resendCooldown > 0 || isResending}
                activeOpacity={0.7}
              >
                {isResending ? (
                  <ActivityIndicator size="small" color="#00E5FF" style={{ marginLeft: 6 }} />
                ) : (
                  <ThemedText
                    style={[
                      styles.resendBtnText,
                      resendCooldown > 0 && { color: 'rgba(255, 255, 255, 0.3)' },
                    ]}
                  >
                    {resendCooldown > 0 ? ` Resend in ${resendCooldown}s` : ' Resend Code'}
                  </ThemedText>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
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
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'center',
  },
  titleCard: {
    alignItems: 'center',
    marginBottom: 24,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(0, 229, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(0, 229, 255, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: '#ffffff',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.6)',
    textAlign: 'center',
    lineHeight: 20,
  },
  emailHighlight: {
    color: '#00E5FF',
    fontWeight: '700',
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  errorText: {
    color: '#FCA5A5',
    fontSize: 13,
    flex: 1,
  },
  otpContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  otpBox: {
    width: 46,
    height: 54,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    textAlign: 'center',
    fontSize: 20,
    fontWeight: '800',
    color: '#ffffff',
  },
  otpBoxFilled: {
    borderColor: '#00E5FF',
    backgroundColor: 'rgba(0, 229, 255, 0.08)',
  },
  otpBoxFocused: {
    borderColor: '#00E5FF',
    backgroundColor: 'rgba(0, 229, 255, 0.12)',
  },
  primaryButton: {
    borderRadius: 14,
    overflow: 'hidden',
    marginBottom: 16,
  },
  buttonGradient: {
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    color: '#ffffff',
    fontWeight: '800',
    fontSize: 16,
  },
  resendRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
  resendLabel: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.5)',
  },
  resendBtnText: {
    fontSize: 13,
    color: '#00E5FF',
    fontWeight: '700',
  },
});
