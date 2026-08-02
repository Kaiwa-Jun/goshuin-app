# Issue #99: クラスタリング導入でズームアウト時のクラッシュを恒久解消

## 概要

Issue #96（ビューポート内 × rank 優先 top-N）の実機確認で発覚した**ズームアウト連続操作でのアプリクラッシュ**を、地図マーカーのクラスタリング導入で恒久解消する。

原因の見立て（Issue #99 本文）: ズームアウトのたびに top-80 の中身がほぼ総入れ替えになり（近所 → 県 → 全国の有名どころ）、カスタムビュー付きマーカー（`SpotMarker` = ラベル + ピン頭 + ピン尾の 3 View）の大量 mount/unmount が高速反復 → ネイティブ側のメモリスパイクで iOS の Jetsam に殺される。

本 Issue の恒久策は4点:

1. **クラスタリング導入（本命）**: supercluster でビューポート内スポットを団子化し、広域ではクラスタバブル（件数表示）を描画する
2. **訪問済み・行きたいピンはクラスタから除外**して常に個別表示する（「あなたの旅の記録」が団子に飲まれない。#96 の pinned 思想を継承）
3. **再選択のヒステリシス**: region 変化が小さい間は再計算しない
4. **#96 の `selectVisibleSpots` は土台として残す**。クラスタ分解後の個別スポットの優先度付け・件数上限に引き続き使う（`src/utils/spotSelection.ts` は無変更）

- GitHub Issue: #99（`.claude/harness/feature-list.json` P1-06）
- ブランチ: `feature/issue-099-map-clustering` → develop
- 前提: Issue #96（PR #97）はマージ済み。#96 の受入基準のうち件数を直接アサートするものは本契約で明示的に更新する（後述「既存テストの削除・変更一覧」）

## 関連ドキュメント

- [プロダクト方針 v2](../product/direction.md) — Phase 1「記録体験の磨き込み」。**リリース先行**方針のため、iOS 実機で落ちないことが最優先
- [Issue #96 契約書](./issue-096-map-viewport-topn.md) — 前提。`selectVisibleSpots` / `MAX_VISIBLE_SPOTS` / `VIEWPORT_MARGIN` の定義元
- [Issue #93 契約書](./issue-093-map-spot-display-fixes.md) — visited/wishlist 常時表示（AC-7/8）とデフォルトズームの閾値問題（AC-10/11）の出典
- [要件定義](../product/requirements.md) / [技術設計](../technical/tech-design.md)
- Issue #67（rank3 全国展開・3,000〜5,000 件）— 本方式はその規模でのネイティブビュー数上限を先に確保する。サーバー側 bounds フェッチは #67 のスコープ

## ライブラリ選定

### 結論: **supercluster を直接使う**（`react-native-map-clustering` は採用しない）

| 候補                                  | バージョン | 最終更新 | 形態                                                  |
| ------------------------------------- | ---------- | -------- | ----------------------------------------------------- |
| **supercluster**（採用）              | 8.0.1      | 2023-04  | 純 JS の計算ライブラリ。Mapbox 製。依存は kdbush のみ |
| react-native-map-clustering（不採用） | 4.0.0      | 2025-07  | `MapView` を丸ごと置き換えるラッパーコンポーネント    |

### 採用根拠

1. **`MapView` を置き換えるラッパーは本リポジトリの構造と衝突する**。`react-native-map-clustering` は `import MapView from 'react-native-map-clustering'` で `react-native-maps` の `MapView` を差し替える方式で、region state・再クラスタリングのタイミングをラッパー側が所有する。本 Issue の恒久策3（再選択ヒステリシス）は「region 変化が小さい間は再計算しない」という**再計算タイミングの制御そのもの**であり、ラッパー内部に握られていると実装できない。恒久策2（visited/wishlist のクラスタ除外）も同様にマーカー単位の制御が必要になる
2. **状態管理方針との整合**。CLAUDE.md の「状態管理はカスタム hooks + ローカル state のみ」に対し、supercluster は state もコンポーネントも持たない純粋な計算ライブラリなので抵触しない。ラッパーは state を持つコンポーネントを持ち込む
3. **peerDependencies が `*` で互換性の担保にならない**。`react-native-map-clustering@4.0.0` の peerDependencies は `react-native: *` / `react-native-maps: *`。本プロジェクトの Expo SDK 54 / react-native-maps 1.20.1 / RN 0.81.5 との組み合わせが検証されている保証はなく、`npm install` が通ることは何の証明にもならない。不整合はネイティブ実行時に露見する — まさに今回潰したい失敗モードそのもの
4. **テスト可能性**。supercluster は純 JS なので Jest でモックせず実物を動かせ、クラスタリングのロジックがそのまま機械検証可能なユニットになる（#96 の `selectVisibleSpots` と同じ構造）。ラッパーを採用すると `jest.setup.js` に `react-native-map-clustering` のモックを追加する必要があり、MapScreen テストがクラスタリング挙動を一切検証しなくなる
5. **Expo Web を壊さない**。`metro.config.js` は `platform === 'web'` のとき `react-native-maps` を `src/utils/react-native-maps.web.ts` のスタブに解決している。ラッパーは内部で `react-native-maps` を import するため、Web ビルドでスタブに当たったラッパーが動く保証がなく、UI 検証用の Expo Web 環境を壊すリスクがある。supercluster はプラットフォーム非依存で影響がない
6. **同じエンジンを取れる**。`react-native-map-clustering@4.0.0` の dependencies は `supercluster: ^8.0.0` + `@mapbox/geo-viewport: ^0.4.1`。つまりクラスタリングエンジンはどちらも supercluster であり、ラッパーを外しても失うのは `geo-viewport` によるズーム換算だけ（本契約では `getZoomFromRegion` として自前で持つ）
7. **supercluster の 2023-04 で止まった更新は劣化シグナルではない**。Mapbox 製で機能的に完成しており、ネイティブ層を一切持たず依存も kdbush のみ。RN / Expo のバージョン追従が必要な種類のパッケージではない

### 追加する依存

| パッケージ            | 区分            | バージョン |
| --------------------- | --------------- | ---------- |
| `supercluster`        | dependencies    | `^8.0.1`   |
| `@types/supercluster` | devDependencies | `^7.1.3`   |

`@types/supercluster` は `@types/geojson` を推移的に引く。`kdbush@^4.1.0` は supercluster の推移依存として入る。

### 必須のビルド設定変更（`jest.config.js`）

`supercluster@8.0.1` は `"type": "module"` かつ `"exports": "./index.js"` の **ESM パッケージ**（`main` の `dist/supercluster.js` は UMD だが、`exports` があるため Jest / Metro とも `index.js` に解決される）。推移依存の `kdbush@4.x` も同様。

現行 `jest.config.js` の `transformIgnorePatterns` allowlist には両者が含まれていないため、**このままだと `SyntaxError: Cannot use import statement outside a module` で supercluster を import する全テストが落ちる**。allowlist の末尾に `|supercluster|kdbush` を追加する。

`moduleNameMapper` で `dist/supercluster.js`（UMD）に差し替える回避策は**取らない**。本番（Metro）と別ビルドを検証することになるため。

Metro（実行時）は Expo SDK 54 で package exports が既定有効なので追加設定は不要。TypeScript は `expo/tsconfig.base` が `esModuleInterop: true` / `moduleResolution: "bundler"` のため `import Supercluster from 'supercluster'` で解決できる。

## 詳細設計

### 対象ファイル

| ファイル                                                 | 変更内容                                                                                                       |
| -------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `package.json`                                           | `supercluster` を dependencies に、`@types/supercluster` を devDependencies に追加                             |
| `jest.config.js`                                         | `transformIgnorePatterns` の allowlist に `supercluster` と `kdbush` を追加                                    |
| `src/utils/spotClustering.ts`                            | **新規**: クラスタリングの純関数群 + 定数 + 型                                                                 |
| `src/utils/__tests__/spotClustering.test.ts`             | **新規**: AC-1〜15 / P-1・P-2                                                                                  |
| `src/utils/regionHysteresis.ts`                          | **新規**: `shouldRecomputeRegion` + ヒステリシス定数                                                           |
| `src/utils/__tests__/regionHysteresis.test.ts`           | **新規**: AC-16〜21                                                                                            |
| `src/hooks/useSpotClusters.ts`                           | **新規**: index 構築とクラスタ算出のメモ化 + クラスタ展開 region                                               |
| `src/hooks/__tests__/useSpotClusters.test.ts`            | **新規**: AC-22〜24                                                                                            |
| `src/components/common/ClusterBubble.tsx`                | **新規**: クラスタバブル UI                                                                                    |
| `src/components/common/__tests__/ClusterBubble.test.tsx` | **新規**: AC-25〜28                                                                                            |
| `src/screens/MapScreen.tsx`                              | `clusterRegion` state 追加、`visibleSpots` を `useSpotClusters` に置き換え、クラスタ Marker とタップ処理を追加 |
| `src/screens/__tests__/MapScreen.test.tsx`               | 既存テストの変更（後述の一覧）+ 新規テスト（AC-29〜38 / P-3・P-4）                                             |
| `jest.setup.js`                                          | MockMapView の imperative handle をテストから参照できるよう `__mapViewMocks` として公開（AC-35 のため）        |

**変更しないファイル**: `src/utils/spotSelection.ts`（`selectVisibleSpots` / `MAX_VISIBLE_SPOTS` / `VIEWPORT_MARGIN` とも無変更のまま再利用）、`src/utils/geo.ts`、`src/hooks/useSpots.ts`、`src/services/spots.ts`、`src/components/common/SpotMarker.tsx`、`src/components/common/MapPin.tsx`、`metro.config.js`、`src/utils/react-native-maps.web.ts`、`src/theme/*`。

### 実装方針

#### 1. `src/utils/spotClustering.ts`（新規）

`src/utils/` の既存規約（camelCase のドメイン名ファイル + 名前付き export + 定数 export）に従う。`MapRegion` 型は `@utils/spotSelection` から import して単一のソースを保つ。

```ts
import Supercluster from 'supercluster';
import type { Spot } from '@/types/supabase';
import { calculateDistance } from '@utils/geo';
import { selectVisibleSpots, VIEWPORT_MARGIN, type MapRegion } from '@utils/spotSelection';

/** supercluster のクラスタ半径（px 相当。既定 40 より広げて団子化を強める） */
export const CLUSTER_RADIUS = 60;
/** supercluster のタイル extent（既定値） */
export const CLUSTER_EXTENT = 512;
/** クラスタを構成する最小点数（既定値。2 点でも団子化してネイティブビューを減らす） */
export const CLUSTER_MIN_POINTS = 2;
/** クラスタを生成する最小ズーム */
export const CLUSTER_MIN_ZOOM = 0;
/** クラスタを生成する最大ズーム。これを超えるズームでは全点が個別描画される */
export const CLUSTER_MAX_ZOOM = 13;

/** 同時に描画するクラスタバブルの上限 */
export const MAX_CLUSTER_BUBBLES = 40;
/** 同時に描画する個別スポットピンの上限（pinned を除く） */
export const MAX_INDIVIDUAL_SPOTS = 60;
/** 同時に描画する pinned（訪問済み・行きたい）ピンの上限 */
export const MAX_PINNED_SPOTS = 30;
/** 地図上のマーカー総数の上限 = 40 + 60 + 30 */
export const MAX_TOTAL_MARKERS = 130;

/** supercluster に載せる点のプロパティ */
export interface ClusterPointProps {
  spotId: string;
}

export interface SpotCluster {
  /** Marker の testID / key に使う識別子（`cluster-<clusterId>`） */
  id: string;
  /** supercluster の cluster_id。展開ズームの取得に使う */
  clusterId: number;
  latitude: number;
  longitude: number;
  /** クラスタに含まれるスポット数（バブルに表示する数字） */
  count: number;
}

export interface ClusterView {
  clusters: SpotCluster[];
  individualSpots: Spot[];
}

export type SpotClusterIndex = Supercluster<ClusterPointProps>;

export function getZoomFromRegion(region: MapRegion): number;
export function getDeltaFromZoom(zoom: number): number;
export function regionToBBox(region: MapRegion): [number, number, number, number];
export function takeNearest(spots: Spot[], region: MapRegion, maxCount: number): Spot[];
export function selectPinnedSpots(params: {
  spots: Spot[];
  region: MapRegion | null;
  visitedSpotIds: Set<string>;
  wishlistSpotIds: Set<string>;
  maxCount?: number; // 既定 MAX_PINNED_SPOTS
}): Spot[];
export function createClusterIndex(spots: Spot[]): SpotClusterIndex;
export function buildClusterView(params: {
  index: SpotClusterIndex;
  spotById: Map<string, Spot>;
  region: MapRegion;
  pinnedSpots: Spot[];
}): ClusterView;
```

**`getZoomFromRegion`**

```
zoom = clamp(0, 20, Math.round(Math.log2(360 / max(region.longitudeDelta, 1e-6))))
```

代表値（この対応表が仕様）:

| longitudeDelta | 0.015 | 0.019 | 0.021 | 0.025 | 0.031 | 0.032 | 0.05 | 0.1 | 0.2 | 0.6 | 5   |
| -------------- | ----- | ----- | ----- | ----- | ----- | ----- | ---- | --- | --- | --- | --- |
| zoom           | 15    | 14    | 14    | 14    | 14    | 13    | 13   | 12  | 11  | 9   | 6   |

supercluster は `zoom > maxZoom` のとき葉ノード（全点個別）を返すため、**クラスタ化されるのは `zoom <= CLUSTER_MAX_ZOOM (13)`、すなわち `longitudeDelta > 約0.031` のときだけ**。アプリの初期ズーム `LATITUDE_DELTA = 0.015`（zoom 15）の約2倍離れており、#93 で修正した「デフォルトズームが閾値と一致してチラつく」問題は再発しない。

**`getDeltaFromZoom`**: `360 / 2 ** zoom`。`getZoomFromRegion({ longitudeDelta: getDeltaFromZoom(z) }) === z` が整数 z について成り立つ（往復整合）。

**`regionToBBox`**: `#96` と同じ `VIEWPORT_MARGIN`（1.2）を適用し、`[west, south, east, north]` を返す。緯度は `[-90, 90]`、経度は `[-180, 180]` にクランプする。

```
halfLat = (region.latitudeDelta / 2) * VIEWPORT_MARGIN
halfLng = (region.longitudeDelta / 2) * VIEWPORT_MARGIN
→ [lng - halfLng, lat - halfLat, lng + halfLng, lat + halfLat] を上記範囲でクランプ
```

`selectVisibleSpots` のビューポート判定（`|spot.lat - center| <= halfLat`）と**同じ矩形**になるため、両者の可視判定は一致する。

**`takeNearest`**: 中心距離昇順 → `id` 昇順で `maxCount` 件。距離は `@utils/geo` の `calculateDistance` をソート前に1回だけ計算する（#96 と同じ規約）。入力配列は破壊しない。

**`selectPinnedSpots`**: `selectVisibleSpots({ spots, region, visitedSpotIds, wishlistSpotIds, maxCount: 0 })` を呼ぶ。`maxCount: 0` は「残り枠 0 = pinned のみを返す」に相当し、**#96 の純関数をそのままビューポート内 pinned 抽出器として再利用する**。その結果に `takeNearest(..., MAX_PINNED_SPOTS)` を適用して上限を掛ける（pinned は「自分の記録」なので rank ではなく**近い順**で残す）。`region` が null のときは距離が定義できないため `id` 昇順で `maxCount` 件。

**`createClusterIndex`**: `new Supercluster<ClusterPointProps>({ radius: CLUSTER_RADIUS, extent: CLUSTER_EXTENT, minPoints: CLUSTER_MIN_POINTS, minZoom: CLUSTER_MIN_ZOOM, maxZoom: CLUSTER_MAX_ZOOM })` を作り、`spots` を GeoJSON Point Feature（`properties: { spotId }`、`geometry.coordinates: [lng, lat]`）にして `load()` する。**渡すのはクラスタ対象のスポットのみ**（pinned は呼び出し側で除外済み）。

**`buildClusterView`** のアルゴリズム:

1. `zoom = getZoomFromRegion(region)`、`bbox = regionToBBox(region)`
2. `features = index.getClusters(bbox, zoom)`
3. `properties.cluster === true` のフィーチャを `SpotCluster`（`id = 'cluster-' + cluster_id`、`count = point_count`、座標は `geometry.coordinates`）に変換し、**`count` 降順 → `clusterId` 昇順**でソートして先頭 `MAX_CLUSTER_BUBBLES` 件を採用
4. 残りのフィーチャ（単独点）を `properties.spotId` から `spotById` で `Spot` に戻す（見つからない id はスキップ）
5. 単独点に `selectVisibleSpots({ spots: 単独点, region, visitedSpotIds: 空 Set, wishlistSpotIds: 空 Set, maxCount: MAX_INDIVIDUAL_SPOTS })` を適用する。**これが #96 の「rank 降順 → 中心距離昇順 → id 昇順」の優先度をクラスタリング後にも効かせる部分**
6. `individualSpots = [...pinnedSpots, ...採用した単独点]`、`clusters = 採用したクラスタ` を返す

したがって描画されるマーカー総数は常に `<= MAX_PINNED_SPOTS + MAX_INDIVIDUAL_SPOTS + MAX_CLUSTER_BUBBLES = MAX_TOTAL_MARKERS (130)` に収まる。

> **なぜ「先に top-N してからクラスタ化」ではないのか**: 先に 80 件に絞ってからクラスタ化すると、バブルの件数表示が実際の密度と食い違う（本当は 200 件ある場所に「12」と出る）。クラスタリングの価値は真の密度を見せることなので、index は**絞る前の全スポット**から作り、`selectVisibleSpots` は**クラスタに吸収されなかった単独点**に対して後段で適用する。

#### 2. `src/utils/regionHysteresis.ts`（新規）

```ts
import type { MapRegion } from '@utils/spotSelection';

/** 中心移動の許容割合（ビューポート幅に対する比） */
export const HYSTERESIS_CENTER_RATIO = 0.1;
/** delta 変化の許容割合 */
export const HYSTERESIS_DELTA_RATIO = 0.2;

export function shouldRecomputeRegion(prev: MapRegion | null, next: MapRegion): boolean;
```

`prev` が null なら常に `true`。それ以外は以下のいずれかを満たすとき `true`（= 再計算する）:

- `|next.latitude - prev.latitude| >= prev.latitudeDelta * HYSTERESIS_CENTER_RATIO`
- `|next.longitude - prev.longitude| >= prev.longitudeDelta * HYSTERESIS_CENTER_RATIO`
- `|next.latitudeDelta - prev.latitudeDelta| >= prev.latitudeDelta * HYSTERESIS_DELTA_RATIO`
- `|next.longitudeDelta - prev.longitudeDelta| >= prev.longitudeDelta * HYSTERESIS_DELTA_RATIO`

**定数の根拠（`VIEWPORT_MARGIN = 1.2` から導出）**: マージン 1.2 は真のビューポートの外側に片側 `0.1 × delta` の余白を持つ。

- 中心が `0.1 × delta` 以内の移動なら、新しく真のビューポートに入った領域はすべて旧選択の余白に含まれる → 見えない穴が生じない。よって `HYSTERESIS_CENTER_RATIO <= (VIEWPORT_MARGIN - 1) / 2 = 0.1`
- delta が 20% 以内の拡大なら、新しい真のビューポート（`0.6 × delta`）は旧マージン込み範囲（`0.6 × delta`）に一致する → 同上。よって `HYSTERESIS_DELTA_RATIO <= VIEWPORT_MARGIN - 1 = 0.2`
- また delta 20% 変化は zoom で `log2(1.2) ≈ 0.26` レベルにしかならず、`getZoomFromRegion` の整数 zoom はほぼ変わらない（クラスタ粒度が変わらない）

#### 3. `src/hooks/useSpotClusters.ts`（新規）

```ts
export function useSpotClusters(params: {
  spots: Spot[];
  region: MapRegion | null;
  visitedSpotIds: Set<string>;
  wishlistSpotIds: Set<string>;
}): {
  clusters: SpotCluster[];
  individualSpots: Spot[];
  getClusterExpansionRegion: (cluster: SpotCluster) => MapRegion;
};
```

- `clusterableSpots = useMemo(spots.filter(未 visited かつ 未 wishlist), [spots, visitedSpotIds, wishlistSpotIds])`
- `index = useMemo(() => createClusterIndex(clusterableSpots), [clusterableSpots])` — **index の構築（`load`）は spots / visited / wishlist が変わったときだけ**。region 変化では再構築しない（これが本 Issue の負荷削減の核心）
- `spotById = useMemo(new Map(clusterableSpots.map(s => [s.id, s])), [clusterableSpots])`
- `pinnedSpots = useMemo(() => selectPinnedSpots({ spots, region, visitedSpotIds, wishlistSpotIds }), [spots, region, visitedSpotIds, wishlistSpotIds])`
- `view = useMemo(() => region ? buildClusterView({ index, spotById, region, pinnedSpots }) : { clusters: [], individualSpots: pinnedSpots }, [index, spotById, region, pinnedSpots])`
- `getClusterExpansionRegion = useCallback(cluster => { const zoom = Math.min(index.getClusterExpansionZoom(cluster.clusterId), CLUSTER_MAX_ZOOM + 1); const delta = getDeltaFromZoom(zoom); return { latitude: cluster.latitude, longitude: cluster.longitude, latitudeDelta: delta, longitudeDelta: delta }; }, [index])`

#### 4. `src/components/common/ClusterBubble.tsx`（新規）

`SpotMarker` と同じ構成（`React.memo` + `StyleSheet.create()` + `src/theme` トークン参照）。

```tsx
interface ClusterBubbleProps {
  count: number;
}
```

| 要素         | 指定                                                                                                               |
| ------------ | ------------------------------------------------------------------------------------------------------------------ |
| バブル外形   | 正円。`count < 10` → 36×36 / `10 <= count < 100` → 44×44 / `100 <= count` → 52×52。`borderRadius` は各サイズの 1/2 |
| 背景色       | `colors.primary[500]`（`#f27f0d`）                                                                                 |
| 枠線         | `borderWidth: 2.5` / `borderColor: colors.white`（`SpotMarker` の `pinHead` と同じ扱い）                           |
| 影           | `...shadows.md`                                                                                                    |
| 件数テキスト | `...typography.label` + `color: colors.white` + `fontWeight: '700'`。内容は `String(count)`                        |
| レイアウト   | `alignItems: 'center'` / `justifyContent: 'center'`                                                                |
| testID       | 外側 View に `cluster-bubble`、`Text` に `cluster-bubble-count`                                                    |

#### 5. `src/screens/MapScreen.tsx` の変更

```ts
// 追加 state: クラスタ再計算に使う region（ヒステリシスで更新頻度を落とす）
const [clusterRegion, setClusterRegion] = useState<Region | null>(null);

const effectiveClusterRegion = useMemo<Region | null>(
  () =>
    clusterRegion ??
    (location
      ? {
          latitude: location.latitude,
          longitude: location.longitude,
          latitudeDelta: LATITUDE_DELTA,
          longitudeDelta: LONGITUDE_DELTA,
        }
      : null),
  [clusterRegion, location]
);

const { clusters, individualSpots, getClusterExpansionRegion } = useSpotClusters({
  spots: displaySpots,
  region: effectiveClusterRegion,
  visitedSpotIds,
  wishlistSpotIds,
});
```

- `handleRegionChangeComplete` に1行だけ追加する。`setCurrentRegion(r)`（ラベル用・**現状維持**）はそのままに、`setClusterRegion(prev => (shouldRecomputeRegion(prev, r) ? r : prev))` を足す。関数形式の更新にして `useCallback` の依存配列は `[]` のまま保つ
- **ラベル表示にはヒステリシスをかけない**。`shouldShowLabels` は `effectiveRegion`（= `currentRegion` ベース）のまま。#93/#96 のラベルルールと既存テストを一切変えない
- `visibleSpots` とその `useMemo`、および `selectVisibleSpots` の直接 import を削除し、`individualSpots` の描画に置き換える
- クラスタ Marker を個別ピンより**前に**描画する:

```tsx
{
  clusters.map(cluster => (
    <Marker
      key={`${cluster.id}-${cluster.count}`}
      coordinate={{ latitude: cluster.latitude, longitude: cluster.longitude }}
      testID={`cluster-marker-${cluster.id}`}
      onPress={() => handleClusterPress(cluster)}
      anchor={{ x: 0.5, y: 0.5 }}
      tracksViewChanges={false}
    >
      <ClusterBubble count={cluster.count} />
    </Marker>
  ));
}
```

- `handleClusterPress`:

```ts
const handleClusterPress = useCallback(
  (cluster: SpotCluster) => {
    mapRef.current?.animateToRegion(getClusterExpansionRegion(cluster), 300);
  },
  [getClusterExpansionRegion]
);
```

- `handleMarkerPress` / `handleMapPress` / `focusSpotId` / `focusPrefecture` / ボトムシート / フィルタ / `skipRegionChangeRef` / `forceLabelVisible` は**すべて無変更**

#### 6. `jest.setup.js` の変更

`MockMapView` の `useImperativeHandle` が毎レンダー新しい `jest.fn()` を作るため、テストから `animateToRegion` の呼び出しを検証できない。モックファクトリのスコープで生成した安定オブジェクトを handle に使い、`__mapViewMocks` として追加 export する。

```js
jest.mock('react-native-maps', () => {
  const React = require('react');
  const { View } = require('react-native');
  const mapViewMocks = {
    animateToRegion: jest.fn(),
    animateCamera: jest.fn(),
    fitToCoordinates: jest.fn(),
  };
  const MockMapView = React.forwardRef((props, ref) => {
    React.useImperativeHandle(ref, () => mapViewMocks);
    return React.createElement(
      View,
      { ...props, testID: props.testID || 'map-view' },
      props.children
    );
  });
  // ...（Marker / PROVIDER_GOOGLE は現状維持）
  return {
    __esModule: true,
    default: MockMapView,
    Marker: MockMarker,
    PROVIDER_GOOGLE: 'google',
    __mapViewMocks: mapViewMocks,
  };
});
```

テスト側は `const { __mapViewMocks } = jest.requireMock('react-native-maps');` で参照する。既存テストはこの handle を参照していないため影響はない（`beforeEach` の `jest.clearAllMocks()` で呼び出し履歴はリセットされる）。

### データ構造

新規の型は `ClusterPointProps` / `SpotCluster` / `ClusterView` / `SpotClusterIndex`（すべて `src/utils/spotClustering.ts`）のみ。`Spot` 型・DB スキーマ・Supabase 側の変更は一切なし。

## 既存テストの削除・変更一覧（明示的宣言）

クラスタリング導入により「描画される個別マーカー数 = 80」を直接アサートする #96 のテストが成立しなくなる。以下を**契約として宣言した上で**変更する（勝手に消さない）。

### `src/screens/__tests__/MapScreen.test.tsx`

| #   | 対象テスト                                                                                                                                       | 処置                                     | 理由・変更内容                                                                                                                                                                                                           |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | `Viewport top-N selection (#96)` › `初期ビューポート内の rank 2 スポットは delta 0.019 / 0.021 / 0.1 のいずれでも表示され続ける(ポッピング解消)` | **変更**                                 | delta 0.1 は zoom 12 = クラスタ化帯に入り、対象スポットがバブルに吸収され得る。delta の配列を `[0.019, 0.021, 0.025]`（いずれも zoom 14 = 非クラスタ帯）に変更する。クラスタ帯の挙動は AC-30/31 で別途検証する           |
| 2   | `Viewport top-N selection (#96)` › `同 rank 81 件では中心から最遠の 1 件のみレンダリングされない(top-N 選外)`                                    | **変更**                                 | 個別描画上限が `MAX_VISIBLE_SPOTS`(80) → `MAX_INDIVIDUAL_SPOTS`(60) に変わる。アサーションを「マーカー 60 件」「`gen-0059` が表示」「`gen-0060` が非表示」に変更し、テスト名も 60 件基準に改める                         |
| 3   | `Viewport top-N selection (#96)` › `初期ビューポート内 1,109 件でもレンダリングされるスポットマーカーは 80 件(P-2)`                              | **変更**                                 | 同上。80 → 60（本契約 P-3 に置き換え）                                                                                                                                                                                   |
| 4   | `Viewport top-N selection (#96)` › `top-80 選外の wishlist スポットは枠を置き換えて表示され、総数は 80 件のまま(P-3)`                            | **変更**                                 | pinned が独立枠（`MAX_PINNED_SPOTS`）になったため、総数は「pinned 1 + 個別 60 = 61 件」になる。アサーションを 61 件に変更し、`gen-0000` が含まれることの確認は維持する                                                   |
| 5   | `Viewport top-N selection (#96)` › `focusPrefecture で県 spots が 100 件でも県域 region 発火後のマーカーは 80 件`                                | **変更**                                 | 県域 region（delta 0.2 = zoom 11）ではクラスタ化されるため個別 `pref-gen` マーカーはほぼ残らない。「`cluster-marker-*` が1件以上表示され、`cluster-marker-*` + `spot-marker-*` の合計が 130 以下」に変更（本契約 AC-36） |
| 6   | `Viewport top-N selection (#96)` › `ビューポート外(東京座標)のスポットは rank 5 でも初期表示でレンダリングされない`                              | **維持**（無変更）                       | bbox によるビューポート絞り込みは不変                                                                                                                                                                                    |
| 7   | `Viewport top-N selection (#96)` › `rank 1 のスポットしかないエリアでも delta 0.6 にズームアウトして地図が空にならない`                          | **維持**（無変更）                       | 単独点は `CLUSTER_MIN_POINTS`(2) 未満のためクラスタ化されず個別描画される                                                                                                                                                |
| 8   | `Rank filter exemption for visited/wishlist spots (#93)` の2テスト（visited / wishlist がズームアウトでも表示）                                  | **維持**（無変更で通ること自体が AC-32） | pinned は index に載せないためクラスタに吸収されない                                                                                                                                                                     |
| 9   | `Zoom-based label visibility` の3テスト                                                                                                          | **維持**（無変更で通ること自体が AC-38） | ラベルルールは `currentRegion` ベースのまま。delta 0.1 / 0.05 では `spot-1`（visited = pinned）と `spot-2`（単独点）がともに個別描画されるためラベル 2 件のまま                                                          |
| 10  | `Spot markers` の各テスト / `focusPrefecture` の各テスト / `Default zoom level (#93)` / 検索バー・FAB・フィルタ・ボトムシート・位置情報バナー    | **維持**（無変更）                       | 初期 delta 0.015 は zoom 15 でクラスタ化されない。`focusPrefecture` の既存フィクスチャ（`pref-spot-1` / `pref-spot-2`）は zoom 11 のクラスタ半径より離れているため個別描画のまま                                         |

### その他のテストファイル

`src/utils/__tests__/spotSelection.test.ts`・`src/services/__tests__/spots.test.ts`・`src/hooks/__tests__/useSpots.test.ts`・`src/utils/__tests__/geo.test.ts` は**一切変更しない**（`spotSelection.ts` を無変更で再利用するため）。

## テスト方針

TDD（t-wada 流）で Red → Green → Refactor。

- **純関数を厚くテストする**。`spotClustering.test.ts` は supercluster の実物を使い、`jest.mock('supercluster')` はしない（設定不備を検出するため）
- スポットのフィクスチャは `makeSpot(overrides)` ヘルパー（`Spot` の全必須フィールドを埋める）で生成し、座標は `Math.random()` を使わず index ベースのグリッドで決定的に配置する。id はゼロ埋め（`gen-0000`）
- クラスタ半径の目安（実装・テスト設計の根拠。supercluster の投影単位 `radius / (extent * 2^zoom)` を度に換算、緯度 38.3 付近）:

  | zoom | 経度方向の半径 | 緯度方向の半径 |
  | ---- | -------------- | -------------- |
  | 13   | 約 0.0052°     | 約 0.0040°     |
  | 12   | 約 0.0103°     | 約 0.0081°     |
  | 11   | 約 0.0206°     | 約 0.0162°     |
  | 9    | 約 0.0824°     | 約 0.0647°     |
  | 6    | 約 0.659°      | 約 0.517°      |

- MapScreen 統合テストは既存パターンを踏襲する（`mockSpotsOverride` の差し替え、`fireEvent(mapView, 'onRegionChangeComplete', region)`、`mockWishlistSpotIds` の `let` 差し替え）
- マーカー数のカウントは testID プレフィックスの正規表現で行う: 個別ピン `queryAllByTestId(/^spot-marker-/)`、クラスタ `queryAllByTestId(/^cluster-marker-/)`（`current-location-marker` と衝突しない）
- hook の再構築回数は `jest.mock('@utils/spotClustering', () => { const actual = jest.requireActual('@utils/spotClustering'); return { ...actual, createClusterIndex: jest.fn(actual.createClusterIndex) }; })` で計測する
- **実機の体感（クラッシュしないこと・団子の見た目・タップでの展開）は Expo Web / Jest では検証不能**のため native-only として人間ゲートに割り当てる

### 検証手段の切り分け

| 手段                                           | 検証できるもの                                                                                                                                                                                  |
| ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Jest（`npm test`）                             | AC-1〜38 / P-1〜P-4 / Q-1（全機械基準）                                                                                                                                                         |
| Expo Web（`npx expo start --web --port 8081`） | **本 Issue に Web で検証可能な受入基準は無い**。`metro.config.js` が `react-native-maps` をスタブに解決するため地図背景も Marker の実描画も存在せず、クラスタの見た目・ズーム操作を確認できない |
| 実機 iPhone + EAS Development Build（`/dev`）  | UI-1〜UI-7（すべて native-only）                                                                                                                                                                |
| Maestro                                        | 追加しない。ピンチ・パンの再現が不安定なため（#96 と同じ判断）                                                                                                                                  |

## 受入基準（Acceptance Criteria）

qa-evaluator エージェントがこの基準に基づいて合否判定を行う。

### 機能基準 A: `src/utils/spotClustering.ts`（`src/utils/__tests__/spotClustering.test.ts`）

- [ ] AC-1: `getZoomFromRegion` が `longitudeDelta` 0.015 / 0.019 / 0.021 / 0.025 / 0.1 / 0.2 / 0.6 / 5 に対して順に `15 / 14 / 14 / 14 / 12 / 11 / 9 / 6` を返す
- [ ] AC-2: `getZoomFromRegion({ longitudeDelta: 360 })` が `0`、`getZoomFromRegion({ longitudeDelta: 1e-9 })` が `20`（クランプ）
- [ ] AC-3: `getZoomFromRegion({ longitudeDelta: 0.031 })` が `14`（非クラスタ帯）、`getZoomFromRegion({ longitudeDelta: 0.032 })` が `13`（クラスタ帯）— クラスタ化開始が初期 delta 0.015 の2倍以上離れていることの確認
- [ ] AC-4: `getDeltaFromZoom(14) === 360 / 2 ** 14` であり、`z = 6 / 9 / 12 / 14` について `getZoomFromRegion({ longitudeDelta: getDeltaFromZoom(z) }) === z`
- [ ] AC-5: `regionToBBox({ latitude: 38.2682, longitude: 140.8694, latitudeDelta: 0.02, longitudeDelta: 0.02 })` が `[140.8574, 38.2562, 140.8814, 38.2802]` を返す（各要素 `toBeCloseTo(..., 6)`。half = 0.012 = `VIEWPORT_MARGIN` 適用済み）
- [ ] AC-6: `latitudeDelta: 200` の region に対し `regionToBBox` の返り値の `[1]` が `-90`、`[3]` が `90`（緯度クランプ）
- [ ] AC-7: `takeNearest` が中心距離昇順で `maxCount` 件を返し、中心から等距離の2件 `id: 'a'` / `id: 'b'` では `'a'` が先（id 昇順のタイブレーク）。呼び出し後も入力配列の順序は不変（`toEqual` で検証）
- [ ] AC-8: 中心 38.2682/140.8694 の 0.0005° グリッドに未訪問 100 件を置き、`region` を delta 0.6 で `buildClusterView` を呼ぶと `clusters.length === 1` / `clusters[0].count === 100` / `individualSpots.length === 0`
- [ ] AC-9: 同じ 100 件を初期ビューポート内（0.0015° グリッド）に置き `region` を delta 0.015 で呼ぶと `clusters.length === 0` / `individualSpots.length === 60`（zoom 15 では全点が個別）
- [ ] AC-10: visited 1件を含む近接 51 件を delta 0.6 で処理すると、その visited スポットの id が `individualSpots` に含まれる（`pinnedSpots` として渡され、index に載っていないためクラスタに吸収されない）
- [ ] AC-11: 0.11° 間隔の 7×7 グリッドの各点に2件ずつ（計 98 件）配置し delta 0.6 で呼ぶと `clusters.length === 40`（49 個生成 → `MAX_CLUSTER_BUBBLES` で上限）かつ全 `count === 2`
- [ ] AC-12: zoom 15 になる delta 0.015 のビューポート内に未訪問 200 件を置くと `individualSpots.length === 60` で、rank 5 のスポットが rank 1 のスポットより優先して含まれる
- [ ] AC-13: `CLUSTER_RADIUS === 60` / `CLUSTER_EXTENT === 512` / `CLUSTER_MIN_POINTS === 2` / `CLUSTER_MIN_ZOOM === 0` / `CLUSTER_MAX_ZOOM === 13` / `MAX_CLUSTER_BUBBLES === 40` / `MAX_INDIVIDUAL_SPOTS === 60` / `MAX_PINNED_SPOTS === 30` / `MAX_TOTAL_MARKERS === 130` であり、`MAX_CLUSTER_BUBBLES + MAX_INDIVIDUAL_SPOTS + MAX_PINNED_SPOTS === MAX_TOTAL_MARKERS`
- [ ] AC-14: `selectPinnedSpots` はビューポート内の visited / wishlist のみを返し、ビューポート外の visited は含まない。ビューポート内に visited が 31 件あるとき返り値は 30 件（中心距離昇順の上位）
- [ ] AC-15: 同一入力で `buildClusterView` を2回呼ぶと `clusters` の id 配列と `individualSpots` の id 配列がともに一致し（決定性）、入力の `spots` 配列は呼び出し後も元の順序のまま（非破壊）

### 機能基準 B: `src/utils/regionHysteresis.ts`（`src/utils/__tests__/regionHysteresis.test.ts`）

基準 region: `{ latitude: 38.2682, longitude: 140.8694, latitudeDelta: 0.1, longitudeDelta: 0.1 }`

- [ ] AC-16: `shouldRecomputeRegion(null, region)` が `true`
- [ ] AC-17: 中心を latitude +0.009（delta の 9%）だけ動かし delta 据え置きの region に対し `false`
- [ ] AC-18: 中心を latitude +0.011（delta の 11%）だけ動かした region に対し `true`
- [ ] AC-19: 中心据え置きで `latitudeDelta` / `longitudeDelta` をともに 0.121（+21%）にした region に対し `true`
- [ ] AC-20: 中心据え置きで `latitudeDelta` / `longitudeDelta` をともに 0.119（+19%）にした region に対し `false`
- [ ] AC-21: `HYSTERESIS_CENTER_RATIO === 0.1` / `HYSTERESIS_DELTA_RATIO === 0.2` であり、`HYSTERESIS_CENTER_RATIO <= (VIEWPORT_MARGIN - 1) / 2` かつ `HYSTERESIS_DELTA_RATIO <= VIEWPORT_MARGIN - 1`（`VIEWPORT_MARGIN` は `@utils/spotSelection` から import して検証する。浮動小数点表現のため比較には 1e-12 の許容誤差を認める）

### 機能基準 C: `src/hooks/useSpotClusters.ts`（`src/hooks/__tests__/useSpotClusters.test.ts`）

- [ ] AC-22: 同一の `spots` 配列参照のまま `region` だけを3回変えて `rerender` しても、`createClusterIndex` の呼び出し回数は 1 回のまま（index が region 変化で再構築されない）
- [ ] AC-23: `spots` 配列を別インスタンスに差し替えて `rerender` すると `createClusterIndex` の呼び出し回数が 2 回になる
- [ ] AC-24: 近接 100 件・delta 0.6 で得られたクラスタに対し `getClusterExpansionRegion(cluster)` が、`latitude` / `longitude` がクラスタ座標と一致し `latitudeDelta === longitudeDelta` かつ `latitudeDelta < 0.6`（ズームインする）region を返す

### 機能基準 D: `src/components/common/ClusterBubble.tsx`（`src/components/common/__tests__/ClusterBubble.test.tsx`）

スタイルは `StyleSheet.flatten` して検証する。

- [ ] AC-25: `count={5}` のとき `cluster-bubble` の `width === 36` / `height === 36` / `borderRadius === 18`
- [ ] AC-26: `count={42}` のとき 44 / 44 / 22、`count={150}` のとき 52 / 52 / 26
- [ ] AC-27: `cluster-bubble` の `backgroundColor === colors.primary[500]`（`#f27f0d`）/ `borderColor === colors.white` / `borderWidth === 2.5`
- [ ] AC-28: `cluster-bubble-count` のテキストが `'42'`（`count={42}` のとき）で、`color === colors.white` / `fontSize === typography.label.fontSize`（12）/ `fontWeight === '700'`

### 機能基準 E: MapScreen 統合（`src/screens/__tests__/MapScreen.test.tsx`）

いずれも地図画面（アプリ起動直後のタブ初期画面）。位置情報は仙台中心（38.2682 / 140.8694）でモック済み。

- [ ] AC-29: 初期表示（delta 0.015）で `queryAllByTestId(/^cluster-marker-/)` が 0 件、`spot-marker-spot-1` と `spot-marker-spot-2` が表示される
- [ ] AC-30: 中心付近の 0.0005° グリッドに未訪問 200 件を置き `onRegionChangeComplete` を delta 0.6 で発火すると、`queryAllByTestId(/^cluster-marker-/)` が 1 件で、その `cluster-bubble-count` のテキストが `'200'`
- [ ] AC-31: 0.11° 間隔の 7×7 グリッドに2件ずつ（計 98 件）置き delta 0.6 を発火すると `queryAllByTestId(/^cluster-marker-/)` が 40 件、`queryAllByTestId(/^spot-marker-/)` が 0 件（合計が `MAX_TOTAL_MARKERS` 以下）
- [ ] AC-32: visited / wishlist のクラスタ除外 — 既存の `Rank filter exemption for visited/wishlist spots (#93)` の2テスト（delta 0.6 で `spot-marker-spot-1` / `spot-marker-spot-2` が表示され続ける）が**無変更で**通る
- [ ] AC-33: ヒステリシス（再計算しない）— `mockSpotsOverride` に lat 38.335 / lng 140.8694 / rank 5 の `spot-hyst` を加え、`onRegionChangeComplete` を `{ latitude: 38.2682, longitude: 140.8694, latitudeDelta: 0.1, longitudeDelta: 0.1 }` → `{ latitude: 38.2772, ...同 delta }`（中心移動 = delta の 9%）の順に発火すると、`spot-marker-spot-hyst` はレンダリングされない（2回目が採用されず、旧ビューポートのままであること）
- [ ] AC-34: ヒステリシス（再計算する）— AC-33 と同じ初期状態から2回目を `{ latitude: 38.2792, ...同 delta }`（中心移動 = delta の 11%）で発火すると、`spot-marker-spot-hyst` がレンダリングされる
- [ ] AC-35: クラスタタップ — AC-30 の状態でクラスタ Marker を `fireEvent.press` すると `jest.requireMock('react-native-maps').__mapViewMocks.animateToRegion` が呼ばれ、第1引数の `latitudeDelta` が 0.6 未満である
- [ ] AC-36: focusPrefecture — `fetchSpotsByPrefecture` が県域内 0.001° グリッドの 100 件を返す状態で県域 region（`{ latitude: 38.315, longitude: 140.915, latitudeDelta: 0.2, longitudeDelta: 0.2 }`）を発火すると、`queryAllByTestId(/^cluster-marker-/)` が 1 件以上あり、`cluster-marker-*` と `spot-marker-*` の合計が 130 以下
- [ ] AC-37: `grep -n "selectVisibleSpots" src/screens/MapScreen.tsx` の結果が 0 件（スポット選択がクラスタリング経路に一本化されている）
- [ ] AC-38: ラベルルール不変 — 既存の `Zoom-based label visibility` の3テストが**無変更で**通る

### パフォーマンス基準（Jest で機械チェック）

- [ ] P-1: `createClusterIndex` に 5,000 件（日本全域に決定的に分散配置）を渡し、`buildClusterView` を全国相当の region（delta 5）で呼ぶと `clusters.length <= 40` かつ `individualSpots.length <= 60`（Issue #67 の全国展開規模での上限保証）
- [ ] P-2: P-1 と同じ index に対し delta 0.015 / 0.1 / 0.6 / 5 の4通り × 5 回、計 20 回 `buildClusterView` を呼んでも、毎回 `clusters.length + individualSpots.length <= MAX_TOTAL_MARKERS`
- [ ] P-3: MapScreen に初期ビューポート内の未訪問 1,109 件（現 DB 全件規模）を与えたとき、初期表示（delta 0.015）で `queryAllByTestId(/^spot-marker-/)` がちょうど 60 件、`queryAllByTestId(/^cluster-marker-/)` が 0 件
- [ ] P-4: P-3 と同じ 1,109 件で `onRegionChangeComplete` を delta 0.6 で発火すると、`queryAllByTestId(/^cluster-marker-/)` がちょうど 1 件、`queryAllByTestId(/^spot-marker-/)` が 0 件、その `cluster-bubble-count` のテキストが `'1109'`（1,109 個のカスタムマーカーが 1 個のバブルに畳まれる）

### UI基準（native-only・人間ゲートで実機確認）

すべて実機 iPhone + EAS Development Build（`/dev` でメトロ起動）で確認する。Expo Web では `react-native-maps` がスタブに解決されるため検証できない。Maestro フローは追加しない。

- [ ] UI-1 (native-only) **【本 Issue の最重要基準】**: 地図画面で「ピンチアウトして日本全体が入るまでズームアウト → ピンチインして初期ズーム相当まで戻す」を**連続20往復**行ってもアプリが落ちない。操作後に iPhone の 設定 > プライバシーとセキュリティ > 解析と改善 > 解析データ を開き、**操作開始時刻以降に `JetsamEvent-*` および goshuin アプリ名を含む `.ips` が新規生成されていない**ことを確認する
- [ ] UI-2 (native-only): 全国が入るところまでズームアウトすると、件数の数字が入ったオレンジ（`colors.primary[500]` = `#f27f0d`）の円形クラスタバブルが1つ以上表示される
- [ ] UI-3 (native-only): クラスタバブルをタップすると地図がそのバブルの位置にズームインし、そのバブルがより小さいクラスタまたは個別ピンに分解される
- [ ] UI-4 (native-only): 訪問済み（`colors.pin.shrineVisited` = `#EF4444` / `colors.pin.templeVisited` = `#A855F7`）と行きたい（`colors.pin.wishlisted` = `#F59E0B`）のピンは、全国レベルまでズームアウトしてもクラスタバブルに吸収されず個別ピンのまま表示され続ける
- [ ] UI-5 (native-only): 起動直後の初期ズーム（`latitudeDelta = 0.015`）ではクラスタバブルが1つも表示されず、個別ピンのみが表示される（#93 で修正したデフォルトズームの閾値問題を再発させない）
- [ ] UI-6 (native-only): 地図を画面幅の1割未満だけドラッグしても、ピンやバブルが一斉に消えたり出たりしない（ヒステリシスの効果確認）
- [ ] UI-7 (native-only): コレクション画面から県をタップした県表示（focusPrefecture）で県域にフィットしたとき、クラスタバブルが表示され、タップでズームインできる

### 品質基準

- [ ] Q-1: 全テストが通る（`npm test`）
- [ ] Q-2: Lint エラーがない（`npm run lint`）
- [ ] Q-3: 型エラーがない（`npm run typecheck`）
- [ ] Q-4: `jest.config.js` の `transformIgnorePatterns` に `supercluster` と `kdbush` が含まれ、`src/utils/__tests__/spotClustering.test.ts` が実物の supercluster を使って通る（`jest.mock('supercluster')` および `moduleNameMapper` による差し替えを使っていない）
- [ ] Q-5: `package.json` の `dependencies` に `supercluster`、`devDependencies` に `@types/supercluster` が入っており、`react-native-map-clustering` はどちらにも入っていない

## スコープ外（やらないこと）

契約書に無いことは実装しない。

- **`react-native-map-clustering` の採用**（上記「ライブラリ選定」の結論どおり不採用）
- **サーバー側 bounds フェッチへの移行**: `useSpots` は `fetchAllActiveSpots` の全件取得のまま。`fetchSpotsByBounds` の利用開始もしない（Issue #67 のスコープ）
- `src/utils/spotSelection.ts` の変更（`selectVisibleSpots` / `MAX_VISIBLE_SPOTS` = 80 / `VIEWPORT_MARGIN` = 1.2 は無変更で再利用する）
- ラベル表示ルールの変更（`LABEL_VISIBLE_DELTA` = 0.2 / `forceLabelVisible` / `shouldShowLabels` のロジックは現状維持）
- `LATITUDE_DELTA` / `LONGITUDE_DELTA`（0.015）の変更
- `SpotMarker` / `MapPin` / `getPinColor` の変更
- クラスタの展開アニメーション・スパイダーファイ（重なった点の放射展開）
- クラスタタップ時にクラスタ内訳をボトムシートで一覧表示すること（タップ動作はズームインのみ）
- クラスタバブルの色分け（種別・訪問状況に応じた配色）。単色 `colors.primary[500]` のみ
- 各種上限（`MAX_CLUSTER_BUBBLES` / `MAX_INDIVIDUAL_SPOTS` / `MAX_PINNED_SPOTS`）のデバイス性能・ズーム連動の動的調整。定数のみ
- 検索画面・`useSearchScreen` 等、地図画面以外へのクラスタリング適用
- 経度180度（アンチメリディアン）を跨ぐビューポートの対応（日本国内前提。#96 と同じ）
- Android 実機での UI 検証（direction.md の Phase 0 で iOS 先行リリースが基本線のため。Android は #67 以降にまとめて確認する）
- Sentry 等のクラッシュレポート基盤の導入・Jetsam ログの自動収集
- Maestro フローの追加（ピンチ・パンの再現が不安定なため。#96 と同じ判断）

## 注意事項

- **`jest.config.js` の変更を先にやる**。`supercluster` / `kdbush` を `transformIgnorePatterns` の allowlist に追加しないと、supercluster を import した瞬間に `SyntaxError: Cannot use import statement outside a module` で落ちる。両パッケージとも `"type": "module"` + `"exports": "./index.js"` の ESM
- **`@types/supercluster` は `export = Supercluster` 形式**。`expo/tsconfig.base` が `esModuleInterop: true` なので `import Supercluster from 'supercluster'` でよい。tsconfig の `paths` に `"@types/*": ["src/types/*"]` があるため、**`from '@types/supercluster'` と書いてはいけない**（`src/types/supercluster` に解決されて失敗する）
- **index の構築（`load`）は spots が変わったときだけ**。region 変化のたびに `createClusterIndex` を呼ぶと 5,000 件で毎回数十 ms かかり、本 Issue の目的（負荷削減）に反する。`useSpotClusters` の `useMemo` 依存配列を厳守する
- **pinned（visited / wishlist）は index に渡さない**。渡すとクラスタに吸収されて恒久策2が成立しない
- **クラスタ Marker の `key` に `count` を含める**（`` `${cluster.id}-${cluster.count}` ``）。`tracksViewChanges={false}` と組み合わせたとき、key が同じまま count だけ変わると iOS でバブルの数字が更新されない（react-native-maps の既知の挙動）
- **ヒステリシスの比較相手は「直近に採用した region」であって「直前に通知された region」ではない**。後者にすると微小移動が積み重なっても永久に再計算されなくなる。`setClusterRegion(prev => shouldRecomputeRegion(prev, r) ? r : prev)` の関数形式更新で、比較対象が採用済み state であることを保証する
- **ラベル表示にはヒステリシスをかけない**。`currentRegion` は現状のまま毎回更新する。かけると #93/#96 のラベルテストが崩れ、体感上もラベルの追従が遅れる
- **`HYSTERESIS_CENTER_RATIO`(0.1) / `HYSTERESIS_DELTA_RATIO`(0.2) は `VIEWPORT_MARGIN`(1.2) から導出した値**。`VIEWPORT_MARGIN` を変更する場合は両方を見直すこと（AC-21 がこの不変条件を守る）
- **`CLUSTER_MAX_ZOOM = 13` は「クラスタ化開始が `longitudeDelta ≈ 0.031`（初期 delta 0.015 の約2倍）」になるよう選んだ値**。初期ズームに閾値を近づけると #93 で修正した「デフォルトズームが閾値と一致してチラつく」問題が再発する
- **`getClusters` の返り値の型ナローイング**: cluster フィーチャと単独点フィーチャの union が返る。TypeScript strict では `'cluster' in feature.properties && feature.properties.cluster === true` の形の型ガード関数を用意して分岐する
- **`MAX_CLUSTER_BUBBLES` で切り捨てたクラスタのスポットは地図から消える**。極端な密度の viewport でのみ発生する意図的なトレードオフであり、`count` 降順で残すため密度の高い場所が優先的に残る
- **Hermes と TypedArray**: kdbush は `Float32Array` / `Int32Array` を使う。RN 0.81 の Hermes は対応済みだが、実機初回起動時にインデックス構築で引っかかりが出ないか UI-1 と併せて体感確認する
- 実機確認は **EAS Development Build 必須**（Expo Go では動かない）
- コミットは 1スライス = 1コミット（Conventional Commits）。推奨分割:
  1. `chore: add supercluster dependency and jest transform config`（package.json / jest.config.js）
  2. `feat: add spot clustering and region hysteresis utils`（`spotClustering.ts` / `regionHysteresis.ts` + ユニットテスト）
  3. `feat: add ClusterBubble component`（コンポーネント + テスト）
  4. `feat: cluster map markers to prevent zoom-out crash`（`useSpotClusters` / MapScreen / jest.setup.js / 既存テストの変更）
- 実装が契約と食い違う事実（supercluster の実挙動がクラスタ半径の目安表と乖離する等）を発見した場合は、契約書を黙って逸脱せず**本ファイルを更新してから**実装する

## 追補1: ズームアウト churn 対策（2026-08-02 UI-1 イテレーション1 FAIL 対応）

### 経緯

初回実装の実機確認（人間ゲート）で「クラスタ表示は機能するが、関東レベルまでズームアウトするとクラッシュする」ことが判明（UI-1 FAIL）。Metro ログに JS エラーなし = ネイティブ側のメモリキル。シードデータ 880 件での churn シミュレーションにより、**ズームアウト1回（東京中心 delta 0.015→8）で約166個の Marker が新規 mount** されることを確認した。原因は2つ:

1. supercluster の cluster_id は**クラスタ構成が変わる（マージが起きる）と変わる**。ズーム段階が下がるたびにマージ波が起き、大半のバブルの key が変わって unmount→mount される
2. `key` に count を含めているため、構成変化 = count 変化でも remount される

### 対策（本追補が正。矛盾する本文の記述を上書きする）

1. **クラスタ識別子の安定化**: `SpotCluster.id` を `cluster-<clusterId>` から **`cluster-<先頭 leaf の spotId>`**（`index.getLeaves(clusterId, 1)[0].properties.spotId`）に変更する。マージで生き残る系譜のバブルは key が変わらず、座標・件数のプロパティ更新だけで済む。`clusterId` フィールドは展開ズーム取得用に残す。leaf の取得は top-N 確定後の最大 `MAX_CLUSTER_BUBBLES` 件のみに行う
2. **クラスタ Marker の専用コンポーネント化（redraw 制御)**: `src/components/common/ClusterMarker.tsx` を新設。key が安定すると `tracksViewChanges={false}` のままでは count の数字が iOS で更新されないため、**count が変化したときだけ `tracksViewChanges` を true にし、`CLUSTER_REDRAW_MS`(350ms) 後に false へ戻す**。本文「注意事項」の「key に count を含める」は本追補で**廃止**（key は `cluster.id` のみ）
3. **クラスタ region 採用のデバウンス**: `CLUSTER_REGION_DEBOUNCE_MS`(300ms) を `regionHysteresis.ts` に追加。`handleRegionChangeComplete` は setClusterRegion を直接呼ばず、**trailing debounce** で最後のイベントから 300ms 後に採用判定する。連続ピンチ操作の中間ズーム段階の再計算がスキップされ、churn の波が「指を止めた回数」だけになる。`currentRegion`（ラベル用）には引き続きデバウンスをかけない

### 追加・変更する受入基準

- [ ] AC-39: 2つの近接グループ（各10件、中心 38.27/140.87 と 38.9/141.3）に対し、分離ズーム（両グループを覆う delta 0.9 = zoom 9）で得た2クラスタの id と、合流ズーム（delta 11.25 = zoom 5）で得た1クラスタの id を比較すると、**合流クラスタの id は分離時のどちらかの id と一致する**（leaf 由来の継続性。delta は両グループが1つの bbox に入るよう選ぶ）
- [ ] AC-40: `ClusterMarker` は初期レンダーで `tracksViewChanges` が `false`、`count` が変化すると `true` になり、`CLUSTER_REDRAW_MS` 経過後に `false` へ戻る（`count` 不変の再レンダーでは `false` のまま）
- [ ] AC-41: `CLUSTER_REGION_DEBOUNCE_MS === 300` / `CLUSTER_REDRAW_MS === 350`
- [ ] AC-42: MapScreen で `onRegionChangeComplete` を発火してもデバウンス経過前はクラスタ region が採用されず、`CLUSTER_REGION_DEBOUNCE_MS` 経過後に採用される（発火直後はマーカー不変、タイマー経過後に変化）
- AC-33/34（ヒステリシス）はデバウンス経過後の採用判定として維持（テストはタイマー advance を挟む形に変更）

### 既存テストの変更（追補分の明示的宣言）

`MapScreen.test.tsx` に fake timers でデバウンスを advance する `fireRegion` ヘルパーを導入し、`onRegionChangeComplete` を発火して選択結果を検証する以下のテストをヘルパー経由に変更する（アサーション内容は不変）: #93 exemption 2件 / #96 ポッピング・rank1 空マップ・AC-36 / #99 AC-30・31・33・34・35・P-4 / focusPrefecture の県域 region 発火 2件。`Zoom-based label visibility` 3件は `currentRegion` ベース（デバウンス対象外）のため無変更で通ることを維持する

### 本追補で変更しないこと

- 各上限定数（`MAX_CLUSTER_BUBBLES` 等）とヒステリシス定数・クラスタリングパラメータは不変
- フォールバック案（本追補で不採用、イテレーション2でも FAIL の場合に検討）: 広域ズームでの上限の段階引き下げ / クラスタバブルの事前レンダリング画像化（`Marker` の `image` prop）

## 追補2: クラスタバブルの画像化（2026-08-02 UI-1 イテレーション2 FAIL 対応）

### 経緯と診断

追補1適用後も実機でズームアウト操作によりクラッシュ（イテレーション2 FAIL）。診断ログ（`[#99diag]`）により以下の事実を確認した:

- JS ヒープは 12→25MB で健全、バブル ≤38 / 個別 ≤32 と上限内、デバウンスは設計どおり動作（regionEvent → adopted が1対1）
- それでも落ちる = 死因は **JS ではなくネイティブ側の累積メモリ**（Jetsam）
- 落下時点は全国からのズームイン復帰中（delta 0.077）で、瞬間負荷ではなく**セッション累積**で閾値を超えている

残存原因は **UIView ベースのカスタムマーカーのスナップショット機構**と結論:

1. 追補1の redraw 制御は remount を防ぐ代わりに「count 変化のたびに `tracksViewChanges=true` を 350ms 維持 = 対象バブルが毎フレーム再スナップショット」というネイティブ描画ストームを生んでいた
2. 新規バブルの mount も UIView 生成 + スナップショットを伴い、react-native-maps(iOS) はマーカー除去時のビュー解放が遅延しがち（既知挙動）

### 対策（本追補が正。追補1および本文の該当記述を上書きする）

**クラスタバブルを事前レンダリング PNG に置き換え、UIView スナップショット機構を完全に迂回する。**

1. **バケット表示**: 件数の表示を `2`〜`9`（実数）/ `10+` / `50+` / `100+` / `500+` / `1000+` の13バケットに変更する。判定は `getClusterBucket(count)`（`spotClustering.ts` に追加する純関数）:
   - `count < 10` → label = 実数, size 36 / `10 <= count < 50` → `10+`, size 44 / `50 <= count < 100` → `50+`, size 44 / `100 <= count < 500` → `100+`, size 52 / `500 <= count < 1000` → `500+`, size 52 / `1000 <=` → `1000+`, size 52
2. **画像アセット**: `assets/cluster-bubbles/bubble_<key>.png`（@1x/@2x/@3x、計39ファイル）。見た目は AC-25〜28 の仕様を踏襲（正円、`colors.primary[500]` 背景、`colors.white` 2.5px 枠、白 bold テキスト、`shadows.md` 相当の影を画像に焼き込み、影の余白として各辺+8px）。Playwright のヘッドレスブラウザで canvas 描画して生成する（生成スクリプトは成果物に含めない）
3. **ClusterMarker の簡素化**: 子ビュー・`tracksViewChanges` 制御・`CLUSTER_REDRAW_MS` を全廃し、`Marker` の `image` prop にバケット対応の require 済みアセットを渡す。バケット内の count 変化はネイティブ更新ゼロ、バケット遷移は `setImage`（スナップショット不要）のみ
4. **ClusterBubble.tsx は削除**（テストも削除）。leaf 安定 key（追補1-1）とデバウンス（追補1-3）は維持する

### 受入基準の差し替え

- AC-25〜28（ClusterBubble のスタイル基準）→ **廃止**。代わりに:
  - [ ] AC-43: `getClusterBucket` が count 2/9/10/49/50/99/100/499/500/999/1000/5000 に対して label `2/9/10+/10+/50+/50+/100+/100+/500+/500+/1000+/1000+`、size `36/36/44/44/44/44/52/52/52/52/52/52` を返す
  - [ ] AC-44: `ClusterMarker` が `image` prop にバケット対応アセットを設定し、子要素を持たない。count 12 と 48 で同一の image、48 と 52 で異なる image になる
  - [ ] AC-45: `assets/cluster-bubbles/` に 13 バケット × @1x/@2x/@3x = 39 ファイルが存在する
- AC-40（redraw 制御）→ **廃止**（機構ごと削除）。AC-41 は `CLUSTER_REGION_DEBOUNCE_MS === 300` のみに縮小
- AC-30 の `'200'` 表示アサーション → cluster-marker が 1 件でその image がバケット `100+` のアセットであること
- P-4 の `'1109'` 表示アサーション → 同様にバケット `1000+` のアセットであること
- UI-2 の「件数の数字が入った」→「バケット表示（実数または 10+/50+/100+/500+/1000+）の入った」に読み替え

### スコープ外（追補2）

- 個別ピン（SpotMarker）の画像化。バブル画像化後も実機クラッシュが残存する場合の次の一手として温存
- クラスタタップ動作・leaf 安定 key・デバウンス・各上限定数の変更
