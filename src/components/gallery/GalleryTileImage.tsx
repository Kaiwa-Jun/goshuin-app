import React, { useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';

import { colors } from '@theme/colors';
import { borderRadius } from '@theme/spacing';
import { ImageLoadingCover } from '@components/gallery/ImageLoadingCover';

interface GalleryTileImageProps {
  stampId: string;
  uri: string;
  size: number;
  reduceMotion: boolean;
  /** 読み込んだ写真の実寸 */
  onLoad: (width: number, height: number) => void;
  /** 写真が届かなかった */
  onError: () => void;
}

/**
 * タイル表示の1枚の写真と、写真が届くまでの下地（Issue #275）。
 *
 * 一覧の renderItem は関数なので hooks を持てない。読み込み中を持つために
 * 写真と下地を1つの部品にする。
 *
 * 読み込み中 = 落ち着いた URL が今の URL と違う。小さい写真が無くて親が元の写真に
 * 替えたときは、次の描画で URL が変わるので読み込み中のまま（下地は消えない）。
 * 元の写真も届かなければ、そこで読み込み中が終わり、今と同じ灰色が出る
 */
export function GalleryTileImage({
  stampId,
  uri,
  size,
  reduceMotion,
  onLoad,
  onError,
}: GalleryTileImageProps) {
  const [settledUri, setSettledUri] = useState<string | null>(null);
  const sized = { width: size, height: size };

  return (
    <View testID={`stamp-tile-${stampId}`} style={[styles.tile, sized]}>
      <Image
        testID={`stamp-image-${stampId}`}
        source={{ uri }}
        style={[styles.image, sized]}
        onLoad={e => {
          // 先に落ち着かせる。Web の nativeEvent には source が無く、後ろで例外になる
          setSettledUri(uri);
          onLoad(e.nativeEvent.source.width, e.nativeEvent.source.height);
        }}
        onError={() => {
          setSettledUri(uri);
          onError();
        }}
      />
      <ImageLoadingCover
        loading={settledUri !== uri}
        variant="tile"
        reduceMotion={reduceMotion}
        testID={`stamp-image-loading-${stampId}`}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  tile: {
    borderRadius: borderRadius.md,
    overflow: 'hidden',
  },
  image: {
    backgroundColor: colors.gray[200],
    borderRadius: borderRadius.md,
  },
});
