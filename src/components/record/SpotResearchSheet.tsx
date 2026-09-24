import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
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
  onClose: () => void;
  onChangeHint: (hint: SpotHint | null) => void;
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

function HintChip({
  hint,
  onChange,
}: {
  hint: SpotHint | null;
  onChange: (hint: SpotHint | null) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(formatHint(hint) ?? '');
  const label = formatHint(hint);

  if (editing) {
    return (
      <View style={styles.hintEdit}>
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder="例: 宮城県 大崎市（空なら全国）"
          placeholderTextColor={colors.gray[400]}
          style={styles.hintInput}
          autoFocus
          testID="hint-input"
        />
        <TouchableOpacity
          onPress={() => {
            setEditing(false);
            onChange(parseHintText(text));
          }}
          testID="hint-submit"
        >
          <Text style={styles.hintChange}>この手がかりで探す</Text>
        </TouchableOpacity>
      </View>
    );
  }
  return (
    <View style={styles.hint} testID="hint-chip">
      <MaterialIcons name="place" size={16} color={colors.gray[600]} />
      <Text style={styles.hintText}>{label ? `${label} のあたり` : '全国から探しています'}</Text>
      <TouchableOpacity onPress={() => setEditing(true)} testID="hint-change">
        <Text style={styles.hintChange}>変える</Text>
      </TouchableOpacity>
    </View>
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
 * 見つからない寺社を調べる下からのシート（Issue #248 の ②③）。
 * 「調べずに、地図で場所を決める」はどの状態でも押せる（④へ）
 */
export function SpotResearchSheet({
  state,
  userLocation,
  onClose,
  onChangeHint,
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
    case 'researching':
      body = (
        <>
          <Text style={styles.title}>{`「${state.name}」を調べています`}</Text>
          <Text style={styles.why}>公式サイトや地図の情報から、場所と住所を探しています。</Text>
          <HintChip hint={state.hint} onChange={onChangeHint} />
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
          <HintChip hint={state.hint} onChange={onChangeHint} />
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
  hintEdit: { gap: spacing.xs },
  hintInput: {
    ...typography.body,
    color: colors.gray[900],
    borderWidth: 1,
    borderColor: colors.gray[200],
    borderRadius: borderRadius.lg,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
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
