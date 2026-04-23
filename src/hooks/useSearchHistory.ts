import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'search_history';
const MAX_HISTORY = 10;

export interface SearchHistoryItem {
  spotId: string;
  spotName: string;
}

interface UseSearchHistoryReturn {
  history: SearchHistoryItem[];
  isLoading: boolean;
  addHistory: (item: SearchHistoryItem) => Promise<void>;
  clearHistory: () => Promise<void>;
}

export function useSearchHistory(): UseSearchHistoryReturn {
  const [history, setHistory] = useState<SearchHistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then(value => {
      if (value) {
        try {
          const parsed = JSON.parse(value);
          setHistory(Array.isArray(parsed) ? parsed : []);
        } catch {
          setHistory([]);
        }
      }
      setIsLoading(false);
    });
  }, []);

  const addHistory = useCallback(async (item: SearchHistoryItem) => {
    if (!item.spotId || !item.spotName) return;

    setHistory(prev => {
      const filtered = prev.filter(h => h.spotId !== item.spotId);
      const next = [item, ...filtered].slice(0, MAX_HISTORY);
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const clearHistory = useCallback(async () => {
    await AsyncStorage.removeItem(STORAGE_KEY);
    setHistory([]);
  }, []);

  return { history, isLoading, addHistory, clearHistory };
}
