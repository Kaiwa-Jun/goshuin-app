import { MaterialIcons } from '@expo/vector-icons';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { Seal } from '@components/common/Seal';
import { MANGAN_MONTHS } from '@utils/tsukimairi';
import type { MouSukoshiRow } from '@utils/mouSukoshi';
import { colors } from '@theme/colors';
import { shadows } from '@theme/shadows';
import { borderRadius, spacing } from '@theme/spacing';
import { typography } from '@theme/typography';

type AreaRow = Extract<MouSukoshiRow, { kind: 'area' }>;

interface Props {
  rows: MouSukoshiRow[];
  onPressPilgrimage: (id: string, name: string) => void;
  onPressSpot: (spotId: string) => void;
  onPressSeal: () => void;
  onPressArea: (row: AreaRow) => void;
}

const ICON = 40;

/** 丸を n 個並べた小さな輪。月参り（12）と巡礼（札所の数）で使う */
function Ring({ total, on }: { total: number; on: number }) {
  const dot = total > 8 ? 7 : 9;
  const r = ICON / 2 - dot / 2 - 1;
  return (
    <View style={styles.icon}>
      {Array.from({ length: total }, (_, i) => {
        const a = -Math.PI / 2 + (i * 2 * Math.PI) / total;
        return (
          <View
            key={i}
            style={[
              styles.ringDot,
              {
                width: dot,
                height: dot,
                left: ICON / 2 + r * Math.cos(a) - dot / 2,
                top: ICON / 2 + r * Math.sin(a) - dot / 2,
                backgroundColor: i < on ? colors.seal : colors.sealEmpty,
              },
            ]}
          />
        );
      })}
    </View>
  );
}

function Row({
  first,
  testID,
  kind,
  name,
  sub,
  left,
  icon,
  onPress,
  label,
}: {
  first?: boolean;
  testID: string;
  kind: string;
  name: string;
  sub?: React.ReactNode;
  left: string;
  icon: React.ReactNode;
  onPress: () => void;
  label: string;
}) {
  return (
    <TouchableOpacity
      style={[styles.row, first && styles.firstRow]}
      onPress={onPress}
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      {icon}
      <View style={styles.what}>
        <Text style={styles.kind}>{kind}</Text>
        <Text style={styles.name} numberOfLines={1}>
          {name}
        </Text>
        {sub}
      </View>
      <Text style={styles.left}>{left}</Text>
      <MaterialIcons name="chevron-right" size={20} color={colors.gray[400]} />
    </TouchableOpacity>
  );
}

/**
 * あゆみの「もう少し」（Issue #245）。**暮らしの中で踏み出せる一歩だけ**、最大3行。
 *
 * 行が無ければカードごと出さない（「まだ何もありません」とも言わない）。
 * よく行くエリアは記録した寺社の位置から割り出したもので、「家」「現在地」とは言わない
 */
export function MouSukoshiCard({
  rows,
  onPressPilgrimage,
  onPressSpot,
  onPressSeal,
  onPressArea,
}: Props) {
  if (rows.length === 0) return null;

  return (
    <View style={styles.card} testID="mou-sukoshi">
      <Text style={styles.title}>もう少し</Text>
      {rows.map((row, index) => {
        const first = index === 0;
        switch (row.kind) {
          case 'pilgrimage': {
            const p = row.pilgrimage;
            return (
              <Row
                first={first}
                key={`p-${p.id}`}
                testID={`mou-sukoshi-pilgrimage-${p.id}`}
                kind="巡礼"
                name={p.name}
                left={`あと${row.remaining}社`}
                icon={<Ring total={p.totalSpots} on={p.visitedCount} />}
                onPress={() => onPressPilgrimage(p.id, p.name)}
                label={`巡礼、${p.name}、あと${row.remaining}社`}
              />
            );
          }
          case 'tsukimairi':
            return (
              <Row
                first={first}
                key={`t-${row.entry.spotId}`}
                testID={`mou-sukoshi-tsukimairi-${row.entry.spotId}`}
                kind="月参り"
                name={row.entry.spotName}
                left={`満願まで\nあと${row.remaining}ヶ月`}
                icon={<Ring total={MANGAN_MONTHS} on={row.entry.monthsInLap} />}
                onPress={() => onPressSpot(row.entry.spotId)}
                label={`月参り、${row.entry.spotName}、満願まであと${row.remaining}ヶ月`}
              />
            );
          case 'seal':
            return (
              <Row
                first={first}
                key="seal"
                testID="mou-sukoshi-seal"
                kind="印"
                name={row.badge.name}
                left={`あと${row.remaining}${row.unit}`}
                icon={
                  <View style={styles.icon}>
                    <Seal mark={row.badge.mark} earned={false} size={ICON} />
                  </View>
                }
                onPress={onPressSeal}
                label={`印、${row.badge.name}、あと${row.remaining}${row.unit}`}
              />
            );
          case 'area':
            return (
              <Row
                first={first}
                key="area"
                testID="mou-sukoshi-area"
                kind="よく行くエリア"
                name={`${row.label}のまわり`}
                sub={
                  <Text style={styles.sub} numberOfLines={1}>
                    {row.spots.map(s => s.name).join('・')}
                  </Text>
                }
                left={`まだの\n寺社 ${row.spots.length}`}
                icon={
                  <View style={[styles.icon, styles.pinIcon]}>
                    <MaterialIcons name="place" size={24} color={colors.primary[500]} />
                  </View>
                }
                onPress={() => onPressArea(row)}
                label={`よく行くエリア、${row.label}のまわり、まだの寺社${row.spots.length}`}
              />
            );
        }
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.xl,
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 4,
    marginBottom: spacing.md,
    ...shadows.md,
  },
  title: { ...typography.h3, fontSize: 16, color: colors.gray[900], marginBottom: 2 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: 11,
    borderTopWidth: 1,
    borderTopColor: colors.gray[200],
  },
  firstRow: { borderTopWidth: 0 },
  icon: { width: ICON, height: ICON, alignItems: 'center', justifyContent: 'center' },
  pinIcon: { borderRadius: borderRadius.full, backgroundColor: colors.primary[50] },
  ringDot: { position: 'absolute', borderRadius: borderRadius.full },
  what: { flex: 1, minWidth: 0 },
  kind: { fontSize: 10, fontWeight: '700', letterSpacing: 0.6, color: colors.gray[400] },
  name: { ...typography.bodySmall, fontWeight: '700', color: colors.gray[900] },
  sub: { ...typography.caption, color: colors.gray[600], marginTop: 1 },
  left: {
    ...typography.caption,
    fontWeight: '800',
    color: colors.seal,
    textAlign: 'right',
    lineHeight: 17,
  },
});
