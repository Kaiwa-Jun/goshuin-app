import React, { useEffect, useMemo, useRef } from 'react';
import {
  Animated,
  Easing,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

import type { Spot } from '@/types/supabase';
import { calculateDistance } from '@utils/geo';
import { colors } from '@theme/colors';
import { typography } from '@theme/typography';
import { borderRadius, spacing } from '@theme/spacing';
import { shadows } from '@theme/shadows';

/** 一覧の高さの上限（画面の高さに対する割合）。中はスクロール */
const MAX_HEIGHT_RATIO = 0.4;
/** 下から出る動き。行き過ぎ・弾みなし */
const ENTER_MS = 300;

interface RegionSpotSheetProps {
  /** 寄せた地域の言葉（例「横浜」） */
  label: string;
  spots: Spot[];
  /** 今いる所。位置情報が許可されていなければ null（同じ rank は名前順） */
  origin: { latitude: number; longitude: number } | null;
  /** 「視差効果を減らす」。一覧が出る前から分かっている値を渡す（出てから読むと間に合わない） */
  reduceMotion: boolean;
  onSelectSpot: (spotId: string) => void;
  /** 一覧の高さ。地図をその高さのぶん下を空けて寄せる */
  onLayout?: (height: number) => void;
}

/** rank の高い順、同じなら今いる所から近い順（今いる所が無ければ名前順）。入力は並べ替えない */
export function sortRegionSpots(
  spots: Spot[],
  origin: { latitude: number; longitude: number } | null
): Spot[] {
  const distance = (s: Spot) =>
    origin ? calculateDistance(origin.latitude, origin.longitude, s.lat, s.lng) : 0;
  return [...spots].sort(
    (a, b) => b.rank - a.rank || distance(a) - distance(b) || a.name.localeCompare(b.name, 'ja')
  );
}

/**
 * 検索の場所の帯から寄せた地図の下に出す、その地域の寺社の一覧（Issue #311。S0 でオーナーが選んだ 3）。
 * 行を押すと寺社を選んだときと同じ（呼び出し側が SpotBottomSheet を出して一覧を閉じる）
 */
export function RegionSpotSheet({
  label,
  spots,
  origin,
  reduceMotion,
  onSelectSpot,
  onLayout,
}: RegionSpotSheetProps) {
  const { height: windowHeight } = useWindowDimensions();
  const maxHeight = windowHeight * MAX_HEIGHT_RATIO;
  const sorted = useMemo(() => sortRegionSpots(spots, origin), [spots, origin]);
  // 一覧の高さは maxHeight を超えないので、その分だけ下げておけば画面の外から出てくる
  const translateY = useRef(new Animated.Value(reduceMotion ? 0 : maxHeight)).current;

  useEffect(() => {
    if (reduceMotion) {
      translateY.setValue(0);
      return;
    }
    const enter = Animated.timing(translateY, {
      toValue: 0,
      duration: ENTER_MS,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });
    enter.start();
    return () => enter.stop();
  }, [reduceMotion, translateY]);

  return (
    <Animated.View
      testID="region-sheet"
      style={[styles.sheet, { maxHeight, transform: [{ translateY }] }]}
      onLayout={e => onLayout?.(e.nativeEvent.layout.height)}
    >
      <View style={styles.handle} />
      <Text style={styles.title}>{`${label}のあたりの寺社（${sorted.length}）`}</Text>
      <FlatList
        data={sorted}
        keyExtractor={spot => spot.id}
        style={styles.list}
        renderItem={({ item, index }) => {
          const isShrine = item.type === 'shrine';
          return (
            <Pressable
              testID={`region-spot-${index}`}
              onPress={() => onSelectSpot(item.id)}
              accessibilityRole="button"
              accessibilityLabel={item.name}
              style={styles.row}
            >
              <View style={[styles.icon, isShrine ? styles.iconShrine : styles.iconTemple]}>
                <MaterialIcons
                  name={isShrine ? 'temple-hindu' : 'temple-buddhist'}
                  size={20}
                  color={isShrine ? colors.shrine[600] : colors.temple[600]}
                />
              </View>
              <View style={styles.info}>
                <Text style={styles.name} numberOfLines={1}>
                  {item.name}
                </Text>
                <Text style={styles.address} numberOfLines={1}>
                  {item.address ?? ''}
                </Text>
              </View>
            </Pressable>
          );
        }}
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 5,
    paddingBottom: spacing.lg,
    backgroundColor: colors.white,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    ...shadows.lg,
  },
  // SpotBottomSheet のつまみと同じ形
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    marginVertical: spacing.sm,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.gray[300],
  },
  title: {
    ...typography.body,
    fontWeight: '600',
    color: colors.gray[800],
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
  },
  // maxHeight の中でスクロールさせる（伸ばさず、はみ出す分だけ縮める）
  list: {
    flexGrow: 0,
    flexShrink: 1,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  icon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconShrine: {
    backgroundColor: colors.shrine[100],
  },
  iconTemple: {
    backgroundColor: colors.temple[100],
  },
  info: {
    flex: 1,
  },
  name: {
    ...typography.body,
    color: colors.gray[800],
  },
  address: {
    ...typography.bodySmall,
    color: colors.gray[500],
  },
});
