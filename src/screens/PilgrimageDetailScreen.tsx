import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ViewToken,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Camera, Map } from '@maplibre/maplibre-react-native';
import type { CameraRef } from '@maplibre/maplibre-react-native';
import { MaterialIcons } from '@expo/vector-icons';

import { SpotPinImages, SpotPinLayer } from '@components/map/spotPins';
import { MAP_STYLE } from '@components/map/mapStyle';
import { toSpotFeatureCollection } from '@utils/spotGeoJson';
import { Badge } from '@components/common/Badge';
import { useUserStamps } from '@hooks/useUserStamps';
import { fetchPilgrimageSpots, type PilgrimageSpotWithDetail } from '@services/pilgrimages';
import { colors } from '@theme/colors';
import { spacing, borderRadius } from '@theme/spacing';
import { typography } from '@theme/typography';
import { shadows } from '@theme/shadows';
import type { CollectionStackScreenProps } from '@/navigation/types';

type Props = CollectionStackScreenProps<'PilgrimageDetail'>;

const CARD_WIDTH = Dimensions.get('window').width * 0.8;
/** 巡礼の地図に「行きたい」は出さない（訪問済みかどうかだけ色で分ける） */
const EMPTY_IDS = new Set<string>();

export function PilgrimageDetailScreen({ navigation, route }: Props) {
  const { pilgrimageId, pilgrimageName } = route.params;
  const { visitedSpotIds } = useUserStamps();
  const [spots, setSpots] = useState<PilgrimageSpotWithDetail[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const cameraRef = useRef<CameraRef>(null);
  const flatListRef = useRef<FlatList<PilgrimageSpotWithDetail>>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await fetchPilgrimageSpots(pilgrimageId);
        if (!cancelled) setSpots(data);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [pilgrimageId]);

  // スポットが読み込まれたら全スポットが収まるように地図を調整
  useEffect(() => {
    if (spots.length === 0) return;
    const lats = spots.map(s => s.spot.lat);
    const lngs = spots.map(s => s.spot.lng);
    cameraRef.current?.fitBounds(
      [Math.min(...lngs), Math.min(...lats), Math.max(...lngs), Math.max(...lats)],
      { padding: { top: 50, right: 50, bottom: 50, left: 50 }, duration: 600 }
    );
  }, [spots]);

  const visitedCount = spots.filter(s => visitedSpotIds.has(s.spot.id)).length;
  const totalSpots = spots.length;

  // ピンをタップしたら、その札所のカードまでスクロールする
  const handleSpotPress = useCallback(
    (spotId: string) => {
      const index = spots.findIndex(s => s.spot.id === spotId);
      if (index >= 0) flatListRef.current?.scrollToIndex({ index, animated: true });
    },
    [spots]
  );

  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    if (viewableItems.length > 0) {
      const item = viewableItems[0].item as PilgrimageSpotWithDetail;
      cameraRef.current?.flyTo({
        center: [item.spot.lng, item.spot.lat],
        zoom: 15,
        duration: 800,
      });
    }
  }).current;

  const viewabilityConfig = useRef({ viewAreaCoveragePercentThreshold: 50 }).current;

  const renderCard = ({ item }: { item: PilgrimageSpotWithDetail }) => {
    const isVisited = visitedSpotIds.has(item.spot.id);
    return (
      <View style={[styles.card, { width: CARD_WIDTH }]}>
        <View style={styles.cardNameRow}>
          <Text style={styles.cardName} numberOfLines={1}>
            {item.spot.name}
          </Text>
        </View>
        <View style={styles.cardBadgeRow}>
          <Badge type={item.spot.type === 'shrine' ? 'shrine' : 'temple'} />
          {isVisited && <Text style={styles.visitedText}>✓ 訪問済み</Text>}
        </View>
        {item.spot.address && (
          <Text style={styles.cardAddress} numberOfLines={1}>
            {item.spot.address}
          </Text>
        )}
        {item.label && <Text style={styles.cardLabel}>{item.label}</Text>}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* ヘッダー */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          testID="back-button"
        >
          <MaterialIcons name="arrow-back" size={24} color={colors.gray[800]} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {pilgrimageName}
        </Text>
        {isLoading ? (
          <View style={styles.progressArea} />
        ) : (
          <Text style={styles.progressText}>
            {visitedCount}/{totalSpots}
          </Text>
        )}
      </View>

      {/* マップ（全画面） + カード（マップ上に浮かせる） */}
      <View style={styles.mapContainer}>
        <Map style={styles.map} mapStyle={MAP_STYLE} testID="pilgrimage-map" logo={false}>
          <Camera ref={cameraRef} initialViewState={{ center: [135.7681, 35.0116], zoom: 9 }} />
          <SpotPinImages />
          <SpotPinLayer
            id="pilgrimage-spots"
            data={toSpotFeatureCollection({
              spots: spots.map(s => s.spot),
              visitedSpotIds,
              wishlistSpotIds: EMPTY_IDS,
            })}
            onPressSpot={handleSpotPress}
          />
        </Map>

        {/* カード一覧（マップ上にオーバーレイ） */}
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary[500]} />
          </View>
        ) : (
          <FlatList
            ref={flatListRef}
            data={spots}
            keyExtractor={item => item.id}
            renderItem={renderCard}
            horizontal
            showsHorizontalScrollIndicator={false}
            snapToInterval={CARD_WIDTH + spacing.sm}
            snapToAlignment="start"
            decelerationRate="fast"
            contentContainerStyle={styles.cardList}
            onViewableItemsChanged={onViewableItemsChanged}
            viewabilityConfig={viewabilityConfig}
            style={styles.flatList}
          />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.white,
    ...shadows.sm,
  },
  backButton: {
    marginRight: spacing.sm,
    padding: spacing.xs,
  },
  headerTitle: {
    flex: 1,
    ...typography.h3,
    color: colors.gray[900],
  },
  progressArea: {
    width: 40,
  },
  progressText: {
    ...typography.bodySmall,
    color: colors.gray[500],
    minWidth: 40,
    textAlign: 'right',
  },
  mapContainer: {
    flex: 1,
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  loadingContainer: {
    position: 'absolute',
    bottom: spacing.xl,
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flatList: {
    position: 'absolute',
    bottom: spacing.xl,
    left: 0,
    right: 0,
    flexGrow: 0,
  },
  cardList: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.sm,
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    ...shadows.md,
  },
  cardNameRow: {
    marginBottom: spacing.sm,
  },
  cardName: {
    ...typography.body,
    fontWeight: 'bold',
    color: colors.gray[900],
  },
  cardBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  visitedText: {
    ...typography.bodySmall,
    color: colors.primary[600],
    fontWeight: '600',
  },
  cardAddress: {
    ...typography.bodySmall,
    color: colors.gray[500],
    marginTop: spacing.xs,
  },
  cardLabel: {
    ...typography.caption,
    color: colors.primary[500],
    marginTop: spacing.xs,
  },
});
