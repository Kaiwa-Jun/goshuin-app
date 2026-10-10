// サイト全体を作る（ファイルに書く前の Map）。同じ入力から同じ生成物（日時・環境の値・乱数を入れない。D-21）。
// 契約書: docs/issues/issue-324-homepage.md D-5・D-6・D-19・D-21・「ページと URL」
import type { SiteConfig } from './config.ts';
import type { SiteData } from './data.ts';
import {
  type Assets,
  LEGAL_DESCRIPTIONS,
  legalCopy,
  notFoundPage,
  type PageContext,
  prefecturePage,
  sitePrivacyPage,
  spotPage,
  topPage,
} from './pages.ts';
import { jsonLdScript } from './html.ts';
import { PREFECTURES } from './prefectures.ts';
import {
  llmsTxt,
  OGP_IMAGE,
  prefectureBreadcrumb,
  ROBOTS_TXT,
  sitemapXml,
  spotBreadcrumb,
  spotJsonLd,
  spotOgImage,
  topJsonLd,
} from './seo.ts';

export type { Assets } from './pages.ts';

/** 出さない語（法務の2ページを除く全部のページと llms.txt。D-19） */
export const FORBIDDEN_WORDS: readonly string[] = [
  'コレクション',
  '攻略',
  'ランキング',
  'ランク',
  '制覇',
  '紙の代わり',
  'デジタル御朱印',
  'プラス',
  '980円',
  'Google Play',
];

/**
 * 撮影者の名前（ライセンスの表記。名前を変えられない）を除いた文字で、出さない語を探す。
 * 名前は <span class="author"> と JSON-LD の creditText にだけ書く
 */
export function forbiddenWordsIn(text: string): string[] {
  const rest = text
    .replace(/<span class="author">[^<]*<\/span>/g, '')
    .replace(/"creditText":"(?:[^"\\]|\\.)*"/g, '');
  return FORBIDDEN_WORDS.filter(w => rest.includes(w));
}

export interface LegalSources {
  privacy: string;
  terms: string;
}

export const LEGAL_FILES = {
  privacy: { src: 'docs/legal/privacy.html', out: 'legal/privacy.html' },
  terms: { src: 'docs/legal/terms.html', out: 'legal/terms.html' },
} as const;

export function pageContext(data: SiteData, config: SiteConfig, assets: Assets): PageContext {
  return { data, config, assets, byIdx: new Map(data.spots.map(s => [s.idx, s])) };
}

/** 生成物（dist からの相対パス → 中身）。HTML・sitemap.xml・robots.txt・llms.txt。site/static の写しは含まない */
export function renderSite(
  data: SiteData,
  config: SiteConfig,
  assets: Assets,
  legal: LegalSources
): Map<string, string> {
  const ctx = pageContext(data, config, assets);
  const files = new Map<string, string>();
  const og = { ogImage: OGP_IMAGE };
  files.set('index.html', topPage(ctx, { ...og, head: topJsonLd().map(jsonLdScript) }));
  for (const p of PREFECTURES) {
    files.set(
      `prefectures/${p.slug}/index.html`,
      prefecturePage(p, ctx, { ...og, head: [jsonLdScript(prefectureBreadcrumb(p))] })
    );
  }
  for (const s of data.spots) {
    if (!s.hasPage) continue;
    files.set(
      `spots/${s.slug}/index.html`,
      spotPage(s, ctx, {
        ogImage: spotOgImage(s),
        head: [jsonLdScript(spotJsonLd(s)), jsonLdScript(spotBreadcrumb(s))],
      })
    );
  }
  for (const k of ['privacy', 'terms'] as const) {
    const f = LEGAL_FILES[k];
    files.set(f.out, legalCopy(legal[k], `/${f.out}`, LEGAL_DESCRIPTIONS[k], f.src));
  }
  files.set('legal/site.html', sitePrivacyPage(ctx, og));
  files.set('404.html', notFoundPage(ctx));
  const html = [...files.keys()].filter(p => p.endsWith('.html'));
  files.set('sitemap.xml', sitemapXml(html));
  files.set('robots.txt', ROBOTS_TXT);
  files.set('llms.txt', llmsTxt(data));
  return files;
}
