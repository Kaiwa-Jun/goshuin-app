import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { GoshuinchoPage, PEEK_OPACITY } from '@components/gallery/GoshuinchoPage';
import { colors } from '@theme/colors';
import { borderRadius } from '@theme/spacing';
import { typography } from '@theme/typography';

const flatten = (node: { props: { style?: unknown } }) =>
  StyleSheet.flatten(node.props.style) as Record<string, unknown>;

const stampProps = {
  variant: 'stamp' as const,
  width: 265,
  isCurrent: true,
  onPress: jest.fn(),
  stampId: 'stamp-1',
  imageUrl: 'https://example.com/stamp-1.jpg',
  spotName: '浅草寺',
  visitedAt: '2026-05-03',
};

const blankProps = {
  variant: 'blank' as const,
  width: 265,
  isCurrent: true,
  onPress: jest.fn(),
};

describe('GoshuinchoPage', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('御朱印ページ', () => {
    it('御朱印の画像を表示する', () => {
      const { getByTestId } = render(<GoshuinchoPage {...stampProps} />);
      expect(getByTestId('flip-page-image-stamp-1')).toBeTruthy();
    });

    it('フッターにスポット名を表示する', () => {
      const { getByTestId } = render(<GoshuinchoPage {...stampProps} />);
      expect(getByTestId('flip-page-spot-name-stamp-1').props.children).toBe('浅草寺');
    });

    it('フッターに和暦の訪問日を表示する', () => {
      const { getByTestId } = render(<GoshuinchoPage {...stampProps} />);
      expect(getByTestId('flip-page-date-stamp-1').props.children).toBe('令和8年5月3日');
    });

    it('訪問日が読めないときは日付行を描画しない', () => {
      const { queryByTestId, getByTestId } = render(
        <GoshuinchoPage {...stampProps} visitedAt="not-a-date" />
      );
      expect(queryByTestId('flip-page-date-stamp-1')).toBeNull();
      expect(getByTestId('flip-page-spot-name-stamp-1')).toBeTruthy();
    });

    it('タップすると onPress が呼ばれる', () => {
      const { getByTestId } = render(<GoshuinchoPage {...stampProps} />);
      fireEvent.press(getByTestId('flip-page-stamp-1'));
      expect(stampProps.onPress).toHaveBeenCalledTimes(1);
    });

    it('画像の resizeMode が contain である（御朱印の縦横比を潰さない）', () => {
      const { getByTestId } = render(<GoshuinchoPage {...stampProps} />);
      expect(getByTestId('flip-page-image-stamp-1').props.resizeMode).toBe('contain');
    });
  });

  describe('白紙ページ', () => {
    it('flip-blank-page として描画される', () => {
      const { getByTestId } = render(<GoshuinchoPage {...blankProps} />);
      expect(getByTestId('flip-blank-page')).toBeTruthy();
    });

    it('案内文を表示する', () => {
      const { getByText } = render(<GoshuinchoPage {...blankProps} />);
      expect(getByText('ここに御朱印を追加する')).toBeTruthy();
    });

    it('タップすると onPress が呼ばれる', () => {
      const { getByTestId } = render(<GoshuinchoPage {...blankProps} />);
      fireEvent.press(getByTestId('flip-blank-page'));
      expect(blankProps.onPress).toHaveBeenCalledTimes(1);
    });

    it('御朱印の画像もフッターも持たない', () => {
      const { queryByTestId } = render(<GoshuinchoPage {...blankProps} />);
      expect(queryByTestId('flip-page-image-stamp-1')).toBeNull();
      expect(queryByTestId('flip-page-spot-name-stamp-1')).toBeNull();
    });
  });

  describe('視覚仕様', () => {
    it('紙面の背景がトークンの background である', () => {
      const { getByTestId } = render(<GoshuinchoPage {...stampProps} />);
      expect(flatten(getByTestId('flip-page-surface-stamp-1')).backgroundColor).toBe(
        colors.background
      );
    });

    it('紙面の枠線が gray[200] / 1px である', () => {
      const { getByTestId } = render(<GoshuinchoPage {...stampProps} />);
      const style = flatten(getByTestId('flip-page-surface-stamp-1'));
      expect(style.borderColor).toBe(colors.gray[200]);
      expect(style.borderWidth).toBe(1);
    });

    it('紙面の角丸が borderRadius.lg である', () => {
      const { getByTestId } = render(<GoshuinchoPage {...stampProps} />);
      expect(flatten(getByTestId('flip-page-surface-stamp-1')).borderRadius).toBe(borderRadius.lg);
    });

    it('覗いているページの opacity が PEEK_OPACITY である', () => {
      const { getByTestId } = render(<GoshuinchoPage {...stampProps} isCurrent={false} />);
      expect(flatten(getByTestId('flip-page-stamp-1')).opacity).toBe(PEEK_OPACITY);
    });

    it('中央のページに opacity の減衰が無い', () => {
      const { getByTestId } = render(<GoshuinchoPage {...stampProps} isCurrent />);
      const opacity = flatten(getByTestId('flip-page-stamp-1')).opacity;
      expect(opacity === undefined || opacity === 1).toBe(true);
    });

    it('白紙ページの案内文が gray[400] / bodySmall である', () => {
      const { getByText } = render(<GoshuinchoPage {...blankProps} />);
      const style = flatten(getByText('ここに御朱印を追加する'));
      expect(style.color).toBe(colors.gray[400]);
      expect(style.fontSize).toBe(typography.bodySmall.fontSize);
    });

    it('フッターのスポット名が gray[800] / bodySmall である', () => {
      const { getByTestId } = render(<GoshuinchoPage {...stampProps} />);
      const style = flatten(getByTestId('flip-page-spot-name-stamp-1'));
      expect(style.color).toBe(colors.gray[800]);
      expect(style.fontSize).toBe(typography.bodySmall.fontSize);
    });

    it('フッターの日付が gray[500] / caption である', () => {
      const { getByTestId } = render(<GoshuinchoPage {...stampProps} />);
      const style = flatten(getByTestId('flip-page-date-stamp-1'));
      expect(style.color).toBe(colors.gray[500]);
      expect(style.fontSize).toBe(typography.caption.fontSize);
    });

    it('ページの幅が width プロップに従う', () => {
      const { getByTestId } = render(<GoshuinchoPage {...stampProps} width={300} />);
      expect(flatten(getByTestId('flip-page-stamp-1')).width).toBe(300);
    });
  });
});
