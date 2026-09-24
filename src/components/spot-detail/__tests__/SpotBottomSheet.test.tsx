import React from 'react';
import { render, fireEvent, within } from '@testing-library/react-native';
import '@testing-library/react-native/extend-expect';
import { Animated, Dimensions, StyleSheet } from 'react-native';
import { BottomTabBarHeightContext } from '@react-navigation/bottom-tabs';
import {
  SpotBottomSheet,
  resolveCompactHeight,
  COMPACT_MIN_HEIGHT,
  COMPACT_MAX_HEIGHT,
  COMPACT_FALLBACK_HEIGHT,
  COMPACT_SCREEN_RATIO,
  sumCompactParts,
} from '../SpotBottomSheet';
import { spacing } from '@theme/spacing';
import type { Spot } from '@/types/supabase';

jest.mock('@react-navigation/bottom-tabs', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
  const ReactModule = require('react');
  return { BottomTabBarHeightContext: ReactModule.createContext(49) };
});

jest.mock('@services/stamps', () => ({
  fetchStampsBySpotId: jest.fn(() => Promise.resolve([])),
  getStampImageUrl: jest.fn((path: string) => `https://example.com/${path}`),
}));

const mockSpot: Spot = {
  id: 'spot-1',
  name: '仙台東照宮',
  lat: 38.28,
  lng: 140.88,
  type: 'shrine',
  address: '宮城県仙台市青葉区東照宮一丁目6-1',
  prefecture: null,
  status: 'active',
  rank: 3,
  created_by_user_id: null,
  merged_into_spot_id: null,
  created_at: '2024-01-01',
  updated_at: '2024-01-01',
};

jest.mock('@hooks/useSpotDetail', () => ({
  useSpotDetail: (spotId: string | null) => ({
    spot: spotId === 'spot-1' ? mockSpot : null,
    isLoading: false,
    error: null,
  }),
}));

// テストごとに差し替える（写真・限定御朱印あり / なし）
let mockStamps: unknown[] = [];
let mockPublicStamps: unknown[] = [];
let mockSpotInfo: unknown = null;

jest.mock('@hooks/useSpotStamps', () => ({
  useSpotStamps: () => ({
    stamps: mockStamps,
    publicStamps: mockPublicStamps,
    visitCount: 2,
    latestVisitDate: '2024-06-15',
    isLoading: false,
  }),
}));

jest.mock('@hooks/useSpotInfo', () => ({
  useSpotInfo: () => ({
    spotInfo: mockSpotInfo,
    isLoading: false,
  }),
}));

describe('SpotBottomSheet', () => {
  const defaultProps = {
    spotId: 'spot-1' as string | null,
    visitedSpotIds: new Set(['spot-1']),
    onDismiss: jest.fn(),
    onRecord: jest.fn(),
    wishlistSpotIds: new Set<string>(),
    onWishlistToggle: jest.fn(),
  };

  it('renders bottom sheet when spotId is provided', () => {
    const { getByTestId } = render(<SpotBottomSheet {...defaultProps} />);
    expect(getByTestId('bottom-sheet')).toBeTruthy();
  });

  it('does not render when spotId is null', () => {
    const { queryByTestId } = render(<SpotBottomSheet {...defaultProps} spotId={null} />);
    expect(queryByTestId('bottom-sheet')).toBeNull();
  });

  it('renders spot name', () => {
    const { getAllByText } = render(<SpotBottomSheet {...defaultProps} />);
    expect(getAllByText('仙台東照宮').length).toBeGreaterThanOrEqual(1);
  });

  it('renders shrine badge', () => {
    const { getAllByTestId } = render(<SpotBottomSheet {...defaultProps} />);
    expect(getAllByTestId('badge-shrine').length).toBeGreaterThanOrEqual(1);
  });

  it('renders visited badge when spot is visited', () => {
    const { getAllByTestId } = render(<SpotBottomSheet {...defaultProps} />);
    const visitedBadges = getAllByTestId('badge-visited');
    expect(visitedBadges.length).toBeGreaterThanOrEqual(1);
  });

  // A-5: 展開しても差し替わらない共通部分を持つ
  describe('共通ヘッダーと段階的な情報追加', () => {
    it('compact でヘッダーを描画する', () => {
      const { getByTestId } = render(<SpotBottomSheet {...defaultProps} />);
      expect(getByTestId('spot-sheet-header')).toBeTruthy();
    });

    it('展開してもヘッダーが同じ testID のまま残る', () => {
      const { getByTestId } = render(<SpotBottomSheet {...defaultProps} />);
      fireEvent.press(getByTestId('sheet-handle'));
      expect(getByTestId('spot-sheet-header')).toBeTruthy();
    });

    it('展開してもアクション行が残る', () => {
      const { getByTestId } = render(<SpotBottomSheet {...defaultProps} />);
      fireEvent.press(getByTestId('sheet-handle'));
      expect(getByTestId('spot-sheet-actions')).toBeTruthy();
    });

    it('展開時にヘッダーが二重に描画されない', () => {
      const { getAllByTestId, getByTestId } = render(<SpotBottomSheet {...defaultProps} />);
      fireEvent.press(getByTestId('sheet-handle'));
      expect(getAllByTestId('spot-sheet-header')).toHaveLength(1);
    });
  });

  // A-7: 記録の導線が展開しなくても届く
  describe('アクション行', () => {
    it('compact の時点で記録するボタンが出ている', () => {
      const { getByTestId } = render(<SpotBottomSheet {...defaultProps} />);
      expect(getByTestId('record-action-button')).toBeTruthy();
    });

    it('記録するのタップで onRecord に spotId を渡す', () => {
      const onRecord = jest.fn();
      const { getByTestId } = render(<SpotBottomSheet {...defaultProps} onRecord={onRecord} />);
      fireEvent.press(getByTestId('record-action-button'));
      expect(onRecord).toHaveBeenCalledWith('spot-1');
    });

    it('行きたいのタップで onWishlistToggle に spotId を渡す', () => {
      const onWishlistToggle = jest.fn();
      const { getByTestId } = render(
        <SpotBottomSheet {...defaultProps} onWishlistToggle={onWishlistToggle} />
      );
      fireEvent.press(getByTestId('wishlist-action-button'));
      expect(onWishlistToggle).toHaveBeenCalledWith('spot-1');
    });

    it('onWishlistToggle が無いとき行きたいを出さない', () => {
      const { queryByTestId } = render(
        <SpotBottomSheet {...defaultProps} onWishlistToggle={undefined} />
      );
      expect(queryByTestId('wishlist-action-button')).toBeNull();
    });
  });
});

describe('resolveCompactHeight', () => {
  const SCREEN = 800;

  it('計測値をそのまま使う（範囲内のとき）', () => {
    expect(resolveCompactHeight(260, SCREEN)).toBe(260);
  });

  it('小さすぎる値は下限に丸める', () => {
    expect(resolveCompactHeight(100, SCREEN)).toBe(COMPACT_MIN_HEIGHT);
  });

  it('大きすぎる値は上限に丸める', () => {
    expect(resolveCompactHeight(999, SCREEN)).toBe(COMPACT_MAX_HEIGHT);
  });

  it('小型端末では画面の 6 割を超えない（フッターを含めるため 0.5 → 0.6。Issue #253）', () => {
    expect(COMPACT_SCREEN_RATIO).toBe(0.6);
    expect(resolveCompactHeight(999, 618)).toBe(371);
    expect(resolveCompactHeight(999, 800)).toBe(380);
  });

  it('不正な値はフォールバックする', () => {
    expect(resolveCompactHeight(0, SCREEN)).toBe(COMPACT_FALLBACK_HEIGHT);
    expect(resolveCompactHeight(-10, SCREEN)).toBe(COMPACT_FALLBACK_HEIGHT);
    expect(resolveCompactHeight(NaN, SCREEN)).toBe(COMPACT_FALLBACK_HEIGHT);
  });
});

describe('sumCompactParts', () => {
  it('ハンドル・中身・フッターの和。未計測は 0', () => {
    expect(sumCompactParts({ handle: 20, primary: 250, footer: 70 })).toBe(340);
    expect(sumCompactParts({ handle: 20, primary: 0, footer: 70 })).toBe(90);
  });
});

/* Issue #253: 閉じても開いても並びが同じ。ボタンは下端に固定 */
describe('SpotBottomSheet — 並びが入れ替わらない（Issue #253）', () => {
  const props = {
    spotId: 'spot-1' as string | null,
    visitedSpotIds: new Set(['spot-1']),
    onDismiss: jest.fn(),
    onRecord: jest.fn(),
    wishlistSpotIds: new Set<string>(),
    onWishlistToggle: jest.fn(),
  };
  const stamp = (id: string, visited = '2026-09-01') => ({
    id,
    user_id: 'user-1',
    spot_id: 'spot-1',
    image_path: `user-1/${id}.jpg`,
    visited_at: visited,
    memo: null,
  });
  const item = (name: string) => ({
    name,
    period: null,
    period_start: null,
    period_end: null,
    description: null,
    source_url: 'https://www.instagram.com/p/x/',
    fetched_at: '2026-09-21T00:00:00Z',
  });
  const FULL = () => {
    // 月参り（直近の記録が今月か先月なら続いている）の判定が日付で変わらないよう、今日を固定する
    jest.useFakeTimers().setSystemTime(new Date('2026-09-25T12:00:00+09:00'));
    mockStamps = [stamp('s1', '2026-09-01'), stamp('s2', '2026-08-01')];
    // s2 は自分の記録と公開の両方に出る（重複を除いて 4 枚）
    mockPublicStamps = [
      { ...stamp('s2'), profiles: { display_name: 'me' } },
      { ...stamp('p1'), profiles: { display_name: 'a' } },
      { ...stamp('p2'), profiles: { display_name: 'b' } },
    ];
    mockSpotInfo = {
      receptionHours: { open: '9:00', close: '16:00' },
      limitedGoshuin: {
        items: [item('猫切り絵'), item('花札')],
        fetched_at: '2026-09-21T00:00:00Z',
      },
    };
  };
  beforeEach(FULL);
  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
    mockStamps = [];
    mockPublicStamps = [];
    mockSpotInfo = null;
  });

  const ORDER = [
    'spot-sheet-header',
    'spot-info-section',
    'spot-thumbnails',
    'limited-goshuin-heading',
    'tsukimairi-card',
  ];
  type Node = { props: { testID?: string }; children: (Node | string)[] };
  /** 木を深さ優先でたどって、見たい testID の出てくる順 */
  const orderOf = (root: Node) => {
    const seen: string[] = [];
    const walk = (node: Node) => {
      const id = node.props?.testID;
      if (id && ORDER.includes(id) && !seen.includes(id)) seen.push(id);
      node.children.forEach(c => typeof c !== 'string' && walk(c));
    };
    walk(root);
    return seen;
  };

  it('閉じても開いても同じ並び。閉じたときにあった要素が開いても消えない', () => {
    const ui = render(<SpotBottomSheet {...props} />);
    expect(orderOf(ui.getByTestId('bottom-sheet') as unknown as Node)).toEqual(ORDER);
    fireEvent.press(ui.getByTestId('sheet-handle'));
    expect(orderOf(ui.getByTestId('bottom-sheet') as unknown as Node)).toEqual(ORDER);
    expect(ui.queryByTestId('stamp-grid')).toBeNull();
    expect(ui.queryByTestId('spot-detail-content')).toBeNull();
    expect(ui.queryByTestId('mini-map')).toBeNull();
  });

  it('限定御朱印の中身は、開いたときだけ見出しの下に出る。見出しを押しても開く', () => {
    const ui = render(<SpotBottomSheet {...props} />);
    expect(ui.queryByTestId('limited-goshuin-item-0')).toBeNull();
    fireEvent.press(ui.getByTestId('sheet-handle'));
    expect(ui.getByTestId('limited-goshuin-item-0')).toBeTruthy();
    fireEvent.press(ui.getByTestId('sheet-handle'));
    expect(ui.queryByTestId('limited-goshuin-item-0')).toBeNull();
    fireEvent.press(ui.getByTestId('limited-goshuin-heading'));
    expect(ui.getByTestId('limited-goshuin-item-0')).toBeTruthy();
  });

  it('ボタンはシートの外の下端のフッターに1つだけ。開いても、スクロールしても', () => {
    const ui = render(<SpotBottomSheet {...props} />);
    const check = () => {
      expect(ui.getAllByTestId('spot-sheet-actions')).toHaveLength(1);
      expect(
        within(ui.getByTestId('spot-sheet-footer')).getByTestId('spot-sheet-actions')
      ).toBeTruthy();
      expect(within(ui.getByTestId('bottom-sheet')).queryByTestId('spot-sheet-actions')).toBeNull();
    };
    check();
    fireEvent.press(ui.getByTestId('sheet-handle'));
    check();
    fireEvent.scroll(ui.getByTestId('spot-sheet-scroll'), {
      nativeEvent: {
        contentOffset: { y: 200 },
        contentSize: { height: 1000, width: 390 },
        layoutMeasurement: { height: 500, width: 390 },
      },
    });
    check();
  });

  it('スポットが無くなるとシートもフッターも消える', () => {
    const ui = render(<SpotBottomSheet {...props} />);
    ui.rerender(<SpotBottomSheet {...props} spotId={null} />);
    expect(ui.queryByTestId('bottom-sheet')).toBeNull();
    expect(ui.queryByTestId('spot-sheet-footer')).toBeNull();
  });

  it('閉じているときはスクロールしない。中身の最後にフッターの高さ分の余白', () => {
    const ui = render(<SpotBottomSheet {...props} />);
    expect(ui.getByTestId('spot-sheet-scroll').props.scrollEnabled).toBe(false);
    fireEvent(ui.getByTestId('spot-sheet-footer'), 'layout', {
      nativeEvent: { layout: { height: 70, width: 390, x: 0, y: 0 } },
    });
    fireEvent.press(ui.getByTestId('sheet-handle'));
    const scroll = ui.getByTestId('spot-sheet-scroll');
    expect(scroll.props.scrollEnabled).toBe(true);
    expect(StyleSheet.flatten(scroll.props.contentContainerStyle).paddingBottom).toBe(
      70 + spacing.lg
    );
  });

  it('タブの中ではフッターの下の余白は spacing.md（タブバーがセーフエリアを持つ）', () => {
    const ui = render(<SpotBottomSheet {...props} />);
    const style = [ui.getByTestId('spot-sheet-footer').props.style].flat(3);
    expect(style).toEqual(
      expect.arrayContaining([expect.objectContaining({ paddingBottom: spacing.md })])
    );
  });

  it('タブの外ではフッターの下に端末のセーフエリアを足す', () => {
    const ui = render(
      <BottomTabBarHeightContext.Provider value={undefined}>
        <SpotBottomSheet {...props} />
      </BottomTabBarHeightContext.Provider>
    );
    const style = StyleSheet.flatten(ui.getByTestId('spot-sheet-footer').props.style);
    expect(style.paddingBottom).toBe(spacing.md + 34);
  });

  it('閉じた高さは ハンドル + 見出しまでの中身 + フッター の実測の和', () => {
    const spring = jest.spyOn(Animated, 'spring');
    const ui = render(<SpotBottomSheet {...props} />);
    const layout = (id: string, height: number) =>
      fireEvent(ui.getByTestId(id), 'layout', {
        nativeEvent: { layout: { height, width: 390, x: 0, y: 0 } },
      });
    layout('sheet-handle', 20);
    layout('spot-sheet-primary', 250);
    layout('spot-sheet-footer', 70);
    const available = Dimensions.get('window').height - 49;
    const last = spring.mock.calls.at(-1)?.[1] as { toValue: number };
    expect(last.toValue).toBe(available - 340);
  });

  it('写真を押すと、その写真からギャラリーが開く。シートは開かない', () => {
    const ui = render(<SpotBottomSheet {...props} />);
    fireEvent.press(ui.getByTestId('spot-thumbnail-1'));
    expect(ui.queryByTestId('gallery-frame')).toBeTruthy();
    // 押した2枚目から、重複を除いた4枚のうちの 2 / 4
    expect(ui.getByTestId('gallery-counter')).toHaveTextContent('2 / 4');
    expect(ui.queryByTestId('limited-goshuin-item-0')).toBeNull();
  });

  it('限定御朱印も公式SNSも無ければ見出しを出さない。写真が無ければ帯を出さない', () => {
    mockSpotInfo = { receptionHours: { open: '9:00' } };
    mockStamps = [];
    mockPublicStamps = [];
    const ui = render(<SpotBottomSheet {...props} />);
    expect(ui.queryByTestId('limited-goshuin-heading')).toBeNull();
    expect(ui.queryByTestId('spot-thumbnails')).toBeNull();
    fireEvent.press(ui.getByTestId('sheet-handle'));
    expect(ui.queryByTestId('limited-goshuin-heading')).toBeNull();
    expect(ui.queryByTestId('spot-thumbnails')).toBeNull();
  });
});
