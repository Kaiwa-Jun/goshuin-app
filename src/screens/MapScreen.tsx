import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MapView, { Marker, type MapPressEvent, type Region } from 'react-native-maps';
import { MaterialIcons } from '@expo/vector-icons';

import { FABButton } from '@components/animated/FABButton';
import { SearchBar } from '@components/common/SearchBar';
import { LoginPromptModal } from '@components/common/LoginPromptModal';
import { MapPin } from '@components/common/MapPin';
import { SpotMarker } from '@components/common/SpotMarker';
import { SpotBottomSheet } from '@components/spot-detail/SpotBottomSheet';
import { useAuth } from '@hooks/useAuth';
import { useLocation } from '@hooks/useLocation';
import { useSpots } from '@hooks/useSpots';
import { useUserStamps } from '@hooks/useUserStamps';
import { useWishlist } from '@hooks/useWishlist';
import type { MapStackScreenProps } from '@/navigation/types';
import type { Spot } from '@/types/supabase';
import { colors } from '@theme/colors';
import { typography } from '@theme/typography';
import { spacing, borderRadius } from '@theme/spacing';
import { shadows } from '@theme/shadows';

type Props = MapStackScreenProps<'Map'>;
type FilterMode = 'all' | 'visited';

const LATITUDE_DELTA = 0.02;
const LONGITUDE_DELTA = 0.02;
const LABEL_VISIBLE_DELTA = 0.08;

function getPinColor(
  spot: Spot,
  visitedSpotIds: Set<string>,
  wishlistSpotIds?: Set<string>
): string {
  if (visitedSpotIds.has(spot.id)) {
    return spot.type === 'shrine' ? colors.pin.shrineVisited : colors.pin.templeVisited;
  }
  if (wishlistSpotIds?.has(spot.id)) return colors.pin.wishlisted;
  return colors.pin.unvisited;
}

export function MapScreen({ navigation, route }: Props) {
  const { isAuthenticated } = useAuth();
  const { location } = useLocation();
  const { visitedSpotIds } = useUserStamps();
  const { wishlistSpotIds, toggleWishlist } = useWishlist();
  const [filterMode, setFilterMode] = useState<FilterMode>('all');
  const { spots } = useSpots(location, filterMode, visitedSpotIds);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showFilter, setShowFilter] = useState(false);
  const [currentLatitudeDelta, setCurrentLatitudeDelta] = useState(LATITUDE_DELTA);
  const [selectedSpotId, setSelectedSpotId] = useState<string | null>(null);
  const shouldShowLabels = currentLatitudeDelta <= LABEL_VISIBLE_DELTA;
  const mapRef = useRef<MapView>(null);
  const insets = useSafeAreaInsets();

  const searchRowTop = insets.top + spacing.xs;

  useEffect(() => {
    const focusSpotId = route.params?.focusSpotId;
    if (!focusSpotId || !mapRef.current) return;

    const spot = spots.find(s => s.id === focusSpotId);
    if (!spot) return;

    mapRef.current.animateToRegion(
      {
        latitude: spot.lat,
        longitude: spot.lng,
        latitudeDelta: LATITUDE_DELTA,
        longitudeDelta: LONGITUDE_DELTA,
      },
      500
    );

    setSelectedSpotId(focusSpotId);
  }, [route.params?.focusSpotId, spots]);

  // Clear selection if the selected spot is no longer in the spots list
  useEffect(() => {
    if (selectedSpotId && !spots.find(s => s.id === selectedSpotId)) {
      setSelectedSpotId(null);
    }
  }, [selectedSpotId, spots]);

  const navigateToRecord = (spotId?: string) => {
    const parent = navigation.getParent();
    if (parent) {
      parent.navigate('Record', spotId ? { spotId } : undefined);
    }
  };

  const handleFABPress = () => {
    if (isAuthenticated) {
      navigateToRecord();
    } else {
      setShowLoginModal(true);
    }
  };

  const handleLoginSuccess = () => {
    setShowLoginModal(false);
    navigateToRecord();
  };

  const handleRegionChangeComplete = useCallback((region: Region) => {
    setCurrentLatitudeDelta(region.latitudeDelta);
  }, []);

  const handleMarkerPress = useCallback(
    (spotId: string) => {
      setSelectedSpotId(spotId);

      const spot = spots.find(s => s.id === spotId);
      if (spot && mapRef.current) {
        mapRef.current.animateCamera(
          {
            center: {
              latitude: spot.lat,
              longitude: spot.lng,
            },
          },
          { duration: 300 }
        );
      }
    },
    [spots]
  );

  const handleMapPress = useCallback((event?: MapPressEvent) => {
    if (event?.nativeEvent?.action === 'marker-press') return;
    setSelectedSpotId(null);
  }, []);

  const handleBottomSheetDismiss = useCallback(() => {
    setSelectedSpotId(null);
  }, []);

  const handleBottomSheetRecord = useCallback(
    (spotId: string) => {
      if (isAuthenticated) {
        navigateToRecord(spotId);
      } else {
        setShowLoginModal(true);
      }
    },
    [isAuthenticated]
  );

  const handleWishlistToggle = useCallback(
    (spotId: string) => {
      if (!isAuthenticated) {
        setShowLoginModal(true);
        return;
      }
      toggleWishlist(spotId);
    },
    [isAuthenticated, toggleWishlist]
  );

  const handleFilterPress = () => {
    setShowFilter(!showFilter);
  };

  const handleFilterSelect = (mode: FilterMode) => {
    setFilterMode(mode);
    setShowFilter(false);
  };

  const region = location
    ? {
        latitude: location.latitude,
        longitude: location.longitude,
        latitudeDelta: LATITUDE_DELTA,
        longitudeDelta: LONGITUDE_DELTA,
      }
    : undefined;

  return (
    <View style={styles.container} testID="map-screen">
      <View style={[styles.searchRow, { top: searchRowTop }]}>
        <View style={styles.searchBarWrapper}>
          <SearchBar editable={false} onPress={() => navigation.navigate('Search')} />
        </View>
        {isAuthenticated && (
          <TouchableOpacity
            style={[styles.filterButton, filterMode === 'visited' && styles.filterButtonActive]}
            onPress={handleFilterPress}
            activeOpacity={0.7}
            testID="filter-button"
          >
            <MaterialIcons
              name="filter-list"
              size={24}
              color={filterMode === 'visited' ? colors.primary[500] : colors.gray[600]}
            />
          </TouchableOpacity>
        )}
      </View>

      {showFilter && (
        <Pressable
          style={styles.filterOverlay}
          onPress={() => setShowFilter(false)}
          testID="filter-overlay"
        >
          <View
            style={[styles.filterDropdown, { top: searchRowTop + 52 }]}
            testID="filter-dropdown"
          >
            <TouchableOpacity
              style={[styles.filterOption, filterMode === 'all' && styles.filterOptionActive]}
              onPress={() => handleFilterSelect('all')}
              testID="filter-option-all"
            >
              <Text
                style={[
                  styles.filterOptionText,
                  filterMode === 'all' && styles.filterOptionTextActive,
                ]}
              >
                すべて表示
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.filterOption, filterMode === 'visited' && styles.filterOptionActive]}
              onPress={() => handleFilterSelect('visited')}
              testID="filter-option-visited"
            >
              <Text
                style={[
                  styles.filterOptionText,
                  filterMode === 'visited' && styles.filterOptionTextActive,
                ]}
              >
                訪問済みのみ
              </Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      )}

      <MapView
        ref={mapRef}
        style={styles.map}
        initialRegion={region}
        testID="map-view"
        showsUserLocation={false}
        onRegionChangeComplete={handleRegionChangeComplete}
        onPress={handleMapPress}
      >
        {location && (
          <Marker
            coordinate={{
              latitude: location.latitude,
              longitude: location.longitude,
            }}
            testID="current-location-marker"
            anchor={{ x: 0.5, y: 0.5 }}
          >
            <MapPin type="current-location" />
          </Marker>
        )}
        {spots.map(spot => (
          <Marker
            key={`${spot.id}-${shouldShowLabels ? 'label' : 'pin'}`}
            coordinate={{ latitude: spot.lat, longitude: spot.lng }}
            testID={`spot-marker-${spot.id}`}
            onPress={() => handleMarkerPress(spot.id)}
            anchor={{ x: 0.5, y: 1 }}
            tracksViewChanges={false}
          >
            <SpotMarker
              color={getPinColor(spot, visitedSpotIds, wishlistSpotIds)}
              name={spot.name}
              showLabel={shouldShowLabels}
            />
          </Marker>
        ))}
      </MapView>

      {!selectedSpotId && (
        <View style={styles.fabContainer}>
          <FABButton onPress={handleFABPress} />
        </View>
      )}

      <SpotBottomSheet
        spotId={selectedSpotId}
        visitedSpotIds={visitedSpotIds}
        onDismiss={handleBottomSheetDismiss}
        onRecord={handleBottomSheetRecord}
        wishlistSpotIds={wishlistSpotIds}
        onWishlistToggle={handleWishlistToggle}
      />

      <LoginPromptModal
        visible={showLoginModal}
        onClose={() => setShowLoginModal(false)}
        onLoginSuccess={handleLoginSuccess}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  searchRow: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 10,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  searchBarWrapper: {
    flex: 1,
  },
  filterButton: {
    width: 44,
    height: 44,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.sm,
  },
  filterButtonActive: {
    borderWidth: 2,
    borderColor: colors.primary[500],
  },
  filterOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 15,
  },
  filterDropdown: {
    position: 'absolute',
    right: spacing.lg,
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    ...shadows.md,
    overflow: 'hidden',
  },
  filterOption: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
  },
  filterOptionActive: {
    backgroundColor: colors.primary[50],
  },
  filterOptionText: {
    ...typography.body,
    color: colors.gray[700],
  },
  filterOptionTextActive: {
    color: colors.primary[500],
    fontWeight: '600',
  },
  map: {
    flex: 1,
  },
  fabContainer: {
    position: 'absolute',
    bottom: 20,
    alignSelf: 'center',
  },
});
