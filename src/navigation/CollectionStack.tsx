import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { CollectionScreen } from '@screens/CollectionScreen';
import { PilgrimageDetailScreen } from '@screens/PilgrimageDetailScreen';
import type { CollectionStackParamList } from './types';

const Stack = createNativeStackNavigator<CollectionStackParamList>();

export function CollectionStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen
        name="CollectionList"
        component={CollectionScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="PilgrimageDetail"
        component={PilgrimageDetailScreen}
        options={{ headerShown: false }}
      />
    </Stack.Navigator>
  );
}
