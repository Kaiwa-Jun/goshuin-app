import React from 'react';
import { StyleSheet } from 'react-native';
import { render, fireEvent } from '@testing-library/react-native';
import { WishlistButton } from '@components/animated/WishlistButton';
import { colors } from '@theme/colors';

describe('WishlistButton', () => {
  it('未追加状態でfavorite-borderアイコンを表示する', () => {
    const { getByTestId } = render(<WishlistButton isWishlisted={false} onPress={() => {}} />);
    const button = getByTestId('wishlist-button');
    expect(button).toBeTruthy();
  });

  it('追加済み状態でfavoriteアイコンを表示する', () => {
    const { getByTestId } = render(<WishlistButton isWishlisted={true} onPress={() => {}} />);
    const button = getByTestId('wishlist-button');
    expect(button).toBeTruthy();
  });

  it('タップ時にonPressコールバックが呼ばれる', () => {
    const onPress = jest.fn();
    const { getByTestId } = render(<WishlistButton isWishlisted={false} onPress={onPress} />);
    fireEvent.press(getByTestId('wishlist-button'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('カスタムサイズが適用される', () => {
    const { getByTestId } = render(
      <WishlistButton isWishlisted={false} onPress={() => {}} size={32} />
    );
    expect(getByTestId('wishlist-button')).toBeTruthy();
  });

  it('デフォルトサイズは24', () => {
    const { getByTestId } = render(<WishlistButton isWishlisted={false} onPress={() => {}} />);
    expect(getByTestId('wishlist-button')).toBeTruthy();
  });

  it('isWishlisted が true のときに wishlist-button-active testID が存在する', () => {
    const { getByTestId } = render(<WishlistButton isWishlisted={true} onPress={() => {}} />);
    expect(getByTestId('wishlist-button-active')).toBeTruthy();
  });

  it('isWishlisted が false のときに wishlist-button-inactive testID が存在する', () => {
    const { getByTestId } = render(<WishlistButton isWishlisted={false} onPress={() => {}} />);
    expect(getByTestId('wishlist-button-inactive')).toBeTruthy();
  });

  it('追加済みのとき bookmark アイコンを使う（旗ではなく保存の比喩）', () => {
    const { getByTestId } = render(<WishlistButton isWishlisted={true} onPress={() => {}} />);
    expect(getByTestId('wishlist-button-active').props.name).toBe('bookmark');
  });

  it('未追加のとき bookmark-border アイコンを使う', () => {
    const { getByTestId } = render(<WishlistButton isWishlisted={false} onPress={() => {}} />);
    expect(getByTestId('wishlist-button-inactive').props.name).toBe('bookmark-border');
  });

  it('追加済みの色を地図ピンの行きたい色に揃える', () => {
    const { getByTestId } = render(<WishlistButton isWishlisted={true} onPress={() => {}} />);
    expect(getByTestId('wishlist-button-active').props.color).toBe(colors.pin.wishlisted);
  });

  it('タップ領域が 44pt 以上ある', () => {
    const { getByTestId } = render(<WishlistButton isWishlisted={false} onPress={() => {}} />);
    const style = StyleSheet.flatten(getByTestId('wishlist-button').props.style);
    expect(style.minWidth).toBeGreaterThanOrEqual(44);
    expect(style.minHeight).toBeGreaterThanOrEqual(44);
  });
});
