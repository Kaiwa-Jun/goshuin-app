import React from 'react';
import { render } from '@testing-library/react-native';

import { ErrorScreen } from '../ErrorScreen';
import type { RootStackScreenProps } from '@/navigation/types';

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
} as unknown as RootStackScreenProps<'Error'>['navigation'];

describe('ErrorScreen', () => {
  it('renders network error type', () => {
    const mockRoute = {
      key: 'test',
      name: 'Error' as const,
      params: { type: 'network' as const },
    } as unknown as RootStackScreenProps<'Error'>['route'];

    const { getByText } = render(<ErrorScreen navigation={mockNavigation} route={mockRoute} />);
    expect(getByText('ネットワークエラー')).toBeTruthy();
    expect(getByText('インターネット接続を確認してください')).toBeTruthy();
    expect(getByText('再試行')).toBeTruthy();
  });

  it('renders location error type with secondary button', () => {
    const mockRoute = {
      key: 'test',
      name: 'Error' as const,
      params: { type: 'location' as const },
    } as unknown as RootStackScreenProps<'Error'>['route'];

    const { getByText } = render(<ErrorScreen navigation={mockNavigation} route={mockRoute} />);
    expect(getByText('位置情報エラー')).toBeTruthy();
    expect(getByText('位置情報の利用を許可してください')).toBeTruthy();
    expect(getByText('設定を開く')).toBeTruthy();
    expect(getByText('あとで設定する')).toBeTruthy();
  });

  it('renders upload error type with secondary button', () => {
    const mockRoute = {
      key: 'test',
      name: 'Error' as const,
      params: { type: 'upload' as const },
    } as unknown as RootStackScreenProps<'Error'>['route'];

    const { getByText } = render(<ErrorScreen navigation={mockNavigation} route={mockRoute} />);
    expect(getByText('アップロードエラー')).toBeTruthy();
    expect(getByText('画像のアップロードに失敗しました')).toBeTruthy();
    expect(getByText('再試行')).toBeTruthy();
    expect(getByText('キャンセル')).toBeTruthy();
  });

  it('does not render secondary button for network error', () => {
    const mockRoute = {
      key: 'test',
      name: 'Error' as const,
      params: { type: 'network' as const },
    } as unknown as RootStackScreenProps<'Error'>['route'];

    const { queryByText } = render(<ErrorScreen navigation={mockNavigation} route={mockRoute} />);
    expect(queryByText('あとで設定する')).toBeNull();
    expect(queryByText('キャンセル')).toBeNull();
  });
});
