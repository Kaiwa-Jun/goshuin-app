import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { PhotoSection } from '../PhotoSection';

describe('PhotoSection', () => {
  const mockOnPress = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('未選択時に「写真を追加」テキスト表示', () => {
    const { getByText } = render(
      <PhotoSection imageUri={null} onPress={mockOnPress} error={null} />
    );

    expect(getByText('写真を追加')).toBeTruthy();
  });

  it('選択済み時に Image コンポーネントと「変更」テキスト表示', () => {
    const { getByTestId, getByText } = render(
      <PhotoSection imageUri="file://photo.jpg" onPress={mockOnPress} error={null} />
    );

    expect(getByTestId('photo-preview')).toBeTruthy();
    expect(getByText('変更')).toBeTruthy();
  });

  it('タップで onPress 呼出', () => {
    const { getByTestId } = render(
      <PhotoSection imageUri={null} onPress={mockOnPress} error={null} />
    );

    fireEvent.press(getByTestId('photo-section'));

    expect(mockOnPress).toHaveBeenCalled();
  });

  it('error 表示', () => {
    const { getByText } = render(
      <PhotoSection imageUri={null} onPress={mockOnPress} error="写真を選択してください" />
    );

    expect(getByText('写真を選択してください')).toBeTruthy();
  });
});
