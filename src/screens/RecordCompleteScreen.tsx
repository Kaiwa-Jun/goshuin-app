import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import { NewBadgeRow } from '@components/record/NewBadgeRow';
import { PressableScale } from '@components/common/PressableScale';
import { SaveMapReveal } from '@components/record/SaveMapReveal';
import { colors } from '@theme/colors';
import { typography } from '@theme/typography';
import { shadows } from '@theme/shadows';
import { spacing, borderRadius } from '@theme/spacing';
import { formatJapaneseEraDate } from '@utils/japaneseEra';
import type { RootStackScreenProps } from '@/navigation/types';

type Props = RootStackScreenProps<'RecordComplete'>;

const MAP_WIDTH = 210;
/** 枚数が1つ増えるまでの間 */
const COUNT_STEP_MS = 90;

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

/**
 * 保存した直後。感情のピークはここ。
 *
 * 以前はチェックマークと紙吹雪で祝っていたが、それは何のアプリでも出せる。
 * **このアプリにしか出せないのは、いま授かった御朱印そのものと、色づく県**なので、
 * その2つを主役にした（docs/design/2026-09-record-complete-spec.md）。
 */
export function RecordCompleteScreen({ navigation, route }: Props) {
  const stampImageUrl = route.params?.stampImageUrl;
  const stampCount = route.params?.stampCount ?? 1;
  const spotName = route.params?.spotName;
  const spotType = route.params?.spotType;
  const visitedAt = route.params?.visitedAt;
  const badges = route.params?.badges ?? [];
  const countUnavailable = route.params?.countUnavailable;
  const prefecture = route.params?.prefecture;
  const isFirstInPrefecture = route.params?.isFirstInPrefecture;
  const stampCountByPrefecture = route.params?.stampCountByPrefecture;
  const totalStampCount = route.params?.totalStampCount;
  const [imageError, setImageError] = useState(false);

  // 記録画面は地図と御朱印帳の両方から開ける。どちらから来たか分からない
  // ときは地図に返す（入口として多く、迷子になりにくい）
  const origin = route.params?.origin;
  const exit = EXITS[origin ?? 'map'];

  /*
   * navigate ではなく replace / popTo を使う。
   *
   * React Navigation v7 の navigate は、同じ名前の画面が履歴にあっても戻らず
   * push する（StackRouter の NAVIGATE は payload.pop のときだけ戻る）。
   * navigate のままだと「もう1枚」で記録画面が完了画面の上に積まれ、記録画面の
   * ✕ がここへ帰ってきてしまう（Issue #188）
   */
  const handleRecordAnother = () => {
    navigation.replace('Record', { origin });
  };

  const handleExit = () => {
    navigation.popTo('MainTabs', exit.target);
  };

  /*
   * 数字と地図は、取得に失敗したときは出さない。保存はできているので画面は
   * 出すが、嘘の数字を祝わない（Issue #133）
   */

  /*
   * 枚数は地図が色づくのに合わせて数え上がる。いきなり最後の数字が出ていると、
   * 「増えた」ではなく「そういう数字だった」に見える
   */
  const canShowMap = !countUnavailable && prefecture !== undefined && stampCountByPrefecture;

  const from = Math.max(0, (totalStampCount ?? 0) - stampCount);
  /*
   * 数え始めの値から出す。最終値を先に出すと、寄り終わった瞬間に戻って数え直す。
   * ただし**地図を出さないときは数え上げの合図が来ない**ので、最終値のまま出す
   */
  const [shownCount, setShownCount] = useState(canShowMap ? from : (totalStampCount ?? 0));
  const countTimers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const startCountUp = useCallback(() => {
    countTimers.current.forEach(clearTimeout);
    countTimers.current = [];
    if (totalStampCount === undefined || from >= totalStampCount) return;

    setShownCount(from);
    for (let n = from + 1; n <= totalStampCount; n += 1) {
      countTimers.current.push(setTimeout(() => setShownCount(n), (n - from) * COUNT_STEP_MS));
    }
  }, [from, totalStampCount]);

  useEffect(() => () => countTimers.current.forEach(clearTimeout), []);

  return (
    <LinearGradient
      colors={[colors.primary[400], colors.primary[500], colors.primary[700]]}
      style={styles.gradient}
      testID="gradient-background"
    >
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <View style={styles.card}>
          {/* 御朱印は主役。地から浮かせる（影は枠側に置く。Image に影は乗らない） */}
          <View style={styles.stampFrame} testID="stamp-frame">
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
                <MaterialIcons name="photo" size={44} color={colors.gray[300]} />
              </View>
            )}
          </View>

          {!countUnavailable && totalStampCount !== undefined && (
            <View style={styles.countRow} testID="stamp-total">
              <Text style={styles.countNumber}>{shownCount}</Text>
              <Text style={styles.countUnit}>枚目</Text>
            </View>
          )}

          {/* まとめて登録しても出せるのは先頭の1枚。残りがあることは枚数で示す */}
          {stampCount > 1 && (
            <Text style={styles.batch} testID="stamp-count">{`この日 ${stampCount}枚`}</Text>
          )}

          {/* 嘘の数字を祝わないのと同じ理由で、取れていないときは出さない */}
          {canShowMap && isFirstInPrefecture && (
            <View style={styles.newChip} testID="first-in-prefecture">
              <Text style={styles.newChipText}>{`🗾 ${prefecture}、はじめて`}</Text>
            </View>
          )}

          {canShowMap && (
            <SaveMapReveal
              prefecture={prefecture}
              stampCountByPrefecture={stampCountByPrefecture}
              addedCount={stampCount}
              spotType={spotType}
              width={MAP_WIDTH}
              onSettled={startCountUp}
            />
          )}

          {countUnavailable && (
            <Text style={styles.countUnavailableText} testID="visit-count-unavailable">
              通信エラーのため記録数を表示できません
            </Text>
          )}

          {spotName && (
            <View style={styles.spot}>
              <Text style={styles.spotName} testID="spot-name">
                {spotName}
              </Text>
              {/* DATE のまま渡す。new Date() を挟むと Issue #204 と同じ1日ずれを踏む */}
              {visitedAt && (
                <Text style={styles.visitedAt} testID="visited-at">
                  {formatJapaneseEraDate(visitedAt)}
                </Text>
              )}
            </View>
          )}

          <NewBadgeRow badges={badges} />
        </View>

        {/* 続ける / 終わる の2択だけ置く。お祝いの場に選択肢を並べない */}
        <View style={styles.actions}>
          <PressableScale
            style={[styles.button, styles.buttonRecordAnother]}
            onPress={handleRecordAnother}
            accessibilityRole="button"
            testID="button-record-another"
          >
            <MaterialIcons name="add-a-photo" size={20} color={colors.primary[700]} />
            <Text style={styles.buttonRecordAnotherText}>もう1枚記録する</Text>
          </PressableScale>

          <PressableScale
            style={[styles.button, styles.buttonExit]}
            onPress={handleExit}
            accessibilityRole="button"
            testID="button-exit"
          >
            <MaterialIcons name={exit.icon} size={20} color={colors.white} />
            <Text style={styles.buttonExitText}>{exit.label}</Text>
          </PressableScale>
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: { flex: 1 },
  container: { flex: 1 },
  card: {
    flex: 1,
    margin: spacing.lg,
    marginBottom: 0,
    backgroundColor: colors.white,
    borderRadius: borderRadius['3xl'],
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    padding: spacing['2xl'],
  },
  stampFrame: {
    width: 150,
    aspectRatio: 3 / 4,
    borderRadius: borderRadius.md,
    backgroundColor: colors.gray[100],
    ...shadows.lg,
  },
  stampImage: {
    width: '100%',
    height: '100%',
    borderRadius: borderRadius.md,
  },
  imagePlaceholder: {
    width: '100%',
    height: '100%',
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countRow: { flexDirection: 'row', alignItems: 'baseline' },
  countNumber: { fontSize: 36, fontWeight: '900', color: colors.gray[900] },
  countUnit: { ...typography.h3, color: colors.gray[900], marginLeft: 2 },
  batch: { ...typography.bodySmall, color: colors.gray[600] },
  newChip: {
    backgroundColor: 'rgba(220, 38, 38, 0.1)',
    borderRadius: borderRadius.full,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  newChipText: { ...typography.bodySmall, fontWeight: '700', color: colors.shrine[600] },
  countUnavailableText: { ...typography.caption, color: colors.gray[500], textAlign: 'center' },
  spot: { alignItems: 'center' },
  spotName: { ...typography.h3, color: colors.gray[900] },
  visitedAt: { ...typography.bodySmall, color: colors.gray[600], marginTop: 2 },
  actions: { padding: spacing.lg, gap: spacing.md },
  button: {
    height: 52,
    borderRadius: borderRadius.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  buttonRecordAnother: { backgroundColor: colors.white },
  buttonRecordAnotherText: { ...typography.button, color: colors.primary[700] },
  buttonExit: { borderWidth: 1.5, borderColor: 'rgba(255, 255, 255, 0.65)' },
  buttonExitText: { ...typography.button, color: colors.white },
});
