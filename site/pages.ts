// ページの中身（契約書 docs/issues/issue-324-homepage.md「画面仕様」・「文言」・「このサイトのプライバシーの説明」）。
// 文は事実と出典が分かるものだけ。数・時間・住所はデータから入れ、データに無いことを文にしない（D-7）
import { CONTACT_EMAIL, SITE_NAME, type SiteConfig } from './config.ts';
import { kindLabel, type SiteData, type Spot } from './data.ts';
import { attr, esc } from './html.ts';
import { canonicalUrl, page } from './layout.ts';
import { appStoreUrl } from './links.ts';
import { type Prefecture, PREFECTURES, REGIONS } from './prefectures.ts';

export const BADGE_SRC = '/img/app-store-badge-ja.svg';
export const BADGE_ALT = 'App Store からダウンロード';
export const BADGE_HEIGHT = 48;
export const SCREEN_WIDTHS = [360, 720] as const;
/** スクショの元の縦横（App Store の 1.2.0 と同じシミュレータ。1320×2868） */
export const SCREEN_SIZE = { width: 1320, height: 2868 } as const;

/** スクショの見出し（ストアの 1.2.0 の 4 枚の見出し）と、下の1行（ストアの説明文の「できること」から） */
export const SCREENS: readonly { caption: string; note: string; alt: string }[] = [
  {
    caption: '近くの寺社が、すぐ見つかる。',
    note: '現在地のまわりの神社・お寺が候補に出るので、選べば記録が終わります。',
    alt: '地図の画面。まわりの神社とお寺のピンが並ぶ',
  },
  {
    caption: '写真を1枚。それだけ。',
    note: '参拝先で御朱印の写真を撮るだけ。参拝した日やメモも残せます。',
    alt: '御朱印を記録した直後の画面',
  },
  {
    caption: '集めるたび、地図があなたの旅になる。',
    note: '御朱印をいただくたび、訪れた県が濃くなっていきます。',
    alt: 'あゆみの画面。訪れた県が色づいた日本地図',
  },
  {
    caption: '集めた御朱印は、一冊になる。',
    note: '集めた御朱印は、めくって眺める御朱印帳に。一覧の表示にも切り替えられます。',
    alt: '御朱印帳の画面。御朱印の写真がめくれる',
  },
];

export function screenPath(n: number, w: number): string {
  return `/img/screens/0${n}-${w}.webp`;
}

export interface Assets {
  /** スクショ 8 枚が全部ある */
  screens: boolean;
  /** バッジの SVG の大きさ（無ければ null。ページは同じ形で出す） */
  badge: { width: number; height: number } | null;
}

/** <head> に足すもの（OGP の画像・JSON-LD）。build.ts が seo.ts から作って渡す */
export interface Seo {
  ogImage?: string;
  head?: string[];
}

export interface PageContext {
  config: SiteConfig;
  assets: Assets;
  data: SiteData;
  byIdx: Map<number, Spot>;
}

// --- 部品 ---

function badge(ctx: PageContext): string {
  const href = appStoreUrl(ctx.config.APP_STORE_PT);
  const size = ctx.assets.badge;
  const w = size ? ` width="${Math.round((BADGE_HEIGHT * size.width) / size.height)}"` : '';
  return `<p class="badge"><a ${attr('href', href)}><img ${attr('src', BADGE_SRC)}${w} height="${BADGE_HEIGHT}" ${attr('alt', BADGE_ALT)}></a></p>`;
}

function crumbs(items: { href: string | null; label: string }[]): string {
  const li = items.map(i =>
    i.href === null
      ? `<li aria-current="page">${esc(i.label)}</li>`
      : `<li><a ${attr('href', i.href)}>${esc(i.label)}</a></li>`
  );
  return `<nav class="crumbs" aria-label="パンくずリスト"><ol>${li.join('')}</ol></nav>`;
}

export function spotPath(s: Spot): string {
  return `/spots/${s.slug}/`;
}

export function prefecturePath(p: Prefecture): string {
  return `/prefectures/${p.slug}/`;
}

// --- 寺社 ---

export function spotTitle(s: Spot): string {
  return s.hours
    ? `${s.name}の御朱印の受付時間と場所（${s.prefecture}）｜${SITE_NAME}`
    : `${s.name}の場所と写真（${s.prefecture}）｜${SITE_NAME}`;
}

export function spotDescription(s: Spot): string {
  const head = `${s.name}（${s.prefecture}の${kindLabel(s.type)}）`;
  if (s.hours) {
    return `${head}の御朱印の受付時間は${s.hours.text}（${s.hours.yearMonth}時点・公式サイト）。住所は${s.address}。`;
  }
  const what = [
    s.photo ? '写真と地図のリンク' : '地図のリンク',
    ...(s.nearby.length > 0 ? ['近くの寺社'] : []),
  ];
  return `${head}の住所は${s.address}。${what.join('、')}をまとめています。`;
}

function photoFigure(s: Spot): string {
  const p = s.photo!;
  const license = p.licenseUrl
    ? `<a ${attr('href', p.licenseUrl)}>${esc(p.license)}</a>`
    : esc(p.license);
  return [
    '<figure class="photo">',
    `<img ${attr('src', p.url)} width="${p.width}" height="${p.height}" ${attr('alt', `${s.name}の写真`)} fetchpriority="high">`,
    `<figcaption>写真: <span class="author">${esc(p.author ?? '不明')}</span> ／ ${license} ／ <a ${attr('href', p.sourceUrl)}>元のページ</a>（Wikimedia Commons）</figcaption>`,
    '</figure>',
  ].join('\n');
}

function hoursCard(s: Spot): string {
  const h = s.hours!;
  return [
    '<section class="card">',
    '<h2>御朱印の受付時間</h2>',
    `<p class="hours-time">${esc(h.text)}</p>`,
    `<p>${esc(h.notes)}</p>`,
    `<p>出典: <a ${attr('href', h.url)}>${esc(h.host)}</a></p>`,
    '<p class="sub small">時間は変わることがあります。参拝の前に、寺社の公式の案内もご確認ください。</p>',
    '</section>',
  ].join('\n');
}

function mapCard(s: Spot): string {
  const links = [`<li><a ${attr('href', s.googleMapsUrl)}>Google マップで開く</a></li>`];
  if (s.osmUrl) links.push(`<li><a ${attr('href', s.osmUrl)}>OpenStreetMap で開く</a></li>`);
  return [
    '<section class="card">',
    '<h2>住所と地図</h2>',
    `<p>${esc(s.address)}</p>`,
    `<ul class="links">${links.join('')}</ul>`,
    '</section>',
  ].join('\n');
}

function nearbySection(s: Spot, ctx: PageContext): string | null {
  if (s.nearby.length === 0) return null;
  const items = s.nearby.map(i => {
    const n = ctx.byIdx.get(i)!;
    return `<li><a ${attr('href', spotPath(n))}>${esc(n.name)}</a><span class="sub small">${kindLabel(n.type)}</span></li>`;
  });
  return [
    '<section>',
    '<h2>近くの寺社</h2>',
    `<ul class="nearby">${items.join('')}</ul>`,
    '</section>',
  ].join('\n');
}

function appSection(ctx: PageContext): string {
  return [
    '<section class="card app">',
    '<h2>参拝の記録を、写真1枚で日本地図に。</h2>',
    `<p>${esc(SITE_NAME)}（iPhone 用・無料）</p>`,
    badge(ctx),
    '</section>',
  ].join('\n');
}

function aboutSection(s: Spot): string {
  const parts = ['住所と位置は、御朱印さんぽの地図の寺社のデータです。'];
  if (s.photo)
    parts.push('写真は Wikimedia Commons から、撮影者とライセンスは写真の下に書いています。');
  if (s.hours) parts.push(`受付時間は寺社の公式サイトの${s.hours.yearMonth}時点の案内です。`);
  return [
    '<section>',
    '<h2>このページの情報</h2>',
    `<p class="sub small">${esc(parts.join(''))}</p>`,
    '</section>',
  ].join('\n');
}

export function spotMain(s: Spot, ctx: PageContext): string {
  return [
    crumbs([
      { href: '/', label: 'トップ' },
      { href: prefecturePath(s.pref), label: s.prefecture },
      { href: null, label: s.name },
    ]),
    `<h1>${esc(s.name)}</h1>`,
    `<p class="kind">${esc(s.prefecture)}・${kindLabel(s.type)}</p>`,
    ...(s.photo ? [photoFigure(s)] : []),
    ...(s.hours ? [hoursCard(s)] : []),
    mapCard(s),
    ...[nearbySection(s, ctx)].filter((x): x is string => x !== null),
    appSection(ctx),
    aboutSection(s),
  ].join('\n');
}

export function spotPage(s: Spot, ctx: PageContext, seo: Seo = {}): string {
  return page(
    { path: spotPath(s), title: spotTitle(s), description: spotDescription(s), ...seo },
    spotMain(s, ctx),
    ctx.config
  );
}

// --- 都道府県 ---

export function prefectureCounts(p: Prefecture, data: SiteData): { all: number; pages: number } {
  const spots = data.spots.filter(s => s.prefecture === p.name);
  return { all: spots.length, pages: spots.filter(s => s.hasPage).length };
}

export function prefectureTitle(p: Prefecture, data: SiteData): string {
  return `${p.name}の神社・お寺 ${prefectureCounts(p, data).all}か所｜${SITE_NAME}`;
}

export function prefectureDescription(p: Prefecture, data: SiteData): string {
  const c = prefectureCounts(p, data);
  return `御朱印さんぽの地図にある${p.name}の神社・お寺 ${c.all}か所の一覧。うち${c.pages}か所は写真と地図のページがあります。`;
}

function spotRow(s: Spot): string {
  const name = s.hasPage
    ? `<a class="name" ${attr('href', spotPath(s))}>${esc(s.name)}</a>`
    : `<span class="name">${esc(s.name)}</span>`;
  const meta = `<span class="meta">${kindLabel(s.type)}・${esc(s.address)}</span>`;
  const gmap = s.hasPage
    ? ''
    : `<a class="gmap" ${attr('href', s.googleMapsUrl)}>Google マップ</a>`;
  return `<li>${name}${meta}${gmap}</li>`;
}

export function prefectureMain(p: Prefecture, data: SiteData): string {
  const spots = data.spots.filter(s => s.prefecture === p.name);
  return [
    crumbs([
      { href: '/', label: 'トップ' },
      { href: null, label: p.name },
    ]),
    `<h1>${esc(p.name)}の神社・お寺</h1>`,
    `<p class="sub">${esc(prefectureDescription(p, data))}</p>`,
    `<ul class="spots">${spots.map(spotRow).join('\n')}</ul>`,
  ].join('\n');
}

export function prefecturePage(p: Prefecture, ctx: PageContext, seo: Seo = {}): string {
  return page(
    {
      path: prefecturePath(p),
      title: prefectureTitle(p, ctx.data),
      description: prefectureDescription(p, ctx.data),
      ...seo,
    },
    prefectureMain(p, ctx.data),
    ctx.config
  );
}

// --- トップ ---

export const TOP_TITLE = `${SITE_NAME}｜参拝したら、写真1枚で日本地図に。`;
export const TOP_DESCRIPTION =
  '御朱印さんぽは、いただいた御朱印の写真と参拝の記録を、地図に残していくiPhoneアプリです。写真を撮って、寺社を選ぶだけ。広告はありません。';

function screensSection(): string {
  const figures = SCREENS.map((s, i) => {
    const n = i + 1;
    const h = Math.round((SCREEN_WIDTHS[0] * SCREEN_SIZE.height) / SCREEN_SIZE.width);
    const srcset = SCREEN_WIDTHS.map(w => `${screenPath(n, w)} ${w}w`).join(', ');
    return [
      '<li><figure>',
      `<img ${attr('src', screenPath(n, SCREEN_WIDTHS[0]))} ${attr('srcset', srcset)} sizes="(min-width: 768px) 240px, 50vw" width="${SCREEN_WIDTHS[0]}" height="${h}" ${attr('alt', s.alt)} loading="lazy">`,
      `<figcaption>${esc(s.caption)}<span>${esc(s.note)}</span></figcaption>`,
      '</figure></li>',
    ].join('');
  });
  return [
    '<section>',
    '<h2>できること</h2>',
    `<ul class="shots">${figures.join('\n')}</ul>`,
    '</section>',
  ].join('\n');
}

function prefecturesSection(): string {
  const regions = REGIONS.map(r => {
    const links = PREFECTURES.filter(p => p.region === r).map(
      p => `<li><a ${attr('href', prefecturePath(p))}>${esc(p.name)}</a></li>`
    );
    return `<h3>${esc(r)}</h3>\n<ul class="chips">${links.join('')}</ul>`;
  });
  return ['<section>', '<h2>都道府県から探す</h2>', ...regions, '</section>'].join('\n');
}

export function topMain(ctx: PageContext): string {
  return [
    '<section class="hero">',
    '<h1>参拝したら、写真1枚で日本地図に。</h1>',
    '<p class="lead">家にある御朱印帳も、まとめて地図に。</p>',
    badge(ctx),
    '<p>御朱印さんぽは、いただいた御朱印の写真と参拝の記録を、地図に残していくアプリです。写真を撮って、寺社を選ぶだけ。</p>',
    '<p>iPhone 用・無料・広告はありません。</p>',
    '</section>',
    ...(ctx.assets.screens ? [screensSection()] : []),
    prefecturesSection(),
  ].join('\n');
}

export function topPage(ctx: PageContext, seo: Seo = {}): string {
  return page(
    { path: '/', title: TOP_TITLE, description: TOP_DESCRIPTION, wide: true, ...seo },
    topMain(ctx),
    ctx.config
  );
}

// --- このサイトのプライバシー ---

export const SITE_PRIVACY_TITLE = `このサイトのプライバシー｜${SITE_NAME}`;
export const SITE_PRIVACY_DESCRIPTION =
  '御朱印さんぽのホームページ goshuinsanpo.com での計測（Cloudflare Web Analytics）と、写真の配信、外のサイトへのリンクについて。';
/** 最終更新日（テンプレートに書いた固定の文字。生成した日を入れない） */
export const SITE_PRIVACY_UPDATED = '2026年10月10日';

export function sitePrivacyMain(): string {
  return [
    '<h1>このサイトのプライバシー</h1>',
    '<p>このページは、御朱印さんぽのホームページ goshuinsanpo.com（このサイト）についての説明です。アプリについては、<a href="/legal/privacy.html">アプリのプライバシーポリシー</a>をご覧ください。</p>',
    '<h2>計測</h2>',
    '<p>このサイトでは、Cloudflare, Inc. の Cloudflare Web Analytics で、見られたページ、どこから来たか（参照元）、ブラウザと OS と端末の種類、国、表示の速さを数えています。Cookie も、ブラウザの保存領域（localStorage など）も使いません。広告には使いません。</p>',
    '<p>Cloudflare での扱いは、<a href="https://www.cloudflare.com/privacypolicy/">Cloudflare のプライバシーポリシー</a>のとおりです。</p>',
    '<p>アプリのプライバシーポリシーにある「Cookieや行動トラッキング技術を使用しません」は、アプリについての説明です。このサイトでの計測は、このページのとおりです。</p>',
    '<h2>写真</h2>',
    '<p>寺社の写真は、Cloudflare のサービス（img.goshuinsanpo.com）から配信しています。</p>',
    '<h2>外のサイトへのリンク</h2>',
    '<p>App Store・Google マップ・OpenStreetMap・Wikimedia Commons・寺社の公式サイトは、それぞれのサイトのポリシーによります。App Store へのリンクには、このサイトから来たことを表す印（ct=web）が付きます。運営者は Apple の App Analytics で、その数の合計だけを見ます。</p>',
    '<h2>お問い合わせ</h2>',
    `<p>アプリのプライバシーポリシーと同じメールアドレスです: <a ${attr('href', `mailto:${CONTACT_EMAIL}`)}>${esc(CONTACT_EMAIL)}</a></p>`,
    `<p class="sub small">最終更新日: ${SITE_PRIVACY_UPDATED}</p>`,
  ].join('\n');
}

export function sitePrivacyPage(ctx: PageContext, seo: Seo = {}): string {
  return page(
    {
      path: '/legal/site.html',
      title: SITE_PRIVACY_TITLE,
      description: SITE_PRIVACY_DESCRIPTION,
      ...seo,
    },
    sitePrivacyMain(),
    ctx.config
  );
}

// --- 404 ---

export function notFoundPage(ctx: PageContext): string {
  return page(
    {
      path: null,
      title: `ページが見つかりませんでした｜${SITE_NAME}`,
      description: null,
      noindex: true,
    },
    ['<h1>ページが見つかりませんでした。</h1>', '<p><a href="/">トップへ戻る</a></p>'].join('\n'),
    ctx.config
  );
}

// --- 法務の2ページ（docs/legal の写し） ---

export const LEGAL_DESCRIPTIONS = {
  privacy:
    '御朱印さんぽ（アプリ）のプライバシーポリシー。集める情報、使い方、保存する場所、第三者への提供について。',
  terms: '御朱印さんぽ（アプリ）の利用規約。サービスの内容、ユーザーコンテンツ、禁止事項について。',
} as const;

/** `</head>` の直前に canonical と description の2行を差し込む。ほかは1バイトも変えない */
export function legalCopy(src: string, path: string, description: string, file: string): string {
  const lines = src.split('\n');
  const at = lines.map(l => l.trim()).indexOf('</head>');
  if (at < 0 || lines.filter(l => l.includes('</head>')).length !== 1) {
    throw new Error(`${file}: </head> だけの行がちょうど1つでない`);
  }
  const indent = lines[at].slice(0, lines[at].indexOf('<')) + '  ';
  const added = [
    `${indent}<link rel="canonical" ${attr('href', canonicalUrl(path))}>`,
    `${indent}<meta name="description" ${attr('content', description)}>`,
  ];
  return [...lines.slice(0, at), ...added, ...lines.slice(at)].join('\n');
}
