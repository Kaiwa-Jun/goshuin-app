import { useState, useEffect, useCallback } from 'react';
import * as Location from 'expo-location';
import { DEFAULT_LOCATION } from '@utils/geo';

interface LocationCoords {
  latitude: number;
  longitude: number;
}

export interface LocationState {
  location: LocationCoords | null;
  isLoading: boolean;
  error: string | null;
  permissionStatus: Location.PermissionStatus | null;
  refreshLocation: () => Promise<void>;
}

export function useLocation(): LocationState {
  const [location, setLocation] = useState<LocationCoords | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [permissionStatus, setPermissionStatus] = useState<Location.PermissionStatus | null>(null);

  const fetchLocation = useCallback(async () => {
    try {
      const { status } = await Location.getForegroundPermissionsAsync();
      setPermissionStatus(status);

      if (status !== Location.PermissionStatus.GRANTED) {
        setLocation(DEFAULT_LOCATION);
        setIsLoading(false);
        return;
      }

      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      setLocation({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      });
      setError(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
      setLocation(DEFAULT_LOCATION);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLocation();
  }, [fetchLocation]);

  const refreshLocation = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    await fetchLocation();
  }, [fetchLocation]);

  return {
    location,
    isLoading,
    error,
    permissionStatus,
    refreshLocation,
  };
}
