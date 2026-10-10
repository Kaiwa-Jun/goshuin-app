// Deno テスト（外へのリンクと写真の URL。契約書 docs/issues/issue-324-homepage.md AC-8・AC-11・AC-12）
import { assertEquals } from 'jsr:@std/assert@1';

import { appStoreUrl, googleMapsUrl, osmUrl, photoHeight, photoUrl } from './links.ts';

Deno.test('AC-12: appStoreUrl は pt があればキャンペーンリンク、null なら素のリンク', () => {
  assertEquals(appStoreUrl(null), 'https://apps.apple.com/jp/app/id6797201465');
  assertEquals(
    appStoreUrl('123456'),
    'https://apps.apple.com/app/apple-store/id6797201465?pt=123456&ct=web&mt=8'
  );
});

Deno.test('AC-8: 写真の URL は帯と同じ変換・高さは 1200 × 高さ / 幅 の四捨五入', () => {
  assertEquals(
    photoUrl('spot-photos/abc.jpg'),
    'https://img.goshuinsanpo.com/cdn-cgi/image/width=1200,quality=78,format=webp/spot-photos/abc.jpg'
  );
  assertEquals(photoHeight(4496, 3000), 801);
  assertEquals(photoHeight(1280, 960), 900);
  assertEquals(photoHeight(3, 2), 800);
});

Deno.test('AC-11: Google マップは名前と住所、OSM は座標の文字のまま', () => {
  assertEquals(
    googleMapsUrl('平等院', '京都府宇治市宇治蓮華116'),
    'https://www.google.com/maps/search/?api=1&query=%E5%B9%B3%E7%AD%89%E9%99%A2%20%E4%BA%AC%E9%83%BD%E5%BA%9C%E5%AE%87%E6%B2%BB%E5%B8%82%E5%AE%87%E6%B2%BB%E8%93%AE%E8%8F%AF116'
  );
  assertEquals(
    osmUrl('43.0760', '141.3541'),
    'https://www.openstreetmap.org/?mlat=43.0760&mlon=141.3541#map=17/43.0760/141.3541'
  );
});
