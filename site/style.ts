// 見た目（契約書 docs/issues/issue-324-homepage.md D-17）。色と余白はアプリのトークン（src/theme）から作る。
// 字の大きさは docs/design/DESIGN.md の表（h1 28/700・h2 22/700・h3 18/600・本文 16/400・小 14・注 12）。
// 文字はシステムのフォント（Web フォントを読まない）。ブランドの橙は字に使わず <header> の上の線だけ
import { colors } from '../src/theme/colors.ts';
import { borderRadius, spacing } from '../src/theme/spacing.ts';

const px = (n: number) => `${n}px`;

/** CSS の変数（トークンの名前 → 値） */
export const TOKENS: Record<string, string> = {
  '--washi': colors.washi,
  '--sumi': colors.sumi,
  '--washi-sub': colors.washiSub,
  '--washi-shade': colors.washiShade,
  '--seal': colors.seal,
  '--brand': colors.primary[500],
  '--card': colors.white,
  '--space-xs': px(spacing.xs),
  '--space-sm': px(spacing.sm),
  '--space-md': px(spacing.md),
  '--space-lg': px(spacing.lg),
  '--space-2xl': px(spacing['2xl']),
  '--space-3xl': px(spacing['3xl']),
  '--space-5xl': px(spacing['5xl']),
  '--radius-lg': px(borderRadius.lg),
  '--radius-xl': px(borderRadius.xl),
  '--radius-full': px(borderRadius.full),
};

/** 中身の幅（寺社・都道府県・このサイトのプライバシー / トップ） */
export const NARROW_PX = 720;
export const WIDE_PX = 1080;

const FONT =
  '-apple-system, BlinkMacSystemFont, "Hiragino Sans", "Hiragino Kaku Gothic ProN", "Yu Gothic", Meiryo, sans-serif';

const RULES = `
*,*::before,*::after{box-sizing:border-box}
html{-webkit-text-size-adjust:100%;text-size-adjust:100%}
body{margin:0;background:var(--washi);color:var(--sumi);font-family:${FONT};font-size:16px;font-weight:400;line-height:1.7;overflow-wrap:anywhere}
a{color:var(--seal);text-underline-offset:.2em}
img{max-width:100%}
.wrap{max-width:${NARROW_PX}px;margin:0 auto;padding:0 var(--space-lg)}
.wide .wrap{max-width:${WIDE_PX}px}
header{border-top:4px solid var(--brand);background:var(--washi)}
header .wrap{display:flex;align-items:center;min-height:56px}
.brand{display:inline-flex;align-items:center;gap:var(--space-sm);padding:var(--space-sm) 0;color:var(--sumi);font-size:18px;font-weight:700;line-height:24px;text-decoration:none}
.brand img{display:block;width:28px;height:28px;border-radius:6px}
main{display:block;padding-bottom:var(--space-5xl)}
h1{font-size:28px;font-weight:700;line-height:34px;margin:var(--space-lg) 0 var(--space-sm);text-wrap:balance}
h2{font-size:22px;font-weight:700;line-height:28px;margin:var(--space-3xl) 0 var(--space-md)}
h3{font-size:18px;font-weight:600;line-height:24px;margin:var(--space-2xl) 0 var(--space-sm)}
p{margin:0 0 var(--space-md)}
ul,ol{margin:0;padding:0;list-style:none}
.sub{color:var(--washi-sub)}
.small{font-size:14px;line-height:20px}
.crumbs ol{display:flex;flex-wrap:wrap;gap:0 var(--space-sm);padding-top:var(--space-md);font-size:14px;line-height:20px;color:var(--washi-sub)}
.crumbs li+li::before{content:"›";margin-right:var(--space-sm)}
.crumbs a{display:inline-block;padding:2px 0}
.kind{color:var(--washi-sub);margin:0 0 var(--space-lg)}
.card{background:var(--card);border:1px solid var(--washi-shade);border-radius:var(--radius-lg);padding:var(--space-lg);margin:var(--space-lg) 0}
.card h2{margin-top:0}
.photo{margin:0 0 var(--space-lg)}
.photo img{display:block;width:100%;height:auto;border-radius:var(--radius-lg);background:var(--washi-shade)}
.photo figcaption{margin-top:var(--space-sm);font-size:14px;line-height:22px;color:var(--washi-sub)}
.photo figcaption a{display:inline-block}
.hours-time{font-size:22px;font-weight:700;line-height:28px;margin-bottom:var(--space-sm)}
.links li{margin:var(--space-xs) 0}
.links a{display:inline-block;padding:var(--space-xs) 0}
.nearby li{display:flex;flex-wrap:wrap;align-items:baseline;gap:var(--space-sm);padding:var(--space-sm) 0;border-bottom:1px solid var(--washi-shade)}
.nearby a{display:inline-block;padding:2px 0}
.app{text-align:center}
.app h2{margin-top:0}
.badge{margin:var(--space-2xl) 0}
.badge a{display:inline-block;line-height:0}
.badge img{display:block;height:48px;width:auto}
.lead{font-size:18px;line-height:28px;margin-bottom:0}
.hero{padding:var(--space-sm) 0 0}
.hero .badge{margin:var(--space-2xl) 0}
.shots{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:var(--space-lg);margin:var(--space-lg) 0 0}
.shots figure{margin:0}
.shots img{display:block;width:100%;height:auto;aspect-ratio:1320/2868;border-radius:var(--radius-xl);background:var(--washi-shade)}
.shots figcaption{margin-top:var(--space-sm);font-weight:600;line-height:24px}
.shots figcaption span{display:block;font-weight:400;font-size:14px;line-height:20px;color:var(--washi-sub);margin-top:var(--space-xs)}
.chips{display:flex;flex-wrap:wrap;gap:var(--space-sm)}
.chips a{display:inline-block;padding:var(--space-sm) var(--space-md);min-width:44px;background:var(--card);border:1px solid var(--washi-shade);border-radius:var(--radius-full);text-decoration:none;line-height:20px}
.spots li{padding:var(--space-md) 0;border-bottom:1px solid var(--washi-shade)}
.spots .name{font-weight:600}
.spots a.name{display:inline-block;padding:2px 0}
.spots .meta{display:block;font-size:14px;line-height:20px;color:var(--washi-sub)}
.spots .gmap{display:inline-block;margin-top:var(--space-xs);padding:2px 0;font-size:14px;line-height:20px}
footer{border-top:1px solid var(--washi-shade);padding:var(--space-2xl) 0 var(--space-3xl);font-size:14px;line-height:20px;color:var(--washi-sub)}
footer ul{display:flex;flex-wrap:wrap;gap:var(--space-xs) var(--space-lg);margin-bottom:var(--space-lg)}
footer a{display:inline-block;padding:var(--space-xs) 0}
footer p{margin:0 0 var(--space-sm)}
@media (min-width:768px){.shots{grid-template-columns:repeat(4,minmax(0,1fr))}}
`;

export const CSS =
  `:root{${Object.entries(TOKENS)
    .map(([k, v]) => `${k}:${v}`)
    .join(';')}}` + RULES.replace(/\n/g, '');
