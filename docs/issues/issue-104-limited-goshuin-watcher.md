# Issue #104: P2-01 限定御朱印ウォッチャー MVP（情報ソース登録 + 巡回 + 表示）

## 概要

運営が登録した寺社の公式サイト / RSS を定期巡回し、変化したページだけを Claude Haiku 4.5 で構造化して「限定御朱印」情報としてアプリ内に表示する。競合45アプリがどれも持たない差別化の本丸（`docs/product/direction.md` Phase 2 の繰り上げ）。

パイプライン:

```
spot_info_sources（新規テーブル・運営が URL 登録）
   ↓ pg_cron 週2回（火・金 02:00 JST）
crawl-spot-sources（新規 Edge Function）
   fetch → HTML→テキスト → SHA-256 content_hash 比較
   → 変化したページのみ Claude Haiku 4.5 で構造化
   ↓ merge upsert
spot_aggregated_info（info_type='limited_goshuin'）
   ↓ 既存経路
useSpotInfo → SpotDetailContent / SpotCompactCard
   ↓ 新規
LimitedGoshuinSection（出典 URL + 取得日時 + 公式 SNS リンク）
```

- GitHub Issue: #104（feature-list P2-01）
- ブランチ: `feature/issue-104-limited-goshuin-watcher` → develop
- 確定済み設計方針: 2026-08-02 ユーザー合意（Issue 本文の「確定済みの設計方針」）。本契約書はそれを実装可能な粒度に落としたもので、方針自体は変更しない

## 関連ドキュメント

- [プロダクト方針 v2](../product/direction.md) — Phase 2「限定御朱印ウォッチャー MVP + サブスク導入」。**通知と課金は本 Issue のスコープ外**（次段階）
- [技術設計](../technical/tech-design.md) / [要件定義](../product/requirements.md)
- [Issue #102 契約書](./issue-102-first-run-experience.md) — 契約書の書式・既存テスト変更宣言の前例
- `supabase/functions/extract-spot-info/index.ts` — Claude API 呼び出し・env 取得・upsert の踏襲元
- `supabase/migrations/20260402000001_create_spot_aggregated_info.sql` — RLS パターンの踏襲元
- `.claude/skills/tdd-workflow/SKILL.md` — テスト規約

## 調査結果（実装方針の前提となる確定事実）

コードから確認済み（2026-08-02）。実装時にこの前提が崩れていたら契約書を先に更新する。

### 1. 表示経路は「マップのボトムシート」の1本のみ

| 経路                                                                     | `useSpotInfo` の呼び出し                                                                             | 到達可否                                                                                                          |
| ------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `SpotBottomSheet`（`src/components/spot-detail/SpotBottomSheet.tsx:41`） | あり。`spotInfo` を `SpotCompactCard`（compact 時）と `SpotDetailContent`（expanded 時）の両方に渡す | マップのピンタップで到達                                                                                          |
| `SpotDetailScreen`（`src/screens/SpotDetailScreen.tsx`）                 | **なし**。`SpotDetailContent` に `spotInfo` を渡していない                                           | `MapStack` にルート登録されているが `navigate('SpotDetail')` を呼ぶ箇所が **リポジトリ内に1件も無い**（到達不能） |

→ 本 Issue では `SpotBottomSheet` 経由の1本だけを対象にする。`SpotDetailScreen` の結線は**スコープ外**（到達不能なルートに手を入れない）。

### 2. Expo Web ではスポット詳細に到達できない → UI 検証は native-only

- `metro.config.js` は web で `react-native-maps` を `src/utils/react-native-maps.web.ts` に解決する。このスタブの `Marker` は素の `View` で `onPress` を持たないため、**web ではピンをタップできず `SpotBottomSheet` が開かない**
- 検索画面からの `navigate('Map', { focusSpotId })` 経路も `MapScreen.tsx:166` で `mapRef.current.animateToRegion(...)` を呼ぶが、スタブの `MapView`（`View`）にこのメソッドは無く例外になる

→ **本 Issue に Expo Web の UI 基準は置かない**。見た目・トークンの検証は Jest の `toHaveStyle` による機械チェック（AC-D 群）と実機目視（N 群）に分割する。

### 3. `spot_aggregated_info.info_type` に DB 側の制約は無い

`20260402000001_create_spot_aggregated_info.sql` の `info_type` は素の `TEXT`（CHECK 制約なし）。`UNIQUE (spot_id, info_type)` があるため `onConflict: 'spot_id,info_type'` の upsert がそのまま使える。**`'limited_goshuin'` の追加に既存テーブルの migration は不要**（TypeScript の union 追加のみ）。

### 4. `info_data` に配列を入れる前例がある

`access_notes` は配列をそのまま格納しており、`parseAggregatedInfo` は `Array.isArray(data)` 分岐と legacy `{ value }` 分岐を持つ（`src/hooks/useSpotInfo.ts:28-37`）。ただし `SpotAggregatedInfo.info_data` の TS 型は `Record<string, unknown>` のため、配列を入れると呼び出し側で `as unknown as` が必要になる。**`limited_goshuin` は配列ではなくオブジェクト（`{ items: [...], fetched_at }`）を格納**して、この二重キャストを避ける。

### 5. Lint / 型チェックは `supabase/functions/` を見ない

- `.eslintrc.js` の `ignorePatterns` に `supabase/functions/` がある
- `tsconfig.json` の `exclude` に `supabase/functions` がある

→ Edge Function のコードは `npm run lint` / `npm run typecheck` の対象外。**品質担保は Deno テスト（純粋関数）＋レビューで行う**。逆に、Edge Function 側に React Native の import を混ぜても CI では検出できないため注意する。

### 6. Jest は Deno コードをテストできない

`jest.config.js` の `testMatch` は `**/__tests__/**/*.test.{ts,tsx}` と `**/*.test.{ts,tsx}`。Deno テストの命名を `*_test.ts`（アンダースコア）にすれば Jest には拾われない。**Deno テストは必ず `crawl_test.ts` 形式にする**（`crawl.test.ts` にすると Jest が拾って落ちる）。

### 7. ローカルに `deno` / `supabase` CLI が未インストール

`which deno` / `which supabase` はいずれも not found（2026-08-02）。Deno テストとデプロイは manual-ops 扱いにし、導入手順を明記する。

### 8. 既存のテーマトークン・パターン

- 色は `@theme/colors`（`primary[500]` = `#f27f0d`、`gray[400]` = `#9CA3AF` 等）、余白は `@theme/spacing` / `borderRadius`、文字は `@theme/typography`。**直値禁止**
- 外部リンクは React Native の `Linking`（`src/screens/ErrorScreen.tsx` が `Linking.openSettings()` を使用。`expo-linking` は未導入なので導入しない）
- `@expo/vector-icons` は `jest.setup.js` でモック済み（`MaterialIcons` は `name` をテキストとして描画する）
- 日付整形ユーティリティは `src/utils/` に**存在しない**（`formatDistance` のみ）

## 詳細設計

### 対象ファイル

#### 新規

| ファイル                                                              | 内容                                                                                                                   |
| --------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `supabase/migrations/20260802000000_create_spot_info_sources.sql`     | `spot_info_sources` テーブル + インデックス + RLS                                                                      |
| `supabase/cron/schedule_crawl_spot_sources.sql`                       | pg_cron 登録 SQL（**ユーザーが SQL Editor で実行**。鍵はプレースホルダ + Vault 参照）                                  |
| `supabase/functions/_shared/crawl.ts`                                 | Edge Function の純粋関数（URL 検証 / 認可 / HTML→テキスト / SHA-256 / Claude 応答パース / 正規化 / マージ / 締切判定） |
| `supabase/functions/_shared/crawl_test.ts`                            | 上記の Deno ユニットテスト                                                                                             |
| `supabase/functions/crawl-spot-sources/index.ts`                      | Edge Function 本体（I/O とオーケストレーション）                                                                       |
| `supabase/functions/crawl-spot-sources/deno.json`                     | `extract-spot-info/deno.json` と同内容                                                                                 |
| `src/components/spot-detail/LimitedGoshuinSection.tsx`                | 限定御朱印セクション（full / compact）+ 純粋関数 export                                                                |
| `src/components/spot-detail/__tests__/LimitedGoshuinSection.test.tsx` | 上記のテスト                                                                                                           |

#### 変更

| ファイル                                                          | 変更内容                                                                                                                                                                                      |
| ----------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/types/supabase.ts`                                           | `SpotAggregatedInfo.info_type` の union に `'limited_goshuin'` を追加。`LimitedGoshuinItem` / `LimitedGoshuinInfo` / `SpotInfoSource` / `SpotSnsLink` を追加                                  |
| `src/services/spotInfo.ts`                                        | `fetchSpotSnsLinks(spotId)` を追加（既存2関数は無変更）                                                                                                                                       |
| `src/hooks/useSpotInfo.ts`                                        | `ParsedSpotInfo` に `limitedGoshuin` / `snsLinks` を追加。`parseAggregatedInfo` に `limited_goshuin` の分岐を追加。`useSpotInfo` が集約情報と SNS リンクを `Promise.all` で並行取得してマージ |
| `src/components/spot-detail/SpotDetailContent.tsx`                | `SpotInfoSection` の直後に `LimitedGoshuinSection variant="full"` を描画（props シグネチャは無変更）                                                                                          |
| `src/components/spot-detail/SpotCompactCard.tsx`                  | `SpotInfoSection` の直後に `LimitedGoshuinSection variant="compact"` を描画（props シグネチャは無変更）                                                                                       |
| `src/hooks/__tests__/useSpotInfo.test.ts`                         | `fetchSpotSnsLinks` のモック追加 + テスト追加（既存アサーションは無変更）                                                                                                                     |
| `src/services/__tests__/spotInfo.test.ts`                         | `fetchSpotSnsLinks` のテスト追加（既存アサーションは無変更）                                                                                                                                  |
| `src/components/spot-detail/__tests__/SpotDetailContent.test.tsx` | 限定御朱印表示のテスト追加（既存は無変更）                                                                                                                                                    |
| `src/components/spot-detail/__tests__/SpotCompactCard.test.tsx`   | compact チップのテスト追加（既存は無変更）                                                                                                                                                    |

#### 変更しないファイル

`src/components/spot-detail/SpotInfoSection.tsx` とそのテスト、`src/components/spot-detail/SpotBottomSheet.tsx` とそのテスト、`src/screens/SpotDetailScreen.tsx`、`src/screens/MapScreen.tsx`、`src/navigation/` 配下すべて、`src/hooks/useSpotDetail.ts` / `useSpotStamps.ts`、`supabase/functions/extract-spot-info/`、`supabase/migrations/` の既存ファイル、`supabase/seeds/` 配下すべて、`jest.setup.js`、`jest.config.js`、`.eslintrc.js`、`tsconfig.json`、`package.json`。

### データ構造

#### テーブル `spot_info_sources`

```sql
CREATE TABLE public.spot_info_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  spot_id UUID NOT NULL REFERENCES public.spots(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  source_type TEXT NOT NULL CHECK (source_type IN ('official', 'rss', 'sns_link')),
  enabled BOOLEAN NOT NULL DEFAULT true,
  content_hash TEXT,
  last_crawled_at TIMESTAMPTZ,
  last_changed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 同一スポットに同一 URL を重複登録させない
CREATE UNIQUE INDEX idx_spot_info_sources_spot_url
  ON public.spot_info_sources (spot_id, url);

-- 巡回キュー用（未クロール優先 → 最終クロールが古い順）
CREATE INDEX idx_spot_info_sources_crawl_queue
  ON public.spot_info_sources (last_crawled_at NULLS FIRST)
  WHERE enabled = true AND source_type <> 'sns_link';

-- SNS リンク表示用
CREATE INDEX idx_spot_info_sources_sns
  ON public.spot_info_sources (spot_id)
  WHERE enabled = true AND source_type = 'sns_link';

-- RLS: 閲覧は全員可・書き込みは service_role のみ（spot_aggregated_info と同型）
ALTER TABLE public.spot_info_sources ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view spot info sources"
  ON public.spot_info_sources FOR SELECT USING (true);

CREATE POLICY "Service role can manage spot info sources"
  ON public.spot_info_sources FOR ALL USING (auth.role() = 'service_role');
```

`source_type` の意味:

| 値         | 巡回対象 | 用途                                                                        |
| ---------- | -------- | --------------------------------------------------------------------------- |
| `official` | ○        | 寺社の公式サイト（御朱印ページ / お知らせページ）                           |
| `rss`      | ○        | 公式サイトの RSS / Atom フィード                                            |
| `sns_link` | **×**    | 公式 X / Instagram 等。**スクレイピングせずアプリ内のリンク表示にのみ使う** |

#### `spot_aggregated_info` に書き込む行（`info_type='limited_goshuin'`）

| カラム             | 値                                                |
| ------------------ | ------------------------------------------------- |
| `spot_id`          | ソースの `spot_id`                                |
| `info_type`        | `'limited_goshuin'`                               |
| `info_data`        | 下記 JSON                                         |
| `source_stamp_ids` | `[]`（ユーザー投稿由来ではないため常に空）        |
| `confidence_score` | `0.9`（運営が登録した公式ソース由来のため固定値） |
| `last_reported_at` | そのクロールの `fetched_at`（ISO8601）            |
| `updated_at`       | 同上                                              |

`info_data`:

```json
{
  "items": [
    {
      "name": "夏詣限定御朱印",
      "period": "令和8年7月1日〜8月31日",
      "period_start": "2026-07-01",
      "period_end": "2026-08-31",
      "description": "書き置きのみ。初穂料500円",
      "source_url": "https://example.jp/goshuin",
      "fetched_at": "2026-08-03T17:00:00.000Z"
    }
  ],
  "fetched_at": "2026-08-03T17:00:00.000Z"
}
```

- `name` は必須。空文字・欠落の要素は破棄する
- `period` は**ページ上の表記そのまま**の文字列（表示に使う）。読み取れなければ `null`
- `period_start` / `period_end` は `YYYY-MM-DD` に明確に落とせる場合のみ設定（期限切れ判定に使う）。**推測しない**
- `source_url` / `fetched_at` は **Claude の出力ではなく Edge Function 側でコードから付与する**（捏造防止）
- トップレベル `fetched_at` はその upsert を行ったクロールの時刻

#### TypeScript 型（`src/types/supabase.ts`）

```ts
export type SpotInfoSourceType = 'official' | 'rss' | 'sns_link';

export interface SpotInfoSource {
  id: string;
  spot_id: string;
  url: string;
  source_type: SpotInfoSourceType;
  enabled: boolean;
  content_hash: string | null;
  last_crawled_at: string | null;
  last_changed_at: string | null;
  created_at: string;
  updated_at: string;
}

/** 表示に必要な最小フィールドだけを取る SNS リンク */
export interface SpotSnsLink {
  id: string;
  url: string;
}

export interface LimitedGoshuinItem {
  name: string;
  period: string | null;
  period_start?: string | null;
  period_end?: string | null;
  description?: string | null;
  source_url: string;
  fetched_at: string;
}

export interface LimitedGoshuinInfo {
  items: LimitedGoshuinItem[];
  fetched_at: string;
}

export interface SpotAggregatedInfo {
  id: string;
  spot_id: string;
  info_type:
    | 'parking'
    | 'affiliated_shrines'
    | 'reception_hours'
    | 'access_notes'
    | 'limited_goshuin'; // ← 追加
  // ...以降は無変更
}
```

### API / サービス層

```ts
// src/services/spotInfo.ts に追加（既存2関数は無変更）
export async function fetchSpotSnsLinks(spotId: string): Promise<SpotSnsLink[]> {
  const { data, error } = await supabase
    .from('spot_info_sources')
    .select('id, url')
    .match({ spot_id: spotId, source_type: 'sns_link', enabled: true })
    .order('created_at', { ascending: true });

  if (error) {
    console.warn('Failed to fetch spot sns links:', error.message);
    return [];
  }

  return data ?? [];
}
```

- `.eq()` の連鎖ではなく `.match()` を使う（既存テストの `from → select → eq` チェーンモックと衝突させず、新規テストのモックも1段で済むため）
- `.order('created_at')` で表示順を決定的にする（testID を index で振るため必須）
- エラー時は既存2関数と同じく `console.warn` + 空配列（throw しない）

### hook（`src/hooks/useSpotInfo.ts`）

```ts
export interface ParsedSpotInfo {
  parking?: { available: boolean; capacity?: number; location?: string };
  affiliatedShrines?: { name: string; details?: string }[];
  receptionHours?: { open?: string; close?: string; notes?: string };
  accessNotes?: { type: string; text: string }[];
  limitedGoshuin?: LimitedGoshuinInfo; // 追加
  snsLinks?: SpotSnsLink[]; // 追加
}
```

- `parseAggregatedInfo(items)` に `case 'limited_goshuin'` を追加する。`info_data` が**オブジェクトで `items` が配列のときのみ** `result.limitedGoshuin = { items, fetched_at }` を設定する。`items` が配列でない / 空配列のときは設定しない（`{}` のままにする）。`fetched_at` が文字列でなければ `item.last_reported_at` にフォールバックする
- `parseAggregatedInfo` のシグネチャ・戻り値の型・「全フィールド空なら null」の挙動は**変更しない**（既存7テストがそのまま通る）
- `useSpotInfo` は次のようにマージする:

```ts
Promise.all([fetchSpotAggregatedInfo(spotId), fetchSpotSnsLinks(spotId)])
  .then(([items, snsLinks]) => {
    const parsed = parseAggregatedInfo(items) ?? {};
    const merged: ParsedSpotInfo = snsLinks.length > 0 ? { ...parsed, snsLinks } : parsed;
    setSpotInfo(Object.keys(merged).length > 0 ? merged : null);
  })
  .catch(() => setSpotInfo(null))
  .finally(() => setIsLoading(false));
```

- 戻り値の型 `{ spotInfo, isLoading }`・`spotId` が空文字なら何も fetch しない挙動・`catch` で null にする挙動は無変更

### Edge Function `crawl-spot-sources`

#### 分割方針

Deno テスト可能な純粋関数を `supabase/functions/_shared/crawl.ts` に切り出し、`index.ts` は I/O（Supabase / fetch / Claude API）とオーケストレーションのみにする。Supabase CLI は相対 import された `_shared/` をバンドルに含めるため、`import { ... } from '../_shared/crawl.ts';` で参照する。

#### `_shared/crawl.ts` に置く純粋関数（すべて export）

| 関数                       | シグネチャ                                                                                                    | 仕様                                                                                                                                                                                                             |
| -------------------------- | ------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `isServiceRoleAuthorized`  | `(authHeader: string \| null, serviceRoleKey: string) => boolean`                                             | `authHeader === 'Bearer ' + serviceRoleKey` のときだけ true。`serviceRoleKey` が空文字なら常に false                                                                                                             |
| `isAllowedSourceUrl`       | `(url: string) => boolean`                                                                                    | `https:` のみ true。パース不能 / `http:` / `file:` / `data:` は false。ホスト名が `localhost`・`127.*`・`0.0.0.0`・`169.254.*`・`10.*`・`192.168.*`・`172.16〜31.*` に一致する場合は false（SSRF ガード）        |
| `isCrawlableContentType`   | `(contentType: string \| null) => boolean`                                                                    | `text/html`・`application/xhtml+xml`・`text/xml`・`application/xml`・`application/rss+xml`・`application/atom+xml` のいずれかで始まれば true（大文字小文字とパラメータ `; charset=` を無視）。`null` は false    |
| `htmlToText`               | `(html: string, maxChars: number) => string`                                                                  | 下記の手順で決定的に変換                                                                                                                                                                                         |
| `sha256Hex`                | `(text: string) => Promise<string>`                                                                           | `crypto.subtle.digest('SHA-256', ...)` の結果を小文字16進64桁で返す                                                                                                                                              |
| `parseClaudeJson`          | `(text: string) => { items: unknown[] }`                                                                      | markdown のコードフェンス（3連バッククォート、言語ラベル `json` の有無を問わない）を剥がして `JSON.parse`。失敗時・`items` が配列でない場合は `{ items: [] }`。`extract-spot-info/index.ts:155` の正規表現を踏襲 |
| `normalizeItems`           | `(raw: unknown[], sourceUrl: string, fetchedAt: string, maxItems: number) => LimitedGoshuinItem[]`            | 下記の正規化                                                                                                                                                                                                     |
| `mergeLimitedGoshuinItems` | `(existing: LimitedGoshuinItem[], sourceUrl: string, incoming: LimitedGoshuinItem[]) => LimitedGoshuinItem[]` | `existing` から `source_url === sourceUrl` の要素を除去し、末尾に `incoming` を連結して返す（**入力配列を破壊しない**）                                                                                          |
| `isPastDeadline`           | `(startedAtMs: number, nowMs: number, budgetMs: number) => boolean`                                           | `nowMs - startedAtMs >= budgetMs`                                                                                                                                                                                |

`htmlToText` の手順（この順序で固定する）:

1. `<script ...>...</script>` と `<style ...>...</style>` をブロックごと除去（大文字小文字無視・属性あり可）
2. HTML コメント `<!-- ... -->` を除去
3. `<br>` / `<br/>` / `</p>` / `</div>` / `</li>` / `</tr>` / `</h1>`〜`</h6>` を `\n` に置換
4. 残る全タグ `<[^>]*>` を空文字に置換
5. 実体参照を復元: `&amp;`→`&`、`&lt;`→`<`、`&gt;`→`>`、`&quot;`→`"`、`&#39;`→`'`、`&nbsp;`→半角スペース
6. 各行の連続する空白・タブを半角スペース1個に畳み、行を trim し、空行を除去して `\n` で連結
7. `maxChars` を超えたら先頭 `maxChars` 文字に切り詰める

`normalizeItems` の正規化:

- `name` が文字列でない / trim 後に空 → その要素を破棄
- `name` は trim 後に 100 文字で切り詰め
- `period` は文字列なら trim して 100 文字で切り詰め、それ以外は `null`
- `period_start` / `period_end` は `/^\d{4}-\d{2}-\d{2}$/` に一致する文字列のときのみ設定、それ以外は `null`
- `description` は文字列なら trim して 300 文字で切り詰め、それ以外は `null`
- `source_url` / `fetched_at` は引数の値で**上書き**（Claude が返した同名フィールドは無視する）
- 先頭 `maxItems` 件だけを返す

#### `index.ts` の定数

```ts
const MAX_SOURCES_PER_RUN = 20; // 1回の実行で処理する source の上限
const MAX_ITEMS_PER_SOURCE = 10; // 1ソースから採用する限定御朱印の上限
const FETCH_TIMEOUT_MS = 10_000; // 外部 fetch のタイムアウト
const MAX_CONTENT_BYTES = 2_000_000; // レスポンス本文の上限（2MB）
const MAX_TEXT_CHARS = 20_000; // Claude に渡すテキストの上限
const RUN_BUDGET_MS = 100_000; // 実行全体のソフト締切（Edge Function のウォールクロック対策）
const CLAUDE_MODEL = 'claude-haiku-4-5-20251001';
const CLAUDE_MAX_TOKENS = 2048;
const USER_AGENT = 'GoshuinSampoBot/1.0 (+https://kaiwa-jun.github.io/goshuin-app/)';
```

#### 処理フロー

1. `OPTIONS` は `corsHeaders` で `ok` を返す（`extract-spot-info` と同じ `corsHeaders` を複製する）
2. `isServiceRoleAuthorized(req.headers.get('Authorization'), SUPABASE_SERVICE_ROLE_KEY)` が false なら **401**（`{ error: 'Unauthorized' }`）。Claude API のコストが発生する関数なので anon JWT では実行させない
3. body（任意）を読む: `{ limit?: number; spot_id?: string; dry_run?: boolean }`。壊れた JSON は `{}` として扱う。`limit` は `1..MAX_SOURCES_PER_RUN` にクランプ
4. 巡回対象を取得:
   ```ts
   supabase
     .from('spot_info_sources')
     .select('id, spot_id, url, source_type, content_hash')
     .eq('enabled', true)
     .neq('source_type', 'sns_link')
     .order('last_crawled_at', { ascending: true, nullsFirst: true })
     .limit(limit);
   ```
   `spot_id` が指定されていれば `.eq('spot_id', spot_id)` を追加（手動再クロール用）
5. **1件ずつ逐次処理**する。各ソースは `try/catch` で囲み、1件の失敗が実行全体を止めないようにする。ループ先頭で `isPastDeadline(startedAt, Date.now(), RUN_BUDGET_MS)` を判定し、超えていたら残りを未処理のまま打ち切って `deadline_reached: true` を返す
6. 各ソースの処理:
   1. `isAllowedSourceUrl(url)` が false → `skipped_blocked` に計上して次へ（`last_crawled_at` は更新しない）
   2. `AbortController` + `setTimeout(FETCH_TIMEOUT_MS)` で fetch する。**`redirect: 'manual'` とし、3xx は Location を解決して最大 `MAX_REDIRECTS`（5）ホップまで手動追跡。各ホップの URL を `isAllowedSourceUrl` で再検証する**（`redirect: 'follow'` だと初回 URL しか SSRF ガードを通らないため。セキュリティレビュー指摘 2026-08-02）。ヘッダは `{ 'User-Agent': USER_AGENT, 'Accept': 'text/html,application/xhtml+xml,application/xml' }`
   3. `res.ok` が false → `failed` に計上。`last_crawled_at` のみ更新して次へ
   4. `isCrawlableContentType(res.headers.get('content-type'))` が false → `skipped_content_type` に計上。`last_crawled_at` のみ更新して次へ
   5. 本文は `res.body` を **ReadableStream で読みながら累積バイト数を数え、`MAX_CONTENT_BYTES` を超えた時点で `reader.cancel()` して打ち切る**（`res.text()` で丸ごと読まない）
   6. `text = htmlToText(html, MAX_TEXT_CHARS)` → `hash = await sha256Hex(text)`
   7. `hash === source.content_hash` → **変化なし**。`last_crawled_at` のみ更新して次へ（Claude を呼ばない = コスト0）
   8. 変化あり: `dry_run` なら Claude を呼ばずに `changed` の計上のみ。そうでなければ Claude Haiku 4.5 を呼ぶ
   9. `parseClaudeJson` → `normalizeItems(raw, source.url, fetchedAt, MAX_ITEMS_PER_SOURCE)`
   10. `spot_aggregated_info` の既存行を読み、`mergeLimitedGoshuinItems(existing.items, source.url, newItems)` を作る
       - マージ結果が**空配列**なら該当行を `delete`（古い限定御朱印を残さない）
       - 空でなければ `upsert({ spot_id, info_type: 'limited_goshuin', info_data: { items: merged, fetched_at }, source_stamp_ids: [], confidence_score: 0.9, last_reported_at: fetchedAt, updated_at: fetchedAt }, { onConflict: 'spot_id,info_type' })`
   11. `spot_info_sources` を `{ content_hash: hash, last_crawled_at: fetchedAt, last_changed_at: fetchedAt, updated_at: fetchedAt }` で更新
7. サマリを 200 で返す:
   ```json
   {
     "processed": 20,
     "changed": 3,
     "extracted": 3,
     "unchanged": 15,
     "failed": 1,
     "skipped_blocked": 0,
     "skipped_content_type": 1,
     "deadline_reached": false
   }
   ```
8. 想定外の例外は `extract-spot-info` と同様に 500 + `{ error, debug }`

**マージが必要な理由**: 1スポットに複数ソース（公式サイトとお知らせページ等）を登録できる一方、`spot_aggregated_info` は `(spot_id, info_type)` で1行しか持てない。単純上書きすると、変化しなかった側のソース由来の項目が消える。

#### Claude API 呼び出し

`extract-spot-info/index.ts:107-161` の `callClaudeApi` と同じ形（`fetch('https://api.anthropic.com/v1/messages')` / `x-api-key` / `anthropic-version: '2023-06-01'` / コードフェンス剥がし）を踏襲する。差分は model 以外の以下:

- `max_tokens: 2048`
- `messages[0].content` はページ本文テキスト（`htmlToText` の結果）。URL は system 側には入れず、ユーザーメッセージ先頭に `【ページURL】{url}\n\n【本文】\n{text}` の形で添える
- system プロンプト（**推測・創作の禁止は `extract-spot-info` を踏襲**）:

```
あなたは寺社の公式サイトから「限定御朱印」の情報だけを抽出するアシスタントです。
本文に明示的に書かれている情報のみを抽出し、推測・創作・補完は一切行わないでください。
書かれていない項目は null にしてください。年号の変換や期間の推定も行わないでください。

抽出対象は「期間限定・月替わり・行事限定などの特別な御朱印」だけです。
「御朱印」「朱印」「御集印」として明記されているものだけを対象とし、
通常の御朱印・御朱印帳の頒布・授与所の案内・イベント全般は対象外です。
お守り・お札・破魔矢・御神矢・土鈴・熊手・縁起物などの授与品は、
期間限定であっても御朱印ではないため絶対に含めないでください。

以下の JSON のみを返してください。説明文・前置き・コードブロック外の文字は不要です。
{
  "items": [
    {
      "name": "御朱印の名称（本文の表記そのまま・必須）",
      "period": "頒布期間の表記そのまま。書かれていなければ null",
      "period_start": "期間開始が西暦日付として明記されている場合のみ YYYY-MM-DD。それ以外は null",
      "period_end": "期間終了が西暦日付として明記されている場合のみ YYYY-MM-DD。それ以外は null",
      "description": "初穂料・書き置きの別など補足。無ければ null"
    }
  ]
}
該当する限定御朱印が本文に無い場合は {"items": []} を返してください。
```

- Claude API がエラー（非 2xx）を返した場合はそのソースを `failed` に計上して次へ進む。**実行全体を落とさない**。`content_hash` は更新しない（次回また抽出を試みるため）
- 429 / 5xx でも同様。MVP ではリトライしない（週2回の巡回で次回に回収する）

### pg_cron（`supabase/cron/schedule_crawl_spot_sources.sql`）

**このファイルは migration ではなく、ユーザーが Supabase SQL Editor で手動実行する運用ファイル**（migration に入れるとサービスロールキーの扱いが CI/履歴に残るため）。

内容の要件:

```sql
-- 事前準備（初回のみ）
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- サービスロールキーを Vault に保存する（<SERVICE_ROLE_KEY> を実際の値に置き換えて実行）
-- select vault.create_secret('<SERVICE_ROLE_KEY>', 'service_role_key');

-- 週2回（火・金 02:00 JST = 月・木 17:00 UTC）
select cron.schedule(
  'crawl-spot-sources-biweekly',
  '0 17 * * 1,4',
  $$
  select net.http_post(
    url := 'https://tvnozkpxncmnehyomoff.supabase.co/functions/v1/crawl-spot-sources',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key')
    ),
    body := jsonb_build_object('limit', 20),
    timeout_milliseconds := 120000
  );
  $$
);

-- 解除: select cron.unschedule('crawl-spot-sources-biweekly');
-- 実行履歴: select * from cron.job_run_details order by start_time desc limit 20;
```

- **実キーをファイルに書かない**。Vault 参照＋プレースホルダのみ
- プロジェクト ref `tvnozkpxncmnehyomoff` は `supabase/config.toml` に既にコミット済みの値を使う
- `MAX_SOURCES_PER_RUN = 20` × 週2回 = 週40スロット。第1弾の約30ソースは `last_crawled_at NULLS FIRST` 順の巡回で毎週全件がカバーされる

### 表示仕様（`LimitedGoshuinSection`）

```tsx
interface LimitedGoshuinSectionProps {
  info?: LimitedGoshuinInfo;
  snsLinks?: SpotSnsLink[];
  variant?: 'full' | 'compact'; // 既定 'full'
}
```

同ファイルから純粋関数も export する（テスト対象）:

| 関数                                  | 仕様                                                                                                                                                                     |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `filterActiveItems(items, now: Date)` | `period_end` が `/^\d{4}-\d{2}-\d{2}$/` に一致し、かつ **JST の当日日付より小さい**要素を除外する。`period_end` が null / 不正形式の要素は**残す**。入力配列は破壊しない |
| `toJstDateString(now: Date)`          | `now` を JST（UTC+9 固定・日本に DST は無い）に変換した `YYYY-MM-DD`                                                                                                     |
| `formatFetchedAt(iso: string)`        | JST の `YYYY/MM/DD HH:mm`。パース不能なら空文字                                                                                                                          |

**JST 固定にする理由**: `toLocaleString` や `Date` のローカルメソッドは実行環境の TZ に依存し、Jest の結果が環境ごとに変わる。国内向けアプリなので UTC+9 固定で決定的にする。

#### `variant="full"`（`SpotDetailContent` = ボトムシート展開時）

`activeItems = filterActiveItems(info?.items ?? [], new Date())`。
`activeItems.length === 0 && (snsLinks?.length ?? 0) === 0` のときは **null を返す**。

| 要素         | testID                                | 内容・スタイル                                                                                                                                                                                                                                      |
| ------------ | ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ルート       | `limited-goshuin-section`             | `View`                                                                                                                                                                                                                                              |
| 見出し       | —                                     | `限定御朱印`（`typography.h3` / `colors.gray[800]`）                                                                                                                                                                                                |
| 各項目       | `limited-goshuin-item-{index}`        | `activeItems` の順（index は 0 起点）                                                                                                                                                                                                               |
| ├ 名称       | —                                     | `item.name`（`typography.body` / `colors.gray[900]`）                                                                                                                                                                                               |
| ├ 期間       | `limited-goshuin-period-{index}`      | `期間 {item.period}`（`typography.bodySmall` / `colors.gray[600]`）。`period` が null なら**この行を描画しない**                                                                                                                                    |
| ├ 説明       | `limited-goshuin-description-{index}` | `item.description`（`typography.bodySmall` / `colors.gray[500]` / `numberOfLines={3}`）。null なら描画しない                                                                                                                                        |
| └ 出典リンク | `limited-goshuin-source-{index}`      | `TouchableOpacity`。`MaterialIcons name="open-in-new" size={14} color={colors.primary[500]}` + テキスト `公式サイトで確認`（`typography.caption` / `colors.primary[500]`）。押下で `Linking.openURL(item.source_url)`。**常に描画する（省略不可）** |
| 取得日時     | `limited-goshuin-fetched-at`          | `取得 {formatFetchedAt(info.fetched_at)}`（`typography.caption` / `colors.gray[400]`）。`activeItems.length > 0` のときのみ描画                                                                                                                     |
| SNS 見出し   | —                                     | `公式SNS`（`typography.caption` / `colors.gray[500]`）。`snsLinks` が1件以上のときのみ                                                                                                                                                              |
| SNS リンク   | `limited-goshuin-sns-{index}`         | `TouchableOpacity`。`MaterialIcons name="open-in-new" size={14} color={colors.primary[500]}` + テキストは URL のホスト名（`www.` を除去。例 `x.com`）。押下で `Linking.openURL(link.url)`                                                           |

#### `variant="compact"`（`SpotCompactCard` = ボトムシート折りたたみ時）

`activeItems.length === 0` なら null を返す（SNS リンクだけの場合も compact では何も出さない）。

| 要素   | testID                    | 内容・スタイル                                                                                                                                                                                                                                                                                                                                           |
| ------ | ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| チップ | `limited-goshuin-compact` | `View`。`MaterialIcons name="auto-awesome" size={14} color={colors.primary[500]}` + テキスト `限定御朱印 {activeItems.length}件`（`typography.caption` / `colors.gray[600]`）。背景 `colors.gray[50]` / `paddingHorizontal: spacing.sm` / `paddingVertical: spacing.xs` / `borderRadius: borderRadius.sm`（既存 `SpotInfoSection` のチップと同じ見た目） |

**「出典 URL と取得日時を必ず表示」の適用範囲についての明示**: compact は高さ 240px 固定の折りたたみカードで、**御朱印の名称・期間・説明といった内容を一切表示しない**（件数のみ）。内容を表示するのは `variant="full"` だけであり、そこでは出典リンクと取得日時を常に描画する。この線引きを守ることを AC-D9 / AC-D10 で機械チェックする。

#### 組み込み位置

```tsx
// SpotDetailContent.tsx（既存の SpotInfoSection の直後）
{
  spotInfo && <SpotInfoSection spotInfo={spotInfo} />;
}
{
  spotInfo && <LimitedGoshuinSection info={spotInfo.limitedGoshuin} snsLinks={spotInfo.snsLinks} />;
}

// SpotCompactCard.tsx（既存の SpotInfoSection の直後）
{
  spotInfo && <SpotInfoSection spotInfo={spotInfo} />;
}
{
  spotInfo && <LimitedGoshuinSection info={spotInfo.limitedGoshuin} variant="compact" />;
}
```

両ファイルとも **props シグネチャは変更しない**（`spotInfo?: ParsedSpotInfo` に新フィールドが乗るだけ）。`SpotBottomSheet` は無変更で両方に届く。

### seed ファイルの置き場所と形式（**本 Issue では作成しない**）

第1弾（東京 + 宮城 + 京都の rank5 約30件）の情報ソース登録 SQL は、実装完了後の別ステップで次の規約に従って作る。

- **パス**: `supabase/seeds/seed_spot_info_sources_phase1.sql`
- **形式**: `spots.name` + `spots.prefecture` で引く冪等な `INSERT ... SELECT`（`spots.id` の UUID を直書きしない。既存 `supabase/seed_pilgrimages_and_spots.sql` と同じ名前ベース方式）

```sql
INSERT INTO public.spot_info_sources (spot_id, url, source_type)
SELECT s.id, v.url, v.source_type
FROM (VALUES
  ('明治神宮', '東京都', 'https://www.meijijingu.or.jp/...', 'official'),
  ('明治神宮', '東京都', 'https://x.com/...',                'sns_link')
) AS v(spot_name, prefecture, url, source_type)
JOIN public.spots s ON s.name = v.spot_name AND s.prefecture = v.prefecture
ON CONFLICT (spot_id, url) DO NOTHING;
```

- 1スポットにつき `official`（または `rss`）を最大2件 + `sns_link` を最大2件
- URL は寺社の**公式ドメイン**のみ。まとめサイト・ブログ・ニュース記事は登録しない
- 投入は既存運用どおりユーザーが Supabase SQL Editor で実行する
- `supabase/seeds/README.md` への追記も seed 作成時に行う（本 Issue では触らない）

## 既存テストの削除・変更一覧（明示的宣言）

契約として宣言した上で変更する（勝手に消さない）。**削除するテストは無い**。

### `src/hooks/__tests__/useSpotInfo.test.ts`

- **変更**: `jest.mock('@services/spotInfo', ...)` のファクトリに `fetchSpotSnsLinks: (...args) => mockFetchSpotSnsLinks(...args)` を追加し、`beforeEach` で `mockFetchSpotSnsLinks.mockResolvedValue([])` を既定にする。**これを忘れると `useSpotInfo` 側の呼び出しが `undefined` になり既存6テストが全滅する**
- **既存アサーションは無変更**（`parseAggregatedInfo` の7テストと `useSpotInfo` の6テストはそのまま通る）
- **追加**: `limited_goshuin` のパースと SNS リンクのマージのテスト（AC-C 群）

### `src/services/__tests__/spotInfo.test.ts`

- **追加のみ**: `describe('fetchSpotSnsLinks')` を追加。`from → select → match → order` の新しいチェーンモックはこの describe 内でローカルに定義する（既存の `mockSelect` / `mockEq` は共有しない）
- 既存の `fetchSpotAggregatedInfo` / `triggerExtraction` のテストは**無変更**

### `src/components/spot-detail/__tests__/SpotDetailContent.test.tsx` / `SpotCompactCard.test.tsx`

- **追加のみ**。既存テストは無変更で通る（`spotInfo` 未指定時は `LimitedGoshuinSection` が描画されないため）

### 変更しないテストファイル

`src/components/spot-detail/__tests__/SpotInfoSection.test.tsx`（9テスト）・`src/components/spot-detail/__tests__/SpotBottomSheet.test.tsx`・`src/screens/__tests__/MapScreen.test.tsx`・`src/screens/__tests__/SpotDetailScreen.test.tsx`・`src/navigation/__tests__/*` は**一切変更しない**（無変更で通ることが AC-Q5）。

## テスト方針

TDD（t-wada 流）で Red → Green → Refactor。1スライス = 1コミット。推奨分割:

1. `feat: add spot_info_sources table and crawl schedule sql` — migration + cron SQL（SQL のみ。テストは AC-A 群の grep）
2. `feat: add pure crawl helpers for spot source watcher` — `_shared/crawl.ts` + `_shared/crawl_test.ts`（Deno テスト先行）
3. `feat: add crawl-spot-sources edge function` — `index.ts` + `deno.json`
4. `feat: expose limited goshuin info from spot info service` — 型 + `fetchSpotSnsLinks` + `useSpotInfo` + それぞれのテスト
5. `feat: show limited goshuin with source and fetched time` — `LimitedGoshuinSection` + 組み込み + テスト

規約:

- テストは対象と同階層の `__tests__/`。expo / Supabase のモックは `jest.setup.js` の既存分に依存し、個別に再モックしない
- `Linking.openURL` は `jest.spyOn(Linking, 'openURL').mockResolvedValue(true)` で検証する（`src/screens/__tests__/ErrorScreen.test.tsx` と同じパターン）
- 「今日」に依存するテスト（期限切れフィルタ）は `jest.useFakeTimers().setSystemTime(new Date('2026-08-02T12:00:00Z'))` で固定し、`afterEach` で `jest.useRealTimers()` に戻す
- 1テスト1アサーション / Arrange-Act-Assert。エッジケース（items 空 / period null / period_end 期限切れ / SNS リンクのみ / 不正 JSON）を必ず含める
- TDD 中は `npm test -- --testPathPattern="LimitedGoshuinSection|useSpotInfo|spotInfo|SpotDetailContent|SpotCompactCard"`、最終確認で `npm test` 全件
- Deno テストは `deno test supabase/functions/_shared/crawl_test.ts`（Jest からは `*_test.ts` 命名により不可視）

## 受入基準（Acceptance Criteria）

goshuin-evaluator がこの基準に基づいて合否判定を行う。各基準は独立して検証可能。

区分: **A-E は `npm test` / `grep` / `git diff` で機械検証可能**、**H / I は manual-ops（Jest でも Expo Web でも検証できない項目）**、**N は native-only（実機目視）**、**Q は品質ゲート**。
調査結果 2 のとおり Expo Web ではスポット詳細に到達できないため、**本 Issue に Expo Web の UI 基準（F / G に相当する枠）は存在しない**。見た目の検証は AC-D22 / AC-D23 の `toHaveStyle` と N 群に分割している。

### A. ファイル・SQL 内容（`grep` / ファイル存在で機械チェック）

- [ ] AC-A1: `supabase/migrations/20260802000000_create_spot_info_sources.sql` が存在し、`CREATE TABLE public.spot_info_sources` を含む
- [ ] AC-A2: 同ファイルが `spot_id`・`url`・`source_type`・`enabled`・`content_hash`・`last_crawled_at`・`last_changed_at` の7カラムをすべて定義している
- [ ] AC-A3: 同ファイルが `CHECK (source_type IN ('official', 'rss', 'sns_link'))` を含む
- [ ] AC-A4: 同ファイルが `spot_id UUID NOT NULL REFERENCES public.spots(id) ON DELETE CASCADE` を含む
- [ ] AC-A5: 同ファイルが `ALTER TABLE public.spot_info_sources ENABLE ROW LEVEL SECURITY;` と、`FOR SELECT USING (true)` のポリシー、`FOR ALL USING (auth.role() = 'service_role')` のポリシーの3行をすべて含む
- [ ] AC-A6: 同ファイルが `CREATE UNIQUE INDEX` で `(spot_id, url)` の一意制約を作っている
- [ ] AC-A7: `supabase/migrations/` の既存13ファイルが**1つも変更されていない**（`git diff --name-only develop -- supabase/migrations/` の出力が新規1ファイルのみ）
- [ ] AC-A8: `supabase/cron/schedule_crawl_spot_sources.sql` が存在し、`cron.schedule(` と `'0 17 * * 1,4'` と `crawl-spot-sources` を含む
- [ ] AC-A9: 同ファイルに実キーが含まれない（`grep -c "eyJ" supabase/cron/schedule_crawl_spot_sources.sql` が 0）かつ `vault.decrypted_secrets` を参照している
- [ ] AC-A10: `supabase/functions/crawl-spot-sources/index.ts` が存在し、`claude-haiku-4-5-20251001` と `info_type: 'limited_goshuin'`（または同等の `'limited_goshuin'` リテラル）を含む
- [ ] AC-A11: `supabase/functions/crawl-spot-sources/deno.json` が存在し、`supabase/functions/extract-spot-info/deno.json` と同一内容である
- [ ] AC-A12: `supabase/functions/_shared/crawl.ts` が `isServiceRoleAuthorized` / `isAllowedSourceUrl` / `isCrawlableContentType` / `htmlToText` / `sha256Hex` / `parseClaudeJson` / `normalizeItems` / `mergeLimitedGoshuinItems` / `isPastDeadline` の9関数をすべて `export` している
- [ ] AC-A13: `supabase/functions/_shared/crawl_test.ts` が存在する（`crawl.test.ts` **ではない**。`ls supabase/functions/_shared/` に `crawl.test.ts` が存在しないことも確認する）
- [ ] AC-A14: `index.ts` に `MAX_SOURCES_PER_RUN`・`FETCH_TIMEOUT_MS`・`MAX_CONTENT_BYTES`・`RUN_BUDGET_MS` の4定数が定義されている
- [ ] AC-A15: `index.ts` が `sns_link` を巡回対象から除外している（`.neq('source_type', 'sns_link')` を含む）
- [ ] AC-A16: `index.ts` の system プロンプトに `推測` と `創作` の両方の語が含まれる（`extract-spot-info` の制約踏襲）
- [ ] AC-A17: `supabase/seeds/` 配下と `supabase/seed_*.sql` が**1ファイルも変更・追加されていない**（seed 作成は別ステップ）
- [ ] AC-A18: `src/types/supabase.ts` の `SpotAggregatedInfo.info_type` の union に `'limited_goshuin'` が含まれ、`LimitedGoshuinItem` / `LimitedGoshuinInfo` / `SpotInfoSource` / `SpotSnsLink` の4型が `export` されている
- [ ] AC-A19: `supabase/functions/crawl-spot-sources/index.ts` が `isServiceRoleAuthorized` を呼び、その結果が偽のときに `status: 401` を返す分岐を持つ（コスト保護ガード）

### B. サービス層（`src/services/__tests__/spotInfo.test.ts`）

- [ ] AC-B1: `fetchSpotSnsLinks('spot-1')` が `supabase.from` を `'spot_info_sources'` で呼ぶ
- [ ] AC-B2: `fetchSpotSnsLinks('spot-1')` が `.match({ spot_id: 'spot-1', source_type: 'sns_link', enabled: true })` を呼ぶ
- [ ] AC-B3: `fetchSpotSnsLinks` が `.order('created_at', { ascending: true })` を呼ぶ
- [ ] AC-B4: 成功時、`fetchSpotSnsLinks` はモックが返した配列をそのまま返す
- [ ] AC-B5: `error` が返ったとき `fetchSpotSnsLinks` は `[]` を返し、`console.warn` が `'Failed to fetch spot sns links:'` を第1引数に呼ばれる（throw しない）
- [ ] AC-B6: `data: null` かつ `error: null` のとき `fetchSpotSnsLinks` は `[]` を返す
- [ ] AC-B7: 既存の `fetchSpotAggregatedInfo` / `triggerExtraction` のテストが**アサーション無変更で**通る

### C. hook（`src/hooks/__tests__/useSpotInfo.test.ts`）

- [ ] AC-C1: `parseAggregatedInfo` に `info_type: 'limited_goshuin'` / `info_data: { items: [<1件>], fetched_at: '2026-08-01T00:00:00Z' }` を渡すと、戻り値が `{ limitedGoshuin: { items: [<1件>], fetched_at: '2026-08-01T00:00:00Z' } }` に等しい
- [ ] AC-C2: `info_data: { items: [] }` のとき `parseAggregatedInfo` の戻り値に `limitedGoshuin` キーが存在せず、他のフィールドも無ければ `null` を返す
- [ ] AC-C3: `info_data: { items: 'not-an-array' }` のとき `parseAggregatedInfo` は `limitedGoshuin` を設定しない（クラッシュしない）
- [ ] AC-C4: `info_data.fetched_at` が欠落しているとき、`limitedGoshuin.fetched_at` が当該レコードの `last_reported_at` の値になる
- [ ] AC-C5: `useSpotInfo('spot-1')` が `fetchSpotSnsLinks` を `'spot-1'` で1回呼ぶ
- [ ] AC-C6: `fetchSpotAggregatedInfo` が `[]`、`fetchSpotSnsLinks` が1件を返すとき、`spotInfo` が `{ snsLinks: [<1件>] }` に等しい（限定御朱印が無くても SNS リンクだけで非 null になる）
- [ ] AC-C7: 両方が空配列を返すとき `spotInfo` は `null`
- [ ] AC-C8: `fetchSpotSnsLinks` が空配列を返すとき、`spotInfo` に `snsLinks` キーが存在しない
- [ ] AC-C9: `fetchSpotSnsLinks` が reject したとき `spotInfo` は `null` になり、例外が外に漏れない
- [ ] AC-C10: `useSpotInfo('')` のとき `fetchSpotAggregatedInfo` も `fetchSpotSnsLinks` も呼ばれない
- [ ] AC-C11: 既存の `parseAggregatedInfo` 7テストと `useSpotInfo` 6テストが**アサーション無変更で**通る

### D. `LimitedGoshuinSection`（`src/components/spot-detail/__tests__/LimitedGoshuinSection.test.tsx`）

システム時刻は `2026-08-02T12:00:00Z` に固定して検証する。

**純粋関数**

- [ ] AC-D1: `toJstDateString(new Date('2026-08-02T15:30:00Z'))` が `'2026-08-03'` を返す（UTC+9 固定）
- [ ] AC-D2: `formatFetchedAt('2026-08-03T17:00:00.000Z')` が `'2026/08/04 02:00'` を返す
- [ ] AC-D3: `formatFetchedAt('not-a-date')` が `''` を返す
- [ ] AC-D4: `filterActiveItems` が `period_end: '2026-08-01'` の要素を除外し、`period_end: '2026-08-02'` の要素は残す（当日は有効）
- [ ] AC-D5: `filterActiveItems` が `period_end: null` / `period_end: '令和8年8月'`（不正形式）の要素を残す
- [ ] AC-D6: `filterActiveItems` が入力配列を破壊しない（呼び出し後に元配列の `length` と内容が `toEqual` で一致する）

**variant="full"**

- [ ] AC-D7: `info` が items 2件（どちらも有効期間内）のとき `limited-goshuin-section` が表示され、`limited-goshuin-item-0` と `limited-goshuin-item-1` が表示される
- [ ] AC-D8: 見出しテキスト `限定御朱印` が表示される
- [ ] AC-D9: items 1件のとき `limited-goshuin-source-0` が表示され、そのテキストに `公式サイトで確認` が含まれる（**出典リンクは常に描画される**）
- [ ] AC-D10: items 1件のとき `limited-goshuin-fetched-at` が表示され、`info.fetched_at = '2026-08-03T17:00:00.000Z'` に対して `取得 2026/08/04 02:00` が表示される
- [ ] AC-D11: `limited-goshuin-source-0` を押すと `Linking.openURL` が `item.source_url` の値で1回呼ばれる
- [ ] AC-D12: `period: '7月1日〜8月31日'` のとき `limited-goshuin-period-0` に `期間 7月1日〜8月31日` が表示される
- [ ] AC-D13: `period: null` のとき `limited-goshuin-period-0` が表示されない（かつ `limited-goshuin-item-0` は表示される）
- [ ] AC-D14: `description: null` のとき `limited-goshuin-description-0` が表示されない
- [ ] AC-D15: items のうち1件が `period_end: '2026-07-31'`（期限切れ）のとき、その項目は描画されず、残り1件が `limited-goshuin-item-0` として描画される（index が詰まる）
- [ ] AC-D16: 全 items が期限切れかつ `snsLinks` が空のとき `limited-goshuin-section` が表示されない（null を返す）
- [ ] AC-D17: `info` が `undefined` かつ `snsLinks` が空のとき `limited-goshuin-section` が表示されない
- [ ] AC-D18: `info` が `undefined` かつ `snsLinks` が1件（`url: 'https://x.com/example'`）のとき `limited-goshuin-section` と `limited-goshuin-sns-0` が表示され、テキストに `x.com` が含まれ、`公式SNS` が表示される
- [ ] AC-D19: `snsLinks` が `https://www.instagram.com/example` のとき表示テキストが `instagram.com`（`www.` を除去）である
- [ ] AC-D20: `limited-goshuin-sns-0` を押すと `Linking.openURL` が `snsLinks[0].url` で1回呼ばれる
- [ ] AC-D21: 全 items が期限切れで `snsLinks` が1件のとき、`limited-goshuin-sns-0` は表示されるが `limited-goshuin-fetched-at` は表示されない
- [ ] AC-D22: `limited-goshuin-fetched-at` のスタイルが `typography.caption`（fontSize 12）かつ色 `colors.gray[400]`（`#9CA3AF`）である（`toHaveStyle` で検証）
- [ ] AC-D23: `getByText('公式サイトで確認')` のスタイルが `typography.caption`（fontSize 12）かつ色 `colors.primary[500]`（`#f27f0d`）である（`toHaveStyle` で検証）

**variant="compact"**

- [ ] AC-D24: `variant="compact"` で有効な items 3件のとき `limited-goshuin-compact` が表示され、テキスト `限定御朱印 3件` が表示される
- [ ] AC-D25: `variant="compact"` のとき、items の `name`・`period`・`description` の各文字列がいずれも画面に表示されない（内容を出さない = 出典併記義務の対象外であることの担保）
- [ ] AC-D26: `variant="compact"` のとき `limited-goshuin-section` / `limited-goshuin-fetched-at` / `limited-goshuin-source-0` がいずれも表示されない
- [ ] AC-D27: `variant="compact"` で有効な items が0件（`info` 未指定 or 全件期限切れ）のとき `limited-goshuin-compact` が表示されない
- [ ] AC-D28: `variant="compact"` で `info` が空かつ `snsLinks` が1件のとき、何も表示されない（`limited-goshuin-compact` も `limited-goshuin-sns-0` も無い）
- [ ] AC-D29: 期限切れ1件を含む計3件を `variant="compact"` に渡すと `限定御朱印 2件` と表示される（件数はフィルタ後）

### E. 組み込み（`SpotDetailContent.test.tsx` / `SpotCompactCard.test.tsx`）

到達手順（実機）: 地図タブ → スポットのピンをタップ → ボトムシート（compact）→ 上方向にドラッグ（expanded）。

- [ ] AC-E1: `SpotDetailContent` に `spotInfo={{ limitedGoshuin: { items: [<1件>], fetched_at } }}` を渡すと `limited-goshuin-section` が表示される
- [ ] AC-E2: `SpotDetailContent` に `spotInfo={{ snsLinks: [<1件>] }}` を渡すと `limited-goshuin-sns-0` が表示される
- [ ] AC-E3: `SpotDetailContent` に `spotInfo` を渡さないと `limited-goshuin-section` が表示されない
- [ ] AC-E4: `SpotDetailContent` に `spotInfo={{ parking: { available: true } }}` を渡すと `spot-info-section` は表示されるが `limited-goshuin-section` は表示されない
- [ ] AC-E5: `SpotCompactCard` に `spotInfo={{ limitedGoshuin: { items: [<2件>], fetched_at } }}` を渡すと `limited-goshuin-compact` が表示され `限定御朱印 2件` が読める
- [ ] AC-E6: `SpotCompactCard` に `spotInfo` を渡さないと `limited-goshuin-compact` が表示されない
- [ ] AC-E7: `SpotDetailContent` の既存テストが**ファイル内の既存アサーション無変更で**通る
- [ ] AC-E8: `SpotCompactCard` の既存テストが**ファイル内の既存アサーション無変更で**通る

### H. manual-ops: Deno ユニットテスト（Jest では検証不能）

Deno は未インストール。実行前に `brew install deno`（または `curl -fsSL https://deno.land/install.sh | sh`）を行う。
実行コマンド: **`deno test supabase/functions/_shared/crawl_test.ts`**（リポジトリルートで実行。初回は jsr からの依存取得のためネットワークが必要）。

- [ ] H-1 (manual-ops): 上記コマンドが exit code 0 で終了し、`ok | N passed | 0 failed` が出る
- [ ] H-2 (manual-ops): `isServiceRoleAuthorized('Bearer KEY', 'KEY')` が true、`isServiceRoleAuthorized('Bearer OTHER', 'KEY')` / `isServiceRoleAuthorized(null, 'KEY')` / `isServiceRoleAuthorized('Bearer ', '')` がいずれも false であるテストが存在し通る
- [ ] H-3 (manual-ops): `isAllowedSourceUrl` が `https://example.jp/a` で true、`http://example.jp/a` / `file:///etc/passwd` / `https://localhost/a` / `https://127.0.0.1/a` / `https://192.168.1.1/a` / `not-a-url` で false になるテストが存在し通る
- [ ] H-4 (manual-ops): `isCrawlableContentType('text/html; charset=UTF-8')` が true、`isCrawlableContentType('application/pdf')` と `isCrawlableContentType(null)` が false になるテストが存在し通る
- [ ] H-5 (manual-ops): `htmlToText('<style>a{}</style><script>x()</script><p>あ</p><p>い</p>', 100)` が `'あ\nい'` を返す（script/style が除去され、`</p>` が改行になる）
- [ ] H-6 (manual-ops): `htmlToText('<p>a &amp; b&nbsp;c</p>', 100)` が `'a & b c'` を返す（実体参照の復元と空白畳み込み）
- [ ] H-7 (manual-ops): `htmlToText('<p>abcdef</p>', 3)` の戻り値の長さが 3 である（切り詰め）
- [ ] H-8 (manual-ops): 同一入力に対する `sha256Hex` の戻り値が2回とも同じ64桁小文字16進で、1文字違う入力では異なる値になるテストが存在し通る
- [ ] H-9 (manual-ops): `parseClaudeJson` が「3連バッククォートのフェンスで囲まれた JSON」と「素の JSON」の両方をパースでき、壊れた JSON および `items` が非配列の場合に `{ items: [] }` を返すテストが存在し通る
- [ ] H-10 (manual-ops): `normalizeItems` が (a) `name` 欠落要素を破棄、(b) `source_url` / `fetched_at` を**引数の値で上書き**（Claude が返した偽の値を採用しない）、(c) `period_end: '2026/08/31'`（不正形式）を `null` にする、(d) `maxItems` で件数を切る、の4点を検証するテストが存在し通る
- [ ] H-11 (manual-ops): `mergeLimitedGoshuinItems` が同一 `source_url` の既存要素だけを置き換え、他ソース由来の要素を保持し、入力配列を破壊しないテストが存在し通る
- [ ] H-12 (manual-ops): `isPastDeadline(0, 100_000, 100_000)` が true、`isPastDeadline(0, 99_999, 100_000)` が false になるテストが存在し通る

### I. manual-ops: DB 適用・デプロイ・実クロール（ユーザー作業）

Supabase CLI も未インストール。デプロイは `npx supabase@latest` で行うか `brew install supabase/tap/supabase` を先に実行する。

- [ ] I-1 (manual-ops): Supabase SQL Editor で `supabase/migrations/20260802000000_create_spot_info_sources.sql` の内容を実行し、エラーなく完了する。`select count(*) from public.spot_info_sources;` が 0 を返す
- [ ] I-2 (manual-ops): 匿名（anon）キーのクライアントから `spot_info_sources` を SELECT できる／INSERT が RLS で拒否されることを SQL Editor の `set role anon;` またはアプリから確認する
- [ ] I-3 (manual-ops): `ANTHROPIC_API_KEY` が Edge Functions のシークレットに設定済みであることを確認する（`npx supabase secrets list --project-ref tvnozkpxncmnehyomoff`。未設定なら `npx supabase secrets set ANTHROPIC_API_KEY=...`）
- [ ] I-4 (manual-ops): `npx supabase functions deploy crawl-spot-sources --project-ref tvnozkpxncmnehyomoff` が成功する
- [ ] I-5 (manual-ops): 検証用に1スポット分の `spot_info_sources` を1行だけ手動 INSERT し、service_role キーを付けて関数を叩くと 200 とサマリ JSON が返る:
      `curl -X POST -H "Authorization: Bearer <SERVICE_ROLE_KEY>" -H "Content-Type: application/json" -d '{"limit":1}' https://tvnozkpxncmnehyomoff.supabase.co/functions/v1/crawl-spot-sources`
- [ ] I-6 (manual-ops): 同じリクエストを anon キーで叩くと **401** が返る（コスト保護の確認）
- [ ] I-7 (manual-ops): I-5 の後、その行の `content_hash` / `last_crawled_at` / `last_changed_at` が埋まっている
- [ ] I-8 (manual-ops): **同じリクエストをもう一度叩くと** レスポンスの `unchanged` が 1、`changed` が 0 になる（差分検知が効いており Claude を呼んでいない）
- [ ] I-9 (manual-ops): 限定御朱印を掲載しているページを対象にした場合、`select info_data from spot_aggregated_info where info_type='limited_goshuin';` の各 item に `source_url` と `fetched_at` が入っており、`source_url` が登録した URL と一致する（Claude の捏造でない）
- [ ] I-10 (manual-ops): `supabase/cron/schedule_crawl_spot_sources.sql` の手順どおり Vault にキーを保存し `cron.schedule` を登録すると、`select jobname, schedule from cron.job;` に `crawl-spot-sources-biweekly` / `0 17 * * 1,4` が現れる
- [ ] I-11 (manual-ops): 次回スケジュール到達後（または `select cron.schedule('tmp-test','* * * * *', ...)` の一時登録で）`select * from cron.job_run_details order by start_time desc limit 5;` に `succeeded` の行が出る。確認後 `select cron.unschedule('tmp-test');` で片付ける

### N. native-only 基準（Expo Web では到達不能）

調査結果 2 のとおり Expo Web ではボトムシートが開かない。以下は **実機 iPhone + EAS Development Build（`/dev`）での目視確認**に割り当てる。Maestro フローは追加しない（外部ブラウザ遷移を跨ぐため自動化が不安定）。

- [ ] N-1 (native-only): I-9 まで完了したスポットのピンを地図でタップすると、折りたたみボトムシートに `限定御朱印 N件` のチップが表示される
- [ ] N-2 (native-only): そのままボトムシートを上にドラッグして展開すると、`限定御朱印` の見出しと各項目（名称・期間）が表示される
- [ ] N-3 (native-only): 各項目に `公式サイトで確認` が表示され、タップすると **外部ブラウザ（Safari）で該当の公式サイト**が開く
- [ ] N-4 (native-only): 展開ビューの最後に `取得 YYYY/MM/DD HH:mm` が表示され、その値が I-5 を実行した日時（JST）と一致する
- [ ] N-5 (native-only): `sns_link` を登録したスポットで `公式SNS` とホスト名のリンクが表示され、タップすると外部ブラウザで該当 SNS が開く
- [ ] N-6 (native-only): 情報ソースを登録していないスポットのボトムシートに、限定御朱印関連の表示が一切出ない（既存の駐車場・受付時間チップの表示は従来どおり）

### Q. 品質基準

- [ ] Q-1: 全テストが通る（`npm test`）
- [ ] Q-2: Lint エラーがない（`npm run lint`）
- [ ] Q-3: 型エラーがない（`npm run typecheck`）
- [ ] Q-4: 本 Issue で追加・変更した `StyleSheet.create()` のスタイル値に16進カラーの直値がない（色は `@theme/colors`、余白は `@theme/spacing` / `borderRadius`、文字は `@theme/typography` のトークン参照）
- [ ] Q-5: `SpotInfoSection.tsx`・`SpotInfoSection.test.tsx`・`SpotBottomSheet.tsx`・`SpotDetailScreen.tsx`・`MapScreen.tsx` が**1行も変更されていない**（`git diff --stat develop -- <各パス>` が空）
- [ ] Q-6: `src/` 配下の新規・変更ファイルに Deno / Edge Function 由来の import（`https://esm.sh/...` や `Deno.` の参照）が無い
- [ ] Q-7: `supabase/functions/` 配下に React Native / `@theme` の import が無い

## スコープ外（やらないこと）

契約書に無いことは実装しない。

- **プッシュ通知**（`expo-notifications` の導入、新着の通知、行きたいリスト連動）
- **課金 / サブスク**（IAP・RevenueCat・ペイウォール UI・無料枠の制限）
- **SNS の自動取得**（X API / Instagram / Facebook のスクレイピングや API 連携）。`sns_link` は**リンク表示のみ**
- **マイ神社の新着フィード画面**（visited / wishlist ベースのフォロー体験・新着一覧画面・バッジ）
- **ユーザーからの情報源提案 UI**（アプリ内での URL 投稿・報告フォーム・誤情報通報）
- **運営向けの管理画面**（ソース登録は SQL Editor 運用のまま）
- **469件全件の seed**。第1弾の seed SQL 作成そのものも本 Issue では**行わない**（置き場所と形式の規定のみ）
- **`SpotDetailScreen` への結線**（到達不能ルートのため。`useSpotInfo` を足すと既存の駐車場・受付時間表示まで新規に出現し、本 Issue と無関係な差分になる）
- **`SpotInfoSection` の変更**（チップ行のレイアウト・info_type の追加・props の拡張）
- **`spot_aggregated_info` のスキーマ変更**（`info_type` の CHECK 制約追加・新カラム追加・`source_stamp_ids` の NULL 許容化）
- **`extract-spot-info` の変更**（既存のユーザーメモ由来の抽出パイプラインは無変更）
- **robots.txt / sitemap.xml のパースと遵守判定**、`Crawl-delay` の実装、条件付き GET（`If-Modified-Since` / `ETag`）
- **RSS/Atom の構造解析**（`rss` タイプも `official` と同じく HTML→テキスト→ハッシュ比較で扱う。フィード項目単位の差分検知はしない）
- **失敗ソースのリトライ / バックオフ / 自動 disable**（連続失敗の記録カラムや通知）
- **巡回結果の履歴テーブル**（`crawl_logs` 等）。観測は `cron.job_run_details` と Edge Function ログで行う
- **画像の取得・保存**（限定御朱印の写真）
- **`docs/product/direction.md` / `docs/technical/tech-design.md` / `docs/design/ui-design.md` / `supabase/seeds/README.md` の更新**（feature-list の進捗記録はハーネス側の責務）
- **多言語対応**（表示文言はすべて日本語固定）

## 注意事項

- **Deno テストの命名**: `crawl_test.ts`（アンダースコア）にする。`crawl.test.ts` にすると `jest.config.js` の `testMatch: ['**/*.test.{ts,tsx}']` に拾われ、`npm test` が Deno 構文で落ちる（AC-A13 で検出する）
- **`useSpotInfo.test.ts` のモック漏れ**: `@services/spotInfo` のモックファクトリに `fetchSpotSnsLinks` を足し忘れると、`Promise.all` の中で `undefined is not a function` になり**既存6テストが全滅する**。スライス4の最初にモックを足すこと（AC-C11 で検出する）
- **`Promise.all` の全滅リスク**: `fetchSpotSnsLinks` が reject すると `Promise.all` 全体が reject し、限定御朱印以外の既存情報（駐車場・受付時間）も表示されなくなる。`fetchSpotSnsLinks` は**内部で必ず catch して空配列を返す**実装にする（サービス層で throw しない。AC-B5 で検出する）
- **`info_data` に配列を直接入れない**: `SpotAggregatedInfo.info_data` は `Record<string, unknown>`。`limited_goshuin` は必ず `{ items: [...], fetched_at }` のオブジェクトで格納する（調査結果 4）
- **マージを忘れない**: 1スポットに複数ソースがある場合、`spot_aggregated_info` は1行しか持てない。単純上書きすると変化しなかった側のソースの項目が消える。必ず `mergeLimitedGoshuinItems` を通す（H-11 で検出する）
- **`source_url` / `fetched_at` は Claude に生成させない**: プロンプトに URL を渡すため、Claude が `source_url` を含む JSON を返す可能性がある。`normalizeItems` で必ずコード側の値に上書きする。ここを守らないと「出典 URL が実在しない」誤情報になる（H-10 で検出する）
- **`content_hash` を更新するタイミング**: Claude 呼び出しが失敗したときは `content_hash` を**更新しない**。更新してしまうと「変化なし」と判定されて次回以降も抽出されない
- **外部 fetch の安全対策**（すべて実装必須）:
  - タイムアウト: `AbortController` + `FETCH_TIMEOUT_MS`（10秒）。`clearTimeout` を `finally` で必ず呼ぶ
  - サイズ上限: `res.text()` で丸読みせず、`res.body` のストリームを読みながら `MAX_CONTENT_BYTES`（2MB）で `reader.cancel()` する。巨大 PDF/動画で Edge Function のメモリを飛ばさない
  - スキーム/ホスト制限: `isAllowedSourceUrl` で `https:` 以外とプライベート IP レンジを拒否（運営登録とはいえ SSRF の踏み台にしない）
  - Content-Type チェック: HTML/XML 系以外は取得しても解析しない
  - UA: `GoshuinSampoBot/1.0 (+https://kaiwa-jun.github.io/goshuin-app/)` を必ず付ける。連絡先 URL 付きの識別可能な UA にすることで、先方がブロックしたい場合に手段を持てるようにする
  - **robots.txt は MVP では解釈しない**。代わりに (a) 巡回対象は運営が1件ずつ登録した公式サイトのみ (b) 週2回・1ソース1リクエストのみ (c) 並列アクセスなし（逐次処理）で負荷を抑える。**ソース登録時に運営が robots.txt と利用規約を目視確認する運用ルールとし、拒否された場合は `enabled = false` にする**
- **コスト保護**: `crawl-spot-sources` は Claude API を叩くため、`verify_jwt` のデフォルト（anon JWT でも通る）では不十分。`isServiceRoleAuthorized` による 401 ガードを必ず入れる（I-6 で検出する）
- **pg_cron の実行時刻**: cron 式は **UTC** で解釈される。`'0 17 * * 1,4'` = 月・木 17:00 UTC = 火・金 02:00 JST。JST のつもりで `'0 2 * * 2,5'` と書かない
- **Vault にキーを入れる前に SQL を commit しない**: `schedule_crawl_spot_sources.sql` には実キーを絶対に書かない（AC-A9 で検出する）
- **期限切れフィルタは表示側のみ**: DB には期限切れ項目が残る（ページが更新されるまで消えない）。表示時に `filterActiveItems` で落とすため、DB を直接見たときと画面表示が一致しないことがある。これは意図した挙動
- **日時整形は JST 固定**: `toLocaleString` / `getHours()` などローカル TZ 依存の API を使わない。Jest の実行環境 TZ でテストが揺れる（AC-D1 / AC-D2 で検出する）
- **文言は AC と一字一句合わせる**: `限定御朱印` / `公式サイトで確認` / `公式SNS` / `期間 ` / `取得 ` / `限定御朱印 N件` はテキスト一致で判定する。実装で言い回しを変えたい場合は本ファイルを先に更新する
- **`SpotCompactCard` の高さ制約**: 折りたたみボトムシートは `COMPACT_HEIGHT = 240`（`SpotBottomSheet.tsx:25`）固定。compact バリアントは1行のチップに収め、複数行にしない
- 実装が契約と食い違う事実を発見した場合は、契約書を黙って逸脱せず本ファイルを更新してから実装する
