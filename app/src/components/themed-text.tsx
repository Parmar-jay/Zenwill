import { Platform, StyleSheet, Text, type TextProps, TextStyle } from 'react-native';

import { Typography, ThemeColor } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type ThemedTextProps = TextProps & {
  type?: 'default' | 'title' | 'small' | 'smallBold' | 'subtitle' | 'link' | 'linkPrimary' | 'code';
  fontFamily?: 'display' | 'body';
  themeColor?: ThemeColor;
};

export function ThemedText({ style, type = 'default', fontFamily, themeColor, ...rest }: ThemedTextProps) {
  const theme = useTheme();

  const flattened = StyleSheet.flatten(style) || {};
  const weight = (flattened as TextStyle)?.fontWeight;
  const weightStr = weight ? String(weight) : '';
  const isBold =
    weightStr === '600' ||
    weightStr === '700' ||
    weightStr === '800' ||
    weightStr === '900' ||
    weightStr === 'bold' ||
    weightStr === 'semibold';
  const isMedium = weightStr === '500' || weightStr === 'medium';

  const isDisplay =
    fontFamily === 'display' ||
    type === 'title' ||
    type === 'subtitle' ||
    type === 'smallBold' ||
    type === 'linkPrimary' ||
    isBold;

  let chosenFont = flattened.fontFamily;
  if (!chosenFont) {
    if (isDisplay) {
      if (isMedium) chosenFont = Typography.display.medium;
      else if (weightStr === '600' || weightStr === 'semibold') chosenFont = Typography.display.semiBold;
      else chosenFont = Typography.display.bold;
    } else if (isMedium) {
      chosenFont = Typography.body.medium;
    } else if (isBold) {
      chosenFont = Typography.body.bold;
    } else {
      chosenFont = Typography.body.regular;
    }
  }

  const finalStyle: TextStyle = {
    color: theme[themeColor ?? 'text'],
    ...(type === 'default' ? styles.default : {}),
    ...(type === 'title' ? styles.title : {}),
    ...(type === 'small' ? styles.small : {}),
    ...(type === 'smallBold' ? styles.smallBold : {}),
    ...(type === 'subtitle' ? styles.subtitle : {}),
    ...(type === 'link' ? styles.link : {}),
    ...(type === 'linkPrimary' ? styles.linkPrimary : {}),
    ...(type === 'code' ? styles.code : {}),
    ...flattened,
    fontFamily: Platform.select({
      web: isDisplay
        ? "'Space Grotesk', SpaceGrotesk_700Bold, system-ui, sans-serif"
        : "'DM Sans', DMSans_400Regular, system-ui, sans-serif",
      default: chosenFont,
    }),
  };

  if (Platform.OS !== 'web' && chosenFont && chosenFont.includes('_')) {
    delete finalStyle.fontWeight;
  }

  return <Text style={finalStyle} {...rest} />;
}

const styles = StyleSheet.create({
  small: {
    fontSize: 14,
    lineHeight: 20,
  },
  smallBold: {
    fontSize: 14,
    lineHeight: 20,
  },
  default: {
    fontSize: 16,
    lineHeight: 24,
  },
  title: {
    fontSize: 48,
    lineHeight: 52,
  },
  subtitle: {
    fontSize: 32,
    lineHeight: 44,
  },
  link: {
    lineHeight: 30,
    fontSize: 14,
  },
  linkPrimary: {
    lineHeight: 30,
    fontSize: 14,
    color: '#3c87f7',
  },
  code: {
    fontSize: 12,
  },
});
