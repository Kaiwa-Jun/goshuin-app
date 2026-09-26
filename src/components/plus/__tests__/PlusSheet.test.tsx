import React from 'react';
import { render } from '@testing-library/react-native';
import '@testing-library/react-native/extend-expect';

import { PlusSheet } from '@components/plus/PlusSheet';
import type { usePlus } from '@hooks/usePlus';
import type { VisitPlan } from '@/types/visitPlan';

/* 契約書: docs/issues/issue-270-plus-purchase.md（S6 のシミュレータで見つけた見た目の件） */

// 本物の Modal は閉じると中身を描かないので、閉じる動きの間に見える中身を確かめられない。
// ここでは開閉にかかわらず中身を描き、開いているかどうかだけ testID で分かるようにする
jest.mock('@components/common/Modal', () => {
  const { View: MockView } = jest.requireActual<typeof import('react-native')>('react-native');
  return {
    Modal: ({ visible, children }: { visible: boolean; children: React.ReactNode }) => (
      <MockView testID={visible ? 'sheet-open' : 'sheet-closed'}>{children}</MockView>
    ),
  };
});

type Plus = ReturnType<typeof usePlus>;
const plusOf = (over: Partial<Plus> = {}): Plus => ({
  isPlus: false,
  status: 'ready',
  priceString: '¥980',
  canRestore: true,
  busy: false,
  purchase: jest.fn(),
  restore: jest.fn(),
  ...over,
});
const NEXT: VisitPlan = { id: 'p1003', plannedOn: '2026-10-03', name: '東山めぐり', stops: [] };

const sheet = (targetDate: string | null, plus: Plus) => (
  <PlusSheet
    targetDate={targetDate}
    nextPlan={NEXT}
    plus={plus}
    onClose={jest.fn()}
    onPurchased={jest.fn()}
    onRestored={jest.fn()}
    onTerms={jest.fn()}
    onPrivacy={jest.fn()}
  />
);

it('買っている最中に isPlus が先に true になっても、閉じるまで「購入済み」に変えない', () => {
  const ui = render(sheet('2026-10-10', plusOf()));
  // CustomerInfo の更新は purchasePackage が返る前に来る
  ui.rerender(sheet('2026-10-10', plusOf({ busy: true, isPlus: true })));
  expect(ui.getByTestId('plus-buy')).toHaveTextContent('¥980でプラスにする');
  // 買えたらシートを閉じる（閉じる動きの間も中身は買う前のまま）
  ui.rerender(sheet(null, plusOf({ isPlus: true })));
  expect(ui.getByTestId('sheet-closed')).toBeTruthy();
  expect(ui.getByTestId('plus-buy')).toHaveTextContent('¥980でプラスにする');
  expect(ui.getByText('購入を復元')).toBeTruthy();
});

it('閉じる動きの間も、押そうとした日の枠を出したまま', () => {
  const ui = render(sheet('2026-10-10', plusOf()));
  ui.rerender(sheet(null, plusOf()));
  expect(ui.getByTestId('sheet-closed')).toBeTruthy();
  expect(ui.getByTestId('plus-sheet-target')).toHaveTextContent('10月10日（土）', { exact: false });
});

it('開いている間に買う以外で plus と分かったら（読み込みが遅れたとき）「購入済み」にする', () => {
  const ui = render(sheet('2026-10-10', plusOf({ status: 'loading', priceString: null })));
  ui.rerender(sheet('2026-10-10', plusOf({ isPlus: true })));
  expect(ui.getByTestId('plus-buy')).toHaveTextContent('購入済み');
});

it('次に開いたときは、その日で出す', () => {
  const ui = render(sheet('2026-10-10', plusOf()));
  ui.rerender(sheet(null, plusOf()));
  ui.rerender(sheet('2026-10-17', plusOf()));
  expect(ui.getByTestId('plus-sheet-target')).toHaveTextContent('10月17日（土）', { exact: false });
});
