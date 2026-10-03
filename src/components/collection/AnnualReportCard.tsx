import { MaterialIcons } from '@expo/vector-icons';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { colors } from '@theme/colors';
import { spacing } from '@theme/spacing';
import type { AnnualYearSummary } from '@utils/annualReport';

interface Props {
  summary: AnnualYearSummary;
  onPress: () => void;
}

/**
 * あゆみのいちばん上に、12月の間だけ出すカード（Issue #274 D-16）。
 * 画面に出す呼び方は「{年}年のふりかえり」（「年報」はコードの中の呼び名）
 */
export function AnnualReportCard({ summary, onPress }: Props) {
  const { year, spots, stamps } = summary;
  return (
    <TouchableOpacity
      testID="ayumi-annual-card"
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityLabel={`${year}年のふりかえりを見る`}
      onPress={onPress}
      style={styles.card}
    >
      <View style={styles.texts}>
        <Text style={styles.kick}>12月の特別編</Text>
        <Text style={styles.title}>{`${year}年のふりかえり`}</Text>
        <Text style={styles.sub}>{`${spots}社・${stamps}枚の一年を、動くふりかえりで`}</Text>
      </View>
      <View testID="ayumi-annual-card-play" style={styles.play}>
        <MaterialIcons name="play-arrow" size={26} color={colors.white} />
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.washi,
    borderRadius: 18,
    padding: 16,
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  texts: { flex: 1 },
  kick: { fontSize: 11.5, fontWeight: '800', color: colors.seal },
  title: { fontSize: 17, fontWeight: '800', color: colors.gray[900] },
  sub: { fontSize: 12.5, color: colors.gray[600] },
  play: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.seal,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
