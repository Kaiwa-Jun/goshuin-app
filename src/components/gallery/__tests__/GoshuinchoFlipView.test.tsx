import React from 'react';
import { render, fireEvent, act } from '@testing-library/react-native';
import { Animated, StyleSheet, Dimensions } from 'react-native';
import {
  GoshuinchoFlipView,
  computePageLayout,
  computeFoldShift,
  PAGE_WIDTH_RATIO,
  PAGE_GAP,
  FOLD_ANGLE_DEG,
} from '@components/gallery/GoshuinchoFlipView';
import {
  isLoadingClockRunning,
  loadingClock,
  resetLoadingClockForTests,
} from '@components/gallery/loadingClock';
import { colors } from '@theme/colors';
import { typography } from '@theme/typography';
import type { StampWithSpot } from '@/types/supabase';

jest.mock('@services/stamps', () => ({
  getStampImageUrl: jest.fn((path: string) => `https://supabase.example/${path}`),
}));

const flatten = (node: { props: { style?: unknown } }) =>
  StyleSheet.flatten(node.props.style) as Record<string, unknown>;

const makeStamp = (overrides: Partial<StampWithSpot> = {}): StampWithSpot => ({
  id: '1',
  user_id: 'user-1',
  spot_id: 'spot-1',
  goshuincho_id: null,
  visited_at: '2024-01-15',
  image_path: 'user-1/stamp-1.jpg',
  memo: null,
  is_public: false,
  extracted_info: null,
  created_at: '2024-01-15T00:00:00Z',
  updated_at: '2024-01-15T00:00:00Z',
  spots: { name: '明治神宮', type: 'shrine' },
  ...overrides,
});

// useGalleryStamps と同じく visited_at 昇順（古い順）で渡す
const ASC_STAMPS: StampWithSpot[] = [
  makeStamp({
    id: 'oldest',
    visited_at: '2024-01-15',
    spots: { name: '明治神宮', type: 'shrine' },
  }),
  makeStamp({
    id: 'middle',
    visited_at: '2025-03-10',
    spots: { name: '神田明神', type: 'shrine' },
  }),
  makeStamp({ id: 'newest', visited_at: '2026-05-03', spots: { name: '浅草寺', type: 'temple' } }),
];

const SCREEN_WIDTH = Dimensions.get('window').width;
const LAYOUT = computePageLayout(SCREEN_WIDTH);

/*
 * 読み込み中の動きの時計（Issue #275）。本物の loop を回すと値がネイティブ扱いになり、
 * 後のテストで setValue が描画に届かなくなることがある。呼ぶたびに新しいスタブを返し、
 * 「start の回数 − stop の回数」（回っている本数）を控える
 */
type Anim = { start: jest.Mock; stop: jest.Mock; reset: jest.Mock };
let loopSpy: jest.SpyInstance;
let running = 0;
let runningSeen: number[] = [];

beforeEach(() => {
  /*
   * 読み込み中の本を描くぶん1件の描画が延び、FlatList が 50ms 後に回す描き直しが
   * 検査の途中で走って act の警告が出るようになった。時間を止めて走らせない
   */
  jest.useFakeTimers();
  resetLoadingClockForTests();
  running = 0;
  runningSeen = [];
  loopSpy = jest.spyOn(Animated, 'loop').mockImplementation(() => {
    const anim: Anim = {
      start: jest.fn(() => runningSeen.push(++running)),
      stop: jest.fn(() => runningSeen.push(--running)),
      reset: jest.fn(),
    };
    return anim as unknown as Animated.CompositeAnimation;
  });
});

afterEach(() => {
  loopSpy.mockRestore();
  act(() => resetLoadingClockForTests());
  jest.useRealTimers();
});

function renderFlipView(props: Partial<React.ComponentProps<typeof GoshuinchoFlipView>> = {}) {
  return render(
    <GoshuinchoFlipView
      stamps={ASC_STAMPS}
      onPressStamp={jest.fn()}
      onPressBlank={jest.fn()}
      {...props}
    />
  );
}

function scrollTo(
  getByTestId: ReturnType<typeof renderFlipView>['getByTestId'],
  pageIndex: number,
  totalPages = ASC_STAMPS.length + 1
) {
  // fireEvent.scroll は onScroll にしか届かない。ページ確定は onMomentumScrollEnd で
  // 行うので、イベント名を明示して発火する。
  // VirtualizedList が layoutMeasurement / contentSize を参照するため、
  // contentOffset だけでは落ちる。
  fireEvent(getByTestId('flip-list'), 'momentumScrollEnd', {
    nativeEvent: {
      contentOffset: { x: LAYOUT.snapInterval * pageIndex, y: 0 },
      layoutMeasurement: { width: SCREEN_WIDTH, height: 600 },
      contentSize: { width: LAYOUT.snapInterval * totalPages, height: 600 },
    },
  });
}

describe('computePageLayout', () => {
  it('390pt 幅で期待どおりの値を返す', () => {
    expect(computePageLayout(390)).toEqual({ pageWidth: 265, sidePadding: 63, snapInterval: 265 });
  });

  it('snapInterval は常に pageWidth + PAGE_GAP に一致する', () => {
    for (const width of [320, 375, 390, 428, 768]) {
      const layout = computePageLayout(width);
      expect(layout.snapInterval).toBe(layout.pageWidth + PAGE_GAP);
    }
  });

  it('pageWidth は画面幅 × PAGE_WIDTH_RATIO を丸めた値である', () => {
    expect(computePageLayout(428).pageWidth).toBe(Math.round(428 * PAGE_WIDTH_RATIO));
  });

  it('ページ間に余白を入れない（折り目で接する）', () => {
    expect(PAGE_GAP).toBe(0);
  });
});

describe('computeFoldShift', () => {
  it('折れて縮んだ分を詰める量を返す', () => {
    const expected = (292 / 2) * (1 - Math.cos((48 * Math.PI) / 180));
    expect(computeFoldShift(292, 48)).toBeCloseTo(expected, 6);
  });

  it('折れていなければ詰めない', () => {
    expect(computeFoldShift(292, 0)).toBe(0);
  });

  it('既定の折れ角を使う', () => {
    expect(computeFoldShift(292)).toBe(computeFoldShift(292, FOLD_ANGLE_DEG));
  });
});

describe('GoshuinchoFlipView', () => {
  describe('ページの構成', () => {
    it('御朱印 N 件 + 白紙1枚を並べる', () => {
      const { getByTestId } = renderFlipView();
      expect(getByTestId('flip-list').props.data).toHaveLength(ASC_STAMPS.length + 1);
    });

    it('白紙ページはちょうど1つである', () => {
      const { getAllByTestId } = renderFlipView();
      expect(getAllByTestId('flip-blank-page')).toHaveLength(1);
    });

    it('visited_at の昇順に並べる（1ページ目が最も古い）', () => {
      const { getByTestId } = renderFlipView();
      const data = getByTestId('flip-list').props.data as { key: string }[];
      expect(data.map(p => p.key)).toEqual(['oldest', 'middle', 'newest', 'blank']);
    });

    it('御朱印が0件でも白紙ページだけを出す', () => {
      const { getByTestId, getAllByTestId } = renderFlipView({ stamps: [] });
      expect(getByTestId('flip-list').props.data).toHaveLength(1);
      expect(getAllByTestId('flip-blank-page')).toHaveLength(1);
    });

    it('右綴じで描画する（1ページ目が右端、新しいページが左に足される）', () => {
      const { getByTestId } = renderFlipView();
      expect(getByTestId('flip-list').props.inverted).toBe(true);
    });
  });

  describe('ページ番号', () => {
    /*
     * 綴じる順は古い→新しいのまま、**開く場所だけ最後の御朱印**にした。
     * 1ページ目から開くと、「最近の参拝」から来た人が本の一番遠い端に降りる
     */
    it('最後の御朱印から開く', () => {
      const { getByTestId } = renderFlipView();
      expect(getByTestId('flip-page-counter').props.children).toBe('3 ／ 3');
    });

    it('1ページ目まで戻すと 1 ／ N になる', () => {
      const { getByTestId } = renderFlipView();
      scrollTo(getByTestId, 0);
      expect(getByTestId('flip-page-counter').props.children).toBe('1 ／ 3');
    });

    it('2ページ目まで戻すと 2 ／ N になる', () => {
      const { getByTestId } = renderFlipView();
      scrollTo(getByTestId, 1);
      expect(getByTestId('flip-page-counter').props.children).toBe('2 ／ 3');
    });

    it('白紙ページでは N+1枚目 を出す', () => {
      const { getByTestId } = renderFlipView();
      scrollTo(getByTestId, 3);
      expect(getByTestId('flip-page-counter').props.children).toBe('4枚目');
    });

    it('御朱印0件のとき白紙ページは 1枚目 である', () => {
      const { getByTestId } = renderFlipView({ stamps: [] });
      expect(getByTestId('flip-page-counter').props.children).toBe('1枚目');
    });
  });

  describe('タップの振る舞い', () => {
    it('中央の御朱印ページをタップすると onPressStamp が呼ばれる', () => {
      const onPressStamp = jest.fn();
      const { getByTestId } = renderFlipView({ onPressStamp });
      // 開いた場所（最後の御朱印）が中央
      fireEvent.press(getByTestId('flip-page-newest'));
      expect(onPressStamp).toHaveBeenCalledTimes(1);
    });

    it('onPressStamp には stamps（昇順）でのインデックスを渡す', () => {
      const onPressStamp = jest.fn();
      const { getByTestId } = renderFlipView({ onPressStamp });

      // 開いた場所 = 表示 3 ページ目 = newest = 昇順配列では index 2
      fireEvent.press(getByTestId('flip-page-newest'));
      expect(onPressStamp).toHaveBeenCalledWith(2);

      // 1 ページ目まで戻すと oldest = 昇順配列では index 0
      scrollTo(getByTestId, 0);
      fireEvent.press(getByTestId('flip-page-oldest'));
      expect(onPressStamp).toHaveBeenCalledWith(0);
    });

    it('中央の白紙ページをタップすると onPressBlank が呼ばれる', () => {
      const onPressBlank = jest.fn();
      const { getByTestId } = renderFlipView({ onPressBlank });
      scrollTo(getByTestId, 3);
      fireEvent.press(getByTestId('flip-blank-page'));
      expect(onPressBlank).toHaveBeenCalledTimes(1);
    });

    it('覗いている隣のページをタップしても onPressStamp を呼ばない', () => {
      const onPressStamp = jest.fn();
      const { getByTestId } = renderFlipView({ onPressStamp });
      // 1ページ目を表示中に 2ページ目（隣）をタップ
      fireEvent.press(getByTestId('flip-page-middle'));
      expect(onPressStamp).not.toHaveBeenCalled();
    });

    it('覗いている隣のページをタップするとそのページが中央になる', () => {
      const { getByTestId } = renderFlipView();
      fireEvent.press(getByTestId('flip-page-middle'));
      expect(getByTestId('flip-page-counter').props.children).toBe('2 ／ 3');
    });

    it('覗いている白紙ページをタップしても onPressBlank を呼ばない', () => {
      const onPressBlank = jest.fn();
      const { getByTestId } = renderFlipView({ stamps: [ASC_STAMPS[0]], onPressBlank });
      // 1ページ目（御朱印）を表示中に白紙（隣）をタップ
      fireEvent.press(getByTestId('flip-blank-page'));
      expect(onPressBlank).not.toHaveBeenCalled();
    });
  });

  describe('画像 URL の解決', () => {
    it('既定では getStampImageUrl を使う', () => {
      const { getByTestId } = renderFlipView();
      expect(getByTestId('flip-page-image-oldest').props.source.uri).toBe(
        'https://supabase.example/user-1/stamp-1.jpg'
      );
    });

    it('resolveImageUrl が渡されたときはそちらを使う', () => {
      const { getByTestId } = renderFlipView({
        resolveImageUrl: stamp => `data:image/svg+xml;utf8,<svg id="${stamp.id}"/>`,
      });
      expect(getByTestId('flip-page-image-oldest').props.source.uri).toBe(
        'data:image/svg+xml;utf8,<svg id="oldest"/>'
      );
    });
  });

  describe('FlatList の設定', () => {
    it('横方向にスナップする', () => {
      const { getByTestId } = renderFlipView();
      const list = getByTestId('flip-list');
      expect(list.props.horizontal).toBe(true);
      expect(list.props.snapToInterval).toBe(LAYOUT.snapInterval);
      expect(list.props.decelerationRate).toBe('fast');
    });

    it('scrollToIndex のために getItemLayout を持つ', () => {
      const { getByTestId } = renderFlipView();
      const getItemLayout = getByTestId('flip-list').props.getItemLayout;
      expect(getItemLayout(null, 2)).toEqual({
        length: LAYOUT.snapInterval,
        offset: LAYOUT.snapInterval * 2,
        index: 2,
      });
    });

    it('折りをスクロール量に連動させるため onScroll を持つ', () => {
      const { getByTestId } = renderFlipView();
      expect(getByTestId('flip-list').props.onScroll).toBeDefined();
    });

    it('中央寄せのために左右へパディングを入れる', () => {
      const { getByTestId } = renderFlipView();
      const style = StyleSheet.flatten(
        getByTestId('flip-list').props.contentContainerStyle
      ) as Record<string, unknown>;
      expect(style.paddingHorizontal).toBe(LAYOUT.sidePadding);
    });
  });

  describe('視覚仕様', () => {
    it('帳面の外の地色が surface である', () => {
      const { getByTestId } = renderFlipView();
      expect(flatten(getByTestId('flip-view')).backgroundColor).toBe(colors.surface);
    });

    it('ページ番号が gray[500] / caption である', () => {
      const { getByTestId } = renderFlipView();
      const style = flatten(getByTestId('flip-page-counter'));
      expect(style.color).toBe(colors.gray[500]);
      expect(style.fontSize).toBe(typography.caption.fontSize);
    });
  });
});

describe('GoshuinchoFlipView 開く位置', () => {
  type StyledNode = { props: { style?: unknown }; parent: StyledNode | null };

  /** 折り紙の包み（Animated.View）の rotateY を読む */
  const rotateOf = (page: { parent: StyledNode | null }) => {
    let node: StyledNode | null = page.parent;
    for (let i = 0; i < 6 && node; i++) {
      const flat = StyleSheet.flatten(node.props.style) as
        | { transform?: { rotateY?: { __getValue?: () => string } | string }[] }
        | undefined;
      const spin = flat?.transform?.find(t => 'rotateY' in t)?.rotateY;
      if (spin) return typeof spin === 'string' ? spin : (spin.__getValue?.() ?? '');
      node = node.parent;
    }
    return '';
  };

  /*
   * 折れ角は scrollX から引いている。飛ばしただけで scrollX を教えないと、
   * **開いたページが折れたまま（斜めに）描かれる**
   */
  it('開いたページは折れていない', () => {
    const { getByTestId } = renderFlipView();
    expect(rotateOf(getByTestId('flip-page-newest'))).toBe('0deg');
  });

  /*
   * 戻るたびに飛ばすと、途中まで見て他のタブへ行って戻った人の位置が失われる。
   * 飛ばすのは最初の1回だけ
   */
  it('一度めくったあとは、描き直しても開く位置に戻さない', () => {
    const { getByTestId, rerender } = renderFlipView();
    expect(getByTestId('flip-page-counter').props.children).toBe('3 ／ 3');

    scrollTo(getByTestId, 0);
    expect(getByTestId('flip-page-counter').props.children).toBe('1 ／ 3');

    rerender(
      <GoshuinchoFlipView stamps={ASC_STAMPS} onPressStamp={jest.fn()} onPressBlank={jest.fn()} />
    );
    expect(getByTestId('flip-page-counter').props.children).toBe('1 ／ 3');
  });
});

describe('GoshuinchoFlipView 読み込み中の本（Issue #275）', () => {
  /** 下地は読み上げない（飾り）ので、既定の検索からは外れる。外れたものも探す */
  const hidden = { includeHiddenElements: true };

  // ページ 0〜5 が御朱印、6 が白紙。最後の御朱印（ページ 5）で開く
  const SIX = Array.from({ length: 6 }, (_, i) =>
    makeStamp({ id: `s${i}`, image_path: `user-1/stamp-${i}.jpg` })
  );
  const renderSix = () =>
    render(<GoshuinchoFlipView stamps={SIX} onPressStamp={jest.fn()} onPressBlank={jest.fn()} />);

  /** 描いた値を読む。ノードならその値、値そのものならそれ */
  const read = (value: unknown): number => {
    const v =
      value && typeof value === 'object' && '__getValue' in value
        ? (value as { __getValue: () => unknown }).__getValue()
        : value;
    return typeof v === 'string' ? parseFloat(v) : (v as number);
  };
  const leafRotateOf = (utils: ReturnType<typeof renderSix>, id: string) => {
    const leaf = utils.getByTestId(`flip-page-loading-${id}-book-leaf-front`, hidden);
    const transform = (flatten(leaf).transform ?? []) as Record<string, unknown>[];
    return read(transform.find(t => 'rotateY' in t)?.rotateY);
  };
  const hasBook = (utils: ReturnType<typeof renderSix>, id: string) =>
    utils.queryByTestId(`flip-page-loading-${id}-book`, hidden) !== null;

  // 回っている時計は、どの時点でも 0 か 1 本
  const expectOneClockAtMost = () => {
    expect(runningSeen.every(n => n === 0 || n === 1)).toBe(true);
  };

  it('画面に出ているページと両隣は本が動き、2つ離れたページは止まった本、それより先は本を描かない（AC-20）', () => {
    const utils = renderSix();
    act(() => loadingClock.setValue(425));

    expect(leafRotateOf(utils, 's5')).toBeCloseTo(-90, 3);
    expect(leafRotateOf(utils, 's4')).toBeCloseTo(-90, 3);
    expect(leafRotateOf(utils, 's3')).toBe(0);
    for (const id of ['s2', 's1', 's0']) {
      expect(utils.getByTestId(`flip-page-loading-${id}`, hidden)).toBeTruthy();
      expect(hasBook(utils, id)).toBe(false);
    }
    expect(isLoadingClockRunning()).toBe(true);
    expectOneClockAtMost();
  });

  it('1ページ目までめくると、動く本もそれに合わせて移る（AC-20）', () => {
    const utils = renderSix();
    scrollTo(utils.getByTestId, 0, SIX.length + 1);
    act(() => loadingClock.setValue(425));

    expect(leafRotateOf(utils, 's0')).toBeCloseTo(-90, 3);
    expect(leafRotateOf(utils, 's1')).toBeCloseTo(-90, 3);
    expect(leafRotateOf(utils, 's2')).toBe(0);
    for (const id of ['s3', 's4', 's5']) {
      expect(hasBook(utils, id)).toBe(false);
    }
    expect(isLoadingClockRunning()).toBe(true);
    expectOneClockAtMost();
  });

  describe('写真が届いたら（AC-21）', () => {
    let timingSpy: jest.SpyInstance;
    let fades: Anim[];

    beforeEach(() => {
      fades = [];
      timingSpy = jest.spyOn(Animated, 'timing').mockImplementation(value => {
        const anim: Anim = { start: jest.fn(), stop: jest.fn(), reset: jest.fn() };
        if (value !== loadingClock) fades.push(anim);
        return anim as unknown as Animated.CompositeAnimation;
      });
    });

    afterEach(() => {
      timingSpy.mockRestore();
    });

    const loadAndFinish = (utils: ReturnType<typeof renderSix>, id: string) => {
      fireEvent(utils.getByTestId(`flip-page-image-${id}`), 'load', {
        nativeEvent: { source: { width: 600, height: 800 } },
      });
      const fade = fades[fades.length - 1];
      act(() => fade.start.mock.calls[0][0]({ finished: true }));
    };

    it('動いている本の写真が届き終わると、止まった本・本の無い下地だけでは時計を回さない', () => {
      const utils = renderSix();
      loadAndFinish(utils, 's5');
      loadAndFinish(utils, 's4');

      for (const id of ['s0', 's1', 's2', 's3']) {
        expect(utils.getByTestId(`flip-page-loading-${id}`, hidden)).toBeTruthy();
      }
      expect(isLoadingClockRunning()).toBe(false);

      scrollTo(utils.getByTestId, 0, SIX.length + 1);
      expect(isLoadingClockRunning()).toBe(true);
      expectOneClockAtMost();
    });
  });
});
