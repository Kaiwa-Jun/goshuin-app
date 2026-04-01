import React, { useState } from 'react';
import { Dimensions, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { MaterialIcons } from '@expo/vector-icons';

import { Badge } from '@components/common/Badge';
import { ImagePreviewModal } from '@components/common/ImagePreviewModal';
import { WishlistButton } from '@components/animated/WishlistButton';
import { SpotInfoSection } from '@components/spot-detail/SpotInfoSection';
import { getStampImageUrl } from '@services/stamps';
import type { Spot, Stamp, PublicStampWithUser } from '@/types/supabase';
import type { ParsedSpotInfo } from '@hooks/useSpotInfo';
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
  spotInfo?: ParsedSpotInfo;
}

export function SpotDetailContent({
  spot,
  stamps,
  visitCount,
  isAuthenticated,
  onRecord,
  showMiniMap = true,
  isWishlisted,
  onWishlistPress,
  publicStamps = [],
  spotInfo,
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
        <View style={[styles.addressRow, spotInfo && styles.addressRowCompact]}>
          <MaterialIcons name="place" size={16} color={colors.gray[400]} />
          <Text style={styles.address}>{spot.address}</Text>
        </View>
      )}

      {spotInfo && <SpotInfoSection spotInfo={spotInfo} />}

      <TouchableOpacity style={styles.recordLink} onPress={onRecord} testID="record-link">
        <MaterialIcons name="photo-camera" size={18} color={colors.primary[500]} />
        <Text style={styles.recordLinkText}>御朱印を記録</Text>
      </TouchableOpacity>

      {(stamps.length > 0 || publicStamps.length > 0) && (
        <View style={styles.stampGrid} testID="stamp-grid">
          {stamps.map(stamp => (
            <Image
              key={stamp.id}
              source={{ uri: getStampImageUrl(stamp.image_path) }}
              style={styles.stampImage}
              testID={`stamp-image-${stamp.id}`}
            />
          ))}
          {publicStamps.map(ps => (
            <TouchableOpacity
              key={ps.id}
              onPress={() => setSelectedPublicStamp(ps)}
              testID={`public-stamp-image-${ps.id}`}
            >
              <Image source={{ uri: getStampImageUrl(ps.image_path) }} style={styles.stampImage} />
            </TouchableOpacity>
          ))}
        </View>
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
  addressRowCompact: {
    marginBottom: spacing.sm,
  },
  address: {
    ...typography.bodySmall,
    color: colors.gray[500],
    flex: 1,
  },
  recordLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.xl,
  },
  recordLinkText: {
    ...typography.body,
    color: colors.primary[500],
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
