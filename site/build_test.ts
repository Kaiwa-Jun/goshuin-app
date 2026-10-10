// Deno テスト（ページを作る。契約書 docs/issues/issue-324-homepage.md AC-13〜25・AC-27〜29）
// 中身は renderSite（ファイルに書く前の Map）で、ファイルの数・CNAME・2回作った差は CLI の build で見る
import { assert, assertEquals, assertNotEquals } from 'jsr:@std/assert@1';

import { type Assets, FORBIDDEN_WORDS, forbiddenWordsIn, renderSite } from './build.ts';
import { CONTACT_EMAIL, DEFAULT_CONFIG, type SiteConfig } from './config.ts';
import { buildSiteData, type SiteData } from './data.ts';
import { captureIo, makeRoot, readRepo, realInputs, snapshot } from './fixtures/load.ts';
import { appStoreUrl } from './links.ts';
import { runCli } from './main.ts';
import { inner, inners, metaContents, tags, text } from './scan.ts';

const NO_ASSETS: Assets = { screens: false, badge: null };
const ALL_ASSETS: Assets = { screens: true, badge: { width: 135, height: 40 } };
const LEGAL_PATHS = ['legal/privacy.html', 'legal/terms.html'];

let data: Promise<SiteData> | null = null;
function realData(): Promise<SiteData> {
  data ??= realInputs().then(buildSiteData);
  return data;
}

async function legal() {
  return {
    privacy: await readRepo('docs/legal/privacy.html'),
    terms: await readRepo('docs/legal/terms.html'),
  };
}

const sites = new Map<string, Promise<Map<string, string>>>();
function site(config: SiteConfig = DEFAULT_CONFIG, assets: Assets = NO_ASSETS) {
  const key = JSON.stringify([config, assets]);
  if (!sites.has(key)) {
    sites.set(key, (async () => renderSite(await realData(), config, assets, await legal()))());
  }
  return sites.get(key)!;
}

function get(files: Map<string, string>, path: string): string {
  const t = files.get(path);
  if (t === undefined) throw new Error(`無い: ${path}`);
  return t;
}

const h1 = (html: string) => text(inner(html, 'h1') ?? '');
const title = (html: string) => text(inner(html, 'title') ?? '');
const description = (html: string) => metaContents(html, 'description')[0];
const htmlPaths = (files: Map<string, string>) =>
  [...files.keys()].filter(p => p.endsWith('.html'));

/** 見出しの文字で、その見出しを持つ <section> の中身を探す */
function section(html: string, heading: string): string | null {
  return inners(html, 'section').find(s => text(inner(s, 'h2') ?? '') === heading) ?? null;
}

let cliBuild: Promise<{ root: string; dist: string }> | null = null;
let cliRoot: string | null = null;
function builtByCli() {
  cliBuild ??= (async () => {
    const root = await makeRoot();
    cliRoot = root;
    const c = captureIo();
    const code = await runCli(['build', '--root', root], c.io);
    assertEquals(code, 0, c.err());
    return { root, dist: `${root}/site/dist` };
  })();
  return cliBuild;
}

async function listFiles(dir: string): Promise<string[]> {
  return Object.keys(await snapshot(dir)).sort();
}

Deno.test(
  'AC-14（作る）: 終了コード 0・HTML 829・寺社 777・都道府県 47・決まったファイルがあり CNAME が無い',
  async () => {
    const { dist } = await builtByCli();
    const files = await listFiles(dist);
    assertEquals(files.filter(f => f.endsWith('.html')).length, 829);
    assertEquals(
      new Set(files.filter(f => f.startsWith('spots/')).map(f => f.split('/')[1])).size,
      777
    );
    assertEquals(
      new Set(files.filter(f => f.startsWith('prefectures/')).map(f => f.split('/')[1])).size,
      47
    );
    for (const f of [
      'index.html',
      '404.html',
      'legal/privacy.html',
      'legal/terms.html',
      'legal/site.html',
    ]) {
      assert(files.includes(f), f);
    }
    assert(!files.includes('CNAME'));
  }
);

Deno.test(
  'AC-15: 法務の2ページは <body> から </body> まで同じで、足したのは canonical と description の2行だけ',
  async () => {
    const files = await site();
    for (const path of LEGAL_PATHS) {
      const src = await readRepo(`docs/${path}`);
      const out = get(files, path);
      const body = (s: string) =>
        s.slice(s.indexOf('<body'), s.indexOf('</body>') + '</body>'.length);
      assertEquals(body(out), body(src));
      const srcLines = src.split('\n');
      const outLines = out.split('\n');
      assertEquals(outLines.length, srcLines.length + 2);
      const at = srcLines.findIndex(l => l.trim() === '</head>');
      assertEquals(outLines.slice(0, at), srcLines.slice(0, at));
      assertEquals(outLines.slice(at + 2), srcLines.slice(at));
      assertEquals(
        outLines[at].trim(),
        `<link rel="canonical" href="https://goshuinsanpo.com/${path}">`
      );
      assert(outLines[at + 1].trim().startsWith('<meta name="description" content="'));
      assert(!out.includes('static.cloudflareinsights.com'));
    }
    assertEquals(
      description(get(files, 'legal/privacy.html')),
      '御朱印さんぽ（アプリ）のプライバシーポリシー。集める情報、使い方、保存する場所、第三者への提供について。'
    );
    assertEquals(
      description(get(files, 'legal/terms.html')),
      '御朱印さんぽ（アプリ）の利用規約。サービスの内容、ユーザーコンテンツ、禁止事項について。'
    );
    // token があっても法務の2ページには beacon を入れない
    const withToken = await site({ APP_STORE_PT: null, CF_BEACON_TOKEN: 'abc123' });
    for (const path of LEGAL_PATHS) {
      assert(!get(withToken, path).includes('static.cloudflareinsights.com'));
    }
  }
);

Deno.test('AC-16: 明治神宮のページ（tokyo-002）', async () => {
  const d = await realData();
  const html = get(await site(), 'spots/tokyo-002/index.html');
  assertEquals(h1(html), '明治神宮');
  assertEquals(title(html), '明治神宮の御朱印の受付時間と場所（東京都）｜御朱印さんぽ');
  const img = tags(html, 'img').find(t => t.attrs.alt === '明治神宮の写真')!;
  assertEquals(
    img.attrs.src,
    'https://img.goshuinsanpo.com/cdn-cgi/image/width=1200,quality=78,format=webp/spot-photos/b11f026972f611335ea0ef5857ebaf7fef3960a3.jpg'
  );
  assertEquals([img.attrs.width, img.attrs.height], ['1200', '801']);
  const caption = inner(html, 'figcaption')!;
  assert(text(caption).includes('写真: Tokuzo in Edomura'));
  const capLinks = tags(caption, 'a').map(t => [
    t.attrs.href,
    text(inner(caption.slice(t.index), 'a')!),
  ]);
  assertEquals(capLinks, [
    ['https://creativecommons.org/licenses/by-sa/4.0', 'CC BY-SA 4.0'],
    [
      'https://commons.wikimedia.org/wiki/File:Courtyard_of_Meiji_Shrine_20190717.jpg',
      '元のページ',
    ],
  ]);
  assert(text(caption).includes('Wikimedia Commons'));

  const hours = section(html, '御朱印の受付時間')!;
  assert(text(hours).includes('9:00〜'));
  assert(
    text(hours).includes(
      '長殿にて9:00〜閉門まで（閉門時刻は月により変動）・2026年8月時点／公式サイト'
    )
  );
  const src = tags(hours, 'a').find(
    t => t.attrs.href === 'https://www.meijijingu.or.jp/sanpai/2.php'
  );
  assert(src);
  assertEquals(text(inner(hours.slice(src.index), 'a')!), 'www.meijijingu.or.jp');
  assert(
    text(hours).includes(
      '時間は変わることがあります。参拝の前に、寺社の公式の案内もご確認ください。'
    )
  );

  const map = section(html, '住所と地図')!;
  const meiji = d.spots.find(s => s.slug === 'tokyo-002')!;
  const hrefs = tags(map, 'a').map(t => t.attrs.href);
  assertEquals(hrefs, [meiji.googleMapsUrl, meiji.osmUrl]);

  const near = section(html, '近くの寺社')!;
  const bySlug = new Map(d.spots.map(s => [s.slug, s]));
  const nearLinks = tags(near, 'a').map(t => t.attrs.href);
  assertEquals(nearLinks.length, 5);
  assertEquals(
    nearLinks.map(h => bySlug.get(h.split('/')[2])?.name),
    ['代々木八幡宮', '花園神社', '赤坂氷川神社', '日枝神社', '麻布氷川神社']
  );
  assert(nearLinks.every(h => /^\/spots\/[a-z]+-\d{3}\/$/.test(h)));
});

Deno.test('AC-17: 平等院のページ（kyoto-008）', async () => {
  const html = get(await site(), 'spots/kyoto-008/index.html');
  const hours = section(html, '御朱印の受付時間')!;
  assert(text(hours).includes('9:10〜17:00'));
  assert(text(hours).includes('受付終了16:45・2026年8月時点／公式サイト'));
  assert(text(hours).includes('www.byodoin.or.jp'));
  assert(!html.includes('openstreetmap.org'));
  assertEquals(
    description(html),
    '平等院（京都府のお寺）の御朱印の受付時間は9:10〜17:00（2026年8月時点・公式サイト）。住所は京都府宇治市宇治蓮華116。'
  );
});

Deno.test(
  'AC-18: 武田神社の表記・帯廣神社（近くの寺社なし）・受付時間の無い 769 ページ',
  async () => {
    const files = await site();
    const takeda = get(files, 'spots/yamanashi-001/index.html');
    const cap = inner(takeda, 'figcaption')!;
    assert(text(cap).includes('写真: 不明'));
    assert(text(cap).includes('Public domain'));
    assertEquals(
      tags(cap, 'a').map(t => t.attrs.href),
      [tags(cap, 'a')[0].attrs.href]
    );
    assert(tags(cap, 'a')[0].attrs.href.startsWith('https://commons.wikimedia.org/'));

    const obihiro = get(files, 'spots/hokkaido-011/index.html');
    assertEquals(section(obihiro, '近くの寺社'), null);
    assert(!text(obihiro).includes('近くの寺社'));
    assertEquals(title(obihiro), '帯廣神社の場所と写真（北海道）｜御朱印さんぽ');
    assert(!description(obihiro).includes('近くの寺社'));
    const d = await realData();
    const ob = d.spots.find(s => s.slug === 'hokkaido-011')!;
    assertEquals(
      description(obihiro),
      `帯廣神社（北海道の神社）の住所は${ob.address}。写真と地図のリンクをまとめています。`
    );

    const noHours = d.spots.filter(s => s.hasPage && s.hours === null);
    assertEquals(noHours.length, 769);
    for (const s of noHours) {
      const html = get(files, `spots/${s.slug}/index.html`);
      assertEquals(section(html, '御朱印の受付時間'), null, s.name);
      assert(!html.includes('御朱印の受付時間'), s.name);
    }
  }
);

Deno.test('AC-19: proxy の 4 寺社は受付時間を出さず「場所と写真」の題', async () => {
  const d = await realData();
  const files = await site();
  for (const [n, p] of [
    ['湯島天満宮', '東京都'],
    ['八坂神社', '京都府'],
    ['北野天満宮', '京都府'],
    ['浅草神社', '東京都'],
  ]) {
    const s = d.spots.find(x => x.name === n && x.prefecture === p)!;
    const html = get(files, `spots/${s.slug}/index.html`);
    assert(!html.includes('御朱印の受付時間'), n);
    assert(!/\d{1,2}:\d{2}〜/.test(text(html)), n);
    assertEquals(title(html), `${n}の場所と写真（${p}）｜御朱印さんぽ`);
  }
});

Deno.test(
  'AC-20: 東京都の一覧（119 行・1 行目は浅草寺・リンク 76・リンクなし 43 は Google マップ）',
  async () => {
    const html = get(await site(), 'prefectures/tokyo/index.html');
    assertEquals(h1(html), '東京都の神社・お寺');
    const list = /<ul class="spots">([\s\S]*?)<\/ul>/.exec(html)![1];
    const rows = inners(list, 'li');
    assertEquals(rows.length, 119);
    assert(text(rows[0]).startsWith('浅草寺'));
    const linked = rows.filter(r =>
      tags(r, 'a').some(t => t.attrs.href.startsWith('/spots/tokyo-'))
    );
    const plain = rows.filter(r => !tags(r, 'a').some(t => t.attrs.href.startsWith('/spots/')));
    assertEquals([linked.length, plain.length], [76, 43]);
    for (const r of plain) {
      assert(
        tags(r, 'a').some(t =>
          t.attrs.href.startsWith('https://www.google.com/maps/search/?api=1&query=')
        ),
        r
      );
    }
    for (const r of rows) {
      const t = text(r);
      assert(t.includes('神社') || t.includes('お寺'), t);
      assert(t.includes('東京都'), t);
    }
  }
);

Deno.test('AC-21: トップ（見出し・バッジ・都道府県から探す 47・足もと）', async () => {
  const html = get(await site(), 'index.html');
  assertEquals(h1(html), '参拝したら、写真1枚で日本地図に。');
  assert(text(html).includes('家にある御朱印帳も、まとめて地図に。'));
  const badge = tags(html, 'img').find(t => t.attrs.src === '/img/app-store-badge-ja.svg');
  assert(badge);
  assertEquals(badge.attrs.alt, 'App Store からダウンロード');
  const badgeLink = tags(html, 'a').filter(t =>
    t.attrs.href?.startsWith('https://apps.apple.com/')
  );
  assert(badgeLink.length >= 1);
  assert(badgeLink.every(t => t.attrs.href === appStoreUrl(DEFAULT_CONFIG.APP_STORE_PT)));
  const prefLinks = new Set(
    tags(html, 'a')
      .map(t => t.attrs.href)
      .filter(h => /^\/prefectures\/[a-z]+\/$/.test(h))
  );
  assertEquals(prefLinks.size, 47);
  const footer = inner(html, 'footer')!;
  const fl = tags(footer, 'a').map(t => t.attrs.href);
  for (const h of [
    '/legal/privacy.html',
    '/legal/terms.html',
    '/legal/site.html',
    'https://github.com/Kaiwa-Jun/goshuin-app/issues',
  ]) {
    assert(fl.includes(h), h);
  }
  const ft = text(footer);
  assert(ft.includes('Apple Inc.') && ft.includes('App Store') && ft.includes('サービスマーク'));
  assert(ft.includes('寺社の写真: Wikimedia Commons（撮影者とライセンスは各ページ）'));
  assert(ft.includes('© 2026 御朱印さんぽ'));
});

Deno.test(
  'AC-21: スクショがあれば 4 枚（srcset 360w / 720w・alt あり）、無ければ節ごと出さない',
  async () => {
    const withShots = get(await site(DEFAULT_CONFIG, ALL_ASSETS), 'index.html');
    const shots = tags(withShots, 'img').filter(t => t.attrs.src?.startsWith('/img/screens/'));
    assertEquals(shots.length, 4);
    shots.forEach((t, i) => {
      assert(t.attrs.srcset.includes(`/img/screens/0${i + 1}-360.webp 360w`));
      assert(t.attrs.srcset.includes(`/img/screens/0${i + 1}-720.webp 720w`));
      assert(t.attrs.alt.length > 0);
    });
    const caps = inners(withShots, 'figcaption').map(c => text(c));
    assertEquals(
      caps.map(c => c.split(' ')[0]),
      [
        '近くの寺社が、すぐ見つかる。',
        '写真を1枚。それだけ。',
        '集めるたび、地図があなたの旅になる。',
        '集めた御朱印は、一冊になる。',
      ]
    );
    const withoutShots = get(await site(), 'index.html');
    assert(!withoutShots.includes('/img/screens/'));
    // バッジの大きさが分かれば width を付ける（高さ 48 に合わせる）
    const badge = tags(withShots, 'img').find(t => t.attrs.src === '/img/app-store-badge-ja.svg')!;
    assertEquals([badge.attrs.width, badge.attrs.height], ['162', '48']);
  }
);

Deno.test('AC-22: このサイトのプライバシーの説明（1〜7）', async () => {
  const html = get(await site(), 'legal/site.html');
  const t = text(html);
  for (const s of [
    'goshuinsanpo.com',
    'Cloudflare Web Analytics',
    'Cookie も、ブラウザの保存領域（localStorage など）も使いません',
    'アプリのプライバシーポリシーにある「Cookieや行動トラッキング技術を使用しません」は、アプリについての説明です。このサイトでの計測は、このページのとおりです。',
    'img.goshuinsanpo.com',
    'ct=web',
    CONTACT_EMAIL,
    '最終更新日',
  ]) {
    assert(t.includes(s), s);
  }
  const hrefs = tags(html, 'a').map(a => a.attrs.href);
  assert(hrefs.includes('https://www.cloudflare.com/privacypolicy/'));
  assert(hrefs.includes('/legal/privacy.html'));
  // 連絡先はアプリのプライバシーポリシーと同じ
  assert((await readRepo('docs/legal/privacy.html')).includes(CONTACT_EMAIL));
});

Deno.test('AC-23: 404 だけが noindex で / へのリンクを持つ', async () => {
  const files = await site();
  const nf = get(files, '404.html');
  assert(nf.includes('<meta name="robots" content="noindex">'));
  assert(tags(nf, 'a').some(t => t.attrs.href === '/'));
  assert(text(nf).includes('ページが見つかりませんでした。'));
  for (const p of htmlPaths(files)) {
    if (p !== '404.html') assert(!get(files, p).includes('noindex'), p);
  }
});

Deno.test(
  'AC-24: 出さない語が法務の2ページを除くどの HTML にも無い（写真の撮影者の名前だけは除く）',
  async () => {
    const files = await site(DEFAULT_CONFIG, ALL_ASSETS);
    assertEquals(FORBIDDEN_WORDS.length, 10);
    for (const [p, t] of files) {
      if (LEGAL_PATHS.includes(p)) continue;
      assertEquals(forbiddenWordsIn(t), [], p);
    }
    // 生の HTML に出さない語があるのは、撮影者の名前に含むページだけ（ライセンスの表記で名前を変えられない）
    const d = await realData();
    const byAuthor = d.spots
      .filter(s => s.photo?.author && FORBIDDEN_WORDS.some(w => s.photo!.author!.includes(w)))
      .map(s => `spots/${s.slug}/index.html`);
    const raw = [...files]
      .filter(([p, t]) => !LEGAL_PATHS.includes(p) && FORBIDDEN_WORDS.some(w => t.includes(w)))
      .map(([p]) => p);
    assertEquals(raw, byAuthor);
    assertEquals(byAuthor, ['spots/kanagawa-015/index.html']);
    // 撮影者の名前の外にあれば見つける
    assertEquals(forbiddenWordsIn('<p>プラス</p><span class="author">ブルーノ・プラス</span>'), [
      'プラス',
    ]);
  }
);

Deno.test(
  'AC-25: CF_BEACON_TOKEN があれば法務以外の全 HTML に beacon が1つ、null ならどこにも無い',
  async () => {
    const on = await site({ APP_STORE_PT: '123456', CF_BEACON_TOKEN: 'abc123' });
    for (const p of htmlPaths(on)) {
      const html = get(on, p);
      const scripts = tags(html, 'script').filter(
        t => t.attrs.src === 'https://static.cloudflareinsights.com/beacon.min.js'
      );
      if (LEGAL_PATHS.includes(p)) {
        assertEquals(scripts.length, 0, p);
        continue;
      }
      assertEquals(scripts.length, 1, p);
      assertEquals(scripts[0].attrs['data-cf-beacon'], '{"token":"abc123"}');
      assert(html.includes(`data-cf-beacon='{"token":"abc123"}'`), p);
      assert('defer' in scripts[0].attrs, p);
    }
    const off = await site();
    for (const [p, t] of off) assert(!t.includes('static.cloudflareinsights.com'), p);
  }
);

Deno.test(
  'AC-25: APP_STORE_PT があれば App Store へのリンクが全部キャンペーンリンク（&amp; で書く）',
  async () => {
    const on = await site({ APP_STORE_PT: '123456', CF_BEACON_TOKEN: null });
    let count = 0;
    for (const p of htmlPaths(on)) {
      const html = get(on, p);
      for (const t of tags(html, 'a')) {
        if (!t.attrs.href?.startsWith('https://apps.apple.com/')) continue;
        assertEquals(t.attrs.href, appStoreUrl('123456'), p);
        assert(t.raw.includes('pt=123456&amp;ct=web&amp;mt=8'), p);
        count++;
      }
    }
    assert(count >= 778, `${count}`);
  }
);

Deno.test('AC-13: 名前・撮影者・notes の & < > " \' はページの文字と属性で逃がされる', async () => {
  const d = structuredClone(await realData());
  const evil = `<b>"x" & 'y'</b>`;
  const s = d.spots.find(x => x.slug === 'tokyo-002')!;
  s.name = `明治${evil}神宮`;
  s.photo!.author = evil;
  s.hours!.notes = evil;
  const files = renderSite(d, DEFAULT_CONFIG, NO_ASSETS, await legal());
  const html = get(files, 'spots/tokyo-002/index.html');
  assert(!html.includes('<b>'));
  assert(html.includes('&lt;b&gt;&quot;x&quot; &amp; &#39;y&#39;&lt;/b&gt;'));
  assertEquals(h1(html), `明治${evil}神宮`);
  const img = tags(html, 'img').find(t => t.attrs.src?.includes('b11f0269'))!;
  assertEquals(img.attrs.alt, `明治${evil}神宮の写真`);
  // 一覧と近くの寺社のリンクの文字も逃がす
  const tokyo = get(files, 'prefectures/tokyo/index.html');
  assert(!tokyo.includes('<b>'));
});

Deno.test(
  'AC-27（CLI）: --production で APP_STORE_PT か CF_BEACON_TOKEN が null なら名前を出して 1・dist を書き換えない',
  async () => {
    const root = await makeRoot({ statics: false });
    try {
      await Deno.mkdir(`${root}/site/dist`, { recursive: true });
      await Deno.writeTextFile(`${root}/site/dist/keep.txt`, 'まえの生成物');
      const before = await snapshot(`${root}/site/dist`);
      const args = ['build', '--production', '--root', root];
      const c = captureIo();
      assertEquals(await runCli(args, c.io, { APP_STORE_PT: null, CF_BEACON_TOKEN: null }), 1);
      assert(c.err().includes('APP_STORE_PT'), c.err());
      assert(c.err().includes('CF_BEACON_TOKEN'), c.err());
      const c2 = captureIo();
      assertEquals(await runCli(args, c2.io, { APP_STORE_PT: '123456', CF_BEACON_TOKEN: null }), 1);
      assert(!c2.err().includes('APP_STORE_PT') && c2.err().includes('CF_BEACON_TOKEN'), c2.err());
      const c3 = captureIo();
      assertEquals(await runCli(args, c3.io, { APP_STORE_PT: null, CF_BEACON_TOKEN: 'abc123' }), 1);
      assert(c3.err().includes('APP_STORE_PT') && !c3.err().includes('CF_BEACON_TOKEN'), c3.err());
      assertEquals(await snapshot(`${root}/site/dist`), before);
      // 両方あれば作れる
      const c4 = captureIo();
      assertEquals(
        await runCli(args, c4.io, { APP_STORE_PT: '123456', CF_BEACON_TOKEN: 'abc123' }),
        0,
        c4.err()
      );
    } finally {
      await Deno.remove(root, { recursive: true });
    }
  }
);

Deno.test('AC-3（CLI）: slug の台帳に無い seed の寺社があると build が名前を出して 1', async () => {
  const seed = 'supabase/seeds/seed_tokyo_spots.sql';
  const root = await makeRoot({
    statics: false,
    seedAppend: {
      [seed]:
        "('テスト神社', 35.0, 139.0, 'shrine', '東京都テスト区1-1', '東京都', 3, 'active'),\n",
    },
  });
  try {
    const c = captureIo();
    assertEquals(await runCli(['build', '--root', root], c.io), 1);
    assert(c.err().includes('テスト神社（東京都）'), c.err());
    assertEquals(await snapshot(`${root}/site/dist`), {});
  } finally {
    await Deno.remove(root, { recursive: true });
  }
});

Deno.test('スクショが 1〜7 枚だけなら build は無い名前を出して 1', async () => {
  const root = await makeRoot({ statics: false });
  try {
    await Deno.mkdir(`${root}/site/static/img/screens`, { recursive: true });
    await Deno.writeFile(`${root}/site/static/img/screens/01-360.webp`, new Uint8Array([1]));
    const c = captureIo();
    assertEquals(await runCli(['build', '--root', root], c.io), 1);
    assert(c.err().includes('02-360.webp'), c.err());
  } finally {
    await Deno.remove(root, { recursive: true });
  }
});

Deno.test('AC-28（作る×2）: 2回作って同じ・作った日時が入らない', async () => {
  const { root, dist } = await builtByCli();
  const first = await snapshot(dist);
  assertEquals(await runCli(['build', '--root', root], captureIo().io), 0);
  const second = await snapshot(dist);
  assertEquals(Object.keys(second).sort(), Object.keys(first).sort());
  for (const k of Object.keys(first)) assertEquals(second[k], first[k], k);
  const exempt = [...LEGAL_PATHS, 'legal/site.html'];
  for (const [p, t] of Object.entries(first)) {
    if (exempt.includes(p)) continue;
    assert(!/2026-10-\d/.test(t), p);
    assert(!/\d{1,2}:\d{2}:\d{2}/.test(t), p);
  }
});

Deno.test('AC-29: 生成物に /Users/・kaiwajun・goshuin-work が無い', async () => {
  const { dist } = await builtByCli();
  for (const [p, t] of Object.entries(await snapshot(dist))) {
    for (const w of ['/Users/', 'kaiwajun', 'goshuin-work']) assert(!t.includes(w), `${p}: ${w}`);
  }
  assertNotEquals((await snapshot(dist))['index.html'], undefined);
});

Deno.test('共通: lang・viewport・<h1> が1つ・header と footer', async () => {
  const files = await site();
  for (const p of htmlPaths(files)) {
    if (LEGAL_PATHS.includes(p)) continue;
    const html = get(files, p);
    assert(html.startsWith('<!doctype html>\n<html lang="ja">'), p);
    assertEquals(metaContents(html, 'viewport'), ['width=device-width, initial-scale=1'], p);
    assertEquals(tags(html, 'h1').length, 1, p);
    assertEquals(tags(html, 'header').length, 1, p);
    assertEquals(tags(html, 'footer').length, 1, p);
  }
});

addEventListener('unload', () => {
  if (cliRoot) Deno.removeSync(cliRoot, { recursive: true });
});
