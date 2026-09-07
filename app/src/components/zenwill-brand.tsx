import React from 'react';
import { Text, TextStyle, StyleProp, StyleSheet } from 'react-native';

export interface ZenWillBrandProps {
  style?: StyleProp<TextStyle>;
  zenStyle?: StyleProp<TextStyle>;
  willStyle?: StyleProp<TextStyle>;
  /**
   * Set to true if displayed on a light background (e.g. white card, light button)
   * where 'Zen' should be solid black #000000. Defaults to false (white on dark).
   */
  lightBg?: boolean;
  suffix?: string;
}

export function ZenWillBrand({
  style,
  zenStyle,
  willStyle,
  lightBg = false,
  suffix,
}: ZenWillBrandProps) {
  const zenColor = lightBg ? '#000000' : '#FFFFFF';
  const willColor = '#00E5FF';

  return (
    <Text style={[styles.base, style]}>
      <Text style={[{ color: zenColor }, zenStyle]}>Zen</Text>
      <Text style={[{ color: willColor }, willStyle]}>Will</Text>
      {suffix ? <Text style={style}>{suffix}</Text> : null}
    </Text>
  );
}

/**
 * Automatically parses text and styles occurrences of 'ZenWill'
 * with 'Zen' (White on dark / Black on light) and 'Will' (Cyan Blue #00E5FF).
 */
export function renderWithZenWill(
  text: string,
  baseStyle?: StyleProp<TextStyle>,
  lightBg: boolean = false
) {
  if (!text || !text.toLowerCase().includes('zenwill')) {
    return text;
  }

  const parts = text.split(/(zenwill)/gi);
  const zenColor = lightBg ? '#000000' : '#FFFFFF';
  const willColor = '#00E5FF';

  return parts.map((part, index) => {
    if (part.toLowerCase() === 'zenwill') {
      return (
        <Text key={index}>
          <Text style={{ color: zenColor, fontWeight: '800' }}>Zen</Text>
          <Text style={{ color: willColor, fontWeight: '800' }}>Will</Text>
        </Text>
      );
    }
    return part;
  });
}

const styles = StyleSheet.create({
  base: {
    fontWeight: '800',
  },
});
