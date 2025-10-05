//_layout.tsx
import React from 'react';
import { Tabs } from 'expo-router';
import { Map, Accessibility as AccessibilityIcon } from 'lucide-react-native';
import { Appearance } from 'react-native';

export default function TabLayout() {
  const colorScheme = Appearance.getColorScheme();
  const darkMode = colorScheme === 'dark';
  const activeColor = darkMode ? '#60A5FA' : '#2563EB';
  const inactiveColor = darkMode ? '#9CA3AF' : '#6B7280';

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: activeColor,
        tabBarInactiveTintColor: inactiveColor,
        tabBarStyle: {
          backgroundColor: darkMode ? '#111827' : '#F9FAFB',
          borderTopColor: darkMode ? '#374151' : '#E5E7EB',
        },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Plan Trip',
          tabBarIcon: ({ color }) => <Map color={color} />,
        }}
      />
      <Tabs.Screen
        name="accessibility"
        options={{
          title: 'Accessibility',
          tabBarIcon: ({ color }) => <AccessibilityIcon color={color} />,
        }}
      />
      
    </Tabs>
  );
}
