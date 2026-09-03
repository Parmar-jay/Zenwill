import { Platform } from 'react-native';

const localAjapaJapaAudio = require('../../assets/music/atlasaudio-432hz-583149.mp3');
const localNadiShodhanaAudio = require('../../assets/music/bodhisounds-root-chakra-muladhara-meditation-sounds-367680.mp3');
const localBhramariAudio = require('../../assets/music/siarhei_korbut-528hz-396hz-meditation-loop-572856.mp3');
const localDirghaAudio = require('../../assets/music/174hz.mp3');
const localKrishnaAudio = require('../../assets/music/warmth-binaural-6-hz-547418.mp3');
const localEmergencyAudio = require('../../assets/music/meditation-396-hz-390068.mp3');

export interface MeditationTune {
  id: string;
  name: string;
  description: string;
  frequency: string;
  uri: any;
  techniqueId?: string;
}

export const MEDITATION_TUNES: MeditationTune[] = [
  {
    id: 'dirgha-174hz',
    name: '174 Hz Natural Relief & Tension Release',
    description: 'Deep visceral diaphragmatic grounding for Dirgha Pranayama',
    frequency: '174 Hz',
    uri: localDirghaAudio,
    techniqueId: 'dirgha-pranayama',
  },
  {
    id: 'krishna-theta-6hz',
    name: '6 Hz Theta Wave Divine Contemplation',
    description: 'Binaural theta state for Gita 6.26 Dhyana & detachment (Vairagya)',
    frequency: 'Theta 6 Hz',
    uri: localKrishnaAudio,
    techniqueId: 'krishna-centered',
  },
  {
    id: 'emergency-396hz',
    name: '396 Hz Emergency Urge Reset & Liberation',
    description: 'Grounding frequency for SOS craving de-escalation & dopamine calm',
    frequency: '396 Hz',
    uri: localEmergencyAudio,
    techniqueId: 'emergency-sos',
  },
  {
    id: 'bhramari-396hz',
    name: '396 Hz & 528 Hz Solfeggio Resonance',
    description: 'Grounding frequency for Bhramari (Humming Bee Breath) & stress release',
    frequency: '396 / 528 Hz',
    uri: localBhramariAudio,
    techniqueId: 'bhramari',
  },
  {
    id: 'nadi-shodhana-root',
    name: 'Root Chakra Muladhara Resonance',
    description: 'Deep grounding resonance for Nadi Shodhana channel purification',
    frequency: 'Root Chakra',
    uri: localNadiShodhanaAudio,
    techniqueId: 'nadi-shodhana',
  },
  {
    id: 'om-432hz',
    name: '432 Hz Sacred Vibration',
    description: 'Deep cosmic 432 Hz resonance for Ajapa Japa Mantra meditation',
    frequency: '432 Hz',
    uri: localAjapaJapaAudio,
    techniqueId: 'ajapa-japa',
  },
  {
    id: 'tibetan-singing-bowl',
    name: 'Tibetan Singing Bowl Drone',
    description: 'Harmonic singing bowl resonance for deep stillness',
    frequency: '528 Hz',
    uri: 'https://assets.mixkit.co/active_storage/sfx/2873/2873-preview.mp3',
  },
  {
    id: 'vedic-tanpura-bell',
    name: 'Vedic Tanpura & Temple Resonance',
    description: 'Traditional continuous Indian meditation drone',
    frequency: 'Vedic Drone',
    uri: 'https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3',
  },
];

export class OmSoundManager {
  private static instance: OmSoundManager | null = null;
  private audioPlayer: any = null;
  private webAudio: any = null;
  private isPlaying: boolean = false;
  private isMuted: boolean = false;
  private currentTune: MeditationTune = MEDITATION_TUNES[0];

  static getInstance(): OmSoundManager {
    if (!OmSoundManager.instance) {
      OmSoundManager.instance = new OmSoundManager();
    }
    return OmSoundManager.instance;
  }

  getCurrentTune(): MeditationTune {
    return this.currentTune;
  }

  getAvailableTunes(): MeditationTune[] {
    return MEDITATION_TUNES;
  }

  getTuneForTechnique(techniqueId?: string): MeditationTune {
    if (techniqueId === 'dirgha-pranayama') {
      return MEDITATION_TUNES[0]; // 174 Hz
    }
    if (techniqueId === 'krishna-centered' || techniqueId === 'krishna-meditation') {
      return MEDITATION_TUNES[1]; // Theta 6 Hz
    }
    if (techniqueId === 'emergency-sos' || techniqueId === 'emergency' || techniqueId === 'box_breathing') {
      return MEDITATION_TUNES[2]; // 396 Hz Emergency
    }
    if (techniqueId === 'bhramari') {
      return MEDITATION_TUNES[3]; // 396 / 528 Hz
    }
    if (techniqueId === 'nadi-shodhana') {
      return MEDITATION_TUNES[4]; // Root Chakra
    }
    if (techniqueId === 'ajapa-japa') {
      return MEDITATION_TUNES[5]; // 432 Hz
    }
    const found = MEDITATION_TUNES.find((t) => t.techniqueId === techniqueId);
    return found || MEDITATION_TUNES[5];
  }

  async setTune(tuneOrUri: MeditationTune | string): Promise<void> {
    const wasPlaying = this.isPlaying;
    await this.stopAndUnload();

    if (typeof tuneOrUri === 'string') {
      const found = MEDITATION_TUNES.find((t) => t.id === tuneOrUri || (typeof t.uri === 'string' && t.uri === tuneOrUri));
      if (found) {
        this.currentTune = found;
      } else {
        this.currentTune = {
          id: 'custom',
          name: 'Custom Sound Tune',
          description: 'Custom audio stream',
          frequency: 'Custom',
          uri: tuneOrUri,
        };
      }
    } else {
      this.currentTune = tuneOrUri;
    }

    if (wasPlaying) {
      await this.play();
    }
  }

  async play(): Promise<void> {
    if (this.isPlaying) return;
    this.isPlaying = true;

    try {
      if (Platform.OS === 'web') {
        if (typeof window !== 'undefined' && window.Audio) {
          if (!this.webAudio) {
            const webSrc = typeof this.currentTune.uri === 'string' ? this.currentTune.uri : this.currentTune.uri?.default || this.currentTune.uri;
            this.webAudio = new window.Audio(webSrc);
            this.webAudio.loop = true;
            this.webAudio.onended = () => {
              if (this.isPlaying && this.webAudio) {
                this.webAudio.currentTime = 0;
                this.webAudio.play().catch(() => {});
              }
            };
          }
          this.webAudio.volume = this.isMuted ? 0 : 0.85;
          await this.webAudio.play().catch(() => { });
        }
        return;
      }

      // Native iOS & Android using expo-audio
      try {
        const { createAudioPlayer, setAudioModeAsync } = require('expo-audio');
        await setAudioModeAsync({
          playsInSilentMode: true,
          shouldPlayInBackground: true,
        }).catch(() => { });

        if (!this.audioPlayer) {
          this.audioPlayer = createAudioPlayer(this.currentTune.uri);
          this.audioPlayer.loop = true;
          
          if (typeof this.audioPlayer.addListener === 'function') {
            this.audioPlayer.addListener('playbackStatusUpdate', (status: any) => {
              if (status?.didJustFinish && this.isPlaying) {
                try {
                  if (typeof this.audioPlayer.seekTo === 'function') {
                    this.audioPlayer.seekTo(0);
                  }
                  this.audioPlayer.play();
                } catch (_) {}
              }
            });
          }
        }

        this.audioPlayer.volume = this.isMuted ? 0 : 0.85;
        this.audioPlayer.play();
      } catch (nativeErr) {
        console.log('[OmSoundManager Native Player Info]:', nativeErr);
      }
    } catch (err) {
      console.log('[OmSoundManager Play Error]:', err);
    }
  }

  async pause(): Promise<void> {
    this.isPlaying = false;
    try {
      if (Platform.OS === 'web' && this.webAudio) {
        this.webAudio.pause();
      }
      if (this.audioPlayer) {
        this.audioPlayer.pause();
      }
    } catch (_) { }
  }

  getIsMuted(): boolean {
    return this.isMuted;
  }

  toggleMute(): boolean {
    this.isMuted = !this.isMuted;
    this.setMuted(this.isMuted);
    return this.isMuted;
  }

  getIsPlaying(): boolean {
    return this.isPlaying;
  }

  async setMuted(muted: boolean): Promise<void> {
    this.isMuted = muted;
    try {
      if (Platform.OS === 'web' && this.webAudio) {
        this.webAudio.volume = muted ? 0 : 0.85;
      }
      if (this.audioPlayer) {
        this.audioPlayer.volume = muted ? 0 : 0.85;
      }
    } catch (_) { }
  }

  async stopAndUnload(): Promise<void> {
    this.isPlaying = false;
    try {
      if (Platform.OS === 'web' && this.webAudio) {
        this.webAudio.pause();
        this.webAudio.currentTime = 0;
        this.webAudio = null;
      }
      if (this.audioPlayer) {
        this.audioPlayer.pause();
        if (typeof this.audioPlayer.release === 'function') {
          this.audioPlayer.release();
        }
        this.audioPlayer = null;
      }
    } catch (_) { }
  }
}

export const omSoundManager = OmSoundManager.getInstance();
