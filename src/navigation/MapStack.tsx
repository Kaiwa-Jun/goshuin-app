import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { MapScreen } from '@screens/MapScreen';
import { SpotDetailScreen } from '@screens/SpotDetailScreen';
import type { MapStackParamList } from '@/navigation/types';

const Stack = createNativeStackNavigator<MapStackParamList>();

export function MapStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen name="Map" component={MapScreen} options={{ headerShown: false }} />
      <Stack.Screen
        name="SpotDetail"
        component={SpotDetailScreen}
        options={{ title: 'スポット詳細' }}
      />
    </Stack.Navigator>
  );
}
