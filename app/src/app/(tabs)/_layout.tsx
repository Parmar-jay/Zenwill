import React from 'react';
import { Tabs, useRouter } from 'expo-router';
import { StyleSheet, View, TouchableOpacity, useWindowDimensions, Platform } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Path } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';

// Haptic helper
const triggerHaptic = () => {
  try {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  } catch (e) {
    // Silent catch
  }
};

const ShieldLightningIcon = ({ focused }: { focused: boolean }) => (
  <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
    <Path
      d="M12 22C17.5 20.5 21 16.5 21 10.5V5.5L12 2.5L3 5.5V10.5C3 16.5 6.5 20.5 12 22Z"
      stroke={focused ? '#FF4D4D' : '#8F94A3'}
      strokeWidth={2}
      fill={focused ? 'rgba(255, 77, 77, 0.2)' : 'transparent'}
      strokeLinejoin="round"
    />
    <Path d="M13 6L8 13H12V18L17 11H13V6Z" fill={focused ? '#FF4D4D' : '#8F94A3'} />
  </Svg>
);

function CustomTabBar({ state, descriptors, navigation }: any) {
  const router = useRouter();
  const { width: W } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const currentRoute = state.routes[state.index];
  if (currentRoute?.name !== 'home') {
    return null;
  }

  // Height of tab bar container
  const tabHeight = Math.max(64, 60 + insets.bottom);
  const svgHeight = tabHeight + 24;
  const centerX = W / 2;

  return (
    <View style={[styles.tabBarContainer, { height: tabHeight }]}>
      <View style={[StyleSheet.absoluteFill, { top: -24, height: svgHeight }]}>
        <Svg width={W} height={svgHeight} viewBox={`0 0 ${W} ${svgHeight}`} fill="none">
          {/* Main Smooth Background Fill */}
          <Path
            d={`M 0 24 L ${centerX - 46} 24 C ${centerX - 30} 24, ${centerX - 24} 2, ${centerX} 2 C ${centerX + 24} 2, ${centerX + 30} 24, ${centerX + 46} 24 L ${W} 24 L ${W} ${svgHeight} L 0 ${svgHeight} Z`}
            fill="#000000"
          />
          {/* Glowing Top Boundary Border */}
          <Path
            d={`M 0 24 L ${centerX - 46} 24 C ${centerX - 30} 24, ${centerX - 24} 2, ${centerX} 2 C ${centerX + 24} 2, ${centerX + 30} 24, ${centerX + 46} 24 L ${W} 24`}
            stroke="rgba(255, 255, 255, 0.08)"
            strokeWidth={1.5}
            fill="none"
          />
        </Svg>
      </View>

      {/* Buttons Overlay */}
      <View style={[styles.buttonsContainer, { height: 60, paddingBottom: insets.bottom > 0 ? insets.bottom - 4 : 0 }]} className="flex-row items-center w-full">
        {state.routes.map((route: any, index: number) => {
          const { options } = descriptors[route.key];
          const isFocused = state.index === index;

          const onPress = () => {
            if (route.name === 'progress') {
              triggerHaptic();
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
            triggerHaptic();
          };

          if (route.name === 'emergency') {
            return (
              <View key={route.key} style={styles.centerTabWrapper} className="flex-1 items-center justify-center h-full">
                <TouchableOpacity
                  onPress={onPress}
                  style={styles.centerButtonOuter}
                  className="-top-4.5 w-15 h-15 rounded-full bg-[#000000] justify-center items-center shadow-lg"
                  activeOpacity={0.85}
                >
                  <View style={[styles.centerButtonInner, isFocused && styles.centerButtonActive]} className="w-13 h-13 rounded-full bg-[#080808] border border-white/10 justify-center items-center pt-0.5">
                    <ShieldLightningIcon focused={isFocused} />
                    <ThemedText
                      style={[styles.centerButtonLabel, isFocused && styles.centerButtonLabelActive]}
                      className="text-[8px] font-extrabold text-[#8F94A3] uppercase mt-0.5 tracking-wider"
                      numberOfLines={1}
                      maxFontSizeMultiplier={1.05}
                    >
                      RESCUE
                    </ThemedText>
                  </View>
                </TouchableOpacity>
              </View>
            );
          }

          // Regular tabs
          let iconName: any = 'home-outline';
          let label = '';

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

          return (
            <TouchableOpacity
              key={route.key}
              onPress={onPress}
              style={styles.tabButton}
              className="flex-1 h-full justify-center items-center pt-2"
              activeOpacity={0.7}
            >
              <Ionicons
                name={iconName}
                size={21}
                color={isFocused ? '#2B6BFF' : '#8F94A3'}
              />
              <ThemedText
                style={[styles.tabLabel, isFocused && styles.tabLabelActive]}
                className="text-[10px] font-semibold text-[#8F94A3] mt-1"
                numberOfLines={1}
                maxFontSizeMultiplier={1.1}
              >
                {label}
              </ThemedText>
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
        headerStyle: {
          backgroundColor: '#000000',
        },
        headerTintColor: '#ffffff',
        headerShadowVisible: false,
        headerShown: true,
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
    backgroundColor: 'transparent',
    borderWidth: 0,
    elevation: 10,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
  },
  buttonsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
  },
  tabButton: {
    flex: 1,
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 8,
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: '#8F94A3',
    marginTop: 4,
  },
  tabLabelActive: {
    color: '#2B6BFF',
    fontWeight: '700',
  },
  centerTabWrapper: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
  },
  centerButtonOuter: {
    top: -18,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#050608',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#FF4D4D',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 5,
  },
  centerButtonInner: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#0E1017',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 2,
  },
  centerButtonActive: {
    borderColor: '#FF4D4D',
    backgroundColor: '#160B0E',
    shadowColor: '#FF4D4D',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 8,
    elevation: 4,
  },
  centerButtonLabel: {
    fontSize: 8,
    fontWeight: '800',
    color: '#8F94A3',
    textTransform: 'uppercase',
    marginTop: 1,
    letterSpacing: 0.5,
  },
  centerButtonLabelActive: {
    color: '#FF4D4D',
  },
});
