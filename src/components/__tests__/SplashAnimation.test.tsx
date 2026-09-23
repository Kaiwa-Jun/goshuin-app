import React from 'react';
import { render } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { ToriiIcon } from '@components/animated/ToriiIcon';
import { SplashAnimation } from '@components/animated/SplashAnimation';
import { colors } from '@theme/colors';
// 名前が1箇所からしか出てこないことを見るため、設定そのものを読む
import appJson from '../../../app.json';

describe('ToriiIcon', () => {
  it('renders', () => {
    const { getByTestId } = render(<ToriiIcon />);
    expect(getByTestId('torii-icon')).toBeTruthy();
  });

  it('renders with custom size', () => {
    const { getByTestId } = render(<ToriiIcon size={120} />);
    expect(getByTestId('torii-icon')).toBeTruthy();
  });
});

describe('SplashAnimation', () => {
  it('renders', () => {
    const { getByTestId } = render(<SplashAnimation onAnimationComplete={() => {}} />);
    expect(getByTestId('splash-animation')).toBeTruthy();
  });

  /*
   * ⚠️ ここは実際に出荷されていた不具合の跡。
   *
   * ネイティブの起動画面（assets/splash.png）を彫った印に変えたのに、
   * この JS の起動画面がオレンジ地に鳥居の絵文字のまま上から覆っていて、
   * **焼いたアイコンが一度も見えていなかった**。シミュレータで起動して
   * 初めて気づいた。
   */
  it('アイコンと同じ印を出す。鳥居ではない', () => {
    const { getByTestId, queryByTestId } = render(
      <SplashAnimation onAnimationComplete={() => {}} />
    );
    expect(getByTestId('splash-mark')).toBeTruthy();
    expect(queryByTestId('torii-icon')).toBeNull();
  });

  /*
   * ⚠️ 起動画面だけ「御朱印めぐり」になっていた。
   * app.json も store-metadata.md も ASC も「御朱印さんぽ」
   */
  it('app.json と同じ名前を出す', () => {
    const { getByText, queryByText } = render(<SplashAnimation onAnimationComplete={() => {}} />);
    expect(getByText(appJson.expo.name)).toBeTruthy();
    expect(getByText('御朱印さんぽ')).toBeTruthy();
    expect(queryByText('御朱印めぐり')).toBeNull();
  });

  // 地は和紙の色。ネイティブの起動画面と同じ色にして継ぎ目を消す
  it('地は和紙の色。オレンジのグラデーションではない', () => {
    const { getByTestId, queryByTestId } = render(
      <SplashAnimation onAnimationComplete={() => {}} />
    );
    const ground = StyleSheet.flatten(getByTestId('splash-ground').props.style);
    expect(ground.backgroundColor).toBe(colors.splash);
    expect(queryByTestId('splash-gradient')).toBeNull();
  });

  /*
   * ⚠️ 初回起動で「オンボーディング1枚目 → 印 → オンボーディング」とちらついた（1.2.0 の実機）。
   * この起動画面は RootNavigator の上に重なっている。地が透明から始まってフェードインすると、
   * ネイティブの起動画面が消えた直後の数フレーム、下のオンボーディングが透けて見える。
   * 地は最初のフレームから不透明にし、色もネイティブの起動画面（app.json）と揃える
   */
  it('最初のフレームから地が不透明で、下の画面が透けない', () => {
    const { getByTestId } = render(<SplashAnimation onAnimationComplete={() => {}} />);
    const ground = StyleSheet.flatten(getByTestId('splash-ground').props.style);
    expect(ground.opacity ?? 1).toBe(1);
  });

  it('地の色はネイティブの起動画面と同じ', () => {
    const { getByTestId } = render(<SplashAnimation onAnimationComplete={() => {}} />);
    const ground = StyleSheet.flatten(getByTestId('splash-ground').props.style);
    expect(String(ground.backgroundColor).toUpperCase()).toBe(
      appJson.expo.splash.backgroundColor.toUpperCase()
    );
  });
});
