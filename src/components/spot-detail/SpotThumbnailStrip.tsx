import React from 'react';
import { Dimensions, Image, StyleSheet, TouchableOpacity, View } from 'react-native';

import { getStampImageUrl } from '@services/stamps';
import type { Stamp, PublicStampWithUser } from '@/types/supabase';
import { colors } from '@theme/colors';
import { spacing, borderRadius } from '@theme/spacing';

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

interface SpotThumbnailStripProps {
  stamps: Stamp[];
  publicStamps: PublicStampWithUser[];
  onPress: () => void;
}

/**
 * compact 表示で御朱印を数枚だけ見せる帯。
 * 画像が1件も無いときは行ごと消える。プレースホルダを置くと、公開御朱印が
 * まだ少ない時期に compact が間延びするため。
 */
export function SpotThumbnailStrip({ stamps, publicStamps, onPress }: SpotThumbnailStripProps) {
  const thumbnails = selectSheetThumbnails(stamps, publicStamps);

  if (thumbnails.length === 0) {
    return null;
  }

  return (
    <View style={styles.container} testID="spot-thumbnails">
      {thumbnails.map((thumbnail, index) => (
        <TouchableOpacity
          key={thumbnail.id}
          onPress={onPress}
          activeOpacity={0.7}
          testID={`spot-thumbnail-${index}`}
        >
          <Image source={{ uri: getStampImageUrl(thumbnail.imagePath) }} style={styles.image} />
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
  image: {
    width: THUMBNAIL_SIZE,
    height: THUMBNAIL_SIZE,
    borderRadius: borderRadius.md,
    backgroundColor: colors.gray[100],
  },
});
