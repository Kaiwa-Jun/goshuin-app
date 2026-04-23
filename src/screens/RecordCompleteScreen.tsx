import React, { useState } from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import { CheckmarkAnimation } from '@components/animated/CheckmarkAnimation';
import { BadgeAnimation } from '@components/animated/BadgeAnimation';
import { ConfettiEffect } from '@components/animated/ConfettiEffect';
import { colors } from '@theme/colors';
import { typography } from '@theme/typography';
import { spacing, borderRadius } from '@theme/spacing';
import type { RootStackScreenProps } from '@/navigation/types';

type Props = RootStackScreenProps<'RecordComplete'>;

export function RecordCompleteScreen({ navigation, route }: Props) {
  const stampImageUrl = route.params?.stampImageUrl;
  const spotName = route.params?.spotName;
  const visitCount = route.params?.visitCount;
  const badge = route.params?.badge;
  const [imageError, setImageError] = useState(false);

  const handleRecordAnother = () => {
    navigation.navigate('Record');
  };

  const handleViewMap = () => {
    navigation.navigate('MainTabs', { screen: 'MapTab', params: { screen: 'Map' } });
  };

  const handleViewCollection = () => {
    navigation.navigate('MainTabs', {
      screen: 'CollectionTab',
      params: { screen: 'CollectionList' },
    });
  };

  return (
    <LinearGradient
      colors={[colors.primary[400], colors.primary[500]]}
      style={styles.gradient}
      testID="gradient-background"
    >
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <ConfettiEffect trigger={true} />

        <View style={styles.content}>
          <CheckmarkAnimation size={80} />

          <Text style={styles.title}>登録完了！</Text>

          {stampImageUrl && !imageError ? (
            <Image
              source={{ uri: stampImageUrl }}
              style={styles.stampImage}
              resizeMode="cover"
              testID="stamp-image"
              onError={() => setImageError(true)}
            />
          ) : (
            <View style={styles.imagePlaceholder} testID="stamp-image-placeholder">
              <MaterialIcons name="photo" size={48} color="rgba(255,255,255,0.5)" />
            </View>
          )}

          {spotName && (
            <Text style={styles.spotName} testID="spot-name">
              {spotName}
            </Text>
          )}

          <Text style={styles.countText} testID="visit-count">
            {visitCount ? `${visitCount}箇所目の御朱印！` : '御朱印を記録しました！'}
          </Text>

          {badge && <BadgeAnimation badge={badge} />}
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
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: {
    flex: 1,
  },
  container: {
    flex: 1,
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
  stampImage: {
    width: 160,
    height: 200,
    borderRadius: borderRadius.lg,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  imagePlaceholder: {
    width: 160,
    height: 200,
    borderRadius: borderRadius.lg,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  spotName: {
    ...typography.h3,
    color: colors.white,
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
