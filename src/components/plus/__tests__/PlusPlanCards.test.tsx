import React from 'react';
import { StyleSheet } from 'react-native';
import { act, render, within } from '@testing-library/react-native';
import '@testing-library/react-native/extend-expect';

import { PlusPlanCards } from '@components/plus/PlusPlanCards';
import { colors } from '@theme/colors';
import { borderRadius } from '@theme/spacing';

/* 契約書: docs/issues/issue-272-plus-restore-link.md（S1 / AC-1・2・UI-1） */

const renderCards = async (isPlus: boolean) => {
  const ui = render(<PlusPlanCards priceString="¥980" isPlus={isPlus} />);
  // 視差効果を減らすの読み込み（useReduceMotion）を終わらせる
  await act(async () => {});
  return ui;
};

it('AC-1: 無料のときは、無料のカードに「いまのプラン」、プラスのカードに「おすすめ」', async () => {
  const ui = await renderCards(false);
  const free = within(ui.getByTestId('plus-card-free'));
  const plus = within(ui.getByTestId('plus-card-plus'));
  expect(free.getByTestId('plus-card-tag-now')).toHaveTextContent('いまのプラン');
  expect(plus.getByTestId('plus-card-tag')).toHaveTextContent('おすすめ');
  expect(plus.queryByTestId('plus-card-tag-now')).toBeNull();
  expect(ui.getAllByText('いまのプラン')).toHaveLength(1);
});

it('AC-2: プラスのときは、札がプラスのカードへ移り「おすすめ」は出さない', async () => {
  const ui = await renderCards(true);
  const free = within(ui.getByTestId('plus-card-free'));
  const plus = within(ui.getByTestId('plus-card-plus'));
  expect(plus.getByTestId('plus-card-tag-now')).toHaveTextContent('いまのプラン');
  expect(free.queryByTestId('plus-card-tag-now')).toBeNull();
  expect(ui.queryByTestId('plus-card-tag')).toBeNull();
  expect(ui.queryByText('おすすめ')).toBeNull();
  expect(ui.getAllByText('いまのプラン')).toHaveLength(1);
});

it('UI-1: 「いまのプラン」は白地に teal の枠と字。位置と外寸は「おすすめ」と同じ', async () => {
  const ui = await renderCards(false);
  const now = StyleSheet.flatten(ui.getByTestId('plus-card-tag-now').props.style);
  const rec = StyleSheet.flatten(ui.getByTestId('plus-card-tag').props.style);
  expect(now).toMatchObject({
    position: 'absolute',
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.pin.wishlisted,
    borderRadius: borderRadius.full,
  });
  expect(now.top).toBe(rec.top);
  expect(now.left).toBe(rec.left);
  // 枠の 1px ぶん内側を減らし、外寸を揃える
  expect(now.paddingVertical).toBe(Number(rec.paddingVertical) - 1);
  expect(now.paddingHorizontal).toBe(Number(rec.paddingHorizontal) - 1);

  const nowText = StyleSheet.flatten(ui.getByText('いまのプラン').props.style);
  const recText = StyleSheet.flatten(ui.getByText('おすすめ').props.style);
  expect(nowText.color).toBe(colors.pin.wishlisted);
  expect(nowText.fontSize).toBe(recText.fontSize);
  expect(nowText.fontWeight).toBe(recText.fontWeight);
  // 「おすすめ」の見た目は変えない
  expect(rec.backgroundColor).toBe(colors.primary[500]);
  expect(recText.color).toBe(colors.white);

  const plusUi = await renderCards(true);
  const nowPlus = StyleSheet.flatten(plusUi.getByTestId('plus-card-tag-now').props.style);
  expect(nowPlus).toMatchObject({
    backgroundColor: colors.white,
    borderColor: colors.pin.wishlisted,
  });
});
