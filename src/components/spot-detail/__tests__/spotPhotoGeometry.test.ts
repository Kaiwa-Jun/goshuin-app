import { readFileSync } from 'fs';
import { join } from 'path';

import { PHOTO_NAME_HEIGHT, photoGeometry } from '@components/spot-detail/spotPhotoGeometry';

const band = { compact: 80, expanded: 208 };

const close3 = (value: number, expected: number) => expect(value).toBeCloseTo(expected, 3);

const expectGeometry = (
  actual: ReturnType<typeof photoGeometry>,
  expected: ReturnType<typeof photoGeometry>
) => {
  for (const key of ['left', 'width', 'height', 'compactY', 'expandedY'] as const) {
    close3(actual[key], expected[key]);
  }
};

describe('photoGeometry（帯の写真の置き方。Issue #302 / AC-11）', () => {
  it('名前の行の高さは 30', () => {
    expect(PHOTO_NAME_HEIGHT).toBe(30);
  });

  it('4:3 の写真は幅いっぱい。focusY の所を、名前の行を除いた帯の真ん中に置く', () => {
    expectGeometry(photoGeometry({ width: 1280, height: 960, focusY: 0.5 }, 390, band), {
      left: 0,
      width: 390,
      height: 292.5,
      compactY: -121.25,
      expandedY: -57.25,
    });
  });

  it('focusY が端なら、写真の端が帯の端に来る（帯の外へ出さない）', () => {
    const top = photoGeometry({ width: 1280, height: 960, focusY: 0 }, 390, band);
    close3(top.compactY, 0);
    close3(top.expandedY, 0);
    const bottom = photoGeometry({ width: 1280, height: 960, focusY: 1 }, 390, band);
    close3(bottom.compactY, -212.5);
    close3(bottom.expandedY, -84.5);
  });

  it('横長すぎて 208 に足りない写真は、高さ 208 まで拡大して左右を切る', () => {
    expectGeometry(photoGeometry({ width: 1280, height: 400, focusY: 0.5 }, 390, band), {
      left: -137.8,
      width: 665.6,
      height: 208,
      compactY: -79,
      expandedY: 0,
    });
  });

  it('幅の違う端末では幅に合わせる（W = 430）', () => {
    const g = photoGeometry({ width: 1280, height: 960, focusY: 0.5 }, 430, band);
    close3(g.left, 0);
    close3(g.width, 430);
    close3(g.height, 322.5);
    close3(g.compactY, -136.25);
  });

  it('どの入力でも、写真は半分・大きくの帯を埋め、上の端は帯の上の端より上', () => {
    const sizes = [
      [1280, 960],
      [1280, 720],
      [1280, 400],
      [6695, 3032],
      [4032, 3024],
      [1350, 900],
      [2048, 1536],
    ];
    for (const W of [320, 375, 390, 430, 750]) {
      for (const [width, height] of sizes) {
        for (const focusY of [0, 0.1, 0.25, 0.5, 0.75, 0.9, 1]) {
          const g = photoGeometry({ width, height, focusY }, W, band);
          expect(g.compactY).toBeLessThanOrEqual(0);
          expect(g.expandedY).toBeLessThanOrEqual(0);
          expect(g.compactY + g.height).toBeGreaterThanOrEqual(80 - 1e-9);
          expect(g.expandedY + g.height).toBeGreaterThanOrEqual(208 - 1e-9);
          expect(g.width).toBeGreaterThanOrEqual(W - 1e-9);
          close3(g.left, (W - g.width) / 2);
        }
      }
    }
  });

  it('import を持たない（選ぶ画面の geometry.js と同じ式の写し。Deno のテストが比べる）', () => {
    const source = readFileSync(join(__dirname, '..', 'spotPhotoGeometry.ts'), 'utf8');
    expect(source.split('\n').filter(line => line.startsWith('import'))).toEqual([]);
  });
});
