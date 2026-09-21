import React, { useCallback, useMemo, useState } from 'react';
import { Dimensions, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Camera, Map } from '@maplibre/maplibre-react-native';
import { MaterialIcons } from '@expo/vector-icons';

import { ImageGalleryModal, GalleryImage } from '@components/common/ImageGalleryModal';
import { SpotPinImages, SpotPinLayer } from '@components/map/spotPins';
import { MAP_STYLE } from '@components/map/mapStyle';
import { toSpotFeatureCollection } from '@utils/spotGeoJson';
import { SpotInfoSection } from '@components/spot-detail/SpotInfoSection';
import { SpotSheetHeader } from '@components/spot-detail/SpotSheetHeader';
import { SpotSheetActions } from '@components/spot-detail/SpotSheetActions';
import { LimitedGoshuinSection } from '@components/spot-detail/LimitedGoshuinSection';
import { getStampImageUrl } from '@services/stamps';
import { TsukimairiCard, TsukimairiPast } from '@components/spot-detail/TsukimairiCard';
import { tsukimairiOf } from '@utils/tsukimairi';
import { toLocalDateString } from '@utils/localDate';
import type { Spot, Stamp, PublicStampWithUser } from '@/types/supabase';
import type { ParsedSpotInfo } from '@hooks/useSpotInfo';
import { colors } from '@theme/colors';
import { typography } from '@theme/typography';
import { spacing, borderRadius } from '@theme/spacing';

const GRID_GAP = spacing.xs;
const CONTENT_PADDING = spacing.lg;
const STAMP_IMAGE_SIZE = (Dimensions.get('window').width - CONTENT_PADDING * 2 - GRID_GAP * 2) / 3;
/** ミニマップは訪問状況で色を変えない（未訪問色の1本ピン） */
const EMPTY_IDS = new Set<string>();

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
  onGalleryVisibleChange?: (visible: boolean) => void;
  /**
   * 'sheet' はボトムシートの展開時に使う。ヘッダー・情報行・アクション行は
   * シート側が常時描画しているため、ここでは描画しない（二重表示の防止）。
   */
  variant?: 'standalone' | 'sheet';
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
  onGalleryVisibleChange,
  variant = 'standalone',
}: SpotDetailContentProps) {
  const isStandalone = variant === 'standalone';
  const showVisited = isAuthenticated && visitCount > 0;
  /*
   * 月参りは、その寺社の記録から数える。参拝日は DATE のまま渡す
   * （new Date() を挟むと Issue #204 と同じ1日ずれを踏む）
   */
  const tsukimairi = useMemo(
    () =>
      tsukimairiOf(
        stamps.map(s => s.visited_at),
        toLocalDateString(new Date())
      ),
    [stamps]
  );

  const [selectedImageIndex, setSelectedImageIndex] = useState<number | null>(null);

  const openGallery = useCallback(
    (index: number) => {
      setSelectedImageIndex(index);
      onGalleryVisibleChange?.(true);
    },
    [onGalleryVisibleChange]
  );

  const closeGallery = useCallback(() => {
    setSelectedImageIndex(null);
    onGalleryVisibleChange?.(false);
  }, [onGalleryVisibleChange]);

  const allGalleryImages: GalleryImage[] = [
    ...stamps.map(s => ({
      id: s.id,
      imageUrl: getStampImageUrl(s.image_path),
      memo: s.memo,
      visitedAt: s.visited_at,
    })),
    ...publicStamps.map(ps => ({
      id: ps.id,
      imageUrl: getStampImageUrl(ps.image_path),
      userName: ps.profiles.display_name,
      memo: ps.memo,
      visitedAt: ps.visited_at,
    })),
  ];

  return (
    <View style={styles.content} testID="spot-detail-content">
      {isStandalone && (
        <>
          <SpotSheetHeader spot={spot} isVisited={showVisited} isWishlisted={isWishlisted} />
          {spotInfo && <SpotInfoSection spotInfo={spotInfo} />}
        </>
      )}

      {spotInfo && (
        <LimitedGoshuinSection info={spotInfo.limitedGoshuin} snsLinks={spotInfo.snsLinks} />
      )}

      {isStandalone && (
        <SpotSheetActions
          isWishlisted={isWishlisted}
          onWishlistPress={onWishlistPress}
          onRecordPress={onRecord}
        />
      )}

      {/* 続いていればカード、途切れていれば1行だけ（§3） */}
      <TsukimairiCard tsukimairi={tsukimairi} />
      {!tsukimairi.shouldShowCard && <TsukimairiPast longest={tsukimairi.longest} />}

      {(stamps.length > 0 || publicStamps.length > 0) && (
        <View style={styles.stampGrid} testID="stamp-grid">
          {stamps.map((stamp, index) => (
            <TouchableOpacity
              key={stamp.id}
              onPress={() => openGallery(index)}
              testID={`stamp-image-${stamp.id}`}
            >
              <Image
                source={{ uri: getStampImageUrl(stamp.image_path) }}
                style={styles.stampImage}
              />
            </TouchableOpacity>
          ))}
          {publicStamps.map((ps, index) => (
            <TouchableOpacity
              key={ps.id}
              onPress={() => openGallery(stamps.length + index)}
              testID={`public-stamp-image-${ps.id}`}
            >
              <Image source={{ uri: getStampImageUrl(ps.image_path) }} style={styles.stampImage} />
            </TouchableOpacity>
          ))}
        </View>
      )}

      {selectedImageIndex !== null && (
        <ImageGalleryModal
          visible={selectedImageIndex !== null}
          onClose={closeGallery}
          images={allGalleryImages}
          initialIndex={selectedImageIndex}
        />
      )}

      {showMiniMap && (
        <>
          <Text style={styles.sectionTitle}>アクセス</Text>
          <View style={styles.miniMapContainer} testID="mini-map">
            {/* attribution は消さない。OSM 由来のタイルは ODbL で帰属表示が要る */}
            <Map
              style={styles.miniMapView}
              mapStyle={MAP_STYLE}
              logo={false}
              compass={false}
              dragPan={false}
              touchZoom={false}
              doubleTapZoom={false}
              doubleTapHoldZoom={false}
              touchRotate={false}
              touchPitch={false}
            >
              <Camera initialViewState={{ center: [spot.lng, spot.lat], zoom: 15.5 }} />
              <SpotPinImages />
              {/* 名前は真上のヘッダに出ているので、ここではピンだけ */}
              <SpotPinLayer
                id="spot-detail-mini-map"
                data={toSpotFeatureCollection({
                  spots: [spot],
                  visitedSpotIds: EMPTY_IDS,
                  wishlistSpotIds: EMPTY_IDS,
                })}
                hideLabels
              />
            </Map>
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
