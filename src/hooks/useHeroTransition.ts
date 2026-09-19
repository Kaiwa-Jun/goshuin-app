import { useCallback, useRef, useState } from 'react';
import { Image, View } from 'react-native';
import type { Rect } from '@utils/heroTransition';

/** タイルのどの部分か。画像と文字は別々に飛ぶ */
type TilePart = 'image' | 'text';

export interface HeroFlightState {
  stampId: string;
  index: number;
  direction: 'in' | 'out';
  sourceRect: Rect;
  sourceTextRect: Rect | null;
  imageUrl: string;
  /** 写真の 横 ÷ 縦。取れていなければ null */
  imageAspect: number | null;
  spotName: string;
  visitedAt: string;
}

/**
 * 測り終わるのを待つ上限。measureInWindow は返ってこないことがある
 * （行が使い回された直後、テスト環境など）。待ち続けると詳細が開かない
 */
const MEASURE_TIMEOUT_MS = 120;

interface StartParams {
  stampId: string;
  index: number;
  direction: 'in' | 'out';
  imageUrl: string;
  spotName: string;
  visitedAt: string;
}

/**
 * 一覧のタイルの位置を覚えておいて、そこから詳細へ飛ばす（Issue #192）。
 *
 * 位置は毎回 `measureInWindow` で測る。左列・右列・スクロール位置のどれにも
 * 依存しないのは、固定値を持たずここで測っているため。
 *
 * 測れなかったときは飛ばさない。演出のために詳細が開かないのが一番まずい
 */
export function useHeroTransition() {
  const tiles = useRef(new Map<string, Partial<Record<TilePart, View | null>>>()).current;
  const aspects = useRef(new Map<string, number>()).current;
  const [flight, setFlight] = useState<HeroFlightState | null>(null);

  const registerTile = useCallback(
    (stampId: string, part: TilePart, node: View | null) => {
      const entry = tiles.get(stampId) ?? {};
      entry[part] = node;
      if (node) tiles.set(stampId, entry);
      // FlatList は行を使い回す。外れた分を持ち続けると、消えた御朱印の
      // 位置へ飛ぼうとする
      else if (!entry.image && !entry.text) tiles.delete(stampId);
    },
    [tiles]
  );

  /**
   * 写真の縦横比を先に取っておく。押してから測ると、目的地が決まる前に
   * 飛び始めてしまう。onPressIn で呼べば指が離れるまでの分だけ先行できる
   */
  const prefetchAspect = useCallback(
    (stampId: string, imageUrl: string) => {
      if (aspects.has(stampId)) return;
      Image.getSize(
        imageUrl,
        (w, h) => {
          if (h > 0) aspects.set(stampId, w / h);
        },
        () => {}
      );
    },
    [aspects]
  );

  /** 飛べるなら飛ばして true。測れなければ false を返すので、呼ぶ側は素直に開く */
  const start = useCallback(
    (params: StartParams, onReady: (started: boolean) => void) => {
      const entry = tiles.get(params.stampId);
      if (!entry?.image) {
        onReady(false);
        return;
      }

      let settled = false;
      const timer = setTimeout(() => {
        settled = true;
        onReady(false);
      }, MEASURE_TIMEOUT_MS);

      const settle = (state: HeroFlightState | null) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        if (state) setFlight(state);
        onReady(state !== null);
      };

      entry.image.measureInWindow((x, y, width, height) => {
        if (width <= 0 || height <= 0) {
          settle(null);
          return;
        }
        const sourceRect: Rect = { x, y, width, height };

        const finish = (sourceTextRect: Rect | null) =>
          settle({
            ...params,
            sourceRect,
            sourceTextRect,
            imageAspect: aspects.get(params.stampId) ?? null,
          });

        if (!entry.text) {
          finish(null);
          return;
        }
        entry.text.measureInWindow((tx, ty, tw, th) => {
          finish(th > 0 ? { x: tx, y: ty, width: tw, height: th } : null);
        });
      });
    },
    [tiles, aspects]
  );

  const end = useCallback(() => setFlight(null), []);

  return { flight, registerTile, prefetchAspect, start, end };
}
