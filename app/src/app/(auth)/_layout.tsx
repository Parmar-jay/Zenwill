import { Stack } from 'expo-router';

export default function AuthLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="welcome" />
      <Stack.Screen name="login" />
      <Stack.Screen name="register" />
      <Stack.Screen name="forgot-password" />
      <Stack.Screen name="verify-email" />
      <Stack.Screen name="create-profile" />
      <Stack.Screen name="assessment" />
      <Stack.Screen name="onboarding-purpose" />
      <Stack.Screen name="onboarding-triggers" />
      <Stack.Screen name="onboarding-permissions" />
      <Stack.Screen name="onboarding-complete" />
    </Stack>
  );
}
