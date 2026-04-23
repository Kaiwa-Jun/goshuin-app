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
import MapView, { Marker } from 'react-native-maps';
import { MaterialIcons } from '@expo/vector-icons';

import { SpotMarker } from '@components/common/SpotMarker';
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

export function PilgrimageDetailScreen({ navigation, route }: Props) {
  const { pilgrimageId, pilgrimageName } = route.params;
  const { visitedSpotIds } = useUserStamps();
  const [spots, setSpots] = useState<PilgrimageSpotWithDetail[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const mapRef = useRef<MapView>(null);
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
    if (spots.length === 0 || !mapRef.current) return;
    const coords = spots.map(s => ({ latitude: s.spot.lat, longitude: s.spot.lng }));
    mapRef.current.fitToCoordinates(coords, {
      edgePadding: { top: 50, right: 50, bottom: 50, left: 50 },
      animated: true,
    });
  }, [spots]);

  const visitedCount = spots.filter(s => visitedSpotIds.has(s.spot.id)).length;
  const totalSpots = spots.length;

  const handleMarkerPress = useCallback((index: number) => {
    flatListRef.current?.scrollToIndex({ index, animated: true });
  }, []);

  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    if (viewableItems.length > 0) {
      const item = viewableItems[0].item as PilgrimageSpotWithDetail;
      mapRef.current?.animateToRegion(
        {
          latitude: item.spot.lat,
          longitude: item.spot.lng,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        },
        800
      );
    }
  }).current;

  const viewabilityConfig = useRef({ viewAreaCoveragePercentThreshold: 50 }).current;

  const getPinColor = (spotId: string, type: string): string => {
    if (visitedSpotIds.has(spotId)) {
      return type === 'shrine' ? colors.pin.shrineVisited : colors.pin.templeVisited;
    }
    return colors.pin.unvisited;
  };

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
        <MapView ref={mapRef} style={styles.map} testID="pilgrimage-map">
          {spots.map((item, index) => (
            <Marker
              key={item.id}
              coordinate={{ latitude: item.spot.lat, longitude: item.spot.lng }}
              onPress={() => handleMarkerPress(index)}
              testID={`marker-${item.spot.id}`}
            >
              <SpotMarker
                color={getPinColor(item.spot.id, item.spot.type)}
                name={item.spot.name}
                showLabel={true}
              />
            </Marker>
          ))}
        </MapView>

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
