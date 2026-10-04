// Deno テスト（選ぶ画面の写真の置き方が、アプリの置き方と同じか）
// 実行: deno test -A --node-modules-dir=none supabase/scripts/spot-photos/
// 契約書: docs/issues/issue-302-spot-photo-band.md（S3 / AC-12）
import { assert, assertEquals } from 'jsr:@std/assert@1';

import { photoGeometry as appGeometry } from '../../../src/components/spot-detail/spotPhotoGeometry.ts';
import { PHOTO_NAME_HEIGHT, photoGeometry as reviewGeometry } from './review/geometry.js';

const BAND = { compact: 80, expanded: 208 };
const KEYS = ['left', 'width', 'height', 'compactY', 'expandedY'] as const;

Deno.test(
  'AC-12: 選ぶ画面の geometry.js とアプリの spotPhotoGeometry.ts が、全部の組で同じ値',
  () => {
    assertEquals(PHOTO_NAME_HEIGHT, 30);
    let n = 0;
    for (const W of [375, 390, 430]) {
      for (const [width, height] of [
        [1280, 960],
        [1280, 720],
        [1280, 400],
        [6695, 3032],
        [4032, 3024],
      ]) {
        for (const focusY of [0, 0.25, 0.5, 0.75, 1]) {
          const a = appGeometry({ width, height, focusY }, W, BAND);
          const r = reviewGeometry({ width, height, focusY }, W, BAND);
          for (const k of KEYS) {
            assert(
              Math.abs(a[k] - r[k]) < 1e-9,
              `W=${W} ${width}×${height} focusY=${focusY} の ${k}: ${a[k]} と ${r[k]}`
            );
          }
          n++;
        }
      }
    }
    assertEquals(n, 75);
  }
);
