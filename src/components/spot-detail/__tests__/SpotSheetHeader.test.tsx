import React from 'react';
import { StyleSheet } from 'react-native';
import { render } from '@testing-library/react-native';
import { SpotSheetHeader } from '../SpotSheetHeader';
import { colors } from '@theme/colors';
import type { Spot } from '@/types/supabase';

const mockShrine: Spot = {
  id: 'spot-1',
  name: '仙台東照宮',
  lat: 38.28,
  lng: 140.88,
  type: 'shrine',
  address: '宮城県仙台市青葉区東照宮一丁目6-1',
  prefecture: null,
  status: 'active',
  rank: 3,
  created_by_user_id: null,
  merged_into_spot_id: null,
  created_at: '2024-01-01',
  updated_at: '2024-01-01',
};

const mockTemple: Spot = {
  ...mockShrine,
  id: 'spot-2',
  name: '瑞巌寺',
  type: 'temple',
  address: '宮城県宮城郡松島町松島字町内91',
};

describe('SpotSheetHeader', () => {
  const defaultProps = {
    spot: mockShrine,
    isVisited: false,
  };

  it('renders spot name', () => {
    const { getByText } = render(<SpotSheetHeader {...defaultProps} />);
    expect(getByText('仙台東照宮')).toBeTruthy();
  });

  it('renders shrine badge for shrine type', () => {
    const { getByTestId } = render(<SpotSheetHeader {...defaultProps} />);
    expect(getByTestId('badge-shrine')).toBeTruthy();
  });

  it('renders temple badge for temple type', () => {
    const { getByTestId } = render(<SpotSheetHeader {...defaultProps} spot={mockTemple} />);
    expect(getByTestId('badge-temple')).toBeTruthy();
  });

  it('renders address', () => {
    const { getByText } = render(<SpotSheetHeader {...defaultProps} />);
    expect(getByText('宮城県仙台市青葉区東照宮一丁目6-1')).toBeTruthy();
  });

  it('renders visited badge when isVisited is true', () => {
    const { getByTestId } = render(<SpotSheetHeader {...defaultProps} isVisited={true} />);
    expect(getByTestId('badge-visited')).toBeTruthy();
  });

  it('does not render visited badge when isVisited is false', () => {
    const { queryByTestId } = render(<SpotSheetHeader {...defaultProps} isVisited={false} />);
    expect(queryByTestId('badge-visited')).toBeNull();
  });

  it('handles null address gracefully', () => {
    const spotNoAddress = { ...mockShrine, address: null };
    const { queryByTestId } = render(<SpotSheetHeader {...defaultProps} spot={spotNoAddress} />);
    expect(queryByTestId('spot-sheet-address')).toBeNull();
  });

  // A-6: 名前・バッジ・行きたい標示を1行に集約する
  describe('1行に集約したヘッダー', () => {
    it('名前とバッジが同じ行に入る', () => {
      const { getByTestId } = render(<SpotSheetHeader {...defaultProps} />);
      const row = getByTestId('spot-sheet-name-row');
      const style = StyleSheet.flatten(row.props.style);
      expect(style.flexDirection).toBe('row');
      expect(style.alignItems).toBe('center');
    });

    it('spot-name の children はスポット名の文字列そのもの', () => {
      // SpotDetailScreen.test.tsx が props.children を文字列として参照している
      const { getByTestId } = render(<SpotSheetHeader {...defaultProps} />);
      expect(getByTestId('spot-name').props.children).toBe('仙台東照宮');
    });

    it('名前は1行に丸めて残りの幅を占める', () => {
      const { getByTestId } = render(<SpotSheetHeader {...defaultProps} />);
      const name = getByTestId('spot-name');
      expect(name.props.numberOfLines).toBe(1);
      expect(StyleSheet.flatten(name.props.style).flex).toBe(1);
    });
  });

  // A-12: ヘッダーの行きたいは「状態の標示」であって操作系ではない
  describe('行きたい標示', () => {
    it('isWishlisted が true のとき標示を出す', () => {
      const { getByTestId } = render(<SpotSheetHeader {...defaultProps} isWishlisted={true} />);
      const indicator = getByTestId('spot-sheet-wishlist-indicator');
      expect(indicator.props.name).toBe('bookmark');
      expect(indicator.props.color).toBe(colors.pin.wishlisted);
    });

    it('isWishlisted が false のとき標示を出さない', () => {
      const { queryByTestId } = render(<SpotSheetHeader {...defaultProps} isWishlisted={false} />);
      expect(queryByTestId('spot-sheet-wishlist-indicator')).toBeNull();
    });

    it('isWishlisted が未指定のとき標示を出さない', () => {
      const { queryByTestId } = render(<SpotSheetHeader {...defaultProps} />);
      expect(queryByTestId('spot-sheet-wishlist-indicator')).toBeNull();
    });

    it('ヘッダーには操作可能な行きたいボタンを置かない（アクション行に一本化）', () => {
      const { queryByTestId } = render(<SpotSheetHeader {...defaultProps} isWishlisted={true} />);
      expect(queryByTestId('wishlist-button')).toBeNull();
    });
  });
});
