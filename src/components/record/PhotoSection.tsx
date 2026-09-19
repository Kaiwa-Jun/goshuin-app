import React, { useState, useEffect } from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { colors } from '@theme/colors';
import { typography } from '@theme/typography';
import { spacing, borderRadius } from '@theme/spacing';
import { MAX_PHOTOS_PER_RECORD } from '@/constants/record';

interface PhotoSectionProps {
  imageUris: string[];
  /** カメラを起動する */
  onAddPress: () => void;
  onRemove: (index: number) => void;
  error: string | null;
}

/** タイル同士の間隔。外側の marginHorizontal で相殺して、左右が本文と揃うようにする */
const TILE_GAP = spacing.xs;

interface PhotoTileProps {
  uri: string;
  index: number;
  /** 1枚だけのときは全幅で出す */
  full: boolean;
  onRemove: () => void;
}

function PhotoTile({ uri, index, full, onRemove }: PhotoTileProps) {
  const [aspect, setAspect] = useState(3 / 4);

  useEffect(() => {
    // 全幅のときだけ実寸比で出す。タイルは正方形に切るので測る必要がない
    if (full) Image.getSize(uri, (w, h) => setAspect(w / h));
  }, [uri, full]);

  return (
    <View style={full ? styles.tileFull : styles.tile} testID={`photo-tile-${index}`}>
      <View style={styles.tileInner}>
        <Image
          source={{ uri }}
          style={full ? [styles.image, { aspectRatio: aspect }] : styles.image}
          resizeMode="cover"
          testID={`photo-preview-${index}`}
        />
        <TouchableOpacity
          style={styles.removeButton}
          onPress={onRemove}
          // 小さなアイコンなので、指で押せる範囲を広げる
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityRole="button"
          accessibilityLabel="写真を削除"
          testID={`photo-remove-${index}`}
        >
          <MaterialIcons name="close" size={16} color={colors.white} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

/**
 * 御朱印の写真。1箇所で複数枚いただける寺社があるので複数枚持てる（Issue #180）。
 *
 * 「まとめて登録」のようなモードは作らない。1枚はN枚の特殊ケースとして扱い、
 * あとから2枚目に気づいても足せるようにしている。
 * 1枚のときだけ全幅で出すのは、訪問日を決めるときに写真の日付が読める必要が
 * あるため（Issue #178）
 */
export function PhotoSection({ imageUris, onAddPress, onRemove, error }: PhotoSectionProps) {
  if (imageUris.length === 0) {
    return (
      <View>
        <TouchableOpacity
          style={[styles.placeholder, error && styles.placeholderError]}
          onPress={onAddPress}
          activeOpacity={0.7}
          testID="photo-section"
        >
          <Text style={styles.cameraIcon}>📷</Text>
          {/* 選択モーダルを廃してカメラ直起動にしたので、何が起きるかを文言で示す */}
          <Text style={styles.placeholderText}>タップして撮影</Text>
        </TouchableOpacity>
        {error && <Text style={styles.errorText}>{error}</Text>}
      </View>
    );
  }

  const isSingle = imageUris.length === 1;

  return (
    <View>
      <View style={styles.grid}>
        {imageUris.map((uri, index) => (
          <PhotoTile
            key={`${index}-${uri}`}
            uri={uri}
            index={index}
            full={isSingle}
            onRemove={() => onRemove(index)}
          />
        ))}
        {imageUris.length < MAX_PHOTOS_PER_RECORD && (
          <TouchableOpacity
            style={styles.tile}
            onPress={onAddPress}
            accessibilityRole="button"
            accessibilityLabel="写真を撮影して追加"
            testID="photo-add"
          >
            <View style={[styles.tileInner, styles.addTile]}>
              <MaterialIcons name="photo-camera" size={24} color={colors.gray[400]} />
            </View>
          </TouchableOpacity>
        )}
      </View>
      {error && <Text style={styles.errorText}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  placeholder: {
    borderWidth: 2,
    borderColor: colors.gray[200],
    borderStyle: 'dashed',
    borderRadius: borderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing['4xl'],
  },
  placeholderError: {
    borderColor: colors.error,
  },
  cameraIcon: {
    fontSize: 32,
    marginBottom: spacing.sm,
  },
  placeholderText: {
    ...typography.body,
    color: colors.gray[400],
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    // タイルの padding 分を相殺して、左右の端を本文に揃える
    marginHorizontal: -TILE_GAP,
  },
  tile: {
    width: '33.333%',
    padding: TILE_GAP,
  },
  tileFull: {
    width: '100%',
    padding: TILE_GAP,
  },
  tileInner: {
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    backgroundColor: colors.gray[100],
  },
  image: {
    width: '100%',
    aspectRatio: 1,
    maxHeight: 400,
  },
  addTile: {
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.gray[200],
    borderStyle: 'dashed',
  },
  removeButton: {
    position: 'absolute',
    top: spacing.xs,
    right: spacing.xs,
    width: 24,
    height: 24,
    borderRadius: borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  errorText: {
    ...typography.caption,
    color: colors.error,
    marginTop: spacing.xs,
  },
});
