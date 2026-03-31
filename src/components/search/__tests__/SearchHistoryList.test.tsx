import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { SearchHistoryList } from '../SearchHistoryList';
import type { SearchHistoryItem } from '@hooks/useSearchHistory';

describe('SearchHistoryList', () => {
  const mockHistory: SearchHistoryItem[] = [
    { spotId: 'spot-1', spotName: '青葉神社' },
    { spotId: 'spot-2', spotName: '仙台東照宮' },
    { spotId: 'spot-3', spotName: '大崎八幡宮' },
  ];
  const mockOnSelect = jest.fn();
  const mockOnClear = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('履歴がある場合に「最近の検索」ヘッダーが表示される', () => {
    const { getByText } = render(
      <SearchHistoryList history={mockHistory} onSelect={mockOnSelect} onClear={mockOnClear} />
    );
    expect(getByText('最近の検索')).toBeTruthy();
  });

  it('履歴項目のスポット名が正しく表示される', () => {
    const { getByText } = render(
      <SearchHistoryList history={mockHistory} onSelect={mockOnSelect} onClear={mockOnClear} />
    );
    expect(getByText('青葉神社')).toBeTruthy();
    expect(getByText('仙台東照宮')).toBeTruthy();
    expect(getByText('大崎八幡宮')).toBeTruthy();
  });

  it('履歴項目タップで onSelect がアイテムごと呼ばれる', () => {
    const { getAllByTestId } = render(
      <SearchHistoryList history={mockHistory} onSelect={mockOnSelect} onClear={mockOnClear} />
    );
    fireEvent.press(getAllByTestId('history-item')[0]);
    expect(mockOnSelect).toHaveBeenCalledWith({ spotId: 'spot-1', spotName: '青葉神社' });
  });

  it('クリアボタンタップで onClear が呼ばれる', () => {
    const { getByTestId } = render(
      <SearchHistoryList history={mockHistory} onSelect={mockOnSelect} onClear={mockOnClear} />
    );
    fireEvent.press(getByTestId('clear-history-button'));
    expect(mockOnClear).toHaveBeenCalledTimes(1);
  });

  it('履歴が空の場合に「検索履歴はありません」が表示される', () => {
    const { getByText } = render(
      <SearchHistoryList history={[]} onSelect={mockOnSelect} onClear={mockOnClear} />
    );
    expect(getByText('検索履歴はありません')).toBeTruthy();
  });

  it('履歴が空の場合にクリアボタンが表示されない', () => {
    const { queryByTestId } = render(
      <SearchHistoryList history={[]} onSelect={mockOnSelect} onClear={mockOnClear} />
    );
    expect(queryByTestId('clear-history-button')).toBeNull();
  });
});
