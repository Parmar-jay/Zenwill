import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ─── Identity ───────────────────────────────────────────────────────────────
export type AgeGroup = 'under_18' | '18_24' | '25_34' | '35_44' | '45_plus' | '';
export type Gender = 'male' | 'female' | 'non_binary' | 'prefer_not' | '';
export type Occupation = 'student' | 'employee' | 'business_owner' | 'freelancer' | 'homemaker' | 'other' | '';
export type DailySchedule = 'early_morning' | 'morning' | 'afternoon' | 'evening' | 'night_shift' | 'irregular' | '';
export type RelationshipStatus = 'single' | 'married' | 'in_relationship' | 'prefer_not' | '';

// ─── Mental State ────────────────────────────────────────────────────────────
export type SelfControl = 'very_strong' | 'strong' | 'average' | 'weak' | 'very_weak' | '';
export type Mood = 'excellent' | 'good' | 'neutral' | 'low' | 'very_low' | '';
export type EnergyLevel = 'high' | 'medium' | 'low' | 'very_low' | '';
export type SleepQuality = 'excellent' | 'good' | 'average' | 'poor' | 'very_poor' | '';
export type FocusLevel = 'excellent' | 'good' | 'average' | 'poor' | 'very_poor' | '';
export type EmotionalControl = 'excellent' | 'good' | 'average' | 'poor' | 'very_poor' | '';
export type UrgeFrequency = 'rarely' | 'weekly' | 'few_times_weekly' | 'daily' | 'multiple_daily' | '';
export type ScreenTime = 'under_2h' | '2_4h' | '4_6h' | '6_8h' | 'more_8h' | '';

// ─── Purpose ─────────────────────────────────────────────────────────────────
export type ImprovementReason =
  | 'better_focus' | 'better_career' | 'better_relationships' | 'better_mental_health'
  | 'better_physical_health' | 'stronger_discipline' | 'more_confidence' | 'personal_freedom'
  | 'spiritual_growth' | 'better_sleep' | 'become_best_self';

// ─── Triggers / Habit Loop ────────────────────────────────────────────────────
export type UrgeTime = 'morning' | 'afternoon' | 'evening' | 'night' | 'late_night';
export type UrgeLocation =
  | 'bedroom' | 'bathroom' | 'living_room' | 'office' | 'college'
  | 'traveling' | 'home_alone' | 'anywhere';
export type EmotionalTrigger =
  | 'stress' | 'anxiety' | 'loneliness' | 'boredom' | 'fatigue' | 'anger'
  | 'rejection' | 'conflict' | 'social_media' | 'watching_videos' | 'being_alone'
  | 'after_work' | 'before_sleeping' | 'after_waking' | 'random';
export type FirstWarningSign = 'thought' | 'fantasy' | 'memory' | 'emotion' | 'physical' | 'craving' | 'dont_know' | '';
export type UrgeDuration = 'under_5min' | '5_10min' | '10_20min' | 'over_20min' | '';
export type TypicalResponse =
  | 'give_in' | 'resist' | 'distract' | 'exercise' | 'walk'
  | 'meditation' | 'prayer' | 'call_someone' | 'sleep' | 'other_healthy';
export type EmotionalAftermath =
  | 'guilt' | 'shame' | 'regret' | 'empty' | 'tired' | 'anxious' | 'motivated' | 'no_emotion';
export type PrimaryDevice = 'phone' | 'tablet' | 'laptop' | 'desktop' | 'tv' | 'multiple' | '';
export type OnlinePlatform =
  | 'instagram' | 'youtube' | 'reddit' | 'x' | 'facebook'
  | 'browser' | 'streaming' | 'gaming' | 'other';

// ─── Full Profile Shape ───────────────────────────────────────────────────────
export interface OnboardingProfile {
  // Screen 1 — Identity
  firstName: string;
  ageGroup: AgeGroup;
  gender: Gender;
  occupation: Occupation;
  country: string;
  timezone: string;
  dailySchedule: DailySchedule;
  relationshipStatus: RelationshipStatus;

  // Screen 2 — Mental State
  selfControl: SelfControl;
  motivationToChange: number;   // 1–10
  confidenceInQuitting: number; // 1–10
  stressLevel: number;          // 1–10
  anxietyLevel: number;         // 1–10
  mood: Mood;
  energy: EnergyLevel;
  sleepQuality: SleepQuality;
  focusLevel: FocusLevel;
  emotionalControl: EmotionalControl;
  urgeFrequency: UrgeFrequency;
  screenTime: ScreenTime;

  // Screen 3 — Purpose
  improvementReasons: ImprovementReason[];
  primaryOutcome: ImprovementReason | '';
  personalStatement: string; // max 100 chars

  // Screen 4 — Triggers / Habit Loop
  urgeTimes: UrgeTime[];
  urgeLocations: UrgeLocation[];
  emotionalTriggers: EmotionalTrigger[];
  firstWarningSign: FirstWarningSign;
  urgeDuration: UrgeDuration;
  typicalResponses: TypicalResponse[];
  emotionalAftermath: EmotionalAftermath[];
  primaryDevice: PrimaryDevice;
  onlinePlatforms: OnlinePlatform[];

  // Screen 5 — Permissions
  permNotifications: boolean;

  // Oath & Signature
  signature?: string;
  isPledgeSigned?: boolean;
}

interface OnboardingState extends OnboardingProfile {
  updateProfile: (patch: Partial<OnboardingProfile>) => void;
  resetProfile: () => void;
}

const DEFAULT_PROFILE: OnboardingProfile = {
  // Identity
  firstName: '',
  ageGroup: '',
  gender: '',
  occupation: '',
  country: '',
  timezone: '',
  dailySchedule: '',
  relationshipStatus: '',

  // Mental State
  selfControl: '',
  motivationToChange: 5,
  confidenceInQuitting: 5,
  stressLevel: 5,
  anxietyLevel: 5,
  mood: '',
  energy: '',
  sleepQuality: '',
  focusLevel: '',
  emotionalControl: '',
  urgeFrequency: '',
  screenTime: '',

  // Purpose
  improvementReasons: [],
  primaryOutcome: '',
  personalStatement: '',

  // Triggers
  urgeTimes: [],
  urgeLocations: [],
  emotionalTriggers: [],
  firstWarningSign: '',
  urgeDuration: '',
  typicalResponses: [],
  emotionalAftermath: [],
  primaryDevice: '',
  onlinePlatforms: [],

  // Permissions
  permNotifications: false,

  // Oath & Signature
  signature: '',
  isPledgeSigned: false,
};

export const useOnboardingStore = create<OnboardingState>()(
  persist(
    (set) => ({
      ...DEFAULT_PROFILE,
      updateProfile: (patch) => set((state) => ({ ...state, ...patch })),
      resetProfile: () => set(DEFAULT_PROFILE),
    }),
    {
      name: 'zenwill-onboarding-profile',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
