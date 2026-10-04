import React from 'react';
import { fireEvent, render, within } from '@testing-library/react-native';
import { Linking, Modal, StyleSheet, Text } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

import { SpotPhotoCredit } from '@components/spot-detail/SpotPhotoCredit';
import { colors } from '@theme/colors';
import { spacing } from '@theme/spacing';
import type { SpotPhoto } from '@/types/supabase';

const PHOTO: SpotPhoto = {
  uri: 'https://example.com/p.jpg',
  width: 1280,
  height: 960,
  focusY: 0.5,
  author: 'Bachstelze',
  license: 'CC BY-SA 3.0',
  licenseUrl: 'https://creativecommons.org/licenses/by-sa/3.0',
  sourceUrl: 'https://commons.wikimedia.org/wiki/File:A.jpg',
  isCropped: true,
};

const flatten = (node: { props: { style?: unknown } }) =>
  (StyleSheet.flatten(node.props.style) ?? {}) as Record<string, unknown>;

/** 吹き出しの中の文字（上から順に） */
const textsIn = (node: ReturnType<ReturnType<typeof render>['getByTestId']>) =>
  within(node)
    .UNSAFE_getAllByType(Text)
    .map(t => t.props.children);

function renderCredit(photo: SpotPhoto = PHOTO, reduceMotion = false) {
  return render(<SpotPhotoCredit photo={photo} reduceMotion={reduceMotion} />);
}

describe('SpotPhotoCredit（帯の写真の ⓘ と吹き出し。Issue #302）', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('ⓘ は帯の左下の小さな丸のボタン。吹き出しは閉じている（AC-30）', () => {
    const ui = renderCredit();
    const button = ui.getByTestId('spot-photo-credit');
    expect(button.props.accessibilityRole).toBe('button');
    expect(button.props.accessibilityLabel).toBe('写真の撮影者とライセンス');
    expect(button.props.hitSlop).toBe(12);
    expect(flatten(button)).toEqual(
      expect.objectContaining({
        position: 'absolute',
        top: 2,
        left: spacing.md,
        width: 22,
        height: 22,
        borderRadius: 11,
        backgroundColor: colors.spotHeroPhoto.credit,
      })
    );
    const icon = within(button).UNSAFE_getByType(MaterialIcons);
    expect(icon.props).toEqual(
      expect.objectContaining({ name: 'info-outline', size: 16, color: colors.white })
    );
    expect(ui.queryByTestId('spot-photo-credit-popover')).toBeNull();
  });

  it('押すと吹き出しに 撮影・ライセンス・元の写真・注記。リンクはブラウザで開き、外を押すと閉じる（AC-31）', () => {
    const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
    const ui = renderCredit();
    fireEvent.press(ui.getByTestId('spot-photo-credit'));

    const modal = ui.UNSAFE_getByType(Modal);
    expect(modal.props.visible).toBe(true);
    expect(modal.props.transparent).toBe(true);
    expect(modal.props.animationType).toBe('fade');
    expect(flatten(ui.getByTestId('spot-photo-credit')).backgroundColor).toBe(
      colors.spotHeroPhoto.creditOn
    );

    const popover = ui.getByTestId('spot-photo-credit-popover');
    expect(textsIn(popover)).toEqual([
      '撮影',
      'Bachstelze',
      'ライセンス',
      'CC BY-SA 3.0',
      '元の写真',
      'Wikimedia Commons',
      '帯に合わせてトリミングしています',
    ]);
    expect(flatten(popover)).toEqual(
      expect.objectContaining({
        position: 'absolute',
        left: 10,
        width: 292,
        backgroundColor: colors.white,
      })
    );

    fireEvent.press(ui.getByTestId('spot-photo-credit-license-link'));
    expect(open).toHaveBeenCalledTimes(1);
    expect(open).toHaveBeenLastCalledWith('https://creativecommons.org/licenses/by-sa/3.0');
    fireEvent.press(ui.getByTestId('spot-photo-credit-source-link'));
    expect(open).toHaveBeenCalledTimes(2);
    expect(open).toHaveBeenLastCalledWith('https://commons.wikimedia.org/wiki/File:A.jpg');

    fireEvent.press(ui.getByTestId('spot-photo-credit-backdrop'));
    expect(ui.queryByTestId('spot-photo-credit-popover')).toBeNull();
    expect(flatten(ui.getByTestId('spot-photo-credit')).backgroundColor).toBe(
      colors.spotHeroPhoto.credit
    );
  });

  it('位置を測れるまでは吹き出しを透明で描き、中身は押した描画で決まる', () => {
    const ui = renderCredit();
    fireEvent.press(ui.getByTestId('spot-photo-credit'));
    // Jest では measureInWindow が答えないので、測れていない形
    const popover = ui.getByTestId('spot-photo-credit-popover');
    expect(flatten(popover).opacity).toBe(0);
    expect(flatten(popover).bottom).toBeUndefined();
    expect(textsIn(popover)).toContain('Bachstelze');
  });

  it('撮影者が無い Public domain は「不明」で、ライセンスはリンクにしない。注記は切ったときだけ（AC-32）', () => {
    const ui = renderCredit({ ...PHOTO, author: null, license: 'Public domain', licenseUrl: null });
    fireEvent.press(ui.getByTestId('spot-photo-credit'));
    expect(textsIn(ui.getByTestId('spot-photo-credit-popover'))).toEqual([
      '撮影',
      '不明',
      'ライセンス',
      'Public domain',
      '元の写真',
      'Wikimedia Commons',
      '帯に合わせてトリミングしています',
    ]);
    expect(ui.queryByTestId('spot-photo-credit-license-link')).toBeNull();

    const uncropped = renderCredit({ ...PHOTO, isCropped: false });
    fireEvent.press(uncropped.getByTestId('spot-photo-credit'));
    expect(textsIn(uncropped.getByTestId('spot-photo-credit-popover'))).not.toContain(
      '帯に合わせてトリミングしています'
    );
  });

  it('視差効果を減らす がオンなら、吹き出しはふわっとせずに出る（AC-32）', () => {
    const ui = renderCredit(PHOTO, true);
    fireEvent.press(ui.getByTestId('spot-photo-credit'));
    expect(ui.UNSAFE_getByType(Modal).props.animationType).toBe('none');
  });
});
