// Deno テスト（HTML の逃がし。契約書 docs/issues/issue-324-homepage.md AC-13）
import { assertEquals } from 'jsr:@std/assert@1';

import { attr, beaconAttr, esc, jsonLdScript } from './html.ts';

Deno.test('AC-13: 文字と属性で & < > " \' を逃がす', () => {
  assertEquals(esc(`a&b<c>d"e'f`), 'a&amp;b&lt;c&gt;d&quot;e&#39;f');
  assertEquals(attr('href', 'https://x.example/?a=1&b=2'), 'href="https://x.example/?a=1&amp;b=2"');
  assertEquals(attr('alt', `"><script>`), 'alt="&quot;&gt;&lt;script&gt;"');
});

Deno.test('AC-13: JSON-LD の中の </script> は \\u003c/script> になり、JSON として読める', () => {
  const html = jsonLdScript({ name: '</script><script>alert(1)</script>' });
  assertEquals(
    html,
    '<script type="application/ld+json">{"name":"\\u003c/script>\\u003cscript>alert(1)\\u003c/script>"}</script>'
  );
  const body = html.slice(html.indexOf('>') + 1, html.lastIndexOf('</script>'));
  assertEquals(JSON.parse(body), { name: '</script><script>alert(1)</script>' });
});

Deno.test('beacon の属性は一重の引用符で、JSON の " はそのまま・\' と & と < は逃がす', () => {
  assertEquals(beaconAttr({ token: 'abc123' }), `data-cf-beacon='{"token":"abc123"}'`);
  assertEquals(beaconAttr({ token: `a'b&c<d` }), `data-cf-beacon='{"token":"a&#39;b&amp;c&lt;d"}'`);
});
