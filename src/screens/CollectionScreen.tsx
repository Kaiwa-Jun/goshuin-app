import { MaterialIcons } from '@expo/vector-icons';
import { useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  LayoutAnimation,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  UIManager,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@components/common/Button';
import { Card } from '@components/common/Card';
import { FrequentAreaSheet } from '@components/collection/FrequentAreaSheet';
import { JapanMap } from '@components/collection/JapanMap';
import { MouSukoshiCard } from '@components/collection/MouSukoshiCard';
import { RecentVisits } from '@components/collection/RecentVisits';
import { TsukimairiList } from '@components/collection/TsukimairiList';
import { useAuth } from '@hooks/useAuth';
import { useCollectionStats } from '@hooks/useCollectionStats';
import { Seal } from '@components/common/Seal';
import { distanceOf, getAllBadges, isEarned, nearestUnearned } from '@services/badges';
import { JAPAN_MAP_HEIGHT, JAPAN_MAP_WIDTH } from '@/constants/japanMap';
import { colors } from '@theme/colors';
import { shadows } from '@theme/shadows';
import { borderRadius, spacing } from '@theme/spacing';
import { typography } from '@theme/typography';
import type { CollectionStackScreenProps } from '@/navigation/types';
import type { MouSukoshiRow } from '@utils/mouSukoshi';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

type Props = CollectionStackScreenProps<'CollectionList'>;

export function CollectionScreen({ navigation }: Props) {
  const { isAuthenticated } = useAuth();
  const {
    stampCount,
    regionStats,
    recentStamps,
    badgeProgress,
    tsukimairi,
    pilgrimageProgress,
    mouSukoshi,
    isLoading,
  } = useCollectionStats();

  // 「もう少し」のエリアの行を押したときのシート
  const [openArea, setOpenArea] = useState<Extract<MouSukoshiRow, { kind: 'area' }> | null>(null);
  // 印の行を押したら印の欄へ。欄の位置は onLayout で覚えておく
  const scrollRef = useRef<ScrollView>(null);
  const sealY = useRef(0);

  const [showAllPilgrimages, setShowAllPilgrimages] = useState(false);
  /*
   * 寄りの計算に実寸が要る。onLayout を待つ間も地図を出したいので、
   * 画面幅から引いた見込みで描き始めて、測れたら差し替える
   */
  // 地図に指が乗っている間は縦スクロールを止める（JapanMap の onInteraction 参照）
  const [scrollEnabled, setScrollEnabled] = useState(true);
  // 塗り広がりに合わせて増やす。数字だけ最初から最終値だと噛み合わない
  const [paintedCount, setPaintedCount] = useState(0);
  const [mapWidth, setMapWidth] = useState(
    Dimensions.get('window').width - spacing.lg * 2 - MAP_CARD_PADDING * 2
  );

  const stampCountByPrefecture = useMemo(
    () => new Map(regionStats.map(stat => [stat.prefecture, stat.stampCount])),
    [regionStats]
  );

  const handlePilgrimageDetail = (pilgrimageId: string, pilgrimageName: string) => {
    navigation.navigate('PilgrimageDetail', { pilgrimageId, pilgrimageName });
  };

  const handlePressPrefecture = (prefecture: string) => {
    navigation.navigate('PrefectureDetail', { prefecture });
  };

  const handlePressTsukimairi = (spotId: string) => {
    navigation.getParent()?.navigate('MapTab', { screen: 'Map', params: { focusSpotId: spotId } });
  };

  const handlePressAreaSpot = (spotId: string) => {
    setOpenArea(null);
    handlePressTsukimairi(spotId);
  };

  const handlePressSeal = () => {
    scrollRef.current?.scrollTo({ y: Math.max(0, sealY.current - spacing.lg), animated: true });
  };

  const handleSeeAllStamps = () => {
    navigation.getParent()?.navigate('GalleryTab', { screen: 'Gallery' });
  };

  const badges = getAllBadges();
  const badgesWithStatus = badges.map(badge => ({
    ...badge,
    earned: isEarned(badge.condition, badgeProgress),
  }));
  const earnedCount = badgesWithStatus.filter(badge => badge.earned).length;

  /* 進捗は「いちばん近い1つ」にだけ出す。全部に出すと催促になる */
  const nearest = nearestUnearned(badgeProgress);
  const nearestDistance = nearest ? distanceOf(nearest.condition, badgeProgress) : null;
  const remaining = nearestDistance ? nearestDistance.target - nearestDistance.current : 0;
  const nearestUnit = nearestDistance?.unit ?? '';

  const topPilgrimage = pilgrimageProgress.length > 0 ? pilgrimageProgress[0] : null;
  const otherPilgrimages = pilgrimageProgress.slice(1);
  const progressPercent = topPilgrimage
    ? Math.round((topPilgrimage.visitedCount / topPilgrimage.totalSpots) * 100)
    : 0;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerText}>あゆみ</Text>
      </View>

      <ScrollView
        ref={scrollRef}
        testID="ayumi-scroll"
        scrollEnabled={scrollEnabled}
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Guest Card（未ログイン時のみ） */}
        {!isAuthenticated && (
          <View testID="collection-guest-empty-state">
            <Card style={styles.guestCard}>
              <MaterialIcons name="emoji-events" size={40} color={colors.primary[500]} />
              <Text style={styles.guestCardTitle}>記録するとここに集計されます</Text>
              <Text style={styles.guestCardDescription}>
                訪れた寺社の数・都道府県の埋まり方・巡礼の進捗・印が自動でたまります
              </Text>
              <Button
                title="ログインして始める"
                variant="primary"
                testID="collection-login-cta"
                onPress={() => navigation.navigate('Login')}
                style={styles.guestCardCta}
              />
            </Card>
          </View>
        )}

        {isAuthenticated && (
          <>
            {/* 暮らしの中で踏み出せる一歩だけ（Issue #245）。行が無ければ出さない */}
            <MouSukoshiCard
              rows={mouSukoshi}
              onPressPilgrimage={handlePilgrimageDetail}
              onPressSpot={handlePressTsukimairi}
              onPressSeal={handlePressSeal}
              onPressArea={setOpenArea}
            />

            <View style={styles.mapCard} testID="ayumi-map-card">
              <View style={styles.mapHeader}>
                {isLoading ? (
                  <ActivityIndicator testID="ayumi-map-loading" color={colors.primary[500]} />
                ) : (
                  <View style={styles.mapHeaderLeft}>
                    <Text style={styles.mapBigNumber}>{paintedCount}</Text>
                    <Text style={styles.mapOf}>/ 47 都道府県</Text>
                  </View>
                )}
                <View style={styles.mapHeaderRight}>
                  <Text style={styles.mapStampNumber}>{stampCount}</Text>
                  <Text style={styles.mapStampUnit}>枚</Text>
                </View>
              </View>

              {/* 寄りの計算に実寸が要る。端末幅を決め打ちにしない */}
              <View style={styles.mapBody} onLayout={e => setMapWidth(e.nativeEvent.layout.width)}>
                <JapanMap
                  stampCountByPrefecture={stampCountByPrefecture}
                  onPressPrefecture={handlePressPrefecture}
                  animate={!isLoading}
                  width={mapWidth}
                  onInteraction={active => setScrollEnabled(!active)}
                  onRevealed={setPaintedCount}
                />
              </View>

              <View style={styles.legend}>
                <LegendItem
                  color={colors.prefectureFill.empty}
                  text={`まだ ${47 - paintedCount}`}
                />
                <LegendItem color={colors.prefectureFill.tier1} text="1〜2枚" />
                <LegendItem color={colors.prefectureFill.tier2} text="3〜5枚" />
                <LegendItem color={colors.prefectureFill.tier3} text="6枚〜" />
              </View>
            </View>

            <RecentVisits stamps={recentStamps} onSeeAll={handleSeeAllStamps} />
            <TsukimairiList entries={tsukimairi} onPressSpot={handlePressTsukimairi} />
          </>
        )}

        {/* 印 */}
        {/* 「もう少し」の印の行から、ここへスクロールする */}
        <View
          testID="seal-card"
          onLayout={e => {
            sealY.current = e.nativeEvent.layout.y;
          }}
        >
          <Card style={styles.sealCard}>
            <View style={styles.sealHeader}>
              <Text style={styles.sealTitle}>印</Text>
              <Text style={styles.sealCount} testID="seal-count">
                {earnedCount} / {badges.length}
              </Text>
            </View>
            {/* 軸で分ける。訪問数だけだと物語が1本しかない（提案③） */}
            {BADGE_AXES.map(axis => {
              const inAxis = badgesWithStatus.filter(badge => badge.axis === axis.key);
              if (inAxis.length === 0) return null;
              return (
                <View key={axis.key} style={styles.axis} testID={`badge-axis-${axis.key}`}>
                  <Text style={styles.axisTitle}>{axis.label}</Text>
                  {/*
                   * 横スクロール3本をやめて3列に並べる。スクロールの先にあると
                   * 見えていないのと同じで、9個しかないのに存在に気づけなかった
                   */}
                  <View style={styles.sealGrid}>
                    {inAxis.map(badge => (
                      <View
                        key={badge.id}
                        style={styles.sealItem}
                        testID={`badge-${badge.id}`}
                        accessible
                        /* 押されているかを色だけの違いにしない */
                        accessibilityLabel={`${badge.name}、${badge.earned ? '獲得済み' : 'まだ'}`}
                      >
                        {/* 未獲得を鍵で塞がない。同じ印を、まだ押されていない色で出す */}
                        <Seal mark={badge.mark} earned={badge.earned} size={SEAL_SIZE} />
                        <Text style={[styles.sealName, !badge.earned && styles.sealNameOff]}>
                          {badge.name}
                        </Text>
                        {badge.id === nearest?.id && (
                          <Text style={styles.sealRemaining} testID={`badge-remaining-${badge.id}`}>
                            あと{remaining}
                            {nearestUnit}
                          </Text>
                        )}
                      </View>
                    ))}
                  </View>
                </View>
              );
            })}
          </Card>
        </View>

        {/* Pilgrimage Challenge Section */}
        <Text style={styles.sectionTitle}>巡礼チャレンジ</Text>
        {topPilgrimage === null ? (
          <Card style={styles.pilgrimageEmptyCard}>
            <MaterialIcons name="explore" size={40} color={colors.gray[300]} />
            <Text style={styles.pilgrimageEmptyText}>巡礼チャレンジに挑戦してみましょう</Text>
          </Card>
        ) : (
          <>
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => handlePilgrimageDetail(topPilgrimage.id, topPilgrimage.name)}
            >
              <Card style={styles.pilgrimageCard}>
                <View style={styles.pilgrimageHeader}>
                  <Text style={styles.pilgrimageGoalLabel}>現在の目標</Text>
                  <View style={styles.pilgrimageBadge}>
                    <Text style={styles.pilgrimageBadgeText}>
                      {topPilgrimage.visitedCount > 0 ? '進行中' : '未着手'}
                    </Text>
                  </View>
                </View>
                <Text style={styles.pilgrimageName}>{topPilgrimage.name}</Text>
                <View style={styles.pilgrimageStatsRow}>
                  <Text style={styles.pilgrimagePercent}>{progressPercent}%</Text>
                  <Text style={styles.pilgrimageCount}>
                    {topPilgrimage.visitedCount}/{topPilgrimage.totalSpots}
                  </Text>
                </View>
                <View style={styles.progressBarBg}>
                  <View style={[styles.progressBarFill, { width: `${progressPercent}%` }]} />
                </View>
              </Card>
            </TouchableOpacity>

            {otherPilgrimages.length > 0 && (
              <TouchableOpacity
                onPress={() => {
                  // 地域別ブロックの開閉と同じ作法に揃える（監査 A-11）
                  LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                  setShowAllPilgrimages(!showAllPilgrimages);
                }}
                style={styles.toggleButton}
              >
                <Text style={styles.toggleText}>
                  {showAllPilgrimages ? '閉じる' : `他の巡礼を見る (${otherPilgrimages.length})`}
                </Text>
                <MaterialIcons
                  name={showAllPilgrimages ? 'keyboard-arrow-up' : 'keyboard-arrow-down'}
                  size={20}
                  color={colors.gray[500]}
                />
              </TouchableOpacity>
            )}

            {showAllPilgrimages &&
              otherPilgrimages.map(p => {
                const percent = Math.round((p.visitedCount / p.totalSpots) * 100);
                return (
                  <TouchableOpacity
                    key={p.id}
                    onPress={() => handlePilgrimageDetail(p.id, p.name)}
                    activeOpacity={0.8}
                  >
                    <Card style={styles.pilgrimageCompactCard}>
                      <Text style={styles.pilgrimageCompactName}>{p.name}</Text>
                      <View style={styles.progressBarBg}>
                        <View style={[styles.progressBarFill, { width: `${percent}%` }]} />
                      </View>
                      <Text style={styles.pilgrimageCompactCount}>
                        {p.visitedCount}/{p.totalSpots}
                      </Text>
                    </Card>
                  </TouchableOpacity>
                );
              })}
          </>
        )}
      </ScrollView>

      <FrequentAreaSheet
        area={openArea}
        visible={openArea !== null}
        onClose={() => setOpenArea(null)}
        onPressSpot={handlePressAreaSpot}
      />
    </SafeAreaView>
  );
}

const MAP_CARD_PADDING = 14;

/** バッジの軸。性質で分ける */
const BADGE_AXES = [
  { key: 'practice', label: '作法' },
  { key: 'journey', label: '旅のしかた' },
  { key: 'count', label: '訪問数' },
] as const;

/** 印の大きさ。3列に並べたときに、12個の丸の環が潰れない下限 */
const SEAL_SIZE = 58;

function LegendItem({ color, text }: { color: string; text: string }) {
  return (
    <View style={styles.legendItem}>
      <View
        style={[styles.legendSwatch, { backgroundColor: color }]}
        testID="ayumi-legend-swatch"
      />
      <Text style={styles.legendText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  mapCard: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.xl,
    padding: MAP_CARD_PADDING,
    marginBottom: spacing.md,
    ...shadows.md,
  },
  mapHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    minHeight: 34,
  },
  mapHeaderLeft: { flexDirection: 'row', alignItems: 'baseline' },
  mapBigNumber: { fontSize: 34, fontWeight: '900', color: colors.gray[900], lineHeight: 36 },
  mapOf: { fontSize: 13, color: colors.gray[400], marginLeft: spacing.xs },
  mapHeaderRight: { flexDirection: 'row', alignItems: 'baseline' },
  mapStampNumber: { fontSize: 20, fontWeight: '900', color: colors.gray[900] },
  mapStampUnit: { fontSize: 13, color: colors.gray[600], marginLeft: 2 },
  // viewBox と同じ縦横比で場所を取る。中身の高さで画面が跳ねないように
  mapBody: { aspectRatio: JAPAN_MAP_WIDTH / JAPAN_MAP_HEIGHT, marginTop: spacing.sm },

  legend: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.md,
    paddingTop: 11,
    borderTopWidth: 1,
    borderTopColor: colors.gray[200],
  },
  axisTitle: {
    ...typography.caption,
    fontWeight: '700',
    color: colors.gray[400],
    letterSpacing: 0.6,
    marginBottom: spacing.sm,
  },
  legendItem: { flexDirection: 'row', alignItems: 'center' },
  legendSwatch: { width: 9, height: 9, borderRadius: 2, marginRight: spacing.xs },
  legendText: { ...typography.caption, fontSize: 11, color: colors.gray[600] },
  container: {
    flex: 1,
    backgroundColor: colors.backgroundGrouped,
  },
  header: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  headerText: {
    ...typography.h2,
    color: colors.gray[900],
    fontWeight: 'bold',
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: spacing.lg,
    paddingBottom: spacing['4xl'],
  },
  guestCard: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  guestCardTitle: {
    ...typography.h3,
    color: colors.gray[800],
    marginTop: spacing.md,
    textAlign: 'center',
  },
  guestCardDescription: {
    ...typography.bodySmall,
    color: colors.gray[500],
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  guestCardCta: {
    marginTop: spacing.lg,
    alignSelf: 'stretch',
  },
  sectionTitle: {
    ...typography.h3,
    color: colors.gray[800],
    marginBottom: spacing.md,
  },
  sealCard: {
    marginBottom: spacing.xl,
  },
  sealHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  sealTitle: { ...typography.h3, color: colors.gray[800] },
  sealCount: { ...typography.caption, color: colors.gray[400] },
  axis: { marginBottom: spacing.lg },
  /* 3列。9個ぜんぶが1画面に入る */
  sealGrid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: spacing.lg },
  sealItem: { width: '33.33%', alignItems: 'center' },
  sealName: {
    ...typography.caption,
    fontSize: 11,
    fontWeight: '700',
    color: colors.gray[600],
    marginTop: spacing.xs,
    textAlign: 'center',
  },
  sealNameOff: { fontWeight: '400', color: colors.gray[400] },
  sealRemaining: { fontSize: 10, fontWeight: '700', color: colors.seal, marginTop: 1 },
  pilgrimageCard: {
    marginBottom: spacing.sm,
  },
  pilgrimageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  pilgrimageGoalLabel: {
    ...typography.caption,
    color: colors.gray[500],
  },
  pilgrimageBadge: {
    backgroundColor: colors.primary[100],
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  pilgrimageBadgeText: {
    ...typography.caption,
    color: colors.primary[600],
  },
  pilgrimageName: {
    ...typography.h3,
    color: colors.gray[800],
    marginBottom: spacing.sm,
  },
  pilgrimageStatsRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  pilgrimagePercent: {
    ...typography.h2,
    color: colors.primary[500],
  },
  pilgrimageCount: {
    ...typography.bodySmall,
    color: colors.gray[500],
  },
  progressBarBg: {
    height: 8,
    backgroundColor: colors.primary[100],
    borderRadius: borderRadius.full,
    overflow: 'hidden',
    marginBottom: spacing.sm,
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: colors.primary[500],
    borderRadius: borderRadius.full,
  },
  toggleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  toggleText: {
    ...typography.bodySmall,
    color: colors.gray[500],
  },
  pilgrimageCompactCard: {
    marginBottom: spacing.sm,
  },
  pilgrimageCompactName: {
    ...typography.body,
    color: colors.gray[800],
    marginBottom: spacing.sm,
  },
  pilgrimageCompactCount: {
    ...typography.caption,
    color: colors.gray[500],
    textAlign: 'right',
  },
  pilgrimageEmptyCard: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
    marginBottom: spacing.xl,
    gap: spacing.sm,
  },
  pilgrimageEmptyText: {
    ...typography.bodySmall,
    color: colors.gray[400],
    textAlign: 'center',
  },
});
