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

import { NearbyArt } from '@components/onboarding/NearbyArt';
import { PrefectureMap } from '@components/onboarding/PrefectureMap';
import { RecordArt } from '@components/onboarding/RecordArt';
import { SealsArt } from '@components/onboarding/SealsArt';
import { Button } from '@components/common/Button';
import { PageIndicator } from '@components/common/PageIndicator';
import { useOnboarding } from '@hooks/useOnboarding';
import type { RootStackScreenProps } from '@/navigation/types';
import { colors } from '@theme/colors';
import { typography } from '@theme/typography';
import { spacing } from '@theme/spacing';

type Props = RootStackScreenProps<'Onboarding'>;

/** その画で何を見せるか。絵は作り分ける */
type SlideArt = 'map' | 'record' | 'seals' | 'nearby';

interface SlideData {
  art: SlideArt;
  title: string;
  desc: string;
}

/*
 * 絵で言う。**「地図で管理します」と文字で書くのをやめた** —
 * 以前は色つきの角丸にアイコンを載せていて、地図が一度も出てこなかった
 */
const slides: SlideData[] = [
  {
    art: 'map',
    title: '集めるたび、\n地図があなたの旅になる。',
    desc: '訪れた県が濃くなっていきます',
  },
  {
    art: 'record',
    title: '写真を1枚。\nそれだけ。',
    desc: '撮ると、地図にピンが刺さります',
  },
  {
    art: 'seals',
    title: '続けると、\n印が増えていく。',
    desc: '訪問数だけでなく、通い方や季節でも',
  },
  {
    art: 'nearby',
    title: '近くの寺社を\n見つけます。',
    desc: '許可すると、まわりの神社やお寺が地図に出ます',
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

  // スキップは最終スライドへ飛ばすだけ。オンボーディングを抜ける道は
  // 「続ける」= 権限リクエストの1本に絞る（App Store Guideline 5.1.1(iv)）
  const handleSkipToLastSlide = () => {
    flatListRef.current?.scrollToIndex({ index: slides.length - 1 });
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

  const renderSlide = ({ item, index }: { item: SlideData; index: number }) => {
    // 見えている画だけ動かす。離れたら最初から出し直す
    const active = index === currentIndex;
    const artWidth = SCREEN_WIDTH - spacing.lg * 2;

    return (
      <View style={styles.slide} testID="onboarding-slide">
        <View style={styles.art}>
          {item.art === 'map' && (
            <PrefectureMap width={artWidth * 0.82} animate={active} testID="onboarding-art-map" />
          )}
          {item.art === 'record' && <RecordArt width={artWidth} active={active} />}
          {item.art === 'seals' && <SealsArt width={artWidth} active={active} />}
          {item.art === 'nearby' && <NearbyArt width={artWidth} active={active} />}
        </View>
        <Text style={styles.title}>{item.title}</Text>
        <Text style={styles.description}>{item.desc}</Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} testID="onboarding-screen">
      <View style={styles.header}>
        {!isLastSlide && (
          <TouchableOpacity onPress={handleSkipToLastSlide} testID="skip-button">
            <Text style={styles.skipText}>スキップ</Text>
          </TouchableOpacity>
        )}
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
        // 全スライドが画面幅ちょうど。離れたページへ直接飛ぶには getItemLayout が要る
        getItemLayout={(_, index) => ({
          length: SCREEN_WIDTH,
          offset: SCREEN_WIDTH * index,
          index,
        })}
        testID="onboarding-flatlist"
      />

      <View style={styles.footer}>
        <PageIndicator total={slides.length} current={currentIndex} />

        <View style={styles.buttons}>
          {isLastSlide ? (
            <Button
              title="続ける"
              onPress={handleComplete}
              variant="primary"
              style={styles.primaryButton}
            />
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
    paddingHorizontal: spacing.lg,
    gap: spacing.lg,
  },
  /* 絵の高さを固定する。画ごとに高さが違うと、文が上下に跳ねる */
  art: { height: 360, alignItems: 'center', justifyContent: 'center' },
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
