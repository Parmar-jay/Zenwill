export interface YogicTechnique {
  id: string;
  title: string;
  sanskritTitle: string;
  rating: number; // e.g. 5 or 4
  ratingStars: string; // e.g. "5.0"
  source: string; // e.g. "Hatha Yoga Pradipika, Gheranda Samhita"
  purpose: string;
  benefits: string[];
  durationMinutes: number; // e.g. 5
  durationText: string; // e.g. "5-10 Mins"
  difficulty: 'Very Easy' | 'Beginner' | 'Intermediate' | 'Advanced';
  useWhen: string[];
  category: 'Pranayama' | 'Devotional & Mantra' | 'Emergency Reset' | 'Focus & Gita';
  color: string;
  accentGlow: string;
  image: any;
  steps: {
    title: string;
    description: string;
    durationSec?: number;
    visualCue?: string;
    isMandatorySetup?: boolean;
    phase?: 'setup' | 'inhale' | 'pause' | 'exhale' | 'rest';
  }[];
  mantraText?: string;
  gitaVerse?: {
    sanskrit: string;
    translation: string;
    chapter: string;
  };
}

export const YOGIC_PRACTICES: YogicTechnique[] = [
  {
    id: 'nadi-shodhana',
    title: 'Nadi Shodhana',
    sanskritTitle: 'Alternate Nostril Breathing',
    rating: 5,
    ratingStars: '5.0',
    source: 'Hatha Yoga Pradipika, Gheranda Samhita',
    purpose: 'Considered one of the safest and most balanced pranayama techniques. Purifies subtle energy channels (nadis) and creates profound mental balance.',
    benefits: [
      'Reduces stress and calms nervous tension',
      'Calms acute anxiety and mental restlessness',
      'Improves concentration and mental clarity',
      'Reduces impulsive thinking and compulsive urges',
      'Helps regulate emotional reactions',
      'Supports better autonomic nervous system balance'
    ],
    durationMinutes: 7,
    durationText: '5-10 Mins',
    difficulty: 'Beginner',
    useWhen: ['High stress', 'Anxiety', 'Anger', 'Strong urges', 'Before sleep'],
    category: 'Pranayama',
    color: '#3B82F6',
    accentGlow: 'rgba(59, 130, 246, 0.25)',
    image: require('@/assets/images/nadi_shodhana.png'),
    steps: [
      {
        title: '[Mandatory Setup] Upright Posture & Sitting Straight',
        description: 'Sit upright in a comfortable cross-legged posture or chair. Keep spine straight, chin level, shoulders relaxed, and chest open. Place left hand on knee in Jnana mudra.',
        durationSec: 10,
        visualCue: 'Sit Straight & Align Spine',
        isMandatorySetup: true,
        phase: 'setup',
      },
      {
        title: 'Inhale Left Nostril (Pooraka)',
        description: 'Close right nostril with right thumb. Inhale smoothly, deeply, and quietly through left nostril.',
        durationSec: 4,
        visualCue: 'Inhale Left (4s)',
        phase: 'inhale',
      },
      {
        title: 'Retention / Pause (Kumbhaka)',
        description: 'Close both nostrils gently. Hold breath with calm awareness and steady mind.',
        durationSec: 4,
        visualCue: 'Pause / Hold (4s)',
        phase: 'pause',
      },
      {
        title: 'Exhale Right Nostril (Rechaka)',
        description: 'Release right nostril. Exhale completely, smoothly, and without rushing.',
        durationSec: 4,
        visualCue: 'Exhale Right (4s)',
        phase: 'exhale',
      },
      {
        title: 'Inhale Right Nostril (Pooraka)',
        description: 'Keep left nostril closed. Inhale deeply through right nostril.',
        durationSec: 4,
        visualCue: 'Inhale Right (4s)',
        phase: 'inhale',
      },
      {
        title: 'Retention / Pause (Kumbhaka)',
        description: 'Close both nostrils. Pause softly without straining.',
        durationSec: 4,
        visualCue: 'Pause / Hold (4s)',
        phase: 'pause',
      },
      {
        title: 'Exhale Left Nostril (Rechaka)',
        description: 'Release left nostril. Exhale fully, relaxing mental tension.',
        durationSec: 4,
        visualCue: 'Exhale Left (4s)',
        phase: 'exhale',
      },
      {
        title: '2s Rest Between Rounds',
        description: 'Rest for 2 seconds. Feel the peaceful balance before beginning the next round.',
        durationSec: 2,
        visualCue: '2s Rest & Reset',
        phase: 'rest',
      }
    ]
  },
  {
    id: 'bhramari',
    title: 'Bhramari Pranayama',
    sanskritTitle: 'Humming Bee Breath',
    rating: 5,
    ratingStars: '5.0',
    source: 'Hatha Yoga Traditions',
    purpose: 'The humming vibration encourages deep exhalation, soothing the central nervous system and quieting mental chatter.',
    benefits: [
      'Calms the mind quickly in high stress',
      'Reduces anger and emotional agitation',
      'Decreases mental restlessness',
      'Promotes immediate parasympathetic relaxation',
      'Quiets racing or intrusive thoughts'
    ],
    durationMinutes: 5,
    durationText: '5 Mins',
    difficulty: 'Very Easy',
    useWhen: ['Anger', 'Emotional overload', 'Anxiety', 'Urges caused by stress'],
    category: 'Emergency Reset',
    color: '#8B5CF6',
    accentGlow: 'rgba(139, 92, 246, 0.25)',
    image: require('@/assets/images/bhramari.png'),
    steps: [
      {
        title: '[Mandatory Setup] Upright Posture & Sitting Straight',
        description: 'Sit straight with spine erect and chest open. Close eyes softly and place thumbs over ear tragus.',
        durationSec: 10,
        visualCue: 'Sit Straight & Align Spine',
        isMandatorySetup: true,
        phase: 'setup',
      },
      {
        title: 'Deep Inhalation (Pooraka)',
        description: 'Inhale deeply and quietly through both nostrils, expanding chest and abdomen.',
        durationSec: 4,
        visualCue: 'Deep Inhale (4s)',
        phase: 'inhale',
      },
      {
        title: 'Gentle Pause (Kumbhaka)',
        description: 'Pause briefly at full expansion with mind resting inward.',
        durationSec: 2,
        visualCue: 'Pause / Hold (2s)',
        phase: 'pause',
      },
      {
        title: 'Humming Bee Exhale (Rechaka)',
        description: 'Exhale slowly while producing a smooth, resonant humming sound (Bzzz-mmmm) like a honeybee.',
        durationSec: 8,
        visualCue: 'Humming Exhale (8s)',
        phase: 'exhale',
      },
      {
        title: '2s Rest Between Rounds',
        description: 'Take a 2-second restorative rest. Feel the soothing vibration calming the brain.',
        durationSec: 2,
        visualCue: '2s Rest & Vibration',
        phase: 'rest',
      }
    ]
  },
  {
    id: 'dirgha-pranayama',
    title: 'Dirgha Pranayama',
    sanskritTitle: 'Deep Diaphragmatic Breathing',
    rating: 4,
    ratingStars: '4.0',
    source: 'Traditional Yogic Breathing Practices',
    purpose: 'Slow, diaphragmatic belly breathing activates the vagus nerve and triggers the body natural relaxation response.',
    benefits: [
      'Reduces physiological stress and cortisol',
      'Slows elevated heart rate',
      'Promotes deep emotional calmness',
      'Improves cellular oxygen exchange',
      'Helps release physical muscle tension'
    ],
    durationMinutes: 5,
    durationText: '3-10 Mins',
    difficulty: 'Very Easy',
    useWhen: ['Panic', 'Anxiety', 'Cravings', 'Before making an impulsive decision'],
    category: 'Pranayama',
    color: '#10B981',
    accentGlow: 'rgba(16, 185, 129, 0.25)',
    image: require('@/assets/images/dirgha_pranayama.png'),
    steps: [
      {
        title: '[Mandatory Setup] Upright Posture & Sitting Straight',
        description: 'Sit straight with spine erect, shoulders unrounded, and hands resting gently on thighs.',
        durationSec: 10,
        visualCue: 'Sit Straight & Align Spine',
        isMandatorySetup: true,
        phase: 'setup',
      },
      {
        title: 'Abdominal Inhale (Pooraka)',
        description: 'Inhale slowly through nose, filling abdomen first, then ribs, then chest.',
        durationSec: 4,
        visualCue: 'Belly Expands Inhale (4s)',
        phase: 'inhale',
      },
      {
        title: 'Breath Retention (Kumbhaka)',
        description: 'Hold breath softly at full expansion without straining throat muscles.',
        durationSec: 4,
        visualCue: 'Pause / Hold (4s)',
        phase: 'pause',
      },
      {
        title: 'Slow Complete Exhale (Rechaka)',
        description: 'Exhale smoothly through nose, releasing chest, ribs, and pulling belly inward.',
        durationSec: 6,
        visualCue: 'Slow Exhale (6s)',
        phase: 'exhale',
      },
      {
        title: '2s Rest Between Rounds',
        description: 'Pause for 2 seconds. Relax completely before starting the next diaphragmatic cycle.',
        durationSec: 2,
        visualCue: '2s Rest & Reset',
        phase: 'rest',
      }
    ]
  },
  {
    id: 'ajapa-japa',
    title: 'Ajapa Japa',
    sanskritTitle: 'Breath & Mantra Awareness',
    rating: 5,
    ratingStars: '5.0',
    source: 'Upanishadic & Yogic Meditation Traditions',
    purpose: 'Gently observe the breath while mentally repeating a sacred mantra, anchoring consciousness in higher divine awareness.',
    benefits: [
      'Reduces mental wandering and distraction',
      'Improves sustained attention and focus',
      'Encourages detachment from intrusive thoughts',
      'Supports devotional focus and spiritual grounding',
      'Helps redirect attention away from compulsive thinking'
    ],
    durationMinutes: 15,
    durationText: '10-20 Mins',
    difficulty: 'Intermediate',
    useWhen: ['Persistent lustful thoughts', 'Loneliness', 'Evening urges', 'Mental restlessness'],
    category: 'Devotional & Mantra',
    color: '#F59E0B',
    accentGlow: 'rgba(245, 158, 11, 0.25)',
    image: require('@/assets/images/ajapa_japa.png'),
    mantraText: 'Hare Krishna Hare Krishna Krishna Krishna Hare Hare\nHare Rama Hare Rama Rama Rama Hare Hare',
    steps: [
      {
        title: '[Mandatory Setup] Upright Posture & Sitting Straight',
        description: 'Sit upright in a quiet space with spine straight and head erect. Relax all facial muscles.',
        durationSec: 10,
        visualCue: 'Sit Straight & Align Spine',
        isMandatorySetup: true,
        phase: 'setup',
      },
      {
        title: 'Inhale + Hare Krishna (Pooraka)',
        description: 'Inhale slowly while mentally vibrating: Hare Krishna Hare Krishna Krishna Krishna Hare Hare.',
        durationSec: 5,
        visualCue: 'Inhale + Hare Krishna (5s)',
        phase: 'inhale',
      },
      {
        title: 'Sacred Pause (Kumbhaka)',
        description: 'Hold breath gently with mind absorbed in divine sound vibration.',
        durationSec: 3,
        visualCue: 'Sacred Pause (3s)',
        phase: 'pause',
      },
      {
        title: 'Exhale + Hare Rama (Rechaka)',
        description: 'Exhale completely while mentally vibrating: Hare Rama Hare Rama Rama Rama Hare Hare.',
        durationSec: 5,
        visualCue: 'Exhale + Hare Rama (5s)',
        phase: 'exhale',
      },
      {
        title: '2s Rest Between Rounds',
        description: 'Rest for 2 seconds. Feel total inner peace before repeating the sacred mantra cycle.',
        durationSec: 2,
        visualCue: '2s Rest & Peace',
        phase: 'rest',
      }
    ]
  },
  {
    id: 'krishna-centered',
    title: 'Krishna-Centered Meditation',
    sanskritTitle: 'Bhagavad Gita Chapter 6 Inspired',
    rating: 5,
    ratingStars: '5.0',
    source: 'Bhagavad Gita (Chapter 6)',
    purpose: 'Not merely a breathing exercise, but a spiritual meditation practice. Trains the mind toward Krishna through Abhyasa (practice) and Vairagya (detachment).',
    benefits: [
      'Builds long-term self-control and mastery',
      'Strengthens emotional resilience',
      'Encourages discipline and clarity',
      'Reduces attachment-driven compulsive thinking',
      'Supports deep spiritual growth'
    ],
    durationMinutes: 15,
    durationText: '10-20 Mins',
    difficulty: 'Intermediate',
    useWhen: ['Building core self-control', 'Spiritual centering', 'Evening reflection', 'Overcoming urges'],
    category: 'Focus & Gita',
    color: '#06B6D4',
    accentGlow: 'rgba(6, 182, 212, 0.25)',
    image: require('@/assets/images/krishna_meditation.png'),
    gitaVerse: {
      sanskrit: 'yato yato niścalati manaś cañcalam asthiram\ntatas tato niyamyaitad ātmany eva vaśaṁ nayet',
      translation: 'From wherever the mind wanders due to its restless and unsteady nature, one must certainly withdraw it and bring it back under the control of the Self.',
      chapter: 'Bhagavad Gita 6.26'
    },
    steps: [
      {
        title: '[Mandatory Setup] Upright Posture & Sitting Straight',
        description: 'Sit in a holy posture with spine erect, chest open, hands in lap, and gaze turned inward.',
        durationSec: 10,
        visualCue: 'Sit Straight & Align Spine',
        isMandatorySetup: true,
        phase: 'setup',
      },
      {
        title: 'Deep Spiritual Inhale (Pooraka)',
        description: 'Inhale deeply, drawing vitality and divine energy into the mind and heart.',
        durationSec: 5,
        visualCue: 'Spiritual Inhale (5s)',
        phase: 'inhale',
      },
      {
        title: 'Abhyasa Retention & Focus (Kumbhaka)',
        description: 'Pause and retain breath. Whenever the restless mind wanders, gently pull it back to the Self.',
        durationSec: 5,
        visualCue: 'Abhyasa Pause (5s)',
        phase: 'pause',
      },
      {
        title: 'Surrender Exhale (Rechaka)',
        description: 'Exhale fully, surrendering all material worries, desires, and stress at Krishna feet.',
        durationSec: 6,
        visualCue: 'Surrender Exhale (6s)',
        phase: 'exhale',
      },
      {
        title: '2s Rest Between Rounds',
        description: 'Rest for 2 seconds in serene stillness before beginning the next meditation cycle.',
        durationSec: 2,
        visualCue: '2s Rest & Stillness',
        phase: 'rest',
      }
    ]
  }
];

export const EMERGENCY_SOS_SEQUENCE = {
  title: 'Emergency Urge De-escalation Protocol',
  totalDurationText: '5 Mins Protocol',
  phases: [
    {
      stepNumber: 1,
      title: '1 Min Deep Diaphragmatic Breathing',
      sanskrit: 'Dirgha Pranayama',
      durationSec: 60,
      color: '#10B981',
      description: 'Slow abdominal breathing to activate vagal parasympathetic nerves and lower heart rate spike.'
    },
    {
      stepNumber: 2,
      title: '2 Mins Humming Bee Breath',
      sanskrit: 'Bhramari Pranayama',
      durationSec: 120,
      color: '#8B5CF6',
      description: 'Acoustic humming vibration to quiet brain agitation and release mental tightness.'
    },
    {
      stepNumber: 3,
      title: '2 Mins Alternate Nostril Breathing',
      sanskrit: 'Nadi Shodhana',
      durationSec: 120,
      color: '#3B82F6',
      description: 'Purify subtle energy channels and bring left/right brain hemisphere balance.'
    },
    {
      stepNumber: 4,
      title: 'Grounding & Devotional Reflection',
      sanskrit: 'Ajapa / Gita Anchor',
      durationSec: 30,
      color: '#F59E0B',
      description: 'Brief grounding prompt and optional Krishna mantra or prayer anchor.'
    }
  ]
};
