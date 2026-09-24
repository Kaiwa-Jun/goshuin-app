import React from 'react';
import { Dimensions, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import type { GalleryImage } from '@components/common/ImageGalleryModal';

import { getStampImageUrl } from '@services/stamps';
import type { Stamp, PublicStampWithUser } from '@/types/supabase';
import { colors } from '@theme/colors';
import { spacing, borderRadius } from '@theme/spacing';
import { typography } from '@theme/typography';

export const SHEET_THUMBNAIL_LIMIT = 3;

const GRID_GAP = spacing.xs;
const CONTENT_PADDING = spacing.lg;
const THUMBNAIL_SIZE = (Dimensions.get('window').width - CONTENT_PADDING * 2 - GRID_GAP * 2) / 3;

export interface SheetThumbnail {
  id: string;
  imagePath: string;
}

/** 自分の記録を優先し、次に他ユーザーの公開御朱印。id で重複排除し limit 件に切る */
export function selectSheetThumbnails(
  stamps: Stamp[],
  publicStamps: PublicStampWithUser[],
  limit: number = SHEET_THUMBNAIL_LIMIT
): SheetThumbnail[] {
  const seen = new Set<string>();
  const selected: SheetThumbnail[] = [];

  for (const stamp of [...stamps, ...publicStamps]) {
    if (selected.length >= limit) break;
    if (seen.has(stamp.id)) continue;
    seen.add(stamp.id);
    selected.push({ id: stamp.id, imagePath: stamp.image_path });
  }

  return selected;
}

/**
 * シートのギャラリーに渡す画像の列。自分の記録 → 公開の順、id で重複排除（帯と同じ順なので、
 * 帯の i 枚目を押したら i 番目から開ける。Issue #253）
 */
export function buildSpotGalleryImages(
  stamps: Stamp[],
  publicStamps: PublicStampWithUser[]
): GalleryImage[] {
  const seen = new Set<string>();
  const images: GalleryImage[] = [];
  for (const s of stamps) {
    if (seen.has(s.id)) continue;
    seen.add(s.id);
    images.push({
      id: s.id,
      imageUrl: getStampImageUrl(s.image_path),
      memo: s.memo,
      visitedAt: s.visited_at,
    });
  }
  for (const ps of publicStamps) {
    if (seen.has(ps.id)) continue;
    seen.add(ps.id);
    images.push({
      id: ps.id,
      imageUrl: getStampImageUrl(ps.image_path),
      userName: ps.profiles?.display_name,
      memo: ps.memo,
      visitedAt: ps.visited_at,
    });
  }
  return images;
}

interface SpotThumbnailStripProps {
  stamps: Stamp[];
  publicStamps: PublicStampWithUser[];
  /** 押した写真の番号（帯の並び = buildSpotGalleryImages の並び） */
  onPressThumbnail: (index: number) => void;
}

/**
 * シートで御朱印を数枚だけ見せる帯。閉じても開いても同じ帯（Issue #253）。
 * 画像が1件も無いときは行ごと消える。プレースホルダを置くと、公開御朱印が
 * まだ少ない時期に compact が間延びするため。
 */
export function SpotThumbnailStrip({
  stamps,
  publicStamps,
  onPressThumbnail,
}: SpotThumbnailStripProps) {
  const thumbnails = selectSheetThumbnails(stamps, publicStamps);
  // 帯に出ない残りの枚数。帯は増やさず、3枚目に「+N」を重ねる（開いてもグリッドにしない）
  const more = selectSheetThumbnails(stamps, publicStamps, Infinity).length - thumbnails.length;

  if (thumbnails.length === 0) {
    return null;
  }

  return (
    <View style={styles.container} testID="spot-thumbnails">
      {thumbnails.map((thumbnail, index) => (
        <TouchableOpacity
          key={thumbnail.id}
          onPress={() => onPressThumbnail(index)}
          activeOpacity={0.7}
          testID={`spot-thumbnail-${index}`}
        >
          <Image source={{ uri: getStampImageUrl(thumbnail.imagePath) }} style={styles.image} />
          {more > 0 && index === thumbnails.length - 1 && (
            <View style={styles.more} testID="spot-thumbnail-more">
              <View style={styles.moreShade} />
              <Text style={styles.moreText}>{`+${more}`}</Text>
            </View>
          )}
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    gap: GRID_GAP,
    marginTop: spacing.sm,
  },
  more: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: borderRadius.md,
    overflow: 'hidden',
  },
  moreShade: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.black,
    opacity: 0.4,
  },
  moreText: {
    ...typography.h3,
    color: colors.white,
  },
  image: {
    width: THUMBNAIL_SIZE,
    height: THUMBNAIL_SIZE,
    borderRadius: borderRadius.md,
    backgroundColor: colors.gray[100],
  },
});
