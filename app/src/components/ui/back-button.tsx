import React from 'react';
import { TouchableOpacity, StyleSheet, StyleProp, ViewStyle, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

interface BackButtonProps {
  onPress?: () => void;
  color?: string;
  size?: number;
  fallbackRoute?: string;
  style?: StyleProp<ViewStyle>;
}

export function BackButton({
  onPress,
  color = '#00E5FF',
  size = 24,
  fallbackRoute = '/(tabs)/home',
  style,
}: BackButtonProps) {
  const router = useRouter();

  const handlePress = () => {
    try {
      if (Platform.OS !== 'web') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    } catch (e) {}

    if (onPress) {
      onPress();
    } else {
      if (router.canGoBack()) {
        router.back();
      } else {
        router.navigate(fallbackRoute as any);
      }
    }
  };

  return (
    <TouchableOpacity
      style={[styles.backBtn, style]}
      activeOpacity={0.7}
      onPress={handlePress}
      hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
    >
      <Ionicons name="chevron-back" size={size} color={color} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  backBtn: {
    backgroundColor: 'transparent',
    padding: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
