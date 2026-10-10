// Deno テスト（site/static の素材の有無でページの作り方を決める。契約書 D-12・D-18）
import { assert, assertEquals } from 'jsr:@std/assert@1';

import { BADGE_FILE, detectAssets, SCREEN_FILES, svgSize } from './assets.ts';
import { errorOf } from './fixtures/load.ts';

Deno.test('svgSize は viewBox を先に、無ければ width・height を読む', () => {
  assertEquals(svgSize('<svg xmlns="x" viewBox="0 0 119.66 40" width="10">'), {
    width: 119.66,
    height: 40,
  });
  assertEquals(svgSize("<svg width='135px' height='40px'>"), { width: 135, height: 40 });
  assertEquals(svgSize('<svg>'), null);
});

Deno.test(
  'スクショは 8 枚そろえば出す・0 枚なら出さない・1〜7 枚なら足りない名前を出して止まる',
  () => {
    assertEquals(SCREEN_FILES.length, 8);
    assertEquals(SCREEN_FILES[0], 'img/screens/01-360.webp');
    assertEquals(SCREEN_FILES[7], 'img/screens/04-720.webp');
    const all = detectAssets([...SCREEN_FILES, BADGE_FILE], '<svg viewBox="0 0 135 40">');
    assertEquals(all.assets, { screens: true, badge: { width: 135, height: 40 } });
    const none = detectAssets([], null);
    assertEquals(none.assets, { screens: false, badge: null });
    assert(none.notices.some(n => n.includes('スクショ')));
    assert(none.notices.some(n => n.includes(BADGE_FILE)));
    const e = errorOf(() => detectAssets(SCREEN_FILES.slice(0, 7), null));
    assert(e.includes('site/static/img/screens/04-720.webp'), e);
  }
);
