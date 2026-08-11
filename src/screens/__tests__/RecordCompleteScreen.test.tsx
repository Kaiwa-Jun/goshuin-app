import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { Alert, StyleSheet, Text } from 'react-native';
import { RecordCompleteScreen } from '@screens/RecordCompleteScreen';
import { colors } from '@theme/colors';
import { typography } from '@theme/typography';

const mockDeleteStamp = jest.fn();

jest.mock('@services/stamps', () => ({
  deleteStamp: (...args: unknown[]) => mockDeleteStamp(...args),
}));

jest.mock('react-native-safe-area-context', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
  const { View } = require('react-native');
  return {
    SafeAreaView: View,
    SafeAreaProvider: View,
    useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  };
});

jest.mock('expo-linear-gradient', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
  const { View } = require('react-native');
  return {
    LinearGradient: ({ children, testID, ...props }: any) => (
      <View testID={testID} {...props}>
        {children}
      </View>
    ),
  };
});

const mockNavigation = {
  navigate: jest.fn(),
  goBack: jest.fn(),
  getParent: jest.fn(() => ({ navigate: jest.fn() })),
} as any;

const mockRouteNoParams = {
  key: 'test',
  name: 'RecordComplete' as const,
  params: undefined,
};

const mockRouteWithParams = {
  key: 'test',
  name: 'RecordComplete' as const,
  params: {
    stampImageUrl: 'https://example.com/stamps/user-1/12345.jpg',
    spotName: '大崎八幡宮',
    visitCount: 5,
  },
};

describe('RecordCompleteScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders without crashing', () => {
    const { getByText } = render(
      <RecordCompleteScreen navigation={mockNavigation} route={mockRouteNoParams} />
    );
    expect(getByText('登録完了！')).toBeTruthy();
  });

  it('renders checkmark animation', () => {
    const { getByTestId } = render(
      <RecordCompleteScreen navigation={mockNavigation} route={mockRouteNoParams} />
    );
    expect(getByTestId('checkmark-animation')).toBeTruthy();
  });

  it('renders stamp image placeholder when no params', () => {
    const { getByTestId } = render(
      <RecordCompleteScreen navigation={mockNavigation} route={mockRouteNoParams} />
    );
    expect(getByTestId('stamp-image-placeholder')).toBeTruthy();
  });

  it('renders default count text when no visitCount', () => {
    const { getByText } = render(
      <RecordCompleteScreen navigation={mockNavigation} route={mockRouteNoParams} />
    );
    expect(getByText('御朱印を記録しました！')).toBeTruthy();
  });

  it('does not render badge animation when no badge param', () => {
    const { queryByTestId } = render(
      <RecordCompleteScreen navigation={mockNavigation} route={mockRouteNoParams} />
    );
    expect(queryByTestId('badge-animation')).toBeNull();
  });

  it('renders badge animation when badge param is provided', () => {
    const routeWithBadge = {
      key: 'test',
      name: 'RecordComplete' as const,
      params: {
        stampImageUrl: undefined,
        spotName: undefined,
        visitCount: 1,
        badge: { name: '初めての御朱印', description: '最初の御朱印を記録しました' },
      },
    };
    const { getByTestId, getByText } = render(
      <RecordCompleteScreen navigation={mockNavigation} route={routeWithBadge} />
    );
    expect(getByTestId('badge-animation')).toBeTruthy();
    expect(getByText('初めての御朱印')).toBeTruthy();
  });

  it('renders three action buttons', () => {
    const { getByText } = render(
      <RecordCompleteScreen navigation={mockNavigation} route={mockRouteNoParams} />
    );
    expect(getByText('もう1枚記録する')).toBeTruthy();
    expect(getByText('地図を見る')).toBeTruthy();
    expect(getByText('あつめるを見る')).toBeTruthy();
  });

  it('navigates to Record on "record another" press', () => {
    const { getByTestId } = render(
      <RecordCompleteScreen navigation={mockNavigation} route={mockRouteNoParams} />
    );
    fireEvent.press(getByTestId('button-record-another'));
    expect(mockNavigation.navigate).toHaveBeenCalledWith('Record');
  });

  it('navigates to MainTabs on "view map" press', () => {
    const { getByTestId } = render(
      <RecordCompleteScreen navigation={mockNavigation} route={mockRouteNoParams} />
    );
    fireEvent.press(getByTestId('button-view-map'));
    expect(mockNavigation.navigate).toHaveBeenCalledWith('MainTabs', {
      screen: 'MapTab',
      params: { screen: 'Map' },
    });
  });

  it('navigates to Collection on "view collection" press', () => {
    const { getByTestId } = render(
      <RecordCompleteScreen navigation={mockNavigation} route={mockRouteNoParams} />
    );
    fireEvent.press(getByTestId('button-view-collection'));
    expect(mockNavigation.navigate).toHaveBeenCalledWith('MainTabs', {
      screen: 'CollectionTab',
      params: { screen: 'CollectionList' },
    });
  });

  it('renders gradient background', () => {
    const { getByTestId } = render(
      <RecordCompleteScreen navigation={mockNavigation} route={mockRouteNoParams} />
    );
    expect(getByTestId('gradient-background')).toBeTruthy();
  });

  it('does not render badge animation when badge is null', () => {
    const routeWithNullBadge = {
      key: 'test',
      name: 'RecordComplete' as const,
      params: { visitCount: 5, badge: null },
    };
    const { queryByTestId } = render(
      <RecordCompleteScreen navigation={mockNavigation} route={routeWithNullBadge} />
    );
    expect(queryByTestId('badge-animation')).toBeNull();
  });

  it('renders badge description when badge is provided', () => {
    const routeWithBadge = {
      key: 'test',
      name: 'RecordComplete' as const,
      params: {
        visitCount: 1,
        badge: { name: '初めての御朱印', description: '初めての御朱印を記録しました' },
      },
    };
    const { getByText } = render(
      <RecordCompleteScreen navigation={mockNavigation} route={routeWithBadge} />
    );
    expect(getByText('初めての御朱印')).toBeTruthy();
    expect(getByText('初めての御朱印を記録しました')).toBeTruthy();
  });

  describe('with params', () => {
    it('renders stamp image when stampImageUrl is provided', () => {
      const { getByTestId } = render(
        <RecordCompleteScreen navigation={mockNavigation} route={mockRouteWithParams} />
      );
      expect(getByTestId('stamp-image')).toBeTruthy();
    });

    it('renders spot name when provided', () => {
      const { getByText } = render(
        <RecordCompleteScreen navigation={mockNavigation} route={mockRouteWithParams} />
      );
      expect(getByText('大崎八幡宮')).toBeTruthy();
    });

    it('renders visit count text when visitCount is provided', () => {
      const { getByText } = render(
        <RecordCompleteScreen navigation={mockNavigation} route={mockRouteWithParams} />
      );
      expect(getByText('5箇所目の御朱印！')).toBeTruthy();
    });

    it('renders "1箇所目の御朱印！" for visitCount=1', () => {
      const routeCount1 = {
        key: 'test',
        name: 'RecordComplete' as const,
        params: { visitCount: 1 },
      };
      const { getByText } = render(
        <RecordCompleteScreen navigation={mockNavigation} route={routeCount1} />
      );
      expect(getByText('1箇所目の御朱印！')).toBeTruthy();
    });

    it('renders "33箇所目の御朱印！" for visitCount=33', () => {
      const routeCount33 = {
        key: 'test',
        name: 'RecordComplete' as const,
        params: { visitCount: 33 },
      };
      const { getByText } = render(
        <RecordCompleteScreen navigation={mockNavigation} route={routeCount33} />
      );
      expect(getByText('33箇所目の御朱印！')).toBeTruthy();
    });
  });

  describe('with badge', () => {
    const mockRouteWithBadge = {
      key: 'test',
      name: 'RecordComplete' as const,
      params: {
        stampImageUrl: 'https://example.com/stamps/user-1/12345.jpg',
        spotName: '大崎八幡宮',
        visitCount: 1,
        badge: { name: '初めての御朱印', description: '初めての御朱印を記録しました' },
      },
    };

    it('navigates to Record when "record another" is pressed with badge', () => {
      const { getByTestId } = render(
        <RecordCompleteScreen navigation={mockNavigation} route={mockRouteWithBadge} />
      );
      fireEvent.press(getByTestId('button-record-another'));
      expect(mockNavigation.navigate).toHaveBeenCalledWith('Record');
    });

    it('navigates to Map when "view map" is pressed with badge', () => {
      const { getByTestId } = render(
        <RecordCompleteScreen navigation={mockNavigation} route={mockRouteWithBadge} />
      );
      fireEvent.press(getByTestId('button-view-map'));
      expect(mockNavigation.navigate).toHaveBeenCalledWith('MainTabs', {
        screen: 'MapTab',
        params: { screen: 'Map' },
      });
    });

    it('navigates to Collection when "view collection" is pressed with badge', () => {
      const { getByTestId } = render(
        <RecordCompleteScreen navigation={mockNavigation} route={mockRouteWithBadge} />
      );
      fireEvent.press(getByTestId('button-view-collection'));
      expect(mockNavigation.navigate).toHaveBeenCalledWith('MainTabs', {
        screen: 'CollectionTab',
        params: { screen: 'CollectionList' },
      });
    });

    it('renders both badge animation and visit count when both are provided', () => {
      const { getByTestId, getByText } = render(
        <RecordCompleteScreen navigation={mockNavigation} route={mockRouteWithBadge} />
      );
      expect(getByText('1箇所目の御朱印！')).toBeTruthy();
      expect(getByTestId('badge-animation')).toBeTruthy();
    });
  });
});

describe('記録の取り消し（Issue #130 / D-3）', () => {
  const routeWithUndo = {
    key: 'test',
    name: 'RecordComplete' as const,
    params: {
      stampImageUrl: 'https://example.com/stamps/user-1/12345.jpg',
      spotName: '大崎八幡宮',
      visitCount: 5,
      stampId: 'stamp-1',
      imagePath: 'user-1/12345.jpg',
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // B-3
  it('stampId と imagePath が揃っていれば取り消しボタンを出す', () => {
    const { getByTestId } = render(
      <RecordCompleteScreen navigation={mockNavigation} route={routeWithUndo} />
    );
    expect(getByTestId('button-undo-record')).toBeTruthy();
  });

  // B-4: 旧来の遷移や params 欠落で押せる取り消しを出さない
  it('stampId が無ければ取り消しボタンを出さない', () => {
    const { queryByTestId } = render(
      <RecordCompleteScreen navigation={mockNavigation} route={mockRouteWithParams} />
    );
    expect(queryByTestId('button-undo-record')).toBeNull();
  });

  it('imagePath が無ければ取り消しボタンを出さない', () => {
    const route = {
      ...routeWithUndo,
      params: { ...routeWithUndo.params, imagePath: undefined },
    };
    const { queryByTestId } = render(
      <RecordCompleteScreen navigation={mockNavigation} route={route} />
    );
    expect(queryByTestId('button-undo-record')).toBeNull();
  });

  // B-5: 取り消しは非可逆なので、確認を挟むまで消さない
  it('タップした時点では削除せず確認 Alert を出す', () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});

    const { getByTestId } = render(
      <RecordCompleteScreen navigation={mockNavigation} route={routeWithUndo} />
    );
    fireEvent.press(getByTestId('button-undo-record'));

    expect(alertSpy).toHaveBeenCalled();
    expect(mockDeleteStamp).not.toHaveBeenCalled();
  });

  // B-6 / B-7
  it('確認すると deleteStamp を呼び、成功したら地図へ戻る', async () => {
    mockDeleteStamp.mockResolvedValue(undefined);
    jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, buttons) => {
      const destructive = buttons?.find(b => b.style === 'destructive');
      destructive?.onPress?.();
    });

    const { getByTestId } = render(
      <RecordCompleteScreen navigation={mockNavigation} route={routeWithUndo} />
    );
    fireEvent.press(getByTestId('button-undo-record'));

    await waitFor(() => {
      expect(mockDeleteStamp).toHaveBeenCalledWith('stamp-1', 'user-1/12345.jpg');
    });
    await waitFor(() => {
      expect(mockNavigation.navigate).toHaveBeenCalledWith('MainTabs', {
        screen: 'MapTab',
        params: { screen: 'Map' },
      });
    });
  });

  // B-8: 消せていないのに消えた顔をしない
  it('削除に失敗したらエラー原文を出し、画面に留まる', async () => {
    mockDeleteStamp.mockRejectedValue(new Error('delete failed (code=42501)'));
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, buttons) => {
      const destructive = buttons?.find(b => b.style === 'destructive');
      destructive?.onPress?.();
    });

    const { getByTestId } = render(
      <RecordCompleteScreen navigation={mockNavigation} route={routeWithUndo} />
    );
    fireEvent.press(getByTestId('button-undo-record'));

    await waitFor(() => {
      const messages = alertSpy.mock.calls.map(c => `${c[0]} ${c[1]}`).join('\n');
      expect(messages).toContain('delete failed (code=42501)');
    });
    expect(mockNavigation.navigate).not.toHaveBeenCalled();
  });

  // B-9: 誤タップを避けるため主導線の後ろに置く
  it('取り消しボタンは既存3ボタンより後に描画される', () => {
    const { toJSON } = render(
      <RecordCompleteScreen navigation={mockNavigation} route={routeWithUndo} />
    );

    const tracked = [
      'button-record-another',
      'button-view-map',
      'button-view-collection',
      'button-undo-record',
    ];

    // 描画ツリーを深さ優先で辿り、testID の出現順を取る
    const order: string[] = [];
    const walk = (node: any) => {
      if (!node || typeof node !== 'object') return;
      const id = node.props?.testID;
      if (id && tracked.includes(id)) order.push(id);
      (node.children ?? []).forEach(walk);
    };
    walk(toJSON());

    expect(order).toEqual(tracked);
  });

  // B-10: 直値の色を書かない（CLAUDE.md のトークン規約）
  it('取り消しボタンの文字色がテーマトークン由来である', () => {
    const { getByTestId } = render(
      <RecordCompleteScreen navigation={mockNavigation} route={routeWithUndo} />
    );
    const undo = getByTestId('button-undo-record');
    const label = undo.findByType(Text);
    const style = StyleSheet.flatten(label.props.style);

    expect(style.color).toBe(colors.white);
  });
});

// 訪問済みスポットの取得に失敗すると件数もバッジも算出できない。
// 誤った数字を祝うより出さないほうがよいが、黙って消すと壊れていることに気づけないので
// 理由だけを1行添える（Issue #133 / D-3）
describe('記録数を算出できなかったときの注記（Issue #133）', () => {
  const routeCountUnavailable = {
    key: 'test',
    name: 'RecordComplete' as const,
    params: {
      stampImageUrl: 'https://example.com/stamps/user-1/12345.jpg',
      spotName: '大崎八幡宮',
      countUnavailable: true,
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // C-2
  it('countUnavailable が true なら理由の注記を出す', () => {
    const { getByTestId } = render(
      <RecordCompleteScreen navigation={mockNavigation} route={routeCountUnavailable} />
    );

    expect(getByTestId('visit-count-unavailable').props.children).toBe(
      '通信エラーのため記録数を表示できません'
    );
  });

  // C-3: 通常の記録では出さない
  it('countUnavailable が未指定なら注記を出さない', () => {
    const { queryByTestId } = render(
      <RecordCompleteScreen navigation={mockNavigation} route={mockRouteWithParams} />
    );

    expect(queryByTestId('visit-count-unavailable')).toBeNull();
  });

  // C-4
  it('countUnavailable が false なら注記を出さない', () => {
    const route = {
      ...routeCountUnavailable,
      params: { ...routeCountUnavailable.params, countUnavailable: false },
    };
    const { queryByTestId } = render(
      <RecordCompleteScreen navigation={mockNavigation} route={route} />
    );

    expect(queryByTestId('visit-count-unavailable')).toBeNull();
  });

  // C-5: 件数を出せない代わりに、記録できたことは既存のフォールバック文言が伝える
  it('visitCount が無ければ既存のフォールバック文言を出す', () => {
    const { getByTestId } = render(
      <RecordCompleteScreen navigation={mockNavigation} route={routeCountUnavailable} />
    );

    expect(getByTestId('visit-count').props.children).toBe('御朱印を記録しました！');
  });

  // C-6: 判定材料が無い以上、獲得済みバッジを再発火させない
  it('badge が無ければバッジアニメーションを出さない', () => {
    const { queryByTestId } = render(
      <RecordCompleteScreen navigation={mockNavigation} route={routeCountUnavailable} />
    );

    expect(queryByTestId('badge-animation')).toBeNull();
  });

  // C-7: 直値の色・文字サイズを書かない（CLAUDE.md のトークン規約）
  it('注記のスタイルがテーマトークン由来である', () => {
    const { getByTestId } = render(
      <RecordCompleteScreen navigation={mockNavigation} route={routeCountUnavailable} />
    );
    const style = StyleSheet.flatten(getByTestId('visit-count-unavailable').props.style);

    expect(style.color).toBe(colors.white);
    expect(style.fontSize).toBe(typography.caption.fontSize);
  });

  // C-8: 何の件数が出ていないのかが分かるよう、件数テキストの直下に置く
  it('注記は件数テキストの直後に描画される', () => {
    const { toJSON } = render(
      <RecordCompleteScreen navigation={mockNavigation} route={routeCountUnavailable} />
    );

    const tracked = ['spot-name', 'visit-count', 'visit-count-unavailable'];
    const order: string[] = [];
    const walk = (node: any) => {
      if (!node || typeof node !== 'object') return;
      const id = node.props?.testID;
      if (id && tracked.includes(id)) order.push(id);
      (node.children ?? []).forEach(walk);
    };
    walk(toJSON());

    expect(order).toEqual(tracked);
  });
});
