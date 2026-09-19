import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import {
  Animated,
  AppState,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import type { NativeSyntheticEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Camera, GeoJSONSource, Layer, Map } from '@maplibre/maplibre-react-native';
import type {
  CameraRef,
  PressEvent,
  PressEventWithFeatures,
} from '@maplibre/maplibre-react-native';
import { MaterialIcons } from '@expo/vector-icons';

import { PermissionStatus } from 'expo-location';
import { fetchSpotsByPrefecture } from '@services/spots';
import { FABButton } from '@components/animated/FABButton';
import { SearchBar } from '@components/common/SearchBar';
import { LoginPromptModal } from '@components/common/LoginPromptModal';
import { MAP_STYLE } from '@components/map/mapStyle';
import { SpotMapLayers } from '@components/map/SpotMapLayers';
import { SpotBottomSheet } from '@components/spot-detail/SpotBottomSheet';
import { useAuth } from '@hooks/useAuth';
import { useLocation } from '@hooks/useLocation';
import { useReduceMotion } from '@hooks/useReduceMotion';
import { useSpots } from '@hooks/useSpots';
import { useUserStamps } from '@hooks/useUserStamps';
import { useWishlist } from '@hooks/useWishlist';
import type { MapStackScreenProps } from '@/navigation/types';
import type { Spot } from '@/types/supabase';
import { buildSpotSources, pointCollection, spotFilterIds } from '@utils/spotGeoJson';
import { colors } from '@theme/colors';
import { typography } from '@theme/typography';
import { spacing, borderRadius } from '@theme/spacing';
import { shadows } from '@theme/shadows';

type Props = MapStackScreenProps<'Map'>;
type FilterMode = 'all' | 'visited' | 'wishlist';

/** 起動時のズーム。旧実装の delta 0.015 相当（log2(360/0.015) ≈ 14.5） */
const INITIAL_ZOOM = 14.5;
/** スポットを選んだとき／検索から飛んだときの寄り */
const FOCUS_ZOOM = 15.5;
/** 位置情報が取れないときの初期表示（東京駅） */
const FALLBACK_CENTER: [number, number] = [139.7671, 35.6812];
const FALLBACK_ZOOM = 9;

/** フィルタの開閉。閉じる方を短くして、待たされる感じを残さない */
const FILTER_OPEN_MS = 180;
const FILTER_CLOSE_MS = 130;

export function MapScreen({ navigation, route }: Props) {
  const { isAuthenticated } = useAuth();
  const { location, permissionStatus, refreshLocation } = useLocation();
  const { visitedSpotIds } = useUserStamps();
  const { wishlistSpotIds, toggleWishlist } = useWishlist();
  const [prefectureSpots, setPrefectureSpots] = useState<Spot[]>([]);
  const [filterMode, setFilterMode] = useState<FilterMode>('all');
  const { spots } = useSpots(location, filterMode, visitedSpotIds, wishlistSpotIds);
  const filterIds = spotFilterIds(filterMode, visitedSpotIds, wishlistSpotIds);
  const displaySpots = useMemo(() => {
    if (prefectureSpots.length === 0) return spots;
    const ids = new Set(spots.map(s => s.id));
    // 都道府県検索の結果は useSpots を通らないので、ここで同じ絞り込みを掛ける。
    // 掛けないと、絞っているのにフィルタ対象外のピンが混ざる
    const additional = prefectureSpots.filter(
      s => !ids.has(s.id) && (!filterIds || filterIds.has(s.id))
    );
    return [...spots, ...additional];
  }, [spots, prefectureSpots, filterIds]);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showFilter, setShowFilter] = useState(false);
  // showFilter は「開いているか」。閉じるモーションの間も描き続けたいので
  // マウントは別に持つ
  const [filterMounted, setFilterMounted] = useState(false);
  const filterAnim = useRef(new Animated.Value(0)).current;
  const reduceMotion = useReduceMotion();
  const [selectedSpotId, setSelectedSpotId] = useState<string | null>(null);
  // 検索バーに出す名前。検索・履歴から飛んできたときとピンをタップしたときに入る。
  // selectedSpotId とは別に持つ。シートを閉じても消さず、× で消す
  const [searchLabel, setSearchLabel] = useState<string | null>(null);

  const cameraRef = useRef<CameraRef>(null);
  const insets = useSafeAreaInsets();

  // 地図に渡す GeoJSON。件数の上限もビューポート絞り込みも掛けない
  const { clustered, pinned } = useMemo(
    () => buildSpotSources({ spots: displaySpots, visitedSpotIds, wishlistSpotIds }),
    [displaySpots, visitedSpotIds, wishlistSpotIds]
  );
  const currentLocationSource = useMemo(() => pointCollection(location), [location]);

  const searchRowTop = insets.top + spacing.xs;
  // 検索行の直下。行きたいチップを外したので1段上がった
  const locationBannerTop = searchRowTop + 52;

  // 現在地が取れた最初の一度だけカメラを寄せる（以降はユーザーの操作を尊重する）
  const didCenterRef = useRef(false);
  useEffect(() => {
    if (!location || didCenterRef.current) return;
    didCenterRef.current = true;
    cameraRef.current?.flyTo({
      center: [location.longitude, location.latitude],
      zoom: INITIAL_ZOOM,
      duration: 0,
    });
  }, [location]);

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
        if (coords) {
          cameraRef.current?.flyTo({
            center: [coords.longitude, coords.latitude],
            zoom: INITIAL_ZOOM,
            duration: 500,
          });
        }
      }
      appStateRef.current = nextAppState;
    });

    return () => subscription.remove();
  }, [permissionStatus, refreshLocation]);

  // 処理済みの focusSpotId。displaySpots は再取得のたびに参照が変わるので、
  // これが無いと × で消した名前とボトムシートが勝手に復活する。
  // 「変化したら実行」ではなく「まだ処理していなければ実行」にしているのは、
  // 飛んできた直後はスポットの読み込みが終わっておらず find が空振りするため
  const handledFocusSpotIdRef = useRef<string | null>(null);

  useEffect(() => {
    const focusSpotId = route.params?.focusSpotId;
    if (!focusSpotId) {
      handledFocusSpotIdRef.current = null;
      return;
    }
    if (handledFocusSpotIdRef.current === focusSpotId) return;

    const spot = displaySpots.find(s => s.id === focusSpotId);
    if (!spot) return; // まだ読めていない。次の displaySpots 更新で拾う

    handledFocusSpotIdRef.current = focusSpotId;

    cameraRef.current?.flyTo({
      center: [spot.lng, spot.lat],
      zoom: FOCUS_ZOOM,
      duration: 500,
    });

    setSelectedSpotId(focusSpotId);
    setSearchLabel(spot.name);
  }, [route.params?.focusSpotId, displaySpots]);

  // フィルタを掛けたら、残ったピンが見える位置までカメラを寄せる。
  // 寄せないと、保存したスポットが今いる場所から遠いときに
  // 「絞ったら何も出てこなくなった」ように見える
  const appliedFilterRef = useRef<FilterMode>('all');
  useEffect(() => {
    if (filterMode === appliedFilterRef.current) return;
    if (filterMode === 'all') {
      appliedFilterRef.current = 'all';
      return;
    }
    if (displaySpots.length === 0) return; // 0件。空表示に任せる

    appliedFilterRef.current = filterMode;
    const lats = displaySpots.map(s => s.lat);
    const lngs = displaySpots.map(s => s.lng);

    // 1件だけだと矩形が潰れるので、fitBounds ではなく寄せる
    if (displaySpots.length === 1) {
      cameraRef.current?.flyTo({ center: [lngs[0], lats[0]], zoom: FOCUS_ZOOM, duration: 600 });
      return;
    }
    cameraRef.current?.fitBounds(
      [Math.min(...lngs), Math.min(...lats), Math.max(...lngs), Math.max(...lats)],
      { padding: { top: 140, right: 60, bottom: 200, left: 60 }, duration: 600 }
    );
  }, [filterMode, displaySpots]);

  // 開くときは先にマウントしてから動かす。閉じるときは動かし終えてから外す
  useEffect(() => {
    if (showFilter) setFilterMounted(true);
  }, [showFilter]);

  useEffect(() => {
    if (!filterMounted) return;

    if (reduceMotion) {
      filterAnim.setValue(showFilter ? 1 : 0);
      if (!showFilter) setFilterMounted(false);
      return;
    }

    Animated.timing(filterAnim, {
      toValue: showFilter ? 1 : 0,
      duration: showFilter ? FILTER_OPEN_MS : FILTER_CLOSE_MS,
      easing: showFilter ? Easing.out(Easing.cubic) : Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished && !showFilter) setFilterMounted(false);
    });

    // 動いている途中で画面が外れたら止める。他の購読と同じく後始末する
    return () => filterAnim.stopAnimation();
  }, [showFilter, filterMounted, reduceMotion, filterAnim]);

  // 絞り込みで地図から消えたスポットのシートは閉じる。
  // 開いたままだと地図に無いスポットの詳細が出続け、0件のときは
  // 空表示とも重なる（どちらも検索行の直下にいる）
  useEffect(() => {
    if (!selectedSpotId) return;
    if (displaySpots.some(s => s.id === selectedSpotId)) return;
    setSelectedSpotId(null);
    setSearchLabel(null);
  }, [selectedSpotId, displaySpots]);

  useEffect(() => {
    const focusPrefecture = route.params?.focusPrefecture;
    if (!focusPrefecture) {
      setPrefectureSpots([]);
      return;
    }

    (async () => {
      const data = await fetchSpotsByPrefecture(focusPrefecture);
      setPrefectureSpots(data);

      if (data.length === 0) return;
      const lats = data.map(s => s.lat);
      const lngs = data.map(s => s.lng);
      cameraRef.current?.fitBounds(
        [Math.min(...lngs), Math.min(...lats), Math.max(...lngs), Math.max(...lats)],
        { padding: { top: 100, right: 50, bottom: 50, left: 50 }, duration: 600 }
      );
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

  const handleSpotPress = useCallback(
    (spotId: string) => {
      setSelectedSpotId(spotId);

      const spot = displaySpots.find(s => s.id === spotId);
      if (spot) {
        setSearchLabel(spot.name);
        cameraRef.current?.easeTo({ center: [spot.lng, spot.lat], duration: 300 });
      }
    },
    [displaySpots]
  );

  const handleClusterPress = useCallback((center: [number, number], expansionZoom: number) => {
    cameraRef.current?.flyTo({ center, zoom: expansionZoom, duration: 400 });
  }, []);

  // スポットをタップした場合も Map まで伝播してくる。feature が付いていたら
  // ソース側で処理済みなので、ボトムシートを閉じない
  const handleMapPress = useCallback(
    (event: NativeSyntheticEvent<PressEventWithFeatures> | NativeSyntheticEvent<PressEvent>) => {
      const features = (event.nativeEvent as Partial<PressEventWithFeatures>).features;
      if (features && features.length > 0) return;
      setSelectedSpotId(null);
    },
    []
  );

  const handleBottomSheetDismiss = useCallback(() => {
    setSelectedSpotId(null);
  }, []);

  const handleSearchClear = useCallback(() => {
    setSearchLabel(null);
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

  return (
    <View style={styles.container} testID="map-screen">
      <View style={[styles.searchRow, { top: searchRowTop }]}>
        <View style={styles.searchBarWrapper}>
          <SearchBar
            variant="floating"
            editable={false}
            value={searchLabel ?? undefined}
            showClearButton={searchLabel !== null}
            onClear={handleSearchClear}
            onPress={() => navigation.navigate('Search')}
          />
        </View>
        {isAuthenticated && (
          <TouchableOpacity
            style={[styles.filterButton, filterMode !== 'all' && styles.filterButtonActive]}
            onPress={handleFilterPress}
            activeOpacity={0.7}
            testID="filter-button"
          >
            <MaterialIcons
              name="filter-list"
              size={24}
              color={filterMode !== 'all' ? colors.primary[500] : colors.gray[600]}
            />
          </TouchableOpacity>
        )}
      </View>

      {filterMounted && (
        <Pressable
          style={styles.filterOverlay}
          onPress={() => setShowFilter(false)}
          testID="filter-overlay"
        >
          <Animated.View
            style={[
              styles.filterDropdown,
              {
                top: searchRowTop + 52,
                opacity: filterAnim,
                // ボタンから降りてくるように、少し上から・少し小さく入る
                transform: [
                  {
                    translateY: filterAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [-8, 0],
                    }),
                  },
                  {
                    scale: filterAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.96, 1],
                    }),
                  },
                ],
              },
            ]}
            testID="filter-dropdown"
          >
            <TouchableOpacity
              style={[styles.filterOption, filterMode === 'all' && styles.filterOptionActive]}
              onPress={() => handleFilterSelect('all')}
              accessibilityRole="button"
              accessibilityState={{ selected: filterMode === 'all' }}
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
              style={[styles.filterOption, filterMode === 'wishlist' && styles.filterOptionActive]}
              onPress={() => handleFilterSelect('wishlist')}
              accessibilityRole="button"
              accessibilityState={{ selected: filterMode === 'wishlist' }}
              testID="filter-option-wishlist"
            >
              <Text
                style={[
                  styles.filterOptionText,
                  filterMode === 'wishlist' && styles.filterOptionTextActive,
                ]}
              >
                {/* ピン着色用に既に取っている ID の Set を使う。
                    件数表示のために詳細付きの JOIN クエリを再取得しない */}
                {wishlistSpotIds.size > 0 ? `行きたい (${wishlistSpotIds.size})` : '行きたい'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.filterOption, filterMode === 'visited' && styles.filterOptionActive]}
              onPress={() => handleFilterSelect('visited')}
              accessibilityRole="button"
              accessibilityState={{ selected: filterMode === 'visited' }}
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
          </Animated.View>
        </Pressable>
      )}

      {/* 絞り込んだ結果が0件。真っ白な地図だけ出すと壊れて見える */}
      {filterMode !== 'all' && displaySpots.length === 0 && (
        <View
          style={[styles.filterEmpty, { top: locationBannerTop }]}
          pointerEvents="none"
          testID="map-filter-empty"
        >
          <MaterialIcons
            name={filterMode === 'wishlist' ? 'bookmark-border' : 'place'}
            size={20}
            color={colors.gray[400]}
          />
          <Text style={styles.filterEmptyText}>
            {filterMode === 'wishlist'
              ? 'まだ「行きたい」がありません。ピンをタップして保存できます'
              : 'まだ訪問した記録がありません'}
          </Text>
        </View>
      )}

      <Map
        style={styles.map}
        mapStyle={MAP_STYLE}
        testID="map-view"
        onPress={handleMapPress}
        logo={false}
        compass={false}
        attributionPosition={{ bottom: 78, left: 8 }}
      >
        <Camera
          ref={cameraRef}
          initialViewState={
            location
              ? { center: [location.longitude, location.latitude], zoom: INITIAL_ZOOM }
              : { center: FALLBACK_CENTER, zoom: FALLBACK_ZOOM }
          }
        />

        {/* 現在地。ネイティブビューではなくレイヤなので再描画コストがない */}
        <GeoJSONSource id="goshuin-current-location" data={currentLocationSource}>
          <Layer
            id="goshuin-current-location-halo"
            type="circle"
            paint={{
              'circle-radius': 20,
              'circle-color': colors.pin.currentLocation,
              'circle-opacity': 0.2,
            }}
          />
          <Layer
            id="goshuin-current-location-dot"
            type="circle"
            paint={{
              'circle-radius': 7,
              'circle-color': colors.pin.currentLocation,
              'circle-stroke-width': 3,
              'circle-stroke-color': colors.white,
            }}
          />
        </GeoJSONSource>

        <SpotMapLayers
          clustered={clustered}
          pinned={pinned}
          onPressSpot={handleSpotPress}
          onPressCluster={handleClusterPress}
        />
      </Map>

      {permissionStatus === PermissionStatus.DENIED && (
        <TouchableOpacity
          style={[styles.locationOffBanner, { top: locationBannerTop }]}
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
    // 地図に重ねる白い要素は検索バーと同じ強さで浮かせる。shadows.sm は
    // 地図の地の色(#F2F3F0)の上では沈み込みが 3.5% しかなく、輪郭が出ない
    ...shadows.md,
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
  filterEmpty: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
    zIndex: 9,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.white,
    ...shadows.md,
  },
  filterEmptyText: {
    ...typography.bodySmall,
    color: colors.gray[600],
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
    right: 20,
  },
});
