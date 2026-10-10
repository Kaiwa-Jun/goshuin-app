// 生成した HTML を読む小さな道具（検査 check.ts とテストで使う）。
// 生成器が書く形（属性は二重引用符・一重引用符）だけを読めればよい。外の HTML の全部は読まない

const NAMED: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  copy: '©',
};

/** 文字参照を戻す */
export function decode(s: string): string {
  return s.replace(/&(#x[0-9a-fA-F]+|#\d+|[a-zA-Z]+);/g, (m, ref: string) => {
    if (ref.startsWith('#x')) return String.fromCodePoint(parseInt(ref.slice(2), 16));
    if (ref.startsWith('#')) return String.fromCodePoint(Number(ref.slice(1)));
    return NAMED[ref] ?? m;
  });
}

export interface Tag {
  name: string;
  /** 属性（値は文字参照を戻したもの。値の無い属性は ''） */
  attrs: Record<string, string>;
  /** 元の文字 */
  raw: string;
  /** 文字の中の位置 */
  index: number;
}

const ATTR = /([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g;

function parseAttrs(s: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of s.matchAll(ATTR)) {
    out[m[1].toLowerCase()] = decode(m[2] ?? m[3] ?? m[4] ?? '');
  }
  return out;
}

/** 開始タグを全部（script と style の中は読まない） */
export function tags(html: string, name?: string): Tag[] {
  const body = blankRawText(html);
  const out: Tag[] = [];
  for (const m of body.matchAll(/<([a-zA-Z][a-zA-Z0-9-]*)(\s[^>]*)?>/g)) {
    const tag = m[1].toLowerCase();
    if (name && tag !== name) continue;
    out.push({ name: tag, attrs: parseAttrs(m[2] ?? ''), raw: m[0], index: m.index });
  }
  return out;
}

/** script と style の中身を同じ長さの空白にする（位置を変えずにタグを探すため） */
function blankRawText(html: string): string {
  return html.replace(
    /(<(script|style)\b[^>]*>)([\s\S]*?)(<\/\2>)/gi,
    (_m, open: string, _t: string, inner: string, close: string) =>
      open + ' '.repeat(inner.length) + close
  );
}

/** 要素の中の HTML（最初の1つ。入れ子の同じ要素は考えない） */
export function inner(html: string, name: string, from = 0): string | null {
  const re = new RegExp(`<${name}\\b[^>]*>([\\s\\S]*?)</${name}>`, 'i');
  const m = re.exec(html.slice(from));
  return m ? m[1] : null;
}

/** 要素の中の HTML（全部） */
export function inners(html: string, name: string): string[] {
  const re = new RegExp(`<${name}\\b[^>]*>([\\s\\S]*?)</${name}>`, 'gi');
  return [...html.matchAll(re)].map(m => m[1]);
}

/** タグを除いた文字（文字参照を戻し、空白を1つにまとめる） */
export function text(html: string): string {
  return decode(
    blankRawText(html)
      .replace(/<[^>]*>/g, ' ')
      .replace(/\s+/g, ' ')
  ).trim();
}

/** `<script type="application/ld+json">` の中身 */
export function jsonLdBlocks(html: string): string[] {
  return [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map(
    m => m[1]
  );
}

/** `<meta name|property="key" content="…">` の content（全部） */
export function metaContents(html: string, key: string): string[] {
  return tags(html, 'meta')
    .filter(t => t.attrs.name === key || t.attrs.property === key)
    .map(t => t.attrs.content ?? '');
}

/** href・src・srcset に書かれた URL（srcset は記述子を除く） */
export function linkTargets(html: string): { attr: string; url: string; tag: string }[] {
  const out: { attr: string; url: string; tag: string }[] = [];
  for (const t of tags(html)) {
    for (const a of ['href', 'src']) {
      if (t.attrs[a] !== undefined) out.push({ attr: a, url: t.attrs[a], tag: t.name });
    }
    if (t.attrs.srcset !== undefined) {
      for (const part of t.attrs.srcset.split(',')) {
        const url = part.trim().split(/\s+/)[0];
        if (url) out.push({ attr: 'srcset', url, tag: t.name });
      }
    }
  }
  return out;
}
