import React from 'react';
import { StyleSheet } from 'react-native';
import { render } from '@testing-library/react-native';

import { PlanSaveSheet } from '@components/plan/PlanSheets';

it('名前の入力欄は行の高さを持たない（iOS では文字と placeholder が下にずれる）', () => {
  const r = render(
    <PlanSaveSheet
      visible
      plannedOn="2026-10-03"
      initialName=""
      canDelete={false}
      saving={false}
      onSave={() => {}}
      onDelete={() => {}}
      onClose={() => {}}
    />
  );
  const style = StyleSheet.flatten(r.getByTestId('plan-name-input').props.style);
  expect(style.lineHeight).toBeUndefined();
  // 高さを決めて、縦の余白ではなく中央寄せで文字を置く
  expect(style.height).toBeGreaterThan(0);
  expect(style.paddingVertical).toBe(0);
  expect(style.textAlignVertical).toBe('center');
});
