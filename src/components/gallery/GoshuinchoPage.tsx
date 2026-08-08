import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { colors } from '@theme/colors';
import { typography } from '@theme/typography';
import { spacing, borderRadius } from '@theme/spacing';
import { formatJapaneseEraDate } from '@utils/japaneseEra';

/** 覗いている（中央ではない）ページの不透明度 */
export const PEEK_OPACITY = 0.45;

/** 高さ / 幅。縦長の帳面に見えるようにする */
export const PAGE_ASPECT_RATIO = 1.5;

const BLANK_ICON_SIZE = 32;

type GoshuinchoPageProps = {
  width: number;
  isCurrent: boolean;
  onPress: () => void;
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
  const { width, isCurrent, onPress } = props;
  const testID = props.variant === 'blank' ? 'flip-blank-page' : `flip-page-${props.stampId}`;

  return (
    <TouchableOpacity
      testID={testID}
      onPress={onPress}
      activeOpacity={0.9}
      style={[styles.page, { width }, !isCurrent && styles.peek]}
    >
      <View
        testID={props.variant === 'blank' ? undefined : `flip-page-surface-${props.stampId}`}
        style={[styles.surface, { height: width * PAGE_ASPECT_RATIO }]}
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
            style={styles.image}
          />
        )}
      </View>

      {props.variant === 'stamp' && (
        <View style={styles.footer}>
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
  page: {
    alignItems: 'center',
  },
  peek: {
    opacity: PEEK_OPACITY,
  },
  surface: {
    alignSelf: 'stretch',
    backgroundColor: colors.background,
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
