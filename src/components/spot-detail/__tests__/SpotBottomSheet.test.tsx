import React from 'react';
import { act, render, fireEvent, within, waitFor } from '@testing-library/react-native';
import '@testing-library/react-native/extend-expect';
import { AccessibilityInfo, Animated, Dimensions, StyleSheet, View } from 'react-native';
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
import { SpotSheetHero } from '../SpotSheetHero';
import { SpotPhotoCredit } from '../SpotPhotoCredit';
import { HERO_COMPACT_NAME_TOP } from '../spotHeroMotion';
import { colors } from '@theme/colors';
import { spacing } from '@theme/spacing';
import type { Spot, SpotPhoto } from '@/types/supabase';

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
    spot:
      spotId === 'spot-1'
        ? mockSpot
        : spotId === 'spot-2'
          ? { ...mockSpot, id: 'spot-2', name: '源覚寺', type: 'temple' }
          : null,
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

// 帯の写真（Issue #302）。既定は写真なし（第1段の帯）
let mockPhoto: SpotPhoto | null = null;
jest.mock('@hooks/useSpotPhoto', () => ({
  useSpotPhoto: () => ({ photo: mockPhoto }),
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
    expect(resolveCompactHeight(999, 800)).toBe(410);
  });

  // 帯の下の名前の行の位置（50）がつまみ（20）の代わりに入って 30 高くなった分を打ち消す。
  // 380 のままだと、受付2行・写真の帯・見出しのある寺社で見出しがフッターに隠れた（Issue #293）
  it('上限は 410（帯で増えた 30 を 380 に足す。Issue #293）', () => {
    expect(COMPACT_MAX_HEIGHT).toBe(410);
    expect(resolveCompactHeight(405, 800)).toBe(405);
    expect(resolveCompactHeight(999, 700)).toBe(410);
  });

  it('不正な値はフォールバックする', () => {
    expect(resolveCompactHeight(0, SCREEN)).toBe(COMPACT_FALLBACK_HEIGHT);
    expect(resolveCompactHeight(-10, SCREEN)).toBe(COMPACT_FALLBACK_HEIGHT);
    expect(resolveCompactHeight(NaN, SCREEN)).toBe(COMPACT_FALLBACK_HEIGHT);
  });
});

describe('sumCompactParts', () => {
  it('帯の下の名前の行の位置・中身・フッターの和。未計測は 0（Issue #293 AC-30）', () => {
    expect(HERO_COMPACT_NAME_TOP).toBe(50);
    expect(sumCompactParts({ top: 50, primary: 250, footer: 70 })).toBe(370);
    expect(sumCompactParts({ top: 50, primary: 0, footer: 70 })).toBe(120);
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

  it('閉じた高さは 帯の下の名前の行の位置（50）＋ 見出しまでの中身 ＋ フッター（Issue #293 AC-30）', () => {
    const spring = jest.spyOn(Animated, 'spring');
    const ui = render(<SpotBottomSheet {...props} />);
    const layout = (id: string, height: number) =>
      fireEvent(ui.getByTestId(id), 'layout', {
        nativeEvent: { layout: { height, width: 390, x: 0, y: 0 } },
      });
    layout('spot-sheet-primary', 250);
    layout('spot-sheet-footer', 70);
    const available = Dimensions.get('window').height - 49;
    const last = spring.mock.calls.at(-1)?.[1] as { toValue: number };
    expect(last.toValue).toBe(available - 370);
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

  /* Issue #293: シートの上の帯（場所の顔）。帯はスクロールの外、中身を持ち上げて帯の下の端に重ねる */
  describe('帯（Issue #293）', () => {
    const hidden = { includeHiddenElements: true };
    type JsonNode = { props: Record<string, unknown>; children: (JsonNode | string)[] | null };
    const findNode = (node: unknown, id: string): JsonNode | null => {
      if (!node || typeof node !== 'object') return null;
      if (Array.isArray(node)) {
        for (const child of node) {
          const found = findNode(child, id);
          if (found) return found;
        }
        return null;
      }
      const n = node as JsonNode;
      if (n.props?.testID === id) return n;
      return findNode(n.children, id);
    };
    const childIds = (node: JsonNode | null) =>
      (node?.children ?? []).map(c => (typeof c === 'string' ? c : c.props.testID));
    const flatten = (node: { props: { style?: unknown } }) =>
      (StyleSheet.flatten(node.props.style) ?? {}) as Record<string, unknown>;
    const read = (value: unknown): number => {
      const v =
        value && typeof value === 'object' && '__getValue' in value
          ? (value as { __getValue: () => unknown }).__getValue()
          : value;
      return typeof v === 'string' ? parseFloat(v) : (v as number);
    };
    const transformValue = (node: { props: { style?: unknown } }, key: string) =>
      read(
        ((flatten(node).transform ?? []) as Record<string, unknown>[]).find(t => key in t)?.[key]
      );

    /** spring を、すぐに行き先へ置いて終わるものにする */
    const stubSpring = () =>
      jest.spyOn(Animated, 'spring').mockImplementation((value, config) => {
        (value as Animated.Value).setValue((config as { toValue: number }).toValue);
        return {
          start: (cb?: Animated.EndCallback) => cb?.({ finished: true }),
          stop: jest.fn(),
          reset: jest.fn(),
        } as unknown as Animated.CompositeAnimation;
      });

    it('帯・中身・つまみの順に重ね、中身の中は ぼかし → 白い地 → 中身（AC-27）', () => {
      const ui = render(<SpotBottomSheet {...props} />);
      const json = ui.toJSON();
      expect(childIds(findNode(json, 'bottom-sheet'))).toEqual([
        'spot-hero',
        'spot-sheet-body',
        'sheet-handle',
      ]);
      const body = ui.getByTestId('spot-sheet-body');
      const scroll = within(body).getByTestId('spot-sheet-scroll');
      expect(within(scroll).queryByTestId('spot-hero', hidden)).toBeNull();
      expect(within(scroll).getByTestId('spot-sheet-surface')).toBeTruthy();
      expect(childIds(findNode(json, 'spot-sheet-surface'))).toEqual([
        'spot-hero-fade',
        'spot-sheet-ground',
        'spot-sheet-content',
      ]);
      expect(
        within(ui.getByTestId('spot-sheet-content')).getByTestId('spot-sheet-primary')
      ).toBeTruthy();

      const handle = ui.getByTestId('sheet-handle');
      expect(flatten(handle)).toEqual(
        expect.objectContaining({
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          alignItems: 'center',
          paddingVertical: spacing.sm,
        })
      );
      expect(handle.props.onLayout).toBeUndefined();
      expect(flatten(body)).toEqual(expect.objectContaining({ flex: 1, marginTop: 152 }));
    });

    it('ぼかし・白い地・中身の余白（AC-28）', () => {
      const ui = render(<SpotBottomSheet {...props} />);
      const fade = ui.getByTestId('spot-hero-fade', hidden);
      expect(fade.props.colors).toEqual([
        colors.spotHero.fadeClear,
        colors.spotHero.fadeMid,
        colors.white,
      ]);
      expect(fade.props.locations).toEqual([5 / 57, 29 / 57, 47 / 57]);
      expect(fade.props.start).toEqual({ x: 0.5, y: 0 });
      expect(fade.props.end).toEqual({ x: 0.5, y: 1 });
      expect(flatten(fade)).toEqual(
        expect.objectContaining({ position: 'absolute', top: 0, left: 0, right: 0, height: 57 })
      );
      expect(flatten(ui.getByTestId('spot-sheet-ground', hidden))).toEqual(
        expect.objectContaining({
          position: 'absolute',
          top: 56,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: colors.white,
        })
      );
      expect(flatten(ui.getByTestId('spot-sheet-surface'))).toEqual(
        expect.objectContaining({ flexGrow: 1, minHeight: 184 })
      );
      expect(flatten(ui.getByTestId('spot-sheet-content'))).toEqual(
        expect.objectContaining({ paddingTop: 26, paddingHorizontal: spacing.lg })
      );
      const container = StyleSheet.flatten(
        ui.getByTestId('spot-sheet-scroll').props.contentContainerStyle
      ) as Record<string, unknown>;
      expect(container.flexGrow).toBe(1);
      expect('paddingHorizontal' in container).toBe(false);
    });

    it('半分では中身を 128 持ち上げ、大きくで 0。印とページも開きについていく（AC-29）', () => {
      stubSpring();
      const ui = render(<SpotBottomSheet {...props} />);
      const body = () => transformValue(ui.getByTestId('spot-sheet-body'), 'translateY');
      const crest = (key: string) => transformValue(ui.getByTestId('spot-hero-crest', hidden), key);
      const pagesX = () => transformValue(ui.getByTestId('spot-hero-pages', hidden), 'translateX');

      expect(body()).toBeCloseTo(-128, 3);
      expect(crest('translateY')).toBeCloseTo(-44, 3);
      expect(crest('scale')).toBeCloseTo(0.833, 3);
      expect(pagesX()).toBeCloseTo(35, 3);

      fireEvent.press(ui.getByTestId('sheet-handle'));
      expect(body()).toBeCloseTo(0, 3);
      expect(crest('translateY')).toBeCloseTo(0, 3);
      expect(crest('scale')).toBeCloseTo(1, 3);
      expect(pagesX()).toBeCloseTo(0, 3);

      fireEvent.press(ui.getByTestId('sheet-handle'));
      expect(body()).toBeCloseTo(-128, 3);
    });

    it('帯を押すと、つまみと同じく開閉する（AC-31）', () => {
      const ui = render(<SpotBottomSheet {...props} />);
      expect(ui.queryByTestId('limited-goshuin-item-0')).toBeNull();
      fireEvent.press(ui.getByTestId('spot-hero'));
      expect(ui.getByTestId('limited-goshuin-item-0')).toBeTruthy();
      expect(ui.getByTestId('spot-sheet-scroll').props.scrollEnabled).toBe(true);
      fireEvent.press(ui.getByTestId('spot-hero'));
      expect(ui.queryByTestId('limited-goshuin-item-0')).toBeNull();
      expect(ui.getByTestId('spot-sheet-scroll').props.scrollEnabled).toBe(false);
    });

    describe('帯に渡すもの（AC-32）', () => {
      const heroProps = (ui: ReturnType<typeof render>) =>
        ui.UNSAFE_getByType(SpotSheetHero).props as React.ComponentProps<typeof SpotSheetHero>;

      it('① 行った寺社: 自分の記録の枚数と、いちばん新しい記録の写真', () => {
        const ui = render(<SpotBottomSheet {...props} />);
        expect(heroProps(ui)).toEqual(
          expect.objectContaining({
            spotType: 'shrine',
            visited: true,
            visitedReady: true,
            pageCount: 2,
            pageImageUri: 'https://example.com/user-1/s1.jpg',
            reduceMotion: false,
          })
        );
      });

      it('② ほかの寺社の記録は数えない', () => {
        mockStamps = [{ ...stamp('x1'), spot_id: 'spot-9' }];
        const ui = render(<SpotBottomSheet {...props} />);
        expect(heroProps(ui)).toEqual(
          expect.objectContaining({ pageCount: 1, pageImageUri: null })
        );
      });

      it('③ 4件でも束は3枚', () => {
        mockStamps = ['a', 'b', 'c', 'd'].map(id => stamp(id));
        const ui = render(<SpotBottomSheet {...props} />);
        expect(heroProps(ui).pageCount).toBe(3);
      });

      it('④ 行っていない寺社', () => {
        const ui = render(<SpotBottomSheet {...props} visitedSpotIds={new Set()} />);
        expect(heroProps(ui).visited).toBe(false);
      });

      it('⑤ 訪問済みをまだ取れていない', () => {
        const ui = render(<SpotBottomSheet {...props} visitedReady={false} />);
        expect(heroProps(ui).visitedReady).toBe(false);
      });
    });

    it('視差効果を減らす は、シートで1回読んで帯に渡す（AC-33）', async () => {
      jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
      const ui = render(<SpotBottomSheet {...props} />);
      await waitFor(() => {
        expect(ui.UNSAFE_getByType(SpotSheetHero).props.reduceMotion).toBe(true);
      });
    });

    describe('シートを通した記録した瞬間（AC-34）', () => {
      let timing: jest.SpyInstance;
      beforeEach(() => {
        timing = jest.spyOn(Animated, 'timing').mockReturnValue({
          start: jest.fn(),
          stop: jest.fn(),
          reset: jest.fn(),
        } as unknown as Animated.CompositeAnimation);
      });
      const durations = () =>
        timing.mock.calls
          .map(call => (call[1] as { duration?: number }).duration)
          .filter(d => d === 500 || d === 250);

      it('行っていない寺社が 行った になると、0.5秒と0.25秒の動きが1回ずつ', () => {
        const ui = render(<SpotBottomSheet {...props} visitedSpotIds={new Set()} />);
        ui.rerender(<SpotBottomSheet {...props} visitedSpotIds={new Set(['spot-1'])} />);
        expect(durations().sort()).toEqual([250, 500]);
      });

      it('訪問済みをまだ取れていない描画からは動かさない', () => {
        const ui = render(
          <SpotBottomSheet {...props} visitedSpotIds={new Set()} visitedReady={false} />
        );
        ui.rerender(<SpotBottomSheet {...props} visitedSpotIds={new Set(['spot-1'])} />);
        expect(durations()).toEqual([]);
      });

      it('行った寺社へ切り替えても動かさない（帯は寺社ごとに作り直す）', () => {
        const visited = new Set(['spot-2']);
        const ui = render(<SpotBottomSheet {...props} spotId="spot-1" visitedSpotIds={visited} />);
        ui.rerender(<SpotBottomSheet {...props} spotId="spot-2" visitedSpotIds={visited} />);
        expect(durations()).toEqual([]);
        expect(ui.UNSAFE_getByType(SpotSheetHero).props).toEqual(
          expect.objectContaining({ spotType: 'temple', visited: true })
        );
      });
    });
  });
});

describe('SpotBottomSheet — 帯の写真（Issue #302）', () => {
  const props = {
    spotId: 'spot-1' as string | null,
    visitedSpotIds: new Set(['spot-1']),
    onDismiss: jest.fn(),
    onRecord: jest.fn(),
    wishlistSpotIds: new Set<string>(),
    onWishlistToggle: jest.fn(),
  };
  const PHOTO: SpotPhoto = {
    uri: 'https://example.com/p.jpg',
    width: 1280,
    height: 960,
    focusY: 0.5,
    author: 'Bachstelze',
    license: 'CC BY-SA 3.0',
    licenseUrl: 'https://creativecommons.org/licenses/by-sa/3.0',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:A.jpg',
    isCropped: true,
  };
  const hidden = { includeHiddenElements: true };
  type JsonNode = { props: Record<string, unknown>; children: (JsonNode | string)[] | null };
  const findNode = (node: unknown, id: string): JsonNode | null => {
    if (!node || typeof node !== 'object') return null;
    if (Array.isArray(node)) {
      for (const child of node) {
        const found = findNode(child, id);
        if (found) return found;
      }
      return null;
    }
    const n = node as JsonNode;
    if (n.props?.testID === id) return n;
    return findNode(n.children, id);
  };
  const childIds = (node: JsonNode | null) =>
    (node?.children ?? [])
      .map(c => (typeof c === 'string' ? c : c.props.testID))
      .filter(id => id !== undefined);
  const flatten = (node: { props: { style?: unknown } }) =>
    (StyleSheet.flatten(node.props.style) ?? {}) as Record<string, unknown>;
  const heroProps = (ui: ReturnType<typeof render>) =>
    ui.UNSAFE_getByType(SpotSheetHero).props as React.ComponentProps<typeof SpotSheetHero>;
  /** つまみの棒 */
  const bar = (ui: ReturnType<typeof render>) =>
    within(ui.getByTestId('sheet-handle')).UNSAFE_getAllByType(View)[0];

  afterEach(() => {
    jest.restoreAllMocks();
    mockPhoto = null;
  });

  it('写真が無い・読めるまで・読めた・読めなかった で、帯・ⓘ・つまみが替わる（AC-33）', () => {
    const none = render(<SpotBottomSheet {...props} />);
    expect(heroProps(none)).toEqual(expect.objectContaining({ photo: null, photoReady: false }));
    expect(none.queryByTestId('spot-photo-credit', hidden)).toBeNull();
    expect(flatten(bar(none)).backgroundColor).toBe(colors.gray[300]);
    expect(Object.values(flatten(bar(none)))).not.toContain(colors.spotHeroPhoto.handle);

    mockPhoto = PHOTO;
    const ui = render(<SpotBottomSheet {...props} />);
    expect(heroProps(ui).photo).toBe(PHOTO);
    expect(heroProps(ui).photoReady).toBe(false);
    expect(ui.queryByTestId('spot-photo-credit', hidden)).toBeNull();

    act(() => heroProps(ui).onPhotoLoad?.());
    expect(heroProps(ui).photoReady).toBe(true);
    const surface = ui.getByTestId('spot-sheet-surface');
    expect(within(surface).getByTestId('spot-photo-credit')).toBeTruthy();
    expect(childIds(findNode(ui.toJSON(), 'spot-sheet-surface'))).toEqual([
      'spot-hero-fade',
      'spot-sheet-ground',
      'spot-sheet-content',
      'spot-photo-credit',
    ]);
    expect(flatten(bar(ui))).toEqual(
      expect.objectContaining({
        backgroundColor: colors.spotHeroPhoto.handle,
        shadowColor: colors.black,
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.18,
        shadowRadius: 2,
      })
    );

    act(() => heroProps(ui).onPhotoError?.());
    expect(heroProps(ui).photoReady).toBe(false);
    expect(ui.queryByTestId('spot-photo-credit', hidden)).toBeNull();
    expect(flatten(bar(ui)).backgroundColor).toBe(colors.gray[300]);
  });

  it('写真が替わると、新しい写真が読めるまで読めていない扱い（AC-34）', () => {
    mockPhoto = PHOTO;
    const ui = render(<SpotBottomSheet {...props} />);
    act(() => heroProps(ui).onPhotoLoad?.());
    expect(heroProps(ui).photoReady).toBe(true);

    mockPhoto = { ...PHOTO, uri: 'https://example.com/q.jpg' };
    ui.rerender(<SpotBottomSheet {...props} spotId="spot-2" />);
    expect(heroProps(ui).photoReady).toBe(false);
    expect(ui.queryByTestId('spot-photo-credit', hidden)).toBeNull();
    act(() => heroProps(ui).onPhotoLoad?.());
    expect(heroProps(ui).photoReady).toBe(true);
  });

  it('ⓘ の 視差効果を減らす は、帯と同じくシートで1回読んだ値（AC-34）', async () => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
    mockPhoto = PHOTO;
    const ui = render(<SpotBottomSheet {...props} />);
    act(() => heroProps(ui).onPhotoLoad?.());
    await waitFor(() => {
      expect(heroProps(ui).reduceMotion).toBe(true);
      expect(ui.UNSAFE_getByType(SpotPhotoCredit).props.reduceMotion).toBe(true);
    });
    expect(ui.UNSAFE_getByType(SpotPhotoCredit).props.photo).toBe(PHOTO);
  });
});
