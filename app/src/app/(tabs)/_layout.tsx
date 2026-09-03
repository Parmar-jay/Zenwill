import React from 'react';
import { Tabs, useRouter } from 'expo-router';
import { StyleSheet, View, TouchableOpacity, useWindowDimensions, Platform } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Path } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useUnreadStore } from '@/store/unread-store';

// Non-blocking Haptic helper
const triggerHaptic = () => {
  if (Platform.OS === 'web') return;
  setTimeout(() => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (e) {}
  }, 0);
};

const ShieldLightningIcon = ({ focused }: { focused: boolean }) => (
  <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
    <Path
      d="M12 22C17.5 20.5 21 16.5 21 10.5V5.5L12 2.5L3 5.5V10.5C3 16.5 6.5 20.5 12 22Z"
      stroke="#EF4444"
      strokeWidth={2}
      fill={focused ? 'rgba(239, 68, 68, 0.25)' : 'transparent'}
      strokeLinejoin="round"
    />
    <Path d="M13 6L8 13H12V18L17 11H13V6Z" fill="#EF4444" />
  </Svg>
);

function CustomTabBar({ state, descriptors, navigation }: any) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const unreadCount = useUnreadStore((s) => s.unreadCount);

  const currentRoute = state.routes[state.index];
  if (currentRoute?.name !== 'home') {
    return null;
  }

  const bottomPadding = Math.max(insets.bottom, 6);
  const contentHeight = 56;
  const tabHeight = contentHeight + bottomPadding;

  return (
    <View style={[styles.tabBarContainer, { height: tabHeight, paddingBottom: bottomPadding }]}>
      <View style={styles.buttonsContainer}>
        {state.routes.map((route: any, index: number) => {
          const isFocused = state.index === index;

          const onPress = () => {
            triggerHaptic();

            if (route.name === 'progress') {
              router.push('/community' as any);
              return;
            }

            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });

            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name);
            }
          };

          // Render appropriate icon and label
          if (route.name === 'emergency') {
            return (
              <TouchableOpacity
                key={route.key}
                onPress={onPress}
                style={styles.tabButton}
                activeOpacity={0.7}
              >
                <ShieldLightningIcon focused={isFocused} />
                <ThemedText
                  style={[styles.tabLabel, { color: '#EF4444' }, isFocused && styles.tabLabelActiveRescue]}
                  numberOfLines={1}
                  maxFontSizeMultiplier={1.05}
                >
                  Rescue
                </ThemedText>
                {isFocused && <View style={[styles.activeIndicator, { backgroundColor: '#EF4444' }]} />}
              </TouchableOpacity>
            );
          }

          let iconName: any = 'home-outline';
          let label = 'Home';

          if (route.name === 'home') {
            iconName = isFocused ? 'home' : 'home-outline';
            label = 'Home';
          } else if (route.name === 'chat' || route.name === 'coach') {
            iconName = isFocused ? 'chatbubble-ellipses' : 'chatbubble-ellipses-outline';
            label = 'Coach';
          } else if (route.name === 'progress') {
            iconName = isFocused ? 'people' : 'people-outline';
            label = 'Community';
          } else if (route.name === 'profile') {
            iconName = isFocused ? 'person' : 'person-outline';
            label = 'Profile';
          }

          const isCommunityRoute = route.name === 'progress';
          return (
            <TouchableOpacity
              key={route.key}
              onPress={onPress}
              style={styles.tabButton}
              activeOpacity={0.7}
            >
              <View style={{ position: 'relative' }}>
                <Ionicons
                  name={iconName}
                  size={20}
                  color={isFocused ? '#00E5FF' : '#8F94A3'}
                />
                {isCommunityRoute && unreadCount > 0 && (
                  <View style={styles.unreadTabBadgeDot} />
                )}
              </View>
              <ThemedText
                style={[styles.tabLabel, isFocused && styles.tabLabelActive]}
                numberOfLines={1}
                maxFontSizeMultiplier={1.05}
              >
                {label}
              </ThemedText>
              {isFocused && <View style={styles.activeIndicator} />}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{
        sceneStyle: { backgroundColor: '#000000' },
        headerStyle: {
          backgroundColor: '#000000',
        },
        headerTintColor: '#ffffff',
        headerShadowVisible: false,
        headerShown: true,
        lazy: true,
        freezeOnBlur: true,
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: 'Home',
          headerShown: false,
        }}
      />
      <Tabs.Screen
        name="chat"
        options={{
          title: 'Coach',
          headerShown: false,
        }}
      />
      <Tabs.Screen
        name="emergency"
        options={{
          title: 'Emergency',
          headerShown: false,
        }}
      />
      <Tabs.Screen
        name="progress"
        options={{
          title: 'Community',
          headerShown: false,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          headerShown: false,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBarContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#000000',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
    justifyContent: 'center',
  },
  buttonsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-evenly',
    width: '100%',
    height: 56,
  },
  tabButton: {
    flex: 1,
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'stretch',
    position: 'relative',
    paddingTop: 8,
    paddingBottom: 4,
  },
  tabLabel: {
    fontSize: 10.5,
    fontWeight: '600',
    color: '#8F94A3',
    marginTop: 3,
    letterSpacing: 0.1,
    textAlign: 'center',
  },
  tabLabelActive: {
    color: '#00E5FF',
    fontWeight: '700',
  },
  tabLabelActiveRescue: {
    color: '#EF4444',
    fontWeight: '700',
  },
  activeIndicator: {
    position: 'absolute',
    bottom: 1,
    alignSelf: 'center',
    width: 22,
    height: 2.5,
    borderRadius: 2,
    backgroundColor: '#00E5FF',
  },
  unreadTabBadgeDot: {
    position: 'absolute',
    top: -2,
    right: -4,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#EF4444',
    borderWidth: 1.5,
    borderColor: '#05070E',
  },
});
