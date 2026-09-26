import {
  BOOK_OPEN_MS,
  FACE_DOWN_DEG,
  THUMB_SLIDE_MS,
  THUMB_TRAVEL,
  TILE_POP_MS,
  TILE_POP_STAGGER_MS,
  easeOutCubic,
  thumbSpring,
  tilePop,
} from '@components/gallery/viewModeMotion';

describe('viewModeMotion — ボタンの曲線（AC-11）', () => {
  it('thumbSpring は少し行き過ぎて戻り、1 で止まる', () => {
    expect(thumbSpring(0)).toBeCloseTo(0, 6);
    expect(thumbSpring(0.25)).toBeCloseTo(1.141831, 6);
    expect(thumbSpring(0.5)).toBeCloseTo(0.998542, 6);
    expect(thumbSpring(1)).toBe(1);
  });

  it('tilePop は 0.1 から出て、少し大きくなってから 1 で止まる', () => {
    expect(tilePop(0)).toBeCloseTo(0.1, 6);
    expect(tilePop(0.5)).toBeCloseTo(1.093633, 6);
    expect(tilePop(1)).toBeCloseTo(1, 6);
  });

  it('easeOutCubic(0.5) は 0.875', () => {
    expect(easeOutCubic(0.5)).toBeCloseTo(0.875, 6);
  });

  it('ボタンの定数が試作 toggle-v1 の A の値', () => {
    expect(THUMB_SLIDE_MS).toBe(520);
    expect(BOOK_OPEN_MS).toBe(600);
    expect(TILE_POP_MS).toBe(260);
    expect(TILE_POP_STAGGER_MS).toBe(70);
    expect(THUMB_TRAVEL).toBe(44);
    // 本が閉じた角度。ちょうど 180° だと iOS は裏も描かない（#275 S6）
    expect(FACE_DOWN_DEG).toBe(179.9);
  });
});
