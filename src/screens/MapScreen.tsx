import React, { useState, useRef, useCallback } from 'react';
import { FlatList, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MapView, { Marker } from 'react-native-maps';
import { MaterialIcons } from '@expo/vector-icons';

import { FABButton } from '@components/animated/FABButton';
import { SearchBar } from '@components/common/SearchBar';
import { LoginPromptModal } from '@components/common/LoginPromptModal';
import { MapPin } from '@components/common/MapPin';
import { useAuth } from '@hooks/useAuth';
import { useLocation } from '@hooks/useLocation';
import { useSpots } from '@hooks/useSpots';
import { useUserStamps } from '@hooks/useUserStamps';
import { useMapSearch } from '@hooks/useMapSearch';
import type { MapStackScreenProps } from '@/navigation/types';
import type { Spot } from '@/types/supabase';
import { colors } from '@theme/colors';
import { typography } from '@theme/typography';
import { spacing, borderRadius } from '@theme/spacing';
import { shadows } from '@theme/shadows';

type Props = MapStackScreenProps<'Map'>;
type PinType = 'shrine-visited' | 'temple-visited' | 'unvisited' | 'current-location';
type FilterMode = 'all' | 'visited';

const LATITUDE_DELTA = 0.02;
const LONGITUDE_DELTA = 0.02;

function getPinType(spot: Spot, visitedSpotIds: Set<string>): PinType {
  if (!visitedSpotIds.has(spot.id)) return 'unvisited';
  return spot.type === 'shrine' ? 'shrine-visited' : 'temple-visited';
}

function formatDistance(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)}m`;
  return `${km.toFixed(1)}km`;
}

export function MapScreen({ navigation }: Props) {
  const { isAuthenticated } = useAuth();
  const { location } = useLocation();
  const { visitedSpotIds } = useUserStamps();
  const [filterMode, setFilterMode] = useState<FilterMode>('all');
  const { spots, allSpots } = useSpots(location, filterMode, visitedSpotIds);
  const {
    query,
    setQuery,
    suggestions,
    showSuggestions,
    setShowSuggestions,
    nearbySpots,
    clearSearch,
  } = useMapSearch(allSpots, location);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showFilter, setShowFilter] = useState(false);
  const mapRef = useRef<MapView>(null);
  const insets = useSafeAreaInsets();

  const searchRowTop = insets.top + spacing.xs;

  const navigateToRecord = () => {
    const parent = navigation.getParent();
    if (parent) {
      parent.navigate('Record');
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

  const handleMarkerPress = useCallback(
    (spotId: string) => {
      navigation.navigate('SpotDetail', { spotId });
    },
    [navigation]
  );

  const handleSuggestionPress = useCallback(
    (spotId: string) => {
      setShowSuggestions(false);
      clearSearch();
      navigation.navigate('SpotDetail', { spotId });
    },
    [navigation, setShowSuggestions, clearSearch]
  );

  const handleSearchFocus = () => {
    setShowSuggestions(true);
  };

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

  const displaySuggestions = query ? suggestions : nearbySpots;

  return (
    <View style={styles.container} testID="map-screen">
      <View style={[styles.searchRow, { top: searchRowTop }]}>
        <View style={styles.searchBarWrapper}>
          <SearchBar
            value={query}
            onChangeText={setQuery}
            onFocus={handleSearchFocus}
            showClearButton={query.length > 0}
            onClear={clearSearch}
          />
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

      {showSuggestions && displaySuggestions.length > 0 && (
        <View
          style={[styles.suggestionsContainer, { top: searchRowTop + 52 }]}
          testID="suggestions-list"
        >
          <FlatList
            data={displaySuggestions}
            keyExtractor={item => item.spot.id}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => (
              <Pressable
                style={styles.suggestionItem}
                onPress={() => handleSuggestionPress(item.spot.id)}
                testID={`suggestion-${item.spot.id}`}
              >
                <View style={styles.suggestionContent}>
                  <Text style={styles.suggestionName} numberOfLines={1}>
                    {item.spot.name}
                  </Text>
                  <Text style={styles.suggestionDistance}>{formatDistance(item.distance)}</Text>
                </View>
              </Pressable>
            )}
          />
        </View>
      )}

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
            key={spot.id}
            coordinate={{ latitude: spot.lat, longitude: spot.lng }}
            testID={`spot-marker-${spot.id}`}
            anchor={{ x: 0.5, y: 0.5 }}
            onPress={() => handleMarkerPress(spot.id)}
          >
            <MapPin type={getPinType(spot, visitedSpotIds)} />
          </Marker>
        ))}
      </MapView>

      <View style={styles.fabContainer}>
        <FABButton onPress={handleFABPress} />
      </View>

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
  suggestionsContainer: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
    zIndex: 20,
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    maxHeight: 200,
    ...shadows.md,
  },
  suggestionItem: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.gray[200],
  },
  suggestionContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  suggestionName: {
    ...typography.body,
    color: colors.gray[800],
    flex: 1,
  },
  suggestionDistance: {
    ...typography.bodySmall,
    color: colors.gray[400],
    marginLeft: spacing.sm,
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
