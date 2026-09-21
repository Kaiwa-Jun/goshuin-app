import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'onboarding_completed';

export function useOnboarding() {
  const [isCompleted, setIsCompleted] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then(value => {
      setIsCompleted(value === 'true');
      setIsLoading(false);
    });
  }, []);

  const completeOnboarding = useCallback(async () => {
    await AsyncStorage.setItem(STORAGE_KEY, 'true');
    setIsCompleted(true);
  }, []);

  /**
   * 完了の印を消す。**開発中だけ**。
   *
   * 一度終えるとオンボーディングは二度と出ないので、実機で見るには
   * アプリを入れ直すしかなかった。dev build を焼き直すのは重すぎる
   */
  const resetOnboarding = useCallback(async () => {
    await AsyncStorage.removeItem(STORAGE_KEY);
    setIsCompleted(false);
  }, []);

  return { isCompleted, isLoading, completeOnboarding, resetOnboarding };
}
