# Issue #96: 地図表示方式の本格再設計（ビューポート内 × rank 優先 top-N 表示）

## 概要

Issue #93 で応急処置した地図のスポット表示を、「ズームレベル閾値による rank の一律カット」から「**ビューポート内 × rank 優先 top-N**」へ再設計する。

現方式の構造的問題:

1. **ポッピング**: `getMinRank` の閾値（0.5 / 0.1 / 0.02 / 0.005）をまたぐ瞬間にピンが一斉に出没する
2. **全件レンダリング**: 画面外のマーカーも全件描画しており、現在 1,109 件、Issue #67（rank3 全国展開）の 3,000〜5,000 件で破綻する
3. **地図が空になる**: rank の低いスポットしかないエリアではズームアウト時に何も表示されない

新方式では rank を「消す基準」ではなく「**見せる優先度**」として扱う。表示対象を現在のビューポート（+マージン）内に限定し、rank 降順（同 rank は中心距離昇順）で上位 N 件（N = 80）のみ描画する。訪問済み・行きたいリストのスポットはビューポート内なら N 枠の外でも常に表示する。「有名どころからだんだん見えてくる」という現在の思想は維持される。

- GitHub Issue: #96（`.claude/harness/feature-list.json` P1-05）
- ブランチ: `feature/issue-096-map-viewport-topn` → develop
- 前提: Issue #93（即修正）はマージ済み。#93 の visited/wishlist 常時表示（AC-7/8）は本方式でも維持する

## 関連ドキュメント

- [プロダクト方針 v2](../product/direction.md) — Phase 0「地図表示の即修正」の後続（P1-05）
- [Issue #93 契約書](./issue-093-map-spot-display-fixes.md) — 前提となる即修正
- [要件定義](../product/requirements.md) / [技術設計](../technical/tech-design.md)
- Issue #67（rank3 全国展開）— 本方式は 3,000〜5,000 件時代の描画上限を先に確保する。サーバー側 bounds フェッチは #67 のスコープ

## 詳細設計

### 対象ファイル

| ファイル                                    | 変更内容                                                                                                                                        |
| ------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/utils/spotSelection.ts`                | **新規**: 純関数 `selectVisibleSpots` と定数 `MAX_VISIBLE_SPOTS` / `VIEWPORT_MARGIN`、型 `MapRegion`                                            |
| `src/utils/__tests__/spotSelection.test.ts` | **新規**: 純関数のユニットテスト（受入基準 AC-1〜13 / P-1）                                                                                     |
| `src/screens/MapScreen.tsx`                 | `currentLatitudeDelta` state を region 全体の state に拡張。`getMinRank` / `minRank` を削除し `visibleSpots` を `selectVisibleSpots` に置き換え |
| `src/screens/__tests__/MapScreen.test.tsx`  | #93 の閾値前提テストの削除・置き換え（下記「既存テストの削除・変更一覧」）、新方式のテスト追加                                                  |

**変更しないファイル**: `src/hooks/useSpots.ts`（全件取得のまま）、`src/services/spots.ts`（`fetchAllActiveSpots` / `fetchSpotsByBounds` / `fetchSpotsByPrefecture` とも無変更）、`src/utils/geo.ts`（`calculateDistance` を import して再利用するのみ）、`src/components/common/SpotMarker.tsx`、`jest.setup.js`。

### 実装方針

#### 1. 純関数 `selectVisibleSpots`（`src/utils/spotSelection.ts` 新規）

`src/utils/` の既存規約（`geo.ts` / `regionBlocks.ts` と同じく camelCase のドメイン名ファイル + 名前付き export + 定数 export）に合わせる。react-native-maps には依存させず、構造的に互換な `MapRegion` 型を自前定義する（MapScreen の `Region` はそのまま渡せる）。

```ts
import type { Spot } from '@/types/supabase';
import { calculateDistance } from '@utils/geo';

/** react-native-maps の Region と構造互換（RN 非依存を保つため自前定義） */
export interface MapRegion {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
}

/** 描画マーカー数の上限（visited/wishlist を除く） */
export const MAX_VISIBLE_SPOTS = 80;
/** ビューポート判定のマージン係数。パン時の端のピン出没を減らす */
export const VIEWPORT_MARGIN = 1.2;

export function selectVisibleSpots(params: {
  spots: Spot[];
  region: MapRegion | null;
  visitedSpotIds: Set<string>;
  wishlistSpotIds: Set<string>;
  maxCount?: number; // デフォルト MAX_VISIBLE_SPOTS。テスト用に上書き可能
}): Spot[];
```

**選択アルゴリズム（region が非 null の場合）**:

1. **ビューポート判定**: `halfLat = (region.latitudeDelta / 2) * VIEWPORT_MARGIN`、`halfLng = (region.longitudeDelta / 2) * VIEWPORT_MARGIN` とし、`|spot.lat - region.latitude| <= halfLat && |spot.lng - region.longitude| <= halfLng` を満たすスポットを「ビューポート内」とする（**境界は inclusive**）
2. **pinned（必ず含める）**: ビューポート内のうち `visitedSpotIds.has(id) || wishlistSpotIds.has(id)` のスポットは**全件**結果に含める（`maxCount` を超えていても）
3. **残り枠の選択**: ビューポート内の pinned 以外（未訪問・非 wishlist）を以下の**決定的な順**でソートし、先頭から `max(0, maxCount - pinned.length)` 件を採用する
   - 第1キー: `rank` **降順**
   - 第2キー: `calculateDistance(region.latitude, region.longitude, spot.lat, spot.lng)` **昇順**（`@utils/geo` の Haversine を再利用）
   - 第3キー: `id` **昇順**（文字列比較。同値タイの決定性保証）
4. **結果**: pinned + 採用分。よって `結果件数 <= max(maxCount, pinned 件数)` が常に成り立つ

**region が null の場合のフォールバック**（位置情報未確定時。現在の MapScreen では `location` が null の間は `useSpots` が空配列を返すため実質的に到達しないが、純関数として挙動を確定する）:

- ビューポート判定をスキップし、全 spots を対象に同じ選択を行う
- pinned = visited/wishlist の**全件**
- 残り枠は rank 降順 → `id` 昇順（中心が無いため距離キーは使わない）で `max(0, maxCount - pinned.length)` 件

**その他の規約**:

- 入力配列 `spots` を**破壊しない**（`sort` 前にコピー）
- 同一入力に対して常に同一の結果（決定的）。返り値の並び順も決定的にする（pinned → 採用分の順で安定）
- 距離はソート前に各候補につき1回だけ計算する（comparator 内で `calculateDistance` を毎回呼ばない）
- 経度180度（アンチメリディアン）跨ぎは考慮しない（日本国内前提。スコープ外に明記）

#### 2. MapScreen の変更（`src/screens/MapScreen.tsx`）

```ts
// Before
const [currentLatitudeDelta, setCurrentLatitudeDelta] = useState(LATITUDE_DELTA);
// After: region 全体を保持（初期値 null = まだ onRegionChangeComplete が来ていない）
const [currentRegion, setCurrentRegion] = useState<Region | null>(null);

// 実効 region: ユーザー操作前は location ベースの初期 region（initialRegion と同一値）を使う
const effectiveRegion = useMemo<Region | null>(
  () =>
    currentRegion ??
    (location
      ? {
          latitude: location.latitude,
          longitude: location.longitude,
          latitudeDelta: LATITUDE_DELTA,
          longitudeDelta: LONGITUDE_DELTA,
        }
      : null),
  [currentRegion, location]
);
```

- **`getMinRank` 関数と `minRank` 変数を削除する**。ファイル冒頭 L30 の「getMinRank の閾値(0.02)と一致させない…」コメントも削除し、`LATITUDE_DELTA` の値 0.015 自体は変更しない
- `visibleSpots` を置き換える:

```ts
const visibleSpots = useMemo(
  () =>
    selectVisibleSpots({
      spots: displaySpots,
      region: effectiveRegion,
      visitedSpotIds,
      wishlistSpotIds,
    }),
  [displaySpots, effectiveRegion, visitedSpotIds, wishlistSpotIds]
);
```

- `handleRegionChangeComplete` は `setCurrentLatitudeDelta(r.latitudeDelta)` を `setCurrentRegion(r)` に変更。`skipRegionChangeRef` / `setForceLabelVisible(false)` のロジックは**現状維持**
- **ラベル表示ルールは現状維持**: `shouldShowLabels = (effectiveRegion?.latitudeDelta ?? LATITUDE_DELTA) <= LABEL_VISIBLE_DELTA || forceLabelVisible`（LABEL_VISIBLE_DELTA = 0.2 のまま。初期状態の実効 delta は従来どおり 0.015）
- `displaySpots` のマージ、`focusSpotId` 遷移、`handleMarkerPress`、ボトムシート、フィルタ（`filterMode`）は無変更。`filterMode === 'visited'` 時は `useSpots` が visited のみ返し、それらはビューポート内なら全件 pinned されるため N にカットされない

#### 3. focusPrefecture（県表示）フローの挙動確定（調査済み）

- **データフロー無変更**: `fetchSpotsByPrefecture` → `setPrefectureSpots` → `displaySpots` にマージ、のパスはそのまま。マージ後の `displaySpots` に**同じ `selectVisibleSpots` を通す**
- **確定挙動**: `fitToCoordinates` のアニメーション完了後に `onRegionChangeComplete` が県域の region を報告し、以降は県域ビューポート内で選択される。県内スポット数が N (80) を超える県（例: 東京都の増強後データ）では、**visited/wishlist 全件 + 未訪問の rank 上位で計 80 件まで**が表示される。これは仕様（混みすぎ防止）であり、全件表示はしない
- **遷移中の一時状態（native-only）**: fetch 解決から `fitToCoordinates` アニメーション完了までの間、旧ビューポート外の県内スポットは描画されない。アニメーション完了で表示される。この一時状態は許容する
- **Jest での扱い**: `jest.setup.js` の MockMapView は region change を自動発火しないため、県表示のテストは `fireEvent(mapView, 'onRegionChangeComplete', 県域region)` で fitToCoordinates 完了状態を明示的に模す
- `forceLabelVisible` / `skipRegionChangeRef` / `fitToCoordinates` の edgePadding は無変更

### データ構造

新規の型は `MapRegion`（上記）のみ。`Spot` 型（`src/types/supabase.ts`）・DB スキーマの変更なし。

## 既存テストの削除・変更一覧（明示的宣言）

新方式では「delta 閾値で rank が一律カットされる」前提のテストが成立しなくなる。以下を**契約として宣言した上で**削除・変更する（勝手に消さない）。

### `src/screens/__tests__/MapScreen.test.tsx`

| #   | 対象テスト                                                                                                                                                        | 処置                                                                                 | 理由・置き換え先                                                                                                                                                                                                                                                                            |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `Rank filter exemption for visited/wishlist spots (#93)` › `visited/wishlist のいずれでもないスポットはズームアウトで非表示になる(rank フィルタ維持)`（#93 AC-9） | **削除**                                                                             | 「ズームアウト = rank カット」の前提が消滅。ズームアウトしてもビューポート内なら top-N 内で表示されるのが新仕様。置き換え: AC-18（top-N 選外による非表示）・P-2/P-3                                                                                                                         |
| 2   | `Default zoom level (#93)` › `rank 2 スポットは初期表示とデフォルト近傍(0.019)で表示され、閾値帯外(0.021)で非表示になる`（#93 AC-11）                             | **削除**                                                                             | 「delta 0.021 で rank2 が消える」閾値前提が消滅。置き換え: AC-16（ポッピング解消: 0.015 → 0.019 → 0.021 → 0.1 で表示され続ける）                                                                                                                                                            |
| 3   | モックデータ `mockSpots` の `spot-2` 座標（lat 38.28 / lng 140.88）                                                                                               | **変更**（例: lat 38.272 / lng 140.872 へ）                                          | 初期実効ビューポート（中心 38.2682/140.8694、delta 0.015、マージン込み half = 0.009 → lat 38.2592〜38.2772 / lng 140.8604〜140.8784）の**外**にあり、新方式では初期表示されず `renders spot markers` 等の既存テスト多数が破損するため。`useSpotDetail` モック内の `spot-2` 座標も整合させる |
| 4   | `focusPrefecture` › `prefectureSpots は既存 spots に追加してマーカー表示される`                                                                                   | **変更**                                                                             | fetch 解決後に `fireEvent(mapView, 'onRegionChangeComplete', { latitude: 38.31, longitude: 140.91, latitudeDelta: 0.2, longitudeDelta: 0.2 })`（県域を覆う region）を発火してからマーカー4件を assert する（fitToCoordinates 完了の模擬）                                                   |
| 5   | `focusPrefecture` › `focusPrefecture が消えると prefectureSpots がクリアされる`                                                                                   | **変更**                                                                             | #4 と同じ region 発火を追加し、「表示→クリア」の順で検証する（現状は表示確認なしの null assert のみで、region 未発火だと表示確認が成立しないため）                                                                                                                                          |
| 6   | `Default zoom level (#93)` › `initialRegion のデフォルト delta は 0.015 である...`（#93 AC-10）                                                                   | **維持**（アサーション無変更。テスト名から削除済み関数 getMinRank への言及のみ除去） | `initialRegion` は新方式でも 0.015 のまま                                                                                                                                                                                                                                                   |
| 7   | `Rank filter exemption (#93)` › ズームアウトでも訪問済み / 行きたいスポットが表示され続ける 2 テスト（#93 AC-7/8）                                                | **維持**（無変更で通ること自体が受入基準 AC-14/15）                                  | visited/wishlist 常時表示は新方式でも維持（delta 0.6 のビューポートは両スポットを含む）                                                                                                                                                                                                     |
| 8   | `Zoom-based label visibility` の 3 テスト                                                                                                                         | **維持**（#3 の座標変更以外は無変更）                                                | ラベルルールは現状維持のため                                                                                                                                                                                                                                                                |

上記以外の `MapScreen.test.tsx` のテスト（検索バー・FAB・フィルタ・ボトムシート・位置情報バナー等）はすべて**無変更で通る**こと（#3 の座標修正の影響のみ許容）。

### その他のテストファイル

`src/services/__tests__/spots.test.ts`・`src/hooks/__tests__/useSpots.test.ts`・`src/utils/__tests__/geo.test.ts` は**一切変更しない**。

## テスト方針

TDD（t-wada 流）で Red → Green → Refactor。

- **純関数を厚くテストする**（`src/utils/__tests__/spotSelection.test.ts`）。`geo.test.ts` と同様の describe 構成（関数ごと + constants）。`Spot` 全フィールドを持つフィクスチャは `makeSpot(overrides)` ヘルパーで生成する（`prefecture: null` 等の必須フィールドを埋める）
- MapScreen 統合テストは既存パターンを踏襲: `mockSpotsOverride` によるスポット差し替え、`fireEvent(mapView, 'onRegionChangeComplete', region)` によるビューポート操作、`mockWishlistSpotIds` の `let` 差し替え。大量スポットは `Array.from({ length: 1109 }, ...)` で初期ビューポート内（lat 38.2682±0.004 / lng 140.8694±0.003 のグリッド等）に決定的に生成する
- マーカー数のカウントは `queryAllByTestId(/^spot-marker-gen-/)` のように testID プレフィックスの正規表現で行う（`current-location-marker` と衝突しない）
- 実機の体感（ポッピング解消・パン時の端の挙動）は Expo Web / Jest では検証不能のため **native-only** として人間ゲートに割り当てる

## 受入基準（Acceptance Criteria）

qa-evaluator エージェントがこの基準に基づいて合否判定を行う。

### 機能基準 A: 純関数 `selectVisibleSpots`（`src/utils/__tests__/spotSelection.test.ts`）

ビューポート判定（region: 中心 38.2682/140.8694、latitudeDelta 0.02、longitudeDelta 0.02 → マージン込み half = 0.012 で検証）:

- [ ] AC-1: 生ビューポート外・マージン内のスポット（例: lat = 中心 + 0.011、lng = 中心）は結果に**含まれる**（マージン 1.2 の検証）
- [ ] AC-2: マージン外のスポット（例: lat = 中心 + 0.013）は結果に**含まれない**
- [ ] AC-3: 境界ちょうど（lat = 中心 + 0.012）のスポットは**含まれる**（inclusive）

選択順序（`maxCount` をテスト用の小さい値で上書きして検証）:

- [ ] AC-4: `maxCount: 3` でビューポート内に rank 5/4/3/2/1 の未訪問スポットが各1件あるとき、rank 5/4/3 の3件が返る（rank 降順）
- [ ] AC-5: `maxCount: 1` で同 rank の2件（中心に近い / 遠い）があるとき、近い方が返る（中心距離昇順）
- [ ] AC-6: `maxCount: 1` で同 rank・中心から等距離（対称位置）の2件 `id: 'a'` / `id: 'b'` があるとき、`'a'` が返る（id 昇順の決定的タイブレーク）

visited / wishlist の常時包含:

- [ ] AC-7: `maxCount: 2` でビューポート内に visited スポットが3件あるとき、3件**全件**返る（N 枠超過でも含まれる）
- [ ] AC-8: wishlist スポットについても AC-7 と同様
- [ ] AC-9: ビューポート**外**の visited / wishlist スポットは含まれない
- [ ] AC-10: `maxCount: 5` でビューポート内に visited 2件 + 未訪問 10件があるとき、返り値は5件（visited 2件 + rank 上位の未訪問3件）である（残り枠 = maxCount − pinned 件数）

フォールバック・その他:

- [ ] AC-11: `region: null` のとき、visited/wishlist 全件 + 残りを rank 降順 → id 昇順で埋めた `maxCount` 件以内が返る（ビューポート判定・距離キーなし。クラッシュしない）
- [ ] AC-12: `spots: []` のとき `[]` が返る
- [ ] AC-13: `MAX_VISIBLE_SPOTS === 80`・`VIEWPORT_MARGIN === 1.2` であり、`maxCount` 省略時はビューポート内の未訪問 100 件から 80 件が返る
- [ ] AC-14: 同一入力で2回呼ぶと同一の id 配列が返り（決定性）、入力の `spots` 配列は呼び出し後も元の順序のまま（非破壊。`toEqual` で検証）

### 機能基準 B: MapScreen 統合（`src/screens/__tests__/MapScreen.test.tsx`）

- [ ] AC-15: `src/` 配下に `getMinRank` の出現が 0 件である（`grep -rn "getMinRank" src/` が空。関数削除の確認）
- [ ] AC-16: ポッピング解消 — 初期ビューポート内の rank 2 未訪問スポット（例: lat 38.269 / lng 140.870）が、初期表示・`onRegionChangeComplete` で delta 0.019 / 0.021 / 0.1 のいずれに変えても表示され続ける（旧方式の閾値 0.02 / 0.1 をまたいでも消えない）
- [ ] AC-17: ビューポート外の非表示 — `mockSpotsOverride` に東京座標（lat 35.6812 / lng 139.7671）の rank 5 スポットを加えても、初期表示（仙台中心・delta 0.015）ではそのマーカーがレンダリングされない
- [ ] AC-18: top-N 選外の非表示（#93 AC-9 の置き換え）— 初期ビューポート内に同 rank の未訪問スポットを 81 件、中心からの距離が単調増加する位置（例: lat = 38.2682 + i × 0.00005、i = 0..80）に生成したとき、マーカーは 80 件で、**中心から最遠の1件のみ**レンダリングされない
- [ ] AC-19: 地図が空にならない — rank 1 のスポットのみ（ビューポート中心付近）の状態で delta 0.6 にズームアウトしても、そのマーカーが表示される（旧方式では minRank 5 で非表示だったケース）
- [ ] AC-20: visited 常時表示の維持（#93 AC-7 継承）— 既存テスト「ズームアウト(minRank 5 相当)でも訪問済みスポットのマーカーは表示され続ける」が**無変更で**通る
- [ ] AC-21: wishlist 常時表示の維持（#93 AC-8 継承）— 既存テスト「ズームアウトでも行きたいリストのスポットのマーカーは表示され続ける」が**無変更で**通る
- [ ] AC-22: focusPrefecture — 県 spots の fetch 解決後、県域を覆う region で `onRegionChangeComplete` を発火すると、既存 spots と県 spots のマーカーが表示される（削除・変更一覧 #4 の変更後テスト）
- [ ] AC-23: focusPrefecture の件数上限 — `fetchSpotsByPrefecture` が未訪問 100 件（県域内グリッド生成）を返すとき、県域 region 発火後のスポットマーカー総数は 80 件である
- [ ] AC-24: ラベルルール不変 — 既存「Zoom-based label visibility」の3テストが（mockSpots 座標修正以外）無変更で通る

### パフォーマンス基準（Jest で機械チェック）

- [ ] P-1: `selectVisibleSpots` に 5,000 件（全件ビューポート内・未訪問）を渡しても返り値は 80 件である（Issue #67 の全国展開規模での上限保証。`spotSelection.test.ts`）
- [ ] P-2: MapScreen に初期ビューポート内の未訪問スポット 1,109 件（現 DB 全件規模）を与えたとき、レンダリングされるスポットマーカーはちょうど 80 件である（1,109 件全件レンダリングが起きない。`MapScreen.test.tsx`）
- [ ] P-3: P-2 の状態で top-80 に入らないスポット（rank 1・選外確実）1件を `mockWishlistSpotIds` に加えると、マーカー総数は 80 件のままで、その wishlist スポットのマーカーが**含まれる**（pinned が枠を1つ置き換える。上限は常に `max(80, pinned 件数)` で抑えられる）

### UI基準（native-only・人間ゲートで確認）

いずれも地図画面（アプリ起動直後のタブ初期画面）。実機 iPhone + EAS Development Build（`/dev`）で確認する。Maestro フローは追加しない（ピンチ・パンの再現が不安定なため実機目視）。

- [ ] UI-1 (native-only): ピンチでズームイン/アウトを連続して行っても、ピンが一斉に出没するポッピングが発生しない（増減が漸進的である）
- [ ] UI-2 (native-only): 地図をパンしたとき、画面端のピンが頻繁に出没しない（マージン 1.2 の効果確認）
- [ ] UI-3 (native-only): 県〜全国レベルまでズームアウトしても地図が空にならず、かつ画面がピンで埋め尽くされない（概ね 80 本程度に収まる）
- [ ] UI-4 (native-only): コレクション画面から県をタップした県表示（focusPrefecture）で県内スポットが表示され、スポット数の多い県（東京都・増強データ適用後）でも地図操作が引っかからない
- [ ] UI-5 (native-only): 訪問済み（`colors.pin.shrineVisited` / `colors.pin.templeVisited`）・行きたい（`colors.pin.wishlisted`）のピンが、ズームアウトしてもビューポート内に留まる限り表示され続ける（#93 UI-2 の再確認）

### 品質基準

- [ ] Q-1: 全テストが通る（`npm test`）
- [ ] Q-2: Lint エラーがない（`npm run lint`）
- [ ] Q-3: 型エラーがない（`npm run typecheck`）

## スコープ外（やらないこと）

契約書に無いことは実装しない。

- **サーバー側 bounds フェッチへの移行**: `useSpots` は `fetchAllActiveSpots` の全件取得のまま。`fetchSpotsByBounds` の利用開始・変更もしない（Issue #67 のスコープ）
- `fetchAllActiveSpots` / `fetchSpotsByPrefecture` 等 `src/services/spots.ts` の変更
- ピンのクラスタリング
- ラベル表示ルールの変更（`LABEL_VISIBLE_DELTA = 0.2` / `forceLabelVisible` のロジックは現状維持）
- `LATITUDE_DELTA` / `LONGITUDE_DELTA`（0.015）の変更
- `SpotMarker` / `MapPin` コンポーネント・ピン色ロジック（`getPinColor`）の変更
- 検索画面・`useSearchScreen` 等、地図画面以外のスポット選択ロジックへの適用
- 経度180度（アンチメリディアン）を跨ぐビューポートの対応（日本国内前提）
- N (80) の動的調整（デバイス性能・ズームレベル連動等）。定数のみ

## 注意事項

- **距離の事前計算**: ソート comparator 内で `calculateDistance` を毎回呼ばず、候補ごとに1回計算してからソートする（候補は最大でもビューポート内件数）。将来 5,000 件規模でも region 変更ごとの計算は O(件数 + 候補 log 候補) に収まる
- **依存配列**: `visibleSpots` の `useMemo` 依存に `effectiveRegion` / `visitedSpotIds` / `wishlistSpotIds` / `displaySpots` を必ず含める。漏れると記録直後・パン直後にピンが更新されない
- **`effectiveRegion` の初期値**: `currentRegion` の初期値は null とし、`location` ベースのフォールバック（delta 0.015）で初期表示する。`useState(initialRegion)` のような location 依存の初期化はしない（初回レンダー時 location が null のため）
- **削除の徹底**: `getMinRank` 本体・`minRank` 変数・MapScreen L30 の閾値コメントをすべて削除する。`spotSelection.ts` 側に閾値ロジックを持ち込まない
- **mockSpots 座標変更（削除・変更一覧 #3）** の際は、同ファイル `useSpotDetail` モック内の重複データも座標を揃える（アサーションには影響しないが乖離を残さない）
- **大量スポット生成は決定的に**: `Math.random()` を使わず、index ベースのグリッド配置・rank 割り当て（例: `(i % 5) + 1`）で生成する。id はゼロ埋め（`gen-0000`）で辞書順 = 数値順にする
- **`selectVisibleSpots` の返り値順序**: レンダリングは key 付き Marker のため順序非依存だが、テストの安定のため決定的な順序（pinned → 採用分）を保つ
- コミットは 1スライス = 1コミット（Conventional Commits）。推奨分割: ① `feat: add selectVisibleSpots util`（純関数 + ユニットテスト）→ ② `feat: switch MapScreen to viewport top-N selection`（MapScreen 置き換え + 既存テストの削除・変更 + 統合テスト）
- 実装が契約と食い違う事実（例: MockMapView の挙動差）を発見した場合は、契約書を黙って逸脱せず本ファイルを更新してから実装する
