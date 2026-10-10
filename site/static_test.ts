// Deno テスト（素材とワークフロー。契約書 docs/issues/issue-324-homepage.md AC-36・AC-37）
// スクショ・バッジ・OGP の画像はリーダーが入れる。まだ無い間は、そのテストを「ignored」にする（合格にしない）
import { assert, assertEquals } from 'jsr:@std/assert@1';

import { BADGE_FILE, ICON_FILES, OGP_FILE, SCREEN_FILES, STATIC_DIR } from './assets.ts';
import { REPO, readRepo } from './fixtures/load.ts';

const exists = (rel: string) => {
  try {
    Deno.statSync(new URL(rel, REPO));
    return true;
  } catch {
    return false;
  }
};
const read = (rel: string) => Deno.readFileSync(new URL(rel, REPO));

/** PNG の幅と高さ（IHDR） */
export function pngSize(b: Uint8Array): { width: number; height: number } {
  const sig = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (!sig.every((x, i) => b[i] === x)) throw new Error('PNG でない');
  const v = new DataView(b.buffer, b.byteOffset, b.byteLength);
  return { width: v.getUint32(16), height: v.getUint32(20) };
}

/** WebP の幅と高さ（VP8・VP8L・VP8X） */
export function webpSize(b: Uint8Array): { width: number; height: number } {
  const ascii = (o: number, n: number) => String.fromCharCode(...b.subarray(o, o + n));
  if (ascii(0, 4) !== 'RIFF' || ascii(8, 4) !== 'WEBP') throw new Error('WebP でない');
  const kind = ascii(12, 4);
  const u16 = (o: number) => b[o] | (b[o + 1] << 8);
  const u24 = (o: number) => b[o] | (b[o + 1] << 8) | (b[o + 2] << 16);
  if (kind === 'VP8X') return { width: u24(24) + 1, height: u24(27) + 1 };
  if (kind === 'VP8 ') return { width: u16(26) & 0x3fff, height: u16(28) & 0x3fff };
  if (kind === 'VP8L') {
    const bits = b[21] | (b[22] << 8) | (b[23] << 16) | (b[24] << 24);
    return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
  }
  throw new Error(`知らない WebP の形: ${kind}`);
}

const SHOTS = SCREEN_FILES.map(f => `${STATIC_DIR}/${f}`);
const shotsReady = SHOTS.every(exists);

Deno.test({
  name: 'AC-37: スクショ 8 枚は webp・幅が名前の数・縦横の比 1320:2868（±1%）・150KB 以下',
  ignore: !shotsReady,
  fn: () => {
    for (const f of SHOTS) {
      const b = read(f);
      const { width, height } = webpSize(b);
      assertEquals(width, Number(/-(\d+)\.webp$/.exec(f)![1]), f);
      const ratio = width / height / (1320 / 2868);
      assert(Math.abs(ratio - 1) <= 0.01, `${f}: ${width}×${height}`);
      assert(b.byteLength <= 150 * 1024, `${f}: ${b.byteLength}`);
    }
  },
});

Deno.test({
  name: 'AC-37: OGP の画像は 1200×630 の PNG',
  ignore: !exists(`${STATIC_DIR}/${OGP_FILE}`),
  fn: () => assertEquals(pngSize(read(`${STATIC_DIR}/${OGP_FILE}`)), { width: 1200, height: 630 }),
});

Deno.test({
  name: 'AC-37: App Store のバッジは SVG',
  ignore: !exists(`${STATIC_DIR}/${BADGE_FILE}`),
  fn: async () => {
    const svg = await readRepo(`${STATIC_DIR}/${BADGE_FILE}`);
    assert(/<svg\b/i.test(svg));
  },
});

Deno.test(
  'AC-37: アイコン（favicon.png は assets/favicon.png の写し・apple-touch-icon.png は 180×180）',
  () => {
    for (const f of ICON_FILES) assert(exists(`${STATIC_DIR}/${f}`), f);
    assertEquals(read(`${STATIC_DIR}/favicon.png`), read('assets/favicon.png'));
    assertEquals(pngSize(read(`${STATIC_DIR}/apple-touch-icon.png`)), { width: 180, height: 180 });
  }
);

Deno.test('webpSize・pngSize は形の違うファイルで止まる', () => {
  let threw = 0;
  for (const f of [() => webpSize(new Uint8Array(32)), () => pngSize(new Uint8Array(32))]) {
    try {
      f();
    } catch {
      threw++;
    }
  }
  assertEquals(threw, 2);
  // VP8L の 360×782 の頭（幅-1・高さ-1 を 14 ビットずつ）
  const h = new Uint8Array(30);
  h.set(new TextEncoder().encode('RIFF'), 0);
  h.set(new TextEncoder().encode('WEBPVP8L'), 8);
  const bits = 359 | (781 << 14);
  h.set([bits & 0xff, (bits >> 8) & 0xff, (bits >> 16) & 0xff, (bits >> 24) & 0xff], 21);
  assertEquals(webpSize(h), { width: 360, height: 782 });
});

Deno.test(
  'AC-36: ワークフロー site.yml（develop への push・PR・手動。PR は作って検査だけ・develop から出す）',
  async () => {
    const yml = await readRepo('.github/workflows/site.yml');
    const on = yml.slice(yml.indexOf('\non:'), yml.indexOf('\npermissions:'));
    assert(/push:\s*\n\s*branches: \[develop\]/.test(on), on);
    assert(on.includes('pull_request:'));
    assert(on.includes('workflow_dispatch:'));
    assert(!/\bpaths(-ignore)?:/.test(yml), 'paths の絞り込みが無い');
    assert(/\npermissions:\s*\n\s*contents: read/.test(yml));
    assert(yml.includes('denoland/setup-deno@v2'));
    assert(yml.includes('deno-version: v2.9.4'));
    assert(yml.includes('deno test -A --node-modules-dir=none site/'));
    assert(yml.includes('deno run -A --node-modules-dir=none site/main.ts build --production'));
    assert(yml.includes('deno run -A --node-modules-dir=none site/main.ts check --production'));
    assert(
      /site\/main\.ts build\n/.test(yml) && /site\/main\.ts check\n/.test(yml),
      'PR は --production なし'
    );
    assert(yml.includes('actions/upload-pages-artifact@v3'));
    assert(/path: site\/dist/.test(yml));
    const deploy = yml.slice(yml.indexOf('\n  deploy:'));
    assert(deploy.includes("github.ref == 'refs/heads/develop'"));
    assert(deploy.includes("github.event_name != 'pull_request'"));
    assert(deploy.includes('needs: build'));
    assert(/environment:\s*\n\s*name: github-pages/.test(deploy));
    assert(deploy.includes('pages: write') && deploy.includes('id-token: write'));
    assert(/concurrency:\s*\n\s*group: pages\s*\n\s*cancel-in-progress: false/.test(deploy));
    assert(deploy.includes('actions/deploy-pages@v4'));
    // --production の手順と upload は PR でないときだけ
    for (const step of ['build --production', 'check --production', 'upload-pages-artifact']) {
      const at = yml.indexOf(step);
      const block = yml.slice(yml.lastIndexOf('- name:', at), at);
      assert(block.includes("if: github.event_name != 'pull_request'"), step);
    }
  }
);
