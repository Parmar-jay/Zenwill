import React, { useState } from 'react';
import {
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  View,
  Platform,
  Modal,
} from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { ThemedText } from '@/components/themed-text';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { PageEntrance } from '@/components/ui/smooth-loader';

const triggerHaptic = (style = Haptics.ImpactFeedbackStyle.Light) => {
  try {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(style);
    }
  } catch (error) {
    // Silent catch
  }
};

interface PlanOption {
  id: 'annual' | 'monthly';
  title: string;
  price: string;
  period: string;
  billingDetail: string;
  badge?: string;
  savings?: string;
  isPopular?: boolean;
}

interface BillingHistoryItem {
  id: string;
  date: string;
  description: string;
  receiptId: string;
  amount: string;
  status: 'Active' | 'Paid';
}

interface FeatureItem {
  id: string;
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  description: string;
}

export default function BillingSingleScreen() {
  const router = useRouter();

  const [selectedPlan, setSelectedPlan] = useState<'annual' | 'monthly'>('monthly');
  const [isArchModalVisible, setIsArchModalVisible] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string>('');

  const plans: Record<'annual' | 'monthly', PlanOption> = {
    monthly: {
      id: 'monthly',
      title: 'Monthly Pass',
      price: '₹69',
      period: '/mo',
      billingDetail: 'Just ₹2.3/day • Cancel anytime in 1 click',
      badge: 'MOST POPULAR • TRY FOR ₹69',
      isPopular: true,
    },
    annual: {
      id: 'annual',
      title: 'Annual Pass',
      price: '₹799',
      period: '/yr',
      billingDetail: '₹799/yr • Includes 1 month free',
      badge: '1 MONTH FREE',
      savings: 'SAVE 20%',
      isPopular: false,
    },
  };

  const premiumFeatures: FeatureItem[] = [
    {
      id: 'no-ads',
      icon: 'sparkles-outline',
      title: 'No Advertisements',
      description: '100% Ad-free focus experience',
    },
    {
      id: 'ai-chats',
      icon: 'chatbubbles-outline',
      title: 'AI Mindset Coach',
      description: 'Unlimited 24/7 AI Coach & Urge Intercept',
    },
    {
      id: 'world-chat',
      icon: 'globe-outline',
      title: 'Spartan\'s Community',
      description: 'Global community, live channels & direct messages',
    },
    {
      id: 'analytics',
      icon: 'stats-chart-outline',
      title: 'Advanced Mind Analytics',
      description: 'Deep behavioral pattern & trigger analysis',
    },
  ];

  const [billingHistory] = useState<BillingHistoryItem[]>([
    {
      id: 'inv_001',
      date: 'Aug 15, 2026',
      description: 'ZenWill Premium - Annual Pass',
      receiptId: 'RC-84920419',
      amount: '₹799.00',
      status: 'Active',
    },
  ]);

  const handleSubscribe = () => {
    triggerHaptic(Haptics.ImpactFeedbackStyle.Heavy);
    const chosen = plans[selectedPlan];
    setToastMessage(`Activated ${chosen.title} (${chosen.price}) successfully!`);
    setTimeout(() => {
      setToastMessage('');
    }, 4000);
  };

  const handleRestorePurchases = () => {
    triggerHaptic();
    setToastMessage('Subscription status restored from StoreKit.');
    setTimeout(() => {
      setToastMessage('');
    }, 3000);
  };

  return (
    <LinearGradient
      colors={['#000000', '#000000', '#000000']}
      style={styles.gradientBg}
    >
      <Stack.Screen options={{ headerShown: false }} />

      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom', 'left', 'right']}>
        {/* Top Standardized Header */}
        <View style={styles.headerBar}>
          <TouchableOpacity
            style={styles.backBtn}
            activeOpacity={0.7}
            onPress={() => {
              triggerHaptic();
              if (router.canGoBack()) {
                router.back();
              } else {
                router.navigate('/(tabs)/home' as any);
              }
            }}
          >
            <Ionicons name="chevron-back" size={24} color="#00E5FF" />
          </TouchableOpacity>

          <View style={styles.headerTitleBox}>
            <ThemedText style={styles.headerCategory}>MEMBERSHIP & BILLING</ThemedText>
            <ThemedText style={styles.headerTitleText}>ZenWill Pass</ThemedText>
          </View>

          <View style={{ width: 36 }} />
        </View>

        <PageEntrance style={{ flex: 1 }}>
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Toast Notification */}
            {toastMessage !== '' && (
              <View style={styles.toastCard}>
                <Ionicons name="checkmark-circle-outline" size={16} color="#00E5FF" />
                <ThemedText style={styles.toastText}>{toastMessage}</ThemedText>
              </View>
            )}

            {/* MASTER CARD CONTAINER */}
            <View style={styles.masterCardWrapper}>
              <View style={styles.masterCardInner}>
                {/* Header Badge & Title */}
                <View style={styles.cardHeader}>
                  <View style={styles.crownPill}>
                    <Ionicons name="ribbon-outline" size={12} color="#F59E0B" />
                    <ThemedText style={styles.crownText}>ZENWILL PREMIUM</ThemedText>
                  </View>
                  <ThemedText style={styles.cardMainTitle}>Unlock Full Access</ThemedText>
                  <ThemedText style={styles.cardSubTitle}>
                    Ad-free focus, AI Coach, and Spartan's community access.
                  </ThemedText>
                </View>

                {/* Plan Options */}
                <View style={styles.planSelectorContainer}>
                  {/* Monthly Plan (Default Choice - Low Friction Entry) */}
                  <TouchableOpacity
                    activeOpacity={0.85}
                    style={[
                      styles.planOptionCard,
                      selectedPlan === 'monthly' && styles.planOptionCardSelected,
                    ]}
                    onPress={() => {
                      triggerHaptic();
                      setSelectedPlan('monthly');
                    }}
                  >
                    {plans.monthly.badge && (
                      <View style={styles.freeMonthBadge}>
                        <ThemedText style={styles.freeMonthBadgeText}>
                          {plans.monthly.badge}
                        </ThemedText>
                      </View>
                    )}

                    <View style={styles.planOptionLeft}>
                      <View
                        style={[
                          styles.radioCircle,
                          selectedPlan === 'monthly' && styles.radioCircleSelected,
                        ]}
                      >
                        {selectedPlan === 'monthly' && <View style={styles.radioDot} />}
                      </View>
                      <View style={{ flex: 1 }}>
                        <View style={styles.planTitleRow}>
                          <ThemedText style={styles.planTitleText}>{plans.monthly.title}</ThemedText>
                          <View style={styles.saveTag}>
                            <ThemedText style={styles.saveTagText}>{plans.monthly.savings}</ThemedText>
                          </View>
                        </View>
                        <ThemedText style={styles.planSubText}>
                          {plans.monthly.billingDetail}
                        </ThemedText>
                      </View>
                    </View>

                    <View style={styles.planPriceBox}>
                      <ThemedText style={styles.planPriceMain}>₹69</ThemedText>
                      <ThemedText style={styles.planPricePeriod}>/mo</ThemedText>
                    </View>
                  </TouchableOpacity>

                  {/* Annual Plan */}
                  <TouchableOpacity
                    activeOpacity={0.85}
                    style={[
                      styles.planOptionCard,
                      selectedPlan === 'annual' && styles.planOptionCardSelected,
                    ]}
                    onPress={() => {
                      triggerHaptic();
                      setSelectedPlan('annual');
                    }}
                  >
                    <View style={styles.planOptionLeft}>
                      <View
                        style={[
                          styles.radioCircle,
                          selectedPlan === 'annual' && styles.radioCircleSelected,
                        ]}
                      >
                        {selectedPlan === 'annual' && <View style={styles.radioDot} />}
                      </View>
                      <View style={{ flex: 1 }}>
                        <View style={styles.planTitleRow}>
                          <ThemedText style={styles.planTitleText}>{plans.annual.title}</ThemedText>
                          <View style={[styles.saveTag, { backgroundColor: 'rgba(59, 130, 246, 0.15)' }]}>
                            <ThemedText style={[styles.saveTagText, { color: '#60A5FA' }]}>{plans.annual.savings}</ThemedText>
                          </View>
                        </View>
                        <ThemedText style={styles.planSubText}>
                          {plans.annual.billingDetail}
                        </ThemedText>
                      </View>
                    </View>

                    <View style={styles.planPriceBox}>
                      <ThemedText style={styles.planPriceMain}>₹799</ThemedText>
                      <ThemedText style={styles.planPricePeriod}>/yr</ThemedText>
                    </View>
                  </TouchableOpacity>
                </View>

                {/* Divider */}
                <View style={styles.divider} />

                {/* Features Checklist */}
                <View style={styles.featuresSection}>
                  <ThemedText style={styles.featuresSectionTitle}>Features Included</ThemedText>

                  <View style={styles.featureList}>
                    {premiumFeatures.map((feat) => (
                      <View key={feat.id} style={styles.featureRow}>
                        <View style={styles.featureIconBox}>
                          <Ionicons name={feat.icon} size={14} color="#00E5FF" />
                        </View>
                        <View style={styles.featureTextBox}>
                          <ThemedText style={styles.featureTitle}>{feat.title}</ThemedText>
                          <ThemedText style={styles.featureDesc}>{feat.description}</ThemedText>
                        </View>
                        <Ionicons name="checkmark-circle" size={16} color="#00E5FF" />
                      </View>
                    ))}
                  </View>
                </View>

                {/* CTA Action Button */}
                <TouchableOpacity
                  activeOpacity={0.88}
                  style={styles.subscribeBtn}
                  onPress={handleSubscribe}
                >
                  <LinearGradient
                    colors={['#6366F1', '#3B82F6', '#00E5FF']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.subscribeGradient}
                  >
                    <ThemedText style={styles.subscribeBtnText}>
                      {selectedPlan === 'monthly'
                        ? 'Start Monthly Pass • Only ₹69/mo'
                        : 'Get Annual Pass • ₹799 (+1 Mo Free)'}
                    </ThemedText>
                    <Ionicons name="arrow-forward" size={15} color="#FFFFFF" />
                  </LinearGradient>
                </TouchableOpacity>

                {/* Guarantee Subtext */}
                <View style={styles.guaranteeBox}>
                  <Ionicons name="lock-closed-outline" size={11} color="rgba(255, 255, 255, 0.4)" />
                  <ThemedText style={styles.guaranteeText}>
                    Cancel anytime • Razorpay Encrypted Checkout
                  </ThemedText>
                </View>

              </View>
            </View>

            {/* Billing History Section */}
            <View style={styles.historySection}>
              <View style={styles.historyHeaderRow}>
                <ThemedText style={styles.sectionHeaderTitle}>Billing History</ThemedText>
                <ThemedText style={styles.historyCountText}>{billingHistory.length} Receipt</ThemedText>
              </View>

              <View style={styles.historyList}>
                {billingHistory.map((item) => (
                  <View key={item.id} style={styles.historyCard}>
                    <View style={styles.historyIconBox}>
                      <Ionicons name="document-text-outline" size={16} color="#00E5FF" />
                    </View>

                    <View style={{ flex: 1 }}>
                      <ThemedText style={styles.historyTitle}>{item.description}</ThemedText>
                      <ThemedText style={styles.historySub}>{item.date} • {item.receiptId}</ThemedText>
                    </View>

                    <View style={{ alignItems: 'flex-end', gap: 2 }}>
                      <ThemedText style={styles.historyAmount}>{item.amount}</ThemedText>
                      <View style={item.status === 'Active' ? styles.statusActivePill : styles.statusPaidPill}>
                        <ThemedText style={item.status === 'Active' ? styles.statusActiveText : styles.statusPaidText}>
                          {item.status}
                        </ThemedText>
                      </View>
                    </View>
                  </View>
                ))}
              </View>
            </View>

            {/* Restore Purchases */}
            <TouchableOpacity style={styles.restoreBtn} onPress={handleRestorePurchases}>
              <Ionicons name="refresh-outline" size={13} color="#00E5FF" />
              <ThemedText style={styles.restoreBtnText}>Restore Purchases</ThemedText>
            </TouchableOpacity>
          </ScrollView>
        </PageEntrance>
      </SafeAreaView>

      {/* Security Info Modal */}
      <Modal
        visible={isArchModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setIsArchModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={() => setIsArchModalVisible(false)}
        >
          <View style={styles.modalContent}>
            <View style={styles.drawerHandle} />

            <View style={styles.modalHeader}>
              <Ionicons name="shield-checkmark-outline" size={18} color="#00E5FF" />
              <ThemedText style={styles.modalTitle}>Security & StoreKit Billing</ThemedText>
            </View>

            <View style={styles.archBox}>
              <Ionicons name="lock-closed-outline" size={15} color="#00E5FF" />
              <View style={{ flex: 1 }}>
                <ThemedText style={styles.archBoxTitle}>Native StoreKit 2 Validation</ThemedText>
                <ThemedText style={styles.archBoxDesc}>
                  Purchases are verified using Apple App Store & Google Play cryptographic receipts.
                </ThemedText>
              </View>
            </View>

            <View style={styles.archBox}>
              <Ionicons name="cloud-offline-outline" size={15} color="#00E5FF" />
              <View style={{ flex: 1 }}>
                <ThemedText style={styles.archBoxTitle}>Offline Privacy First</ThemedText>
                <ThemedText style={styles.archBoxDesc}>
                  Your local data and journal entries remain encrypted on your device.
                </ThemedText>
              </View>
            </View>

            <TouchableOpacity
              style={styles.modalCloseBtn}
              onPress={() => setIsArchModalVisible(false)}
            >
              <ThemedText style={styles.modalCloseText}>Done</ThemedText>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradientBg: { flex: 1, backgroundColor: '#000000' },
  safeArea: { flex: 1, backgroundColor: '#000000' },

  /* HEADER */
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    backgroundColor: '#000000',
  },
  backBtn: {
    backgroundColor: 'transparent',
    padding: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitleBox: {
    flex: 1,
    alignItems: 'center',
  },
  headerCategory: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#00E5FF',
    letterSpacing: 1.5,
  },
  headerTitleText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.3,
  },

  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 40,
    gap: 16,
  },
  toastCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(0, 229, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(0, 229, 255, 0.25)',
    borderRadius: 10,
    padding: 12,
  },
  toastText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: '#00E5FF',
    flex: 1,
  },

  /* MASTER CARD CONTAINER */
  masterCardWrapper: {
    width: '100%',
    maxWidth: 440,
    alignSelf: 'center',
  },
  masterCardInner: {
    backgroundColor: '#090A0F',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(0, 229, 255, 0.2)',
    padding: 20,
    gap: 16,
  },

  /* CARD HEADER */
  cardHeader: {
    alignItems: 'center',
    gap: 6,
  },
  crownPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.25)',
  },
  crownText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#F59E0B',
    letterSpacing: 1.2,
  },
  cardMainTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#FFFFFF',
    textAlign: 'center',
    letterSpacing: -0.4,
    marginTop: 2,
  },
  cardSubTitle: {
    fontSize: 12.5,
    color: 'rgba(255, 255, 255, 0.55)',
    textAlign: 'center',
    lineHeight: 18,
  },

  /* PLAN SELECTOR */
  planSelectorContainer: {
    gap: 10,
  },
  planOptionCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    position: 'relative',
  },
  planOptionCardSelected: {
    backgroundColor: 'rgba(0, 229, 255, 0.06)',
    borderColor: '#00E5FF',
  },
  freeMonthBadge: {
    position: 'absolute',
    top: -9,
    right: 14,
    backgroundColor: '#00E5FF',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  freeMonthBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#030712',
    letterSpacing: 0.5,
  },
  planOptionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  radioCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioCircleSelected: {
    borderColor: '#00E5FF',
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#00E5FF',
  },
  planTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  planTitleText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  saveTag: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  saveTagText: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#10B981',
  },
  planSubText: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.45)',
    marginTop: 2,
  },
  planPriceBox: {
    alignItems: 'flex-end',
  },
  planPriceMain: {
    fontSize: 18,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  planPricePeriod: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.45)',
  },

  divider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    marginVertical: 4,
  },

  /* FEATURES */
  featuresSection: {
    gap: 10,
  },
  featuresSectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: 'rgba(255, 255, 255, 0.6)',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  featureList: {
    gap: 10,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  featureIconBox: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: 'rgba(0, 229, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  featureTextBox: {
    flex: 1,
  },
  featureTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  featureDesc: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.45)',
  },

  /* SUBSCRIBE BUTTON */
  subscribeBtn: {
    marginTop: 4,
    borderRadius: 14,
    overflow: 'hidden',
  },
  subscribeGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 8,
  },
  subscribeBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.2,
  },

  guaranteeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  guaranteeText: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.4)',
  },

  /* BILLING HISTORY */
  historySection: {
    gap: 10,
    marginTop: 8,
  },
  historyHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  sectionHeaderTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: 'rgba(255, 255, 255, 0.7)',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  historyCountText: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.4)',
  },
  historyList: {
    gap: 8,
  },
  historyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    padding: 12,
  },
  historyIconBox: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: 'rgba(0, 229, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  historyTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  historySub: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.4)',
    marginTop: 2,
  },
  historyAmount: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  statusActivePill: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  statusActiveText: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#10B981',
  },
  statusPaidPill: {
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  statusPaidText: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#6366F1',
  },

  restoreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    alignSelf: 'center',
  },
  restoreBtnText: {
    fontSize: 12,
    color: '#00E5FF',
    fontWeight: '600',
  },

  /* MODAL */
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#0F172A',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    gap: 16,
    borderTopWidth: 1,
    borderColor: 'rgba(0, 229, 255, 0.2)',
  },
  drawerHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignSelf: 'center',
    marginBottom: 4,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  archBox: {
    flexDirection: 'row',
    gap: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: 12,
    padding: 12,
    alignItems: 'flex-start',
  },
  archBoxTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  archBoxDesc: {
    fontSize: 11.5,
    color: 'rgba(255, 255, 255, 0.5)',
    marginTop: 2,
    lineHeight: 16,
  },
  modalCloseBtn: {
    backgroundColor: '#00E5FF',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 4,
  },
  modalCloseText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#030712',
  },
});
