import React, { useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import { CheckmarkAnimation } from '@components/animated/CheckmarkAnimation';
import { BadgeAnimation } from '@components/animated/BadgeAnimation';
import { ConfettiEffect } from '@components/animated/ConfettiEffect';
import { PressableScale } from '@components/common/PressableScale';
import { colors } from '@theme/colors';
import { typography } from '@theme/typography';
import { spacing, borderRadius } from '@theme/spacing';
import type { RootStackScreenProps } from '@/navigation/types';

type Props = RootStackScreenProps<'RecordComplete'>;

/**
 * 記録を終えた人を、来た場所に返すための出口。
 *
 * 行き先はタブバーと同じアイコンで示す。文字だけだと、どのタブに飛ぶのかが
 * 読まないと分からない。
 */
const EXITS = {
  map: {
    label: '地図に戻る',
    icon: 'explore',
    target: { screen: 'MapTab', params: { screen: 'Map' } },
  },
  gallery: {
    label: '御朱印帳に戻る',
    icon: 'menu-book',
    target: { screen: 'GalleryTab', params: { screen: 'Gallery' } },
  },
} as const;

export function RecordCompleteScreen({ navigation, route }: Props) {
  const stampImageUrl = route.params?.stampImageUrl;
  const spotName = route.params?.spotName;
  const visitCount = route.params?.visitCount;
  const badge = route.params?.badge;
  const countUnavailable = route.params?.countUnavailable;
  const [imageError, setImageError] = useState(false);

  // 記録画面は地図と御朱印帳の両方から開ける。どちらから来たか分からない
  // ときは地図に返す（入口として多く、迷子になりにくい）
  const exit = EXITS[route.params?.origin ?? 'map'];

  const handleRecordAnother = () => {
    navigation.navigate('Record');
  };

  const handleExit = () => {
    navigation.navigate('MainTabs', exit.target);
  };

  return (
    <LinearGradient
      colors={[colors.primary[400], colors.primary[500]]}
      style={styles.gradient}
      testID="gradient-background"
    >
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <ConfettiEffect trigger={true} />

        <View style={styles.content}>
          <CheckmarkAnimation size={80} />

          <Text style={styles.title}>登録完了！</Text>

          {stampImageUrl && !imageError ? (
            <Image
              source={{ uri: stampImageUrl }}
              style={styles.stampImage}
              resizeMode="cover"
              testID="stamp-image"
              onError={() => setImageError(true)}
            />
          ) : (
            <View style={styles.imagePlaceholder} testID="stamp-image-placeholder">
              <MaterialIcons name="photo" size={48} color="rgba(255,255,255,0.5)" />
            </View>
          )}

          {spotName && (
            <Text style={styles.spotName} testID="spot-name">
              {spotName}
            </Text>
          )}

          <Text style={styles.countText} testID="visit-count">
            {visitCount ? `${visitCount}箇所目の御朱印！` : '御朱印を記録しました！'}
          </Text>

          {/* 記録は保存できている。黙って件数を消すと壊れていることに気づけないので
              理由だけを控えめに添える（Issue #133 / D-3） */}
          {countUnavailable && (
            <Text style={styles.countUnavailableText} testID="visit-count-unavailable">
              通信エラーのため記録数を表示できません
            </Text>
          )}

          {badge && <BadgeAnimation badge={badge} />}
        </View>

        {/* 続ける / 終わる の2択だけ置く。お祝いの場に選択肢を並べない */}
        <View style={styles.actions}>
          <PressableScale
            style={[styles.button, styles.buttonRecordAnother]}
            onPress={handleRecordAnother}
            accessibilityRole="button"
            testID="button-record-another"
          >
            <MaterialIcons name="add-a-photo" size={20} color={colors.white} />
            <Text style={styles.buttonRecordAnotherText}>もう1枚記録する</Text>
          </PressableScale>

          <PressableScale
            style={[styles.button, styles.buttonExit]}
            onPress={handleExit}
            accessibilityRole="button"
            testID="button-view-map"
          >
            <MaterialIcons name={exit.icon} size={20} color={colors.primary[500]} />
            <Text style={styles.buttonExitText}>{exit.label}</Text>
          </PressableScale>
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing['2xl'],
    gap: spacing.xl,
  },
  title: {
    ...typography.h1,
    color: colors.white,
  },
  stampImage: {
    width: 160,
    height: 200,
    borderRadius: borderRadius.lg,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  imagePlaceholder: {
    width: 160,
    height: 200,
    borderRadius: borderRadius.lg,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  spotName: {
    ...typography.h3,
    color: colors.white,
  },
  countText: {
    ...typography.h3,
    color: colors.white,
  },
  // お祝いの場なのでエラー画面には飛ばさず、注記として控えめに置く
  countUnavailableText: {
    ...typography.caption,
    color: colors.white,
    opacity: 0.7,
    textAlign: 'center',
  },
  actions: {
    paddingHorizontal: spacing['2xl'],
    paddingBottom: spacing['2xl'],
    gap: spacing.md,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.lg,
  },
  buttonRecordAnother: {
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  buttonRecordAnotherText: {
    ...typography.button,
    color: colors.white,
  },
  buttonExit: {
    backgroundColor: colors.white,
  },
  buttonExitText: {
    ...typography.button,
    color: colors.primary[500],
  },
});
