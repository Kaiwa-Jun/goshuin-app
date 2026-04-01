import React, { useState } from 'react';
import { Dimensions, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { MaterialIcons } from '@expo/vector-icons';

import { Badge } from '@components/common/Badge';
import { Button } from '@components/common/Button';
import { Card } from '@components/common/Card';
import { ImagePreviewModal } from '@components/common/ImagePreviewModal';
import { WishlistButton } from '@components/animated/WishlistButton';
import { getStampImageUrl } from '@services/stamps';
import type { Spot, Stamp, PublicStampWithUser } from '@/types/supabase';
import { colors } from '@theme/colors';
import { typography } from '@theme/typography';
import { spacing, borderRadius } from '@theme/spacing';

const GRID_GAP = spacing.xs;
const CONTENT_PADDING = spacing.lg;
const STAMP_IMAGE_SIZE = (Dimensions.get('window').width - CONTENT_PADDING * 2 - GRID_GAP * 2) / 3;

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
  publicStamps?: PublicStampWithUser[];
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
  publicStamps = [],
}: SpotDetailContentProps) {
  const badgeType = spot.type === 'shrine' ? 'shrine' : 'temple';
  const showVisited = isAuthenticated && visitCount > 0;
  const [selectedPublicStamp, setSelectedPublicStamp] = useState<PublicStampWithUser | null>(null);

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

      {publicStamps.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>みんなの御朱印</Text>
          <View style={styles.stampGrid} testID="public-stamp-grid">
            {publicStamps.map(ps => (
              <TouchableOpacity
                key={ps.id}
                onPress={() => setSelectedPublicStamp(ps)}
                testID={`public-stamp-image-${ps.id}`}
                style={styles.publicStampContainer}
              >
                <Image
                  source={{ uri: getStampImageUrl(ps.image_path) }}
                  style={styles.publicStampImage}
                />
                <View style={styles.publicStampOverlay}>
                  <Text style={styles.publicStampUserName} numberOfLines={1}>
                    {ps.profiles.display_name ?? '匿名'}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </>
      )}

      {selectedPublicStamp && (
        <ImagePreviewModal
          visible={!!selectedPublicStamp}
          onClose={() => setSelectedPublicStamp(null)}
          imageUrl={getStampImageUrl(selectedPublicStamp.image_path)}
          userName={selectedPublicStamp.profiles.display_name}
          memo={selectedPublicStamp.memo}
          visitedAt={selectedPublicStamp.visited_at}
        />
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
    width: STAMP_IMAGE_SIZE,
    height: STAMP_IMAGE_SIZE,
    borderRadius: borderRadius.md,
    backgroundColor: colors.gray[100],
  },
  publicStampContainer: {
    width: STAMP_IMAGE_SIZE,
    position: 'relative',
  },
  publicStampImage: {
    width: STAMP_IMAGE_SIZE,
    height: STAMP_IMAGE_SIZE,
    borderRadius: borderRadius.md,
    backgroundColor: colors.gray[100],
  },
  publicStampOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    borderBottomLeftRadius: borderRadius.md,
    borderBottomRightRadius: borderRadius.md,
  },
  publicStampUserName: {
    ...typography.caption,
    color: colors.white,
    textAlign: 'center',
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
