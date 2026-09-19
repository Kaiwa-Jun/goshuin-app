import React from 'react';
import { StyleSheet } from 'react-native';
import { render, fireEvent } from '@testing-library/react-native';
import { SearchBar } from '../SearchBar';
import { typography } from '@theme/typography';

describe('SearchBar', () => {
  it('デフォルトでは TextInput が入力可能', () => {
    const { getByTestId } = render(<SearchBar />);
    const input = getByTestId('search-input');
    expect(input.props.editable).not.toBe(false);
  });

  it('editable={false} + onPress 指定時、タップで onPress が呼ばれる', () => {
    const onPress = jest.fn();
    const { getByTestId } = render(<SearchBar editable={false} onPress={onPress} />);
    fireEvent.press(getByTestId('search-bar'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('editable={false} の場合 TextInput に editable={false} が設定される', () => {
    const { getByTestId } = render(<SearchBar editable={false} />);
    const input = getByTestId('search-input');
    expect(input.props.editable).toBe(false);
  });

  it('autoFocus={true} が TextInput に渡される', () => {
    const { getByTestId } = render(<SearchBar autoFocus={true} />);
    const input = getByTestId('search-input');
    expect(input.props.autoFocus).toBe(true);
  });

  it('autoFocus 未指定時は false', () => {
    const { getByTestId } = render(<SearchBar />);
    const input = getByTestId('search-input');
    expect(input.props.autoFocus).toBeFalsy();
  });

  it('入力欄に lineHeight を当てない。iOS で文字が下にずれ、プレースホルダとも高さが変わるため', () => {
    const { getByTestId } = render(<SearchBar value="建仁寺" />);
    const style = StyleSheet.flatten(getByTestId('search-input').props.style);

    expect(style.lineHeight).toBeUndefined();
    // 高さは保つ。外さないと検索バー自体が縮む
    expect(style.height).toBe(typography.body.lineHeight);
    expect(style.fontSize).toBe(typography.body.fontSize);
  });
});
