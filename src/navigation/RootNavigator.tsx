import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { configureGoogleSignIn } from '@services/auth';
import { TabNavigator } from '@/navigation/TabNavigator';
import { OnboardingScreen } from '@screens/OnboardingScreen';
import { LoginScreen } from '@screens/LoginScreen';
import { RecordScreen } from '@screens/RecordScreen';
import { RecordCompleteScreen } from '@screens/RecordCompleteScreen';
import { useOnboarding } from '@hooks/useOnboarding';
import type { RootStackParamList } from '@/navigation/types';

configureGoogleSignIn();

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator() {
  const { isCompleted, isLoading } = useOnboarding();

  if (isLoading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color="#F97316" />
      </View>
    );
  }

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {!isCompleted && <Stack.Screen name="Onboarding" component={OnboardingScreen} />}
      <Stack.Screen name="MainTabs" component={TabNavigator} />
      <Stack.Screen name="Record" component={RecordScreen} />
      <Stack.Screen name="RecordComplete" component={RecordCompleteScreen} />
      <Stack.Screen name="Login" component={LoginScreen} options={{ presentation: 'modal' }} />
    </Stack.Navigator>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
