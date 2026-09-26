import React from 'react';
import { StyleSheet } from 'react-native';
import { render, within } from '@testing-library/react-native';

import { PlanCalendar } from '@components/plan/PlanCalendar';

/* 契約書: docs/issues/issue-258-visit-plan.md（① 日曜始まり6週 × 7日の格子） */
const renderCalendar = () =>
  render(
    <PlanCalendar
      year={2026}
      month={10}
      today={new Date(2026, 8, 26)}
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
