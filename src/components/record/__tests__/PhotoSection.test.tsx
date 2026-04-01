import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { Image } from 'react-native';
import { PhotoSection } from '../PhotoSection';

jest
  .spyOn(Image, 'getSize')
  .mockImplementation((_uri: string, success: (width: number, height: number) => void) => {
    success(300, 400);
  });

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

  it('選択済み時に Image コンポーネント表示', () => {
    const { getByTestId } = render(
      <PhotoSection imageUri="file://photo.jpg" onPress={mockOnPress} error={null} />
    );

    expect(getByTestId('photo-preview')).toBeTruthy();
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
