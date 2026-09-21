import React from 'react';
import { StyleSheet } from 'react-native';
import { render, fireEvent, act } from '@testing-library/react-native';
import { RecordCompleteScreen } from '@screens/RecordCompleteScreen';
import { colors } from '@theme/colors';
import { typography } from '@theme/typography';
import { shadows } from '@theme/shadows';

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
  replace: jest.fn(),
  popTo: jest.fn(),
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
  },
};

describe('RecordCompleteScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('御朱印が主役になっている（見出しの文字で祝わない）', () => {
    const { queryByText, getByTestId } = render(
      <RecordCompleteScreen navigation={mockNavigation} route={mockRouteNoParams} />
    );

    expect(getByTestId('stamp-image-placeholder')).toBeTruthy();
    expect(queryByText('登録完了！')).toBeNull();
  });

  /*
   * チェックマークと紙吹雪は何のアプリでも出せる。このアプリにしか出せない
   * 御朱印と地図を主役にしたので、汎用の演出は外した
   */
  it('チェックマークと紙吹雪を出さない', () => {
    const { queryByTestId } = render(
      <RecordCompleteScreen navigation={mockNavigation} route={mockRouteNoParams} />
    );

    expect(queryByTestId('checkmark-animation')).toBeNull();
    expect(queryByTestId('confetti-effect')).toBeNull();
  });

  it('renders stamp image placeholder when no params', () => {
    const { getByTestId } = render(
      <RecordCompleteScreen navigation={mockNavigation} route={mockRouteNoParams} />
    );
    expect(getByTestId('stamp-image-placeholder')).toBeTruthy();
  });

  it('枚数が渡されていなければ、数字を出さない', () => {
    const { queryByTestId } = render(
      <RecordCompleteScreen navigation={mockNavigation} route={mockRouteNoParams} />
    );

    expect(queryByTestId('stamp-total')).toBeNull();
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
        badge: { name: '初めての御朱印', description: '最初の御朱印を記録しました' },
      },
    };
    const { getByTestId, getByText } = render(
      <RecordCompleteScreen navigation={mockNavigation} route={routeWithBadge} />
    );
    expect(getByTestId('badge-animation')).toBeTruthy();
    expect(getByText('初めての御朱印')).toBeTruthy();
  });

  it('renders two action buttons', () => {
    const { getByText } = render(
      <RecordCompleteScreen navigation={mockNavigation} route={mockRouteNoParams} />
    );
    expect(getByText('もう1枚記録する')).toBeTruthy();
    expect(getByText('地図に戻る')).toBeTruthy();
  });

  it('navigates to Record on "record another" press', () => {
    const { getByTestId } = render(
      <RecordCompleteScreen navigation={mockNavigation} route={mockRouteNoParams} />
    );
    fireEvent.press(getByTestId('button-record-another'));
    expect(mockNavigation.replace).toHaveBeenCalledWith('Record', { origin: undefined });
  });

  it('既定（地図から来た）では地図に戻る', () => {
    const { getByTestId } = render(
      <RecordCompleteScreen navigation={mockNavigation} route={mockRouteNoParams} />
    );
    fireEvent.press(getByTestId('button-exit'));
    expect(mockNavigation.popTo).toHaveBeenCalledWith('MainTabs', {
      screen: 'MapTab',
      params: { screen: 'Map' },
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
      params: { badge: null },
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

    // 地図を出さないときは数え上げの合図が来ないので、最終値のまま出す
    it('地図が無いときは、通算の枚数をそのまま大きく出す', () => {
      const route = {
        key: 'test',
        name: 'RecordComplete' as const,
        params: { totalStampCount: 34 },
      };
      const { getByText } = render(
        <RecordCompleteScreen navigation={mockNavigation} route={route} />
      );

      expect(getByText('34')).toBeTruthy();
      expect(getByText('枚目')).toBeTruthy();
    });

    it('参拝日を和暦で出す（DATE のまま渡す）', () => {
      const route = {
        key: 'test',
        name: 'RecordComplete' as const,
        params: { spotName: '湯島天満宮', visitedAt: '2026-09-20' },
      };
      const { getByTestId } = render(
        <RecordCompleteScreen navigation={mockNavigation} route={route} />
      );

      expect(getByTestId('visited-at').props.children).toContain('9月20日');
    });
  });

  describe('with badge', () => {
    const mockRouteWithBadge = {
      key: 'test',
      name: 'RecordComplete' as const,
      params: {
        stampImageUrl: 'https://example.com/stamps/user-1/12345.jpg',
        spotName: '大崎八幡宮',
        badge: { name: '初めての御朱印', description: '初めての御朱印を記録しました' },
      },
    };

    it('navigates to Record when "record another" is pressed with badge', () => {
      const { getByTestId } = render(
        <RecordCompleteScreen navigation={mockNavigation} route={mockRouteWithBadge} />
      );
      fireEvent.press(getByTestId('button-record-another'));
      expect(mockNavigation.replace).toHaveBeenCalledWith('Record', { origin: undefined });
    });

    it('バッジがあっても地図に戻る', () => {
      const { getByTestId } = render(
        <RecordCompleteScreen navigation={mockNavigation} route={mockRouteWithBadge} />
      );
      fireEvent.press(getByTestId('button-exit'));
      expect(mockNavigation.popTo).toHaveBeenCalledWith('MainTabs', {
        screen: 'MapTab',
        params: { screen: 'Map' },
      });
    });

    it('バッジは御朱印と地図のあとに出す', () => {
      const { getByTestId } = render(
        <RecordCompleteScreen navigation={mockNavigation} route={mockRouteWithBadge} />
      );

      expect(getByTestId('badge-animation')).toBeTruthy();
    });
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
  /*
   * 嘘の数字を祝わない。保存はできているので画面は出すが、数字と地図は出さない
   * （Issue #133）
   */
  it('取得に失敗したら、数字も地図も出さない', () => {
    const { queryByTestId, getByTestId } = render(
      <RecordCompleteScreen navigation={mockNavigation} route={routeCountUnavailable} />
    );

    expect(queryByTestId('stamp-total')).toBeNull();
    expect(queryByTestId('save-map')).toBeNull();
    expect(getByTestId('visit-count-unavailable')).toBeTruthy();
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

    expect(style.color).toBe(colors.gray[500]);
    expect(style.fontSize).toBe(typography.caption.fontSize);
  });
});

describe('来た場所に戻す（origin）', () => {
  const routeWith = (origin?: 'map' | 'gallery') =>
    ({ key: 'RecordComplete', name: 'RecordComplete', params: origin ? { origin } : {} }) as never;

  it('御朱印帳から来たら「御朱印帳に戻る」と出す', () => {
    const { getByText, queryByText } = render(
      <RecordCompleteScreen navigation={mockNavigation} route={routeWith('gallery')} />
    );

    expect(getByText('御朱印帳に戻る')).toBeTruthy();
    expect(queryByText('地図に戻る')).toBeNull();
  });

  it('御朱印帳から来たら御朱印帳へ戻る', () => {
    const { getByTestId } = render(
      <RecordCompleteScreen navigation={mockNavigation} route={routeWith('gallery')} />
    );

    fireEvent.press(getByTestId('button-exit'));

    expect(mockNavigation.popTo).toHaveBeenCalledWith('MainTabs', {
      screen: 'GalleryTab',
      params: { screen: 'Gallery' },
    });
  });

  // 「もう1枚記録する」を挟むと origin が落ち、2周目が地図に戻ってしまう
  it('もう1枚記録するときも origin を引き継ぐ', () => {
    const { getByTestId } = render(
      <RecordCompleteScreen navigation={mockNavigation} route={routeWith('gallery')} />
    );

    fireEvent.press(getByTestId('button-record-another'));

    expect(mockNavigation.replace).toHaveBeenCalledWith('Record', { origin: 'gallery' });
  });

  it('地図から来たら地図へ戻る', () => {
    const { getByText, getByTestId } = render(
      <RecordCompleteScreen navigation={mockNavigation} route={routeWith('map')} />
    );
    expect(getByText('地図に戻る')).toBeTruthy();

    fireEvent.press(getByTestId('button-exit'));

    expect(mockNavigation.popTo).toHaveBeenCalledWith('MainTabs', {
      screen: 'MapTab',
      params: { screen: 'Map' },
    });
  });

  // 既存の記録から遷移してくる経路が増えても、地図に戻れば迷子にはならない
  it('origin が無ければ地図に戻る', () => {
    const { getByText } = render(
      <RecordCompleteScreen navigation={mockNavigation} route={routeWith(undefined)} />
    );

    expect(getByText('地図に戻る')).toBeTruthy();
  });
});

describe('お祝いの場に置かないもの', () => {
  it('記録を取り消す導線を出さない', () => {
    // 消す手段は御朱印帳にある。登録を祝う画面で破棄を勧めない
    const { queryByTestId, queryByText } = render(
      <RecordCompleteScreen
        navigation={mockNavigation}
        route={
          {
            key: 'RecordComplete',
            name: 'RecordComplete',
            params: { stampId: 'stamp-1', imagePath: 'path/to.jpg' },
          } as never
        }
      />
    );

    expect(queryByTestId('button-undo-record')).toBeNull();
    expect(queryByText('記録を取り消す')).toBeNull();
  });

  it('あゆみを見る導線を出さない', () => {
    // この画面が既にあゆみの要約（枚数・スポット名・バッジ）になっている
    const { queryByTestId, queryByText } = render(
      <RecordCompleteScreen navigation={mockNavigation} route={mockRouteNoParams} />
    );

    expect(queryByTestId('button-view-collection')).toBeNull();
    expect(queryByText('あゆみを見る')).toBeNull();
  });
});

describe('行き先をアイコンで示す', () => {
  it('2つのボタンがタブバーと同じアイコンを使う', () => {
    const { getByTestId } = render(
      <RecordCompleteScreen navigation={mockNavigation} route={mockRouteNoParams} />
    );

    expect(getByTestId('button-record-another').findByProps({ name: 'add-a-photo' })).toBeTruthy();
    // 地図タブと同じ explore
    expect(getByTestId('button-exit').findByProps({ name: 'explore' })).toBeTruthy();
  });

  it('御朱印帳に戻るときは御朱印帳タブと同じアイコンを使う', () => {
    const { getByTestId } = render(
      <RecordCompleteScreen
        navigation={mockNavigation}
        route={
          { key: 'RecordComplete', name: 'RecordComplete', params: { origin: 'gallery' } } as never
        }
      />
    );

    expect(getByTestId('button-exit').findByProps({ name: 'menu-book' })).toBeTruthy();
  });
});

// Issue #180: まとめて登録すると、表示できるのは先頭の1枚だけになる
describe('まとめて登録したときの枚数表示', () => {
  const routeWith = (stampCount?: number) =>
    ({
      key: 'test',
      name: 'RecordComplete' as const,
      params: {
        stampImageUrl: 'https://example.com/stamps/user-1/12345.jpg',
        spotName: '大崎八幡宮',
        stampCount,
      },
    }) as any;

  it('2枚以上なら枚数を出す', () => {
    const { getByTestId } = render(
      <RecordCompleteScreen navigation={mockNavigation} route={routeWith(5)} />
    );

    expect(getByTestId('stamp-count').props.children).toContain('5枚');
  });

  it('1枚なら枚数を出さない', () => {
    const { queryByTestId } = render(
      <RecordCompleteScreen navigation={mockNavigation} route={routeWith(1)} />
    );

    expect(queryByTestId('stamp-count')).toBeNull();
  });

  it('枚数が渡されなくても落ちない', () => {
    const { queryByTestId } = render(
      <RecordCompleteScreen navigation={mockNavigation} route={routeWith(undefined)} />
    );

    expect(queryByTestId('stamp-count')).toBeNull();
  });

  // 5枚もらっても訪問した場所は1つ。件数は箇所数のまま
  it('まとめ枚数と通算の枚数を混ぜない', () => {
    const route = routeWith(5);
    route.params.totalStampCount = 34;

    const { getByTestId, getByText } = render(
      <RecordCompleteScreen navigation={mockNavigation} route={route} />
    );

    expect(getByTestId('stamp-count').props.children).toBe('この日 5枚');
    // 地図が無い経路なので、通算はそのまま出る
    expect(getByText('34')).toBeTruthy();
  });
});

// React Navigation v7 の navigate は、同じ名前の画面が履歴にあっても
// 戻らず push する（StackRouter の NAVIGATE は payload.pop のときだけ戻る）。
// そのため「もう1枚」で記録画面を重ねると、✕ がここへ帰ってきていた（Issue #188）
describe('この画面を履歴に残さない', () => {
  const route = (origin?: 'map' | 'gallery') =>
    ({
      key: 'test',
      name: 'RecordComplete' as const,
      params: { stampImageUrl: 'https://example.com/a.jpg', spotName: '大崎八幡宮', origin },
    }) as any;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('「もう1枚記録する」はこの画面を置き換える', () => {
    const { getByTestId } = render(
      <RecordCompleteScreen navigation={mockNavigation} route={route('gallery')} />
    );

    fireEvent.press(getByTestId('button-record-another'));

    expect(mockNavigation.replace).toHaveBeenCalledWith('Record', { origin: 'gallery' });
    expect(mockNavigation.navigate).not.toHaveBeenCalled();
  });

  it('出口は履歴を伸ばさず、元のタブまで戻る', () => {
    const { getByTestId } = render(
      <RecordCompleteScreen navigation={mockNavigation} route={route('gallery')} />
    );

    fireEvent.press(getByTestId('button-exit'));

    expect(mockNavigation.popTo).toHaveBeenCalledWith('MainTabs', {
      screen: 'GalleryTab',
      params: { screen: 'Gallery' },
    });
    expect(mockNavigation.navigate).not.toHaveBeenCalled();
  });

  it('来た場所が分からなければ地図へ戻る', () => {
    const { getByTestId } = render(
      <RecordCompleteScreen navigation={mockNavigation} route={route(undefined)} />
    );

    fireEvent.press(getByTestId('button-exit'));

    expect(mockNavigation.popTo).toHaveBeenCalledWith('MainTabs', {
      screen: 'MapTab',
      params: { screen: 'Map' },
    });
  });
});

describe('保存した県が色づく', () => {
  const routeWithMap = (params: Record<string, unknown> = {}) =>
    ({
      key: 'test',
      name: 'RecordComplete' as const,
      params: {
        prefecture: '東京都',
        stampCountByPrefecture: { 東京都: 1, 宮城県: 9 },
        totalStampCount: 34,
        spotName: '湯島天満宮',
        ...params,
      },
    }) as never;

  it('地図を出して、その県へ寄る', () => {
    const { getByTestId } = render(
      <RecordCompleteScreen navigation={mockNavigation} route={routeWithMap()} />
    );

    expect(getByTestId('save-map')).toBeTruthy();
    expect(getByTestId('save-map-pin')).toBeTruthy();
  });

  it('その県が初めてのときだけチップを出す', () => {
    const { getByTestId } = render(
      <RecordCompleteScreen
        navigation={mockNavigation}
        route={routeWithMap({ isFirstInPrefecture: true })}
      />
    );
    expect(getByTestId('first-in-prefecture').props.children.props.children).toBe(
      '🗾 東京都、はじめて'
    );

    const { queryByTestId } = render(
      <RecordCompleteScreen
        navigation={mockNavigation}
        route={routeWithMap({ isFirstInPrefecture: false })}
      />
    );
    expect(queryByTestId('first-in-prefecture')).toBeNull();
  });

  it('県が分からなければ地図を出さない', () => {
    const { queryByTestId } = render(
      <RecordCompleteScreen
        navigation={mockNavigation}
        route={routeWithMap({ prefecture: undefined })}
      />
    );

    expect(queryByTestId('save-map')).toBeNull();
  });
});

describe('枚数が数え上がる', () => {
  const routeCounting = {
    key: 'test',
    name: 'RecordComplete' as const,
    params: {
      prefecture: '東京都',
      stampCountByPrefecture: { 東京都: 1 },
      totalStampCount: 34,
      stampCount: 2,
    },
  } as never;

  /*
   * いきなり最後の数字が出ていると、「増えた」ではなく「そういう数字だった」に
   * 見える。地図が色づくのに合わせて数え上げる
   */
  it('地図が色づいてから、まとめた枚数ぶん数え上がる', async () => {
    jest.useFakeTimers();
    const { getByTestId, UNSAFE_getByType } = render(
      <RecordCompleteScreen navigation={mockNavigation} route={routeCounting} />
    );
    // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
    const { SaveMapReveal } = require('@components/record/SaveMapReveal');

    const shown = () => getByTestId('stamp-total').children[0].props.children;

    // 合図が来る前から、数え始めの値が出ている（最終値を先に出さない）
    expect(shown()).toBe(32);

    act(() => UNSAFE_getByType(SaveMapReveal).props.onSettled());
    expect(shown()).toBe(32);

    act(() => jest.advanceTimersByTime(90));
    expect(shown()).toBe(33);

    act(() => jest.advanceTimersByTime(90));
    expect(shown()).toBe(34);
    jest.useRealTimers();
  });

  // 取得に失敗したら数字も地図もチップも出さない（嘘の数字を祝わない）
  it('取得に失敗したら「はじめて」チップも出さない', () => {
    const route = {
      key: 'test',
      name: 'RecordComplete' as const,
      params: { countUnavailable: true, isFirstInPrefecture: true, prefecture: '東京都' },
    } as never;
    const { queryByTestId } = render(
      <RecordCompleteScreen navigation={mockNavigation} route={route} />
    );

    expect(queryByTestId('first-in-prefecture')).toBeNull();
    expect(queryByTestId('stamp-total')).toBeNull();
    expect(queryByTestId('save-map')).toBeNull();
  });
});

// 御朱印は主役。地から浮かせる（影は枠側。Image に影は乗らない）
it('御朱印が影で浮いている（トークン由来）', () => {
  const { getByTestId } = render(
    <RecordCompleteScreen navigation={mockNavigation} route={mockRouteWithParams} />
  );
  const style = StyleSheet.flatten(getByTestId('stamp-frame').props.style);

  expect(style.shadowOpacity).toBe(shadows.lg.shadowOpacity);
  expect(style.shadowRadius).toBe(shadows.lg.shadowRadius);
  expect(style.elevation).toBe(shadows.lg.elevation);
});
