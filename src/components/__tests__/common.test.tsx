import React from 'react';
import { render } from '@testing-library/react-native';
import { Button } from '@components/common/Button';
import { Badge } from '@components/common/Badge';
import { Card } from '@components/common/Card';
import { SearchBar } from '@components/common/SearchBar';
import { PageIndicator } from '@components/common/PageIndicator';
import { Text } from 'react-native';

describe('Common Components', () => {
  describe('Button', () => {
    it('renders with title', () => {
      const { getByText } = render(<Button title="テスト" onPress={() => {}} />);
      expect(getByText('テスト')).toBeTruthy();
    });

    it('renders primary variant by default', () => {
      const { getByTestId } = render(<Button title="テスト" onPress={() => {}} />);
      expect(getByTestId('button-primary')).toBeTruthy();
    });

    it('renders outline variant', () => {
      const { getByTestId } = render(
        <Button title="テスト" onPress={() => {}} variant="outline" />
      );
      expect(getByTestId('button-outline')).toBeTruthy();
    });

    it('renders secondary variant', () => {
      const { getByTestId } = render(
        <Button title="テスト" onPress={() => {}} variant="secondary" />
      );
      expect(getByTestId('button-secondary')).toBeTruthy();
    });

    it('renders ghost variant', () => {
      const { getByTestId } = render(<Button title="テスト" onPress={() => {}} variant="ghost" />);
      expect(getByTestId('button-ghost')).toBeTruthy();
    });
  });

  describe('Badge', () => {
    it('renders shrine badge', () => {
      const { getByTestId, getByText } = render(<Badge type="shrine" />);
      expect(getByTestId('badge-shrine')).toBeTruthy();
      expect(getByText('神社')).toBeTruthy();
    });

    it('renders temple badge', () => {
      const { getByTestId, getByText } = render(<Badge type="temple" />);
      expect(getByTestId('badge-temple')).toBeTruthy();
      expect(getByText('寺院')).toBeTruthy();
    });

    it('renders visited badge', () => {
      const { getByTestId, getByText } = render(<Badge type="visited" />);
      expect(getByTestId('badge-visited')).toBeTruthy();
      expect(getByText('訪問済み')).toBeTruthy();
    });

    it('renders custom label', () => {
      const { getByText } = render(<Badge type="shrine" label="カスタム" />);
      expect(getByText('カスタム')).toBeTruthy();
    });
  });

  describe('Card', () => {
    it('renders children', () => {
      const { getByText, getByTestId } = render(
        <Card>
          <Text>カード内容</Text>
        </Card>
      );
      expect(getByTestId('card')).toBeTruthy();
      expect(getByText('カード内容')).toBeTruthy();
    });
  });

  describe('SearchBar', () => {
    it('renders with default placeholder', () => {
      const { getByTestId, getByPlaceholderText } = render(<SearchBar />);
      expect(getByTestId('search-bar')).toBeTruthy();
      expect(getByPlaceholderText('神社・寺院を検索')).toBeTruthy();
    });

    it('renders with custom placeholder', () => {
      const { getByPlaceholderText } = render(<SearchBar placeholder="カスタム検索" />);
      expect(getByPlaceholderText('カスタム検索')).toBeTruthy();
    });
  });

  describe('PageIndicator', () => {
    it('renders correct number of dots', () => {
      const { getByTestId, getAllByTestId } = render(<PageIndicator total={4} current={0} />);
      expect(getByTestId('page-indicator')).toBeTruthy();
      expect(getAllByTestId('dot-active')).toHaveLength(1);
      expect(getAllByTestId('dot-inactive')).toHaveLength(3);
    });

    it('highlights correct dot', () => {
      const { getAllByTestId } = render(<PageIndicator total={4} current={2} />);
      expect(getAllByTestId('dot-active')).toHaveLength(1);
      expect(getAllByTestId('dot-inactive')).toHaveLength(3);
    });
  });
});
