import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { Modal } from '@components/common/Modal';
import type { AreaSpot, MouSukoshiRow } from '@utils/mouSukoshi';
import { colors } from '@theme/colors';
import { borderRadius, spacing } from '@theme/spacing';
import { typography } from '@theme/typography';

type AreaRow = Extract<MouSukoshiRow, { kind: 'area' }>;

interface Props {
  area: AreaRow | null;
  visible: boolean;
  onClose: () => void;
  onPressSpot: (spotId: string) => void;
}

/** 住所から都道府県と市（郡）を落として、区・町名まで（宮城県仙台市青葉区北山1-14-1 → 青葉区北山） */
export function shortAddress(address: string | null): string | null {
  if (!address) return null;
  const rest = address
    .replace(/^(東京都|北海道|(?:京都|大阪)府|.{2,3}県)/, '')
    .replace(/^.+?[市郡](?=.)/, '');
  return rest.replace(/[0-9０-９].*$/, '').trim() || null;
}

function SpotRow({
  spot,
  note,
  onPress,
  faint,
}: {
  spot: AreaSpot;
  note?: string;
  onPress: () => void;
  faint?: boolean;
}) {
  const place = shortAddress(spot.address);
  const kind = spot.type === 'temple' ? 'お寺' : '神社';
  return (
    <TouchableOpacity
      style={[styles.spot, faint && styles.faint]}
      onPress={onPress}
      testID={`area-spot-${spot.id}`}
      accessibilityRole="button"
    >
      <View
        style={[
          styles.pin,
          {
            backgroundColor:
              spot.type === 'temple' ? colors.pin.templeVisited : colors.pin.shrineVisited,
          },
        ]}
      />
      <View style={styles.nm}>
        <Text style={styles.spotName}>{spot.name}</Text>
        <Text style={styles.spotSub}>{note ?? [place, kind].filter(Boolean).join(' ・ ')}</Text>
      </View>
      <Text style={styles.km}>{`${spot.distanceKm.toFixed(1)}km`}</Text>
    </TouchableOpacity>
  );
}

/**
 * よく行くエリアの、まだの寺社（Issue #245 / v3 の②）。
 *
 * エリアは記録した寺社の位置から割り出したもの。「家」「現在地」とは言わない。
 * 「この寺社を回る予定を組む」は参拝ルート計画ができるまで出さない（押せないボタンは置かない）
 */
export function FrequentAreaSheet({ area, visible, onClose, onPressSpot }: Props) {
  if (!area) return null;
  return (
    <Modal visible={visible} onClose={onClose} variant="bottom">
      <View testID="frequent-area-sheet">
        <Text style={styles.title}>{`よく行く、${area.label}のまわり`}</Text>
        <Text style={styles.why}>
          {`この${area.months}ヶ月、よく参拝しているあたりです。まだ御朱印をいただいていない寺社を、近い順に。`}
        </Text>
        {area.spots.map(s => (
          <SpotRow key={s.id} spot={s} onPress={() => onPressSpot(s.id)} />
        ))}
        {area.alsoInCourse.map(s => (
          <SpotRow
            key={s.id}
            spot={s}
            note={`${s.courseName}の、残りの1社`}
            faint
            onPress={() => onPressSpot(s.id)}
          />
        ))}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  title: { ...typography.h3, color: colors.gray[900] },
  why: {
    ...typography.caption,
    color: colors.gray[600],
    marginTop: spacing.xs,
    marginBottom: spacing.md,
    lineHeight: 19,
  },
  spot: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: 11,
    borderTopWidth: 1,
    borderTopColor: colors.gray[200],
  },
  faint: { opacity: 0.55 },
  pin: { width: 12, height: 12, borderRadius: borderRadius.full },
  nm: { flex: 1 },
  spotName: { ...typography.body, fontWeight: '700', color: colors.gray[900] },
  spotSub: { ...typography.caption, color: colors.gray[600], marginTop: 2 },
  km: { ...typography.caption, color: colors.gray[400] },
});
