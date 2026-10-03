import { fireEvent, render } from '@testing-library/react-native';

import { SpotPlacePicker } from '@components/record/SpotPlacePicker';

/* 契約書: docs/issues/issue-248-spot-add-research.md（S4 / UI-11・AC-34） */
const props = (over = {}) => ({
  visible: true,
  initialName: '天龍寺',
  initialCenter: { latitude: 38.26, longitude: 140.87 },
  saving: false,
  saveFailed: false,
  onBack: jest.fn(),
  onSave: jest.fn(),
  ...over,
});

describe('SpotPlacePicker', () => {
  it('見出し・案内・名前（初期値は検索語）・種別（「寺」なら寺院）・ボタン・注記', () => {
    const ui = render(<SpotPlacePicker {...props()} />);
    expect(ui.getByText('場所を決める')).toBeTruthy();
    expect(ui.getByText('地図を動かして、ピンを寺社の場所に合わせてください')).toBeTruthy();
    expect(ui.getByTestId('place-picker-name').props.value).toBe('天龍寺');
    expect(ui.getByTestId('place-picker-type-temple').props.accessibilityState).toEqual({
      selected: true,
    });
    expect(ui.getByText('この場所で記録する')).toBeTruthy();
    expect(ui.getByText('この寺社は、あなたの記録にだけ出ます')).toBeTruthy();
  });

  it('名前が空なら押せない', () => {
    const p = props();
    const ui = render(<SpotPlacePicker {...p} />);
    fireEvent.changeText(ui.getByTestId('place-picker-name'), '  ');
    fireEvent.press(ui.getByTestId('place-picker-save'));
    expect(p.onSave).not.toHaveBeenCalled();
  });

  it('保存するのは地図の中心（最後に動かした先）で、最初の位置ではない', () => {
    const p = props();
    const ui = render(<SpotPlacePicker {...p} />);
    fireEvent(ui.getByTestId('place-picker-map'), 'regionDidChange', {
      nativeEvent: { center: [141.0894, 38.4803], zoom: 16 },
    });
    fireEvent.press(ui.getByTestId('place-picker-type-shrine'));
    fireEvent.press(ui.getByTestId('place-picker-save'));
    expect(p.onSave).toHaveBeenCalledWith({
      name: '天龍寺',
      type: 'shrine',
      lat: 38.4803,
      lng: 141.0894,
    });
  });
});
