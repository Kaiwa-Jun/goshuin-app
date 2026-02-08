import React from 'react';
import { render } from '@testing-library/react-native';

import { CollectionScreen } from '../CollectionScreen';
import type { MainTabScreenProps } from '@/navigation/types';

jest.mock('react-native-safe-area-context', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
  const RN = require('react-native');
  return {
    SafeAreaView: RN.View,
    SafeAreaProvider: RN.View,
    useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  };
});

const mockNavigation = {
  navigate: jest.fn(),
  goBack: jest.fn(),
  getParent: jest.fn(() => ({ navigate: jest.fn() })),
} as unknown as MainTabScreenProps<'Collection'>['navigation'];

const mockRoute = {
  key: 'test',
  name: 'Collection' as const,
  params: undefined,
} as unknown as MainTabScreenProps<'Collection'>['route'];

describe('CollectionScreen', () => {
  it('renders the header', () => {
    const { getByText } = render(
      <CollectionScreen navigation={mockNavigation} route={mockRoute} />
    );
    expect(getByText('コレクション')).toBeTruthy();
  });

  it('renders achievement summary cards', () => {
    const { getByText } = render(
      <CollectionScreen navigation={mockNavigation} route={mockRoute} />
    );
    expect(getByText('33')).toBeTruthy();
    expect(getByText('箇所')).toBeTruthy();
    expect(getByText('45')).toBeTruthy();
    expect(getByText('枚')).toBeTruthy();
  });

  it('renders region section', () => {
    const { getByText } = render(
      <CollectionScreen navigation={mockNavigation} route={mockRoute} />
    );
    expect(getByText('地域別')).toBeTruthy();
    expect(getByText('東京都')).toBeTruthy();
    expect(getByText('京都府')).toBeTruthy();
    expect(getByText('宮城県')).toBeTruthy();
  });

  it('renders challenge section', () => {
    const { getByText } = render(
      <CollectionScreen navigation={mockNavigation} route={mockRoute} />
    );
    expect(getByText('巡礼チャレンジ')).toBeTruthy();
    expect(getByText('四国八十八ヶ所')).toBeTruthy();
    expect(getByText('12/88')).toBeTruthy();
    expect(getByText('西国三十三所')).toBeTruthy();
    expect(getByText('5/33')).toBeTruthy();
  });

  it('renders badge section with earned and unearned badges', () => {
    const { getByText } = render(
      <CollectionScreen navigation={mockNavigation} route={mockRoute} />
    );
    expect(getByText('バッジ')).toBeTruthy();
    expect(getByText('初参拝')).toBeTruthy();
    expect(getByText('10箇所達成')).toBeTruthy();
    expect(getByText('巡礼者')).toBeTruthy();
    expect(getByText('全国制覇')).toBeTruthy();
  });
});
