import { MaterialIcons } from '@expo/vector-icons';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  type StyleProp,
  type TextStyle,
} from 'react-native';

import { colors } from '@theme/colors';
import { spacing } from '@theme/spacing';
import type { AnnualYearSummary } from '@utils/annualReport';

interface Props {
  /** 新しい年から */
  items: AnnualYearSummary[];
  onPress: (year: number) => void;
  /** 見出しの見た目。あゆみの「巡礼チャレンジ」と揃える */
  titleStyle?: StyleProp<TextStyle>;
}

/**
 * あゆみのいちばん下の「ふりかえり」の欄（Issue #274 D-16）。1月から、過ぎた年が並ぶ。
 * 見出しは「年報」ではなく「ふりかえり」（「年報」はコードの中の呼び名）
 */
export function AnnualReportShelf({ items, onPress, titleStyle }: Props) {
  if (items.length === 0) return null;

  return (
    <View testID="ayumi-annual-section">
      <Text style={titleStyle}>ふりかえり</Text>
      {items.map(({ year, spots, stamps }) => (
        <TouchableOpacity
          key={year}
          testID={`ayumi-annual-row-${year}`}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel={`${year}年のふりかえりを見る`}
          onPress={() => onPress(year)}
          style={styles.row}
        >
          <View style={styles.texts}>
            <Text style={styles.title}>{`${year}年のふりかえり`}</Text>
            <Text style={styles.sub}>{`${spots}社・${stamps}枚`}</Text>
          </View>
          <View testID={`ayumi-annual-row-${year}-play`} style={styles.play}>
            <MaterialIcons name="play-arrow" size={20} color={colors.white} />
          </View>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    backgroundColor: colors.washi,
    borderRadius: 16,
    padding: 12,
    marginBottom: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  texts: { flex: 1 },
  title: { fontSize: 14, fontWeight: '800', color: colors.gray[900] },
  sub: { fontSize: 12, color: colors.gray[600] },
  play: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.seal,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
