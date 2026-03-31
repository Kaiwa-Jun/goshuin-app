import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { FilterChips } from '../FilterChips';

const options = [
  { key: 'all', label: 'すべて' },
  { key: 'shrine', label: '神社' },
  { key: 'temple', label: 'お寺' },
];

describe('FilterChips', () => {
  it('options が正しくレンダリングされる', () => {
    const { getByText } = render(
      <FilterChips options={options} selectedKey="all" onSelect={jest.fn()} />
    );
    expect(getByText('すべて')).toBeTruthy();
    expect(getByText('神社')).toBeTruthy();
    expect(getByText('お寺')).toBeTruthy();
  });

  it('selectedKey のチップがアクティブスタイルを持つ', () => {
    const { getByTestId } = render(
      <FilterChips options={options} selectedKey="shrine" onSelect={jest.fn()} />
    );
    const shrineChip = getByTestId('filter-chip-shrine');
    // アクティブなチップは active スタイルを持つ
    expect(shrineChip.props.accessibilityState?.selected).toBe(true);
  });

  it('非選択のチップは selected でない', () => {
    const { getByTestId } = render(
      <FilterChips options={options} selectedKey="shrine" onSelect={jest.fn()} />
    );
    const allChip = getByTestId('filter-chip-all');
    expect(allChip.props.accessibilityState?.selected).toBeFalsy();
  });

  it('チップタップで onSelect が呼ばれる', () => {
    const onSelect = jest.fn();
    const { getByTestId } = render(
      <FilterChips options={options} selectedKey="all" onSelect={onSelect} />
    );
    fireEvent.press(getByTestId('filter-chip-shrine'));
    expect(onSelect).toHaveBeenCalledWith('shrine');
  });
});
