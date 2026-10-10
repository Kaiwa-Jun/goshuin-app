// ページの外側（<head>・<header>・<footer>・計測の beacon）。契約書 docs/issues/issue-324-homepage.md
// D-7・D-15・D-17・「文言」の足もと・「画面仕様」の共通
import { ISSUES_URL, SITE_NAME, SITE_ORIGIN, type SiteConfig } from './config.ts';
import { attr, beaconAttr, esc } from './html.ts';
import { CSS } from './style.ts';

export const BEACON_SRC = 'https://static.cloudflareinsights.com/beacon.min.js';

/** Apple の日本語の商標の表記（Apple Inc.・App Store・サービスマーク を含む） */
export const APPLE_TRADEMARK =
  'Apple、Apple のロゴ、iPhone は、米国およびその他の国や地域で登録された Apple Inc. の商標です。App Store は Apple Inc. のサービスマークです。';

export interface PageMeta {
  /** サイトの中のパス（`/`・`/spots/tokyo-002/`・`/legal/site.html` など）。null は 404 */
  path: string | null;
  title: string;
  description: string | null;
  /** <head> の最後に足す HTML（JSON-LD など） */
  head?: string[];
  /** トップは中身の幅を 1080px まで */
  wide?: boolean;
  noindex?: boolean;
}

export function canonicalUrl(path: string): string {
  return SITE_ORIGIN + path;
}

function headTags(meta: PageMeta): string[] {
  const out = [
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    `<title>${esc(meta.title)}</title>`,
  ];
  if (meta.description !== null)
    out.push(`<meta ${attr('name', 'description')} ${attr('content', meta.description)}>`);
  if (meta.noindex) out.push('<meta name="robots" content="noindex">');
  if (meta.path !== null)
    out.push(`<link rel="canonical" ${attr('href', canonicalUrl(meta.path))}>`);
  out.push(
    '<link rel="icon" href="/favicon.png" type="image/png">',
    '<link rel="apple-touch-icon" href="/apple-touch-icon.png">',
    `<style>${CSS}</style>`
  );
  out.push(...(meta.head ?? []));
  return out;
}

function header(): string {
  return [
    '<header>',
    '<div class="wrap">',
    `<a class="brand" href="/"><img src="/favicon.png" width="28" height="28" alt="">${esc(SITE_NAME)}</a>`,
    '</div>',
    '</header>',
  ].join('\n');
}

function footer(): string {
  const links: [string, string][] = [
    ['/legal/privacy.html', 'アプリのプライバシーポリシー'],
    ['/legal/terms.html', '利用規約'],
    ['/legal/site.html', 'このサイトのプライバシー'],
    [ISSUES_URL, 'お問い合わせ（GitHub Issues）'],
  ];
  return [
    '<footer>',
    '<div class="wrap">',
    '<ul>',
    ...links.map(([href, label]) => `<li><a ${attr('href', href)}>${esc(label)}</a></li>`),
    '</ul>',
    '<p>寺社の写真: Wikimedia Commons（撮影者とライセンスは各ページ）</p>',
    `<p>${esc(APPLE_TRADEMARK)}</p>`,
    `<p>© 2026 ${esc(SITE_NAME)}</p>`,
    '</div>',
    '</footer>',
  ].join('\n');
}

/** Cloudflare Web Analytics の beacon（token が null なら出さない） */
export function beacon(config: SiteConfig): string | null {
  if (config.CF_BEACON_TOKEN === null) return null;
  return `<script defer ${attr('src', BEACON_SRC)} ${beaconAttr({ token: config.CF_BEACON_TOKEN })}></script>`;
}

/** ページ全体。main は中身の HTML */
export function page(meta: PageMeta, main: string, config: SiteConfig): string {
  const b = beacon(config);
  return [
    '<!doctype html>',
    '<html lang="ja">',
    '<head>',
    ...headTags(meta),
    '</head>',
    `<body${meta.wide ? ' class="wide"' : ''}>`,
    header(),
    '<main>',
    '<div class="wrap">',
    main,
    '</div>',
    '</main>',
    footer(),
    ...(b ? [b] : []),
    '</body>',
    '</html>',
    '',
  ].join('\n');
}
