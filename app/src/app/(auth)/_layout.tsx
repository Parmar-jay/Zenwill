import { Stack } from 'expo-router';

export default function AuthLayout() {
  return (
    <Stack screenOptions={{ headerShown: true }}>
      <Stack.Screen name="welcome" options={{ headerShown: false }} />
      <Stack.Screen name="login" options={{ title: 'Login' }} />
      <Stack.Screen name="register" options={{ title: 'Register' }} />
      <Stack.Screen name="forgot-password" options={{ title: 'Forgot Password' }} />
      <Stack.Screen name="verify-email" options={{ title: 'Verify Email' }} />
      <Stack.Screen name="create-profile" options={{ title: 'Create Profile' }} />
      <Stack.Screen name="assessment" options={{ title: 'Assessment' }} />
      <Stack.Screen name="onboarding-purpose" options={{ title: 'Purpose Onboarding' }} />
      <Stack.Screen name="onboarding-triggers" options={{ title: 'Triggers Onboarding' }} />
      <Stack.Screen name="onboarding-permissions" options={{ title: 'Permissions Onboarding' }} />
      <Stack.Screen name="onboarding-complete" options={{ title: 'Onboarding Complete', headerShown: false }} />
    </Stack>
  );
}
