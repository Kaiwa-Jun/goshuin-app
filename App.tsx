import { useState, useCallback } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { RootNavigator } from '@/navigation/RootNavigator';
import { SplashAnimation } from '@components/animated/SplashAnimation';

export default function App() {
  const [splashComplete, setSplashComplete] = useState(false);

  const handleSplashComplete = useCallback(() => {
    setSplashComplete(true);
  }, []);

  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <RootNavigator />
      </NavigationContainer>
      {!splashComplete && <SplashAnimation onAnimationComplete={handleSplashComplete} />}
    </SafeAreaProvider>
  );
}
