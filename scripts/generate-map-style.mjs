#!/usr/bin/env node
/**
 * 地図の下地スタイル（assets/map-style.json）を作り直す。
 *
 * 配布元の positron は地名を `name:latin + name:nonlatin` で連結して出すため、
 * 日本では「Kyoto 京都市」「KASHIRACHO 頭町」と二重に表示される。ラベルが
 * 倍に増えると、こちらのスポット名が衝突判定で押し出される。
 * そこでラベルを日本語だけに差し替えたものを焼いてアプリに同梱する。
 *
 * 実行時に取りに行かない理由: 地図画面の起動にネットワークの失敗経路を
 * 増やしたくないため。タイル・グリフ・スプライトは URL 参照のままなので、
 * 地図データ自体は配布元の更新に追従する。
 *
 *   node scripts/generate-map-style.mjs
 *
 * 英語併記に戻したい／多言語に広げたい場合は LABEL を差し替えて焼き直す。
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const SOURCE = 'https://tiles.openfreemap.org/styles/positron';
const OUT = path.join(ROOT, 'assets/map-style.json');

/** 日本語 → 非ラテン名 → 既定名 の順で拾う */
const LABEL = ['coalesce', ['get', 'name:ja'], ['get', 'name:nonlatin'], ['get', 'name']];

const response = await fetch(SOURCE);
if (!response.ok) {
  console.error(`${SOURCE} が取れない: HTTP ${response.status}`);
  process.exit(1);
}
const style = await response.json();

let rewritten = 0;
for (const layer of style.layers) {
  const field = layer.layout?.['text-field'];
  if (!field) continue;
  // 道路番号（ref）のシールドは地名ではないので触らない
  if (!JSON.stringify(field).includes('"name')) continue;
  layer.layout['text-field'] = LABEL;
  rewritten++;
}

style.name = 'goshuin-positron-ja';
await fs.writeFile(OUT, `${JSON.stringify(style)}\n`);

const { size } = await fs.stat(OUT);
console.log(`${path.relative(ROOT, OUT)}  ${rewritten} レイヤのラベルを日本語に  ${size} bytes`);
