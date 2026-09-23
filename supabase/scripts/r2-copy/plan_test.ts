// 実行: deno test supabase/scripts/r2-copy/
// Supabase → R2 のコピー対象を決める（Issue #227 S3 / AC-6・AC-7）
import { assertEquals } from 'jsr:@std/assert@1';

import { planCopy } from './plan.ts';

const U = '11111111-2222-3333-4444-555555555555';

Deno.test('R2 に無い原本だけをコピー対象にする', () => {
  const plan = planCopy([`${U}/1-a.jpg`, `${U}/2-b.jpg`], new Set([`${U}/1-a.jpg`]));
  assertEquals(plan, { copy: [`${U}/2-b.jpg`], present: 1, invalid: [] });
});

Deno.test('縮小版や形の違うパスはコピーしない（R2 には原本だけ置く）', () => {
  const plan = planCopy(
    [`${U}/thumb-400/1-a.jpg`, `${U}/view-1200/1-a.jpg`, `${U}/1-a.png`, 'no-folder.jpg', ''],
    new Set()
  );
  assertEquals(plan.copy, []);
  assertEquals(plan.invalid.length, 5);
});

Deno.test('同じパスが重複していても1回だけコピーする', () => {
  const plan = planCopy([`${U}/1-a.jpg`, `${U}/1-a.jpg`, ` ${U}/1-a.jpg `], new Set());
  assertEquals(plan.copy, [`${U}/1-a.jpg`]);
});

Deno.test('2回目（全部 R2 にある）はコピー 0 件', () => {
  const paths = [`${U}/1-a.jpg`, `${U}/2-b.jpg`];
  assertEquals(planCopy(paths, new Set(paths)).copy, []);
});
