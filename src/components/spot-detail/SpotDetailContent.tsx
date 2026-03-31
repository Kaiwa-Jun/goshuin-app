import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { MaterialIcons } from '@expo/vector-icons';

import { Badge } from '@components/common/Badge';
import { Button } from '@components/common/Button';
import { Card } from '@components/common/Card';
import { WishlistButton } from '@components/animated/WishlistButton';
import { getStampImageUrl } from '@services/stamps';
import type { Spot, Stamp } from '@/types/supabase';
import { colors } from '@theme/colors';
import { typography } from '@theme/typography';
import { spacing, borderRadius } from '@theme/spacing';

interface SpotDetailContentProps {
  spot: Spot;
  stamps: Stamp[];
  visitCount: number;
  latestVisitDate: string | null;
  isAuthenticated: boolean;
  onRecord: () => void;
  showMiniMap?: boolean;
  isWishlisted?: boolean;
  onWishlistPress?: () => void;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}/${m}/${day}`;
}

export function SpotDetailContent({
  spot,
  stamps,
  visitCount,
  latestVisitDate,
  isAuthenticated,
  onRecord,
  showMiniMap = true,
  isWishlisted,
  onWishlistPress,
}: SpotDetailContentProps) {
  const badgeType = spot.type === 'shrine' ? 'shrine' : 'temple';
  const showVisited = isAuthenticated && visitCount > 0;

  return (
    <View style={styles.content} testID="spot-detail-content">
      <View style={styles.badgeRow}>
        <Badge type={badgeType} />
        {showVisited && <Badge type="visited" />}
      </View>

      <View style={styles.nameRow}>
        <Text style={[styles.spotName, styles.spotNameFlex]} testID="spot-name">
          {spot.name}
        </Text>
        {onWishlistPress && isWishlisted !== undefined && (
          <WishlistButton isWishlisted={isWishlisted} onPress={onWishlistPress} />
        )}
      </View>
      {spot.address && (
        <View style={styles.addressRow}>
          <MaterialIcons name="place" size={16} color={colors.gray[400]} />
          <Text style={styles.address}>{spot.address}</Text>
        </View>
      )}

      <Card style={styles.visitCard}>
        <View style={styles.visitRow}>
          <View style={styles.visitItem}>
            <Text style={styles.visitLabel}>種別</Text>
            <Text style={styles.visitValue}>{spot.type === 'shrine' ? '神社' : '寺院'}</Text>
          </View>
          {isAuthenticated && visitCount > 0 && (
            <>
              <View style={styles.visitItem}>
                <Text style={styles.visitLabel}>訪問回数</Text>
                <Text style={styles.visitValue}>{visitCount}</Text>
              </View>
              <View style={styles.visitItem}>
                <Text style={styles.visitLabel}>最終訪問日</Text>
                <Text style={styles.visitValue}>
                  {latestVisitDate ? formatDate(latestVisitDate) : '-'}
                </Text>
              </View>
            </>
          )}
        </View>
      </Card>

      <Button
        title="ここで記録する"
        onPress={onRecord}
        variant="primary"
        style={styles.recordButton}
      />

      {stamps.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>記録済み御朱印</Text>
          <View style={styles.stampGrid} testID="stamp-grid">
            {stamps.map(stamp => (
              <Image
                key={stamp.id}
                source={{ uri: getStampImageUrl(stamp.image_path) }}
                style={styles.stampImage}
                testID={`stamp-image-${stamp.id}`}
              />
            ))}
          </View>
        </>
      )}

      {showMiniMap && (
        <>
          <Text style={styles.sectionTitle}>アクセス</Text>
          <View style={styles.miniMapContainer} testID="mini-map">
            <MapView
              style={styles.miniMapView}
              initialRegion={{
                latitude: spot.lat,
                longitude: spot.lng,
                latitudeDelta: 0.005,
                longitudeDelta: 0.005,
              }}
              scrollEnabled={false}
              zoomEnabled={false}
              rotateEnabled={false}
              pitchEnabled={false}
            >
              <Marker coordinate={{ latitude: spot.lat, longitude: spot.lng }} />
            </MapView>
          </View>
          {spot.address && (
            <View style={styles.miniMapAddress}>
              <MaterialIcons name="place" size={16} color={colors.primary[500]} />
              <Text style={styles.miniMapAddressText}>{spot.address}</Text>
            </View>
          )}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing['3xl'],
  },
  badgeRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  spotName: {
    ...typography.h2,
    color: colors.gray[900],
  },
  spotNameFlex: {
    flex: 1,
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.xl,
  },
  address: {
    ...typography.bodySmall,
    color: colors.gray[500],
    flex: 1,
  },
  visitCard: {
    marginBottom: spacing.lg,
  },
  visitRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  visitItem: {
    flex: 1,
    alignItems: 'center',
    gap: spacing.xs,
  },
  visitLabel: {
    ...typography.caption,
    color: colors.gray[500],
  },
  visitValue: {
    ...typography.h3,
    color: colors.gray[900],
  },
  recordButton: {
    marginBottom: spacing.xl,
  },
  sectionTitle: {
    ...typography.h3,
    color: colors.gray[800],
    marginBottom: spacing.md,
    marginTop: spacing.lg,
  },
  stampGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  stampImage: {
    width: '31.5%',
    aspectRatio: 1,
    borderRadius: borderRadius.md,
    backgroundColor: colors.gray[100],
  },
  miniMapContainer: {
    height: 150,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
  },
  miniMapView: {
    flex: 1,
  },
  miniMapAddress: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.md,
  },
  miniMapAddressText: {
    ...typography.bodySmall,
    color: colors.gray[600],
    flex: 1,
  },
});
