import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

import { TabBarIcon } from '@components/animated/TabBarIcon';

import { MapStack } from '@/navigation/MapStack';
import { PlanStack } from '@/navigation/PlanStack';
import { GalleryStack } from '@/navigation/GalleryStack';
import { CollectionStack } from '@/navigation/CollectionStack';
import { SettingsScreen } from '@screens/SettingsScreen';
import { useAnnualReportAutoPlay } from '@hooks/useAnnualReportAutoPlay';
import { colors } from '@theme/colors';
import type { MainTabParamList } from '@/navigation/types';

const Tab = createBottomTabNavigator<MainTabParamList>();

interface Props {
  /**
   * 年報の自動再生の判定を始めてよいか（Issue #274 D-18）。
   * 起動の印（スプラッシュ）が消えるまで false。省略すると true
   */
  autoPlayReady?: boolean;
}

export function TabNavigator({ autoPlayReady = true }: Props) {
  // 12月に1回だけの年報の自動再生。MainTabs の画面そのもので判定する
  useAnnualReportAutoPlay({ ready: autoPlayReady });

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
        name="PlanTab"
        component={PlanStack}
        options={{
          title: '予定',
          tabBarIcon: ({ color, focused }) => (
            <TabBarIcon
              name="event"
              routeName="PlanTab"
              motion="draw"
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
