import React from 'react';
import { render } from '@testing-library/react-native';

import { SettingsScreen } from '../SettingsScreen';
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
} as unknown as MainTabScreenProps<'Settings'>['navigation'];

const mockRoute = {
  key: 'test',
  name: 'Settings' as const,
  params: undefined,
} as unknown as MainTabScreenProps<'Settings'>['route'];

describe('SettingsScreen', () => {
  it('renders the header', () => {
    const { getByText } = render(<SettingsScreen navigation={mockNavigation} route={mockRoute} />);
    expect(getByText('設定')).toBeTruthy();
  });

  it('renders account section', () => {
    const { getByText } = render(<SettingsScreen navigation={mockNavigation} route={mockRoute} />);
    expect(getByText('アカウント')).toBeTruthy();
    expect(getByText('ゲスト')).toBeTruthy();
    expect(getByText('未設定')).toBeTruthy();
    expect(getByText('ログアウト')).toBeTruthy();
  });

  it('renders plan section', () => {
    const { getByText } = render(<SettingsScreen navigation={mockNavigation} route={mockRoute} />);
    expect(getByText('プラン')).toBeTruthy();
    expect(getByText('無料プラン')).toBeTruthy();
    expect(getByText('プレミアムプランにアップグレード')).toBeTruthy();
    expect(getByText('詳しく見る')).toBeTruthy();
  });

  it('renders app info section', () => {
    const { getByText } = render(<SettingsScreen navigation={mockNavigation} route={mockRoute} />);
    expect(getByText('アプリ情報')).toBeTruthy();
    expect(getByText('バージョン')).toBeTruthy();
    expect(getByText('1.0.0')).toBeTruthy();
    expect(getByText('利用規約')).toBeTruthy();
    expect(getByText('プライバシーポリシー')).toBeTruthy();
  });
});
