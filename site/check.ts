// 生成物の検査（契約書 docs/issues/issue-324-homepage.md AC-26。AC-15・AC-23・AC-24・AC-30〜33 の形を見る）。
// 生成物のディレクトリと config を引数に取る。間違いは「ファイル: 理由」の文の配列で返す（空なら合格）
import { forbiddenWordsIn, LEGAL_FILES } from './build.ts';
import { SITE_NAME, SITE_ORIGIN, type SiteConfig } from './config.ts';
import { BEACON_SRC } from './layout.ts';
import { decode, jsonLdBlocks, linkTargets, metaContents, tags } from './scan.ts';
import { ROBOTS_TXT, urlOfFile } from './seo.ts';

export interface CheckOptions {
  /** 生成物のディレクトリ（site/dist） */
  dir: string;
  /** リポジトリの直下（docs/legal と比べる） */
  root: string;
  config: SiteConfig;
  /** beacon と App Store の印（pt=・ct=web）も見る */
  production: boolean;
}

const REQUIRED = [
  'index.html',
  '404.html',
  'legal/privacy.html',
  'legal/terms.html',
  'legal/site.html',
  'sitemap.xml',
  'robots.txt',
  'llms.txt',
];
const LEGAL = Object.values(LEGAL_FILES).map(f => f.out as string);
const DESCRIPTION_MAX = 120;

async function listAll(dir: string): Promise<string[]> {
  const out: string[] = [];
  const walk = async (rel: string) => {
    for await (const e of Deno.readDir(rel ? `${dir}/${rel}` : dir)) {
      const p = rel ? `${rel}/${e.name}` : e.name;
      if (e.isDirectory) await walk(p);
      else out.push(p);
    }
  };
  await walk('');
  return out.sort();
}

function body(html: string): string {
  const start = html.indexOf('<body');
  const end = html.indexOf('</body>');
  return start < 0 || end < 0 ? '' : html.slice(start, end + '</body>'.length);
}

/** リンクの先（サイトの中なら dist からの相対パス。外なら null） */
export function internalTarget(from: string, url: string): string | null {
  if (/^(mailto|tel|javascript|data):/i.test(url) || url.startsWith('#') || url === '') return null;
  let u: URL;
  try {
    u = new URL(url, `${SITE_ORIGIN}/${from}`);
  } catch {
    return `（読めない URL ${url}）`;
  }
  if (u.origin !== SITE_ORIGIN) return null;
  let path = decodeURIComponent(u.pathname);
  if (path.endsWith('/')) path += 'index.html';
  return path.slice(1);
}

export async function checkSite(opts: CheckOptions): Promise<string[]> {
  const { dir } = opts;
  const errors: string[] = [];
  const err = (file: string, reason: string) => errors.push(`${file}: ${reason}`);
  let files: string[];
  try {
    files = await listAll(dir);
  } catch (e) {
    if (e instanceof Deno.errors.NotFound)
      return [`${dir}: 生成物のディレクトリが無い（先に build）`];
    throw e;
  }
  const have = new Set(files);
  for (const f of REQUIRED) if (!have.has(f)) err(f, '無い');
  if (have.has('CNAME'))
    err('CNAME', 'GitHub Actions で出すときは置かない（独自ドメインは設定で決める）');

  const htmlFiles = files.filter(f => f.endsWith('.html'));
  const texts = new Map<string, string>();
  for (const f of [...htmlFiles, 'llms.txt', 'sitemap.xml', 'robots.txt']) {
    if (have.has(f)) texts.set(f, await Deno.readTextFile(`${dir}/${f}`));
  }

  // --- 1ページずつ ---
  const titles = new Map<string, string>();
  const descriptions = new Map<string, string>();
  const missingTargets = new Map<string, string[]>();
  for (const f of htmlFiles) {
    const html = texts.get(f)!;
    const isLegal = LEGAL.includes(f);
    const is404 = f === '404.html';

    const noindex = metaContents(html, 'robots').some(c => c.includes('noindex'));
    if (is404 && !noindex) err(f, 'noindex が無い');
    if (!is404 && html.includes('noindex')) err(f, 'noindex がある（404.html のほかに付けない）');

    if (!is404) {
      const ts = [...html.matchAll(/<title>([\s\S]*?)<\/title>/g)].map(m => decode(m[1]).trim());
      if (ts.length !== 1 || ts[0] === '')
        err(f, `<title> がちょうど1つ・空でない、でない（${ts.length}）`);
      else if (titles.has(ts[0])) err(f, `title が ${titles.get(ts[0])} と重なる: ${ts[0]}`);
      else titles.set(ts[0], f);

      const canon = tags(html, 'link').filter(t => t.attrs.rel === 'canonical');
      const want = urlOfFile(f);
      if (canon.length !== 1) err(f, `canonical がちょうど1つでない（${canon.length}）`);
      else if (canon[0].attrs.href !== want) {
        err(f, `canonical がパスと合わない: ${canon[0].attrs.href}（${want} のはず）`);
      }

      const ds = metaContents(html, 'description');
      if (ds.length !== 1) err(f, `description がちょうど1つでない（${ds.length}）`);
      else {
        const d = ds[0];
        if (d.length < 1 || d.length > DESCRIPTION_MAX)
          err(f, `description が 1〜${DESCRIPTION_MAX} 字でない（${d.length}）`);
        else if (descriptions.has(d)) err(f, `description が ${descriptions.get(d)} と重なる`);
        else descriptions.set(d, f);
      }

      if (!isLegal) {
        if (!html.includes('<html lang="ja">')) err(f, '<html lang="ja"> が無い');
        if (metaContents(html, 'viewport').length !== 1) err(f, 'viewport が無い');
        const og = (k: string) => metaContents(html, k);
        for (const k of [
          'og:title',
          'og:description',
          'og:url',
          'og:image',
          'og:type',
          'og:site_name',
          'og:locale',
        ]) {
          if (og(k).length !== 1) err(f, `${k} がちょうど1つでない`);
        }
        if (og('og:url')[0] !== want) err(f, `og:url が canonical と違う: ${og('og:url')[0]}`);
        if (!og('og:image')[0]?.startsWith('https://'))
          err(f, 'og:image が https:// の絶対 URL でない');
        if (og('og:site_name')[0] !== SITE_NAME) err(f, `og:site_name が ${SITE_NAME} でない`);
        if (og('og:locale')[0] !== 'ja_JP') err(f, 'og:locale が ja_JP でない');
        if (metaContents(html, 'twitter:card')[0] !== 'summary_large_image') {
          err(f, 'twitter:card が summary_large_image でない');
        }
      }
    }

    // サイトの中のリンクの先
    for (const { url } of linkTargets(html)) {
      const target = internalTarget(f, url);
      if (target === null || have.has(target)) continue;
      const list = missingTargets.get(target) ?? [];
      list.push(f);
      missingTargets.set(target, list);
    }

    // JSON-LD
    for (const block of jsonLdBlocks(html)) {
      try {
        JSON.parse(block);
      } catch (e) {
        err(f, `JSON-LD が JSON として読めない: ${(e as Error).message}`);
      }
    }

    // 出さない語
    if (!isLegal) {
      const words = forbiddenWordsIn(html);
      if (words.length > 0) err(f, `出さない語がある: ${words.join('・')}`);
    }

    // 計測
    const beacons = tags(html, 'script').filter(t => t.attrs.src === BEACON_SRC);
    if (isLegal && beacons.length > 0) err(f, '法務のページに beacon がある');
    if (!isLegal && opts.production) {
      if (beacons.length !== 1) err(f, `beacon がちょうど1つでない（${beacons.length}）`);
      else if (
        beacons[0].attrs['data-cf-beacon'] !==
        JSON.stringify({ token: opts.config.CF_BEACON_TOKEN })
      ) {
        err(f, `beacon の token が config と違う: ${beacons[0].attrs['data-cf-beacon']}`);
      }
    }
    if (opts.production && !isLegal) {
      for (const t of tags(html, 'a')) {
        const href = t.attrs.href ?? '';
        if (!href.startsWith('https://apps.apple.com/')) continue;
        if (!/[?&]pt=\d+/.test(href) || !/[?&]ct=web(&|$)/.test(href)) {
          err(f, `App Store のリンクに pt= と ct=web が無い: ${href}`);
        }
      }
    }
  }
  for (const [target, from] of missingTargets) {
    err(target, `リンクの先が無い（${from.length} ファイルから。例: ${from[0]}）`);
  }

  // --- 法務の2ページ: docs/legal と <body> が同じ ---
  for (const k of ['privacy', 'terms'] as const) {
    const { src, out } = LEGAL_FILES[k];
    const html = texts.get(out);
    if (html === undefined) continue;
    let original: string;
    try {
      original = await Deno.readTextFile(`${opts.root.replace(/\/+$/, '')}/${src}`);
    } catch {
      err(out, `比べる ${src} が読めない`);
      continue;
    }
    if (body(html) !== body(original)) err(out, `${src} と <body> が違う`);
  }

  // --- sitemap ---
  const sitemap = texts.get('sitemap.xml');
  if (sitemap !== undefined) {
    if (
      !/^<\?xml version="1\.0" encoding="UTF-8"\?>\n<urlset xmlns="http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9">\n/.test(
        sitemap
      ) ||
      !sitemap.trimEnd().endsWith('</urlset>')
    ) {
      err('sitemap.xml', 'XML の形が違う');
    }
    if (sitemap.includes('lastmod')) err('sitemap.xml', 'lastmod がある');
    const locs = [...sitemap.matchAll(/<loc>([^<]*)<\/loc>/g)].map(m => decode(m[1]));
    const want = htmlFiles.filter(f => f !== '404.html').map(urlOfFile);
    const sorted = [...locs].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
    if (locs.join('\n') !== sorted.join('\n')) err('sitemap.xml', 'URL がパスの順でない');
    if (new Set(locs).size !== locs.length) err('sitemap.xml', 'URL が重なる');
    const locSet = new Set(locs);
    const wantSet = new Set(want);
    const extra = locs.filter(u => !wantSet.has(u));
    const missing = want.filter(u => !locSet.has(u));
    if (extra.length > 0)
      err('sitemap.xml', `生成物に無い URL: ${extra.slice(0, 5).join('・')}（${extra.length}）`);
    if (missing.length > 0)
      err(
        'sitemap.xml',
        `HTML が sitemap に無い: ${missing.slice(0, 5).join('・')}（${missing.length}）`
      );
  }

  // --- robots ---
  const robots = texts.get('robots.txt');
  if (robots !== undefined && robots !== ROBOTS_TXT) err('robots.txt', '決まりの中身と違う');

  // --- llms.txt ---
  const llms = texts.get('llms.txt');
  if (llms !== undefined) {
    const words = forbiddenWordsIn(llms);
    if (words.length > 0) err('llms.txt', `出さない語がある: ${words.join('・')}`);
    for (const m of llms.matchAll(/\]\((https:\/\/[^)\s]+)\)/g)) {
      const target = internalTarget('llms.txt', m[1]);
      if (target !== null && !have.has(target)) err('llms.txt', `リンクの先が無い: ${m[1]}`);
    }
  }
  return errors;
}
