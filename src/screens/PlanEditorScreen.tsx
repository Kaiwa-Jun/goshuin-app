import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Camera, Map } from '@maplibre/maplibre-react-native';
import type { CameraRef } from '@maplibre/maplibre-react-native';
import { MaterialIcons } from '@expo/vector-icons';

import { Badge } from '@components/common/Badge';
import { Button } from '@components/common/Button';
import { MAP_STYLE } from '@components/map/mapStyle';
import { SpotMapLayers } from '@components/map/SpotMapLayers';
import { PlanDrawer, DRAWER_LOW } from '@components/plan/PlanDrawer';
import { PlanChosenPins, PlanRouteLayers } from '@components/plan/PlanMapLayers';
import { PlanDateSheet, PlanSaveSheet } from '@components/plan/PlanSheets';
import { PlanSpotCard } from '@components/plan/PlanSpotCard';
import { PlanStopList } from '@components/plan/PlanStopList';
import { useLocation } from '@hooks/useLocation';
import { usePlanEditor, type PlanSpot } from '@hooks/usePlanEditor';
import { useReduceMotion } from '@hooks/useReduceMotion';
import { useSpots } from '@hooks/useSpots';
import { useUserStamps } from '@hooks/useUserStamps';
import { useWishlist } from '@hooks/useWishlist';
import type { PlanStackScreenProps } from '@/navigation/types';
import { VisitPlanDateTakenError, fetchVisitPlans } from '@services/visitPlans';
import { DEFAULT_LOCATION } from '@utils/geo';
import { toLocalDateString } from '@utils/localDate';
import { formatPlanDate } from '@utils/planDate';
import { buildPlanRouteSources } from '@utils/planRoute';
import { buildSpotSources, getSpotPinState, type SpotFeatureCollection } from '@utils/spotGeoJson';
import { countVisited } from '@utils/visitPlan';
import { colors } from '@theme/colors';
import { typography } from '@theme/typography';
import { spacing, borderRadius } from '@theme/spacing';
import type { Spot } from '@/types/supabase';

type Props = PlanStackScreenProps<'PlanEditor'>;

/** 番号ピンと点線を1区間ずつ足す間隔（D-12） */
export const REVEAL_STEP_MS = 200;
const INITIAL_ZOOM = 13;
const FIT_PADDING = 56;

/**
 * 予定を組む（Issue #258）。上が地図・下がドロワー。
 * build（② 寺社を選ぶ）→ order（③ 順番）→ 保存。保存済みを開くと readonly（③'）
 */
export function PlanEditorScreen({ navigation, route }: Props) {
  const { planId, date } = route.params ?? {};
  const today = useMemo(() => new Date(), []);
  const todayKey = toLocalDateString(today);
  const insets = useSafeAreaInsets();
  const { height: screenHeight } = useWindowDimensions();
  const reduceMotion = useReduceMotion();

  const { location } = useLocation();
  const { visitedSpotIds } = useUserStamps();
  const { wishlistSpotIds } = useWishlist();
  const { allSpots } = useSpots(location, 'all', visitedSpotIds, wishlistSpotIds);

  const editor = usePlanEditor({ planId, date, spots: allSpots, today });
  const { mode, points, chosen, spotIndex } = editor;

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showDate, setShowDate] = useState(false);
  const [showSave, setShowSave] = useState(false);
  const [saving, setSaving] = useState(false);
  const [drawerHeight, setDrawerHeight] = useState(screenHeight * DRAWER_LOW);
  const [revealed, setRevealed] = useState(Number.POSITIVE_INFINITY);
  const cameraRef = useRef<CameraRef>(null);

  // ── 件数が弾む（D-12） ──
  const bounce = useRef(new Animated.Value(1)).current;
  const prevCount = useRef(chosen.length);
  useEffect(() => {
    if (chosen.length > prevCount.current && !reduceMotion) {
      Animated.sequence([
        Animated.timing(bounce, { toValue: 1.2, duration: 100, useNativeDriver: true }),
        Animated.timing(bounce, { toValue: 1, duration: 100, useNativeDriver: true }),
      ]).start();
    }
    prevCount.current = chosen.length;
  }, [chosen.length, bounce, reduceMotion]);

  // ── 1番から順に描く（D-12）。「順番を決める」の直後だけ ──
  const revealTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const stopReveal = () => {
    if (revealTimer.current) clearInterval(revealTimer.current);
    revealTimer.current = null;
  };
  useEffect(() => stopReveal, []);

  const handleDecide = useCallback(async () => {
    setSelectedId(null);
    await editor.decide();
    stopReveal();
    if (reduceMotion) {
      setRevealed(Number.POSITIVE_INFINITY);
      return;
    }
    setRevealed(0);
    revealTimer.current = setInterval(() => {
      setRevealed(n => n + 1);
    }, REVEAL_STEP_MS);
  }, [editor, reduceMotion]);

  useEffect(() => {
    if (revealed >= points.length && revealTimer.current) stopReveal();
  }, [revealed, points.length]);

  const shown = Math.min(revealed, points.length);
  const routeSources = useMemo(() => buildPlanRouteSources(points, shown), [points, shown]);

  // ── カメラ: 順番・読むだけの表示では、予定の寺社が全部入るように寄せる（D-21） ──
  const setKey = points
    .map(p => p.spotId)
    .sort()
    .join(',');
  useEffect(() => {
    if (mode === 'build' || points.length === 0) return;
    const lngs = points.map(p => p.lng);
    const lats = points.map(p => p.lat);
    cameraRef.current?.fitBounds(
      [Math.min(...lngs), Math.min(...lats), Math.max(...lngs), Math.max(...lats)],
      {
        padding: {
          top: insets.top + FIT_PADDING,
          right: FIT_PADDING,
          bottom: drawerHeight + FIT_PADDING / 2,
          left: FIT_PADDING,
        },
        duration: reduceMotion ? 0 : 500,
      }
    );
    // 並べ替えのたびに寄せ直さない（寺社の組が変わったときと表示が変わったときだけ）
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, setKey]);

  // ── 地図のソース ──
  const { clustered, pinned } = useMemo(
    () => buildSpotSources({ spots: allSpots, visitedSpotIds, wishlistSpotIds }),
    [allSpots, visitedSpotIds, wishlistSpotIds]
  );
  const chosenSource = useMemo<SpotFeatureCollection>(
    () => ({
      type: 'FeatureCollection',
      features: chosen
        .map(id => spotIndex.get(id))
        .filter((s): s is PlanSpot => Boolean(s))
        .map(s => ({
          type: 'Feature' as const,
          properties: {
            spotId: s.id,
            name: s.name,
            rank: 5,
            state: getSpotPinState(s as Spot, visitedSpotIds, wishlistSpotIds),
          },
          geometry: { type: 'Point' as const, coordinates: [s.lng, s.lat] as [number, number] },
        })),
    }),
    [chosen, spotIndex, visitedSpotIds, wishlistSpotIds]
  );

  const wishlistRows = useMemo(
    () =>
      allSpots
        .filter(s => wishlistSpotIds.has(s.id) && !chosen.includes(s.id))
        .sort((a, b) => a.name.localeCompare(b.name, 'ja')),
    [allSpots, wishlistSpotIds, chosen]
  );

  const handlePressSpot = useCallback(
    (spotId: string) => {
      if (mode !== 'build') return;
      setSelectedId(spotId);
      if (!editor.reception.has(spotId)) editor.peekReception(spotId);
    },
    [mode, editor]
  );
  const handlePressCluster = useCallback((center: [number, number], zoom: number) => {
    cameraRef.current?.flyTo({ center, zoom, duration: 400 });
  }, []);

  // ── 保存・消す ──
  const handleSave = async (name: string) => {
    setSaving(true);
    try {
      const savedOn = await editor.save(name);
      setShowSave(false);
      navigation.navigate('PlanCalendar', { savedOn });
    } catch (e) {
      if (e instanceof VisitPlanDateTakenError) {
        // 先にある予定の名前はエラーに載らないので引き直す（取れなければ「予定」）
        const plans = await fetchVisitPlans().catch(() => []);
        const other = plans.find(p => p.plannedOn === editor.plannedOn);
        const taken = other ? `「${other.name}」` : '予定';
        Alert.alert(
          `${formatPlanDate(editor.plannedOn)}にはもう${taken}があります。別の日を選んでください`
        );
      } else {
        Alert.alert('保存できませんでした', '通信の状態を確かめて、もう一度お試しください');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    Alert.alert('この予定を消しますか？', undefined, [
      { text: 'やめる', style: 'cancel' },
      {
        text: '消す',
        style: 'destructive',
        onPress: () => {
          editor
            .deletePlan()
            .then(() => {
              setShowSave(false);
              navigation.navigate('PlanCalendar');
            })
            .catch(() => Alert.alert('消せませんでした', 'もう一度お試しください'));
        },
      },
    ]);
  };

  const goCalendar = () => navigation.navigate('PlanCalendar');
  // ③ の「‹」は「選び直す」と同じ。②と読むだけの表示はカレンダーへ（確認は出さない）
  const handleBack = () => {
    if (mode === 'order') editor.reselect();
    else goCalendar();
  };

  const handleEdit = () => {
    stopReveal();
    setRevealed(Number.POSITIVE_INFINITY);
    editor.edit();
  };

  const selected = selectedId ? spotIndex.get(selectedId) : undefined;
  const readonly = mode === 'readonly';
  const title = readonly ? (editor.plan?.name ?? '') : '予定を組む';
  const visitedCount = countVisited(
    points.map(p => p.spotId),
    editor.visited
  ).count;

  // ── ドロワーの中身 ──
  const header = (
    <View style={styles.drawerHeader}>
      {readonly ? (
        <Text style={styles.dateText} testID="plan-date-label">
          {editor.dateLabel}
        </Text>
      ) : (
        <TouchableOpacity onPress={() => setShowDate(true)} testID="plan-date-button">
          <Text style={styles.dateText}>{`${editor.dateLabel}の予定 ▾`}</Text>
        </TouchableOpacity>
      )}
      {mode === 'build' && (
        <View style={styles.countRow}>
          <Animated.Text
            style={[styles.count, { transform: [{ scale: bounce }] }]}
            testID="plan-count"
          >
            {chosen.length}
          </Animated.Text>
          <Text style={styles.headerHint}>社・ピンを押して足す</Text>
        </View>
      )}
      {mode === 'order' && <Text style={styles.headerHint}>⋮⋮ で並べ替え</Text>}
      {readonly && editor.past && (
        <Text style={styles.pastCount} testID="plan-past-count">
          {`${visitedCount} / ${points.length}社 回れた`}
        </Text>
      )}
    </View>
  );

  const buildBody = (
    <ScrollView contentContainerStyle={styles.scroll} testID="plan-build-list">
      {chosen.length === 0 ? (
        <Text style={styles.empty}>
          まだありません。地図のピンを押すか、下の「行きたい」から足してください。
        </Text>
      ) : (
        chosen.map(id => {
          const s = spotIndex.get(id);
          if (!s) return null;
          return (
            <View key={id} style={styles.row} testID={`plan-chosen-row-${id}`}>
              <Text style={styles.rowName} numberOfLines={1}>
                {s.name}
              </Text>
              <Badge type={s.type} />
              <TouchableOpacity
                onPress={() => editor.remove(id)}
                testID={`plan-chosen-remove-${id}`}
                accessibilityLabel={`${s.name}を外す`}
                hitSlop={8}
              >
                <MaterialIcons name="close" size={20} color={colors.gray[400]} />
              </TouchableOpacity>
            </View>
          );
        })
      )}
      {wishlistRows.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>行きたいから選ぶ</Text>
          {wishlistRows.map(s => (
            <View key={s.id} style={styles.row} testID={`plan-wish-${s.id}`}>
              <Text style={[styles.rowName, styles.wishName]} numberOfLines={1}>
                {s.name}
              </Text>
              <Badge type={s.type} />
              <TouchableOpacity
                onPress={() => editor.add(s.id)}
                testID={`plan-wish-add-${s.id}`}
                accessibilityLabel={`${s.name}を足す`}
                hitSlop={8}
              >
                <MaterialIcons name="add" size={22} color={colors.primary[500]} />
              </TouchableOpacity>
            </View>
          ))}
        </>
      )}
    </ScrollView>
  );

  const orderBody = (
    <ScrollView contentContainerStyle={styles.scroll} testID="plan-order-list">
      {mode === 'order' && editor.suggested && (
        <Text style={styles.banner} testID="plan-suggest-banner">
          ✦ 近い順・受付の早い順に並べました。つまんで変えられます
        </Text>
      )}
      <PlanStopList
        points={points}
        spots={spotIndex}
        reception={editor.reception}
        revealed={shown}
        readonly={readonly}
        past={editor.past}
        visited={editor.visited}
        onMove={editor.move}
      />
    </ScrollView>
  );

  const footer =
    mode === 'build' ? (
      <Button
        title="順番を決める"
        onPress={() => void handleDecide()}
        disabled={chosen.length < 2}
        testID="plan-decide"
        style={styles.flex}
      />
    ) : mode === 'order' ? (
      <>
        <Button
          title="選び直す"
          variant="outline"
          onPress={editor.reselect}
          testID="plan-reselect"
          style={styles.flex}
        />
        <Button
          title="この予定を保存"
          onPress={() => setShowSave(true)}
          testID="plan-save"
          style={styles.flex}
        />
      </>
    ) : (
      <>
        <Button
          title="編集"
          variant="outline"
          onPress={handleEdit}
          testID="plan-edit"
          style={styles.flex}
        />
        <Button
          title="カレンダーへ"
          onPress={goCalendar}
          testID="plan-to-calendar"
          style={styles.flex}
        />
      </>
    );

  const center: [number, number] = location
    ? [location.longitude, location.latitude]
    : [DEFAULT_LOCATION.longitude, DEFAULT_LOCATION.latitude];

  return (
    <View style={styles.container} testID="plan-editor">
      <Map style={styles.map} mapStyle={MAP_STYLE} logo={false} compass={false} testID="map-view">
        <Camera ref={cameraRef} initialViewState={{ center, zoom: INITIAL_ZOOM }} />
        <SpotMapLayers
          clustered={clustered}
          pinned={pinned}
          onPressSpot={handlePressSpot}
          onPressCluster={handlePressCluster}
          dimmed={mode !== 'build'}
        />
        {mode === 'build' ? (
          <PlanChosenPins data={chosenSource} />
        ) : (
          <PlanRouteLayers sources={routeSources} />
        )}
      </Map>

      <View style={[styles.topBar, { paddingTop: insets.top + spacing.xs }]}>
        <TouchableOpacity
          onPress={handleBack}
          style={styles.topButton}
          testID="plan-back"
          accessibilityLabel={mode === 'build' ? '閉じる' : '戻る'}
        >
          <MaterialIcons
            name={mode === 'build' ? 'close' : 'chevron-left'}
            size={26}
            color={colors.gray[700]}
          />
        </TouchableOpacity>
        <Text style={styles.title} numberOfLines={1} testID="plan-title">
          {title}
        </Text>
        <View style={styles.topButton} />
      </View>

      {mode === 'build' && selected && (
        <View style={[styles.cardWrap, { bottom: drawerHeight }]}>
          <PlanSpotCard
            spot={selected}
            close={editor.reception.get(selected.id) ?? null}
            isWishlisted={wishlistSpotIds.has(selected.id)}
            isVisited={visitedSpotIds.has(selected.id)}
            chosen={chosen.includes(selected.id)}
            reduceMotion={reduceMotion}
            flyDistance={drawerHeight * 0.4}
            onAdd={() => {
              editor.add(selected.id);
              setSelectedId(null);
            }}
            onRemove={() => {
              editor.remove(selected.id);
              setSelectedId(null);
            }}
          />
        </View>
      )}

      <PlanDrawer header={header} footer={footer} onHeightChange={setDrawerHeight}>
        {editor.isLoading ? (
          <ActivityIndicator style={styles.loading} color={colors.primary[500]} />
        ) : mode === 'build' ? (
          buildBody
        ) : (
          orderBody
        )}
      </PlanDrawer>

      <PlanDateSheet
        visible={showDate}
        plannedOn={editor.plannedOn || todayKey}
        today={todayKey}
        onDone={ymd => {
          editor.setPlannedOn(ymd);
          setShowDate(false);
        }}
        onClose={() => setShowDate(false)}
      />
      <PlanSaveSheet
        visible={showSave}
        plannedOn={editor.plannedOn || todayKey}
        initialName={editor.plan?.name ?? ''}
        canDelete={Boolean(editor.plan)}
        saving={saving}
        onSave={name => void handleSave(name)}
        onDelete={handleDelete}
        onClose={() => setShowSave(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  map: { flex: 1 },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingBottom: spacing.xs,
    backgroundColor: colors.white,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.gray[200],
  },
  topButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  title: { ...typography.h3, color: colors.gray[900], flex: 1, textAlign: 'center' },
  cardWrap: { position: 'absolute', left: 0, right: 0, height: 96 },
  drawerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
  },
  dateText: { ...typography.body, fontWeight: '800', color: colors.gray[900] },
  countRow: { flexDirection: 'row', alignItems: 'baseline' },
  count: { ...typography.h3, fontWeight: '800', color: colors.primary[500] },
  headerHint: { ...typography.caption, color: colors.gray[500] },
  pastCount: { ...typography.caption, fontWeight: '800', color: colors.primary[500] },
  scroll: { paddingHorizontal: spacing.md, paddingBottom: spacing.lg },
  empty: { ...typography.bodySmall, color: colors.gray[500], paddingVertical: spacing.md },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.gray[100],
  },
  rowName: { ...typography.body, color: colors.gray[900], flexShrink: 1 },
  wishName: { color: colors.pin.wishlisted },
  sectionTitle: {
    ...typography.caption,
    fontWeight: '800',
    color: colors.gray[500],
    marginTop: spacing.lg,
    marginBottom: spacing.xs,
  },
  banner: {
    ...typography.caption,
    color: colors.primary[600],
    backgroundColor: colors.primary[50],
    borderRadius: borderRadius.md,
    padding: spacing.sm,
    marginBottom: spacing.sm,
  },
  flex: { flex: 1 },
  loading: { marginTop: spacing.xl },
});
