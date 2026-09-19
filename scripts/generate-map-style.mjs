#!/usr/bin/env node
/**
 * 地図の下地スタイル（assets/map-style.json）を作り直す。
 *
 * 配布元の positron に2種類の手を入れて焼き込む。
 *
 * 1. ラベルの日本語化
 *    positron は地名を `name:latin + name:nonlatin` で連結して出すため、
 *    日本では「Kyoto 京都市」「KASHIRACHO 頭町」と二重に表示される。ラベルが
 *    倍に増えると、こちらのスポット名が衝突判定で押し出される。
 *
 * 2. 見やすさの調整（TUNING / STATION_LAYER）
 *    positron は「データ可視化の下敷き」として全カテゴリをグレーに潰した
 *    スタイルなので、そのままだと地図帳のように見える。詳しくは下の
 *    TUNING の前書きを読むこと。
 *
 * 実行時に取りに行かない理由: 地図画面の起動にネットワークの失敗経路を
 * 増やしたくないため。タイル・グリフ・スプライトは URL 参照のままなので、
 * 地図データ自体は配布元の更新に追従する。
 *
 *   node scripts/generate-map-style.mjs
 *
 * 焼き込みなので、配信元のレイヤ構成が変わっても自動では追従しない。
 * 地図の見た目に違和感が出たとき・タイル配信元を変えるときは焼き直すこと。
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

// ---------------------------------------------------------------------------
// 下地の見やすさ調整
//
// positron は「データ可視化の下敷き」として設計されたスタイルで、全カテゴリが
// 明度差 5% 以内のグレーに潰してある。そのまま使うと地図帳のように見えて、
// 街の骨格が読み取れない（#155）。
//
// 方針は2つだけ:
//   1. 引き算 — 町名・建物・路地を、読む必要のないズームでは出さない
//   2. 色は「面」にだけ足す — 公園=緑 / 水=青
//
// 2 の但し書きが重要。道路や建物を暖色（Google 風の黄色い幹線・ベージュの建物）
// にすると、スポットピンのオレンジ・赤・紫が下地に沈む。liberty スタイルで
// 一度やって戻した実績があるので、線と建物はグレーのままにする。
// ---------------------------------------------------------------------------

/** 公園 */
const GREEN = '#D2E7CB';
/** 森林。公園より一段濃くして区別を付ける */
const GREEN_DEEP = '#C3DCBA';
/** 水面・河川 */
const BLUE = '#A9CFE8';

/** レイヤ id → 書き換え関数 */
const TUNING = {
  // ------ 引き算 ------

  /**
   * 町名を落として区名だけ残す。
   * OSM の place は日本だと極端に細かく、京都・東山の z14 タイル1枚に
   * neighbourhood が 1,660 件入っている（suburb は 4 件）。これが
   * 「地図帳に見える」最大の原因で、こちらのスポット名の場所も奪っていた。
   */
  label_other: layer => {
    layer.filter = ['match', ['get', 'class'], ['suburb', 'island'], true, false];
  },

  /** 建物は z15 から薄く出す。z12 から敷き詰めると道路網が埋もれる */
  building: layer => {
    layer.minzoom = 15;
    layer.paint['fill-opacity'] = ['interpolate', ['linear'], ['zoom'], 15, 0, 16, 1];
  },

  /** 生活道路・路地は z13 から。広域で網の目にしない */
  highway_minor: layer => {
    layer.minzoom = 13;
    layer.paint['line-width'] = ['interpolate', ['exponential', 1.55], ['zoom'], 13, 1.4, 20, 18];
  },

  /** 歩道・参道は z15 から */
  highway_path: layer => {
    layer.minzoom = 15;
  },

  // ------ 色を足す（面だけ） ------

  park: layer => {
    layer.paint['fill-color'] = GREEN;
  },
  landcover_wood: layer => {
    layer.paint['fill-color'] = GREEN_DEEP;
  },
  water: layer => {
    layer.paint['fill-color'] = BLUE;
  },
  waterway: layer => {
    layer.paint['line-color'] = BLUE;
  },

  // ------ 幹線を太く（色ではなく太さで階層を作る） ------

  highway_major_casing: layer => {
    layer.paint['line-width'] = ['interpolate', ['exponential', 1.3], ['zoom'], 10, 3.6, 20, 24];
  },
  highway_major_inner: layer => {
    layer.paint['line-width'] = ['interpolate', ['exponential', 1.3], ['zoom'], 10, 2.4, 20, 21];
  },
};

/**
 * 駅ラベル。positron は POI を1つも描かないので足す。
 *
 * 町名を消した代わりに、街の中で自分の位置を掴む手がかりをこれ1本に絞る。
 * バス停（class=bus）は同じタイルに 141 件あって町名と同じ轍を踏むので入れない。
 * スタイルの最後に足すので、アプリ側がこの上に重ねるスポットのピンが
 * ラベルの取り合いで勝つ。
 */
const STATION_LAYER = {
  id: 'label_station',
  type: 'symbol',
  source: 'openmaptiles',
  'source-layer': 'poi',
  minzoom: 13,
  filter: [
    'all',
    ['==', ['geometry-type'], 'Point'],
    ['==', ['get', 'class'], 'railway'],
    ['match', ['get', 'subclass'], ['station', 'subway', 'halt'], true, false],
  ],
  layout: {
    'icon-image': ['match', ['get', 'subclass'], 'subway', 'railway_metro_11', 'railway_11'],
    'icon-size': 0.9,
    'text-field': LABEL,
    'text-font': ['Noto Sans Regular'],
    'text-size': ['interpolate', ['linear'], ['zoom'], 13, 10, 16, 12],
    'text-anchor': 'top',
    'text-offset': [0, 0.55],
    'text-max-width': 7,
    'text-optional': true,
    // rank が小さいほど主要駅。先に置かれて衝突に勝つ
    'symbol-sort-key': ['get', 'rank'],
  },
  paint: {
    'text-color': '#44546A',
    'text-halo-color': '#fff',
    'text-halo-width': 1.2,
    'icon-opacity': 0.85,
  },
};

let tuned = 0;
for (const [id, apply] of Object.entries(TUNING)) {
  const layer = style.layers.find(l => l.id === id);
  if (!layer) {
    console.warn(`⚠ レイヤ "${id}" が配信元に無い。positron の構成が変わった可能性`);
    continue;
  }
  apply(layer);
  tuned++;
}

style.layers.push(STATION_LAYER);

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
// 最小化のまま書く。生成物なので .prettierignore で prettier の対象外にしてある
// （外さないと pre-commit に展開されて、焼くたびに差分が往復する）
await fs.writeFile(OUT, `${JSON.stringify(style)}\n`);

const { size } = await fs.stat(OUT);
console.log(
  `${path.relative(ROOT, OUT)}  ラベル日本語化 ${rewritten} / 見やすさ調整 ${tuned} / 駅レイヤ +1  ${size} bytes`
);
