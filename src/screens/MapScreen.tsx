import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { AppState, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MapView, { Marker, type MapPressEvent, type Region } from 'react-native-maps';
import { MaterialIcons } from '@expo/vector-icons';

import { PermissionStatus } from 'expo-location';
import { fetchSpotsByPrefecture } from '@services/spots';
import { FABButton } from '@components/animated/FABButton';
import { SearchBar } from '@components/common/SearchBar';
import { LoginPromptModal } from '@components/common/LoginPromptModal';
import { MapPin } from '@components/common/MapPin';
import { SpotMarker } from '@components/common/SpotMarker';
import { ClusterMarker } from '@components/common/ClusterMarker';
import { SpotBottomSheet } from '@components/spot-detail/SpotBottomSheet';
import { useAuth } from '@hooks/useAuth';
import { useLocation } from '@hooks/useLocation';
import { useSpotClusters } from '@hooks/useSpotClusters';
import { useSpots } from '@hooks/useSpots';
import { useUserStamps } from '@hooks/useUserStamps';
import { useWishlist } from '@hooks/useWishlist';
import type { MapStackScreenProps } from '@/navigation/types';
import type { Spot } from '@/types/supabase';
import type { SpotCluster } from '@utils/spotClustering';
import { CLUSTER_REGION_DEBOUNCE_MS, shouldRecomputeRegion } from '@utils/regionHysteresis';
import { colors } from '@theme/colors';
import { typography } from '@theme/typography';
import { spacing, borderRadius } from '@theme/spacing';
import { shadows } from '@theme/shadows';

type Props = MapStackScreenProps<'Map'>;
type FilterMode = 'all' | 'visited';

const LATITUDE_DELTA = 0.015;
const LONGITUDE_DELTA = 0.015;
const LABEL_VISIBLE_DELTA = 0.2;

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
  const { location, permissionStatus, refreshLocation } = useLocation();
  const { visitedSpotIds } = useUserStamps();
  const { wishlistSpotIds, toggleWishlist } = useWishlist();
  const [prefectureSpots, setPrefectureSpots] = useState<Spot[]>([]);
  const [filterMode, setFilterMode] = useState<FilterMode>('all');
  const { spots } = useSpots(location, filterMode, visitedSpotIds);
  const displaySpots = useMemo(() => {
    if (prefectureSpots.length === 0) return spots;
    const ids = new Set(spots.map(s => s.id));
    const additional = prefectureSpots.filter(s => !ids.has(s.id));
    return [...spots, ...additional];
  }, [spots, prefectureSpots]);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showFilter, setShowFilter] = useState(false);
  const [currentRegion, setCurrentRegion] = useState<Region | null>(null);
  // クラスタ再計算に使う region。ヒステリシス(shouldRecomputeRegion)で更新頻度を落とす
  const [clusterRegion, setClusterRegion] = useState<Region | null>(null);
  const [selectedSpotId, setSelectedSpotId] = useState<string | null>(null);
  const [forceLabelVisible, setForceLabelVisible] = useState(false);
  const skipRegionChangeRef = useRef(false);
  const clusterRegionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (clusterRegionTimerRef.current) clearTimeout(clusterRegionTimerRef.current);
    },
    []
  );
  // ユーザー操作前は location ベースの初期 region(initialRegion と同一値)を実効 region とする
  const effectiveRegion = useMemo<Region | null>(
    () =>
      currentRegion ??
      (location
        ? {
            latitude: location.latitude,
            longitude: location.longitude,
            latitudeDelta: LATITUDE_DELTA,
            longitudeDelta: LONGITUDE_DELTA,
          }
        : null),
    [currentRegion, location]
  );
  const shouldShowLabels =
    (effectiveRegion?.latitudeDelta ?? LATITUDE_DELTA) <= LABEL_VISIBLE_DELTA || forceLabelVisible;
  const mapRef = useRef<MapView>(null);
  const insets = useSafeAreaInsets();

  const searchRowTop = insets.top + spacing.xs;

  // 設定画面から戻った際に位置情報を再取得し、地図を現在地に移動する
  const appStateRef = useRef(AppState.currentState);
  useEffect(() => {
    if (permissionStatus !== PermissionStatus.DENIED) return;

    const subscription = AppState.addEventListener('change', async nextAppState => {
      if (
        (appStateRef.current === 'background' || appStateRef.current === 'inactive') &&
        nextAppState === 'active'
      ) {
        const coords = await refreshLocation();
        if (coords && mapRef.current) {
          mapRef.current.animateToRegion(
            {
              latitude: coords.latitude,
              longitude: coords.longitude,
              latitudeDelta: LATITUDE_DELTA,
              longitudeDelta: LONGITUDE_DELTA,
            },
            500
          );
        }
      }
      appStateRef.current = nextAppState;
    });

    return () => subscription.remove();
  }, [permissionStatus, refreshLocation]);

  // ユーザー操作前は location ベースの初期 region をクラスタ算出の実効 region とする
  const effectiveClusterRegion = useMemo<Region | null>(
    () =>
      clusterRegion ??
      (location
        ? {
            latitude: location.latitude,
            longitude: location.longitude,
            latitudeDelta: LATITUDE_DELTA,
            longitudeDelta: LONGITUDE_DELTA,
          }
        : null),
    [clusterRegion, location]
  );

  // 広域はクラスタバブル、近接は個別ピン。訪問済み・行きたいはクラスタに吸収されない
  const { clusters, individualSpots, getClusterExpansionRegion } = useSpotClusters({
    spots: displaySpots,
    region: effectiveClusterRegion,
    visitedSpotIds,
    wishlistSpotIds,
  });

  useEffect(() => {
    const focusSpotId = route.params?.focusSpotId;
    if (!focusSpotId || !mapRef.current) return;

    const spot = displaySpots.find(s => s.id === focusSpotId);
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
  }, [route.params?.focusSpotId, displaySpots]);

  useEffect(() => {
    const focusPrefecture = route.params?.focusPrefecture;
    if (!focusPrefecture) {
      setPrefectureSpots([]);
      setForceLabelVisible(false);
      return;
    }

    (async () => {
      const data = await fetchSpotsByPrefecture(focusPrefecture);
      setPrefectureSpots(data);

      if (data.length > 0 && mapRef.current) {
        const coords = data.map(s => ({ latitude: s.lat, longitude: s.lng }));
        skipRegionChangeRef.current = true;
        setForceLabelVisible(true);
        mapRef.current.fitToCoordinates(coords, {
          edgePadding: { top: 100, right: 50, bottom: 50, left: 50 },
          animated: true,
        });
      }
    })();
  }, [route.params?.focusPrefecture]);

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

  const handleRegionChangeComplete = useCallback((r: Region) => {
    setCurrentRegion(r);
    // クラスタ region は trailing debounce で採用する。連続ピンチ操作の
    // 中間ズーム段階で再計算（= マーカー churn の波）を起こさないため。
    // 比較相手は「直近に採用した region」。関数形式更新でそれを保証する
    if (clusterRegionTimerRef.current) clearTimeout(clusterRegionTimerRef.current);
    clusterRegionTimerRef.current = setTimeout(() => {
      clusterRegionTimerRef.current = null;
      setClusterRegion(prev => (shouldRecomputeRegion(prev, r) ? r : prev));
    }, CLUSTER_REGION_DEBOUNCE_MS);
    if (skipRegionChangeRef.current) {
      skipRegionChangeRef.current = false;
    } else {
      setForceLabelVisible(false);
    }
  }, []);

  const handleMarkerPress = useCallback(
    (spotId: string) => {
      setSelectedSpotId(spotId);

      const spot = displaySpots.find(s => s.id === spotId);
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
    [displaySpots]
  );

  const handleClusterPress = useCallback(
    (cluster: SpotCluster) => {
      mapRef.current?.animateToRegion(getClusterExpansionRegion(cluster), 300);
    },
    [getClusterExpansionRegion]
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
        {clusters.map(cluster => (
          // key は leaf 由来の cluster.id のみ。count 変化は ClusterMarker 内の
          // redraw 制御で反映するため、remount を発生させない
          <ClusterMarker key={cluster.id} cluster={cluster} onPress={handleClusterPress} />
        ))}
        {individualSpots.map(spot => (
          <Marker
            key={spot.id}
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

      {permissionStatus === PermissionStatus.DENIED && (
        <TouchableOpacity
          style={[styles.locationOffBanner, { top: searchRowTop + 52 }]}
          onPress={() => navigation.navigate('Error', { type: 'location' })}
          activeOpacity={0.8}
          testID="location-off-banner"
        >
          <MaterialIcons name="location-off" size={18} color={colors.primary[600]} />
          <Text style={styles.locationOffBannerText}>位置情報がオフです。タップして設定</Text>
        </TouchableOpacity>
      )}

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
  locationOffBanner: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.primary[50],
    borderBottomWidth: 1,
    borderBottomColor: colors.primary[200],
  },
  locationOffBannerText: {
    ...typography.body,
    color: colors.primary[600],
    fontSize: 13,
  },
  fabContainer: {
    position: 'absolute',
    bottom: 20,
    alignSelf: 'center',
  },
});
