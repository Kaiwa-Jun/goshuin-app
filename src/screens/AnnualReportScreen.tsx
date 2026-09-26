import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AnnualReportPlayer } from '@components/annual-report/AnnualReportPlayer';
import { CloseButton, ReportButton } from '@components/annual-report/ReportButtons';
import { useAnnualReport } from '@hooks/useAnnualReport';
import { colors } from '@theme/colors';
import { spacing } from '@theme/spacing';
import { typography } from '@theme/typography';
import type { RootStackScreenProps } from '@/navigation/types';

type Props = RootStackScreenProps<'AnnualReport'>;

/**
 * 年報「{年}年のふりかえり」（Issue #274）。
 * あゆみのカード・欄、12月の自動再生、開発用のどこからも同じ画面を開く
 */
export function AnnualReportScreen({ navigation, route }: Props) {
  const { year, sample } = route.params;
  const { status, report } = useAnnualReport({ year, sample });
  const insets = useSafeAreaInsets();
  const close = () => navigation.goBack();

  if (status === 'ready' && report) {
    return <AnnualReportPlayer report={report} onClose={close} />;
  }

  if (status === 'loading') {
    return (
      <View style={styles.root} testID="annual-report-loading">
        <View style={styles.center}>
          <ActivityIndicator color={colors.seal} />
        </View>
        <CloseButton onPress={close} top={insets.top + 14} />
      </View>
    );
  }

  const message =
    status === 'error' ? 'ふりかえりを読み込めませんでした' : `${year}年の記録はまだありません`;

  return (
    <View
      style={[styles.root, { paddingBottom: insets.bottom + spacing.xl }]}
      testID={status === 'error' ? 'annual-report-error' : 'annual-report-empty'}
    >
      <View style={styles.center}>
        <Text style={styles.message}>{message}</Text>
      </View>
      <View style={styles.actions}>
        <ReportButton label="閉じる" variant="secondary" onPress={close} />
      </View>
      <CloseButton onPress={close} top={insets.top + 14} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.washi,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 26,
  },
  message: {
    ...typography.body,
    color: colors.gray[900],
    textAlign: 'center',
  },
  actions: {
    paddingHorizontal: 26,
  },
});
