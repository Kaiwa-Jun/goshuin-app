import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Text } from 'react-native';

import { MapStack } from '@/navigation/MapStack';
import { GalleryStack } from '@/navigation/GalleryStack';
import { CollectionScreen } from '@screens/CollectionScreen';
import { SettingsScreen } from '@screens/SettingsScreen';
import { useAuth } from '@hooks/useAuth';
import type { MainTabParamList, RootStackParamList } from '@/navigation/types';

const Tab = createBottomTabNavigator<MainTabParamList>();

type RootNavigation = NativeStackNavigationProp<RootStackParamList>;

export function TabNavigator() {
  const { isAuthenticated } = useAuth();
  const rootNavigation = useNavigation<RootNavigation>();

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#F97316',
      }}
    >
      <Tab.Screen
        name="MapTab"
        component={MapStack}
        options={{
          title: '地図',
          tabBarIcon: ({ color }) => <Text style={{ color }}>🗺</Text>,
        }}
      />
      <Tab.Screen
        name="GalleryTab"
        component={GalleryStack}
        options={{
          title: 'ギャラリー',
          tabBarIcon: ({ color }) => <Text style={{ color }}>📷</Text>,
        }}
        listeners={() => ({
          tabPress: e => {
            if (!isAuthenticated) {
              e.preventDefault();
              rootNavigation.navigate('Login');
            }
          },
        })}
      />
      <Tab.Screen
        name="Collection"
        component={CollectionScreen}
        options={{
          title: 'コレクション',
          tabBarIcon: ({ color }) => <Text style={{ color }}>🏆</Text>,
        }}
        listeners={() => ({
          tabPress: e => {
            if (!isAuthenticated) {
              e.preventDefault();
              rootNavigation.navigate('Login');
            }
          },
        })}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{
          title: '設定',
          tabBarIcon: ({ color }) => <Text style={{ color }}>⚙</Text>,
        }}
      />
    </Tab.Navigator>
  );
}
