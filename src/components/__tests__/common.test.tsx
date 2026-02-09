import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { Button } from '@components/common/Button';
import { Badge } from '@components/common/Badge';
import { Card } from '@components/common/Card';
import { SearchBar } from '@components/common/SearchBar';
import { PageIndicator } from '@components/common/PageIndicator';
import { LoadingIndicator } from '@components/common/LoadingIndicator';
import { TextInput } from '@components/common/TextInput';
import { Header } from '@components/common/Header';
import { Modal } from '@components/common/Modal';
import { MapPin } from '@components/common/MapPin';
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

    it('shows clear button when showClearButton is true', () => {
      const { getByTestId } = render(<SearchBar showClearButton />);
      expect(getByTestId('search-clear-button')).toBeTruthy();
    });

    it('does not show clear button by default', () => {
      const { queryByTestId } = render(<SearchBar />);
      expect(queryByTestId('search-clear-button')).toBeNull();
    });

    it('calls onClear when clear button is pressed', () => {
      const onClear = jest.fn();
      const { getByTestId } = render(<SearchBar showClearButton onClear={onClear} />);
      fireEvent.press(getByTestId('search-clear-button'));
      expect(onClear).toHaveBeenCalled();
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

  describe('LoadingIndicator', () => {
    it('renders with default props', () => {
      const { getByTestId } = render(<LoadingIndicator />);
      expect(getByTestId('loading-indicator')).toBeTruthy();
    });

    it('renders with message', () => {
      const { getByTestId } = render(<LoadingIndicator message="読み込み中..." />);
      expect(getByTestId('loading-message')).toBeTruthy();
    });

    it('does not render message when not provided', () => {
      const { queryByTestId } = render(<LoadingIndicator />);
      expect(queryByTestId('loading-message')).toBeNull();
    });

    it('renders fullScreen variant', () => {
      const { getByTestId } = render(<LoadingIndicator fullScreen />);
      expect(getByTestId('loading-indicator')).toBeTruthy();
    });
  });

  describe('TextInput', () => {
    it('renders with placeholder', () => {
      const { getByTestId, getByPlaceholderText } = render(
        <TextInput placeholder="入力してください" />
      );
      expect(getByTestId('text-input')).toBeTruthy();
      expect(getByPlaceholderText('入力してください')).toBeTruthy();
    });

    it('renders with label', () => {
      const { getByTestId } = render(<TextInput label="名前" />);
      expect(getByTestId('text-input-label')).toBeTruthy();
    });

    it('renders error message', () => {
      const { getByTestId } = render(<TextInput error="入力必須です" />);
      expect(getByTestId('text-input-error')).toBeTruthy();
    });

    it('does not render label when not provided', () => {
      const { queryByTestId } = render(<TextInput />);
      expect(queryByTestId('text-input-label')).toBeNull();
    });

    it('does not render error when not provided', () => {
      const { queryByTestId } = render(<TextInput />);
      expect(queryByTestId('text-input-error')).toBeNull();
    });

    it('calls onChangeText', () => {
      const onChangeText = jest.fn();
      const { getByTestId } = render(<TextInput onChangeText={onChangeText} />);
      fireEvent.changeText(getByTestId('text-input'), 'テスト');
      expect(onChangeText).toHaveBeenCalledWith('テスト');
    });
  });

  describe('Header', () => {
    it('renders with title', () => {
      const { getByTestId } = render(<Header title="テストタイトル" />);
      expect(getByTestId('header')).toBeTruthy();
      expect(getByTestId('header-title')).toBeTruthy();
    });

    it('renders back button when onBack provided', () => {
      const { getByTestId } = render(<Header title="テスト" onBack={() => {}} />);
      expect(getByTestId('header-back-button')).toBeTruthy();
    });

    it('renders close button when onClose provided', () => {
      const { getByTestId } = render(<Header title="テスト" onClose={() => {}} />);
      expect(getByTestId('header-close-button')).toBeTruthy();
    });

    it('calls onBack when back button pressed', () => {
      const onBack = jest.fn();
      const { getByTestId } = render(<Header title="テスト" onBack={onBack} />);
      fireEvent.press(getByTestId('header-back-button'));
      expect(onBack).toHaveBeenCalled();
    });

    it('calls onClose when close button pressed', () => {
      const onClose = jest.fn();
      const { getByTestId } = render(<Header title="テスト" onClose={onClose} />);
      fireEvent.press(getByTestId('header-close-button'));
      expect(onClose).toHaveBeenCalled();
    });

    it('renders rightElement', () => {
      const { getByText } = render(<Header title="テスト" rightElement={<Text>右</Text>} />);
      expect(getByText('右')).toBeTruthy();
    });
  });

  describe('Modal', () => {
    it('renders when visible', () => {
      const { getByTestId } = render(
        <Modal visible onClose={() => {}}>
          <Text>モーダル内容</Text>
        </Modal>
      );
      expect(getByTestId('modal-overlay')).toBeTruthy();
      expect(getByTestId('modal-content')).toBeTruthy();
    });

    it('renders with title', () => {
      const { getByTestId } = render(
        <Modal visible onClose={() => {}} title="テストモーダル">
          <Text>内容</Text>
        </Modal>
      );
      expect(getByTestId('modal-title')).toBeTruthy();
    });

    it('does not render title when not provided', () => {
      const { queryByTestId } = render(
        <Modal visible onClose={() => {}}>
          <Text>内容</Text>
        </Modal>
      );
      expect(queryByTestId('modal-title')).toBeNull();
    });

    it('renders children', () => {
      const { getByText } = render(
        <Modal visible onClose={() => {}}>
          <Text>子要素テスト</Text>
        </Modal>
      );
      expect(getByText('子要素テスト')).toBeTruthy();
    });

    it('calls onClose on backdrop press when closeOnBackdrop is true', () => {
      const onClose = jest.fn();
      const { getByTestId } = render(
        <Modal visible onClose={onClose} closeOnBackdrop>
          <Text>内容</Text>
        </Modal>
      );
      fireEvent.press(getByTestId('modal-overlay'));
      expect(onClose).toHaveBeenCalled();
    });
  });

  describe('MapPin', () => {
    it('renders shrine-visited pin', () => {
      const { getByTestId } = render(<MapPin type="shrine-visited" />);
      expect(getByTestId('map-pin-shrine-visited')).toBeTruthy();
    });

    it('renders temple-visited pin', () => {
      const { getByTestId } = render(<MapPin type="temple-visited" />);
      expect(getByTestId('map-pin-temple-visited')).toBeTruthy();
    });

    it('renders unvisited pin', () => {
      const { getByTestId } = render(<MapPin type="unvisited" />);
      expect(getByTestId('map-pin-unvisited')).toBeTruthy();
    });

    it('renders current-location pin with pulse', () => {
      const { getByTestId } = render(<MapPin type="current-location" />);
      expect(getByTestId('map-pin-current-location')).toBeTruthy();
      expect(getByTestId('map-pin-pulse')).toBeTruthy();
    });

    it('does not render pulse for non-current-location pins', () => {
      const { queryByTestId } = render(<MapPin type="shrine-visited" />);
      expect(queryByTestId('map-pin-pulse')).toBeNull();
    });
  });
});
