import React, { useCallback, useRef, useState } from 'react';
import {
  Dimensions,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ViewToken,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Location from 'expo-location';

import { OnboardingIcon } from '@components/animated/OnboardingIcon';
import { Button } from '@components/common/Button';
import { PageIndicator } from '@components/common/PageIndicator';
import { useOnboarding } from '@hooks/useOnboarding';
import type { RootStackScreenProps } from '@/navigation/types';
import { colors } from '@theme/colors';
import { typography } from '@theme/typography';
import { spacing } from '@theme/spacing';

type Props = RootStackScreenProps<'Onboarding'>;

interface SlideData {
  icon: 'map' | 'camera-alt' | 'emoji-events' | 'place';
  bg: string;
  title: string;
  desc: string;
}

const slides: SlideData[] = [
  {
    icon: 'map',
    bg: '#FB923C',
    title: '御朱印を地図で管理',
    desc: '訪れた神社やお寺が地図上にマッピングされます',
  },
  {
    icon: 'camera-alt',
    bg: '#A855F7',
    title: 'かんたん記録',
    desc: '写真を撮るだけですぐに御朱印を記録できます',
  },
  {
    icon: 'emoji-events',
    bg: '#F59E0B',
    title: 'コレクションを楽しむ',
    desc: '巡礼チャレンジやバッジで御朱印集めがもっと楽しく',
  },
  {
    icon: 'place',
    bg: '#22C55E',
    title: '近くのスポットを発見',
    desc: '位置情報をオンにすると周辺の神社仏閣が見つかります',
  },
];

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export function OnboardingScreen({ navigation }: Props) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const flatListRef = useRef<FlatList<SlideData>>(null);
  const { completeOnboarding } = useOnboarding();

  const onViewableItemsChanged = useCallback(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      if (viewableItems.length > 0 && viewableItems[0].index != null) {
        setCurrentIndex(viewableItems[0].index);
      }
    },
    []
  );

  const viewabilityConfig = useRef({ viewAreaCoveragePercentThreshold: 50 }).current;

  const handleNext = () => {
    if (currentIndex < slides.length - 1) {
      flatListRef.current?.scrollToIndex({ index: currentIndex + 1 });
    }
  };

  const handleSkip = () => {
    completeOnboarding();
    navigation.navigate('MainTabs', { screen: 'MapTab', params: { screen: 'Map' } });
  };

  const handleComplete = async () => {
    try {
      await Location.requestForegroundPermissionsAsync();
    } catch {
      // エラーでもオンボーディングは完了させる
    }
    completeOnboarding();
    navigation.navigate('MainTabs', { screen: 'MapTab', params: { screen: 'Map' } });
  };

  const isLastSlide = currentIndex === slides.length - 1;

  const renderSlide = ({ item }: { item: SlideData }) => (
    <View style={styles.slide} testID="onboarding-slide">
      <OnboardingIcon name={item.icon} backgroundColor={item.bg} />
      <Text style={styles.title}>{item.title}</Text>
      <Text style={styles.description}>{item.desc}</Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container} testID="onboarding-screen">
      <View style={styles.header}>
        <TouchableOpacity onPress={handleSkip} testID="skip-button">
          <Text style={styles.skipText}>スキップ</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        ref={flatListRef}
        data={slides}
        renderItem={renderSlide}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        keyExtractor={(_, index) => String(index)}
        testID="onboarding-flatlist"
      />

      <View style={styles.footer}>
        <PageIndicator total={slides.length} current={currentIndex} />

        <View style={styles.buttons}>
          {isLastSlide ? (
            <>
              <Button
                title="位置情報を許可して始める"
                onPress={handleComplete}
                variant="primary"
                style={styles.primaryButton}
              />
              <Button title="あとで設定する" onPress={handleSkip} variant="ghost" />
            </>
          ) : (
            <Button
              title="次へ"
              onPress={handleNext}
              variant="primary"
              style={styles.primaryButton}
            />
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.white,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  skipText: {
    ...typography.body,
    color: colors.gray[400],
  },
  slide: {
    width: SCREEN_WIDTH,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing['3xl'],
    gap: spacing.lg,
  },
  title: {
    ...typography.h1,
    color: colors.gray[900],
    textAlign: 'center',
    marginTop: spacing.xl,
  },
  description: {
    ...typography.body,
    color: colors.gray[500],
    textAlign: 'center',
  },
  footer: {
    paddingHorizontal: spacing['2xl'],
    paddingBottom: spacing['2xl'],
    gap: spacing.xl,
    alignItems: 'center',
  },
  buttons: {
    width: '100%',
    gap: spacing.md,
  },
  primaryButton: {
    width: '100%',
  },
});
