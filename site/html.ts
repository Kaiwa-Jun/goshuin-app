// HTML の逃がし（契約書 docs/issues/issue-324-homepage.md AC-13・D-14・D-15）

const ENTITIES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

/** 文字と二重引用符の属性の値に使う */
export function esc(s: string): string {
  return s.replace(/[&<>"']/g, c => ENTITIES[c]);
}

/** `name="値"`（値は逃がす） */
export function attr(name: string, value: string): string {
  return `${name}="${esc(value)}"`;
}

/** JSON-LD の script。中の `<` は `<` にして `</script>` で切れないようにする */
export function jsonLdScript(data: unknown): string {
  const json = JSON.stringify(data).replace(/</g, '\\u003c');
  return `<script type="application/ld+json">${json}</script>`;
}

/**
 * Cloudflare の配る snippet の形のまま、一重の引用符の属性に JSON を入れる（`"` は逃がさない）。
 * 一重の引用符の中で意味を持つ `'` と、`&` `<` `>` だけを逃がす
 */
export function beaconAttr(data: { token: string }): string {
  const json = JSON.stringify(data).replace(/[&<>']/g, c => ENTITIES[c]);
  return `data-cf-beacon='${json}'`;
}
