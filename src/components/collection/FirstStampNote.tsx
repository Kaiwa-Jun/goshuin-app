import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useNearestPrefecture } from '@hooks/useNearestPrefecture';
import { ayumiFirstStampLine } from '@utils/firstStamp';
import { colors } from '@theme/colors';
import { spacing } from '@theme/spacing';

/**
 * あゆみの日本地図の下、記録 0 枚の間だけ凡例の代わりに出す一言（Issue #327 案③の言葉）。
 * 「まだ 47」の凡例より、最初の 1 枚で何が起きるかを言う。県が決まるまでは何も出さない
 */
export function FirstStampNote() {
  const { prefecture, isResolved } = useNearestPrefecture();
  if (!isResolved) return null;

  return (
    <View style={styles.container}>
      <Text testID="ayumi-first-stamp-note" style={styles.note}>
        {ayumiFirstStampLine(prefecture)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  // 凡例と同じ上の罫線
  container: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.gray[200],
  },
  // 試作の値
  note: {
    fontSize: 15,
    lineHeight: 22,
    color: colors.gray[700],
    textAlign: 'center',
  },
});
