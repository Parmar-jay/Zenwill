import React, { useMemo, useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, Easing, Dimensions } from 'react-native';
import Svg, { Circle, Defs, RadialGradient, Stop, G } from 'react-native-svg';
import { ThemedText } from './themed-text';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface ParticlePoint {
  id: number;
  cx: number;
  cy: number;
  r: number;
  opacity: number;
}

interface BreathingParticlesProps {
  phase?: string;
  title?: string;
  subtitle?: string;
  color?: string;
  isRunning?: boolean;
  size?: number;
  showText?: boolean;
}

export const BreathingParticles: React.FC<BreathingParticlesProps> = ({
  phase = 'Inhale',
  title,
  subtitle,
  color = '#00F5D4',
  isRunning = true,
  size = Math.min(SCREEN_WIDTH * 0.9, 340),
  showText = true,
}) => {
  const center = size / 2;
  const mainRadius = 96; // Pure circular particle core radius

  // Outward Emitter Animation Drivers (Creation at circle -> Smooth outward drift -> Dissolution)
  const wave1Anim = useRef(new Animated.Value(0)).current;
  const wave2Anim = useRef(new Animated.Value(0)).current;
  const wave3Anim = useRef(new Animated.Value(0)).current;
  const wave4Anim = useRef(new Animated.Value(0)).current;

  const ringSlowSpin = useRef(new Animated.Value(0)).current;
  const filamentSlowSpin = useRef(new Animated.Value(0)).current;
  const sunPulse = useRef(new Animated.Value(0.9)).current;

  // 1. Ultra-Dense Glowing Core Ring of Pure Particles (~460 sparkling micro-dots, NO hard vector lines)
  const coreRingDots: ParticlePoint[] = useMemo(() => {
    const list: ParticlePoint[] = [];
    const count = 480;

    for (let i = 0; i < count; i++) {
      const angle = (i / count) * 2 * Math.PI;
      const jitter = (((i * 23) % 15) - 7) * 0.25;
      const r = mainRadius + jitter;

      const px = center + r * Math.cos(angle);
      const py = center + r * Math.sin(angle);

      const seed = (i * 37) % 100;
      const dotRadius = seed > 85 ? 1.8 : seed > 40 ? 1.25 : 0.8;
      const opacity = 0.55 + (seed / 100) * 0.45;

      list.push({ id: i, cx: px, cy: py, r: dotRadius, opacity });
    }
    return list;
  }, [center, mainRadius]);

  // 2. Outward Stream 1: Tangent Clockwise Filaments (~240 particles)
  const wave1Dots: ParticlePoint[] = useMemo(() => {
    const list: ParticlePoint[] = [];
    const count = 260;

    for (let i = 0; i < count; i++) {
      const angle = (i / count) * 2 * Math.PI;
      const offset = (((i * 19) % 13) - 6) * 0.5;
      const r = mainRadius + 2 + offset;

      const px = center + r * Math.cos(angle);
      const py = center + r * Math.sin(angle);

      const seed = (i * 29) % 100;
      const dotRadius = seed > 80 ? 1.6 : 1.0;
      const opacity = 0.45 + (seed / 100) * 0.55;

      list.push({ id: i + 1000, cx: px, cy: py, r: dotRadius, opacity });
    }
    return list;
  }, [center, mainRadius]);

  // 3. Outward Stream 2: Swirling Spirograph Arc Strands (~240 particles)
  const wave2Dots: ParticlePoint[] = useMemo(() => {
    const list: ParticlePoint[] = [];
    const count = 260;

    for (let i = 0; i < count; i++) {
      const angle = (i / count) * 2 * Math.PI;
      const wave = Math.sin(angle * 8) * 4.5;
      const r = mainRadius + 4 + wave;

      const px = center + r * Math.cos(angle);
      const py = center + r * Math.sin(angle);

      const seed = (i * 47) % 100;
      const dotRadius = seed > 75 ? 1.7 : 0.95;
      const opacity = 0.4 + (seed / 100) * 0.55;

      list.push({ id: i + 2000, cx: px, cy: py, r: dotRadius, opacity });
    }
    return list;
  }, [center, mainRadius]);

  // 4. Outward Stream 3: Direct Radial Stardust Corona (~220 particles)
  const wave3Dots: ParticlePoint[] = useMemo(() => {
    const list: ParticlePoint[] = [];
    const count = 240;

    for (let i = 0; i < count; i++) {
      const angle = (i / count) * 2 * Math.PI + ((i * 13) % 30) / 100;
      const r = mainRadius + 6 + ((i * 7) % 14);

      const px = center + r * Math.cos(angle);
      const py = center + r * Math.sin(angle);

      const seed = (i * 53) % 100;
      const dotRadius = seed > 85 ? 2.0 : 1.15;
      const opacity = 0.35 + (seed / 100) * 0.6;

      list.push({ id: i + 3000, cx: px, cy: py, r: dotRadius, opacity });
    }
    return list;
  }, [center, mainRadius]);

  // 5. Outward Stream 4: Outer Soft Atmospheric Halo (~160 particles)
  const wave4Dots: ParticlePoint[] = useMemo(() => {
    const list: ParticlePoint[] = [];
    const count = 180;

    for (let i = 0; i < count; i++) {
      const angle = (i / count) * 2 * Math.PI + ((i * 17) % 40) / 100;
      const r = mainRadius + 10 + ((i * 11) % 16);

      const px = center + r * Math.cos(angle);
      const py = center + r * Math.sin(angle);

      const seed = (i * 61) % 100;
      const dotRadius = seed > 80 ? 1.8 : 1.0;
      const opacity = 0.3 + (seed / 100) * 0.5;

      list.push({ id: i + 4000, cx: px, cy: py, r: dotRadius, opacity });
    }
    return list;
  }, [center, mainRadius]);

  // Master Continuous Outward Emitter Loops (Staggered Infinite Flow)
  useEffect(() => {
    let anim1: Animated.CompositeAnimation;
    let anim2: Animated.CompositeAnimation;
    let anim3: Animated.CompositeAnimation;
    let anim4: Animated.CompositeAnimation;
    let animSpin1: Animated.CompositeAnimation;
    let animSpin2: Animated.CompositeAnimation;
    let animSun: Animated.CompositeAnimation;

    if (isRunning) {
      // Outward Wave 1 (3.4s continuous loop)
      anim1 = Animated.loop(
        Animated.timing(wave1Anim, {
          toValue: 1,
          duration: 3400,
          easing: Easing.bezier(0.25, 0.1, 0.25, 1),
          useNativeDriver: true,
        })
      );

      // Outward Wave 2 (4.0s continuous loop)
      anim2 = Animated.loop(
        Animated.timing(wave2Anim, {
          toValue: 1,
          duration: 4000,
          easing: Easing.bezier(0.25, 0.1, 0.25, 1),
          useNativeDriver: true,
        })
      );

      // Outward Wave 3 (4.6s continuous loop)
      anim3 = Animated.loop(
        Animated.timing(wave3Anim, {
          toValue: 1,
          duration: 4600,
          easing: Easing.bezier(0.25, 0.1, 0.25, 1),
          useNativeDriver: true,
        })
      );

      // Outward Wave 4 (5.2s continuous loop)
      anim4 = Animated.loop(
        Animated.timing(wave4Anim, {
          toValue: 1,
          duration: 5200,
          easing: Easing.bezier(0.25, 0.1, 0.25, 1),
          useNativeDriver: true,
        })
      );

      // Smooth continuous orbital drift
      animSpin1 = Animated.loop(
        Animated.timing(ringSlowSpin, {
          toValue: 1,
          duration: 36000,
          easing: Easing.linear,
          useNativeDriver: true,
        })
      );

      animSpin2 = Animated.loop(
        Animated.timing(filamentSlowSpin, {
          toValue: 1,
          duration: 28000,
          easing: Easing.linear,
          useNativeDriver: true,
        })
      );

      // Sun breathing pulse
      animSun = Animated.loop(
        Animated.sequence([
          Animated.timing(sunPulse, {
            toValue: 1.06,
            duration: 2600,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
          Animated.timing(sunPulse, {
            toValue: 0.88,
            duration: 2600,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
        ])
      );

      anim1.start();
      anim2.start();
      anim3.start();
      anim4.start();
      animSpin1.start();
      animSpin2.start();
      animSun.start();
    } else {
      wave1Anim.stopAnimation();
      wave2Anim.stopAnimation();
      wave3Anim.stopAnimation();
      wave4Anim.stopAnimation();
      ringSlowSpin.stopAnimation();
      filamentSlowSpin.stopAnimation();
      sunPulse.stopAnimation();
    }

    return () => {
      if (anim1) anim1.stop();
      if (anim2) anim2.stop();
      if (anim3) anim3.stop();
      if (anim4) anim4.stop();
      if (animSpin1) animSpin1.stop();
      if (animSpin2) animSpin2.stop();
      if (animSun) animSun.stop();
    };
  }, [isRunning]);

  // Wave 1: Creation at ring (scale 1.0) -> Radiates outward (scale 1.14) -> Disappears
  const scaleWave1 = wave1Anim.interpolate({
    inputRange: [0, 1],
    outputRange: [1.0, 1.14],
  });
  const opacityWave1 = wave1Anim.interpolate({
    inputRange: [0, 0.2, 0.7, 1],
    outputRange: [0, 0.95, 0.65, 0],
  });

  // Wave 2: Creation at ring (scale 0.98) -> Radiates outward (scale 1.20) -> Disappears
  const scaleWave2 = wave2Anim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.98, 1.20],
  });
  const opacityWave2 = wave2Anim.interpolate({
    inputRange: [0, 0.25, 0.65, 1],
    outputRange: [0, 0.88, 0.55, 0],
  });

  // Wave 3: Radial sparks traveling outward (scale 1.0 -> 1.26) -> Disappears
  const scaleWave3 = wave3Anim.interpolate({
    inputRange: [0, 1],
    outputRange: [1.0, 1.26],
  });
  const opacityWave3 = wave3Anim.interpolate({
    inputRange: [0, 0.18, 0.6, 1],
    outputRange: [0, 0.9, 0.45, 0],
  });

  // Wave 4: Outer halo expanding outward (scale 1.0 -> 1.30) -> Disappears
  const scaleWave4 = wave4Anim.interpolate({
    inputRange: [0, 1],
    outputRange: [1.0, 1.30],
  });
  const opacityWave4 = wave4Anim.interpolate({
    inputRange: [0, 0.2, 0.65, 1],
    outputRange: [0, 0.8, 0.4, 0],
  });

  const spinRing = ringSlowSpin.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const spinFilament = filamentSlowSpin.interpolate({
    inputRange: [0, 1],
    outputRange: ['360deg', '0deg'],
  });

  const getPhaseSubtitle = () => {
    switch (phase) {
      case 'Inhale':
        return 'Slow • Deep • Natural';
      case 'Hold':
        return 'Still • Calm • Centered';
      case 'Exhale':
        return 'Smooth • Gentle • Release';
      default:
        return 'Ready • Focused';
    }
  };

  return (
    <View style={styles.container}>
      {/* Visual Canvas */}
      <View style={[styles.canvasBox, { width: size, height: size }]}>
        {/* Layer 1: Central Glowing Sun Core (Fixed Center) */}
        <Animated.View
          style={[
            styles.absoluteLayer,
            { transform: [{ scale: sunPulse }] },
          ]}
        >
          <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
            <Defs>
              <RadialGradient id="pureGalaxySunGrad" cx="50%" cy="50%" r="50%">
                <Stop offset="0%" stopColor="#FFFFFF" stopOpacity="1.0" />
                <Stop offset="20%" stopColor="#A7F3D0" stopOpacity="0.95" />
                <Stop offset="45%" stopColor={color} stopOpacity="0.65" />
                <Stop offset="75%" stopColor={color} stopOpacity="0.18" />
                <Stop offset="100%" stopColor={color} stopOpacity="0.0" />
              </RadialGradient>
            </Defs>

            {/* Radiant Sun Glow Diffuser */}
            <Circle cx={center} cy={center} r={34} fill="url(#pureGalaxySunGrad)" />

            {/* Core Intense White Star Point */}
            <Circle cx={center} cy={center} r={5} fill="#FFFFFF" opacity={1.0} />
          </Svg>
        </Animated.View>

        {/* Layer 2: High-Density Pure Core Ring Sparks (NO hard vector lines) */}
        <Animated.View
          style={[
            styles.absoluteLayer,
            { transform: [{ rotate: spinRing }] },
          ]}
        >
          <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
            <G>
              {coreRingDots.map((p) => (
                <Circle
                  key={p.id}
                  cx={p.cx}
                  cy={p.cy}
                  r={p.r}
                  fill={color}
                  opacity={p.opacity}
                />
              ))}
            </G>
          </Svg>
        </Animated.View>

        {/* Layer 3: Outward Wave 1 (Created at ring -> Radiates slightly outside -> Disappears) */}
        <Animated.View
          style={[
            styles.absoluteLayer,
            {
              transform: [{ scale: scaleWave1 }, { rotate: spinRing }],
              opacity: opacityWave1,
            },
          ]}
        >
          <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
            <G>
              {wave1Dots.map((p) => (
                <Circle
                  key={p.id}
                  cx={p.cx}
                  cy={p.cy}
                  r={p.r}
                  fill={color}
                  opacity={p.opacity}
                />
              ))}
            </G>
          </Svg>
        </Animated.View>

        {/* Layer 4: Outward Wave 2: Swirling Tangent Arcs (Radiates outside -> Disappears) */}
        <Animated.View
          style={[
            styles.absoluteLayer,
            {
              transform: [{ scale: scaleWave2 }, { rotate: spinFilament }],
              opacity: opacityWave2,
            },
          ]}
        >
          <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
            <G>
              {wave2Dots.map((p) => (
                <Circle
                  key={p.id}
                  cx={p.cx}
                  cy={p.cy}
                  r={p.r}
                  fill={color}
                  opacity={p.opacity}
                />
              ))}
            </G>
          </Svg>
        </Animated.View>

        {/* Layer 5: Outward Wave 3: Direct Radial Stardust Corona (Radiates outside -> Disappears) */}
        <Animated.View
          style={[
            styles.absoluteLayer,
            {
              transform: [{ scale: scaleWave3 }],
              opacity: opacityWave3,
            },
          ]}
        >
          <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
            <G>
              {wave3Dots.map((p) => (
                <Circle
                  key={p.id}
                  cx={p.cx}
                  cy={p.cy}
                  r={p.r}
                  fill={color}
                  opacity={p.opacity}
                />
              ))}
            </G>
          </Svg>
        </Animated.View>

        {/* Layer 6: Outward Wave 4: Outer Soft Halo (Radiates outside -> Disappears) */}
        <Animated.View
          style={[
            styles.absoluteLayer,
            {
              transform: [{ scale: scaleWave4 }, { rotate: spinFilament }],
              opacity: opacityWave4,
            },
          ]}
        >
          <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
            <G>
              {wave4Dots.map((p) => (
                <Circle
                  key={p.id}
                  cx={p.cx}
                  cy={p.cy}
                  r={p.r}
                  fill={color}
                  opacity={p.opacity}
                />
              ))}
            </G>
          </Svg>
        </Animated.View>
      </View>

      {/* Phase Typography */}
      {showText && (
        <View style={styles.textContainer}>
          <ThemedText style={[styles.phaseTitle, { color }]}>
            {title || phase}
          </ThemedText>
          <ThemedText style={styles.phaseSubtitle}>
            {subtitle || getPhaseSubtitle()}
          </ThemedText>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 2,
  },
  canvasBox: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  absoluteLayer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
    marginBottom: 4,
    gap: 3,
  },
  phaseTitle: {
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: 2.2,
    textTransform: 'uppercase',
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.95)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
  },
  phaseSubtitle: {
    fontSize: 12.5,
    color: 'rgba(255, 255, 255, 0.72)',
    fontWeight: '600',
    letterSpacing: 0.6,
    textAlign: 'center',
  },
});
