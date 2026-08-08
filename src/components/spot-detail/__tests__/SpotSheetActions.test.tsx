import React from 'react';
import { StyleSheet } from 'react-native';
import { render, fireEvent } from '@testing-library/react-native';
import { SpotSheetActions } from '../SpotSheetActions';
import { colors } from '@theme/colors';

describe('SpotSheetActions', () => {
  const defaultProps = {
    isWishlisted: false,
    onWishlistPress: jest.fn(),
    onRecordPress: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('アクション行を描画する', () => {
    const { getByTestId } = render(<SpotSheetActions {...defaultProps} />);
    expect(getByTestId('spot-sheet-actions')).toBeTruthy();
  });

  it('「行きたい」と「記録する」を並べる', () => {
    const { getByTestId, getByText } = render(<SpotSheetActions {...defaultProps} />);
    expect(getByTestId('wishlist-action-button')).toBeTruthy();
    expect(getByTestId('record-action-button')).toBeTruthy();
    expect(getByText('行きたい')).toBeTruthy();
    expect(getByText('記録する')).toBeTruthy();
  });

  it('横並びにする', () => {
    const { getByTestId } = render(<SpotSheetActions {...defaultProps} />);
    const style = StyleSheet.flatten(getByTestId('spot-sheet-actions').props.style);
    expect(style.flexDirection).toBe('row');
  });

  it('記録するのタップで onRecordPress を呼ぶ', () => {
    const onRecordPress = jest.fn();
    const { getByTestId } = render(
      <SpotSheetActions {...defaultProps} onRecordPress={onRecordPress} />
    );
    fireEvent.press(getByTestId('record-action-button'));
    expect(onRecordPress).toHaveBeenCalledTimes(1);
  });

  it('行きたいのタップで onWishlistPress を呼ぶ', () => {
    const onWishlistPress = jest.fn();
    const { getByTestId } = render(
      <SpotSheetActions {...defaultProps} onWishlistPress={onWishlistPress} />
    );
    fireEvent.press(getByTestId('wishlist-action-button'));
    expect(onWishlistPress).toHaveBeenCalledTimes(1);
  });

  // A-12: 未来（行きたい）と過去（記録）をアイコンで区別する
  it('意味の違うアイコンを使う', () => {
    const { getByTestId } = render(<SpotSheetActions {...defaultProps} />);
    const icons = getByTestId('spot-sheet-actions').findAllByProps({ testID: 'button-icon' });
    const names = icons.map((i: { props: { name: string } }) => i.props.name);
    expect(names).toContain('bookmark-border');
    expect(names).toContain('photo-camera');
  });

  it('行きたいが有効なとき塗りのブックマークになる', () => {
    const { getByTestId } = render(<SpotSheetActions {...defaultProps} isWishlisted={true} />);
    const icons = getByTestId('spot-sheet-actions').findAllByProps({ testID: 'button-icon' });
    const names = icons.map((i: { props: { name: string } }) => i.props.name);
    expect(names).toContain('bookmark');
  });

  // A-7: 記録するがシート内で最も強い CTA
  it('記録するは塗りボタン、行きたいは枠のみ', () => {
    const { getByTestId } = render(<SpotSheetActions {...defaultProps} />);
    const record = StyleSheet.flatten(getByTestId('record-action-button').props.style);
    const wishlist = StyleSheet.flatten(getByTestId('wishlist-action-button').props.style);
    expect(record.backgroundColor).toBe(colors.primary[500]);
    expect(wishlist.backgroundColor).toBe(colors.transparent);
    expect(wishlist.borderWidth).toBe(1);
  });

  it('両ボタンとも 44pt 以上の高さを確保する', () => {
    const { getByTestId } = render(<SpotSheetActions {...defaultProps} />);
    for (const id of ['record-action-button', 'wishlist-action-button']) {
      const style = StyleSheet.flatten(getByTestId(id).props.style);
      expect(style.minHeight).toBeGreaterThanOrEqual(44);
    }
  });

  describe('行きたいが使えない文脈（スポット詳細画面など）', () => {
    it('onWishlistPress が無いとき行きたいを描画しない', () => {
      const { queryByTestId, getByTestId } = render(
        <SpotSheetActions isWishlisted={false} onRecordPress={() => {}} />
      );
      expect(queryByTestId('wishlist-action-button')).toBeNull();
      expect(getByTestId('record-action-button')).toBeTruthy();
    });

    it('isWishlisted が未指定のとき行きたいを描画しない', () => {
      const { queryByTestId } = render(
        <SpotSheetActions onWishlistPress={() => {}} onRecordPress={() => {}} />
      );
      expect(queryByTestId('wishlist-action-button')).toBeNull();
    });
  });
});
