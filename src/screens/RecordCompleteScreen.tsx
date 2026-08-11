import React, { useState } from 'react';
import { Alert, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import { deleteStamp } from '@services/stamps';
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
  const stampId = route.params?.stampId;
  const imagePath = route.params?.imagePath;
  const countUnavailable = route.params?.countUnavailable;
  const [imageError, setImageError] = useState(false);
  const [isUndoing, setIsUndoing] = useState(false);

  // 確認モーダルを廃した（D-3）ぶんの受け皿。誤登録はここで回復する。
  // 両方揃っていないと deleteStamp を呼べないので、その場合はボタン自体を出さない
  const canUndo = Boolean(stampId && imagePath);

  const handleRecordAnother = () => {
    navigation.navigate('Record');
  };

  const handleViewMap = () => {
    navigation.navigate('MainTabs', { screen: 'MapTab', params: { screen: 'Map' } });
  };

  // 呼び出し元が canUndo のボタンだけとは限らなくなっても壊れないよう、
  // ここでも揃っていることを確かめてから消す
  const runUndo = async (id: string, path: string) => {
    setIsUndoing(true);
    try {
      await deleteStamp(id, path);
      navigation.navigate('MainTabs', { screen: 'MapTab', params: { screen: 'Map' } });
    } catch (error) {
      // 消せていないのに消えた顔をしない。原文を出して画面に留まる
      const message = error instanceof Error ? error.message : String(error);
      Alert.alert('取り消せませんでした', message);
    } finally {
      setIsUndoing(false);
    }
  };

  // 取り消しは非可逆（redo は無い）ので、ここだけは確認を挟む。
  // 主導線ではないためタップ数の目標には影響しない
  const handleUndoPress = () => {
    if (!stampId || !imagePath) return;

    Alert.alert('この記録を取り消しますか？', '御朱印の写真ごと削除されます。元には戻せません。', [
      { text: 'やめる', style: 'cancel' },
      { text: '取り消す', style: 'destructive', onPress: () => runUndo(stampId, imagePath) },
    ]);
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

          {/* 記録は保存できている。黙って件数を消すと壊れていることに気づけないので
              理由だけを控えめに添える（Issue #133 / D-3） */}
          {countUnavailable && (
            <Text style={styles.countUnavailableText} testID="visit-count-unavailable">
              通信エラーのため記録数を表示できません
            </Text>
          )}

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
            <Text style={styles.buttonViewCollectionText}>あつめるを見る</Text>
          </TouchableOpacity>

          {canUndo && (
            <TouchableOpacity
              style={styles.buttonUndo}
              onPress={handleUndoPress}
              disabled={isUndoing}
              testID="button-undo-record"
            >
              <Text style={styles.buttonUndoText}>
                {isUndoing ? '取り消しています...' : '記録を取り消す'}
              </Text>
            </TouchableOpacity>
          )}
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
  // お祝いの場なのでエラー画面には飛ばさず、注記として控えめに置く
  countUnavailableText: {
    ...typography.caption,
    color: colors.white,
    opacity: 0.7,
    textAlign: 'center',
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
  // 主導線の3ボタンより控えめに、かつ間隔を空けて誤タップを避ける
  buttonUndo: {
    paddingVertical: spacing.md,
    marginTop: spacing.lg,
    alignItems: 'center',
  },
  buttonUndoText: {
    ...typography.caption,
    color: colors.white,
    opacity: 0.7,
    textDecorationLine: 'underline',
  },
});
