import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { PlanCalendarScreen } from '@screens/PlanCalendarScreen';
import { PlanEditorScreen } from '@screens/PlanEditorScreen';
import type { PlanStackParamList } from './types';

const Stack = createNativeStackNavigator<PlanStackParamList>();

/** 参拝の予定（Issue #258）。予定を組む画面もタブバーの上に出す */
export function PlanStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="PlanCalendar" component={PlanCalendarScreen} />
      <Stack.Screen name="PlanEditor" component={PlanEditorScreen} />
    </Stack.Navigator>
  );
}
