import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { GalleryScreen } from '@screens/GalleryScreen';
import type { GalleryStackParamList } from '@/navigation/types';

const Stack = createNativeStackNavigator<GalleryStackParamList>();

export function GalleryStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen name="Gallery" component={GalleryScreen} options={{ headerShown: false }} />
    </Stack.Navigator>
  );
}
