/**
 * docs/design/mockups/japan-paths.json → src/constants/japanMap.ts
 *
 * 県境のもとデータは Natural Earth（パブリックドメイン）。
 * JSON から TS を起こすのは、型を付けて 47県ちょうどであることを
 * 取り込み時に固定するため。作り直しは build-japan-paths.py から。
 */
import { readFileSync, writeFileSync } from 'node:fs';

const src = JSON.parse(readFileSync('docs/design/mockups/japan-paths.json', 'utf8'));
const names = Object.keys(src.paths).sort();
if (names.length !== 47) throw new Error(`47県のはずが ${names.length} 件`);

const [, , w, h] = src.viewBox.split(' ').map(Number);

/** パスを M 区切りで分け、いちばん大きい島の範囲を返す（離島は寄り先を狂わせる） */
function mainIsland(d) {
  const subs = d.split('M').filter(Boolean);
  let best = null;
  for (const sub of subs) {
    const nums = sub.replace('Z', '').trim().split(/[\sL]+/).map(Number).filter(n => !Number.isNaN(n));
    const xs = nums.filter((_, i) => i % 2 === 0);
    const ys = nums.filter((_, i) => i % 2 === 1);
    if (!xs.length) continue;
    const box = {
      x: Math.min(...xs),
      y: Math.min(...ys),
      width: Math.max(...xs) - Math.min(...xs),
      height: Math.max(...ys) - Math.min(...ys),
    };
    if (!best || box.width * box.height > best.width * best.height) best = box;
  }
  return best;
}

const body = names.map(n => `  '${n}':\n    '${src.paths[n]}',`).join('\n');
const boxes = names
  .map(n => {
    const b = mainIsland(src.paths[n]);
    const r = v => Math.round(v * 10) / 10;
    return `  '${n}': { x: ${r(b.x)}, y: ${r(b.y)}, width: ${r(b.width)}, height: ${r(b.height)} },`;
  })
  .join('\n');

writeFileSync(
  'src/constants/japanMap.ts',
  `/**
 * 日本地図の県境。**このファイルは生成物。手で直さない**
 * （\`node scripts/gen-japan-map.mjs\` で作り直す）。
 *
 * もとデータは Natural Earth の ne_10m_admin_1_states_provinces。
 * **パブリックドメイン**（Open Data Commons PDDL）なので、アプリに同梱できる。
 * Wikimedia の県地図は CC BY-SA が多く、組み込みには向かない。
 *
 * 県名は ISO 3166-2:JP から引いた正式名で、\`regionBlocks.ts\` と同じ表記。
 * DB の \`spots.prefecture\` と突き合わせるので、ここがずれると静かに当たらなくなる
 * （過不足はテストで固定してある）。
 *
 * 沖縄は本島まわりだけを左下の海へ別枠で置いてある（日本の地図の慣習）。
 * 全島を入れると横に1000km以上広がって枠に収まらない。
 */
export const JAPAN_MAP_WIDTH = ${w};
export const JAPAN_MAP_HEIGHT = ${h};

export const JAPAN_PREFECTURE_PATHS: Readonly<Record<string, string>> = {
${body}
};

export const JAPAN_PREFECTURE_NAMES = Object.keys(JAPAN_PREFECTURE_PATHS);

export interface PrefectureBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * 県の**いちばん大きい島**の範囲。離島は含めない。
 *
 * 使い道は2つ。塗る順番（南から北へ）と、保存直後にカメラを寄せる先。
 * 東京のように離島を持つ県で全体の範囲を使うと、寄り先が太平洋の真ん中になる。
 */
export const JAPAN_PREFECTURE_BOXES: Readonly<Record<string, PrefectureBox>> = {
${boxes}
};
`
);
console.log(`src/constants/japanMap.ts を生成（${names.length}県 / ${(JSON.stringify(src.paths).length / 1024) | 0}KB）`);
