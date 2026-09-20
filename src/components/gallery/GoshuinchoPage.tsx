import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { colors } from '@theme/colors';
import { typography } from '@theme/typography';
import { spacing, borderRadius } from '@theme/spacing';
import { formatJapaneseEraDate } from '@utils/japaneseEra';

/**
 * 覗いている（中央ではない）ページの不透明度。
 *
 * 奥行きの表現は GoshuinchoFlipView 側の折り（rotateY）と影が担うので、
 * ここでの減衰は控えめにする。強く落とすと紙が透けて見えてしまう。
 */
export const PEEK_OPACITY = 0.9;

/** 高さ / 幅。縦長の帳面に見えるようにする */
export const PAGE_ASPECT_RATIO = 1.5;

const BLANK_ICON_SIZE = 32;

type GoshuinchoPageProps = {
  width: number;
  isCurrent: boolean;
  onPress: () => void;
  /** 詳細へ連続的に繋ぐために、写真と文字の位置を測れるようにする（Issue #202） */
  registerNode?: (part: 'image' | 'text', node: View | null) => void;
  /** 読み込んだ写真の実寸。飛ぶ先の大きさを決めるのに使う */
  onImageLoad?: (width: number, height: number) => void;
  /** 飛んでいる最中は隠す。出したままだと同じ御朱印が二重に見える */
  hidden?: boolean;
} & (
  | {
      variant: 'stamp';
      stampId: string;
      imageUrl: string;
      spotName: string;
      visitedAt: string;
    }
  | { variant: 'blank' }
);

export function GoshuinchoPage(props: GoshuinchoPageProps) {
  const { width, isCurrent, onPress, registerNode, onImageLoad, hidden } = props;
  const testID = props.variant === 'blank' ? 'flip-blank-page' : `flip-page-${props.stampId}`;

  return (
    <TouchableOpacity
      testID={testID}
      onPress={onPress}
      activeOpacity={0.9}
      style={[styles.page, { width }, !isCurrent && styles.peek]}
    >
      <View
        ref={node => {
          registerNode?.('image', node);
        }}
        testID={props.variant === 'blank' ? undefined : `flip-page-surface-${props.stampId}`}
        style={[styles.surface, { height: width * PAGE_ASPECT_RATIO }, hidden && styles.hidden]}
      >
        {props.variant === 'blank' ? (
          <View style={styles.blankSlot}>
            <MaterialIcons name="photo-camera" size={BLANK_ICON_SIZE} color={colors.gray[400]} />
            <Text style={styles.blankLabel}>ここに御朱印を追加する</Text>
          </View>
        ) : (
          <Image
            testID={`flip-page-image-${props.stampId}`}
            source={{ uri: props.imageUrl }}
            resizeMode="contain"
            onLoad={e => onImageLoad?.(e.nativeEvent.source.width, e.nativeEvent.source.height)}
            style={styles.image}
          />
        )}
      </View>

      {props.variant === 'stamp' && (
        <View
          ref={node => {
            registerNode?.('text', node);
          }}
          style={[styles.footer, hidden && styles.hidden]}
        >
          <Text
            testID={`flip-page-spot-name-${props.stampId}`}
            style={styles.spotName}
            numberOfLines={1}
          >
            {props.spotName}
          </Text>
          <PageDate stampId={props.stampId} visitedAt={props.visitedAt} />
        </View>
      )}
    </TouchableOpacity>
  );
}

function PageDate({ stampId, visitedAt }: { stampId: string; visitedAt: string }) {
  const formatted = formatJapaneseEraDate(visitedAt);
  if (!formatted) return null;

  return (
    <Text testID={`flip-page-date-${stampId}`} style={styles.date}>
      {formatted}
    </Text>
  );
}

const styles = StyleSheet.create({
  hidden: {
    opacity: 0,
  },
  page: {
    alignItems: 'center',
  },
  peek: {
    opacity: PEEK_OPACITY,
  },
  surface: {
    alignSelf: 'stretch',
    // ここは画面の地ではなく「紙」。地の色が変わっても白のまま
    backgroundColor: colors.white,
    borderColor: colors.gray[200],
    borderWidth: 1,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  blankSlot: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  blankLabel: {
    ...typography.bodySmall,
    color: colors.gray[400],
  },
  footer: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
    paddingHorizontal: spacing.xs,
  },
  spotName: {
    ...typography.bodySmall,
    color: colors.gray[800],
    flexShrink: 1,
  },
  date: {
    ...typography.caption,
    color: colors.gray[500],
    marginLeft: spacing.sm,
  },
});
