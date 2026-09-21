import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { configureGoogleSignIn } from '@services/auth';
import { TabNavigator } from '@/navigation/TabNavigator';
import { OnboardingScreen } from '@screens/OnboardingScreen';
import { LoginScreen } from '@screens/LoginScreen';
import { RecordScreen } from '@screens/RecordScreen';
import { RecordCompleteScreen } from '@screens/RecordCompleteScreen';
import { TermsOfServiceScreen } from '@screens/TermsOfServiceScreen';
import { PrivacyPolicyScreen } from '@screens/PrivacyPolicyScreen';
import { AccountDeletionScreen } from '@screens/AccountDeletionScreen';
import { ErrorScreen } from '@screens/ErrorScreen';
import { useOnboarding } from '@hooks/useOnboarding';
import type { RootStackParamList } from '@/navigation/types';

const Stack = createNativeStackNavigator<RootStackParamList>();

configureGoogleSignIn();

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
    /*
     * Onboarding は**いつでも登録しておく**。出すかどうかは初期ルートで決める。
     *
     * 以前は `!isCompleted &&` で条件付きに登録していたが、それだと一度
     * 終えた人には画面ごと存在しなくなり、開発用の「もう一度見る」から
     * navigate すると「そんな画面は無い」で落ちた。
     * 初期ルートは最初のマウントでしか見ないので、通常の動きは変わらない
     */
    <Stack.Navigator
      screenOptions={{ headerShown: false }}
      initialRouteName={isCompleted ? 'MainTabs' : 'Onboarding'}
    >
      <Stack.Screen name="Onboarding" component={OnboardingScreen} />
      <Stack.Screen name="MainTabs" component={TabNavigator} />
      <Stack.Screen name="Record" component={RecordScreen} />
      <Stack.Screen name="RecordComplete" component={RecordCompleteScreen} />
      <Stack.Screen name="Login" component={LoginScreen} options={{ presentation: 'modal' }} />
      <Stack.Screen name="TermsOfService" component={TermsOfServiceScreen} />
      <Stack.Screen name="PrivacyPolicy" component={PrivacyPolicyScreen} />
      <Stack.Screen name="AccountDeletion" component={AccountDeletionScreen} />
      <Stack.Screen name="Error" component={ErrorScreen} />
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
