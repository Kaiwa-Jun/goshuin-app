import React from 'react';
import { render, fireEvent, act } from '@testing-library/react-native';
import { AppState, Linking } from 'react-native';
import * as Location from 'expo-location';

import { ErrorScreen } from '../ErrorScreen';
import type { RootStackScreenProps } from '@/navigation/types';

jest.mock('expo-location', () => ({
  getForegroundPermissionsAsync: jest.fn(),
}));

jest.mock('react-native-safe-area-context', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
  const RN = require('react-native');
  return {
    SafeAreaView: RN.View,
    SafeAreaProvider: RN.View,
    useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  };
});

const mockPop = jest.fn();

const mockNavigation = {
  navigate: jest.fn(),
  goBack: jest.fn(),
  pop: mockPop,
  getParent: jest.fn(() => ({ navigate: jest.fn() })),
} as unknown as RootStackScreenProps<'Error'>['navigation'];

describe('ErrorScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Linking, 'openSettings').mockResolvedValue(undefined as never);
  });

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

  it('calls pop(2) on secondary button press when origin is record', () => {
    const mockRoute = {
      key: 'test',
      name: 'Error' as const,
      params: { type: 'upload' as const, origin: 'record' as const },
    } as unknown as RootStackScreenProps<'Error'>['route'];

    const { getByText } = render(<ErrorScreen navigation={mockNavigation} route={mockRoute} />);
    fireEvent.press(getByText('キャンセル'));
    expect(mockPop).toHaveBeenCalledWith(2);
  });

  it('calls goBack on secondary button press when origin is not set', () => {
    const mockRoute = {
      key: 'test',
      name: 'Error' as const,
      params: { type: 'upload' as const },
    } as unknown as RootStackScreenProps<'Error'>['route'];

    const { getByText } = render(<ErrorScreen navigation={mockNavigation} route={mockRoute} />);
    fireEvent.press(getByText('キャンセル'));
    expect(mockNavigation.goBack).toHaveBeenCalled();
    expect(mockPop).not.toHaveBeenCalled();
  });

  it('calls Linking.openSettings on primary button press for location error', () => {
    const mockRoute = {
      key: 'test',
      name: 'Error' as const,
      params: { type: 'location' as const },
    } as unknown as RootStackScreenProps<'Error'>['route'];

    const { getByText } = render(<ErrorScreen navigation={mockNavigation} route={mockRoute} />);
    fireEvent.press(getByText('設定を開く'));
    expect(Linking.openSettings).toHaveBeenCalled();
    expect(mockNavigation.goBack).not.toHaveBeenCalled();
  });

  it('calls navigation.goBack on primary button press for network error', () => {
    const mockRoute = {
      key: 'test',
      name: 'Error' as const,
      params: { type: 'network' as const },
    } as unknown as RootStackScreenProps<'Error'>['route'];

    const { getByText } = render(<ErrorScreen navigation={mockNavigation} route={mockRoute} />);
    fireEvent.press(getByText('再試行'));
    expect(mockNavigation.goBack).toHaveBeenCalled();
    expect(Linking.openSettings).not.toHaveBeenCalled();
  });

  it('calls navigation.goBack on primary button press for upload error', () => {
    const mockRoute = {
      key: 'test',
      name: 'Error' as const,
      params: { type: 'upload' as const },
    } as unknown as RootStackScreenProps<'Error'>['route'];

    const { getByText } = render(<ErrorScreen navigation={mockNavigation} route={mockRoute} />);
    fireEvent.press(getByText('再試行'));
    expect(mockNavigation.goBack).toHaveBeenCalled();
    expect(Linking.openSettings).not.toHaveBeenCalled();
  });

  describe('AppState監視（location error）', () => {
    let appStateCallback: ((state: string) => void) | null = null;
    const mockRemove = jest.fn();

    beforeEach(() => {
      appStateCallback = null;
      mockRemove.mockClear();
      jest.spyOn(AppState, 'addEventListener').mockImplementation((event, callback) => {
        if (event === 'change') {
          appStateCallback = callback as (state: string) => void;
        }
        return { remove: mockRemove };
      });
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('location error で background → active かつ permission granted なら goBack が呼ばれる', async () => {
      (Location.getForegroundPermissionsAsync as jest.Mock).mockResolvedValue({
        status: 'granted',
      });

      Object.defineProperty(AppState, 'currentState', {
        get: () => 'background',
        configurable: true,
      });

      const mockRoute = {
        key: 'test',
        name: 'Error' as const,
        params: { type: 'location' as const },
      } as unknown as RootStackScreenProps<'Error'>['route'];

      render(<ErrorScreen navigation={mockNavigation} route={mockRoute} />);

      await act(async () => {
        appStateCallback?.('active');
      });

      expect(mockNavigation.goBack).toHaveBeenCalled();
    });

    it('location error で background → active かつ permission denied なら goBack は呼ばれない', async () => {
      (Location.getForegroundPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'denied' });

      Object.defineProperty(AppState, 'currentState', {
        get: () => 'background',
        configurable: true,
      });

      const mockRoute = {
        key: 'test',
        name: 'Error' as const,
        params: { type: 'location' as const },
      } as unknown as RootStackScreenProps<'Error'>['route'];

      render(<ErrorScreen navigation={mockNavigation} route={mockRoute} />);

      await act(async () => {
        appStateCallback?.('active');
      });

      expect(mockNavigation.goBack).not.toHaveBeenCalled();
    });

    it('network error では AppState リスナーが登録されない', () => {
      const mockRoute = {
        key: 'test',
        name: 'Error' as const,
        params: { type: 'network' as const },
      } as unknown as RootStackScreenProps<'Error'>['route'];

      render(<ErrorScreen navigation={mockNavigation} route={mockRoute} />);

      expect(AppState.addEventListener).not.toHaveBeenCalled();
    });
  });
});
