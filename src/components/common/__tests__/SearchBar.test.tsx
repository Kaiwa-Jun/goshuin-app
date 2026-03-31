import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { SearchBar } from '../SearchBar';

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
});
