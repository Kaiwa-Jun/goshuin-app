import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

import type { ParsedSpotInfo } from '@hooks/useSpotInfo';
import { colors } from '@theme/colors';
import { typography } from '@theme/typography';
import { spacing, borderRadius } from '@theme/spacing';

interface SpotInfoSectionProps {
  spotInfo: ParsedSpotInfo;
}

export function SpotInfoSection({ spotInfo }: SpotInfoSectionProps) {
  const { parking, affiliatedShrines, receptionHours } = spotInfo;

  const items: { icon: keyof typeof MaterialIcons.glyphMap; text: string }[] = [];

  if (parking) {
    let text = parking.available ? 'あり' : 'なし';
    if (parking.capacity != null) text += `（${parking.capacity}台）`;
    if (parking.location) text += `・${parking.location}`;
    items.push({ icon: 'local-parking', text: `駐車場 ${text}` });
  }

  if (receptionHours) {
    let text =
      receptionHours.open && receptionHours.close
        ? `${receptionHours.open}〜${receptionHours.close}`
        : '時間情報あり';
    if (receptionHours.notes) text += `（${receptionHours.notes}）`;
    items.push({ icon: 'schedule', text: `受付 ${text}` });
  }

  if (affiliatedShrines && affiliatedShrines.length > 0) {
    const names = affiliatedShrines.map(s => s.name).join('、');
    items.push({ icon: 'account-balance', text: `兼務社 ${names}` });
  }

  if (items.length === 0) return null;

  return (
    <View style={styles.container} testID="spot-info-section">
      {items.map((item, index) => (
        <View style={styles.infoItem} key={index} testID={`spot-info-item-${index}`}>
          <MaterialIcons
            name={item.icon}
            size={14}
            color={colors.primary[500]}
            style={styles.icon}
          />
          <Text style={styles.infoText}>{item.text}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.xl,
  },
  infoItem: {
    flexDirection: 'row',
    // 複数行になったときにアイコンが中央へ浮かないよう上端で揃える
    alignItems: 'flex-start',
    gap: spacing.xs,
    backgroundColor: colors.gray[50],
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
  },
  icon: {
    // caption の行の中心にアイコンの中心を合わせる（上端揃えにした分の補正）
    marginTop: 1,
  },
  infoText: {
    ...typography.caption,
    color: colors.gray[600],
    // row の中の Text は flexShrink が既定 0 のため、これが無いと
    // 折り返さずにチップからはみ出す
    flexShrink: 1,
  },
});
