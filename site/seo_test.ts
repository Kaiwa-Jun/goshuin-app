// Deno テスト（検索と AI: title・canonical・description・OGP・sitemap・robots・llms.txt・JSON-LD。
// 契約書 docs/issues/issue-324-homepage.md AC-30〜35）
import { assert, assertEquals } from 'jsr:@std/assert@1';

import { forbiddenWordsIn } from './build.ts';
import { realData, realSite } from './fixtures/load.ts';
import { PREFECTURES } from './prefectures.ts';
import { inner, jsonLdBlocks, metaContents, tags, text } from './scan.ts';

const LEGAL_PATHS = ['legal/privacy.html', 'legal/terms.html'];
const ORIGIN = 'https://goshuinsanpo.com';

function urlOf(path: string): string {
  if (path === 'index.html') return `${ORIGIN}/`;
  if (path.endsWith('/index.html')) return `${ORIGIN}/${path.slice(0, -'index.html'.length)}`;
  return `${ORIGIN}/${path}`;
}

function ld(html: string): Record<string, unknown>[] {
  return jsonLdBlocks(html).map(b => JSON.parse(b));
}

Deno.test(
  'AC-30: 404 を除く全 HTML に title・canonical・description が1つずつ（重ならない）と OGP',
  async () => {
    const d = await realData();
    const files = await realSite();
    const titles = new Set<string>();
    const descs = new Set<string>();
    let n = 0;
    for (const [p, html] of files) {
      if (!p.endsWith('.html') || p === '404.html') continue;
      n++;
      const ts = [...html.matchAll(/<title>([\s\S]*?)<\/title>/g)];
      assertEquals(ts.length, 1, p);
      const t = text(ts[0][1]);
      assert(t.length > 0 && !titles.has(t), `${p}: ${t}`);
      titles.add(t);
      const canon = tags(html, 'link').filter(x => x.attrs.rel === 'canonical');
      assertEquals(
        canon.map(c => c.attrs.href),
        [urlOf(p)],
        p
      );
      const ds = metaContents(html, 'description');
      assertEquals(ds.length, 1, p);
      assert(ds[0].length >= 1 && ds[0].length <= 120, `${p}: ${ds[0].length}`);
      assert(!descs.has(ds[0]), p);
      descs.add(ds[0]);
      if (LEGAL_PATHS.includes(p)) continue;
      assert(html.includes('<html lang="ja">'), p);
      assertEquals(metaContents(html, 'viewport').length, 1, p);
      const og = (k: string) => metaContents(html, k);
      assertEquals(og('og:title'), [t], p);
      assertEquals(og('og:description'), [ds[0]], p);
      assertEquals(og('og:url'), [urlOf(p)], p);
      assertEquals(og('og:type'), ['website'], p);
      assertEquals(og('og:site_name'), ['御朱印さんぽ'], p);
      assertEquals(og('og:locale'), ['ja_JP'], p);
      assertEquals(og('twitter:card'), ['summary_large_image'], p);
      const img = og('og:image');
      assertEquals(img.length, 1, p);
      if (p.startsWith('spots/')) {
        const s = d.spots.find(x => p === `spots/${x.slug}/index.html`)!;
        assertEquals(img[0], s.photo!.url, p);
      } else {
        assertEquals(img[0], `${ORIGIN}/img/ogp.png`, p);
      }
    }
    assertEquals(n, 828);
    // 404 には canonical と OGP を付けない
    const nf = files.get('404.html')!;
    assertEquals(tags(nf, 'link').filter(x => x.attrs.rel === 'canonical').length, 0);
    assertEquals(metaContents(nf, 'og:url').length, 0);
  }
);

Deno.test(
  'AC-31: sitemap.xml は 828 の URL・重ならない・文字コードの順・ファイルに当たる・404 と lastmod が無い',
  async () => {
    const files = await realSite();
    const xml = files.get('sitemap.xml')!;
    assert(
      xml.startsWith(
        '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'
      )
    );
    assert(xml.endsWith('</urlset>\n'));
    const locs = [...xml.matchAll(/<loc>([^<]*)<\/loc>/g)].map(m => m[1]);
    assertEquals(locs.length, 828);
    assertEquals(new Set(locs).size, 828);
    assertEquals(
      locs,
      [...locs].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
    );
    const want = [...files.keys()].filter(p => p.endsWith('.html') && p !== '404.html').map(urlOf);
    assertEquals(new Set(locs), new Set(want));
    assert(locs.every(u => u.startsWith(`${ORIGIN}/`)));
    assert(!xml.includes('404.html'));
    assert(!xml.includes('lastmod'));
    assertEquals(locs[0], `${ORIGIN}/`);
  }
);

Deno.test('AC-32: robots.txt は決まりの中身と1バイトも違わない', async () => {
  const files = await realSite();
  assertEquals(
    files.get('robots.txt'),
    'User-agent: *\nAllow: /\n\nSitemap: https://goshuinsanpo.com/sitemap.xml\n'
  );
});

Deno.test(
  'AC-33: llms.txt の形（見出しの順・都道府県 47 行・東京都の行・リンクが生成物に当たる）',
  async () => {
    const d = await realData();
    const files = await realSite();
    const llms = files.get('llms.txt')!;
    const lines = llms.split('\n');
    assertEquals(lines[0], '# 御朱印さんぽ');
    assertEquals(lines[1], '');
    assert(lines[2].startsWith('> '));
    assert(lines[2].includes(`${d.spots.filter(s => s.hasPage).length}か所`));
    assert(lines[2].includes(`${d.spots.filter(s => s.hours).length}か所`));
    const heads = lines.filter(l => l.startsWith('## '));
    assertEquals(heads, ['## アプリ', '## 都道府県ごとの神社・お寺', '## ポリシー']);
    const prefLines = lines.filter(l => l.startsWith('- [') && l.includes('/prefectures/'));
    assertEquals(prefLines.length, 47);
    assertEquals(
      prefLines.map(l => /\/prefectures\/([a-z]+)\//.exec(l)![1]),
      PREFECTURES.map(p => p.slug)
    );
    assert(
      lines.includes(
        '- [東京都](https://goshuinsanpo.com/prefectures/tokyo/): 119か所（ページ 76）'
      )
    );
    assert(llms.includes('(https://apps.apple.com/jp/app/id6797201465)'));
    for (const m of llms.matchAll(/\]\((https:\/\/goshuinsanpo\.com\/[^)]*)\)/g)) {
      const path = m[1].slice(ORIGIN.length + 1);
      const file = path === '' ? 'index.html' : path.endsWith('/') ? `${path}index.html` : path;
      assert(files.has(file), m[1]);
    }
    for (const m of llms.matchAll(/\]\(([^)]*)\)/g)) assert(m[1].startsWith('https://'), m[1]);
    assertEquals(forbiddenWordsIn(llms), []);
  }
);

Deno.test(
  'AC-34: 寺社の JSON-LD（明治神宮・平等院・型と geo の数・営業時間なし・パンくず 3 段）',
  async () => {
    const d = await realData();
    const files = await realSite();
    const page = (slug: string) => files.get(`spots/${slug}/index.html`)!;

    const meiji = ld(page('tokyo-002'));
    const mp = meiji.find(x => x['@type'] === 'PlaceOfWorship')!;
    assertEquals(mp.geo, { '@type': 'GeoCoordinates', latitude: 35.676111, longitude: 139.699167 });
    assert(!('openingHoursSpecification' in mp));

    const byodoin = ld(page('kyoto-008')).find(x => x['@type'] === 'BuddhistTemple')!;
    const photo = d.spots.find(s => s.slug === 'kyoto-008')!.photo!;
    assertEquals(byodoin, {
      '@context': 'https://schema.org',
      '@type': 'BuddhistTemple',
      name: '平等院',
      url: 'https://goshuinsanpo.com/spots/kyoto-008/',
      address: {
        '@type': 'PostalAddress',
        addressCountry: 'JP',
        addressRegion: '京都府',
        streetAddress: '宇治市宇治蓮華116',
      },
      image: {
        '@type': 'ImageObject',
        contentUrl: photo.url,
        creditText: 'Martin Falbisoner',
        license: photo.licenseUrl,
        acquireLicensePage: photo.sourceUrl,
      },
    });

    // 撮影者・ライセンスの URL が無ければ書かない（武田神社）
    const takeda = ld(page('yamanashi-001')).find(x => x['@type'] === 'PlaceOfWorship')!;
    const img = takeda.image as Record<string, unknown>;
    assert(!('creditText' in img) && !('license' in img));

    let shrine = 0;
    let temple = 0;
    let geo = 0;
    let hours = 0;
    for (const s of d.spots.filter(x => x.hasPage)) {
      const blocks = ld(page(s.slug));
      const places = blocks.filter(
        x => x['@type'] === 'PlaceOfWorship' || x['@type'] === 'BuddhistTemple'
      );
      assertEquals(places.length, 1, s.name);
      if (places[0]['@type'] === 'PlaceOfWorship') shrine++;
      else temple++;
      if ('geo' in places[0]) geo++;
      if (JSON.stringify(blocks).includes('openingHoursSpecification')) hours++;
      const crumbs = blocks.find(x => x['@type'] === 'BreadcrumbList')!;
      const items = crumbs.itemListElement as { position: number; name: string; item: string }[];
      assertEquals(
        items.map(i => [i.position, i.name, i.item]),
        [
          [1, 'トップ', `${ORIGIN}/`],
          [2, s.prefecture, `${ORIGIN}/prefectures/${s.pref.slug}/`],
          [3, s.name, `${ORIGIN}/spots/${s.slug}/`],
        ]
      );
    }
    const pages = d.spots.filter(x => x.hasPage);
    assertEquals(shrine, pages.filter(s => s.type === 'shrine').length);
    assertEquals(temple, pages.filter(s => s.type === 'temple').length);
    assertEquals([shrine, temple], [558, 219]);
    assertEquals(geo, pages.filter(s => s.coordsVerified).length);
    assertEquals(geo, 410);
    assertEquals(hours, 0);
  }
);

Deno.test(
  'AC-35: トップの WebSite と MobileApplication（評価なし）・都道府県のパンくず 2 段',
  async () => {
    const files = await realSite();
    const top = ld(files.get('index.html')!);
    assertEquals(
      top.find(x => x['@type'] === 'WebSite'),
      {
        '@context': 'https://schema.org',
        '@type': 'WebSite',
        name: '御朱印さんぽ',
        url: 'https://goshuinsanpo.com/',
        inLanguage: 'ja',
      }
    );
    assertEquals(
      top.find(x => x['@type'] === 'MobileApplication'),
      {
        '@context': 'https://schema.org',
        '@type': 'MobileApplication',
        name: '御朱印さんぽ',
        operatingSystem: 'iOS',
        applicationCategory: 'LifestyleApplication',
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'JPY' },
        url: 'https://apps.apple.com/jp/app/id6797201465',
      }
    );
    assert(!files.get('index.html')!.includes('aggregateRating'));
    for (const p of PREFECTURES) {
      const blocks = ld(files.get(`prefectures/${p.slug}/index.html`)!);
      const crumbs = blocks.find(x => x['@type'] === 'BreadcrumbList')!;
      assertEquals(
        (crumbs.itemListElement as { name: string; item: string }[]).map(i => [i.name, i.item]),
        [
          ['トップ', `${ORIGIN}/`],
          [p.name, `${ORIGIN}/prefectures/${p.slug}/`],
        ]
      );
    }
    // 見出しは1つ
    assertEquals(text(inner(files.get('index.html')!, 'h1')!), '参拝したら、写真1枚で日本地図に。');
  }
);
