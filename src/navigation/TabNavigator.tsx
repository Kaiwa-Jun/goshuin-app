import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { MaterialIcons } from '@expo/vector-icons';

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
          tabBarIcon: ({ color }) => <MaterialIcons name="explore" size={24} color={color} />,
        }}
      />
      <Tab.Screen
        name="GalleryTab"
        component={GalleryStack}
        options={{
          title: '御朱印帳',
          tabBarIcon: ({ color }) => <MaterialIcons name="menu-book" size={24} color={color} />,
        }}
      />
      <Tab.Screen
        name="CollectionTab"
        component={CollectionStack}
        options={{
          title: 'あつめる',
          headerShown: false,
          tabBarIcon: ({ color }) => <MaterialIcons name="emoji-events" size={24} color={color} />,
        }}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{
          title: '自分',
          tabBarIcon: ({ color }) => <MaterialIcons name="person" size={24} color={color} />,
        }}
      />
    </Tab.Navigator>
  );
}
