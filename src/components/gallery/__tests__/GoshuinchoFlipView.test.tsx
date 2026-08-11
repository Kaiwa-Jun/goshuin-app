import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { StyleSheet, Dimensions } from 'react-native';
import {
  GoshuinchoFlipView,
  computePageLayout,
  computeFoldShift,
  PAGE_WIDTH_RATIO,
  PAGE_GAP,
  FOLD_ANGLE_DEG,
} from '@components/gallery/GoshuinchoFlipView';
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
    it('初期表示で 1 ／ N を出す', () => {
      const { getByTestId } = renderFlipView();
      expect(getByTestId('flip-page-counter').props.children).toBe('1 ／ 3');
    });

    it('3ページ目までスクロールすると 3 ／ N になる', () => {
      const { getByTestId } = renderFlipView();
      scrollTo(getByTestId, 2);
      expect(getByTestId('flip-page-counter').props.children).toBe('3 ／ 3');
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
      fireEvent.press(getByTestId('flip-page-oldest'));
      expect(onPressStamp).toHaveBeenCalledTimes(1);
    });

    it('onPressStamp には stamps（昇順）でのインデックスを渡す', () => {
      const onPressStamp = jest.fn();
      const { getByTestId } = renderFlipView({ onPressStamp });

      // 表示 1 ページ目 = oldest = 昇順配列では index 0
      fireEvent.press(getByTestId('flip-page-oldest'));
      expect(onPressStamp).toHaveBeenCalledWith(0);

      // 表示 3 ページ目 = newest = 昇順配列では index 2
      scrollTo(getByTestId, 2);
      fireEvent.press(getByTestId('flip-page-newest'));
      expect(onPressStamp).toHaveBeenCalledWith(2);
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
