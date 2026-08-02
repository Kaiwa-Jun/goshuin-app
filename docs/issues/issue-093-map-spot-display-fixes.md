# Issue #93: 地図スポット表示の即修正: 1,000行フェッチ上限・訪問済みピンの消失・デフォルトズームの境界チラつき

## 概要

2026-08-02 の実装レビューで発見した3つの表示問題の即修正。リリース前（Phase 0）に必須の最小修正のみを対象とし、表示方式の本格再設計（ビューポート×rank優先 top-N）は P1-05 として別途行う。

1. **1,000行フェッチ上限**: `fetchAllActiveSpots` に range 指定がなく、Supabase（PostgREST）の既定 max-rows=1,000 で結果が切られる。DB は現在 1,010 件（東京増強分適用後 1,109 件、将来 3,000〜5,000 件）のため、スポットが不定に欠落する
2. **訪問済み・行きたいピンの消失**: `MapScreen` の rank フィルタ（`visibleSpots`）が訪問済み・wishlist スポットにも適用され、ズームアウトすると自分が記録したピンが地図から消える。コンセプト「集めるたび、地図があなたの旅になる」と矛盾
3. **デフォルトズームが閾値境界と一致**: `LATITUDE_DELTA = 0.02` が `getMinRank` の閾値 `> 0.02` とちょうど一致しており、わずかなズーム操作で rank2以上⇔rank3以上の表示が切り替わりチラつく

- GitHub Issue: #93
- ブランチ: `feature/issue-093-map-spot-display-fixes` → develop

## 関連ドキュメント

- [プロダクト方針 v2](../product/direction.md) — Phase 0「地図表示の即修正」
- [要件定義](../product/requirements.md)
- [技術設計](../technical/tech-design.md)
- 本格再設計: `.claude/harness/feature-list.json` P1-05（getMinRank 再設計・ビューポートベース表示はそちらのスコープ）

## 詳細設計

### 対象ファイル

| ファイル                                   | 変更内容                                                                                                                          |
| ------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------- |
| `src/services/spots.ts`                    | 修正1: `fetchAllActiveSpots` を `.range()` ページネーションループに変更                                                           |
| `src/screens/MapScreen.tsx`                | 修正2: `visibleSpots` の rank フィルタから visited / wishlist を免除。修正3: `LATITUDE_DELTA` / `LONGITUDE_DELTA` を 0.015 に変更 |
| `src/services/__tests__/spots.test.ts`     | 修正1のテスト追加（`fetchAllActiveSpots` の describe を新設）                                                                     |
| `src/screens/__tests__/MapScreen.test.tsx` | 修正2・3のテスト追加。既存コメントの陳腐化修正（L373「Initial LATITUDE_DELTA is 0.02」）                                          |

変更しないファイル: `src/hooks/useSpots.ts`（`fetchAllActiveSpots` のシグネチャ・戻り値型が不変のため無変更）、`jest.setup.js`（既存の react-native-maps / expo-location モックで検証可能なため無変更）。

### 実装方針

#### 修正1: `fetchAllActiveSpots` のページネーション（`src/services/spots.ts`）

`.range(from, to)` による全件取得ループに変更する。

```ts
const SPOTS_PAGE_SIZE = 1000;

export async function fetchAllActiveSpots(): Promise<Spot[]> {
  const allSpots: Spot[] = [];

  for (let page = 0; ; page++) {
    const from = page * SPOTS_PAGE_SIZE;
    const { data, error } = await supabase
      .from('spots')
      .select('*')
      .eq('status', 'active')
      .order('id', { ascending: true })
      .range(from, from + SPOTS_PAGE_SIZE - 1);

    if (error) {
      console.warn('fetchAllActiveSpots error:', error.message);
      return [];
    }

    const batch = (data ?? []) as Spot[];
    allSpots.push(...batch);

    if (batch.length < SPOTS_PAGE_SIZE) break; // バッチが満杯でなければ最終ページ
  }

  return allSpots;
}
```

設計判断:

- **1ページ = 1,000行**（PostgREST 既定 max-rows と一致。`SPOTS_PAGE_SIZE` 定数として切り出す）
- **バッチが満杯（1,000行）の間ループ**。1,000行未満が返った時点で最終ページと判定して終了。全件数がちょうど 1,000 の倍数の場合は次ページが 0 行で返り、そこで終了する（+1 リクエストは許容）
- **`.order('id')` を追加**: order 指定なしのページネーションは PostgREST でページ間の行順が保証されず、重複・欠落が起こり得るため必須
- **戻り値型 `Promise<Spot[]>`・引数なしシグネチャは不変**（呼び出し元 `useSpots` は無変更）
- **エラーハンドリング維持**: どのページでエラーが返っても既存と同じく `console.warn` + 空配列 `[]` を返す（途中ページまでの部分結果は返さない。「エラー時は空配列」という既存の呼び出し規約を維持するため）

#### 修正2: visited / wishlist ピンの rank フィルタ免除（`src/screens/MapScreen.tsx`）

`visibleSpots` の filter 条件に免除条件を追加する。

```ts
const visibleSpots = useMemo(
  () =>
    displaySpots.filter(
      s => s.rank >= minRank || visitedSpotIds.has(s.id) || wishlistSpotIds.has(s.id)
    ),
  [displaySpots, minRank, visitedSpotIds, wishlistSpotIds]
);
```

- `visitedSpotIds`（`useUserStamps`）・`wishlistSpotIds`（`useWishlist`）はともに `Set<string>` で MapScreen に既存。`useMemo` の依存配列に両 Set を追加する
- rank フィルタ自体（visited / wishlist 以外への適用）は維持する

#### 修正3: デフォルトズームを閾値帯の中央へ（`src/screens/MapScreen.tsx`）

```ts
const LATITUDE_DELTA = 0.015;
const LONGITUDE_DELTA = 0.015;
```

- `getMinRank` の閾値帯 `(0.005, 0.02]`（= rank2以上表示）の中央付近 0.015 に変更。デフォルトズーム近傍のジッタ（実測 delta の ±揺れ）が閾値 0.02 を跨がなくなり、チラつきが解消される
- `LONGITUDE_DELTA` も 0.015 に揃える（現状 0.02 同士で正方アスペクトのため、片方のみの変更はアスペクト比を崩す）
- **`getMinRank` の閾値（0.5 / 0.1 / 0.02 / 0.005）と関数本体は一切変更しない**（P1-05 のスコープ）

### `LATITUDE_DELTA` 変更の影響調査（調査済み）

`LATITUDE_DELTA` は `MapScreen.tsx` のモジュールローカル定数で export されておらず、影響は同ファイル内の4箇所に閉じる。

| 使用箇所                                                        | 影響                                                                                                                                                                                                                                                                                   |
| --------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| L70 `useState(LATITUDE_DELTA)`（`currentLatitudeDelta` 初期値） | `getMinRank(0.015) = 2` = `getMinRank(0.02) = 2` のため**初期表示のピン集合は不変**。`shouldShowLabels` も `0.015 <= 0.2`（LABEL_VISIBLE_DELTA）で不変                                                                                                                                 |
| L96 AppState 復帰時の `animateToRegion`                         | 復帰後ズームが 0.02 → 0.015 にわずかに寄る（表示 rank 帯は同じ）                                                                                                                                                                                                                       |
| L126 `focusSpotId` 遷移時の `animateToRegion`                   | 検索・コレクション等から `focusSpotId` 付きで遷移した際の到達ズームが 0.015 に。到達後に `onRegionChangeComplete` が報告する実測 delta が境界 0.02 を跨がなくなり、**遷移直後のチラつきも副次的に解消**。`setSelectedSpotId` によるボトムシート表示ロジックには delta 非依存で影響なし |
| L252 `initialRegion`                                            | 初期表示がわずかにズームイン（約 2.2km → 約 1.7km 四方）。native-only で目視確認                                                                                                                                                                                                       |

他画面・既存テストへの影響:

- **他画面**: `PilgrimageDetailScreen.tsx`（独自値 0.01）・`SpotDetailContent.tsx`（独自値 0.005）は独自のリテラルを使用しており影響なし。`src/utils/react-native-maps.web.ts` は型定義のみで影響なし。`e2e/` の Maestro フローに delta 依存の記述なし（grep 確認済み）
- **既存テスト**: `MapScreen.test.tsx` の全アサーションは 0.015 でも成立する（ラベル表示テストは `0.015 <= 0.2` で真、モックスポットは rank 3 で初期 minRank 2 以上のため表示される）。ただし L373 のコメント「Initial LATITUDE_DELTA is 0.02」が陳腐化するため更新する。`useSpots.test.ts`・`spots.test.ts` の既存テストは delta 非依存で影響なし。`animateToRegion` は `jest.setup.js` のモックで `jest.fn()` 化されており値検証はされていないため破損しない

## テスト方針

TDD（t-wada 流）で Red → Green → Refactor。既存のモックパターンを踏襲する。

### `src/services/__tests__/spots.test.ts`（修正1）

既存のチェーンモック方式（`mockFrom` → `mockSelect` → `mockEq` → …）を踏襲し、`fetchAllActiveSpots` 用に `mockOrder` / `mockRange` を追加する。チェーンは `from('spots').select('*').eq('status','active').order('id', …).range(from, to)` で、`mockRange.mockReturnValueOnce({ data, error })` でページごとの応答を差し替える。1,000 件データは `Array.from({ length: 1000 }, (_, i) => ({ id: `spot-${i}`, … }))` で生成する。

### `src/screens/__tests__/MapScreen.test.tsx`（修正2・3）

- `useSpots` モックの `mockSpots` に低 rank スポット（rank 1〜3）を追加し、`mockVisitedSpotIds`（既存）と同様に `mockWishlistSpotIds` を `let` 変数化して `useWishlist` モックから返す（テストごとに差し替え可能にする）
- ズーム状態の変更は既存「Zoom-based label visibility」テストと同じく `fireEvent(mapView, 'onRegionChangeComplete', { latitudeDelta: …, … })` で行う
- デフォルト delta の検証は `getByTestId('map-view').props.initialRegion` で行う（`jest.setup.js` の MockMapView は props をそのまま View に spread するため参照可能）
- `jest.setup.js` は変更しない（react-native-maps / expo-location のモックは既存のもので足りる）

### native-only（実機確認・人間ゲート）

Expo Web では地図背景・ピンチ操作を検証できないため、実際の地図操作感（チラつきの解消・ズームアウト時のピン残存・初期ズームの見え方）は EAS Development Build を入れた実機 iPhone（`/dev`）で人間ゲートにて確認する。Maestro フローの追加は行わない（ピンチズームの再現が不安定なため実機目視とする）。

## 受入基準（Acceptance Criteria）

qa-evaluator エージェントがこの基準に基づいて合否判定を行う。

### 機能基準（Jest で機械チェック）

修正1: ページネーション（`src/services/__tests__/spots.test.ts`）

- [ ] AC-1: `fetchAllActiveSpots` は `range(0, 999)` を指定して1ページ目を要求し、1ページ目が 1,000 行（満杯）のとき続けて `range(1000, 1999)` で2ページ目を要求する（`mockRange` の呼び出し引数で検証）
- [ ] AC-2: 1ページ目 1,000 行 + 2ページ目 10 行のとき、戻り値は両ページを結合した 1,010 件の配列である
- [ ] AC-3: 1ページ目が 1,000 行未満（例: 500 行）のとき、`range` の呼び出しは1回のみで終了し、その 500 件を返す
- [ ] AC-4: クエリに `order('id', { ascending: true })` が含まれる（`mockOrder` の呼び出し引数で検証。ページ間の重複・欠落防止）
- [ ] AC-5: いずれかのページで `error` が返った場合、`console.warn` を呼び、空配列 `[]` を返す（2ページ目エラーのケースを含む。既存のエラーハンドリング規約の維持）
- [ ] AC-6: `fetchAllActiveSpots` のシグネチャ（引数なし・`Promise<Spot[]>`）は不変であり、`src/hooks/__tests__/useSpots.test.ts` の既存テストが**変更なしで**全て通る

修正2: visited / wishlist の rank フィルタ免除（`src/screens/__tests__/MapScreen.test.tsx`）

- [ ] AC-7: `onRegionChangeComplete` で `latitudeDelta: 0.6`（minRank 5 相当）にした状態でも、`visitedSpotIds` に含まれる rank 3 スポットのマーカー（`spot-marker-<id>`）が表示される
- [ ] AC-8: 同状態で、`wishlistSpotIds` に含まれる rank 3 以下のスポットのマーカーが表示される
- [ ] AC-9: 同状態で、visited / wishlist のいずれにも含まれない rank 3 のスポットのマーカーは表示されない（rank フィルタ自体は維持されている）

修正3: デフォルトズーム（`src/screens/__tests__/MapScreen.test.tsx`）

- [ ] AC-10: `map-view` の `initialRegion` は `latitudeDelta: 0.015` かつ `longitudeDelta: 0.015` である（props で検証）
- [ ] AC-11: 初期表示（delta 0.015）で rank 2 のスポットのマーカーが表示され、`onRegionChangeComplete` で `latitudeDelta: 0.019`（デフォルト近傍のジッタ想定・閾値帯内）にしても表示され続ける。`latitudeDelta: 0.021`（閾値帯外）にすると非表示になる（visited / wishlist に含まれないスポットで検証）
- [ ] AC-12: `MapScreen.tsx` の `getMinRank` 関数の閾値 `0.5` / `0.1` / `0.02` / `0.005` と返り値がすべて変更前と同一である（git diff で `getMinRank` 本体に変更行がないこと）

### UI基準（native-only・人間ゲートで確認）

いずれも地図画面（アプリ起動直後のタブ初期画面）。実機 iPhone + EAS Development Build（`/dev`）で確認する。

- [ ] UI-1 (native-only): 起動直後のデフォルトズームで、ピンチによる微小なズームイン/アウトを行ってもピンの表示セットが点滅的に増減しない（rank2以上⇔rank3以上の切替チラつきが発生しない）
- [ ] UI-2 (native-only): 訪問済みスポット（ピン色 `colors.pin.shrineVisited` / `colors.pin.templeVisited`）と行きたいスポット（`colors.pin.wishlisted`）が、県〜全国レベルまでズームアウトしても地図上に表示され続ける
- [ ] UI-3 (native-only): 東京増強データ（1,109 件）適用後の DB に対して、東京都心へ移動・ズームした際に rank 3〜4 の増強スポットのピンが表示される（1,000 件上限による欠落がない）

### 品質基準

- [ ] Q-1: 全テストが通る（`npm test`）
- [ ] Q-2: Lint エラーがない（`npm run lint`）
- [ ] Q-3: 型エラーがない（`npm run typecheck`）

## スコープ外（やらないこと）

以下はすべて **P1-05（表示方式の本格再設計）のスコープ**であり、本 Issue では実装しない。契約書に無いことは実装しない。

- `getMinRank` の閾値・段階の変更（0.5 / 0.1 / 0.02 / 0.005 はそのまま）
- ピンのクラスタリング
- ビューポートベースの表示（可視領域内のみ取得・描画する方式への変更）
- `fetchSpotsByBounds` への移行（`useSpots` は引き続き `fetchAllActiveSpots` で全件取得する）
- `fetchSpotsByPrefecture` / `searchSpotsByName` 等、他の fetch 関数へのページネーション適用（現状 1,000 行に達しないため対象外）
- `useSpots` のキャッシュ・再取得戦略の変更
- Maestro E2E フローの追加

## 注意事項

- 修正1のループは「バッチが満杯（= `SPOTS_PAGE_SIZE` 行）の間だけ継続」とし、無限ループ・オフバイワン（`range` の to は inclusive）に注意する
- 修正1でエラー時に部分結果を返さない（空配列を返す）のは既存規約の維持が理由。部分結果を返す設計変更はしない
- 修正2で `useMemo` の依存配列に `visitedSpotIds` / `wishlistSpotIds` を追加し忘れると、記録直後にピンが更新されない不具合になるため必ず含める
- `MapScreen.test.tsx` L373 のコメント「Initial LATITUDE_DELTA is 0.02, which is <= 0.08」は実装値（0.015）と定数名（LABEL_VISIBLE_DELTA = 0.2）に合わせて更新する（アサーション自体は変更不要）
- コミットは 1スライス = 1コミット（Conventional Commits）。修正1（fix: services）→ 修正2（fix: MapScreen filter）→ 修正3（fix: MapScreen delta）の3スライスを推奨
- `jest.setup.js` への新規モック追加は不要。追加したくなった場合はモック集約規約（expo モジュールは jest.setup.js に集約）に従うこと
