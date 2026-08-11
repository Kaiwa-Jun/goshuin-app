import { useEffect, useRef } from 'react';
import { AppState, Linking, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Location from 'expo-location';

import { Button } from '@components/common/Button';
import { ErrorIcon } from '@components/animated/ErrorIcon';
import { colors } from '@theme/colors';
import { spacing, borderRadius } from '@theme/spacing';
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
  const origin = route.params.origin;
  const stage = route.params.stage;
  const detail = route.params.message;
  const config = ERROR_CONFIG[errorType];
  const appState = useRef(AppState.currentState);

  // 'upload' 以外の失敗も従来はすべて「アップロードエラー」に倒れていた。
  // 画像は上がっていて DB への保存だけ落ちた場合は、そう名乗る
  const isCreateFailure = stage === 'create';
  const title = isCreateFailure ? '保存エラー' : config.title;
  const description = isCreateFailure ? '記録の保存に失敗しました' : config.description;

  useEffect(() => {
    if (errorType !== 'location') return;

    const subscription = AppState.addEventListener('change', async nextAppState => {
      if (
        (appState.current === 'background' || appState.current === 'inactive') &&
        nextAppState === 'active'
      ) {
        const { status } = await Location.getForegroundPermissionsAsync();
        if (status === 'granted') {
          navigation.goBack();
        }
      }
      appState.current = nextAppState;
    });

    return () => subscription.remove();
  }, [errorType, navigation]);

  const handlePrimaryPress = () => {
    if (errorType === 'location') {
      Linking.openSettings();
    } else {
      navigation.goBack();
    }
  };

  const handleSecondaryPress = () => {
    if (origin === 'record') {
      navigation.pop(2);
    } else {
      navigation.goBack();
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <ErrorIcon type={errorType} size={64} />
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.description}>{description}</Text>
        {detail ? (
          <View style={styles.detailBox} testID="error-detail">
            <Text style={styles.detailLabel}>詳細</Text>
            <Text style={styles.detailText} selectable>
              {detail}
            </Text>
          </View>
        ) : null}
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
  detailBox: {
    marginTop: spacing.xl,
    width: '100%',
    padding: spacing.md,
    borderRadius: borderRadius.md,
    backgroundColor: colors.gray[100],
    borderWidth: 1,
    borderColor: colors.gray[200],
  },
  detailLabel: {
    ...typography.caption,
    color: colors.gray[500],
    marginBottom: spacing.xs,
  },
  detailText: {
    ...typography.caption,
    color: colors.gray[700],
  },
  buttonContainer: {
    marginTop: spacing.xl,
    width: '100%',
    alignItems: 'center',
    gap: spacing.md,
  },
  primaryButton: {
    width: '100%',
  },
});
