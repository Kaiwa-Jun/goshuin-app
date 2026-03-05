import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { EditStampModal } from '../EditStampModal';

jest.mock('react-native-safe-area-context', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
  const { View } = require('react-native');
  return {
    SafeAreaView: View,
    SafeAreaProvider: View,
    useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  };
});

jest.mock('@react-native-community/datetimepicker', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: (props: { testID?: string; onChange?: (event: unknown, date?: Date) => void }) => (
      <View testID={props.testID} />
    ),
  };
});

describe('EditStampModal', () => {
  const defaultProps = {
    visible: true,
    onClose: jest.fn(),
    onSave: jest.fn(),
    isUpdating: false,
    initialVisitedAt: '2024-01-15',
    initialMemo: 'テストメモ',
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('visible=true で表示される', () => {
    const { getByTestId } = render(<EditStampModal {...defaultProps} />);
    expect(getByTestId('modal-content')).toBeTruthy();
  });

  it('初期値が訪問日フィールドに反映される', () => {
    const { getByText } = render(<EditStampModal {...defaultProps} />);
    expect(getByText('2024/01/15')).toBeTruthy();
  });

  it('初期値がメモフィールドに反映される', () => {
    const { getByDisplayValue } = render(<EditStampModal {...defaultProps} />);
    expect(getByDisplayValue('テストメモ')).toBeTruthy();
  });

  it('initialMemo が null のとき空文字で表示される', () => {
    const { getByPlaceholderText } = render(
      <EditStampModal {...defaultProps} initialMemo={null} />
    );
    expect(getByPlaceholderText('メモを入力')).toBeTruthy();
  });

  it('メモを変更して保存ボタンで onSave が正しいパラメータで呼ばれる', () => {
    const onSave = jest.fn();
    const { getByDisplayValue, getByText } = render(
      <EditStampModal {...defaultProps} onSave={onSave} />
    );

    fireEvent.changeText(getByDisplayValue('テストメモ'), '更新メモ');
    fireEvent.press(getByText('保存'));

    expect(onSave).toHaveBeenCalledWith({
      visited_at: '2024-01-15',
      memo: '更新メモ',
    });
  });

  it('日付ピッカートリガーをタップするとDateTimePickerが表示される', () => {
    const { getByTestId, queryByTestId } = render(<EditStampModal {...defaultProps} />);
    expect(queryByTestId('date-picker')).toBeNull();
    fireEvent.press(getByTestId('date-picker-trigger'));
    expect(getByTestId('date-picker')).toBeTruthy();
  });

  it('メモを空にして保存すると memo が null で渡される', () => {
    const onSave = jest.fn();
    const { getByDisplayValue, getByText } = render(
      <EditStampModal {...defaultProps} onSave={onSave} />
    );

    fireEvent.changeText(getByDisplayValue('テストメモ'), '');
    fireEvent.press(getByText('保存'));

    expect(onSave).toHaveBeenCalledWith({
      visited_at: '2024-01-15',
      memo: null,
    });
  });

  it('保存時に現在の日付がonSaveに渡される', () => {
    const onSave = jest.fn();
    const { getByText } = render(
      <EditStampModal {...defaultProps} onSave={onSave} initialMemo={null} />
    );

    fireEvent.press(getByText('保存'));

    expect(onSave).toHaveBeenCalledWith({
      visited_at: '2024-01-15',
      memo: null,
    });
  });

  it('キャンセルボタンで onClose が呼ばれる', () => {
    const onClose = jest.fn();
    const { getByText } = render(<EditStampModal {...defaultProps} onClose={onClose} />);
    fireEvent.press(getByText('キャンセル'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('isUpdating=true で「保存中...」表示 + ボタン disabled', () => {
    const { getByText, getByTestId } = render(
      <EditStampModal {...defaultProps} isUpdating={true} />
    );
    expect(getByText('保存中...')).toBeTruthy();
    const saveButton = getByTestId('button-primary');
    expect(saveButton.props.accessibilityState?.disabled).toBe(true);
  });
});
