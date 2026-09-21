import { MaterialIcons } from '@expo/vector-icons';
import { useCallback, useState } from 'react';
import { Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import { ImageGalleryModal } from '@components/common/ImageGalleryModal';
import { JAPAN_PREFECTURE_BOXES, JAPAN_PREFECTURE_PATHS } from '@/constants/japanMap';
import { useAuth } from '@hooks/useAuth';
import { usePrefectureStamps } from '@hooks/usePrefectureStamps';
import { getStampImageUrl, getStampThumbUrl, getStampViewUrl } from '@services/stamps';
import { colors } from '@theme/colors';
import { borderRadius, spacing } from '@theme/spacing';
import { typography } from '@theme/typography';
import type { CollectionStackScreenProps } from '@/navigation/types';

type Props = CollectionStackScreenProps<'PrefectureDetail'>;

const SHAPE_SIZE = 74;
/** 県のまわりに取る余白。1.0 だと県が枠に触れる */
const SHAPE_MARGIN = 1.24;

/**
 * 県ひとつを正方形の枠に収める viewBox。
 *
 * **正方形にするのが要点**。枠は正方形なのに viewBox を県の縦横比にすると、
 * 比の食い違いの扱いが描画側の解釈任せになり、実機で県の左が切れた。
 * 比を揃えてしまえば、どう解釈されても同じ絵になる。
 */
export function squareViewBox(prefecture: string): string {
  const box = JAPAN_PREFECTURE_BOXES[prefecture];
  const side = Math.max(box.width, box.height) * SHAPE_MARGIN;
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;

  return `${cx - side / 2} ${cy - side / 2} ${side} ${side}`;
}

/**
 * 県ごとの御朱印。あゆみの地図で県をタップした先。
 *
 * ⚠️ **シートにしない。** 下から出るモーダルの中に全画面のビューアを入れ子にすると、
 * ビューアが画面ではなくシートを基準にレイアウトを組んで、ボタンが見切れる。
 * シートが伸びてヘッダーも押し出され、行き止まりになる（どちらも実機で出た）。
 * 画面にすれば、戻る導線も全画面ビューアも普通に動く。
 */
export function PrefectureDetailScreen({ navigation, route }: Props) {
  const { prefecture } = route.params;
  const { user } = useAuth();
  const { stamps, stat, isLoading } = usePrefectureStamps(user?.id ?? null, prefecture);
  const [galleryIndex, setGalleryIndex] = useState<number | null>(null);
  const [thumbMissing, setThumbMissing] = useState<Set<string>>(new Set());

  const markThumbMissing = useCallback((id: string) => {
    setThumbMissing(prev => (prev.has(id) ? prev : new Set(prev).add(id)));
  }, []);

  const handleSeeSpots = () => {
    navigation.getParent()?.navigate('MapTab', {
      screen: 'Map',
      params: { focusPrefecture: prefecture },
    });
  };

  const viewBox = squareViewBox(prefecture);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.navbar}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          testID="prefecture-back"
          accessibilityRole="button"
          accessibilityLabel="戻る"
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <MaterialIcons name="chevron-left" size={30} color={colors.primary[500]} />
        </TouchableOpacity>
        <Text style={styles.navTitle}>{prefecture}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <View style={styles.shape} testID="prefecture-shape">
            <Svg
              viewBox={viewBox}
              width={SHAPE_SIZE}
              height={SHAPE_SIZE}
              preserveAspectRatio="xMidYMid meet"
            >
              <Path
                d={JAPAN_PREFECTURE_PATHS[prefecture]}
                fill={colors.primary[500]}
                stroke={colors.white}
                strokeWidth={3}
              />
            </Svg>
          </View>
          <View style={styles.headerText}>
            <Text style={styles.count} testID="prefecture-count">
              {stat.stampCount > 0 ? `${stat.stampCount}枚` : 'まだ御朱印がありません'}
            </Text>
            {stat.stampCount > 0 && (
              <Text style={styles.sub} testID="prefecture-sub">
                {`${stat.visitedCount} / ${stat.totalCount}箇所`}
              </Text>
            )}
          </View>
        </View>

        {stat.stampCount > 0 ? (
          <View style={styles.grid}>
            {stamps.map((stamp, index) => (
              <TouchableOpacity
                key={stamp.id}
                testID={`prefecture-stamp-${stamp.id}`}
                style={styles.cell}
                onPress={() => setGalleryIndex(index)}
                accessibilityRole="imagebutton"
                accessibilityLabel={`${stamp.spots.name}の御朱印`}
              >
                <Image
                  source={{
                    uri: thumbMissing.has(stamp.id)
                      ? getStampImageUrl(stamp.image_path)
                      : getStampThumbUrl(stamp.image_path),
                  }}
                  style={styles.image}
                  resizeMode="cover"
                  // 小さい方がまだ焼かれていない。元の写真に落として表示は続ける
                  onError={() => markThumbMissing(stamp.id)}
                  testID={`prefecture-stamp-image-${stamp.id}`}
                />
              </TouchableOpacity>
            ))}
          </View>
        ) : (
          !isLoading && (
            <TouchableOpacity
              style={styles.seeSpots}
              onPress={handleSeeSpots}
              testID="prefecture-see-spots"
              accessibilityRole="button"
            >
              <MaterialIcons name="explore" size={18} color={colors.primary[500]} />
              <Text style={styles.seeSpotsText}>この県の寺社を見る</Text>
            </TouchableOpacity>
          )
        )}
      </ScrollView>

      <ImageGalleryModal
        visible={galleryIndex !== null}
        onClose={() => setGalleryIndex(null)}
        images={stamps.map(stamp => ({
          id: stamp.id,
          imageUrl: getStampViewUrl(stamp.image_path),
          fallbackUrl: getStampImageUrl(stamp.image_path),
          spotName: stamp.spots.name,
          memo: stamp.memo,
          visitedAt: stamp.visited_at,
        }))}
        initialIndex={galleryIndex ?? 0}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.backgroundGrouped },
  navbar: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 52,
    paddingHorizontal: spacing.sm,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray[200],
  },
  navTitle: { ...typography.h3, color: colors.gray[900], marginLeft: spacing.xs },
  content: { padding: spacing.lg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    marginBottom: spacing.lg,
  },
  // 横に並ぶ相方に押されて縮まないようにする
  shape: { width: SHAPE_SIZE, height: SHAPE_SIZE, flexShrink: 0, overflow: 'visible' },
  headerText: { flex: 1 },
  count: { fontSize: 26, fontWeight: '900', color: colors.gray[900] },
  sub: { ...typography.bodySmall, color: colors.gray[600], marginTop: 2 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  cell: { width: '31.5%', aspectRatio: 3 / 4 },
  image: { width: '100%', height: '100%', borderRadius: borderRadius.md },
  seeSpots: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: spacing.sm,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.gray[200],
    borderRadius: borderRadius.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
  },
  seeSpotsText: { ...typography.button, fontSize: 15, color: colors.primary[500] },
});
