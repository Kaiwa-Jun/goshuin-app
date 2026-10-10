// Deno テスト（生成物の検査 check。契約書 docs/issues/issue-324-homepage.md AC-26）
// フィクスチャ: 本物の入力から renderSite で作った生成物を一時のディレクトリに書き、1か所ずつ壊して検査する。
// まだリーダーが入れていない素材（バッジ・アイコン）は、一時のディレクトリにだけ仮のファイルを置く
import { assert, assertEquals } from 'jsr:@std/assert@1';

import { checkSite } from './check.ts';
import { DEFAULT_CONFIG, type SiteConfig } from './config.ts';
import { captureIo, makeRoot, REPO_DIR, realSite, writeDist } from './fixtures/load.ts';
import { runCli } from './main.ts';

const PLACEHOLDERS = {
  'img/app-store-badge-ja.svg':
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 135 40"></svg>',
  'favicon.png': 'x',
  'apple-touch-icon.png': 'x',
};
const PROD: SiteConfig = { APP_STORE_PT: '123456', CF_BEACON_TOKEN: 'abc123' };

async function check(dir: string, config = DEFAULT_CONFIG, production = false) {
  return await checkSite({ dir, root: REPO_DIR, config, production });
}

/** ファイルを書き換えて検査し、元に戻す */
async function broken(
  dir: string,
  path: string,
  edit: (t: string) => string | null,
  opts: { config?: SiteConfig; production?: boolean } = {}
): Promise<string[]> {
  const file = `${dir}/${path}`;
  const before = await Deno.readTextFile(file);
  const after = edit(before);
  if (after === null) await Deno.remove(file);
  else {
    assert(after !== before, `${path} を書き換えていない`);
    await Deno.writeTextFile(file, after);
  }
  try {
    return await check(dir, opts.config, opts.production);
  } finally {
    await Deno.writeTextFile(file, before);
  }
}

function has(errors: string[], file: string, reason: string) {
  assert(
    errors.some(e => e.startsWith(`${file}: `) && e.includes(reason)),
    `「${file}: …${reason}…」が無い:\n${errors.join('\n')}`
  );
}

let dist: Promise<string> | null = null;
let distDir: string | null = null;
function fixtureDist() {
  dist ??= (async () => (distDir = await writeDist(await realSite(), PLACEHOLDERS)))();
  return dist;
}

Deno.test('AC-26: 正しい生成物は検査に通る', async () => {
  assertEquals(await check(await fixtureDist()), []);
});

Deno.test('AC-26: canonical が無い・パスと合わない', async () => {
  const dir = await fixtureDist();
  const p = 'spots/tokyo-002/index.html';
  has(await broken(dir, p, t => t.replace(/<link rel="canonical"[^>]*>\n/, '')), p, 'canonical');
  has(
    await broken(dir, p, t =>
      t.replace(
        'rel="canonical" href="https://goshuinsanpo.com/spots/tokyo-002/"',
        'rel="canonical" href="https://goshuinsanpo.com/spots/tokyo-003/"'
      )
    ),
    p,
    'canonical がパスと合わない'
  );
});

Deno.test('AC-26: description が無い・title が重なる', async () => {
  const dir = await fixtureDist();
  const p = 'prefectures/tokyo/index.html';
  has(
    await broken(dir, p, t => t.replace(/<meta name="description"[^>]*>\n/, '')),
    p,
    'description'
  );
  const errors = await broken(dir, 'prefectures/aichi/index.html', t =>
    t.replace(/<title>[^<]*<\/title>/, '<title>秋田県の神社・お寺 20か所｜御朱印さんぽ</title>')
  );
  assert(
    errors.some(e => e.includes('title が') && e.includes('重なる')),
    errors.join('\n')
  );
});

Deno.test('AC-26: 内部のリンクの先が無い（href・src・srcset）', async () => {
  const dir = await fixtureDist();
  has(
    await broken(dir, 'index.html', t =>
      t.replace('</main>', '<a href="/spots/no-such/">x</a></main>')
    ),
    'spots/no-such/index.html',
    'リンクの先が無い'
  );
  has(
    await broken(dir, 'index.html', t =>
      t.replace(
        '</main>',
        '<img srcset="/img/screens/09-360.webp 360w, /img/a.webp 720w" alt="x"></main>'
      )
    ),
    'img/screens/09-360.webp',
    'リンクの先が無い'
  );
});

Deno.test('AC-26: sitemap と HTML が合わない', async () => {
  const dir = await fixtureDist();
  has(
    await broken(dir, 'sitemap.xml', t =>
      t.replace('<url><loc>https://goshuinsanpo.com/spots/tokyo-002/</loc></url>\n', '')
    ),
    'sitemap.xml',
    'sitemap に無い'
  );
  has(
    await broken(dir, 'sitemap.xml', t =>
      t.replace('</urlset>', '<url><loc>https://goshuinsanpo.com/zzz/</loc></url>\n</urlset>')
    ),
    'sitemap.xml',
    '生成物に無い URL'
  );
});

Deno.test('AC-26: legal/privacy.html が無い・docs/legal と <body> が違う', async () => {
  const dir = await fixtureDist();
  const p = 'legal/privacy.html';
  has(await broken(dir, p, () => null), p, '無い');
  has(await broken(dir, p, t => t.replace('<h2>', '<h2>改')), p, '<body> が違う');
  has(
    await broken(dir, 'legal/terms.html', t => t.replace('</main>', 'x</main>')),
    'legal/terms.html',
    '<body> が違う'
  );
});

Deno.test('AC-26: 出さない語がある・JSON-LD が JSON として読めない', async () => {
  const dir = await fixtureDist();
  has(
    await broken(dir, 'index.html', t => t.replace('</main>', '<p>コレクション</p></main>')),
    'index.html',
    '出さない語'
  );
  has(await broken(dir, 'llms.txt', t => t + '\nランキング\n'), 'llms.txt', '出さない語');
  const p = 'spots/kyoto-008/index.html';
  has(
    await broken(dir, p, t =>
      t.replace('<script type="application/ld+json">{', '<script type="application/ld+json">{,')
    ),
    p,
    'JSON-LD'
  );
});

Deno.test('AC-26: noindex・CNAME・robots', async () => {
  const dir = await fixtureDist();
  has(
    await broken(dir, '404.html', t => t.replace('<meta name="robots" content="noindex">', '')),
    '404.html',
    'noindex'
  );
  has(
    await broken(dir, 'legal/site.html', t =>
      t.replace('</head>', '<meta name="robots" content="noindex">\n</head>')
    ),
    'legal/site.html',
    'noindex'
  );
  has(await broken(dir, 'robots.txt', t => t + '#'), 'robots.txt', '違う');
  await Deno.writeTextFile(`${dir}/CNAME`, 'goshuinsanpo.com');
  try {
    has(await check(dir), 'CNAME', '置かない');
  } finally {
    await Deno.remove(`${dir}/CNAME`);
  }
});

Deno.test(
  'AC-26: check --production は beacon の無いページ・pt= と ct=web の無い App Store のリンクで止まる',
  async () => {
    // token も pt もない生成物を --production で見ると、beacon と App Store のリンクで止まる
    const plain = await check(await fixtureDist(), PROD, true);
    has(plain, 'index.html', 'beacon');
    has(plain, 'index.html', 'pt= と ct=web');

    const dir = await writeDist(await realSite(PROD), PLACEHOLDERS);
    try {
      assertEquals(await check(dir, PROD, true), []);
      const p = 'spots/tokyo-002/index.html';
      has(
        await broken(
          dir,
          p,
          t =>
            t.replace(
              /<script defer src="https:\/\/static\.cloudflareinsights\.com[^\n]*<\/script>\n/,
              ''
            ),
          { config: PROD, production: true }
        ),
        p,
        'beacon'
      );
      has(
        await broken(dir, p, t => t.replaceAll('?pt=123456&amp;ct=web&amp;mt=8', ''), {
          config: PROD,
          production: true,
        }),
        p,
        'pt= と ct=web'
      );
      // 法務のページに beacon があれば止まる（--production でなくても）
      has(
        await broken(dir, 'legal/terms.html', t =>
          t.replace(
            '</body>',
            '<script defer src="https://static.cloudflareinsights.com/beacon.min.js"></script>\n</body>'
          )
        ),
        'legal/terms.html',
        'beacon'
      );
    } finally {
      await Deno.remove(dir, { recursive: true });
    }
  }
);

Deno.test(
  'AC-26（CLI）: build のあと check は 0。--production で値が null なら名前を出して 1',
  async () => {
    const root = await makeRoot({ statics: false });
    try {
      for (const [p, t] of Object.entries(PLACEHOLDERS)) {
        const to = `${root}/site/static/${p}`;
        await Deno.mkdir(to.slice(0, to.lastIndexOf('/')), { recursive: true });
        await Deno.writeTextFile(to, t);
      }
      assertEquals(await runCli(['build', '--root', root], captureIo().io), 0);
      const c = captureIo();
      assertEquals(await runCli(['check', '--root', root], c.io), 0, c.err());
      assert(c.out().includes('検査に通った'));
      const c2 = captureIo();
      const nulls = { APP_STORE_PT: null, CF_BEACON_TOKEN: null };
      assertEquals(await runCli(['check', '--production', '--root', root], c2.io, nulls), 1);
      assert(c2.err().includes('APP_STORE_PT') && c2.err().includes('CF_BEACON_TOKEN'));
      // 作ったものを壊すと 1 と理由
      await Deno.remove(`${root}/site/dist/llms.txt`);
      const c3 = captureIo();
      assertEquals(await runCli(['check', '--root', root], c3.io), 1);
      assert(c3.err().includes('llms.txt: 無い'), c3.err());
    } finally {
      await Deno.remove(root, { recursive: true });
    }
  }
);

addEventListener('unload', () => {
  if (distDir) Deno.removeSync(distDir, { recursive: true });
});
