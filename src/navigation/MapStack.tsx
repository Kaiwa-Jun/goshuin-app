import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { MapScreen } from '@screens/MapScreen';
import { SearchScreen } from '@screens/SearchScreen';
import { SpotDetailScreen } from '@screens/SpotDetailScreen';
import type { MapStackParamList } from '@/navigation/types';

const Stack = createNativeStackNavigator<MapStackParamList>();

export function MapStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen name="Map" component={MapScreen} options={{ headerShown: false }} />
      <Stack.Screen
        name="Search"
        component={SearchScreen}
        options={{ headerShown: false, animation: 'none' }}
      />
      <Stack.Screen
        name="SpotDetail"
        component={SpotDetailScreen}
        options={{ headerShown: false }}
      />
    </Stack.Navigator>
  );
}
