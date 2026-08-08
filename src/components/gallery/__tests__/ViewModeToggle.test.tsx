import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { ViewModeToggle } from '@components/gallery/ViewModeToggle';
import { colors } from '@theme/colors';

const flatten = (node: { props: { style?: unknown } }) =>
  StyleSheet.flatten(node.props.style) as Record<string, unknown>;

describe('ViewModeToggle', () => {
  it('2つのボタンを描画する', () => {
    const { getByTestId } = render(<ViewModeToggle mode="flip" onChange={jest.fn()} />);
    expect(getByTestId('view-mode-toggle')).toBeTruthy();
    expect(getByTestId('view-mode-flip')).toBeTruthy();
    expect(getByTestId('view-mode-grid')).toBeTruthy();
  });

  it('グリッドを押すと onChange が grid で呼ばれる', () => {
    const onChange = jest.fn();
    const { getByTestId } = render(<ViewModeToggle mode="flip" onChange={onChange} />);
    fireEvent.press(getByTestId('view-mode-grid'));
    expect(onChange).toHaveBeenCalledWith('grid');
  });

  it('めくりを押すと onChange が flip で呼ばれる', () => {
    const onChange = jest.fn();
    const { getByTestId } = render(<ViewModeToggle mode="grid" onChange={onChange} />);
    fireEvent.press(getByTestId('view-mode-flip'));
    expect(onChange).toHaveBeenCalledWith('flip');
  });

  it('選択中のアイコンが primary[500]、未選択が gray[400] である（flip 選択時）', () => {
    const { getByTestId } = render(<ViewModeToggle mode="flip" onChange={jest.fn()} />);
    expect(getByTestId('view-mode-flip-icon').props.color).toBe(colors.primary[500]);
    expect(getByTestId('view-mode-grid-icon').props.color).toBe(colors.gray[400]);
  });

  it('選択中のアイコンが primary[500]、未選択が gray[400] である（grid 選択時）', () => {
    const { getByTestId } = render(<ViewModeToggle mode="grid" onChange={jest.fn()} />);
    expect(getByTestId('view-mode-grid-icon').props.color).toBe(colors.primary[500]);
    expect(getByTestId('view-mode-flip-icon').props.color).toBe(colors.gray[400]);
  });

  it('各ボタンのタップ領域が 44pt 以上である', () => {
    const { getByTestId } = render(<ViewModeToggle mode="flip" onChange={jest.fn()} />);
    for (const id of ['view-mode-flip', 'view-mode-grid']) {
      const style = flatten(getByTestId(id));
      expect(style.minHeight as number).toBeGreaterThanOrEqual(44);
      expect(style.minWidth as number).toBeGreaterThanOrEqual(44);
    }
  });

  it('選択中のボタンに accessibilityState.selected が立つ', () => {
    const { getByTestId } = render(<ViewModeToggle mode="flip" onChange={jest.fn()} />);
    expect(getByTestId('view-mode-flip').props.accessibilityState.selected).toBe(true);
    expect(getByTestId('view-mode-grid').props.accessibilityState.selected).toBe(false);
  });
});
