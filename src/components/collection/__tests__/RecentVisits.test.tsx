import { fireEvent, render } from '@testing-library/react-native';

import { RecentVisits } from '@components/collection/RecentVisits';
import { colors } from '@theme/colors';

const stamp = (id: string, name: string, type: string, visitedAt: string) =>
  ({ id, spots: { name, type }, visited_at: visitedAt }) as never;

describe('RecentVisits', () => {
  it('寺社名・種別・MM/DD を新しい順に出す', () => {
    const { getByText, getByTestId } = render(
      <RecentVisits
        stamps={[
          stamp('1', '湯島天満宮', 'shrine', '2026-09-20'),
          stamp('2', '浅草寺', 'temple', '2026-09-14'),
          stamp('3', '大崎八幡宮', 'shrine', '2026-08-31'),
        ]}
        onSeeAll={jest.fn()}
      />
    );

    expect(getByTestId('recent-visits-section')).toBeTruthy();
    expect(getByText('最近の参拝')).toBeTruthy();
    expect(getByText('湯島天満宮')).toBeTruthy();
    expect(getByText('09/20')).toBeTruthy();
    expect(getByText('08/31')).toBeTruthy();
    expect(getByText('寺院')).toBeTruthy();
  });

  it('神社と寺で印の色を変える', () => {
    const { getAllByText } = render(
      <RecentVisits stamps={[stamp('1', '浅草寺', 'temple', '2026-09-14')]} onSeeAll={jest.fn()} />
    );

    const chip = getAllByText('寺院')[0];
    expect(chip.props.style.flat(Infinity)).toContainEqual({ color: colors.temple[600] });
  });

  /*
   * visited_at は DATE 型。new Date() を挟むと Issue #204 と同じ1日ずれを踏むので、
   * 文字列のまま切る。月末の日付で落ちる
   */
  it('日付は文字列のまま切る（時差でずらさない）', () => {
    const { getByText } = render(
      <RecentVisits
        stamps={[stamp('1', '湯島天満宮', 'shrine', '2026-12-31')]}
        onSeeAll={jest.fn()}
      />
    );

    expect(getByText('12/31')).toBeTruthy();
  });

  it('0件ならセクションごと出さない', () => {
    const { queryByTestId, queryByText } = render(
      <RecentVisits stamps={[]} onSeeAll={jest.fn()} />
    );

    expect(queryByTestId('recent-visits-section')).toBeNull();
    expect(queryByText('最近の参拝')).toBeNull();
  });

  it('「すべて見る」で御朱印帳へ渡す', () => {
    const onSeeAll = jest.fn();
    const { getByTestId } = render(
      <RecentVisits
        stamps={[stamp('1', '湯島天満宮', 'shrine', '2026-09-20')]}
        onSeeAll={onSeeAll}
      />
    );

    fireEvent.press(getByTestId('recent-visits-see-all'));

    expect(onSeeAll).toHaveBeenCalledTimes(1);
  });
});
