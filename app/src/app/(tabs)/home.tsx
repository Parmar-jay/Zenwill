import React, { useState, useEffect, useRef, useMemo, useCallback, createContext, useContext } from 'react';
import {
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  View,
  Platform,
  Dimensions,
  Modal,
  Animated,
  Easing,
  Image,
  ImageBackground,
  TextInput,
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, Stack, useFocusEffect } from 'expo-router';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Path, Circle, Defs, LinearGradient as SvgLinearGradient, Stop } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import { useOnboardingStore } from '@/store/onboarding-store';
import { useAuthStore } from '@/store/auth-store';
import { useHabitStore } from '@/store/habit-store';
import { useDailyMissionStore } from '@/store/daily-mission-store';
import { useSpartanStore } from '@/store/spartan-store';
import { SmoothSkeleton, PageEntrance } from '@/components/ui/smooth-loader';
import { analyticsApi, UserRecommendations, RecommendationActionTask, getCachedRecommendations } from '@/services/analytics-api';

const MEDITATION_IMAGE_MAP: Record<string, any> = {
  nadi_shodhana: require('../../../assets/images/nadi_shodhana.png'),
  bhramari: require('../../../assets/images/bhramari.png'),
  dirgha_pranayama: require('../../../assets/images/dirgha_pranayama.png'),
  ajapa_japa: require('../../../assets/images/ajapa_japa.png'),
  krishna_meditation: require('../../../assets/images/krishna_meditation.png'),
  meditation_forest: require('../../../assets/images/meditation_forest.png'),
};

export interface QuickActionDef {
  id: string;
  title: string;
  subtitle?: string;
  icon: keyof typeof Ionicons.glyphMap;
  route?: string;
  isEmergency?: boolean;
  color?: string;
  category: 'Core' | 'Reflection' | 'Analytics' | 'Community' | 'Account';
}

export const ALL_QUICK_ACTIONS: QuickActionDef[] = [
  { id: 'checkin', title: 'Check-in', subtitle: 'Daily log & streak', icon: 'create-outline', route: '/daily-checkin', category: 'Core', color: '#6366F1' },
  { id: 'coach', title: 'AI Coach', subtitle: 'Interactive guidance', icon: 'chatbubble-ellipses-outline', route: '/chat', category: 'Core', color: '#8B5CF6' },
  { id: 'emergency', title: 'Urge Rescue', subtitle: 'Instant urge relief', icon: 'shield-outline', isEmergency: true, category: 'Core', color: '#FF4D4D' },
  { id: 'meditation', title: 'Meditate', subtitle: 'Pranayama & focus', icon: 'flower-outline', route: '/meditation', category: 'Core', color: '#10B981' },
  { id: 'journal', title: 'Journal', subtitle: 'Reflections & thoughts', icon: 'book-outline', route: '/journal', category: 'Reflection', color: '#F59E0B' },
  { id: 'missions', title: 'Mission', subtitle: 'Daily challenges', icon: 'locate-outline', route: '/missions', category: 'Core', color: '#EC4899' },
  { id: 'purpose', title: 'Purpose', subtitle: 'Life mission & vision', icon: 'heart-outline', route: '/purpose', category: 'Reflection', color: '#EF4444' },
  { id: 'trigger-intel', title: 'Trigger Intel', subtitle: 'Trigger analytics', icon: 'flash-outline', route: '/trigger-intelligence', category: 'Analytics', color: '#F97316' },
  { id: 'leaderboard', title: 'Leaderboard', subtitle: 'Rankings & streaks', icon: 'trophy-outline', route: '/community/leaderboard', category: 'Community', color: '#F59E0B' },
  { id: 'progress', title: 'Progress', subtitle: 'Milestones & analytics', icon: 'stats-chart-outline', route: '/progress', category: 'Analytics', color: '#00E5FF' },
  { id: 'spartan-cell', title: 'Spartan Cell', subtitle: '5-20 Man Squad Stakes', icon: 'shield-half-outline', route: '/community/cell', category: 'Community', color: '#00E5FF' },
  { id: 'battlefield', title: 'Battlefield', subtitle: 'Live 90s Urge Rescue', icon: 'flame-outline', route: '/emergency/battlefield', category: 'Core', color: '#EF4444' },
  { id: 'billing', title: 'Pro Upgrade', subtitle: 'Subscription & features', icon: 'card-outline', route: '/billing', category: 'Account', color: '#EAB308' },
];

const DEFAULT_QUICK_ACTION_IDS = ALL_QUICK_ACTIONS.map((a) => a.id);

export interface GamifiedRank {
  id: string;
  badge: string;
  name: string;
  minDays: number;
  maxDays: number;
  rangeText: string;
  description: string;
  color: string;
  bgGlow: string;
  borderColor: string;
  gradient: [string, string];
}

export const GAMIFIED_RANKS: GamifiedRank[] = [
  { id: 'bronze-1', badge: '🥉', name: 'Bronze I', minDays: 1, maxDays: 7, rangeText: '1–7', description: 'Started the journey', color: '#D97706', bgGlow: 'rgba(217, 119, 6, 0.16)', borderColor: 'rgba(217, 119, 6, 0.4)', gradient: ['#F59E0B', '#B45309'] },
  { id: 'bronze-2', badge: '🥉', name: 'Bronze II', minDays: 8, maxDays: 14, rangeText: '8–14', description: 'Building consistency', color: '#E58A35', bgGlow: 'rgba(229, 138, 53, 0.16)', borderColor: 'rgba(229, 138, 53, 0.4)', gradient: ['#F59E0B', '#B45309'] },
  { id: 'bronze-3', badge: '🥉', name: 'Bronze III', minDays: 15, maxDays: 30, rangeText: '15–30', description: 'First milestone', color: '#F59E0B', bgGlow: 'rgba(245, 158, 11, 0.18)', borderColor: 'rgba(245, 158, 11, 0.45)', gradient: ['#FBBF24', '#D97706'] },
  { id: 'silver-1', badge: '🥈', name: 'Silver I', minDays: 31, maxDays: 45, rangeText: '31–45', description: 'Better self-control', color: '#CBD5E1', bgGlow: 'rgba(203, 213, 225, 0.15)', borderColor: 'rgba(203, 213, 225, 0.4)', gradient: ['#F8FAFC', '#94A3B8'] },
  { id: 'silver-2', badge: '🥈', name: 'Silver II', minDays: 46, maxDays: 60, rangeText: '46–60', description: 'Strong habits forming', color: '#E2E8F0', bgGlow: 'rgba(226, 232, 240, 0.16)', borderColor: 'rgba(226, 232, 240, 0.45)', gradient: ['#FFFFFF', '#CBD5E1'] },
  { id: 'silver-3', badge: '🥈', name: 'Silver III', minDays: 61, maxDays: 90, rangeText: '61–90', description: 'Discipline becoming natural', color: '#F1F5F9', bgGlow: 'rgba(241, 245, 249, 0.18)', borderColor: 'rgba(241, 245, 249, 0.5)', gradient: ['#FFFFFF', '#94A3B8'] },
  { id: 'gold-1', badge: '🥇', name: 'Gold I', minDays: 91, maxDays: 120, rangeText: '91–120', description: 'Noticeable mental clarity', color: '#FBBF24', bgGlow: 'rgba(251, 191, 36, 0.18)', borderColor: 'rgba(251, 191, 36, 0.45)', gradient: ['#FFE066', '#F59E0B'] },
  { id: 'gold-2', badge: '🥇', name: 'Gold II', minDays: 121, maxDays: 180, rangeText: '121–180', description: 'Stable lifestyle', color: '#F59E0B', bgGlow: 'rgba(245, 158, 11, 0.20)', borderColor: 'rgba(245, 158, 11, 0.5)', gradient: ['#FFD700', '#D97706'] },
  { id: 'gold-3', badge: '🥇', name: 'Gold III', minDays: 181, maxDays: 270, rangeText: '181–270', description: 'Deep commitment', color: '#FFD700', bgGlow: 'rgba(255, 215, 0, 0.22)', borderColor: 'rgba(255, 215, 0, 0.55)', gradient: ['#FFF176', '#F59E0B'] },
  { id: 'platinum', badge: '💎', name: 'Platinum', minDays: 271, maxDays: 365, rangeText: '271–365', description: 'One full year completed', color: '#00E5FF', bgGlow: 'rgba(0, 229, 255, 0.18)', borderColor: 'rgba(0, 229, 255, 0.45)', gradient: ['#00E5FF', '#0284C7'] },
  { id: 'diamond', badge: '⚔️', name: 'Diamond', minDays: 366, maxDays: 730, rangeText: '366–730', description: 'Two years of consistency', color: '#38BDF8', bgGlow: 'rgba(56, 189, 248, 0.18)', borderColor: 'rgba(56, 189, 248, 0.45)', gradient: ['#38BDF8', '#2563EB'] },
  { id: 'master', badge: '👑', name: 'Master', minDays: 731, maxDays: 1095, rangeText: '731–1,095', description: 'Three years', color: '#A855F7', bgGlow: 'rgba(168, 85, 247, 0.18)', borderColor: 'rgba(168, 85, 247, 0.45)', gradient: ['#C084FC', '#7C3AED'] },
  { id: 'grandmaster', badge: '🌟', name: 'Grandmaster', minDays: 1096, maxDays: 1825, rangeText: '1,096–1,825', description: 'Five years', color: '#EC4899', bgGlow: 'rgba(236, 72, 153, 0.18)', borderColor: 'rgba(236, 72, 153, 0.45)', gradient: ['#F472B6', '#DB2777'] },
  { id: 'sage', badge: '🔱', name: 'Sage', minDays: 1826, maxDays: 3650, rangeText: '1,826–3,650', description: 'Ten years', color: '#10B981', bgGlow: 'rgba(16, 185, 129, 0.18)', borderColor: 'rgba(16, 185, 129, 0.45)', gradient: ['#34D399', '#059669'] },
  { id: 'legend', badge: '☀️', name: 'Legend', minDays: 3651, maxDays: Infinity, rangeText: '3,651+', description: 'More than ten years of unwavering discipline', color: '#FF5722', bgGlow: 'rgba(255, 87, 34, 0.22)', borderColor: 'rgba(255, 87, 34, 0.5)', gradient: ['#FF7043', '#D84315'] },
];

export const getGamifiedRank = (days: number): GamifiedRank => {
  if (days <= 0) return GAMIFIED_RANKS[0];
  const found = GAMIFIED_RANKS.find((r) => days >= r.minDays && days <= r.maxDays);
  return found || GAMIFIED_RANKS[GAMIFIED_RANKS.length - 1];
};

const WebSafeCircle = React.forwardRef(({ collapsable, ...props }: any, ref: any) => (
  <Circle ref={ref} {...props} />
));
const AnimatedCircle = Animated.createAnimatedComponent(WebSafeCircle);

const ShimmerContext = createContext<any>(null);

const SkeletonItem = ({ style }: { style: any }) => {
  const shimmerAnim = useContext(ShimmerContext);
  return (
    <Animated.View style={[style, { backgroundColor: 'rgba(255, 255, 255, 0.06)', opacity: shimmerAnim }]} />
  );
};

// Safe Haptic feedback helper
const triggerHaptic = (style = Haptics.ImpactFeedbackStyle.Light) => {
  try {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(style);
    }
  } catch (error) {
    // Silent catch if haptics aren't available
  }
};

// Custom SVG Icons
const StreakBackgroundSvg = () => (
  <View style={StyleSheet.absoluteFill}>
    <Svg width="100%" height="100%" viewBox="0 0 200 300" preserveAspectRatio="xMidYMid slice">
      <Defs>
        <SvgLinearGradient id="bgGradient" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0%" stopColor="#030712" />
          <Stop offset="50%" stopColor="#0F172A" />
          <Stop offset="100%" stopColor="#020617" />
        </SvgLinearGradient>
        <SvgLinearGradient id="cyanGlow" x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0%" stopColor="#00E5FF" stopOpacity="0.4" />
          <Stop offset="100%" stopColor="#3B82F6" stopOpacity="0.05" />
        </SvgLinearGradient>
        <SvgLinearGradient id="violetGlow" x1="0" y1="1" x2="1" y2="0">
          <Stop offset="0%" stopColor="#A855F7" stopOpacity="0.35" />
          <Stop offset="100%" stopColor="#6366F1" stopOpacity="0.05" />
        </SvgLinearGradient>
      </Defs>

      {/* Dark cosmic base */}
      <Path d="M0 0h200v300H0z" fill="url(#bgGradient)" />

      {/* Soft Cyan & Violet Ambient Glowing Nebulae */}
      <Circle cx="100" cy="70" r="110" fill="url(#cyanGlow)" />
      <Circle cx="160" cy="220" r="90" fill="url(#violetGlow)" />
      <Circle cx="40" cy="180" r="70" fill="url(#cyanGlow)" />

      {/* Concentric Aura Rings */}
      <Circle cx="100" cy="120" r="65" stroke="rgba(0, 229, 255, 0.18)" strokeWidth="1" fill="none" strokeDasharray="4 4" />
      <Circle cx="100" cy="120" r="85" stroke="rgba(168, 85, 247, 0.15)" strokeWidth="1" fill="none" />
      <Circle cx="100" cy="120" r="105" stroke="rgba(59, 130, 246, 0.1)" strokeWidth="1" fill="none" strokeDasharray="6 6" />

      {/* Cosmic Star Particles */}
      <Circle cx="30" cy="40" r="1.5" fill="rgba(0, 229, 255, 0.7)" />
      <Circle cx="170" cy="50" r="1.2" fill="rgba(168, 85, 247, 0.7)" />
      <Circle cx="150" cy="150" r="1.8" fill="rgba(255, 255, 255, 0.6)" />
      <Circle cx="25" cy="210" r="1.4" fill="rgba(0, 229, 255, 0.6)" />
      <Circle cx="180" cy="260" r="1.6" fill="rgba(168, 85, 247, 0.6)" />
    </Svg>
    <LinearGradient
      colors={['#000000', '#000000', '#000000']}
      style={StyleSheet.absoluteFill}
    />
  </View>
);

const BrainMiniIcon = () => (
  <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
    <Path
      d="M12 5C10.5 5 9 5.5 8 6.5C7.2 5.5 5.8 5 4.5 5C2.5 5 1 6.5 1 8.5C1 11.5 3 13 4.5 14C3.8 14.5 3 15.5 3 16.5C3 18 4.2 19 5.5 19C6.5 19 7.2 18.5 7.8 17.8C8.2 18.5 9 19 10 19M12 5C13.5 5 15 5.5 16 6.5C16.8 5.5 18.2 5 19.5 5C21.5 5 23 6.5 23 8.5C23 11.5 21 13 19.5 14C20.2 14.5 21 15.5 21 16.5C21 18 19.8 19 18.5 19C17.5 19 16.8 18.5 16.2 17.8C15.8 18.5 15 19 14 19"
      stroke="#6366F1"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

export default function HomeScreen() {
  const router = useRouter();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const isSmallScreen = windowWidth < 360;
  const isExtraSmallScreen = windowWidth < 320;
  const isTabletOrWeb = windowWidth >= 768;

  // Habit & Streak Store
  const {
    streak,
    mindStrength,
    lastLoggedDate,
    lastLoggedStatus,
    logDay,
    resetChallenge,
  } = useHabitStore();

  // Daily Mission Store & Spartan Store
  const { todayTasks, totalPoints, completeTask, checkAndResetMidnight } = useDailyMissionStore();
  const { myCell, activeBattle } = useSpartanStore();

  useEffect(() => {
    checkAndResetMidnight();
    useHabitStore.getState().syncFromDatabase();
    useDailyMissionStore.getState().syncWithBackend().catch(() => { });
    useSpartanStore.getState().fetchMyCell().catch(() => { });
    useSpartanStore.getState().fetchActiveBattle().catch(() => { });
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      checkAndResetMidnight();
      useHabitStore.getState().syncFromDatabase();
      useDailyMissionStore.getState().syncWithBackend().catch(() => { });
      useSpartanStore.getState().fetchMyCell().catch(() => { });
      useSpartanStore.getState().fetchActiveBattle().catch(() => { });
    }, [])
  );

  const completedDailyTasksCount = useMemo(() => {
    let count = 0;
    if (todayTasks?.checkin) count++;
    if (todayTasks?.meditation) count++;
    if (todayTasks?.journal) count++;
    if (todayTasks?.coach) count++;
    if (todayTasks?.rescue) count++;
    return count;
  }, [todayTasks]);

  const allDailyTasksDone = completedDailyTasksCount === 5;

  const todayStr = useMemo(() => {
    const date = new Date();
    return date.toISOString().split('T')[0];
  }, [streak]);

  const isLoggedToday = lastLoggedDate === todayStr;

  const level = Math.floor(mindStrength / 100);
  const levelName = level === 0 ? 'Beginner' : level < 3 ? 'Novice' : level < 6 ? 'Steady' : level < 9 ? 'Strong' : 'Master Charioteer';

  // Fetch user state
  const firstName = useOnboardingStore((state) => state.firstName) || 'Jay';
  const user = useAuthStore((state) => state.user);
  const displayName = user?.name || firstName || 'Jay';

  // Dynamic time-based greeting and recovery score calculation
  const currentHour = useMemo(() => new Date().getHours(), []);
  const timeGreeting = useMemo(() => {
    if (currentHour < 12) return 'Good Morning';
    if (currentHour < 18) return 'Good Afternoon';
    return 'Good Evening';
  }, [currentHour]);

  const isEvening = currentHour >= 18;

  const greetingSubtext = useMemo(() => {
    if (!isLoggedToday) {
      return "Complete today's check-in to calibrate your recovery score.";
    }
    if (streak > 7) {
      return "Strong momentum detected • Keep guarding your vision.";
    }
    return "Master your mind • Conquer your life.";
  }, [isLoggedToday, streak]);

  const recoveryScore = useMemo(() => {
    return Math.min(100, Math.max(10, Math.round(mindStrength / 10)));
  }, [mindStrength]);

  const urgeRiskLevel = useMemo(() => {
    if (lastLoggedStatus === 'relapsed') return 'High';
    if (!isLoggedToday) return 'Moderate';
    if (streak >= 14) return 'Very Low';
    return 'Low';
  }, [lastLoggedStatus, isLoggedToday, streak]);

  // Gamified Rank Calculations
  const currentRank = useMemo(() => getGamifiedRank(streak), [streak]);

  const nextRank = useMemo(() => {
    const currentIndex = GAMIFIED_RANKS.findIndex((r) => r.id === currentRank.id);
    if (currentIndex < GAMIFIED_RANKS.length - 1) {
      return GAMIFIED_RANKS[currentIndex + 1];
    }
    return null;
  }, [currentRank]);

  const targetDays = useMemo(() => {
    return nextRank ? nextRank.minDays : currentRank.maxDays;
  }, [currentRank, nextRank]);

  const daysLeftInRank = useMemo(() => {
    if (!nextRank || currentRank.maxDays === Infinity) return 0;
    return Math.max(0, targetDays - streak);
  }, [streak, nextRank, currentRank, targetDays]);

  const rankProgressPct = useMemo(() => {
    if (!nextRank || currentRank.maxDays === Infinity) return 100;
    if (streak <= 0) return 0;
    const tierSpan = Math.max(1, currentRank.maxDays - currentRank.minDays + 1);
    const completedInTier = Math.max(0, streak - currentRank.minDays + 1);
    const pct = Math.round((completedInTier / tierSpan) * 100);
    return Math.min(100, Math.max(5, pct));
  }, [streak, currentRank, nextRank]);

  // Streak Smooth Progress & Pulse Animations
  const streakProgressAnim = useMemo(() => new Animated.Value(0), []);
  const streakPulseAnim = useMemo(() => new Animated.Value(1), []);

  useEffect(() => {
    Animated.timing(streakProgressAnim, {
      toValue: rankProgressPct,
      duration: 850,
      easing: Easing.bezier(0.25, 1, 0.5, 1),
      useNativeDriver: false,
    }).start();
  }, [rankProgressPct]);

  useEffect(() => {
    Animated.sequence([
      Animated.timing(streakPulseAnim, {
        toValue: 1.22,
        duration: 220,
        easing: Easing.out(Easing.back(1.5)),
        useNativeDriver: true,
      }),
      Animated.spring(streakPulseAnim, {
        toValue: 1,
        friction: 4,
        tension: 40,
        useNativeDriver: true,
      }),
    ]).start();
  }, [streak]);

  const animatedProgressBarWidth = streakProgressAnim.interpolate({
    inputRange: [0, 100],
    outputRange: ['0%', '100%'],
    extrapolate: 'clamp',
  });

  // Loading & Shimmer states
  const [isLoading, setIsLoading] = useState(true);
  const shimmerAnim = useMemo(() => new Animated.Value(0.35), []);

  // Modal States
  const [wisdomModalVisible, setWisdomModalVisible] = useState(false);
  const [triggerModalVisible, setTriggerModalVisible] = useState(false);
  const [insightModalVisible, setInsightModalVisible] = useState(false);
  const [customizeQuickActionsVisible, setCustomizeQuickActionsVisible] = useState(false);
  const [rankModalVisible, setRankModalVisible] = useState(false);

  // Recommendations State hydrated instantly from cache (zero placeholder flicker)
  const [recommendations, setRecommendations] = useState<UserRecommendations | null>(() => getCachedRecommendations());

  const loadRecommendations = useCallback(async () => {
    try {
      const data = await analyticsApi.getRecommendations();
      setRecommendations(data);
    } catch (e) {
      // silent fallback
    }
  }, []);

  useEffect(() => {
    loadRecommendations();
  }, [loadRecommendations, todayTasks]);

  const handleCompleteRecommendationTask = useCallback(async (task: RecommendationActionTask) => {
    try {
      triggerHaptic();
      // Optimistic update
      setRecommendations((prev) => {
        if (!prev || !prev.recommended_actions) return prev;
        const updatedActions = prev.recommended_actions.map((a) =>
          a.id === task.id ? { ...a, is_completed: true } : a
        );
        const completedCount = updatedActions.filter((a) => a.is_completed).length;
        return {
          ...prev,
          recommended_actions: updatedActions,
          progress_stats: {
            completed_tasks: completedCount,
            total_tasks: updatedActions.length,
            completion_percentage: Math.round((completedCount / updatedActions.length) * 100),
          },
        };
      });

      await analyticsApi.completeRecommendationTask(task.id, task.action_type, task.title);
      await loadRecommendations();
    } catch (e) {
      // silent fallback
    }
  }, [loadRecommendations]);

  useFocusEffect(
    useCallback(() => {
      loadRecommendations();
    }, [loadRecommendations])
  );

  // Quick Actions State & Persistence
  const [enabledActionIds, setEnabledActionIds] = useState<string[]>(DEFAULT_QUICK_ACTION_IDS);
  const [quickActionSearch, setQuickActionSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');

  useEffect(() => {
    AsyncStorage.getItem('@zenwill_quick_actions_v2').then((saved) => {
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setEnabledActionIds(parsed);
          }
        } catch (e) {
          // fallback
        }
      }
    });
  }, []);

  const saveEnabledActionIds = async (ids: string[]) => {
    setEnabledActionIds(ids);
    try {
      await AsyncStorage.setItem('@zenwill_quick_actions_v2', JSON.stringify(ids));
    } catch (e) {
      // silent
    }
  };

  const toggleActionPin = (actionId: string) => {
    triggerHaptic();
    if (enabledActionIds.includes(actionId)) {
      if (enabledActionIds.length <= 1) return;
      saveEnabledActionIds(enabledActionIds.filter((id) => id !== actionId));
    } else {
      saveEnabledActionIds([...enabledActionIds, actionId]);
    }
  };

  const resetQuickActionsToDefault = () => {
    triggerHaptic();
    saveEnabledActionIds(DEFAULT_QUICK_ACTION_IDS);
  };

  const toggleSelectAllQuickActions = () => {
    triggerHaptic();
    if (enabledActionIds.length === ALL_QUICK_ACTIONS.length) {
      saveEnabledActionIds(DEFAULT_QUICK_ACTION_IDS);
    } else {
      saveEnabledActionIds(ALL_QUICK_ACTIONS.map((a) => a.id));
    }
  };

  const handleQuickActionPress = (action: QuickActionDef) => {
    triggerHaptic();
    if (action.isEmergency) {
      setTriggerModalVisible(true);
    } else if (action.route) {
      router.push(action.route as any);
    }
  };

  const displayedActions = useMemo(() => {
    return ALL_QUICK_ACTIONS.filter((action) => enabledActionIds.includes(action.id));
  }, [enabledActionIds]);

  const filteredCatalogActions = useMemo(() => {
    return ALL_QUICK_ACTIONS.filter((action) => {
      const matchesSearch =
        action.title.toLowerCase().includes(quickActionSearch.toLowerCase()) ||
        (action.subtitle && action.subtitle.toLowerCase().includes(quickActionSearch.toLowerCase()));
      const matchesCategory = selectedCategory === 'All' || action.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [quickActionSearch, selectedCategory]);

  // Breathing Exercise States (Trigger SOS Modal - 7 Cycles Charioteer Reset)
  const [breathingActive, setBreathingActive] = useState(false);
  const [breathText, setBreathText] = useState('Tap Start to Begin');
  const [breathCountdown, setBreathCountdown] = useState<number | null>(null);
  const [breathCycleCount, setBreathCycleCount] = useState(0);
  const [mentalShiftApplied, setMentalShiftApplied] = useState(false);
  const breathAnim = useMemo(() => new Animated.Value(1), []);
  const numberPulseAnim = useMemo(() => new Animated.Value(1), []);
  const idleBreathAnim = useMemo(() => new Animated.Value(1), []);
  const isBreathingRef = useRef(false);
  const countdownIntervalRef = useRef<any>(null);

  // Ambient breathing pulse when idle
  useEffect(() => {
    let idleLoop: Animated.CompositeAnimation | null = null;
    if (!breathingActive) {
      idleLoop = Animated.loop(
        Animated.sequence([
          Animated.timing(idleBreathAnim, {
            toValue: 1.08,
            duration: 2200,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
          Animated.timing(idleBreathAnim, {
            toValue: 0.94,
            duration: 2200,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
        ])
      );
      idleLoop.start();
    }
    return () => {
      if (idleLoop) idleLoop.stop();
    };
  }, [breathingActive]);

  // Countdown timer with smooth pulse animation & safety check
  const startCountdown = (seconds: number, callback?: () => void) => {
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
    }
    if (!isBreathingRef.current) return;
    setBreathCountdown(seconds);
    numberPulseAnim.setValue(1.2);
    Animated.spring(numberPulseAnim, { toValue: 1, friction: 5, useNativeDriver: true }).start();

    let current = seconds;
    countdownIntervalRef.current = setInterval(() => {
      if (!isBreathingRef.current) {
        if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
        setBreathCountdown(null);
        return;
      }
      current -= 1;
      if (current <= 0) {
        if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
        setBreathCountdown(null);
        if (callback && isBreathingRef.current) callback();
      } else {
        setBreathCountdown(current);
        numberPulseAnim.setValue(1.25);
        Animated.spring(numberPulseAnim, { toValue: 1, friction: 5, useNativeDriver: true }).start();
        triggerHaptic(Haptics.ImpactFeedbackStyle.Light);
      }
    }, 1000);
  };

  // Entrance Animations state
  const fadeAnims = useMemo(() => ({
    header: new Animated.Value(0),
    grid1: new Animated.Value(0),
    actions: new Animated.Value(0),
    insight: new Animated.Value(0),
    grid3: new Animated.Value(0),
    meditation: new Animated.Value(0),
  }), []);

  const slideAnims = useMemo(() => ({
    header: new Animated.Value(12),
    grid1: new Animated.Value(18),
    actions: new Animated.Value(18),
    insight: new Animated.Value(18),
    grid3: new Animated.Value(18),
    meditation: new Animated.Value(18),
  }), []);

  const gaugeAnim = useMemo(() => new Animated.Value(1), []);

  const triggerEntrance = () => {
    const smoothCurve = Easing.bezier(0.16, 1, 0.3, 1);
    Animated.stagger(50, [
      Animated.parallel([
        Animated.timing(fadeAnims.header, { toValue: 1, duration: 320, useNativeDriver: true }),
        Animated.timing(slideAnims.header, { toValue: 0, duration: 320, useNativeDriver: true, easing: smoothCurve }),
      ]),
      Animated.parallel([
        Animated.timing(fadeAnims.grid1, { toValue: 1, duration: 340, useNativeDriver: true }),
        Animated.timing(slideAnims.grid1, { toValue: 0, duration: 340, useNativeDriver: true, easing: smoothCurve }),
        Animated.timing(gaugeAnim, {
          toValue: 0,
          duration: 900,
          easing: smoothCurve,
          useNativeDriver: false,
        }),
      ]),
      Animated.parallel([
        Animated.timing(fadeAnims.actions, { toValue: 1, duration: 340, useNativeDriver: true }),
        Animated.timing(slideAnims.actions, { toValue: 0, duration: 340, useNativeDriver: true, easing: smoothCurve }),
      ]),
      Animated.parallel([
        Animated.timing(fadeAnims.insight, { toValue: 1, duration: 340, useNativeDriver: true }),
        Animated.timing(slideAnims.insight, { toValue: 0, duration: 340, useNativeDriver: true, easing: smoothCurve }),
      ]),
      Animated.parallel([
        Animated.timing(fadeAnims.grid3, { toValue: 1, duration: 340, useNativeDriver: true }),
        Animated.timing(slideAnims.grid3, { toValue: 0, duration: 340, useNativeDriver: true, easing: smoothCurve }),
      ]),
      Animated.parallel([
        Animated.timing(fadeAnims.meditation, { toValue: 1, duration: 340, useNativeDriver: true }),
        Animated.timing(slideAnims.meditation, { toValue: 0, duration: 340, useNativeDriver: true, easing: smoothCurve }),
      ]),
    ]).start();
  };

  // Shimmer pulse loader
  useEffect(() => {
    let loop: Animated.CompositeAnimation | null = null;
    if (isLoading) {
      loop = Animated.loop(
        Animated.sequence([
          Animated.timing(shimmerAnim, {
            toValue: 0.7,
            duration: 700,
            easing: Easing.bezier(0.16, 1, 0.3, 1),
            useNativeDriver: true,
          }),
          Animated.timing(shimmerAnim, {
            toValue: 0.35,
            duration: 700,
            easing: Easing.bezier(0.16, 1, 0.3, 1),
            useNativeDriver: true,
          }),
        ])
      );
      loop.start();
    }
    return () => {
      if (loop) loop.stop();
    };
  }, [isLoading]);

  // Loading Timer
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoading(false);
      triggerEntrance();
    }, 280);
    return () => clearTimeout(timer);
  }, []);

  // Breathing exercise controller (7-Cycle Charioteer Reset)
  const startBreathing = () => {
    triggerHaptic(Haptics.ImpactFeedbackStyle.Heavy);
    isBreathingRef.current = true;
    setBreathingActive(true);
    setBreathCycleCount(0);
    runBreathingCycle(0);
  };

  const stopBreathing = () => {
    isBreathingRef.current = false;
    setBreathingActive(false);
    setBreathText('Tap Start to Begin');
    setBreathCountdown(null);
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
    }
    breathAnim.stopAnimation();
    Animated.spring(breathAnim, {
      toValue: 1,
      useNativeDriver: true,
      friction: 6,
    }).start();
  };

  const runBreathingCycle = (currentCycle = 0) => {
    if (!isBreathingRef.current) return;

    // 1. INHALE PHASE (4s)
    setBreathText('Inhale');
    triggerHaptic(Haptics.ImpactFeedbackStyle.Medium);

    Animated.timing(breathAnim, {
      toValue: 1.55,
      duration: 4000,
      easing: Easing.bezier(0.25, 0.1, 0.25, 1.0),
      useNativeDriver: true,
    }).start();

    startCountdown(4, () => {
      if (!isBreathingRef.current) return;

      // 2. HOLD PHASE (4s)
      setBreathText('Hold');
      triggerHaptic(Haptics.ImpactFeedbackStyle.Light);

      startCountdown(4, () => {
        if (!isBreathingRef.current) return;

        // 3. EXHALE PHASE (4s)
        setBreathText('Exhale');
        triggerHaptic(Haptics.ImpactFeedbackStyle.Medium);

        Animated.timing(breathAnim, {
          toValue: 1.0,
          duration: 4000,
          easing: Easing.bezier(0.33, 1, 0.68, 1),
          useNativeDriver: true,
        }).start();

        startCountdown(4, () => {
          if (!isBreathingRef.current) return;

          // 4. REST / GROUND (2s)
          setBreathText('Hold');
          triggerHaptic(Haptics.ImpactFeedbackStyle.Light);

          startCountdown(2, () => {
            if (!isBreathingRef.current) return;
            const nextCycle = currentCycle + 1;
            setBreathCycleCount(nextCycle);

            if (nextCycle >= 7) {
              isBreathingRef.current = false;
              setBreathText('Mind Sovereign! 👑');
              triggerHaptic(Haptics.ImpactFeedbackStyle.Heavy);
              setBreathingActive(false);
              setBreathCountdown(null);
            } else {
              runBreathingCycle(nextCycle);
            }
          });
        });
      });
    });
  };

  const handleDoneUrgeRescue = () => {
    triggerHaptic(Haptics.ImpactFeedbackStyle.Heavy);
    setMentalShiftApplied(true);
    useHabitStore.getState().incrementUrgeCount();
    useDailyMissionStore.getState().completeTask('rescue');

    // Parallel background backend logging
    const bgSync = async () => {
      try {
        await Promise.all([
          analyticsApi.completeEmergency({
            session_id: 'rescue_' + Date.now(),
            techniques_used: ['Pranayama Reset', '7-Cycle Charioteer Reset'],
            outcome: 'resisted',
            was_effective: true,
            main_influence: 'Breath Control',
            trigger_reason: 'Urge SOS Reset',
            urge_intensity_before: 7,
            urge_intensity_after: 2,
            thought_note: 'Completed 7-Cycle Pranayama Reset from Home',
            most_helpful_technique: 'Pranayama Reset',
          }),
          analyticsApi.logEvent({
            event_type: 'urge_rescue_completed',
            trigger_context: 'Charioteer Urge SOS',
            outcome: 'resisted',
            intensity: 7,
            metadata: {
              technique: 'Pranayama Reset',
              cycles: 7,
            },
          }),
        ]);
      } catch (e) {
        // silent fallback
      }
    };
    bgSync();

    setTimeout(() => {
      setTriggerModalVisible(false);
      setMentalShiftApplied(false);
      stopBreathing();
      router.push('/emergency/reflection' as any);
    }, 800);
  };

  // Math variables for circular progress ring
  const gaugeSize = isExtraSmallScreen ? 76 : isSmallScreen ? 84 : 92;
  const gaugeStroke = 8;
  const gaugeRadius = (gaugeSize - gaugeStroke) / 2;
  const gaugeCircumference = 2 * Math.PI * gaugeRadius;
  const gaugeArcAngle = 270;
  const gaugeArcLength = (gaugeCircumference * gaugeArcAngle) / 360;
  const gaugeGapLength = gaugeCircumference - gaugeArcLength;
  const progressPercent = rankProgressPct / 100;
  const strokeOffset = gaugeArcLength * (1 - Math.max(0.05, progressPercent));

  const animatedOffset = gaugeAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [strokeOffset, gaugeArcLength],
  });

  useEffect(() => {
    gaugeAnim.setValue(1);
    Animated.timing(gaugeAnim, {
      toValue: 0,
      duration: 1000,
      easing: Easing.bezier(0.15, 0.85, 0.45, 1),
      useNativeDriver: false,
    }).start();
  }, [mindStrength]);

  if (isLoading) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ headerShown: false }} />
        {/* Header Skeleton */}
        <SafeAreaView style={styles.headerSafeArea} edges={['top']}>
          <View style={styles.mainWrapper}>
            <View style={styles.headerRow}>
              <View style={styles.headerLeftContainer}>
                <SmoothSkeleton width={44} height={44} borderRadius={14} />
                <View style={[styles.welcomeTextContainer, { marginLeft: 12, gap: 6 }]}>
                  <SmoothSkeleton width={90} height={10} borderRadius={4} />
                  <SmoothSkeleton width={140} height={16} borderRadius={4} />
                </View>
              </View>
            </View>
          </View>
        </SafeAreaView>

        {/* Scroll Content Skeleton */}
        <ScrollView contentContainerStyle={styles.scrollContent} scrollEnabled={false} showsVerticalScrollIndicator={false}>
          <View style={[styles.mainWrapper, { gap: 16 }]}>
            {/* Top Dual Cards Skeleton */}
            <View style={[styles.topDualCardsRow, isExtraSmallScreen && styles.topDualCardsRowColumn]}>
              <View style={[styles.topCardContainer, isExtraSmallScreen && { width: '100%' }]}>
                <View style={[styles.topCardItem, { minHeight: 285, padding: 16, justifyContent: 'space-between' }]}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <SmoothSkeleton width={95} height={12} borderRadius={4} />
                    <SmoothSkeleton width={24} height={24} borderRadius={12} />
                  </View>
                  <View style={{ alignItems: 'center', marginVertical: 14 }}>
                    <SmoothSkeleton width={120} height={48} borderRadius={8} />
                    <SmoothSkeleton width={160} height={10} borderRadius={4} style={{ marginTop: 10 }} />
                    <SmoothSkeleton width="85%" height={4} borderRadius={2} style={{ marginTop: 12 }} />
                  </View>
                  <View style={{ alignItems: 'center', gap: 6 }}>
                    <SmoothSkeleton width={110} height={24} borderRadius={12} />
                    <SmoothSkeleton width={180} height={10} borderRadius={4} />
                  </View>
                </View>
              </View>

              <View style={[styles.topCardContainer, isExtraSmallScreen && { width: '100%' }]}>
                <View style={[styles.topCardItem, { minHeight: 285, padding: 16, justifyContent: 'space-between' }]}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <SmoothSkeleton width={120} height={12} borderRadius={4} />
                    <SmoothSkeleton width={20} height={20} borderRadius={10} />
                  </View>
                  <View style={{ marginVertical: 12, gap: 8 }}>
                    <SmoothSkeleton width="90%" height={14} borderRadius={4} />
                    <SmoothSkeleton width="70%" height={12} borderRadius={4} />
                    <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                      <SmoothSkeleton width="48%" height={36} borderRadius={10} />
                      <SmoothSkeleton width="48%" height={36} borderRadius={10} />
                    </View>
                  </View>
                  <SmoothSkeleton width="100%" height={30} borderRadius={10} />
                </View>
              </View>
            </View>

            {/* Quick Actions Skeleton */}
            <View style={{ marginTop: 4 }}>
              <SmoothSkeleton width={150} height={12} borderRadius={4} style={{ marginBottom: 12 }} />
              <View style={{ flexDirection: 'row', gap: 10 }}>
                {[1, 2, 3, 4, 5].map((i) => (
                  <View key={i} style={{ alignItems: 'center', width: 66, gap: 6 }}>
                    <SmoothSkeleton width={52} height={52} borderRadius={16} />
                    <SmoothSkeleton width={44} height={10} borderRadius={4} />
                  </View>
                ))}
              </View>
            </View>

            {/* AI Insight Skeleton */}
            <View style={[styles.aiInsightCard, { height: 110, padding: 16, justifyContent: 'space-between' }]}>
              <SmoothSkeleton width={120} height={10} borderRadius={4} />
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <View style={{ flex: 1, gap: 6, marginRight: 12 }}>
                  <SmoothSkeleton width="90%" height={16} borderRadius={4} />
                  <SmoothSkeleton width="70%" height={12} borderRadius={4} />
                </View>
                <SmoothSkeleton width={60} height={60} borderRadius={14} />
              </View>
            </View>
          </View>
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Top Custom Glassmorphic Header */}
      <SafeAreaView style={styles.headerSafeArea} edges={['top']}>
        <View style={styles.mainWrapper}>
          <Animated.View
            style={[
              styles.headerRow,
              { opacity: fadeAnims.header, transform: [{ translateY: slideAnims.header }] },
            ]}
          >
            <View style={styles.headerLeftContainer}>
              <TouchableOpacity
                style={styles.profileAvatarContainer}
                activeOpacity={0.8}
                onPress={() => {
                  triggerHaptic();
                  router.push('/profile');
                }}
              >
                <LinearGradient
                  colors={['#0F172A', '#1E293B']}
                  style={styles.avatarGradient}
                >
                  <ThemedText style={styles.avatarText}>
                    {displayName.charAt(0).toUpperCase()}
                  </ThemedText>
                </LinearGradient>
                <View style={styles.onlineDot} />
              </TouchableOpacity>

              <View style={styles.welcomeTextContainer}>
                <ThemedText style={styles.welcomeGreetingEyebrow}>
                  {timeGreeting.toUpperCase()}
                </ThemedText>
                <ThemedText style={styles.welcomeTitle} numberOfLines={1}>
                  {displayName}
                </ThemedText>
                <ThemedText style={styles.welcomeSubtitle} numberOfLines={1}>
                  {greetingSubtext}
                </ThemedText>
              </View>
            </View>
          </Animated.View>
        </View>
      </SafeAreaView>

      {/* Main Content Scroll Container */}
      <PageEntrance style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={[styles.scrollContent, isTabletOrWeb && styles.scrollContentTablet]}
          showsVerticalScrollIndicator={false}
        >
          <View style={[styles.mainWrapper, { gap: 16 }]}>
            {/* Top Hero Section: Dual Cards (Streak & Vedic Mind Science) */}
            <Animated.View
              style={[
                styles.topDualCardsRow,
                isExtraSmallScreen && styles.topDualCardsRowColumn,
                { opacity: fadeAnims.grid1, transform: [{ translateY: slideAnims.grid1 }] },
              ]}
            >
              {/* LEFT CARD: STREAK & GAMIFIED RANK GAUGE */}
              <View style={[styles.topCardContainer, isExtraSmallScreen && { width: '100%' }]}>
                <TouchableOpacity
                  activeOpacity={0.88}
                  style={styles.topCardTouchable}
                  onPress={() => {
                    triggerHaptic();
                    setRankModalVisible(true);
                  }}
                >
                  <ImageBackground
                    source={require('../../../assets/images/conqurer.png')}
                    style={[
                      styles.topCardItem,
                      {
                        borderColor: currentRank.borderColor,
                        shadowColor: currentRank.color,
                      },
                    ]}
                    imageStyle={{ borderRadius: 18, resizeMode: 'cover' }}
                  >
                    {/* Dark Black Translucent Film Layer */}
                    <View
                      style={[
                        StyleSheet.absoluteFill,
                        { backgroundColor: 'rgba(0, 0, 0, 0.65)', borderRadius: 18, zIndex: 1 },
                      ]}
                      pointerEvents="none"
                    />
                    <LinearGradient
                      colors={['rgba(0, 0, 0, 0.25)', 'rgba(0, 0, 0, 0.88)']}
                      style={[StyleSheet.absoluteFill, { borderRadius: 18, zIndex: 2 }]}
                      pointerEvents="none"
                    />

                    {/* Card Header Row */}
                    <View style={[styles.topCardHeaderRow, { zIndex: 10 }]}>
                      <View style={styles.cardHeaderTitleRow}>
                        <Ionicons name="flame" size={13} color={currentRank.color} style={{ marginRight: 4 }} />
                        <ThemedText style={styles.topCardHeaderTitle} numberOfLines={1}>STREAK POWER</ThemedText>
                      </View>
                      <View style={[styles.infoIconButton, { backgroundColor: currentRank.bgGlow }]}>
                        <Ionicons name="information-circle-outline" size={14} color={currentRank.color} />
                      </View>
                    </View>

                    {/* Luxury Minimalist Center Display: 2 / 6 (Completed / Remaining) */}
                    <View style={[styles.luxuryStreakContainer, { zIndex: 10 }]}>
                      <Animated.View style={[styles.luxuryNumberRow, { transform: [{ scale: streakPulseAnim }] }]}>
                        <ThemedText
                          style={[
                            styles.luxuryStreakBigNumber,
                            {
                              color: currentRank.color,
                              fontSize: streak > 999 ? 32 : streak > 99 ? 38 : 44,
                              lineHeight: streak > 999 ? 38 : streak > 99 ? 44 : 52,
                            }
                          ]}
                          numberOfLines={1}
                          adjustsFontSizeToFit={true}
                        >
                          {streak}
                        </ThemedText>
                        <ThemedText style={styles.luxuryStreakDivider}>/</ThemedText>
                        <ThemedText style={styles.luxuryStreakTargetNumber}>
                          {daysLeftInRank > 0 ? daysLeftInRank : 0}
                        </ThemedText>
                      </Animated.View>

                      <ThemedText style={styles.luxuryStreakSublabel}>
                        {daysLeftInRank > 0
                          ? `${streak} COMPLETED  •  ${daysLeftInRank} REMAINING`
                          : `${streak} DAYS COMPLETED  •  MAX TIER`}
                      </ThemedText>

                      {/* Minimalist Animated Glass Progress Bar */}
                      <View style={styles.luxuryProgressBarTrack}>
                        <Animated.View style={[styles.luxuryProgressBarFill, { width: animatedProgressBarWidth }]}>
                          <LinearGradient
                            colors={currentRank.gradient}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                            style={StyleSheet.absoluteFill}
                          />
                        </Animated.View>
                      </View>
                    </View>

                    {/* Bottom Rank Info & Subtle Quote */}
                    <View style={[styles.topCardBottomContainer, { zIndex: 10 }]}>
                      <View
                        style={[styles.topRankPill, { backgroundColor: currentRank.bgGlow, borderColor: currentRank.borderColor }]}
                      >
                        <ThemedText style={styles.topRankBadgeEmoji}>{currentRank.badge}</ThemedText>
                        <ThemedText style={[styles.topRankText, { color: currentRank.color }]} numberOfLines={1}>
                          {currentRank.name} • {daysLeftInRank > 0 ? `${daysLeftInRank}d Left` : 'Max Tier'}
                        </ThemedText>
                      </View>

                      <ThemedText style={styles.topCardSubtitle} numberOfLines={2}>
                        "He who conquers his mind conquers the universe."
                      </ThemedText>
                    </View>
                  </ImageBackground>
                </TouchableOpacity>
              </View>

              {/* RIGHT CARD: VEDIC MIND SCIENCE & DAILY CHECK-IN ACTIONS */}
              <View style={[styles.topCardContainer, isExtraSmallScreen && { width: '100%' }]}>
                <ImageBackground
                  source={require('../../../assets/images/krishna_dark_cyan.png')}
                  style={styles.topCardItem}
                  imageStyle={{ borderRadius: 18, resizeMode: 'cover' }}
                >
                  {/* Dark Black Translucent Film Layer */}
                  <View
                    style={[
                      StyleSheet.absoluteFill,
                      { backgroundColor: 'rgba(0, 0, 0, 0.65)', borderRadius: 18, zIndex: 1 },
                    ]}
                    pointerEvents="none"
                  />
                  <LinearGradient
                    colors={['rgba(0, 0, 0, 0.25)', 'rgba(0, 0, 0, 0.88)']}
                    style={[StyleSheet.absoluteFill, { borderRadius: 18, zIndex: 2 }]}
                    pointerEvents="none"
                  />

                  {/* Card Header Row - Clickable to open Katha Upanishad */}
                  <TouchableOpacity
                    activeOpacity={0.85}
                    onPress={() => {
                      triggerHaptic();
                      setWisdomModalVisible(true);
                    }}
                    style={[styles.topCardHeaderRow, { zIndex: 10 }]}
                  >
                    <View style={styles.cardHeaderTitleRow}>
                      <Ionicons name="disc-outline" size={13} color="#00E5FF" style={{ marginRight: 4 }} />
                      <ThemedText style={styles.topCardHeaderTitle} numberOfLines={1}>Vedic Mind Science</ThemedText>
                    </View>
                    <Ionicons name="book-outline" size={14} color="#00E5FF" />
                  </TouchableOpacity>

                  {/* Card Content & Focus Quote */}
                  <View style={[styles.rightCardBody, { zIndex: 10 }]}>
                    <TouchableOpacity
                      activeOpacity={0.85}
                      onPress={() => {
                        triggerHaptic();
                        setWisdomModalVisible(true);
                      }}
                    >
                      <ThemedText style={styles.vedicFocusText}>
                        You think you're free—until an urge tells you what to do.
                      </ThemedText>
                    </TouchableOpacity>

                    {/* Retained / Relapsed Action Buttons (Submitted only once per day) */}
                    <View style={styles.alignedActionContainer}>
                      {!isLoggedToday ? (
                        <View style={styles.alignedButtonRow}>
                          <TouchableOpacity
                            style={styles.alignedRetainBtn}
                            activeOpacity={0.75}
                            onPress={() => {
                              triggerHaptic(Haptics.ImpactFeedbackStyle.Heavy);
                              logDay(true);
                            }}
                          >
                            <LinearGradient
                              colors={['#10B981', '#059669']}
                              start={{ x: 0, y: 0 }}
                              end={{ x: 1, y: 0 }}
                              style={styles.alignedBtnGradient}
                            >
                              <ThemedText style={styles.alignedRetainText}>Retain</ThemedText>
                            </LinearGradient>
                          </TouchableOpacity>

                          <TouchableOpacity
                            style={styles.alignedRelapseBtn}
                            activeOpacity={0.75}
                            onPress={() => {
                              triggerHaptic(Haptics.ImpactFeedbackStyle.Medium);
                              router.push('/relapse-autopsy' as any);
                            }}
                          >
                            <LinearGradient
                              colors={['rgba(239, 68, 68, 0.18)', 'rgba(185, 28, 28, 0.25)']}
                              start={{ x: 0, y: 0 }}
                              end={{ x: 1, y: 0 }}
                              style={styles.alignedBtnGradient}
                            >
                              <ThemedText style={styles.alignedRelapseText}>Relapse</ThemedText>
                            </LinearGradient>
                          </TouchableOpacity>
                        </View>
                      ) : (
                        <View style={styles.loggedStatusBadgeRow}>
                          <Ionicons
                            name={lastLoggedStatus === 'retained' ? 'checkmark-circle' : 'alert-circle'}
                            size={14}
                            color={lastLoggedStatus === 'retained' ? '#10B981' : '#FF4D4D'}
                          />
                          <ThemedText
                            style={[
                              styles.loggedStatusText,
                              { color: lastLoggedStatus === 'retained' ? '#10B981' : '#FF4D4D' },
                            ]}
                          >
                            {lastLoggedStatus === 'retained' ? 'Retained Today' : 'Streak Reset'}
                          </ThemedText>
                          <Ionicons name="lock-closed" size={11} color="rgba(255,255,255,0.4)" style={{ marginLeft: 4 }} />
                        </View>
                      )}
                    </View>
                  </View>

                  <TouchableOpacity
                    style={[styles.rightCardBottomBtn, { zIndex: 10 }]}
                    activeOpacity={0.7}
                    onPress={() => {
                      triggerHaptic();
                      setWisdomModalVisible(true);
                    }}
                  >
                    <View style={{ flex: 1, paddingRight: 6 }}>
                      <ThemedText style={styles.rightCardBottomBtnText} numberOfLines={1}>
                        Read Ashtavakra Gita
                      </ThemedText>
                      <ThemedText style={{ fontSize: 9.5, color: '#00E5FF', fontWeight: '700', marginTop: 1 }} numberOfLines={1}>
                        (The Observer)
                      </ThemedText>
                    </View>
                    <Ionicons name="chevron-forward" size={14} color="#00E5FF" />
                  </TouchableOpacity>
                </ImageBackground>
              </View>
            </Animated.View>

            {/* Spartan Live Battlefield & Cell Widget */}
            <Animated.View
              style={[
                styles.spartanWidgetRow,
                { opacity: fadeAnims.actions, transform: [{ translateY: slideAnims.actions }] },
              ]}
            >
              {/* Left Widget: Spartan Cell */}
              <TouchableOpacity
                style={[
                  styles.spartanCellWidget,
                  myCell?.shield_status === 'gold' && styles.spartanWidgetGold,
                ]}
                activeOpacity={0.8}
                onPress={() => {
                  triggerHaptic();
                  router.push('/community/cell' as any);
                }}
              >
                <View style={styles.spartanWidgetHeader}>
                  <ThemedText style={styles.spartanWidgetEmoji}>
                    {myCell ? getGamifiedRank(myCell.total_streak ?? 0).badge : '🛡️'}
                  </ThemedText>
                  <View style={[
                    styles.spartanShieldPill,
                    myCell && {
                      backgroundColor: `${getGamifiedRank(myCell.total_streak ?? 0).color}22`,
                      borderColor: `${getGamifiedRank(myCell.total_streak ?? 0).color}60`,
                    }
                  ]}>
                    <ThemedText style={[
                      styles.spartanShieldPillText,
                      myCell && { color: getGamifiedRank(myCell.total_streak ?? 0).color }
                    ]}>
                      {myCell ? getGamifiedRank(myCell.total_streak ?? 0).name.toUpperCase() : 'JOIN CELL'}
                    </ThemedText>
                  </View>
                </View>
                <ThemedText style={styles.spartanWidgetTitle} numberOfLines={1}>
                  {myCell ? myCell.name : 'Spartan Squad'}
                </ThemedText>
                <ThemedText style={styles.spartanWidgetSub} numberOfLines={1}>
                  {myCell ? `🔥 ${myCell.total_streak}d Collective Streak` : 'Shared Stakes • 20 Warriors'}
                </ThemedText>
              </TouchableOpacity>

              {/* Right Widget: Spartan Battlefield Live Horn */}
              <TouchableOpacity
                style={[
                  styles.spartanBattleWidget,
                  activeBattle ? styles.spartanBattleActive : null,
                ]}
                activeOpacity={0.8}
                onPress={() => {
                  triggerHaptic(Haptics.ImpactFeedbackStyle.Medium);
                  router.push('/emergency/battlefield' as any);
                }}
              >
                <View style={styles.spartanWidgetHeader}>
                  <ThemedText style={styles.spartanWidgetEmoji}>⚔️</ThemedText>
                  <View style={[styles.spartanShieldPill, { backgroundColor: 'rgba(239, 68, 68, 0.2)' }]}>
                    <View style={styles.liveRedDot} />
                    <ThemedText style={[styles.spartanShieldPillText, { color: '#EF4444' }]}>
                      {activeBattle ? 'LIVE SOS' : 'BATTLE FIELD'}
                    </ThemedText>
                  </View>
                </View>
                <ThemedText style={styles.spartanWidgetTitle} numberOfLines={1}>
                  Battlefield
                </ThemedText>
                <ThemedText style={styles.spartanWidgetSub} numberOfLines={1}>
                  {activeBattle ? `🚨 ${activeBattle.participant_count} Warriors in Wall` : '90s Live Urge Wall (+25 XP)'}
                </ThemedText>
              </TouchableOpacity>
            </Animated.View>

            {/* Quick Actions Hub */}
            <Animated.View
              style={[
                styles.quickActionsContainer,
                { opacity: fadeAnims.actions, transform: [{ translateY: slideAnims.actions }] },
              ]}
            >
              <View style={styles.quickActionsHeader}>
                <ThemedText style={styles.quickActionsTitle} numberOfLines={1}>QUICK ACTIONS & SHORTCUTS</ThemedText>
              </View>

              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.quickActionsScrollContent}
              >
                {displayedActions.map((action) => {
                  const isTaskCompleted =
                    (action.id === 'checkin' && todayTasks?.checkin) ||
                    (action.id === 'meditation' && todayTasks?.meditation) ||
                    (action.id === 'journal' && todayTasks?.journal) ||
                    (action.id === 'coach' && todayTasks?.coach) ||
                    ((action.id === 'emergency' || action.id === 'urge-surfing' || action.id === 'breathing-tool' || action.id === 'grounding' || action.id === 'missions') && todayTasks?.rescue);

                  return (
                    <TouchableOpacity
                      key={action.id}
                      style={styles.quickActionItem}
                      activeOpacity={0.8}
                      onPress={() => handleQuickActionPress(action)}
                    >
                      <View style={{ position: 'relative' }}>
                        <View
                          style={[
                            styles.quickActionIconBg,
                            action.isEmergency && styles.emergencyActionGlow,
                            action.color && !action.isEmergency ? { borderColor: action.color + '40' } : null,
                          ]}
                        >
                          <Ionicons
                            name={action.icon}
                            size={20}
                            color={action.isEmergency ? '#FF4D4D' : (action.color || '#6366F1')}
                          />
                        </View>
                        {isTaskCompleted && (
                          <View style={styles.quickActionDoneBadge}>
                            <Ionicons name="checkmark-circle" size={14} color="#10B981" />
                          </View>
                        )}
                      </View>
                      <ThemedText
                        style={[
                          styles.quickActionLabel,
                          action.isEmergency && styles.emergencyActionText,
                        ]}
                        numberOfLines={1}
                      >
                        {action.title}
                      </ThemedText>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </Animated.View>

            {/* AI Insight Card */}
            {(() => {
              const currentHourNum = new Date().getHours();
              const dynamicTimelineCategory = currentHourNum < 12 ? 'MORNING PROTOCOL' : currentHourNum < 18 ? 'AFTERNOON PROTOCOL' : 'EVENING PROTOCOL';
              const dynamicTimelineColor = currentHourNum < 12 ? '#6366F1' : currentHourNum < 18 ? '#10B981' : '#8B5CF6';
              const dynamicTimelineLabel = dynamicTimelineCategory.split(' ')[0];

              const protocolCategory = recommendations?.ai_insight?.category || (allDailyTasksDone ? 'DISCIPLINE ACHIEVED' : dynamicTimelineCategory);
              const protocolColor = recommendations?.ai_insight?.color || (allDailyTasksDone ? '#10B981' : dynamicTimelineColor);
              const protocolHeadline = recommendations?.ai_insight?.headline || (allDailyTasksDone ? `All ${dynamicTimelineLabel} Recommendations Completed` : `${dynamicTimelineLabel} Focus & Discipline Protocol`);
              const protocolSubtitle = recommendations?.ai_insight?.subtitle || (allDailyTasksDone ? 'Peak neural self-regulation active on your clean trajectory.' : 'Execute your daily discipline rituals to calibrate your recovery score.');
              const protocolActionText = recommendations?.ai_insight?.action_text || (allDailyTasksDone ? 'View Progress' : 'Start Task');
              const protocolIcon = (recommendations?.ai_insight?.icon as any) || (allDailyTasksDone ? 'checkmark-circle' : 'sparkles');

              return (
                <Animated.View
                  style={{ opacity: fadeAnims.insight, transform: [{ translateY: slideAnims.insight }] }}
                >
                  <TouchableOpacity
                    style={[
                      styles.aiInsightCard,
                      protocolColor ? { borderColor: `${protocolColor}40` } : null,
                    ]}
                    activeOpacity={0.9}
                    onPress={() => {
                      triggerHaptic();
                      if (recommendations?.ai_insight?.route) {
                        router.push(recommendations.ai_insight.route as any);
                      } else {
                        setInsightModalVisible(true);
                      }
                    }}
                  >
                    <View style={styles.aiInsightHeaderRow}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 8 }}>
                        <Ionicons
                          name={protocolIcon}
                          size={13}
                          color={protocolColor}
                          style={{ marginRight: 5 }}
                        />
                        <ThemedText
                          style={[
                            styles.aiInsightHeaderLabel,
                            protocolColor ? { color: protocolColor } : null,
                          ]}
                          numberOfLines={1}
                        >
                          {protocolCategory}
                        </ThemedText>
                      </View>
                      {recommendations?.progress_stats && (
                        <View
                          style={[
                            styles.recProgressPill,
                            {
                              backgroundColor:
                                recommendations.progress_stats.completion_percentage === 100
                                  ? 'rgba(16, 185, 129, 0.15)'
                                  : 'rgba(99, 102, 241, 0.15)',
                              borderColor:
                                recommendations.progress_stats.completion_percentage === 100
                                  ? 'rgba(16, 185, 129, 0.35)'
                                  : 'rgba(99, 102, 241, 0.35)',
                            },
                          ]}
                        >
                          <ThemedText
                            style={[
                              styles.recProgressPillText,
                              {
                                color:
                                  recommendations.progress_stats.completion_percentage === 100
                                    ? '#10B981'
                                    : '#818CF8',
                              },
                            ]}
                          >
                            {recommendations.progress_stats.completed_tasks}/{recommendations.progress_stats.total_tasks} Done
                          </ThemedText>
                        </View>
                      )}
                    </View>

                    <View style={styles.aiInsightContentRow}>
                      <View style={styles.aiInsightTextCol}>
                        <ThemedText style={styles.aiInsightHeadline}>
                          {protocolHeadline}
                        </ThemedText>
                        <ThemedText style={styles.aiInsightSubtitle}>
                          {protocolSubtitle}
                        </ThemedText>
                        <View style={styles.aiInsightLinkRow}>
                          <ThemedText
                            style={[
                              styles.aiInsightLinkText,
                              protocolColor ? { color: protocolColor } : null,
                            ]}
                          >
                            {protocolActionText}
                          </ThemedText>
                          <Ionicons
                            name="chevron-forward"
                            size={12}
                            color={protocolColor}
                            style={{ marginLeft: 4 }}
                          />
                        </View>
                      </View>
                      <Image
                        source={require('../../../assets/images/neural_brain_silhouette.png')}
                        style={styles.aiInsightBrainImage}
                        resizeMode="contain"
                      />
                    </View>
                  </TouchableOpacity>
                </Animated.View>
              );
            })()}

            {/* Grid Row 3: Latest Check-in & Today's Journal */}
            <Animated.View
              style={[
                styles.gridRow,
                isExtraSmallScreen && { flexDirection: 'column' },
                { opacity: fadeAnims.grid3, transform: [{ translateY: slideAnims.grid3 }] },
              ]}
            >
              {/* Daily Missions Card (Left Half-Card) */}
              <View style={styles.cardHalf}>
                <View style={styles.cardHeaderRow}>
                  <View style={styles.cardHeaderTitleRow}>
                    <Ionicons name="checkbox-outline" size={13} color="#10B981" />
                    <ThemedText style={styles.cardHeaderLabel} numberOfLines={1}>DAILY MISSIONS</ThemedText>
                  </View>
                </View>

                <View style={styles.checkinMetricsContainer}>
                  {/* Task 1: Check-in */}
                  <View style={styles.metricRow}>
                    <View style={styles.metricLabelGroup}>
                      <Ionicons
                        name={todayTasks?.checkin ? "checkmark-circle" : "create-outline"}
                        size={13}
                        color={todayTasks?.checkin ? "#10B981" : "#6366F1"}
                        style={{ marginRight: 6 }}
                      />
                      <ThemedText style={styles.metricLabelText} numberOfLines={1}>Check-In</ThemedText>
                    </View>
                    {todayTasks?.checkin ? (
                      <ThemedText style={[styles.metricValueText, { color: '#10B981' }]}>Done ✓</ThemedText>
                    ) : (
                      <TouchableOpacity
                        style={styles.cardTaskStartBtn}
                        onPress={() => {
                          triggerHaptic();
                          router.push('/daily-checkin' as any);
                        }}
                      >
                        <ThemedText style={styles.cardTaskStartText}>Start</ThemedText>
                      </TouchableOpacity>
                    )}
                  </View>

                  {/* Task 2: Meditation */}
                  <View style={styles.metricRow}>
                    <View style={styles.metricLabelGroup}>
                      <Ionicons
                        name={todayTasks?.meditation ? "checkmark-circle" : "flower-outline"}
                        size={13}
                        color={todayTasks?.meditation ? "#10B981" : "#10B981"}
                        style={{ marginRight: 6 }}
                      />
                      <ThemedText style={styles.metricLabelText} numberOfLines={1}>Meditation</ThemedText>
                    </View>
                    {todayTasks?.meditation ? (
                      <ThemedText style={[styles.metricValueText, { color: '#10B981' }]}>Done ✓</ThemedText>
                    ) : (
                      <TouchableOpacity
                        style={styles.cardTaskStartBtn}
                        onPress={() => {
                          triggerHaptic();
                          router.push('/meditation' as any);
                        }}
                      >
                        <ThemedText style={styles.cardTaskStartText}>Do</ThemedText>
                      </TouchableOpacity>
                    )}
                  </View>

                  {/* Task 3: Journal */}
                  <View style={styles.metricRow}>
                    <View style={styles.metricLabelGroup}>
                      <Ionicons
                        name={todayTasks?.journal ? "checkmark-circle" : "book-outline"}
                        size={13}
                        color={todayTasks?.journal ? "#10B981" : "#F59E0B"}
                        style={{ marginRight: 6 }}
                      />
                      <ThemedText style={styles.metricLabelText} numberOfLines={1}>Journal</ThemedText>
                    </View>
                    {todayTasks?.journal ? (
                      <ThemedText style={[styles.metricValueText, { color: '#10B981' }]}>Done ✓</ThemedText>
                    ) : (
                      <TouchableOpacity
                        style={styles.cardTaskStartBtn}
                        onPress={() => {
                          triggerHaptic();
                          router.push('/journal' as any);
                        }}
                      >
                        <ThemedText style={styles.cardTaskStartText}>Write</ThemedText>
                      </TouchableOpacity>
                    )}
                  </View>

                  {/* Task 4: AI Coach */}
                  <View style={styles.metricRow}>
                    <View style={styles.metricLabelGroup}>
                      <Ionicons
                        name={todayTasks?.coach ? "checkmark-circle" : "chatbubble-ellipses-outline"}
                        size={13}
                        color={todayTasks?.coach ? "#10B981" : "#8B5CF6"}
                        style={{ marginRight: 6 }}
                      />
                      <ThemedText style={styles.metricLabelText} numberOfLines={1}>AI Coach</ThemedText>
                    </View>
                    {todayTasks?.coach ? (
                      <ThemedText style={[styles.metricValueText, { color: '#10B981' }]}>Done ✓</ThemedText>
                    ) : (
                      <TouchableOpacity
                        style={styles.cardTaskStartBtn}
                        onPress={() => {
                          triggerHaptic();
                          router.push('/chat' as any);
                        }}
                      >
                        <ThemedText style={styles.cardTaskStartText}>Chat</ThemedText>
                      </TouchableOpacity>
                    )}
                  </View>

                  {/* Task 5: Urge Rescue */}
                  <View style={styles.metricRow}>
                    <View style={styles.metricLabelGroup}>
                      <Ionicons
                        name={todayTasks?.rescue ? "checkmark-circle" : "shield-outline"}
                        size={13}
                        color={todayTasks?.rescue ? "#10B981" : "#EF4444"}
                        style={{ marginRight: 6 }}
                      />
                      <ThemedText style={styles.metricLabelText} numberOfLines={1}>Urge Rescue</ThemedText>
                    </View>
                    {todayTasks?.rescue ? (
                      <ThemedText style={[styles.metricValueText, { color: '#10B981' }]}>Done ✓</ThemedText>
                    ) : (
                      <TouchableOpacity
                        style={styles.cardTaskStartBtn}
                        onPress={() => {
                          triggerHaptic();
                          router.push('/emergency' as any);
                        }}
                      >
                        <ThemedText style={styles.cardTaskStartText}>Reset</ThemedText>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              </View>

              {/* Today's Journal Card (Right) */}
              <View style={styles.cardHalf}>
                <View style={styles.cardHeaderRow}>
                  <View style={styles.cardHeaderTitleRow}>
                    <Ionicons name="book-outline" size={13} color="#F59E0B" />
                    <ThemedText style={styles.cardHeaderLabel} numberOfLines={1}>{"TODAY'S JOURNAL"}</ThemedText>
                  </View>
                </View>

                <View style={styles.journalContentRow}>
                  <View style={styles.journalTextCol}>
                    <ThemedText style={styles.journalTitle}>Reflect & Clear Your Mind</ThemedText>
                    <ThemedText style={styles.journalSubtitle}>
                      Write today’s wins, mood, & urge triggers.
                    </ThemedText>
                  </View>
                  <Image
                    source={require('../../../assets/images/journal_notebook.png')}
                    style={styles.journalNotebookImage}
                    resizeMode="contain"
                  />
                </View>

                <TouchableOpacity
                  style={styles.writeNowButton}
                  activeOpacity={0.8}
                  onPress={() => {
                    triggerHaptic();
                    router.push('/journal' as any);
                  }}
                >
                  <ThemedText style={styles.writeNowButtonText}>Write Reflection</ThemedText>
                  <Ionicons name="create-outline" size={14} color="#F59E0B" />
                </TouchableOpacity>
              </View>
            </Animated.View>

            {/* Recommended Meditation Section */}
            <Animated.View
              style={[
                styles.meditationSectionContainer,
                { opacity: fadeAnims.meditation, transform: [{ translateY: slideAnims.meditation }] },
              ]}
            >
              <View style={styles.meditationSectionHeader}>
                <ThemedText style={styles.meditationHeaderTitle} numberOfLines={1}>RECOMMENDED MEDITATION</ThemedText>
                <TouchableOpacity
                  style={styles.meditationSeeAllButton}
                  activeOpacity={0.7}
                  onPress={() => {
                    triggerHaptic();
                    router.push('/meditation');
                  }}
                >
                  <ThemedText style={styles.meditationSeeAllText}>See All</ThemedText>
                  <Ionicons name="chevron-forward" size={12} color="#6366F1" style={{ marginLeft: 2 }} />
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={styles.meditationCardContainer}
                activeOpacity={0.88}
                onPress={() => {
                  triggerHaptic();
                  router.push('/meditation');
                }}
              >
                <View style={styles.meditationThumbnailContainer}>
                  <Image
                    source={
                      recommendations?.recommended_meditation?.image_key &&
                        MEDITATION_IMAGE_MAP[recommendations.recommended_meditation.image_key]
                        ? MEDITATION_IMAGE_MAP[recommendations.recommended_meditation.image_key]
                        : require('../../../assets/images/meditation_forest.png')
                    }
                    style={styles.meditationThumbnail}
                    resizeMode="cover"
                  />
                  <View style={styles.meditationPlayIconCircle}>
                    <Ionicons name="play" size={12} color="#ffffff" style={{ marginLeft: 2 }} />
                  </View>
                </View>

                <View style={styles.meditationTextContainer}>
                  <ThemedText style={styles.meditationTitleText} numberOfLines={1}>
                    {recommendations?.recommended_meditation?.title || 'Deep Relaxation & Focus'}
                  </ThemedText>
                  <ThemedText style={styles.meditationSubtitleText} numberOfLines={2}>
                    {recommendations?.recommended_meditation?.subtitle ||
                      'Reduce stress, calm craving waves & restore inner clarity.'}
                  </ThemedText>
                  <View style={styles.meditationInfoRow}>
                    <View style={styles.meditationInfoBadge}>
                      <Ionicons name="time-outline" size={11} color="#94A3B8" style={{ marginRight: 4 }} />
                      <ThemedText style={styles.meditationInfoText}>
                        {recommendations?.recommended_meditation?.duration_text || '10 min'}
                      </ThemedText>
                    </View>
                    <View style={styles.meditationInfoBadge}>
                      <Ionicons name="stats-chart-outline" size={11} color="#94A3B8" style={{ marginRight: 4 }} />
                      <ThemedText style={styles.meditationInfoText}>
                        {recommendations?.recommended_meditation?.difficulty || 'Beginner'}
                      </ThemedText>
                    </View>
                  </View>
                </View>

                <TouchableOpacity
                  style={styles.meditationStartButton}
                  activeOpacity={0.8}
                  onPress={() => {
                    triggerHaptic();
                    router.push('/meditation');
                  }}
                >
                  <Ionicons name="play" size={10} color="#6366F1" style={{ marginRight: 4 }} />
                  <ThemedText style={styles.meditationStartButtonText}>Start</ThemedText>
                </TouchableOpacity>
              </TouchableOpacity>
            </Animated.View>

            {/* Evening Reflection Reminder */}
            {isEvening && (
              <Animated.View
                style={[
                  styles.eveningReflectionCard,
                  { opacity: fadeAnims.meditation, transform: [{ translateY: slideAnims.meditation }] },
                ]}
              >
                <TouchableOpacity
                  style={styles.eveningReflectionInner}
                  activeOpacity={0.85}
                  onPress={() => {
                    triggerHaptic();
                    router.push('/journal');
                  }}
                >
                  <View style={styles.cardHeaderRow}>
                    <View style={styles.cardHeaderTitleRow}>
                      <Ionicons name="moon-outline" size={13} color="#8B5CF6" />
                      <ThemedText style={styles.cardHeaderLabel} numberOfLines={1}>EVENING REFLECTION</ThemedText>
                    </View>
                    <View style={styles.eveningBadge}>
                      <ThemedText style={styles.eveningBadgeText}>NIGHT ROUTINE</ThemedText>
                    </View>
                  </View>
                  <ThemedText style={styles.eveningTitle}>What helped you stay disciplined today?</ThemedText>
                  <ThemedText style={styles.eveningSubtitle}>
                    Reflect on today&apos;s victories and lock in your mental clarity before bedtime.
                  </ThemedText>
                  <View style={styles.eveningActionBtn}>
                    <ThemedText style={styles.eveningActionBtnText}>Write Short Reflection</ThemedText>
                    <Ionicons name="pencil-outline" size={13} color="#8B5CF6" />
                  </View>
                </TouchableOpacity>
              </Animated.View>
            )}
          </View>

          {/* Spacing bottom to avoid navigation tab overlap */}
          <View style={{ height: 110 }} />
        </ScrollView>
      </PageEntrance>

      {/* --- Vedic Wisdom Modal (Info Button) --- */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={wisdomModalVisible}
        onRequestClose={() => setWisdomModalVisible(false)}
      >
        <View style={styles.modalBg}>
          <View style={[styles.modalContentGlass, { backgroundColor: '#000000', borderColor: 'rgba(0, 229, 255, 0.3)', borderWidth: 1, padding: 20 }]}>
            {/* Perfectly Aligned Modal Header */}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, paddingRight: 8 }}>
                <BrainMiniIcon />
                <ThemedText style={{ marginLeft: 8, fontSize: 16, color: '#00E5FF', fontWeight: '900', flexShrink: 1 }}>
                  Ashtavakra Gita — The Observer
                </ThemedText>
              </View>
              <TouchableOpacity onPress={() => setWisdomModalVisible(false)} activeOpacity={0.7} style={{ padding: 4 }}>
                <Ionicons name="close" size={22} color="#ffffff" />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={{ paddingVertical: 12, gap: 16, alignItems: 'center' }} showsVerticalScrollIndicator={false}>
              <ThemedText style={{ fontSize: 14, color: '#F1F5F9', lineHeight: 23, textAlign: 'center' }}>
                {"Realize the truth of your existence. You are not this physical body, this heartbeat, or the temporary thoughts passing through your mind. Your body is simply an instrument—a tool to experience nature. You are the eternal "}
                <ThemedText style={{ color: '#00E5FF', fontWeight: '900', textShadowColor: 'rgba(0, 229, 255, 0.5)', textShadowRadius: 8 }}>Pure Observer (Sakshi)</ThemedText>
                {" standing peacefully behind every thought, untouched by physical desires."}
              </ThemedText>

              <ThemedText style={{ fontSize: 14, color: '#F1F5F9', lineHeight: 23, textAlign: 'center' }}>
                {"Wasting your vital force on instant gratification like masturbation is a profound mistake. Masturbation is a temporary illusion—a cheap trick of your brain's reward system that promises pleasure but leaves your mind tired, your focus broken, and your spirit empty. Wasting your vital energy on physical friction is "}
                <ThemedText style={{ color: '#F59E0B', fontWeight: '900', textShadowColor: 'rgba(245, 158, 11, 0.5)', textShadowRadius: 8 }}>Utterly Useless & Unworthy Of You</ThemedText>
                {". It drains the power meant for your real growth, health, and success."}
              </ThemedText>

              <ThemedText style={{ fontSize: 14, color: '#F1F5F9', lineHeight: 23, textAlign: 'center' }}>
                {"When an urge arises, do not fight it and do not give in. Simply sit still, close your eyes, and "}
                <ThemedText style={{ color: '#10B981', fontWeight: '900', textShadowColor: 'rgba(16, 185, 129, 0.5)', textShadowRadius: 8 }}>Sit in Meditation</ThemedText>
                {". Watch the desire rise and fall without reacting. In that peaceful silence, your vital energy is automatically "}
                <ThemedText style={{ color: '#10B981', fontWeight: '900', textShadowColor: 'rgba(16, 185, 129, 0.5)', textShadowRadius: 8 }}>Transmuted Into Unshakeable Willpower</ThemedText>
                {", sharp clarity, and inner strength. You are the master of your mind."}
              </ThemedText>
            </ScrollView>

            <TouchableOpacity
              style={[styles.modalCloseBtn, { backgroundColor: '#00E5FF', marginTop: 10, paddingVertical: 12 }]}
              activeOpacity={0.8}
              onPress={() => setWisdomModalVisible(false)}
            >
              <ThemedText style={[styles.modalCloseText, { color: '#000000', fontWeight: '900', fontSize: 13.5, letterSpacing: 0.5 }]}>
                I AM THE UNTOUCHED OBSERVER
              </ThemedText>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* --- Trigger SOS Emergency Modal (Charioteer Urge Rescue & Pranayama Reset) --- */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={triggerModalVisible}
        onRequestClose={() => {
          stopBreathing();
          setTriggerModalVisible(false);
        }}
      >
        <View style={styles.modalBg}>
          <View style={[styles.modalContentGlass, styles.triggerModalGlow, { padding: 0, overflow: 'hidden', maxHeight: '90%' }]}>
            {/* 1. Sleek Minimalist Header */}
            <View style={styles.chariotTopBar}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Ionicons name="shield" size={17} color="#00E5FF" />
                <ThemedText style={styles.modalHeading}>Urge Relief & Breath Reset</ThemedText>
              </View>
              <TouchableOpacity
                onPress={() => {
                  stopBreathing();
                  setTriggerModalVisible(false);
                }}
                style={styles.chariotCloseBtn}
                activeOpacity={0.7}
              >
                <Ionicons name="close" size={20} color="rgba(255, 255, 255, 0.8)" />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.chariotModalScroll} showsVerticalScrollIndicator={false}>
              {/* 2. Hero Artwork with Responsive Cursive Anchor Overlay */}
              <View style={styles.chariotArtworkCard}>
                <Image
                  source={require('../../../assets/images/chariote.png')}
                  style={styles.chariotFullImage}
                  resizeMode="cover"
                />
                <LinearGradient
                  colors={['transparent', 'rgba(3, 7, 18, 0.45)', 'rgba(3, 7, 18, 0.92)']}
                  style={styles.chariotBottomGradient}
                >
                  <View style={styles.chariotHeroPill}>
                    <Ionicons name="flash" size={10} color="#00E5FF" />
                    <ThemedText style={styles.chariotHeroPillText}>YOU HOLD THE REINS</ThemedText>
                  </View>
                  <ThemedText style={styles.chariotCursiveQuote}>
                    "The senses are wild horses. You are the Master."
                  </ThemedText>
                  <ThemedText style={styles.chariotCursiveSubtitle}>
                    Stand unbroken • Take back control with conscious breath
                  </ThemedText>
                </LinearGradient>
              </View>

              {/* 3. Clean Interactive Breathing Visualizer */}
              <View style={styles.breathExerciseContainer}>
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={breathingActive ? stopBreathing : startBreathing}
                  style={styles.breathTouchWrap}
                >
                  <Animated.View
                    style={[
                      styles.breathCircleOuter,
                      { transform: [{ scale: breathAnim }] },
                    ]}
                  >
                    <View style={styles.breathCircleInner}>
                      {breathCountdown !== null ? (
                        <Animated.Text
                          style={[
                            styles.breathCountdownText,
                            { transform: [{ scale: numberPulseAnim }] },
                          ]}
                        >
                          {breathCountdown}
                        </Animated.Text>
                      ) : (
                        <Ionicons name="leaf" size={24} color="#000000" />
                      )}
                    </View>
                  </Animated.View>
                </TouchableOpacity>

                {/* Status & Subtitle */}
                <ThemedText style={styles.breathStatusText}>
                  {breathingActive ? breathText : 'Tap Circle to Begin'}
                </ThemedText>
                <ThemedText style={styles.breathGuideSubtitle}>
                  {breathingActive
                    ? `Cycle ${breathCycleCount + 1} of 7 • Tap circle to pause`
                    : '7-Cycle Box Breathing to eliminate cravings'}
                </ThemedText>
              </View>

              <View style={styles.divider} />

              {/* 4. Action Buttons: Done & Advanced */}
              <View style={styles.rescueActionsWrap}>
                <TouchableOpacity
                  style={[styles.doneBtnPrimaryContainer, mentalShiftApplied && styles.doneBtnPrimarySuccess]}
                  activeOpacity={0.85}
                  onPress={handleDoneUrgeRescue}
                  disabled={mentalShiftApplied}
                >
                  <LinearGradient
                    colors={['#10B981', '#059669']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.doneBtnGradient}
                  >
                    {mentalShiftApplied ? (
                      <ActivityIndicator size="small" color="#ffffff" />
                    ) : (
                      <>
                        <Ionicons name="checkmark" size={18} color="#ffffff" />
                        <ThemedText style={styles.doneBtnPrimaryText}>Done</ThemedText>
                      </>
                    )}
                  </LinearGradient>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.guidedUrgeBtn}
                  activeOpacity={0.7}
                  onPress={() => {
                    stopBreathing();
                    setTriggerModalVisible(false);
                    router.push('/emergency/breathing' as any);
                  }}
                >
                  <Ionicons name="shield-checkmark-outline" size={15} color="rgba(255, 255, 255, 0.6)" />
                  <ThemedText style={styles.guidedUrgeBtnText}>Advanced</ThemedText>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* --- Personalized Mind Training Recommendations & Timeline Protocol Modal --- */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={insightModalVisible}
        onRequestClose={() => setInsightModalVisible(false)}
      >
        <View style={styles.modalBg}>
          <View style={[styles.modalContentGlass, { maxHeight: '88%' }]}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 8 }}>
                <Ionicons
                  name={(recommendations?.time_window?.icon as any) || 'sparkles'}
                  size={20}
                  color={recommendations?.time_window?.theme_color || '#6366F1'}
                  style={{ marginRight: 8 }}
                />
                <View style={{ flex: 1 }}>
                  <ThemedText style={[styles.modalHeading, { fontSize: 16 }]} numberOfLines={1}>
                    {recommendations?.time_window?.title || 'Personalized Mind Protocol'}
                  </ThemedText>
                  <ThemedText style={{ fontSize: 11, color: 'rgba(255, 255, 255, 0.5)', marginTop: 1 }} numberOfLines={1}>
                    {recommendations?.time_window?.subtitle || 'Tailored to your live recovery state & current timeline.'}
                  </ThemedText>
                </View>
              </View>
              <TouchableOpacity onPress={() => setInsightModalVisible(false)} activeOpacity={0.7} style={{ padding: 4 }}>
                <Ionicons name="close" size={22} color="#ffffff" />
              </TouchableOpacity>
            </View>

            {/* Protocol Progress Bar */}
            {recommendations?.progress_stats && (
              <View style={styles.recModalProgressBarBox}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <ThemedText style={styles.recModalProgressLabel}>DAILY DISCIPLINE PROGRESS</ThemedText>
                  <ThemedText style={styles.recModalProgressPct}>
                    {recommendations.progress_stats.completed_tasks}/{recommendations.progress_stats.total_tasks} COMPLETED ({recommendations.progress_stats.completion_percentage}%)
                  </ThemedText>
                </View>
                <View style={styles.recModalProgressTrack}>
                  <View
                    style={[
                      styles.recModalProgressFill,
                      {
                        width: `${recommendations.progress_stats.completion_percentage}%`,
                        backgroundColor:
                          recommendations.progress_stats.completion_percentage === 100 ? '#10B981' : '#6366F1',
                      },
                    ]}
                  />
                </View>
              </View>
            )}

            <ScrollView contentContainerStyle={[styles.modalScroll, { gap: 10, paddingBottom: 16 }]} showsVerticalScrollIndicator={false}>
              {recommendations?.recommended_actions && recommendations.recommended_actions.length > 0 ? (
                recommendations.recommended_actions.map((task) => (
                  <View
                    key={task.id}
                    style={[
                      styles.recTaskCard,
                      task.is_completed && styles.recTaskCardCompleted,
                      { borderColor: task.is_completed ? 'rgba(16, 185, 129, 0.3)' : `${task.color}35` },
                    ]}
                  >
                    <View style={styles.recTaskCardHeader}>
                      {/* Checkbox / Done Icon */}
                      <TouchableOpacity
                        style={[
                          styles.recTaskCheckbox,
                          task.is_completed && styles.recTaskCheckboxChecked,
                          { borderColor: task.is_completed ? '#10B981' : task.color },
                        ]}
                        activeOpacity={0.7}
                        onPress={() => handleCompleteRecommendationTask(task)}
                      >
                        {task.is_completed && <Ionicons name="checkmark" size={14} color="#ffffff" />}
                      </TouchableOpacity>

                      <View style={{ flex: 1, marginHorizontal: 8 }}>
                        <ThemedText
                          style={[
                            styles.recTaskTitle,
                            task.is_completed && { textDecorationLine: 'line-through', color: 'rgba(255, 255, 255, 0.5)' },
                          ]}
                          numberOfLines={1}
                        >
                          {task.title}
                        </ThemedText>
                        <ThemedText style={styles.recTaskTimeWindow}>
                          {task.time_window} Protocol • +{task.xp_reward} XP
                        </ThemedText>
                      </View>

                      {/* Action Button */}
                      <TouchableOpacity
                        style={[
                          styles.recTaskActionBtn,
                          { backgroundColor: task.is_completed ? 'rgba(255, 255, 255, 0.06)' : `${task.color}25` },
                        ]}
                        activeOpacity={0.8}
                        onPress={() => {
                          triggerHaptic();
                          setInsightModalVisible(false);
                          if (task.route) {
                            router.push(task.route as any);
                          }
                        }}
                      >
                        <ThemedText
                          style={[
                            styles.recTaskActionBtnText,
                            { color: task.is_completed ? '#94A3B8' : task.color },
                          ]}
                        >
                          {task.is_completed ? 'Open' : 'Start'}
                        </ThemedText>
                        <Ionicons
                          name="chevron-forward"
                          size={11}
                          color={task.is_completed ? '#94A3B8' : task.color}
                          style={{ marginLeft: 2 }}
                        />
                      </TouchableOpacity>
                    </View>

                    <ThemedText style={styles.recTaskDesc} numberOfLines={2}>
                      {task.description}
                    </ThemedText>
                  </View>
                ))
              ) : (
                <View style={styles.insightBoxBlue}>
                  <ThemedText style={styles.insightBoxTitle}>Mind Strength Protocol Active</ThemedText>
                  <ThemedText style={styles.insightBoxText}>
                    Continue executing your daily check-in, targeted breathwork, and evening reflections to maintain peak dopamine receptor sensitivity.
                  </ThemedText>
                </View>
              )}
            </ScrollView>

            <TouchableOpacity
              style={[styles.modalCloseBtn, { marginTop: 8 }]}
              activeOpacity={0.8}
              onPress={() => setInsightModalVisible(false)}
            >
              <ThemedText style={styles.modalCloseText}>Done</ThemedText>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>



      {/* Rank Roadmap Modal */}
      <Modal
        visible={rankModalVisible}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setRankModalVisible(false)}
      >
        <View style={styles.rankModalOverlay}>
          <View style={[styles.rankModalContainer, { borderColor: currentRank.borderColor }]}>
            {/* Modal Header */}
            <View style={styles.rankModalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View style={[styles.modalHeaderBadge, { backgroundColor: currentRank.bgGlow, borderColor: currentRank.borderColor, borderWidth: 1 }]}>
                  <ThemedText style={{ fontSize: 18 }}>{currentRank.badge}</ThemedText>
                </View>
                <View>
                  <ThemedText style={styles.rankModalTitle}>Discipline Tier Ranks</ThemedText>
                  <ThemedText style={styles.rankModalSubtitle}>15 Milestones of Mind Mastery</ThemedText>
                </View>
              </View>

              <TouchableOpacity
                style={styles.closeModalBtn}
                onPress={() => {
                  triggerHaptic();
                  setRankModalVisible(false);
                }}
              >
                <Ionicons name="close" size={20} color="rgba(255,255,255,0.7)" />
              </TouchableOpacity>
            </View>

            {/* User Current Tier Summary Banner */}
            <View style={[styles.currentTierBanner, { borderColor: currentRank.borderColor, backgroundColor: currentRank.bgGlow }]}>
              <View style={[styles.currentTierIconCircle, { backgroundColor: 'rgba(0, 0, 0, 0.35)', borderColor: currentRank.borderColor, borderWidth: 1 }]}>
                <ThemedText style={styles.currentTierBadgeEmoji}>{currentRank.badge}</ThemedText>
              </View>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <ThemedText style={[styles.currentTierNameText, { color: currentRank.color }]}>
                    {currentRank.name}
                  </ThemedText>
                  <View style={[styles.activeTag, { backgroundColor: currentRank.bgGlow, borderColor: currentRank.borderColor, borderWidth: 1 }]}>
                    <ThemedText style={[styles.activeTagText, { color: currentRank.color }]}>YOUR RANK</ThemedText>
                  </View>
                </View>
                <ThemedText style={styles.currentTierDescText}>
                  "{currentRank.description}" • {streak} Days Streak
                </ThemedText>
              </View>
            </View>

            {/* List of 15 Ranks */}
            <ScrollView style={styles.ranksListScroll} showsVerticalScrollIndicator={false}>
              <View style={{ gap: 9, paddingBottom: 16 }}>
                {GAMIFIED_RANKS.map((rankItem) => {
                  const isCurrent = rankItem.id === currentRank.id;
                  const isPassed = streak > rankItem.maxDays;

                  return (
                    <View
                      key={rankItem.id}
                      style={[
                        styles.rankItemRow,
                        isCurrent && [styles.rankItemRowActive, { borderColor: rankItem.borderColor, backgroundColor: rankItem.bgGlow }],
                        isPassed && [styles.rankItemRowPassed, { borderColor: rankItem.borderColor + '33', backgroundColor: rankItem.bgGlow + '1A' }],
                        !isCurrent && !isPassed && styles.rankItemRowLocked,
                      ]}
                    >
                      <View style={[styles.rankItemEmojiBg, { backgroundColor: rankItem.bgGlow, borderColor: rankItem.borderColor + '66', borderWidth: 1 }]}>
                        <ThemedText style={styles.rankItemEmoji}>{rankItem.badge}</ThemedText>
                      </View>

                      <View style={{ flex: 1, marginHorizontal: 10 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                          <ThemedText style={[styles.rankItemName, { color: isCurrent ? rankItem.color : isPassed ? '#F1F5F9' : 'rgba(255,255,255,0.45)' }]}>
                            {rankItem.name}
                          </ThemedText>
                          <ThemedText style={[styles.rankItemRange, { color: isCurrent ? rankItem.color : 'rgba(255,255,255,0.4)' }]}>
                            {rankItem.rangeText} Days
                          </ThemedText>
                        </View>
                        <ThemedText style={styles.rankItemDesc} numberOfLines={1}>
                          {rankItem.description}
                        </ThemedText>
                      </View>

                      {isCurrent ? (
                        <View style={[styles.currentPillBadge, { backgroundColor: rankItem.bgGlow, borderColor: rankItem.borderColor, borderWidth: 1 }]}>
                          <ThemedText style={[styles.currentPillBadgeText, { color: rankItem.color }]}>CURRENT</ThemedText>
                        </View>
                      ) : isPassed ? (
                        <Ionicons name="checkmark-circle" size={18} color="#10B981" />
                      ) : (
                        <Ionicons name="lock-closed" size={14} color="rgba(255,255,255,0.2)" />
                      )}
                    </View>
                  );
                })}
              </View>
            </ScrollView>

            {/* Done Button */}
            <TouchableOpacity
              style={styles.modalDoneBtn}
              activeOpacity={0.8}
              onPress={() => {
                triggerHaptic();
                setRankModalVisible(false);
              }}
            >
              <LinearGradient
                colors={currentRank.gradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.modalDoneGradient}
              >
                <ThemedText style={styles.modalDoneBtnText}>Got it</ThemedText>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  headerSafeArea: {
    backgroundColor: '#000000',
    borderBottomWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    zIndex: 50,
  },
  mainWrapper: {
    width: '100%',
    maxWidth: 760,
    alignSelf: 'center',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerLeftContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 12,
  },
  profileAvatarContainer: {
    position: 'relative',
    marginRight: 14,
  },
  avatarGradient: {
    width: 46,
    height: 46,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(0, 229, 255, 0.35)',
    shadowColor: '#00E5FF',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  avatarText: {
    color: '#00E5FF',
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  onlineDot: {
    position: 'absolute',
    bottom: -1,
    right: -1,
    width: 12,
    height: 12,
    borderRadius: 4,
    backgroundColor: '#10B981',
    borderWidth: 2,
    borderColor: '#030712',
  },
  welcomeTextContainer: {
    justifyContent: 'center',
    flex: 1,
  },
  welcomeGreetingEyebrow: {
    fontSize: 9.5,
    fontWeight: '900',
    color: '#00E5FF',
    letterSpacing: 1.5,
    marginBottom: 1,
  },
  welcomeTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#ffffff',
    letterSpacing: -0.4,
    lineHeight: 22,
  },
  welcomeSubtitle: {
    fontSize: 11.5,
    fontWeight: '500',
    color: 'rgba(255, 255, 255, 0.65)',
    marginTop: 2,
    lineHeight: 15,
  },
  headerRightContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sosPillButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 77, 77, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255, 77, 77, 0.3)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 4,
  },
  sosPillText: {
    color: '#FF4D4D',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  headerButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  bellBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    backgroundColor: '#6366F1',
    borderRadius: 9,
    width: 15,
    height: 15,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bellBadgeText: {
    color: '#ffffff',
    fontSize: 8.5,
    fontWeight: '900',
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 140,
  },
  scrollContentTablet: {
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 160,
  },
  topDualCardsRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 12,
  },
  topDualCardsRowColumn: {
    flexDirection: 'column',
  },
  topCardContainer: {
    flex: 1,
  },
  topCardTouchable: {
    flex: 1,
  },
  topCardItem: {
    position: 'relative',
    backgroundColor: '#070B18',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(0, 229, 255, 0.25)',
    overflow: 'hidden',
    padding: 12,
    flex: 1,
    minHeight: 270,
    justifyContent: 'space-between',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 5,
  },
  topCardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
    gap: 4,
  },
  topCardHeaderTitle: {
    fontSize: 9.5,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 0.8,
    flexShrink: 1,
  },
  infoIconButton: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  luxuryStreakContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 4,
    overflow: 'visible',
  },
  luxuryNumberRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
    gap: 3,
    paddingVertical: 2,
    overflow: 'visible',
  },
  luxuryStreakBigNumber: {
    fontSize: 34,
    lineHeight: 40,
    fontWeight: '900',
    letterSpacing: -1,
    paddingVertical: 1,
    includeFontPadding: false,
  },
  luxuryStreakDivider: {
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '300',
    color: 'rgba(255, 255, 255, 0.7)',
    marginHorizontal: 2,
    includeFontPadding: false,
  },
  luxuryStreakTargetNumber: {
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '700',
    color: '#FFFFFF',
    includeFontPadding: false,
  },
  luxuryStreakSublabel: {
    fontSize: 8.5,
    fontWeight: '800',
    color: '#00E5FF',
    letterSpacing: 1,
    marginTop: 1,
    marginBottom: 6,
  },
  luxuryProgressBarTrack: {
    width: '86%',
    height: 5,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 2.5,
    overflow: 'hidden',
  },
  luxuryProgressBarFill: {
    height: '100%',
    borderRadius: 2.5,
  },
  streakStatBox: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  streakStatDivider: {
    width: 1,
    height: 28,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
  },
  streakBigNumber: {
    fontSize: 22,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: -0.5,
  },
  streakStatLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: 'rgba(255, 255, 255, 0.65)',
    marginTop: 2,
    letterSpacing: 0.2,
  },
  topCardBottomContainer: {
    alignItems: 'center',
    gap: 6,
  },
  topRankPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    maxWidth: '100%',
  },
  topRankBadgeEmoji: {
    fontSize: 12,
    marginRight: 4,
  },
  topRankText: {
    fontSize: 11,
    fontWeight: '800',
  },
  topCardSubtitle: {
    fontSize: 10.5,
    fontWeight: '600',
    color: '#F1F5F9',
    textAlign: 'center',
    lineHeight: 14.5,
    fontStyle: 'italic',
    textShadowColor: 'rgba(0, 0, 0, 0.95)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  rightCardBody: {
    flex: 1,
    justifyContent: 'space-between',
    marginVertical: 6,
  },
  vedicFocusText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
    lineHeight: 17,
    letterSpacing: 0.1,
    textShadowColor: 'rgba(0, 0, 0, 0.95)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  rightCardXpBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 2,
  },
  rightCardXpText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#C084FC',
  },
  rightLinearProgressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginVertical: 4,
  },
  rightLinearProgressTrack: {
    flex: 1,
    height: 7,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 4,
    overflow: 'hidden',
  },
  rightLinearProgressFill: {
    height: '100%',
    borderRadius: 4,
  },
  rightLinearPercentText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#94A3B8',
  },
  alignedActionContainer: {
    marginTop: 6,
  },
  alignedButtonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  alignedRetainBtn: {
    flex: 1,
    minHeight: 38,
    borderRadius: 10,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.6)',
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 3,
  },
  alignedRelapseBtn: {
    flex: 1,
    minHeight: 38,
    borderRadius: 10,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.35)',
  },
  alignedBtnGradient: {
    flex: 1,
    width: '100%',
    minHeight: 38,
    paddingVertical: 6,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  alignedRetainText: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  alignedRelapseText: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#F87171',
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  loggedStatusBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 38,
    paddingVertical: 6,
    paddingHorizontal: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    gap: 6,
  },
  loggedStatusText: {
    fontSize: 11.5,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  rightCardBottomBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 7,
    paddingHorizontal: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    marginTop: 6,
  },
  rightCardBottomBtnText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#E2E8F0',
  },
  mindStrengthFullCard: {
    width: '100%',
    backgroundColor: 'rgba(15, 23, 42, 0.95)',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(0, 229, 255, 0.25)',
    padding: 16,
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 4,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  cardHeaderTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flexShrink: 1,
    flex: 1,
  },
  cardHeaderLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.8,
    flexShrink: 1,
  },
  rankIndicatorPill: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 14,
    gap: 4,
  },
  rankPillEmoji: {
    fontSize: 12,
  },
  rankIndicatorText: {
    fontSize: 11,
    fontWeight: '900',
  },
  cardContentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 14,
  },
  gaugeColumn: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 118,
  },
  gaugeContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 2,
  },
  gaugeTextContainer: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
  },
  gaugeRankName: {
    fontSize: 10.5,
    fontWeight: '900',
    marginTop: 1,
    letterSpacing: -0.2,
  },
  levelBadgePill: {
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    marginTop: 4,
  },
  levelIndicatorText: {
    fontSize: 10,
    fontWeight: '800',
    textAlign: 'center',
  },
  gaugeSubtext: {
    fontSize: 9.5,
    color: 'rgba(255, 255, 255, 0.45)',
    marginTop: 3,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  interactiveColumn: {
    flex: 1,
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 16,
    padding: 12,
  },
  logPromptContainer: {
    gap: 6,
  },
  logPromptTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: -0.2,
  },
  liveIndicatorBadge: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  liveIndicatorText: {
    color: '#10B981',
    fontSize: 8.5,
    fontWeight: '900',
  },
  logPromptSubtitle: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.5)',
    lineHeight: 14,
  },
  logButtonRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 6,
  },
  retainButton: {
    flex: 1,
    backgroundColor: '#6366F1',
    borderRadius: 10,
    paddingVertical: 10,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  retainButtonText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '800',
  },
  relapseButton: {
    flex: 1,
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    borderRadius: 10,
    paddingVertical: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  relapseButtonText: {
    color: '#EF4444',
    fontSize: 11,
    fontWeight: '800',
  },
  logSuccessContainer: {
    gap: 6,
  },
  successHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  successTitle: {
    fontSize: 13,
    fontWeight: '900',
  },
  successSubtitle: {
    fontSize: 10.5,
    color: 'rgba(255, 255, 255, 0.5)',
    lineHeight: 14,
  },
  philosophyLinkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  philosophyLinkText: {
    fontSize: 10.5,
    color: '#818CF8',
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
  todayFocusCard: {
    width: '100%',
    backgroundColor: 'rgba(15, 23, 42, 0.95)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(0, 229, 255, 0.25)',
    padding: 18,
  },
  xpBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.25)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  xpBadgeText: {
    color: '#F59E0B',
    fontSize: 10.5,
    fontWeight: '800',
  },
  focusContentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginVertical: 10,
  },
  focusTextColumn: {
    flex: 1,
    marginRight: 12,
  },
  focusTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#ffffff',
    letterSpacing: -0.3,
    lineHeight: 20,
  },
  focusSubtitle: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.5)',
    marginTop: 4,
    lineHeight: 15,
  },
  focusMountainImage: {
    width: 58,
    height: 58,
  },
  linearProgressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    marginTop: 4,
  },
  linearProgressTrack: {
    height: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: 3,
    flex: 1,
    marginRight: 10,
    overflow: 'hidden',
  },
  linearProgressFill: {
    height: '100%',
    borderRadius: 3,
  },
  linearProgressPercentText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#ffffff',
  },
  viewMissionsButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    paddingTop: 10,
    marginTop: 12,
  },
  viewMissionsText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#ffffff',
  },
  quickActionsContainer: {
    width: '100%',
  },
  quickActionsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  quickActionsTitle: {
    fontSize: 10,
    fontWeight: '800',
    color: '#94A3B8',
    letterSpacing: 0.8,
    flexShrink: 1,
  },
  customizeButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  customizeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#818CF8',
  },
  quickActionsScrollContent: {
    gap: 10,
    paddingRight: 16,
  },
  quickActionItem: {
    alignItems: 'center',
    width: 66,
  },
  quickActionIconBg: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  emergencyActionGlow: {
    borderColor: '#FF4D4D',
    borderWidth: 1.5,
    backgroundColor: '#260D12',
  },
  emergencyActionText: {
    color: '#FF4D4D',
    fontWeight: '800',
  },
  quickActionLabel: {
    fontSize: 9.5,
    fontWeight: '700',
    color: '#E2E8F0',
    marginTop: 6,
    textAlign: 'center',
  },
  quickActionDoneBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    backgroundColor: '#030712',
    borderRadius: 10,
    zIndex: 10,
  },
  moreActionsIconBg: {
    backgroundColor: 'rgba(99, 102, 241, 0.08)',
    borderColor: 'rgba(99, 102, 241, 0.25)',
    borderStyle: 'dashed',
  },
  aiInsightCard: {
    width: '100%',
    backgroundColor: 'rgba(15, 23, 42, 0.95)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.35)',
    paddingVertical: 12,
    paddingHorizontal: 15,
  },
  aiInsightHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  aiInsightHeaderLabel: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#00E5FF',
    letterSpacing: 0.8,
    flexShrink: 1,
  },
  aiInsightContentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  aiInsightTextCol: {
    flex: 1,
    marginRight: 10,
  },
  aiInsightHeadline: {
    fontSize: 14.5,
    fontWeight: '700',
    color: '#ffffff',
    lineHeight: 19,
    letterSpacing: -0.2,
  },
  aiInsightSubtitle: {
    fontSize: 10.5,
    color: 'rgba(255, 255, 255, 0.55)',
    marginTop: 2,
    lineHeight: 14,
  },
  aiInsightLinkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  aiInsightLinkText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#818CF8',
  },
  aiInsightBrainImage: {
    width: 66,
    height: 66,
  },
  recProgressPill: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 5,
    borderWidth: 1,
  },
  recProgressPillText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  recModalProgressBarBox: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginBottom: 8,
  },
  recModalProgressLabel: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#94A3B8',
    letterSpacing: 0.8,
  },
  recModalProgressPct: {
    fontSize: 10,
    fontWeight: '800',
    color: '#00E5FF',
  },
  recModalProgressTrack: {
    height: 5,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  recModalProgressFill: {
    height: '100%',
    borderRadius: 3,
  },
  recTaskCard: {
    backgroundColor: 'rgba(15, 18, 28, 0.85)',
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
  },
  recTaskCardCompleted: {
    backgroundColor: 'rgba(16, 185, 129, 0.04)',
  },
  recTaskCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  recTaskCheckbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  recTaskCheckboxChecked: {
    backgroundColor: '#10B981',
  },
  recTaskTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#F8FAFC',
    letterSpacing: -0.2,
  },
  recTaskTimeWindow: {
    fontSize: 10,
    fontWeight: '700',
    color: '#94A3B8',
    marginTop: 1,
  },
  recTaskActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 7,
  },
  recTaskActionBtnText: {
    fontSize: 10.5,
    fontWeight: '800',
  },
  recTaskDesc: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.55)',
    lineHeight: 15,
    marginLeft: 30,
  },
  gridRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    gap: 10,
  },
  cardHalf: {
    flex: 1,
    minWidth: 0,
    backgroundColor: 'rgba(15, 18, 28, 0.85)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    padding: 12,
    minHeight: 180,
    justifyContent: 'space-between',
  },
  checkinStreakPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderColor: 'rgba(16, 185, 129, 0.3)',
    borderWidth: 1,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
  },
  checkinStreakText: {
    color: '#10B981',
    fontSize: 10,
    fontWeight: '900',
    marginLeft: 3,
  },
  checkinMetricsContainer: {
    gap: 6,
    marginVertical: 6,
  },
  metricRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.04)',
    paddingBottom: 5,
  },
  metricLabelGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
  },
  metricLabelText: {
    fontSize: 11,
    color: '#E2E8F0',
    fontWeight: '600',
    flexShrink: 1,
  },
  metricValueText: {
    fontSize: 10.5,
    fontWeight: '800',
  },
  cardTaskStartBtn: {
    backgroundColor: 'rgba(99, 102, 241, 0.18)',
    borderColor: 'rgba(99, 102, 241, 0.35)',
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  cardTaskStartText: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#818CF8',
  },
  checkinLinkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  checkinLinkText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#818CF8',
  },
  journalTagBadge: {
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    borderColor: 'rgba(245, 158, 11, 0.25)',
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  journalTagText: {
    color: '#F59E0B',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  journalContentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginVertical: 6,
    flex: 1,
  },
  journalTextCol: {
    flex: 1,
    marginRight: 8,
    justifyContent: 'center',
  },
  journalTitle: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#F8FAFC',
    lineHeight: 18,
    letterSpacing: -0.2,
  },
  journalSubtitle: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 4,
    lineHeight: 15,
  },
  journalNotebookImage: {
    width: 52,
    height: 54,
  },
  writeNowButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(245, 158, 11, 0.14)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.3)',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginTop: 4,
  },
  writeNowButtonText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#F59E0B',
  },
  meditationSectionContainer: {
    width: '100%',
    marginTop: 4,
  },
  meditationSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  meditationHeaderTitle: {
    fontSize: 10,
    fontWeight: '800',
    color: 'rgba(255, 255, 255, 0.5)',
    letterSpacing: 0.8,
    flexShrink: 1,
  },
  meditationSeeAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  meditationSeeAllText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#818CF8',
  },
  meditationCardContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 18, 28, 0.85)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    padding: 14,
  },
  meditationThumbnailContainer: {
    position: 'relative',
    width: 64,
    height: 64,
    borderRadius: 14,
    overflow: 'hidden',
  },
  meditationThumbnail: {
    width: '100%',
    height: '100%',
  },
  meditationPlayIconCircle: {
    position: 'absolute',
    alignSelf: 'center',
    top: 22,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.4)',
  },
  meditationTextContainer: {
    flex: 1,
    marginHorizontal: 12,
  },
  meditationTitleText: {
    fontSize: 13.5,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: -0.2,
  },
  meditationSubtitleText: {
    fontSize: 10.5,
    color: 'rgba(255, 255, 255, 0.45)',
    marginTop: 2,
    lineHeight: 14,
  },
  meditationInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 6,
  },
  meditationInfoBadge: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  meditationInfoText: {
    fontSize: 9.5,
    color: 'rgba(255, 255, 255, 0.4)',
  },
  meditationStartButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(99, 102, 241, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.3)',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  meditationStartButtonText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#818CF8',
  },
  eveningReflectionCard: {
    width: '100%',
    backgroundColor: 'rgba(15, 18, 28, 0.85)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.25)',
    padding: 16,
    marginTop: 4,
  },
  eveningReflectionInner: {
    gap: 8,
  },
  eveningBadge: {
    backgroundColor: 'rgba(139, 92, 246, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.3)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  eveningBadgeText: {
    color: '#A78BFA',
    fontSize: 9.5,
    fontWeight: '800',
  },
  eveningTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: -0.2,
  },
  eveningSubtitle: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.5)',
    lineHeight: 15,
  },
  eveningActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(139, 92, 246, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.25)',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    marginTop: 4,
  },
  eveningActionBtnText: {
    color: '#A78BFA',
    fontSize: 11.5,
    fontWeight: '800',
  },

  // Skeleton Styles
  skeletonAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    marginRight: 12,
  },
  skeletonTextTitle: {
    width: 140,
    height: 14,
    borderRadius: 4,
    marginBottom: 6,
  },
  skeletonTextSubtitle: {
    width: 180,
    height: 10,
    borderRadius: 4,
  },
  skeletonBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
  },
  cardHalfSkeleton: {
    width: '100%',
    backgroundColor: 'rgba(15, 18, 28, 0.85)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    padding: 16,
    height: 220,
    justifyContent: 'space-between',
  },

  // Modals
  modalBg: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContentGlass: {
    width: '94%',
    maxWidth: 540,
    maxHeight: '85%',
    backgroundColor: '#0A0C14',
    borderRadius: 18,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    alignSelf: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.6,
    shadowRadius: 24,
    elevation: 10,
  },
  triggerModalGlow: {
    borderColor: 'rgba(255, 77, 77, 0.3)',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  modalHeading: {
    fontSize: 18,
    fontWeight: '800',
    color: '#ffffff',
  },
  modalSubheading: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.45)',
    marginTop: 2,
  },
  modalScroll: {
    paddingVertical: 18,
    gap: 16,
  },
  philosophySection: {
    gap: 8,
  },
  philosophySubtitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#ffffff',
  },
  philosophyText: {
    fontSize: 12.5,
    color: 'rgba(255, 255, 255, 0.65)',
    lineHeight: 19,
  },
  boldWhite: {
    color: '#ffffff',
    fontWeight: '800',
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
  },
  modalCloseBtn: {
    backgroundColor: '#6366F1',
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  modalCloseText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '800',
  },
  triggerInstruction: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.65)',
    lineHeight: 19,
    textAlign: 'center',
  },
  /* Minimalist Charioteer Urge Rescue Styles */
  chariotTopBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    backgroundColor: '#090D16',
  },
  chariotCloseBtn: {
    padding: 6,
  },
  chariotModalScroll: {
    padding: 16,
    paddingBottom: 48,
    gap: 12,
  },
  chariotArtworkCard: {
    width: '100%',
    height: 180,
    borderRadius: 18,
    overflow: 'hidden',
    position: 'relative',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    backgroundColor: '#000000',
  },
  chariotFullImage: {
    width: '100%',
    height: '100%',
  },
  chariotBottomGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    paddingBottom: 14,
    paddingTop: 36,
    justifyContent: 'flex-end',
    gap: 4,
  },
  chariotHeroPill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0, 229, 255, 0.18)',
    borderColor: 'rgba(0, 229, 255, 0.4)',
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginBottom: 2,
  },
  chariotHeroPillText: {
    fontSize: 8.5,
    fontWeight: '900',
    color: '#00E5FF',
    letterSpacing: 0.8,
  },
  chariotCursiveQuote: {
    fontSize: 15.5,
    fontWeight: '600',
    fontStyle: 'italic',
    fontFamily: Platform.OS === 'ios' ? 'Georgia-Italic' : 'serif',
    color: '#FFFFFF',
    letterSpacing: 0.2,
    lineHeight: 21,
    textShadowColor: 'rgba(0, 0, 0, 0.9)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 5,
  },
  chariotCursiveSubtitle: {
    fontSize: 11.5,
    color: 'rgba(255, 255, 255, 0.85)',
    letterSpacing: 0.2,
    lineHeight: 15,
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  breathExerciseContainer: {
    alignItems: 'center',
    paddingVertical: 6,
    gap: 4,
  },
  breathCircleOuter: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: 'rgba(0, 229, 255, 0.08)',
    borderWidth: 1.5,
    borderColor: 'rgba(0, 229, 255, 0.35)',
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 4,
  },
  breathCircleInner: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#00E5FF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#00E5FF',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 4,
  },
  breathCountdownText: {
    fontSize: 24,
    fontWeight: '900',
    color: '#000000',
  },
  breathStatusText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#ffffff',
    marginTop: 14,
    lineHeight: 24,
    textAlign: 'center',
    letterSpacing: -0.2,
  },
  breathGuideSubtitle: {
    fontSize: 12.5,
    color: 'rgba(255, 255, 255, 0.55)',
    fontWeight: '500',
    textAlign: 'center',
    lineHeight: 17,
    marginTop: 6,
    marginBottom: 8,
    paddingHorizontal: 16,
  },
  breathTouchWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
  },
  rescueActionsWrap: {
    gap: 10,
    marginTop: 4,
  },
  doneBtnPrimaryContainer: {
    width: '100%',
    borderRadius: 14,
    overflow: 'hidden',
  },
  doneBtnGradient: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 14,
  },
  doneBtnPrimarySuccess: {
    opacity: 0.85,
  },
  doneBtnPrimaryText: {
    color: '#ffffff',
    fontSize: 14.5,
    fontWeight: '700',
  },
  guidedUrgeBtn: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 14,
    paddingVertical: 13,
  },
  guidedUrgeBtnText: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 13,
    fontWeight: '600',
  },
  insightBoxBlue: {
    backgroundColor: 'rgba(99, 102, 241, 0.12)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.25)',
    padding: 16,
    gap: 6,
  },
  insightBoxTitle: {
    fontSize: 13.5,
    fontWeight: '800',
    color: '#818CF8',
  },
  insightBoxText: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.75)',
    lineHeight: 18,
  },

  // Catalog Modal
  modalContentGlassLarge: {
    width: '94%',
    maxWidth: 540,
    maxHeight: '85%',
    backgroundColor: '#0A0C14',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    padding: 18,
    gap: 8,
    alignSelf: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.6,
    shadowRadius: 24,
    elevation: 10,
  },
  searchBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'ios' ? 10 : 6,
    marginTop: 4,
  },
  searchInput: {
    flex: 1,
    color: '#ffffff',
    fontSize: 13,
    padding: 0,
  },
  categoryFilterScroll: {
    gap: 8,
    paddingRight: 10,
  },
  categoryFilterPill: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  categoryFilterPillActive: {
    backgroundColor: '#6366F1',
    borderColor: '#6366F1',
  },
  categoryFilterText: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.5)',
  },
  categoryFilterTextActive: {
    color: '#ffffff',
    fontWeight: '800',
  },
  catalogGridContent: {
    gap: 8,
    paddingVertical: 4,
  },
  catalogCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    padding: 12,
  },
  catalogCardContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  catalogIconBg: {
    width: 38,
    height: 38,
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  catalogTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#ffffff',
  },
  catalogSubtitle: {
    fontSize: 10.5,
    color: 'rgba(255, 255, 255, 0.45)',
    marginTop: 2,
  },
  emergencyBadge: {
    backgroundColor: 'rgba(255, 77, 77, 0.2)',
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 4,
  },
  emergencyBadgeText: {
    color: '#FF4D4D',
    fontSize: 8.5,
    fontWeight: '900',
  },
  pinToggleButton: {
    padding: 6,
  },
  modalBottomBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    paddingTop: 12,
    marginTop: 4,
    gap: 8,
  },
  resetBtn: {
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  resetBtnText: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.45)',
    fontWeight: '600',
  },
  selectAllBtn: {
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  selectAllBtnText: {
    fontSize: 11,
    color: '#818CF8',
    fontWeight: '700',
  },
  doneBtn: {
    backgroundColor: '#6366F1',
    paddingVertical: 9,
    paddingHorizontal: 20,
    borderRadius: 12,
  },
  doneBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800',
  },
  missionTaskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    paddingHorizontal: 10,
    paddingVertical: 7,
    gap: 6,
  },
  missionTaskText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.85)',
    flex: 1,
  },
  missionTaskDone: {
    color: '#10B981',
    textDecorationLine: 'line-through',
  },
  doneBadgePill: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  doneBadgeText: {
    fontSize: 9.5,
    fontWeight: '700',
    color: '#10B981',
  },
  taskActionBtn: {
    backgroundColor: 'rgba(99, 102, 241, 0.2)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.4)',
    paddingHorizontal: 9,
    paddingVertical: 3,
  },
  taskActionText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#818CF8',
  },
  streakRewardEarnedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.35)',
    padding: 8,
    marginTop: 4,
  },
  streakRewardEarnedText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#F59E0B',
  },
  streakRewardHintText: {
    fontSize: 9,
    color: 'rgba(255, 255, 255, 0.4)',
    textAlign: 'center',
    marginTop: 4,
  },
  // Rank Modal Styles
  rankModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  rankModalContainer: {
    width: '100%',
    maxWidth: 440,
    backgroundColor: '#090D16',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    padding: 20,
    maxHeight: '88%',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 10,
  },
  rankModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  modalHeaderBadge: {
    width: 38,
    height: 38,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rankModalTitle: {
    fontSize: 17,
    fontWeight: '900',
    color: '#ffffff',
    letterSpacing: -0.3,
  },
  rankModalSubtitle: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.45)',
  },
  closeModalBtn: {
    padding: 6,
  },
  currentTierBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
    gap: 12,
    marginBottom: 16,
  },
  currentTierIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  currentTierBadgeEmoji: {
    fontSize: 24,
  },
  currentTierNameText: {
    fontSize: 15,
    fontWeight: '900',
  },
  activeTag: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  activeTagText: {
    fontSize: 8.5,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  currentTierDescText: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.7)',
    marginTop: 2,
  },
  ranksListScroll: {
    maxHeight: 400,
  },
  rankItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: 14,
    padding: 11,
  },
  rankItemRowActive: {
    borderWidth: 1.5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
  },
  rankItemRowPassed: {
    borderWidth: 1,
  },
  rankItemRowLocked: {
    opacity: 0.55,
  },
  rankItemEmojiBg: {
    width: 36,
    height: 36,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rankItemEmoji: {
    fontSize: 18,
  },
  rankItemName: {
    fontSize: 13,
    fontWeight: '800',
  },
  rankItemRange: {
    fontSize: 10,
    fontWeight: '700',
  },
  rankItemDesc: {
    fontSize: 10.5,
    color: 'rgba(255, 255, 255, 0.45)',
    marginTop: 1,
  },
  currentPillBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  currentPillBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  modalDoneBtn: {
    height: 44,
    borderRadius: 14,
    overflow: 'hidden',
    marginTop: 14,
  },
  modalDoneGradient: {
    flex: 1,
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalDoneBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  spartanWidgetRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 6,
    marginBottom: 4,
  },
  spartanCellWidget: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.025)',
    borderRadius: 16,
    padding: 13,
    borderWidth: 1,
    borderColor: 'rgba(0, 229, 255, 0.2)',
  },
  spartanWidgetGold: {
    borderColor: 'rgba(245, 158, 11, 0.4)',
    backgroundColor: 'rgba(245, 158, 11, 0.03)',
  },
  spartanBattleWidget: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.025)',
    borderRadius: 16,
    padding: 13,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.2)',
  },
  spartanBattleActive: {
    borderColor: '#EF4444',
    backgroundColor: 'rgba(239, 68, 68, 0.06)',
  },
  spartanWidgetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  spartanWidgetEmoji: {
    fontSize: 18,
  },
  spartanShieldPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 229, 255, 0.12)',
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    borderRadius: 8,
    borderWidth: 0.5,
    borderColor: 'rgba(0, 229, 255, 0.25)',
    gap: 4,
  },
  spartanShieldPillText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#00E5FF',
    letterSpacing: 0.6,
  },
  liveRedDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#EF4444',
  },
  spartanWidgetTitle: {
    fontSize: 13.5,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 2,
    letterSpacing: -0.2,
  },
  spartanWidgetSub: {
    fontSize: 10.5,
    color: '#94A3B8',
    fontWeight: '500',
    lineHeight: 14,
  },
});
