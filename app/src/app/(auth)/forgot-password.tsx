import React, { useState } from 'react';
import { StyleSheet, TouchableOpacity, ScrollView, View, TextInput, ActivityIndicator } from 'react-native';
import { useRouter, Stack, useLocalSearchParams } from 'expo-router';
import { ThemedText } from '@/components/themed-text';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn } from 'react-native-reanimated';
import { authApi } from '@/services/auth-api';
import { useAuthStore } from '@/store/auth-store';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ email?: string }>();
  const { setAuthDraft } = useAuthStore();

  const [email, setEmail] = useState(params.email || '');
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [secureText, setSecureText] = useState(true);

  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [infoMsg, setInfoMsg] = useState<string | null>(null);

  const handleRequestOtp = async () => {
    if (!email.trim() || !email.includes('@')) {
      setErrorMsg('Please enter a valid email address.');
      return;
    }
    setIsLoading(true);
    setErrorMsg(null);
    setInfoMsg(null);
    try {
      const res = await authApi.forgotPasswordRequest(email.trim());
      if (res.success) {
        setOtpSent(true);
        setInfoMsg(`6-digit OTP code sent to ${email.trim()}! Please check your inbox.`);
      } else {
        setErrorMsg(res.message || 'Failed to send verification code.');
      }
    } catch (e: any) {
      setErrorMsg(e?.detail || e?.message || 'No user found for this email address or network error.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!otpCode.trim() || otpCode.trim().length !== 6) {
      setErrorMsg('Please enter the full 6-digit OTP verification code.');
      return;
    }
    if (!newPassword.trim() || newPassword.trim().length < 6) {
      setErrorMsg('New password must be at least 6 characters long.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setErrorMsg('Passwords do not match. Please retype carefully.');
      return;
    }

    setIsLoading(true);
    setErrorMsg(null);
    setInfoMsg(null);

    try {
      const res = await authApi.forgotPasswordReset({
        email: email.trim(),
        code: otpCode.trim(),
        new_password: newPassword.trim(),
      });

      if (res.success) {
        setInfoMsg('Password updated successfully! Redirecting to Login screen...');
        setAuthDraft({ draftPassword: newPassword.trim(), draftEmail: email.trim() });
        setTimeout(() => {
          router.replace({ pathname: '/(auth)/login' as any, params: { email: email.trim() } });
        }, 1500);
      } else {
        setErrorMsg(res.message || 'Failed to reset password. Please check your OTP code.');
      }
    } catch (e: any) {
      setErrorMsg(e?.detail || e?.message || 'Invalid or expired OTP verification code.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => {
            if (router.canGoBack()) {
              router.back();
            } else {
              router.replace('/(auth)/login' as any);
            }
          }}
        >
          <Ionicons name="chevron-back" size={24} color="#00E5FF" />
        </TouchableOpacity>

        <Animated.View entering={FadeIn.duration(400)} style={styles.card}>
          <ThemedText style={styles.title}>Reset Password</ThemedText>
          <ThemedText style={styles.subtitle}>
            {otpSent
              ? 'Enter the 6-digit OTP sent to your email and choose your new password.'
              : 'Enter your account email to receive a password reset verification code.'}
          </ThemedText>

          {errorMsg && (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle" size={18} color="#EF4444" />
              <ThemedText style={styles.errorText}>{errorMsg}</ThemedText>
            </View>
          )}

          {infoMsg && (
            <View style={styles.infoBox}>
              <Ionicons name="checkmark-circle" size={18} color="#10B981" />
              <ThemedText style={styles.infoText}>{infoMsg}</ThemedText>
            </View>
          )}

          {/* Step 1: Email Input */}
          <View style={styles.inputGroup}>
            <ThemedText style={styles.label}>Email Address</ThemedText>
            <View style={styles.inputWrapper}>
              <Ionicons name="mail-outline" size={18} color="#00E5FF" style={{ marginRight: 8 }} />
              <TextInput
                style={styles.input}
                placeholder="you@example.com"
                placeholderTextColor="#64748B"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                editable={!otpSent || isLoading}
              />
            </View>
          </View>

          {/* Step 2: OTP & New Password Fields */}
          {otpSent && (
            <>
              <View style={styles.inputGroup}>
                <ThemedText style={styles.label}>6-Digit OTP Verification Code</ThemedText>
                <View style={styles.inputWrapper}>
                  <Ionicons name="shield-checkmark-outline" size={18} color="#00E5FF" style={{ marginRight: 8 }} />
                  <TextInput
                    style={styles.input}
                    placeholder="123456"
                    placeholderTextColor="#64748B"
                    value={otpCode}
                    onChangeText={setOtpCode}
                    keyboardType="number-pad"
                    maxLength={6}
                  />
                </View>
              </View>

              <View style={styles.inputGroup}>
                <ThemedText style={styles.label}>New Password</ThemedText>
                <View style={styles.inputWrapper}>
                  <Ionicons name="lock-closed-outline" size={18} color="#00E5FF" style={{ marginRight: 8 }} />
                  <TextInput
                    style={styles.input}
                    placeholder="Enter new password (min 6 chars)"
                    placeholderTextColor="#64748B"
                    secureTextEntry={secureText}
                    value={newPassword}
                    onChangeText={setNewPassword}
                    autoCapitalize="none"
                  />
                  <TouchableOpacity onPress={() => setSecureText(!secureText)}>
                    <Ionicons name={secureText ? 'eye-off-outline' : 'eye-outline'} size={18} color="#64748B" />
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.inputGroup}>
                <ThemedText style={styles.label}>Confirm New Password</ThemedText>
                <View style={styles.inputWrapper}>
                  <Ionicons name="lock-closed-outline" size={18} color="#00E5FF" style={{ marginRight: 8 }} />
                  <TextInput
                    style={styles.input}
                    placeholder="Retype new password"
                    placeholderTextColor="#64748B"
                    secureTextEntry={secureText}
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    autoCapitalize="none"
                  />
                </View>
              </View>
            </>
          )}

          <TouchableOpacity
            activeOpacity={0.88}
            onPress={otpSent ? handleResetPassword : handleRequestOtp}
            disabled={isLoading}
            style={styles.btnWrapper}
          >
            <LinearGradient
              colors={['#00E5FF', '#0284C7']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.gradientBtn}
            >
              {isLoading ? (
                <ActivityIndicator color="#000" size="small" />
              ) : (
                <ThemedText style={styles.btnText}>
                  {otpSent ? 'Save New Password & Verify' : 'Send Reset OTP Code'}
                </ThemedText>
              )}
            </LinearGradient>
          </TouchableOpacity>

          {otpSent && (
            <TouchableOpacity
              style={{ alignItems: 'center', marginTop: 8 }}
              onPress={handleRequestOtp}
              disabled={isLoading}
            >
              <ThemedText style={{ color: '#00E5FF', fontSize: 12, fontWeight: '700' }}>
                Resend OTP Code
              </ThemedText>
            </TouchableOpacity>
          )}
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  scrollContent: {
    padding: 20,
    justifyContent: 'center',
    minHeight: '100%',
  },
  backBtn: {
    position: 'absolute',
    top: 20,
    left: 20,
    zIndex: 10,
    padding: 4,
    backgroundColor: 'transparent',
  },
  card: {
    backgroundColor: 'rgba(15, 23, 42, 0.95)',
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(0, 229, 255, 0.25)',
    gap: 16,
    maxWidth: 440,
    width: '100%',
    alignSelf: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 13,
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 4,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    borderRadius: 12,
    padding: 12,
  },
  errorText: {
    color: '#EF4444',
    fontSize: 12.5,
    fontWeight: '600',
    flex: 1,
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
    borderRadius: 12,
    padding: 12,
  },
  infoText: {
    color: '#10B981',
    fontSize: 12.5,
    fontWeight: '600',
    flex: 1,
  },
  inputGroup: {
    gap: 6,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: '#94A3B8',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0F172A',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 12,
    height: 48,
  },
  input: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 14,
  },
  btnWrapper: {
    borderRadius: 12,
    overflow: 'hidden',
    marginTop: 8,
  },
  gradientBtn: {
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnText: {
    color: '#000000',
    fontWeight: '800',
    fontSize: 15,
  },
});
