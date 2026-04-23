import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@hooks/useAuth';
import { fetchProfile, updateDefaultPublicSetting } from '@services/profiles';

interface UseDefaultPublicSettingReturn {
  defaultPublic: boolean;
  isLoading: boolean;
  updateDefaultPublic: (value: boolean) => Promise<void>;
}

export function useDefaultPublicSetting(): UseDefaultPublicSettingReturn {
  const { user } = useAuth();
  const [defaultPublic, setDefaultPublic] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setDefaultPublic(false);
      setIsLoading(false);
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        const profile = await fetchProfile(user.id);
        if (!cancelled && profile) {
          setDefaultPublic(profile.default_stamp_public);
        }
      } catch {
        // エラー時はデフォルト値(false)のまま
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user]);

  const updateDefaultPublic = useCallback(
    async (value: boolean): Promise<void> => {
      if (!user) return;

      try {
        await updateDefaultPublicSetting(user.id, value);
        setDefaultPublic(value);
      } catch {
        // エラー時は状態を変更しない
      }
    },
    [user]
  );

  return {
    defaultPublic,
    isLoading,
    updateDefaultPublic,
  };
}
