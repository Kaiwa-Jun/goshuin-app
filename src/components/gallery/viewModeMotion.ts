/**
 * 御朱印帳の表示の切り替え（めくる ↔ 一覧）の動きの値（Issue #276）。
 *
 * 値の正は試作。ボタンは docs/design/mockups/2026-09-viewmode-toggle-v1.html の A
 * （`spring`・`openBook()`・`popGrid()`・`anim()`）。
 */

/**
 * 裏返した角度。**ちょうど 180 にしない**。iOS はちょうど 180° のとき、裏の面
 * （最後に 180deg 足して表を向く面）も向こう向きとみなして描かない（#275 S6）
 */
export const FACE_DOWN_DEG = 179.9;

/* ── ボタン（toggle-v1 の A） ── */

/** 白い台がすべって移る（`anim(520, …, spring)`） */
export const THUMB_SLIDE_MS = 520;
/** 本の左のページが開く（`openBook`） */
export const BOOK_OPEN_MS = 600;
/** タイルが1枚飛び出す（`popGrid`） */
export const TILE_POP_MS = 260;
/** タイルが飛び出す間隔（`popGrid` の `i·70`） */
export const TILE_POP_STAGGER_MS = 70;
/** 白い台の動く幅（`to = 44`）。押す所の幅と同じ */
export const THUMB_TRAVEL = 44;

/** 白い台のばね。少し行き過ぎて戻る（toggle-v1 の `spring`）。いちばん行き過ぎるところで 1.145 */
export const thumbSpring = (t: number): number =>
  t >= 1 ? 1 : 1 - Math.exp(-6.5 * t) * Math.cos(9.5 * t);

/** タイルが飛び出す曲線（`popGrid`）。0 で 0.1 から出て、いちばん大きいところで 1.108 */
export const tilePop = (t: number): number => 1 - (1 - t) ** 2 * Math.cos(4 * t) * 0.9;

/** 終わりに向けてゆるむ（試作の `ease`） */
export const easeOutCubic = (t: number): number => 1 - (1 - t) ** 3;
