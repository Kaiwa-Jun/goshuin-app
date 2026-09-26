import React from 'react';
import { StyleSheet } from 'react-native';
import { render, within } from '@testing-library/react-native';
import '@testing-library/react-native/extend-expect';

import { PlanCalendar } from '@components/plan/PlanCalendar';
import { colors } from '@theme/colors';

/* 契約書: docs/issues/issue-258-visit-plan.md（① 日曜始まり6週 × 7日の格子） */
const renderCalendar = (today = new Date(2026, 8, 26)) =>
  render(
    <PlanCalendar
      year={2026}
      month={10}
      today={today}
      plansByDate={new Map()}
      visitedByDate={new Map()}
      onPressDay={() => {}}
    />
  );

it('週ごとに1行・1行に7日（割合の幅で折り返すと端数で6日しか並ばない）', () => {
  const r = renderCalendar();
  const weeks = r.getAllByTestId(/^plan-week-\d$/);
  expect(weeks).toHaveLength(6);
  weeks.forEach(w => {
    expect(within(w).getAllByTestId(/^plan-day-/)).toHaveLength(7);
    expect(StyleSheet.flatten(w.props.style).flexDirection).toBe('row');
  });
  expect(within(weeks[0]).getAllByTestId(/^plan-day-/)[0].props.testID).toBe('plan-day-2026-09-27');
  // 日のセルは割合の幅ではなく flex で等分する
  const day = StyleSheet.flatten(r.getByTestId('plan-day-2026-10-01').props.style);
  expect(day.flex).toBe(1);
  expect(day.width).toBeUndefined();
});

it('押せない過去の日は数字を薄くする（今日以降と見分けがつくように）', () => {
  const r = renderCalendar(new Date(2026, 9, 2));
  const num = (ymd: string) =>
    StyleSheet.flatten(
      within(r.getByTestId(`plan-day-${ymd}`)).getByText(String(Number(ymd.slice(8)))).props.style
    );
  // 10/2 が今日。10/1 は過ぎた日、10/5 はこれから
  expect(num('2026-10-01').color).toBe(colors.gray[300]);
  expect(num('2026-10-05').color).toBe(colors.gray[900]);
  expect(r.getByTestId('plan-day-2026-10-01')).toBeDisabled();
});
