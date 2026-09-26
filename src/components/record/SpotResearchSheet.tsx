import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Camera, Map } from '@maplibre/maplibre-react-native';

import { Badge } from '@components/common/Badge';
import { Button } from '@components/common/Button';
import { Modal } from '@components/common/Modal';
import { MAP_STYLE } from '@components/map/mapStyle';
import type { SpotAddState } from '@hooks/useSpotAdd';
import type { SpotResearchCandidate } from '@/types/supabase';
import { calculateDistance } from '@utils/geo';
import { formatHint, parseHintText, type SpotHint } from '@utils/spotHint';
import { colors } from '@theme/colors';
import { typography } from '@theme/typography';
import { spacing, borderRadius } from '@theme/spacing';

/** 「名前で探す」「住所を確かめる」「地図の場所を出す」を進める間隔。3行目は応答が来るまで終えない */
const STEP_MS = 3000;
const STEPS = ['名前で探す', '住所を確かめる', '地図の場所を出す'];
const MINI_MAP_ZOOM = 15;

interface Props {
  state: SpotAddState;
  /** 端末の位置。**位置情報が許可されているときだけ**渡す（距離を端末上で出す） */
  userLocation: { latitude: number; longitude: number } | null;
  /** 自分の記録にある県（新しい順・最大3）。取得中・記録が無いときは [] */
  recentPrefectures: string[];
  onClose: () => void;
  /** 地域を選んだ（県・全国から＝null・ほかの地域）。選んだ瞬間に調べ始める */
  onPick: (hint: SpotHint | null) => void;
  onRetry: () => void;
  onChoose: (index: number) => void;
  onOpenManual: () => void;
}

function Steps() {
  const [done, setDone] = useState(0);
  useEffect(() => {
    const timers = [1, 2].map(n => setTimeout(() => setDone(n), n * STEP_MS));
    return () => timers.forEach(clearTimeout);
  }, []);
  return (
    <View style={styles.steps}>
      {STEPS.map((label, i) => (
        <Text key={label} style={[styles.step, i < done && styles.stepDone]}>
          {`${i < done ? '✓' : i === done ? '…' : '　'} ${label}`}
        </Text>
      ))}
    </View>
  );
}

/** 地域の行（Issue #277）。調べている間は表示だけ（調べものを重ねない） */
function HintLine({
  hint,
  done,
  style,
}: {
  hint: SpotHint | null;
  done: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const label = formatHint(hint);
  const verb = done ? '探しました' : '探しています';
  return (
    <View style={[styles.hint, style]} testID="hint-line">
      <MaterialIcons name="place" size={16} color={colors.gray[600]} />
      <Text style={styles.hintText}>{label ? `${label} で${verb}` : `全国から${verb}`}</Text>
    </View>
  );
}

function RegionChip({
  label,
  all = false,
  onPress,
  testID,
}: {
  label: string;
  all?: boolean;
  onPress: () => void;
  testID: string;
}) {
  return (
    <TouchableOpacity
      style={[styles.chip, all && styles.chipAll]}
      onPress={onPress}
      activeOpacity={0.7}
      testID={testID}
    >
      <MaterialIcons name={all ? 'public' : 'place'} size={16} color={colors.gray[500]} />
      <Text style={styles.chipText}>{label}</Text>
    </TouchableOpacity>
  );
}

/**
 * ⓪ 地域を聞く（Issue #277）。まだ調べない。県のチップ・「全国から」・「この地域で調べる」を
 * 押した瞬間に onPick で調べ始める。入力の途中は、この画面を離れると捨てる
 */
function RegionAsk({
  name,
  recentPrefectures,
  onPick,
  children,
}: {
  name: string;
  recentPrefectures: string[];
  onPick: (hint: SpotHint | null) => void;
  children: React.ReactNode;
}) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState('');
  const submit = () => onPick(parseHintText(text));

  return (
    <>
      <Text style={styles.title}>{`「${name}」を調べます`}</Text>
      <Text style={styles.why}>どのあたりの寺社ですか？ 選ぶとすぐ調べ始めます。</Text>
      {recentPrefectures.length > 0 && <Text style={styles.regionCaption}>あなたの記録から</Text>}
      <View style={styles.chips}>
        {recentPrefectures.map((prefecture, i) => (
          <RegionChip
            key={prefecture}
            label={prefecture}
            onPress={() => onPick({ prefecture, city: null })}
            testID={`region-recent-${i}`}
          />
        ))}
        <RegionChip label="全国から" all onPress={() => onPick(null)} testID="region-all" />
      </View>
      {editing ? (
        <View style={styles.regionEdit}>
          <TextInput
            value={text}
            onChangeText={setText}
            onSubmitEditing={submit}
            placeholder="例: 宮城県 仙台市"
            placeholderTextColor={colors.gray[400]}
            returnKeyType="search"
            style={styles.hintInput}
            autoFocus
            testID="region-input"
          />
          <Button
            title="この地域で調べる"
            onPress={submit}
            variant="outline"
            testID="region-submit"
          />
        </View>
      ) : (
        <TouchableOpacity
          onPress={() => setEditing(true)}
          style={styles.regionOther}
          testID="region-other"
        >
          <Text style={styles.hintChange}>ほかの地域を入れる</Text>
        </TouchableOpacity>
      )}
      <View style={styles.gap} />
      {children}
    </>
  );
}

function CandidateCard({
  candidate,
  selected,
  distanceKm,
  onPress,
}: {
  candidate: SpotResearchCandidate;
  selected: boolean;
  distanceKm: number | null;
  onPress: () => void;
}) {
  const labels = candidate.sourceLabels.join('・');
  return (
    <TouchableOpacity
      style={[styles.card, selected && styles.cardSelected]}
      onPress={onPress}
      activeOpacity={0.8}
      testID={`candidate-${candidate.index}`}
    >
      <View style={styles.cardTop}>
        <Text style={styles.cardName} numberOfLines={1}>
          {candidate.name}
        </Text>
        <Badge type={candidate.type} />
        {distanceKm !== null && (
          <Text style={styles.cardKm} testID={`candidate-${candidate.index}-km`}>
            {`${distanceKm.toFixed(1)}km`}
          </Text>
        )}
      </View>
      <Text style={styles.cardAddress}>{candidate.address}</Text>
      {selected && (
        <View style={styles.miniMap} pointerEvents="none">
          <Map
            style={StyleSheet.absoluteFill}
            mapStyle={MAP_STYLE}
            dragPan={false}
            touchZoom={false}
            logo={false}
            compass={false}
            testID={`candidate-${candidate.index}-map`}
          >
            <Camera
              initialViewState={{ center: [candidate.lng, candidate.lat], zoom: MINI_MAP_ZOOM }}
            />
          </Map>
          <View style={styles.miniPin}>
            <MaterialIcons
              name="place"
              size={30}
              color={
                candidate.type === 'temple' ? colors.pin.templeVisited : colors.pin.shrineVisited
              }
            />
          </View>
        </View>
      )}
      <Text style={styles.cardSource}>
        {`住所の情報源 ${candidate.sourceCount}件${labels ? `（${labels} ほか）` : ''}`}
      </Text>
    </TouchableOpacity>
  );
}

/**
 * 見つからない寺社を調べる下からのシート（Issue #248 の ②③。⓪ 地域を聞くは Issue #277）。
 * 「調べずに、地図で場所を決める」はどの状態でも押せる（④へ）
 */
export function SpotResearchSheet({
  state,
  userLocation,
  recentPrefectures,
  onClose,
  onPick,
  onRetry,
  onChoose,
  onOpenManual,
}: Props) {
  const [selected, setSelected] = useState(0);
  const [showOthers, setShowOthers] = useState(false);
  const visible = state.status !== 'idle' && !state.placing;
  const saving = state.status === 'saving';

  useEffect(() => {
    setSelected(0);
    setShowOthers(false);
  }, [state.researchId]);

  const distanceOf = (c: SpotResearchCandidate) =>
    userLocation
      ? calculateDistance(userLocation.latitude, userLocation.longitude, c.lat, c.lng)
      : null;

  const manualButton = (title: string, variant: 'primary' | 'outline') => (
    <Button
      title={title}
      onPress={onOpenManual}
      variant={variant}
      disabled={saving}
      testID="research-open-manual"
    />
  );

  let body: React.ReactNode = null;
  switch (state.status) {
    case 'asking':
      body = (
        <RegionAsk name={state.name} recentPrefectures={recentPrefectures} onPick={onPick}>
          {manualButton('調べずに、地図で場所を決める', 'outline')}
        </RegionAsk>
      );
      break;
    case 'researching':
      body = (
        <>
          <Text style={styles.title}>{`「${state.name}」を調べています`}</Text>
          <Text style={styles.why}>公式サイトや地図の情報から、場所と住所を探しています。</Text>
          <HintLine hint={state.hint} done={false} />
          <View style={styles.skeleton}>
            <ActivityIndicator color={colors.gray[400]} />
          </View>
          <Steps />
          {manualButton('調べずに、地図で場所を決める', 'outline')}
        </>
      );
      break;
    case 'notFound':
      body = (
        <>
          <Text style={styles.title}>見つかりませんでした</Text>
          <HintLine hint={state.hint} done style={styles.hintBelowTitle} />
          <View style={styles.gap} />
          {manualButton('地図で場所を決める', 'primary')}
        </>
      );
      break;
    case 'error':
      body = (
        <>
          <Text style={styles.title}>調べられませんでした。通信を確かめてください</Text>
          <View style={styles.gap} />
          <Button title="もう一度調べる" onPress={onRetry} testID="research-retry" />
          <View style={styles.gapSmall} />
          {manualButton('地図で場所を決める', 'outline')}
        </>
      );
      break;
    case 'limit':
      body = (
        <>
          <Text style={styles.title}>今日調べられる回数（10回）を使い切りました</Text>
          <View style={styles.gap} />
          {manualButton('地図で場所を決める', 'primary')}
        </>
      );
      break;
    case 'candidates':
    case 'saving': {
      const [first, ...rest] = state.candidates;
      const shown = showOthers
        ? state.candidates
        : state.candidates.filter(c => c.index === selected);
      body = (
        <>
          <Text style={styles.title}>これですか？</Text>
          <Text style={styles.why}>
            見つかった寺社です。行った場所と合っていれば、そのまま記録に使えます。
          </Text>
          <HintLine hint={state.hint} done style={styles.hintAboveCards} />
          {(shown.length > 0 ? shown : [first]).map(c => (
            <CandidateCard
              key={c.index}
              candidate={c}
              selected={c.index === selected}
              distanceKm={distanceOf(c)}
              onPress={() => setSelected(c.index)}
            />
          ))}
          {rest.length > 0 && !showOthers && (
            <TouchableOpacity onPress={() => setShowOthers(true)} testID="research-show-others">
              <Text style={styles.more}>{`ほかの候補を見る（${rest.length}件）`}</Text>
            </TouchableOpacity>
          )}
          {state.saveFailed && (
            <Text style={styles.saveError}>追加できませんでした。もう一度お試しください</Text>
          )}
          <View style={styles.gapSmall} />
          <Button
            title={saving ? '追加しています…' : 'ここです'}
            onPress={() => onChoose(selected)}
            disabled={saving}
            testID="research-choose"
          />
          <TouchableOpacity onPress={onOpenManual} disabled={saving} testID="research-none">
            <Text style={styles.none}>どれでもない（地図で決める）</Text>
          </TouchableOpacity>
          <Text style={styles.note}>確かめられたら、みんなの地図にも載ります</Text>
        </>
      );
      break;
    }
  }

  return (
    <Modal visible={visible} onClose={saving ? () => {} : onClose} variant="bottom">
      <View testID="spot-research-sheet">{body}</View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  title: { ...typography.h3, color: colors.gray[900] },
  why: {
    ...typography.bodySmall,
    color: colors.gray[600],
    marginTop: spacing.xs,
    marginBottom: spacing.md,
  },
  hint: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: spacing.xs,
    backgroundColor: colors.gray[100],
    borderRadius: borderRadius.full,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
  },
  hintText: { ...typography.bodySmall, fontWeight: '600', color: colors.gray[800] },
  hintChange: { ...typography.caption, fontWeight: '700', color: colors.primary[600] },
  hintBelowTitle: { marginTop: spacing.sm },
  hintAboveCards: { marginBottom: spacing.sm },
  hintInput: {
    ...typography.body,
    color: colors.gray[900],
    borderWidth: 1,
    borderColor: colors.gray[200],
    borderRadius: borderRadius.lg,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  regionCaption: {
    ...typography.caption,
    fontWeight: '700',
    color: colors.gray[500],
    marginTop: spacing.xs,
    marginBottom: spacing.sm,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    borderWidth: 1,
    borderColor: colors.gray[200],
    backgroundColor: colors.white,
    borderRadius: borderRadius.full,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  chipAll: { backgroundColor: colors.gray[100], borderColor: colors.gray[100] },
  chipText: { ...typography.bodySmall, fontWeight: '600', color: colors.gray[800] },
  regionOther: { alignSelf: 'flex-start', marginTop: spacing.md },
  regionEdit: { marginTop: spacing.md, gap: spacing.sm },
  skeleton: {
    height: 120,
    marginTop: spacing.md,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.gray[200],
    alignItems: 'center',
    justifyContent: 'center',
  },
  steps: { marginTop: spacing.md, marginBottom: spacing.md },
  step: { ...typography.caption, color: colors.gray[400], lineHeight: 22 },
  stepDone: { color: colors.gray[600] },
  gap: { height: spacing.lg },
  gapSmall: { height: spacing.sm },
  card: {
    borderWidth: 1.5,
    borderColor: colors.gray[200],
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  cardSelected: { borderColor: colors.primary[500] },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  cardName: { ...typography.h3, color: colors.gray[900], flexShrink: 1 },
  cardKm: { ...typography.bodySmall, color: colors.gray[400], marginLeft: 'auto' },
  cardAddress: { ...typography.bodySmall, color: colors.gray[600], marginTop: spacing.xs },
  miniMap: {
    height: 120,
    marginTop: spacing.md,
    borderRadius: borderRadius.md,
    overflow: 'hidden',
    backgroundColor: colors.gray[100],
  },
  miniPin: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    // ピンの先を中心に合わせる（アイコンの高さの半分だけ上げる）
    paddingBottom: 30,
  },
  cardSource: { ...typography.caption, color: colors.gray[400], marginTop: spacing.sm },
  more: {
    ...typography.bodySmall,
    color: colors.gray[600],
    textAlign: 'center',
    marginVertical: spacing.sm,
  },
  none: {
    ...typography.bodySmall,
    fontWeight: '700',
    color: colors.gray[600],
    textAlign: 'center',
    marginTop: spacing.md,
  },
  note: {
    ...typography.caption,
    color: colors.gray[400],
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  saveError: {
    ...typography.caption,
    color: colors.error,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
});
