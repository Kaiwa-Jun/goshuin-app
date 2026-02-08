import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { GalleryScreen } from '@screens/GalleryScreen';
import { StampDetailScreen } from '@screens/StampDetailScreen';
import type { GalleryStackParamList } from '@/navigation/types';

const Stack = createNativeStackNavigator<GalleryStackParamList>();

export function GalleryStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen name="Gallery" component={GalleryScreen} options={{ headerShown: false }} />
      <Stack.Screen
        name="StampDetail"
        component={StampDetailScreen}
        options={{ title: '御朱印詳細' }}
      />
    </Stack.Navigator>
  );
}
