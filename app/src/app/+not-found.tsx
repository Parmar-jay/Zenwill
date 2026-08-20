import { Link, Stack } from 'expo-router';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { LinearGradient } from 'expo-linear-gradient';
import { Spacing } from '@/constants/theme';

export default function NotFoundScreen() {
  return (
    <LinearGradient
      colors={['#000000', '#000000', '#000000']}
      style={styles.gradientBg}
    >
      <Stack.Screen options={{ 
        title: 'Oops!', 
        headerShown: true,
        headerStyle: { backgroundColor: '#000000' },
        headerTintColor: '#ffffff',
        headerShadowVisible: false,
      }} />
      <View style={styles.container}>
        <View style={styles.glassCard}>
          <ThemedText style={styles.cardTitle}>Screen Not Found</ThemedText>
          <ThemedText style={styles.cardSubtitle}>
            This routing point is not defined in the ecosystem. Please check your path configuration.
          </ThemedText>
          <Link href="/" asChild>
            <TouchableOpacity style={styles.btnPrimary}>
              <ThemedText style={styles.btnPrimaryText}>Return to Catalog</ThemedText>
            </TouchableOpacity>
          </Link>
        </View>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradientBg: {
    flex: 1,
  },
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.five,
  },
  glassCard: {
    backgroundColor: '#18191D',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    padding: Spacing.four,
    gap: Spacing.three,
    alignSelf: 'stretch',
  },
  cardTitle: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 20,
    textAlign: 'center',
  },
  cardSubtitle: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: Spacing.two,
  },
  btnPrimary: {
    backgroundColor: '#ffffff',
    borderRadius: 24,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnPrimaryText: {
    color: '#090A0D',
    fontWeight: '700',
    fontSize: 15,
  },
});
