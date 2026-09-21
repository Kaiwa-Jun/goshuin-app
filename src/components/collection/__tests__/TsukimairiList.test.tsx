import { fireEvent, render } from '@testing-library/react-native';

import { TsukimairiList } from '@components/collection/TsukimairiList';
import { tsukimairiOf } from '@utils/tsukimairi';

const entry = (spotId: string, spotName: string, months: string[], today: string) => ({
  ...tsukimairiOf(
    months.map(m => `${m}-10`),
    today
  ),
  spotId,
  spotName,
});

describe('TsukimairiList', () => {
  it('続いている寺社を、丸の数とあと何ヶ月かで出す', () => {
    const { getByTestId, getByText } = render(
      <TsukimairiList
        entries={[entry('a', '湯島天満宮', ['2026-07', '2026-08', '2026-09'], '2026-09-20')]}
        onPressSpot={jest.fn()}
      />
    );

    expect(getByTestId('tsukimairi-section')).toBeTruthy();
    expect(getByText('湯島天満宮')).toBeTruthy();
    expect(getByText('あと9')).toBeTruthy();
    expect(getByText('1社')).toBeTruthy();
  });

  it('満願なら「満願」と出す', () => {
    const twelve = Array.from({ length: 12 }, (_, i) => `2026-${String(i + 1).padStart(2, '0')}`);
    const { getByText } = render(
      <TsukimairiList
        entries={[entry('a', '湯島天満宮', twelve, '2026-12-20')]}
        onPressSpot={jest.fn()}
      />
    );

    expect(getByText('満願')).toBeTruthy();
  });

  // 1社も続いていなければ、セクションごと出さない
  it('空なら何も出さない', () => {
    const { queryByTestId } = render(<TsukimairiList entries={[]} onPressSpot={jest.fn()} />);

    expect(queryByTestId('tsukimairi-section')).toBeNull();
  });

  it('読み上げで、あと何ヶ月かが分かる', () => {
    const { getByTestId } = render(
      <TsukimairiList
        entries={[entry('a', '湯島天満宮', ['2026-08', '2026-09'], '2026-09-20')]}
        onPressSpot={jest.fn()}
      />
    );

    expect(getByTestId('tsukimairi-row-a').props.accessibilityLabel).toBe(
      '湯島天満宮、12ヶ月のうち2ヶ月。満願まであと10ヶ月'
    );
  });

  it('押すとその寺社が渡る', () => {
    const onPressSpot = jest.fn();
    const { getByTestId } = render(
      <TsukimairiList
        entries={[entry('a', '湯島天満宮', ['2026-08', '2026-09'], '2026-09-20')]}
        onPressSpot={onPressSpot}
      />
    );

    fireEvent.press(getByTestId('tsukimairi-row-a'));

    expect(onPressSpot).toHaveBeenCalledWith('a');
  });
});
