import React from 'react';
import { StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CheckmarkAnimation } from '@components/animated/CheckmarkAnimation';
import { BadgeAnimation } from '@components/animated/BadgeAnimation';
import { colors } from '@theme/colors';
import { typography } from '@theme/typography';
import { spacing, borderRadius } from '@theme/spacing';
import type { RootStackScreenProps } from '@/navigation/types';

type Props = RootStackScreenProps<'RecordComplete'>;

export function RecordCompleteScreen({ navigation }: Props) {
  const handleRecordAnother = () => {
    navigation.navigate('Record');
  };

  const handleViewMap = () => {
    navigation.navigate('MainTabs', { screen: 'MapTab', params: { screen: 'Map' } });
  };

  const handleViewCollection = () => {
    navigation.navigate('MainTabs', { screen: 'Collection' });
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.content}>
        <CheckmarkAnimation size={80} />

        <Text style={styles.title}>登録完了！</Text>

        <View style={styles.imagePlaceholder} testID="stamp-image-placeholder" />

        <Text style={styles.countText}>33箇所目の御朱印！</Text>

        <BadgeAnimation badgeName="初めての御朱印" description="最初の御朱印を記録しました" />
      </View>

      <View style={styles.actions}>
        <TouchableOpacity
          style={styles.buttonRecordAnother}
          onPress={handleRecordAnother}
          testID="button-record-another"
        >
          <Text style={styles.buttonRecordAnotherText}>もう1枚記録する</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.buttonViewMap}
          onPress={handleViewMap}
          testID="button-view-map"
        >
          <Text style={styles.buttonViewMapText}>地図を見る</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.buttonViewCollection}
          onPress={handleViewCollection}
          testID="button-view-collection"
        >
          <Text style={styles.buttonViewCollectionText}>コレクションを確認</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.primary[500],
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing['2xl'],
    gap: spacing.xl,
  },
  title: {
    ...typography.h1,
    color: colors.white,
  },
  imagePlaceholder: {
    width: 160,
    height: 200,
    borderRadius: borderRadius.lg,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  countText: {
    ...typography.h3,
    color: colors.white,
  },
  actions: {
    paddingHorizontal: spacing['2xl'],
    paddingBottom: spacing['2xl'],
    gap: spacing.md,
  },
  buttonRecordAnother: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingVertical: spacing.md,
    borderRadius: borderRadius.lg,
    alignItems: 'center',
  },
  buttonRecordAnotherText: {
    ...typography.button,
    color: colors.white,
  },
  buttonViewMap: {
    backgroundColor: colors.white,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.lg,
    alignItems: 'center',
  },
  buttonViewMapText: {
    ...typography.button,
    color: colors.primary[500],
  },
  buttonViewCollection: {
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  buttonViewCollectionText: {
    ...typography.button,
    color: 'rgba(255,255,255,0.8)',
  },
});
