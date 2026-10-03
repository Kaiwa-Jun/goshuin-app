import React, { useState } from 'react';
import { Image, type ImageProps } from 'react-native';

type Props = Omit<ImageProps, 'source' | 'onError'> & {
  uri: string;
  /** 出せなかったときに1回だけ替える URL。R2 に無い写真の Supabase の原本（Issue #227） */
  fallbackUri?: string;
  /** 落とす先に替えたとき（1回だけ） */
  onFallback?: () => void;
  /** 落とす先も出せなかったとき。落とす先が無ければ最初の失敗で */
  onFinalError?: () => void;
  /**
   * 渡された URL（落とす前）が読めたとき。落とす先が読めたときは呼ばない。
   * 一時の失敗で落ちたあと、付け直しで読めたことを呼び出し側の控えに返すために使う
   */
  onPrimaryLoad?: () => void;
};

/**
 * 御朱印の写真を R2 の変換で出し、出せなければ元の写真に1回だけ落とす（Issue #227 S4a-2 D-7）。
 *
 * R2 に無い写真（旧バージョンのアプリが Supabase にだけ上げたもの・R2 の書き込みだけ
 * 失敗したもの）を出し続けるため。元も出せなければ取り直さず、呼び出し側の失敗の見た目に任せる
 */
export function FallbackImage({
  uri,
  fallbackUri,
  onFallback,
  onFinalError,
  onPrimaryLoad,
  onLoad,
  ...rest
}: Props) {
  /*
   * どの URL から落ちたかを控える。行が使い回されて URL が変わったら控えが合わなくなり、
   * 新しい URL から出し直す
   */
  const [fellBackFrom, setFellBackFrom] = useState<string | null>(null);
  const fellBack = fallbackUri !== undefined && fellBackFrom === uri;

  return (
    <Image
      {...rest}
      source={{ uri: fellBack ? fallbackUri : uri }}
      onLoad={e => {
        if (!fellBack) onPrimaryLoad?.();
        onLoad?.(e);
      }}
      onError={() => {
        if (fallbackUri !== undefined && !fellBack) {
          setFellBackFrom(uri);
          onFallback?.();
          return;
        }
        onFinalError?.();
      }}
    />
  );
}
