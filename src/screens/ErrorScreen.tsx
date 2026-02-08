import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@components/common/Button';
import { ErrorIcon } from '@components/animated/ErrorIcon';
import { colors } from '@theme/colors';
import { spacing } from '@theme/spacing';
import { typography } from '@theme/typography';
import type { RootStackScreenProps } from '@/navigation/types';

type Props = RootStackScreenProps<'Error'>;

type ErrorType = 'network' | 'location' | 'upload';

const ERROR_CONFIG: Record<
  ErrorType,
  {
    title: string;
    description: string;
    primaryButton: string;
    secondaryButton?: string;
  }
> = {
  network: {
    title: 'ネットワークエラー',
    description: 'インターネット接続を確認してください',
    primaryButton: '再試行',
  },
  location: {
    title: '位置情報エラー',
    description: '位置情報の利用を許可してください',
    primaryButton: '設定を開く',
    secondaryButton: 'あとで設定する',
  },
  upload: {
    title: 'アップロードエラー',
    description: '画像のアップロードに失敗しました',
    primaryButton: '再試行',
    secondaryButton: 'キャンセル',
  },
};

export function ErrorScreen({ route, navigation }: Props) {
  const errorType = route.params.type;
  const config = ERROR_CONFIG[errorType];

  const handlePrimaryPress = () => {
    navigation.goBack();
  };

  const handleSecondaryPress = () => {
    navigation.goBack();
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <ErrorIcon type={errorType} size={64} />
        <Text style={styles.title}>{config.title}</Text>
        <Text style={styles.description}>{config.description}</Text>
        <View style={styles.buttonContainer}>
          <Button
            title={config.primaryButton}
            onPress={handlePrimaryPress}
            variant="primary"
            style={styles.primaryButton}
          />
          {config.secondaryButton && (
            <Button title={config.secondaryButton} onPress={handleSecondaryPress} variant="ghost" />
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing['3xl'],
  },
  title: {
    ...typography.h2,
    color: colors.gray[900],
    marginTop: spacing.xl,
    textAlign: 'center',
  },
  description: {
    ...typography.body,
    color: colors.gray[500],
    marginTop: spacing.md,
    textAlign: 'center',
  },
  buttonContainer: {
    marginTop: spacing['3xl'],
    width: '100%',
    alignItems: 'center',
    gap: spacing.md,
  },
  primaryButton: {
    width: '100%',
  },
});
