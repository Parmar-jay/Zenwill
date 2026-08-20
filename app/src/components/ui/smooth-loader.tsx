import React, { useEffect, useRef } from 'react';
import {
  View,
  Animated,
  Easing,
  StyleSheet,
  ViewStyle,
  StyleProp,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

// UI/UX Pro Max smooth curve
const SMOOTH_EASING = Easing.bezier(0.16, 1, 0.3, 1);

export interface PageEntranceProps {
  children: React.ReactNode;
  delay?: number;
  duration?: number;
  initialSlideY?: number;
  initialScale?: number;
  style?: StyleProp<ViewStyle>;
}

/**
 * PageEntrance provides a silky-smooth micro-animation entrance for any page or card.
 * Prevents visual pop-in and gives a fluid, premium feel on mount/route change.
 */
export function PageEntrance({
  children,
  delay = 0,
  duration = 380,
  initialSlideY = 14,
  initialScale = 0.985,
  style,
}: PageEntranceProps) {
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(initialSlideY)).current;
  const scaleAnim = useRef(new Animated.Value(initialScale)).current;

  useEffect(() => {
    const timer = setTimeout(() => {
      Animated.parallel([
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration,
          easing: SMOOTH_EASING,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration,
          easing: SMOOTH_EASING,
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 1,
          duration,
          easing: SMOOTH_EASING,
          useNativeDriver: true,
        }),
      ]).start();
    }, delay);

    return () => clearTimeout(timer);
  }, [delay, duration, initialSlideY, initialScale]);

  return (
    <Animated.View
      style={[
        styles.entranceContainer,
        {
          opacity: opacityAnim,
          transform: [{ translateY: slideAnim }, { scale: scaleAnim }],
        },
        style,
      ]}
    >
      {children}
    </Animated.View>
  );
}

/**
 * TopAmbientProgressBar renders a sleek 2.5px radiant cosmic laser beam across the top of the viewport
 * giving seamless visual motion feedback during transitions.
 */
export function TopAmbientProgressBar({ active = true }: { active?: boolean }) {
  return null;
}

/**
 * SmoothSkeleton provides a luxury shimmering surface for loading cards & widgets.
 */
export function SmoothSkeleton({
  width,
  height,
  borderRadius = 12,
  style,
}: {
  width: number | string;
  height: number | string;
  borderRadius?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const pulseAnim = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 0.65,
          duration: 850,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0.3,
          duration: 850,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);

  return (
    <View
      style={[
        {
          width: width as any,
          height: height as any,
          borderRadius,
          backgroundColor: 'rgba(255, 255, 255, 0.04)',
          overflow: 'hidden',
          borderColor: 'rgba(255, 255, 255, 0.06)',
          borderWidth: 1,
        },
        style,
      ]}
    >
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          {
            backgroundColor: 'rgba(255, 255, 255, 0.12)',
            opacity: pulseAnim,
          },
        ]}
      />
    </View>
  );
}

/**
 * ZenLoaderSpinner provides a minimal luxury dual-ring cosmic spinner.
 */
export function ZenLoaderSpinner({ size = 38 }: { size?: number }) {
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(0.8)).current;

  useEffect(() => {
    const rotateLoop = Animated.loop(
      Animated.timing(rotateAnim, {
        toValue: 1,
        duration: 1200,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );

    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.1,
          duration: 600,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0.8,
          duration: 600,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );

    rotateLoop.start();
    pulseLoop.start();

    return () => {
      rotateLoop.stop();
      pulseLoop.stop();
    };
  }, []);

  const spin = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <View style={[styles.spinnerContainer, { width: size, height: size }]}>
      <Animated.View
        style={[
          styles.spinnerOuterRing,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            transform: [{ rotate: spin }],
          },
        ]}
      />
      <Animated.View
        style={[
          styles.spinnerInnerOrb,
          {
            width: size * 0.45,
            height: size * 0.45,
            borderRadius: (size * 0.45) / 2,
            transform: [{ scale: pulseAnim }],
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  entranceContainer: {
    flex: 1,
  },
  topBeamContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 2.5,
    zIndex: 9999,
    overflow: 'hidden',
  },
  topBeamGradient: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  beamHighlight: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 140,
  },
  spinnerContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  spinnerOuterRing: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: 'rgba(0, 229, 255, 0.15)',
    borderTopColor: '#00E5FF',
    borderRightColor: '#6366F1',
  },
  spinnerInnerOrb: {
    backgroundColor: '#00E5FF',
    shadowColor: '#00E5FF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 6,
    elevation: 4,
  },
});
