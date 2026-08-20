import React, { useState } from 'react';
import {
  StyleSheet,
  Modal,
  View,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  TouchableWithoutFeedback,
  Keyboard,
} from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuthStore } from '@/store/auth-store';
import { promptGoogleOAuth } from '@/services/google-auth';

interface GoogleAuthModalProps {
  visible: boolean;
  onClose: () => void;
  initialEmail?: string;
}

export function GoogleAuthModal({ visible, onClose, initialEmail = '' }: GoogleAuthModalProps) {
  const loginWithGoogle = useAuthStore((state) => state.loginWithGoogle);

  const [email, setEmail] = useState(initialEmail);
  const [name, setName] = useState('');
  const [idToken, setIdToken] = useState('');
  const [showManualForm, setShowManualForm] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleLaunchGoogleOAuth = async () => {
    setIsLoading(true);
    setErrorMsg(null);
    const res = await promptGoogleOAuth();
    setIsLoading(false);
    if (res.success) {
      onClose();
    } else if (res.error) {
      setErrorMsg(res.error);
    }
  };

  const handleManualGoogleSubmit = async () => {
    const targetEmail = email.trim() || 'google.user@zenwill.me';
    setIsLoading(true);
    setErrorMsg(null);

    try {
      await loginWithGoogle({
        email: targetEmail,
        name: name.trim() || undefined,
        id_token: idToken.trim() || undefined,
      });
      setIsLoading(false);
      onClose();
    } catch (err: any) {
      setIsLoading(false);
      setErrorMsg(err?.detail || err?.message || 'Google authentication failed');
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <View style={styles.backdrop}>
          <TouchableWithoutFeedback>
            <View style={styles.modalCard}>
              {/* Header */}
              <View style={styles.headerRow}>
                <View style={styles.googleBadge}>
                  <ThemedText style={styles.googleBadgeText}>G</ThemedText>
                </View>
                <View style={{ flex: 1 }}>
                  <ThemedText style={styles.title}>Google Authentication</ThemedText>
                  <ThemedText style={styles.subtitle}>Select your Google Account to Sign In</ThemedText>
                </View>
                <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                  <Ionicons name="close" size={20} color="rgba(255, 255, 255, 0.6)" />
                </TouchableOpacity>
              </View>

              {/* Error Box */}
              {errorMsg && (
                <View style={styles.errorBox}>
                  <Ionicons name="alert-circle" size={16} color="#EF4444" />
                  <ThemedText style={styles.errorText}>{errorMsg}</ThemedText>
                </View>
              )}

              {/* Primary OAuth Launcher Button */}
              <TouchableOpacity
                style={styles.googleOAuthBtn}
                activeOpacity={0.85}
                onPress={handleLaunchGoogleOAuth}
                disabled={isLoading}
              >
                <View style={styles.googleOAuthBtnInner}>
                  {isLoading ? (
                    <ActivityIndicator size="small" color="#4285F4" />
                  ) : (
                    <>
                      <Ionicons name="logo-google" size={20} color="#4285F4" style={{ marginRight: 10 }} />
                      <ThemedText style={styles.googleOAuthText}>Choose Google Account</ThemedText>
                    </>
                  )}
                </View>
              </TouchableOpacity>

              {/* Manual / Dev Toggle */}
              <TouchableOpacity
                style={styles.manualToggle}
                onPress={() => setShowManualForm(!showManualForm)}
              >
                <ThemedText style={styles.manualToggleText}>
                  {showManualForm ? 'Hide manual test input' : 'Or test with custom Google email'}
                </ThemedText>
              </TouchableOpacity>

              {showManualForm && (
                <View style={styles.manualContainer}>
                  <View style={styles.formGroup}>
                    <ThemedText style={styles.label}>Google Account Email</ThemedText>
                    <TextInput
                      style={styles.input}
                      value={email}
                      onChangeText={setEmail}
                      placeholder="your.email@gmail.com"
                      placeholderTextColor="rgba(255, 255, 255, 0.3)"
                      keyboardType="email-address"
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
                  </View>

                  <View style={styles.formGroup}>
                    <ThemedText style={styles.label}>Full Name (Optional)</ThemedText>
                    <TextInput
                      style={styles.input}
                      value={name}
                      onChangeText={setName}
                      placeholder="Alex Morgan"
                      placeholderTextColor="rgba(255, 255, 255, 0.3)"
                      autoCapitalize="words"
                    />
                  </View>

                  <View style={styles.formGroup}>
                    <ThemedText style={styles.label}>Google ID Token (Optional)</ThemedText>
                    <TextInput
                      style={[styles.input, { height: 50 }]}
                      value={idToken}
                      onChangeText={setIdToken}
                      placeholder="eyJhbGciOiJSUzI1NiIs..."
                      placeholderTextColor="rgba(255, 255, 255, 0.3)"
                      multiline
                      autoCapitalize="none"
                    />
                  </View>

                  <TouchableOpacity
                    style={styles.submitBtn}
                    activeOpacity={0.85}
                    onPress={handleManualGoogleSubmit}
                    disabled={isLoading}
                  >
                    <LinearGradient
                      colors={['#10B981', '#059669']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={styles.gradientBtn}
                    >
                      <ThemedText style={styles.submitBtnText}>Submit Account</ThemedText>
                    </LinearGradient>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.82)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#0F1015',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 10,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 20,
  },
  googleBadge: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#1E2028',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  googleBadgeText: {
    fontSize: 22,
    fontWeight: '800',
    color: '#4285F4',
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: '#ffffff',
  },
  subtitle: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.5)',
    marginTop: 2,
  },
  closeBtn: {
    padding: 6,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  errorText: {
    color: '#EF4444',
    fontSize: 13,
    flex: 1,
  },
  googleOAuthBtn: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 16,
  },
  googleOAuthBtnInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 15,
  },
  googleOAuthText: {
    color: '#111827',
    fontWeight: '700',
    fontSize: 15,
  },
  manualToggle: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  manualToggleText: {
    fontSize: 12,
    color: '#00A8FF',
    fontWeight: '600',
  },
  manualContainer: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
  },
  formGroup: {
    marginBottom: 14,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.7)',
    marginBottom: 6,
  },
  input: {
    backgroundColor: '#181A22',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: '#ffffff',
    fontSize: 14,
  },
  submitBtn: {
    borderRadius: 14,
    overflow: 'hidden',
    marginTop: 6,
  },
  gradientBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
  },
  submitBtnText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 14,
  },
});
