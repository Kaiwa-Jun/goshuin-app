import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { FallbackImage } from '@components/common/FallbackImage';

/*
 * 変換 → 元の写真 → 今の失敗の見た目、の順に1回だけ落とす（Issue #227 S4a-2 D-7）。
 * R2 に無い写真（旧バージョンのアプリが Supabase にだけ上げたもの）を出し続けるため
 */
describe('FallbackImage', () => {
  const R2 = 'https://img.example/cdn-cgi/image/width=1200/u/a.jpg';
  const ORIGINAL = 'https://supabase.example/u/a.jpg';

  it('最初は渡された URL を出す', () => {
    const { getByTestId } = render(<FallbackImage testID="img" uri={R2} fallbackUri={ORIGINAL} />);

    expect(getByTestId('img').props.source).toEqual({ uri: R2 });
  });

  it('出せなければ元の写真に替え、そのことを1回だけ知らせる', () => {
    const onFallback = jest.fn();
    const onFinalError = jest.fn();
    const { getByTestId } = render(
      <FallbackImage
        testID="img"
        uri={R2}
        fallbackUri={ORIGINAL}
        onFallback={onFallback}
        onFinalError={onFinalError}
      />
    );

    fireEvent(getByTestId('img'), 'error');

    expect(getByTestId('img').props.source).toEqual({ uri: ORIGINAL });
    expect(onFallback).toHaveBeenCalledTimes(1);
    expect(onFinalError).not.toHaveBeenCalled();
  });

  it('元も出せなければ諦めを知らせ、取り直さない', () => {
    const onFallback = jest.fn();
    const onFinalError = jest.fn();
    const { getByTestId } = render(
      <FallbackImage
        testID="img"
        uri={R2}
        fallbackUri={ORIGINAL}
        onFallback={onFallback}
        onFinalError={onFinalError}
      />
    );

    fireEvent(getByTestId('img'), 'error');
    fireEvent(getByTestId('img'), 'error');

    expect(getByTestId('img').props.source).toEqual({ uri: ORIGINAL });
    expect(onFallback).toHaveBeenCalledTimes(1);
    expect(onFinalError).toHaveBeenCalledTimes(1);
  });

  it('落とす先が無ければ、最初の失敗で諦めを知らせる', () => {
    const onFinalError = jest.fn();
    const { getByTestId } = render(
      <FallbackImage testID="img" uri={R2} onFinalError={onFinalError} />
    );

    fireEvent(getByTestId('img'), 'error');

    expect(getByTestId('img').props.source).toEqual({ uri: R2 });
    expect(onFinalError).toHaveBeenCalledTimes(1);
  });

  // 一覧の行が使い回されて別の写真になったとき、前の写真の「落ちた」を持ち越さない
  it('URL が変わったら、新しい URL から出し直す', () => {
    const { getByTestId, rerender } = render(
      <FallbackImage testID="img" uri={R2} fallbackUri={ORIGINAL} />
    );
    fireEvent(getByTestId('img'), 'error');

    const R2_B = 'https://img.example/cdn-cgi/image/width=1200/u/b.jpg';
    rerender(
      <FallbackImage testID="img" uri={R2_B} fallbackUri="https://supabase.example/u/b.jpg" />
    );

    expect(getByTestId('img').props.source).toEqual({ uri: R2_B });
  });

  it('読み込めた知らせと見た目の指定はそのまま渡す', () => {
    const onLoad = jest.fn();
    const { getByTestId } = render(
      <FallbackImage testID="img" uri={R2} resizeMode="contain" onLoad={onLoad} />
    );

    fireEvent(getByTestId('img'), 'load', { nativeEvent: { source: { width: 1, height: 2 } } });

    expect(onLoad).toHaveBeenCalledTimes(1);
    expect(getByTestId('img').props.resizeMode).toBe('contain');
  });
});
