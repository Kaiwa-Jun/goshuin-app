// 検索と AI のためのもの（契約書 docs/issues/issue-324-homepage.md D-7・D-13・D-14・「JSON-LD の形」）:
// OGP の画像・JSON-LD・sitemap.xml・robots.txt・llms.txt。事実と出典が分かることだけを書く
import { SITE_NAME, SITE_ORIGIN } from './config.ts';
import { type SiteData, type Spot } from './data.ts';
import { appStoreUrl } from './links.ts';
import { prefectureCounts, prefecturePath, spotPath } from './pages.ts';
import { type Prefecture, PREFECTURES } from './prefectures.ts';

export const OGP_IMAGE = `${SITE_ORIGIN}/img/ogp.png`;
const SCHEMA = 'https://schema.org';

/** 寺社の og:image は写真（無ければサイトの画像） */
export function spotOgImage(s: Spot): string {
  return s.photo?.url ?? OGP_IMAGE;
}

/** schema.org に神社の型は無いので、神社は PlaceOfWorship・寺は BuddhistTemple */
export function spotJsonLd(s: Spot): Record<string, unknown> {
  const out: Record<string, unknown> = {
    '@context': SCHEMA,
    '@type': s.type === 'shrine' ? 'PlaceOfWorship' : 'BuddhistTemple',
    name: s.name,
    url: SITE_ORIGIN + spotPath(s),
    address: {
      '@type': 'PostalAddress',
      addressCountry: 'JP',
      addressRegion: s.prefecture,
      streetAddress: s.address.slice(s.prefecture.length),
    },
  };
  if (s.photo) {
    const image: Record<string, unknown> = { '@type': 'ImageObject', contentUrl: s.photo.url };
    if (s.photo.author !== null) image.creditText = s.photo.author;
    if (s.photo.licenseUrl !== null) image.license = s.photo.licenseUrl;
    image.acquireLicensePage = s.photo.sourceUrl;
    out.image = image;
  }
  // 座標を確かめた寺社だけ（#292）。御朱印の受付時間は入れない（D-14）
  if (s.coordsVerified) {
    out.geo = { '@type': 'GeoCoordinates', latitude: s.lat, longitude: s.lng };
  }
  return out;
}

export function breadcrumbJsonLd(items: { name: string; path: string }[]): Record<string, unknown> {
  return {
    '@context': SCHEMA,
    '@type': 'BreadcrumbList',
    itemListElement: items.map((it, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: it.name,
      item: SITE_ORIGIN + it.path,
    })),
  };
}

export function spotBreadcrumb(s: Spot): Record<string, unknown> {
  return breadcrumbJsonLd([
    { name: 'トップ', path: '/' },
    { name: s.prefecture, path: prefecturePath(s.pref) },
    { name: s.name, path: spotPath(s) },
  ]);
}

export function prefectureBreadcrumb(p: Prefecture): Record<string, unknown> {
  return breadcrumbJsonLd([
    { name: 'トップ', path: '/' },
    { name: p.name, path: prefecturePath(p) },
  ]);
}

export function topJsonLd(): Record<string, unknown>[] {
  return [
    {
      '@context': SCHEMA,
      '@type': 'WebSite',
      name: SITE_NAME,
      url: `${SITE_ORIGIN}/`,
      inLanguage: 'ja',
    },
    {
      '@context': SCHEMA,
      '@type': 'MobileApplication',
      name: SITE_NAME,
      operatingSystem: 'iOS',
      applicationCategory: 'LifestyleApplication',
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'JPY' },
      url: appStoreUrl(null),
    },
  ];
}

// --- sitemap・robots・llms ---

/** 生成物のパス（dist からの相対）→ サイトの URL。index.html は / で終わる形 */
export function urlOfFile(path: string): string {
  const p =
    path === 'index.html'
      ? ''
      : path.endsWith('/index.html')
        ? path.slice(0, -'index.html'.length)
        : path;
  return `${SITE_ORIGIN}/${p}`;
}

/** sitemap に入れる（404.html を除く HTML 全部・URL の文字コードの順・lastmod なし） */
export function sitemapXml(htmlPaths: string[]): string {
  const urls = htmlPaths
    .filter(p => p !== '404.html')
    .map(urlOfFile)
    .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...urls.map(u => `<url><loc>${u}</loc></url>`),
    '</urlset>',
    '',
  ].join('\n');
}

export const ROBOTS_TXT = `User-agent: *\nAllow: /\n\nSitemap: ${SITE_ORIGIN}/sitemap.xml\n`;

export function llmsTxt(data: SiteData): string {
  const pages = data.spots.filter(s => s.hasPage).length;
  const withHours = data.spots.filter(s => s.hours !== null).length;
  const prefs = PREFECTURES.map(p => {
    const c = prefectureCounts(p, data);
    return `- [${p.name}](${SITE_ORIGIN}${prefecturePath(p)}): ${c.all}か所（ページ ${c.pages}）`;
  });
  return [
    `# ${SITE_NAME}`,
    '',
    `> ${SITE_NAME}は、いただいた御朱印の写真と参拝の記録を、地図に残していく iPhone アプリ（無料）です。このサイトには、全国の神社・お寺 ${pages}か所の写真と地図のページがあり、うち ${withHours}か所は御朱印の受付時間（寺社の公式サイトの案内と出典）を載せています。`,
    '',
    '## アプリ',
    '',
    `- [${SITE_NAME}](${SITE_ORIGIN}/): アプリの紹介`,
    `- [App Store](${appStoreUrl(null)}): ${SITE_NAME}（iPhone 用・無料）`,
    '',
    '## 都道府県ごとの神社・お寺',
    '',
    ...prefs,
    '',
    '## ポリシー',
    '',
    `- [アプリのプライバシーポリシー](${SITE_ORIGIN}/legal/privacy.html)`,
    `- [利用規約](${SITE_ORIGIN}/legal/terms.html)`,
    `- [このサイトのプライバシー](${SITE_ORIGIN}/legal/site.html)`,
    '',
  ].join('\n');
}
