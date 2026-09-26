import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Easing, type LayoutChangeEvent, type View } from 'react-native';
import type { GalleryViewMode } from '@hooks/useGalleryViewMode';
import {
  PREPARE_TIMEOUT_MS,
  TO_FLIP_MS,
  TO_GRID_MS,
  flipPageMotion,
  gatherDelayOf,
  paneOpacity,
  scatterDelays,
  stackRectOf,
  stackScaleOf,
  tileMotion,
  tiltDegOf,
  type FlipPageMotion,
  type Rect,
  type TileMotion,
  type ViewModeDirection,
} from '@components/gallery/viewModeMotion';

/**
 * 御朱印帳の表示の切り替わり（めくる ↔ 一覧）の動き（Issue #276 D-9〜D-11・D-19）。
 *
 * 押したら入ってくる側の面を見えないまま描き足し、描けたら位置を測り、切り替えのたびに作る
 * 時計を1回だけ回す。面の入れ替え・ページ・タイル・文字はすべてこの時計から補間で引く
 * （動いている間に JS から値を運ばない）。測れない・間に合わないときは動かさずに切り替える。
 *
 * JS のタイマーは準備の間だけ（setTimeout 1本と requestAnimationFrame 2回）。
 * 写真の読み込み中の時計（#275 の loadingClock）とは別
 */

/** 見えているタイル1枚の動き */
export interface TransitionTileMotion extends TileMotion {
  /** 束で裏を向いている（見ていた1枚でない）。裏の面を描く */
  faceDown: boolean;
}

export interface TransitionMotion {
  direction: ViewModeDirection;
  /** 面の不透明度 */
  paneOpacity: Record<GalleryViewMode, Animated.AnimatedInterpolation<number>>;
  /** めくる表示の出ているページの紙と周り */
  flip: FlipPageMotion;
  /** 見えているタイルだけ。見えていないタイルは置くだけ */
  tiles: ReadonlyMap<string, TransitionTileMotion>;
  /** 束のいちばん上の1枚 */
  stackTopStampId: string;
  /** 束のいちばん上の1枚を含む一覧の行。ほかの行より上に出す */
  stackTopRow: number;
}

export type ViewModeTransitionPhase =
  | { stage: 'preparing'; from: GalleryViewMode; to: GalleryViewMode }
  | {
      stage: 'running';
      from: GalleryViewMode;
      to: GalleryViewMode;
      clock: Animated.Value;
      motion: TransitionMotion;
    };

export interface ViewModeTransitionRequest {
  from: GalleryViewMode;
  to: GalleryViewMode;
  /** 見ていた1枚（白紙・見つからないなら最新の御朱印に直して渡す） */
  stampId: string;
}

interface Params {
  /** 一覧のタイルの一辺 */
  tileSize: number;
  /** 一覧の列の数 */
  columns: number;
  reduceMotion: boolean;
  /** 一覧を取り直している */
  isLoading: boolean;
  /** 御朱印の並び（一覧の並び順の id） */
  stampIds: readonly string[];
  /** 詳細が開いている・飛ぶ1枚がある */
  blocked: boolean;
}

interface Prepared {
  request: ViewModeTransitionRequest;
  ids: readonly string[];
  tileSize: number;
  columns: number;
}

type Size = { width: number; height: number };

const hasArea = (rect: Size) => rect.width > 0 && rect.height > 0;

const contains = (outer: Rect, inner: Rect) =>
  inner.x >= outer.x &&
  inner.y >= outer.y &&
  inner.x + inner.width <= outer.x + outer.width &&
  inner.y + inner.height <= outer.y + outer.height;

/** 縦に 1pt より多く重なる */
const overlapsVertically = (rect: Rect, viewport: Rect) =>
  Math.min(rect.y + rect.height, viewport.y + viewport.height) - Math.max(rect.y, viewport.y) > 1;

export function useViewModeTransition({
  tileSize,
  columns,
  reduceMotion,
  isLoading,
  stampIds,
  blocked,
}: Params) {
  const [phase, setPhase] = useState<ViewModeTransitionPhase | null>(null);
  /** 描く前でも今の段階が分かるように（ref の知らせは描いている途中で届く） */
  const phaseRef = useRef<ViewModeTransitionPhase | null>(null);
  const prepared = useRef<Prepared | null>(null);

  const contentSize = useRef<Size | null>(null);
  const panes = useRef<{ flip: View | null; viewport: View | null }>({
    flip: null,
    viewport: null,
  });
  const tileNodes = useRef(new Map<string, View>()).current;
  const surfaceNodes = useRef(new Map<string, View>()).current;
  const gridPositioned = useRef(false);
  const measureScheduled = useRef(false);

  const prepareTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const frame = useRef<number | null>(null);
  const animation = useRef<Animated.CompositeAnimation | null>(null);
  /** 取りやめ・終わりのあとに届いた測った値や終わりの知らせを捨てる */
  const generation = useRef(0);

  const clearTimers = useCallback(() => {
    if (prepareTimer.current) clearTimeout(prepareTimer.current);
    prepareTimer.current = null;
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = null;
  }, []);

  /** 終わりの形にする: 出ていく側を外し、動きの値を外し、ロックを外す */
  const settle = useCallback(() => {
    generation.current += 1;
    clearTimers();
    animation.current = null;
    prepared.current = null;
    phaseRef.current = null;
    gridPositioned.current = false;
    measureScheduled.current = false;
    setPhase(null);
  }, [clearTimers]);

  /** 取りやめ。時計を止めて、その場で終わりの形にする */
  const cancel = useCallback(() => {
    if (!phaseRef.current) return;
    const running = animation.current;
    animation.current = null;
    running?.stop();
    settle();
  }, [settle]);

  const compute = useCallback(
    (
      gen: number,
      measured: { flip: Rect; viewport: Rect; surface: Rect; tiles: Map<string, Rect> }
    ) => {
      const plan = prepared.current;
      if (gen !== generation.current || !plan) return;
      const { flip, viewport, surface } = measured;
      const { request, ids, tileSize: size } = plan;

      if (!hasArea(flip) || !hasArea(viewport) || !hasArea(surface)) {
        settle();
        return;
      }
      // 束: めくる面の横の真ん中・ページの紙の縦の真ん中に、タイルと同じ大きさ
      const center = { x: flip.x + flip.width / 2, y: surface.y + surface.height / 2 };
      // 飛び出す途中で一覧の枠に切られるなら動かさない
      if (!contains(viewport, stackRectOf(center, size))) {
        settle();
        return;
      }

      const currentIndex = ids.indexOf(request.stampId);
      const visible: { id: string; index: number; rect: Rect }[] = [];
      measured.tiles.forEach((rect, id) => {
        const index = ids.indexOf(id);
        if (index >= 0 && overlapsVertically(rect, viewport)) visible.push({ id, index, rect });
      });

      const clock = new Animated.Value(0);
      const direction: ViewModeDirection = request.to === 'grid' ? 'toGrid' : 'toFlip';
      const delays = scatterDelays(
        visible.map(tile => tile.index),
        currentIndex
      );
      const tiles = new Map<string, TransitionTileMotion>();
      for (const tile of visible) {
        const isStackTop = tile.index === currentIndex;
        const delay = delays.get(tile.index) ?? 0;
        const motion = tileMotion(clock, {
          direction,
          dx: center.x - (tile.rect.x + size / 2),
          dy: center.y - (tile.rect.y + size / 2),
          tiltDeg: isStackTop ? 0 : tiltDegOf(tile.index),
          faceDown: !isStackTop,
          delayMs: direction === 'toGrid' ? delay : gatherDelayOf(delay),
        });
        tiles.set(tile.id, { ...motion, faceDown: !isStackTop });
      }

      clearTimers();
      const next: ViewModeTransitionPhase = {
        stage: 'running',
        from: request.from,
        to: request.to,
        clock,
        motion: {
          direction,
          paneOpacity: {
            flip: paneOpacity(clock, direction, 'flip'),
            grid: paneOpacity(clock, direction, 'grid'),
          },
          flip: flipPageMotion(clock, direction, stackScaleOf(size, surface.width)),
          tiles,
          stackTopStampId: request.stampId,
          stackTopRow: Math.floor(currentIndex / plan.columns),
        },
      };
      phaseRef.current = next;
      setPhase(next);
    },
    [clearTimers, settle]
  );

  /** 束・一覧の見える範囲・ページの紙・描かれているすべてのタイルを画面座標で測る */
  const measure = useCallback(
    (gen: number) => {
      const plan = prepared.current;
      if (gen !== generation.current || !plan) return;
      const flipPane = panes.current.flip;
      const viewport = panes.current.viewport;
      const surface = surfaceNodes.get(plan.request.stampId);
      if (!flipPane || !viewport || !surface) {
        settle();
        return;
      }

      const tiles = [...tileNodes.entries()];
      const measured = {
        flip: { x: 0, y: 0, width: 0, height: 0 },
        viewport: { x: 0, y: 0, width: 0, height: 0 },
        surface: { x: 0, y: 0, width: 0, height: 0 },
        tiles: new Map<string, Rect>(),
      };
      let pending = 3 + tiles.length;
      const receive =
        (assign: (rect: Rect) => void) => (x: number, y: number, width: number, height: number) => {
          assign({ x, y, width, height });
          pending -= 1;
          if (pending === 0) compute(gen, measured);
        };

      flipPane.measureInWindow(receive(rect => (measured.flip = rect)));
      viewport.measureInWindow(receive(rect => (measured.viewport = rect)));
      surface.measureInWindow(receive(rect => (measured.surface = rect)));
      for (const [id, node] of tiles) {
        node.measureInWindow(receive(rect => measured.tiles.set(id, rect)));
      }
    },
    [compute, settle, surfaceNodes, tileNodes]
  );

  /**
   * 入ってくる側が描けたら、2フレーム待って測る。一覧は、開く位置へ送り終えて見ていた1枚の
   * タイルが描かれてから。めくる表示は、見ていたページの紙が描かれてから
   */
  const measureWhenReady = useCallback(() => {
    const plan = prepared.current;
    if (!plan || phaseRef.current?.stage !== 'preparing' || measureScheduled.current) return;
    const { to, stampId } = plan.request;
    const ready =
      to === 'grid' ? gridPositioned.current && tileNodes.has(stampId) : surfaceNodes.has(stampId);
    if (!ready) return;

    measureScheduled.current = true;
    const gen = generation.current;
    frame.current = requestAnimationFrame(() => {
      frame.current = requestAnimationFrame(() => {
        frame.current = null;
        measure(gen);
      });
    });
  }, [measure, surfaceNodes, tileNodes]);

  /**
   * ボタンで表示を切り替えた。動かせるなら準備に入って true を返す。動かせないなら
   * 何もせず false（呼んだ側はその場で切り替える）
   */
  const begin = (request: ViewModeTransitionRequest): boolean => {
    const size = contentSize.current;
    if (
      phaseRef.current ||
      reduceMotion ||
      isLoading ||
      blocked ||
      stampIds.length === 0 ||
      !stampIds.includes(request.stampId) ||
      !size ||
      !hasArea(size)
    ) {
      return false;
    }

    generation.current += 1;
    prepared.current = { request, ids: [...stampIds], tileSize, columns };
    gridPositioned.current = false;
    measureScheduled.current = false;
    const next: ViewModeTransitionPhase = {
      stage: 'preparing',
      from: request.from,
      to: request.to,
    };
    phaseRef.current = next;
    setPhase(next);
    // 間に合わなければ動かさずに切り替える
    prepareTimer.current = setTimeout(() => {
      prepareTimer.current = null;
      if (phaseRef.current?.stage === 'preparing') settle();
    }, PREPARE_TIMEOUT_MS);
    return true;
  };

  /*
   * 動きの値を描いたあとで、時計を1回だけ回す。止まらない動きは作らない（#99）
   */
  useEffect(() => {
    if (phase?.stage !== 'running' || animation.current) return;
    const total = phase.motion.direction === 'toGrid' ? TO_GRID_MS : TO_FLIP_MS;
    const gen = generation.current;
    const timing = Animated.timing(phase.clock, {
      toValue: total,
      duration: total,
      easing: Easing.linear,
      useNativeDriver: true,
    });
    animation.current = timing;
    timing.start(({ finished }) => {
      if (finished && gen === generation.current) settle();
    });
  }, [phase, settle]);

  // 取り直し・視差効果を減らす がオンになったら、その場で終わりの形にする
  useEffect(() => {
    if (isLoading || reduceMotion) cancel();
  }, [isLoading, reduceMotion, cancel]);

  // 御朱印の並びが変わったら（削除・並び替え）、測った位置が合わないので取りやめる
  const idsKey = stampIds.join('\n');
  useEffect(() => {
    const plan = prepared.current;
    if (plan && plan.ids.join('\n') !== idsKey) cancel();
  }, [idsKey, cancel]);

  useEffect(
    () => () => {
      generation.current += 1;
      const running = animation.current;
      animation.current = null;
      running?.stop();
      clearTimers();
    },
    [clearTimers]
  );

  return {
    phase,
    /** 準備中か動いている間 */
    active: phase !== null,
    /** ボタンを押しても何もしない間 */
    locked: phase !== null || blocked,
    begin,
    /** `gallery-content` の onLayout。レイアウトが決まる前には動かさない */
    onContentLayout: useCallback((event: LayoutChangeEvent) => {
      const { width, height } = event.nativeEvent.layout;
      contentSize.current = { width, height };
    }, []),
    /** 一覧を開く位置へ送り終えた（送らなくてよかったときも） */
    gridPositioned: useCallback(() => {
      gridPositioned.current = true;
      measureWhenReady();
    }, [measureWhenReady]),
    registerPane: useCallback((pane: 'flip' | 'viewport', node: View | null) => {
      panes.current[pane] = node;
    }, []),
    /** 一覧のタイルの動き用の包み（`gallery-tile-motion-{id}`） */
    registerTile: useCallback(
      (stampId: string, node: View | null) => {
        if (node) tileNodes.set(stampId, node);
        else tileNodes.delete(stampId);
        if (node && prepared.current?.request.stampId === stampId) measureWhenReady();
      },
      [measureWhenReady, tileNodes]
    ),
    /** めくる表示のページの紙（`flip-page-surface-{id}`） */
    registerPageSurface: useCallback(
      (stampId: string, node: View | null) => {
        if (node) surfaceNodes.set(stampId, node);
        else surfaceNodes.delete(stampId);
        if (node && prepared.current?.request.stampId === stampId) measureWhenReady();
      },
      [measureWhenReady, surfaceNodes]
    ),
  };
}
