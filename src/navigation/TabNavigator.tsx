import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

import { TabBarIcon } from '@components/animated/TabBarIcon';

import { MapStack } from '@/navigation/MapStack';
import { GalleryStack } from '@/navigation/GalleryStack';
import { CollectionStack } from '@/navigation/CollectionStack';
import { SettingsScreen } from '@screens/SettingsScreen';
import { colors } from '@theme/colors';
import type { MainTabParamList } from '@/navigation/types';

const Tab = createBottomTabNavigator<MainTabParamList>();

export function TabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary[500],
      }}
    >
      <Tab.Screen
        name="MapTab"
        component={MapStack}
        options={{
          title: '地図',
          tabBarIcon: ({ color, focused }) => (
            <TabBarIcon
              name="explore"
              routeName="MapTab"
              motion="spin"
              color={color}
              focused={focused}
            />
          ),
        }}
      />
      <Tab.Screen
        name="GalleryTab"
        component={GalleryStack}
        options={{
          title: '御朱印帳',
          tabBarIcon: ({ color, focused }) => (
            <TabBarIcon
              name="menu-book"
              routeName="GalleryTab"
              motion="open-book"
              color={color}
              focused={focused}
            />
          ),
        }}
      />
      <Tab.Screen
        name="CollectionTab"
        component={CollectionStack}
        options={{
          title: 'あゆみ',
          headerShown: false,
          tabBarIcon: ({ color, focused }) => (
            <TabBarIcon
              name="timeline"
              routeName="CollectionTab"
              motion="draw"
              color={color}
              focused={focused}
            />
          ),
        }}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{
          title: '設定',
          tabBarIcon: ({ color, focused }) => (
            <TabBarIcon
              name="settings"
              routeName="Settings"
              motion="gear"
              color={color}
              focused={focused}
            />
          ),
        }}
      />
    </Tab.Navigator>
  );
}
