# Issue #111: P2-02 限定御朱印ウォッチャー v2 — Instagram Business Discovery 対応（第1柱）

## 概要

`spot_info_sources` に登録済みの Instagram リンク（`source_type='sns_link'` の instagram.com URL、seed に **23 アカウント**）を Meta の **Instagram Business Discovery API**（Graph API v26.0・無料）で巡回対象にし、既存の `crawl-spot-sources` → Haiku 抽出 → `spot_aggregated_info` パイプラインに載せる。

P2-01（#104）で残った 2 つの精度課題を、Instagram の投稿メタデータで機械的に解消する:

| P2-01 の課題                                             | v2 での解消                                                       |
| -------------------------------------------------------- | ----------------------------------------------------------------- |
| 出典がページ単位（`source_url` = サイト URL）            | 投稿の **`permalink`** をアイテム単位の `source_url` にする       |
| 鮮度判定が LLM 頼み（ページ全文から日付を推測）          | 投稿の **`timestamp`** で機械的にカットオフしてから Claude に渡す |
| 公式サイトが更新停止した寺社（榴岡天満宮・最終 2022 年） | Instagram のみで発信している寺社をカバーできる                    |

パイプライン（**追加分は太字**）:

```
spot_info_sources
   ├─ source_type in ('official','rss')                    ← 既存: web パス（無変更）
   └─ source_type='sns_link' かつ host が instagram.com    ← 新規: Instagram パス
   ↓ pg_cron 週2回
crawl-spot-sources（既存 Edge Function に mode を追加）
   web パス:        fetch → HTML→テキスト → SHA-256 比較 → Haiku（ページ単位）
   Instagram パス:  business_discovery → timestamp で N 日カットオフ
                    → 投稿集合の SHA-256 比較 → Haiku（投稿単位・post_index で出典を紐付け）
   ↓ merge upsert（web は source_url キー / Instagram は source_key キー）
spot_aggregated_info（info_type='limited_goshuin'）
   ↓ 既存経路（無変更）
useSpotInfo → SpotDetailContent / SpotCompactCard → LimitedGoshuinSection
   ↓ 新規（最小変更）
出典リンクの文言を出典ホストで切り替える（Instagram permalink → 「Instagramの投稿を見る」）
```

- GitHub Issue: #111（feature-list P2-02）
- ブランチ: `feature/issue-111-instagram-business-discovery` → develop
- 前提: Meta セットアップは **完了済み**（`.claude/harness/handoff.md` 冒頭。IG ビジネスアカウント `goshuinsampo` / FB ページ連携 / アプリ `goshuin-sampo-watcher` / 長期トークン）

## 関連ドキュメント

- [Issue #104 契約書](./issue-104-limited-goshuin-watcher.md) — **本契約書の親**。P2-01 の設計・注意事項・運用ルールはすべて引き継ぐ
- [プロダクト方針 v2](../product/direction.md) — Phase 2「限定御朱印ウォッチャー MVP + サブスク導入」
- `.claude/harness/handoff.md` — Meta セットアップの実施記録、P2-01 の運用メモ（デプロイ・強制再抽出・抽出品質の防衛線）
- `supabase/functions/crawl-spot-sources/index.ts` / `supabase/functions/_shared/crawl.ts` — 変更対象の本体
- `.claude/skills/tdd-workflow/SKILL.md` — テスト規約

## 調査結果（実装方針の前提となる確定事実）

コードと実 API から確認済み（2026-08-03）。実装時にこの前提が崩れていたら契約書を先に更新する。

### 1. seed の Instagram URL は 23 件・形式は 2 パターン

`supabase/seeds/seed_spot_info_sources_phase1.sql` の `sns_link` 39 件のうち instagram.com は **23 件**。形式は `https://www.instagram.com/<username>/`（末尾スラッシュあり 21 件）と `https://www.instagram.com/<username>`（なし 2 件: `fushimiinaritaisha_official` / `kamomioyajinja`）。username にはピリオドを含むもの（`takekoma.inari` / `rokuonji_kinkakuji.official` / `yasukuni.official` / `zuiganji.temple` / `kamigamojinja.official`）がある。

**靖國神社は Instagram を 2 アカウント登録している**（`yasukuni.official` / `yasukunijinja`）。1 スポットに複数の Instagram ソースが存在しうる前提で設計する。

### 2. `source_type` の CHECK 制約は 3 値・SNS 表示は `sns_link` に依存している

`20260802000000_create_spot_info_sources.sql` の `CHECK (source_type IN ('official','rss','sns_link'))`。加えて:

- 部分インデックス `idx_spot_info_sources_sns` … `WHERE enabled = true AND source_type = 'sns_link'`
- 部分インデックス `idx_spot_info_sources_crawl_queue` … `WHERE enabled = true AND source_type <> 'sns_link'`
- `src/services/spotInfo.ts` の `fetchSpotSnsLinks` … `.match({ spot_id, source_type: 'sns_link', enabled: true })`

→ `source_type` に `'instagram'` を新設すると、**アプリの「公式SNS」リンク表示から 23 件が消える**（`fetchSpotSnsLinks` の `.match` に一致しなくなる）。migration + サービス層 + 部分インデックス + seed の 4 箇所を同時に直さないと回帰する。**設計判断 1 の結論に直結する事実**。

### 3. `mergeLimitedGoshuinItems` のマージ単位は `source_url` の完全一致

`supabase/functions/_shared/crawl.ts:165-171`:

```ts
return [...existing.filter(entry => entry.source_url !== sourceUrl), ...incoming];
```

Instagram のアイテムは `source_url` が **投稿 permalink**（`https://www.instagram.com/p/<shortcode>/`）になり、ソース行の URL（プロフィール URL）とは決して一致しない。**この関数をそのまま呼ぶと、過去の Instagram 由来アイテムが 1 つも除去されず無限に積み上がる**。しかも Instagram の permalink には username が含まれないため、permalink からアカウントを逆引きすることもできない。→ **設計判断 4 の結論に直結する事実**。

### 4. 既存の `spot_aggregated_info` 行には `source_key` が存在しない

P2-01 は本番稼働済みで、`info_data.items` の各要素は `{ name, period, period_start, period_end, description, source_url, fetched_at }` のみ。**web パスのマージキーを `source_url` から別のキーに切り替えると、既存行のアイテムが「別ソース由来」と判定されて重複する**。web パスのマージ実装は絶対に変えない。

### 5. Edge Function は Lint / 型チェックの対象外・Jest は Deno を読めない

- `.eslintrc.js` の `ignorePatterns` / `tsconfig.json` の `exclude` に `supabase/functions`
- `jest.config.js` の `testMatch` は `**/*.test.{ts,tsx}` → **Deno テストは必ず `*_test.ts`（アンダースコア）** にする
- `which deno` / `which supabase` はいずれも not found（2026-08-03 再確認）。Deno テストとデプロイは manual-ops 扱い

### 6. 実 API の挙動（2026-08-03 に神田明神で確認済み）

- エンドポイント: `GET https://graph.facebook.com/v26.0/{IG_USER_ID}?fields=business_discovery.username(<username>){username,media.limit(N){caption,permalink,timestamp}}`
- Supabase secrets に `META_ACCESS_TOKEN`（長期ユーザートークン・**期限 2026-10-02**）と `META_IG_USER_ID`（`17841439672371375`）が登録済み。関数からは `Deno.env.get()` で参照する
- `me/accounts` は空を返す環境のため、**IG User ID は secrets から直接使う**（動的解決しない）
- `kandamyoujin` で caption / permalink / timestamp を取得成功。**7/7 の投稿に「七夕守は8月7日まで授与」という期限付き"授与品"の告知**があり、`isLikelyGoshuin` ガードの回帰ケースとして好適（お守りなので items に入ってはいけない）
- 対象が Business / Creator アカウントでない場合と、username が存在しない場合はいずれも HTTP 400 + `OAuthException` **code 110**
- レート制限: 週 2 回 × 23 アカウント（= 46 call/週）は余裕。ただし 1 回の実行での呼び出し上限を設計で明示する（設計判断 6）

### 7. デプロイ・認可の運用（P2-01 で確立）

- Supabase CLI は必ず `npx supabase@latest`。デプロイは `--use-api --no-verify-jwt` を付ける
- `verify_jwt = false`（`supabase/config.toml` に明記済み）。関数環境の `SUPABASE_SERVICE_ROLE_KEY` は **`sb_secret_...`**（legacy JWT `eyJ...` ではない）
- service_role キーの取得: `npx supabase@latest projects api-keys --project-ref tvnozkpxncmnehyomoff --reveal`（**`--reveal` 必須**）
- 強制再抽出: `spot_info_sources.content_hash` を null に PATCH → `{"spot_id": "..."}` 付きで関数を叩く

## 設計判断（機能要望で提示された 10 論点への結論）

各論点の結論と、採らなかった案・その理由を明示する。**実装はこの結論から逸脱しない**。

### 判断 1: `source_type` の表現 → **migration は行わない。`sns_link` のまま URL ホストで判別する**

Instagram 巡回対象の定義を「`enabled = true` **かつ** `source_type = 'sns_link'` **かつ** URL のホストが `instagram.com` / `www.instagram.com` / `m.instagram.com` のいずれかで、パスがプロフィール 1 セグメントの行」とする。

| 影響先                                 | 本方針での影響                                                                                                                                              |
| -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `CHECK (source_type IN (...))`         | **無変更**（3 値のまま）                                                                                                                                    |
| `idx_spot_info_sources_sns`（表示用）  | **無変更**。23 件は引き続き「公式SNS」リンクとして表示される                                                                                                |
| `idx_spot_info_sources_crawl_queue`    | **無変更**。web パスのキューに Instagram 行が混ざらない                                                                                                     |
| `fetchSpotSnsLinks`（`src/services/`） | **無変更**                                                                                                                                                  |
| `supabase/seeds/`                      | **無変更**（23 行をそのまま巡回対象にできる）                                                                                                               |
| `spot_info_sources` の運用列           | `sns_link` 行にも `content_hash` / `last_crawled_at` / `last_changed_at` が入るようになる。参照側（`fetchSpotSnsLinks` は `id, url` のみ SELECT）に影響なし |

**採らなかった案**: `source_type = 'instagram'` を追加する migration。調査結果 2 のとおり、CHECK 制約 + 2 つの部分インデックス + `fetchSpotSnsLinks` + seed 23 行 + `src/types/supabase.ts` の union を同時に変えないと「公式SNS」表示が消える回帰になる。X（旧 Twitter）リンクは `sns_link` のまま残るため型を分けても異種混在は解消しない。得られるものに対して変更面積が大きすぎるため却下する。

**Instagram 行のキュー用インデックスも追加しない**。テーブル全体で 79 行、Instagram 対象は 23 行であり、Seq Scan で十分（インデックス追加は migration を要し、判断 1 の利点を打ち消す）。

### 判断 2: username 導出 → **純粋関数 `parseInstagramUsername(url)` で正規化する**（仕様は「対象ファイル > `_shared/instagram.ts`」を参照）

末尾スラッシュ・クエリ・フラグメント・`@` 接頭辞・大文字混在をすべて吸収し、プロフィール URL 以外（`/p/...` / `/reel/...` / `/explore/` 等）と instagram.com 以外のホストは `null` を返す。`null` の行は巡回対象から外す（`skipped_invalid_url` に計上）。

### 判断 3: 鮮度判定 → **`timestamp` による 60 日のスライディングウィンドウ**

- 定数 `INSTAGRAM_LOOKBACK_DAYS = 60`。`filterRecentPosts(posts, nowMs, 60)` が `Date.parse(timestamp) >= nowMs - 60*86400000` を満たす投稿だけを残す（パース不能な timestamp の投稿は破棄）
- **既存の日付注入プロンプトは維持する**。機械カットオフは「Claude に渡す前段の足切り」であり、プロンプト側の過去告知除外ルール（「8 月時点での新年限定を除外」「開始のみ記載は頒布中とみなす」）は二重の防衛線としてそのまま残す。P2-01 の PR #109 で獲得した挙動を落とさない
- 加えて投稿ごとに `【投稿日】<JST の YYYY-MM-DD>` をプロンプトに渡し、「投稿日は告知時期の手がかりとしてのみ使う。`period` / `period_start` / `period_end` に投稿日を書かない」と明示する（本文に無い期間の創作を防ぐ）
- **意図した副作用**: 窓が滑るため、60 日を過ぎた投稿由来のアイテムは次回巡回で消える。差分ハッシュを窓の内容から計算する（判断 5）ため、この消滅は自動的に起きる。DB に古いアイテムを残さないための設計であり、バグではない
- **通年・季節替わりの御朱印が窓から外れる場合がある**（例: 宮城縣護國神社の通年切り絵が 60 日以上前の投稿でしか告知されていない場合）。これは許容する。同スポットは公式サイトも `official` ソースとして登録済みで、web パスがカバーする

### 判断 4: アイテムの `source_url` = 投稿 permalink / マージ単位 → **`source_key` を新設し、Instagram だけ別関数でマージする**

- アイテムの `source_url` は **投稿 permalink**（コード側で `posts[post_index].permalink` から付与。Claude の出力は採用しない）
- アイテムに **省略可能フィールド `source_key`** を追加し、Instagram 由来のアイテムには `` `instagram:${username}` `` を入れる（例: `instagram:kandamyoujin`）。URL 表記の揺れ（末尾スラッシュ等）に影響されないキーにするため、プロフィール URL そのものではなく username から作る
- 新関数 `mergeItemsBySourceKey(existing, sourceKey, incoming)` が `entry.source_key !== sourceKey` の要素だけを残して `incoming` を連結する
- **web パスの `mergeLimitedGoshuinItems` は 1 行も変えない**（調査結果 4）。両者は安全に共存する:
  - web マージ: Instagram アイテムの `source_url` は permalink なので web ソース URL と一致せず、除去されない ✓
  - Instagram マージ: web アイテムは `source_key` を持たない（`undefined !== 'instagram:xxx'`）ので除去されない ✓
  - 靖國神社のように 1 スポットに 2 アカウントある場合、キーが `instagram:yasukuni.official` / `instagram:yasukunijinja` と別になり互いを消さない ✓
- 表示側の `LimitedGoshuinSection` は `key={`${item.source_url}-${index}`}` を使っており、permalink が投稿ごとに異なっても衝突しない（**無変更**）

**採らなかった案**: `mergeLimitedGoshuinItems` に述語を渡せるよう一般化する / web パスも `source_key` に移行する。後者は本番の既存行が `source_key` を持たないためアイテムが重複する（調査結果 4）。

### 判断 5: `content_hash` / 差分検知 → **窓内の投稿の「permalink + timestamp + caption」を連結した文字列の SHA-256**

```
buildInstagramContentKey(posts) =
  posts.map(p => `${p.permalink}\t${p.timestamp}\t${p.caption}`).sort().join('\n')
hash = await sha256Hex(key)   // 既存 sha256Hex を再利用
```

- `sort()` で API のレスポンス順に依存しない決定的な値にする（ハッシュ計算用のコピーのみソートし、プロンプトに渡す配列の順序は API のまま = 新しい順を保つ）
- caption を含めるのは、Instagram で **投稿本文が後から編集される**（timestamp は変わらない）ため。編集を差分として拾える
- 窓が滑って古い投稿が抜けてもハッシュが変わる → 再抽出が走り、消えるべきアイテムが消える（判断 3 と整合）
- 窓内投稿が **0 件**のときは Claude を呼ばず、`incoming = []` としてマージする（そのアカウント由来のアイテムがすべて消える）。`changed` は加算するが `extracted` は加算しない
- ハッシュが一致したときは Claude を呼ばず `last_crawled_at` のみ更新（web パスと同じ）

### 判断 6: エラー時の挙動・ログ・RunSummary

`classifyGraphApiError(status, json)` が HTTP ステータスと `error.code` から 4 分類し、それぞれ次のように扱う。

| 分類            | 契機                                                | 挙動                                                                                                                                                             | ログ                                                                           | RunSummary                                              |
| --------------- | --------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ | ------------------------------------------------------- |
| `not_business`  | code **110**（Business/Creator でない・存在しない） | **その source のみスキップ**して次へ（graceful degradation。アプリでは従来どおり「公式SNS」リンク表示のまま）。`last_crawled_at` のみ更新                        | `console.warn('[crawl][ig] not a business account:', username)`                | `instagram.skipped_not_business++`                      |
| `token_invalid` | code **190** / **102**                              | **Instagram パス全体を即座に中断**（以降の Graph 呼び出しを一切行わない）。当該 source は `failed` に計上し `last_crawled_at` は更新しない（次回リトライさせる） | `console.error('[crawl][ig] META_ACCESS_TOKEN invalid or expired (code 190)')` | `instagram.token_invalid = true` / `instagram.failed++` |
| `rate_limited`  | HTTP **429** / code **4, 17, 32, 613**              | **Instagram パス全体を即座に中断**。当該 source は `last_crawled_at` を更新しない                                                                                | `console.warn('[crawl][ig] rate limited, aborting instagram pass')`            | `instagram.rate_limited = true`                         |
| `other`         | 上記以外の非 2xx / fetch 例外 / タイムアウト        | その source のみ `failed` 計上して次へ。`last_crawled_at` のみ更新                                                                                               | `console.warn('[crawl][ig] graph api error:', username, status, code)`         | `instagram.failed++`                                    |

- `META_ACCESS_TOKEN` または `META_IG_USER_ID` が未設定のときは **Instagram パスを丸ごとスキップ**し、`instagram.skipped_no_credentials = true` を返す。**web パスは通常どおり動く**（secrets が消えても既存機能を壊さない）
- どの分類でも HTTP ステータスは **200 + サマリ JSON**（cron がリトライストームを起こさないため）。異常は summary のフラグとログで観測する
- **トークンを絶対にログへ出さない**。`buildBusinessDiscoveryUrl` は access_token を含まない URL を返し、token は fetch 直前に付与する（判断 9）

### 判断 7: `dry_run` の挙動 → **Graph API は叩き、Claude と DB 書き込みを行わない**

`dry_run: true` のとき、Instagram パスは:

1. Graph API を呼ぶ（無料。疎通・code 110 の切り分けを dry_run で確認できるようにするため）
2. 窓のフィルタとハッシュ計算まで行い、`changed` / `unchanged` を計上する
3. **Claude を呼ばない・`spot_aggregated_info` に書かない・`content_hash` を更新しない**
4. `last_crawled_at` **のみ**更新する

これは web パスの現行 `dry_run` 挙動（`touchSource(last_crawled_at)` のみ）と同一の考え方。

### 判断 8: Claude 抽出プロンプト → **既存 `SYSTEM_PROMPT` は 1 文字も変えず、`INSTAGRAM_SYSTEM_PROMPT` を新設する**

web パスの回帰リスクをゼロにするため、既存プロンプト定数には触れない。Instagram 用は既存を土台に次の差分を持つ（全文は「詳細設計 > Claude 抽出（Instagram パス）」）。

- 主語を「寺社の公式サイト」→「寺社の公式 Instagram アカウントの投稿」に変更
- 「推測・創作・補完は一切行わない」「授与品（お守り・破魔矢・土鈴等）は絶対に含めない」の 2 ブロックは**そのまま維持**
- 過去告知の除外 / 頒布中の維持ルールも**そのまま維持**（PR #109 の成果）
- **追加**: 各 item に `post_index`（0 起点の整数）を必須で入れさせる。同じ御朱印が複数投稿に出る場合は最も新しい（番号の小さい）投稿の 1 件だけにする
- **追加**: 【投稿日】の使い方の制約（告知時期の手がかりとしてのみ使い、`period` 系に書かない）

**1 ソース = 1 Claude 呼び出し**（投稿ごとに呼ばない）。理由: 23 アカウント分を `RUN_BUDGET_MS = 100_000` に収めるため、および投稿をまたいだ文脈（前の投稿の続報など）を読ませるため。出典の紐付けは `post_index` の整数インデックスで行い、**コード側が `posts[post_index].permalink` を代入する**。範囲外・非整数・欠落の `post_index` を持つ item は**破棄**する（URL 文字列を Claude に返させないので出典の捏造が原理的に起きない）。

回帰確認スポット（manual-ops I 群で実施）:

| スポット       | username                 | 確認内容                                                           |
| -------------- | ------------------------ | ------------------------------------------------------------------ |
| 神田明神       | `kandamyoujin`           | 期限付き**授与品**「七夕守」が items に**入らない**                |
| 八坂神社       | `kyotogionyasaka`        | 授与品一覧から御朱印以外が items に**入らない**                    |
| 榴岡天満宮     | `tsutsujigaoka_tenmangu` | 公式サイトが更新停止していても Instagram から items が**入る**     |
| 宮城縣護國神社 | `gokokumiyagi`           | 通年切り絵が窓内にあれば items に入る / 窓外なら入らない（判断 3） |

### 判断 9: トークン期限切れへの備え → **失効を検知して痕跡を残すところまで**

- code 190 / 102 を検知したら `console.error('[crawl][ig] META_ACCESS_TOKEN invalid or expired (code 190)')` を出し、`instagram.token_invalid = true` をレスポンスに含める（pg_net は `net._http_response` にレスポンス本文を保存するため、SQL Editor から後追いできる）
- `supabase/cron/schedule_crawl_spot_sources.sql` に **期限 2026-10-02 と更新手順**（アクセストークンデバッガーで延長 → `npx supabase@latest secrets set META_ACCESS_TOKEN=...`）をコメントで残す
- **運用アラート（Slack / メール通知）・トークンの自動更新はスコープ外**

### 判断 10: UI 変更 → **出典リンクの文言を出典ホストで切り替える 1 点のみ**

Instagram の投稿 permalink に「公式サイトで確認」と表示するのは事実と異なるため、純粋関数 `sourceLinkLabel(url)` を `LimitedGoshuinSection.tsx` に追加し、ホストが `instagram.com` / `www.instagram.com` / `m.instagram.com` のときだけ **`Instagramの投稿を見る`** を返す（それ以外・パース不能はすべて従来どおり `公式サイトで確認`）。

- レイアウト・testID・アイコン・スタイル・compact バリアントはすべて**無変更**
- 既存 30 テストは `source_url: 'https://example.jp/goshuin'` を使っているため**すべて無変更で通る**
- 「公式SNS」セクション（プロフィール URL のリンク）も**無変更**（`fetchSpotSnsLinks` を変えないため）
- `src/hooks/useSpotInfo.ts` / `src/services/spotInfo.ts` / `SpotDetailContent` / `SpotCompactCard` は**無変更**

## 詳細設計

### 対象ファイル

#### 新規

| ファイル                                       | 内容                                                           |
| ---------------------------------------------- | -------------------------------------------------------------- |
| `supabase/functions/_shared/instagram.ts`      | Instagram パスの純粋関数（9 関数）                             |
| `supabase/functions/_shared/instagram_test.ts` | 上記の Deno ユニットテスト（**`instagram.test.ts` にしない**） |

#### 変更

| ファイル                                                              | 変更内容                                                                                                                                                                                                                                                    |
| --------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `supabase/functions/_shared/crawl.ts`                                 | `LimitedGoshuinItem` に `source_key?: string \| null` を追加。`normalizeGoshuinItem` と `mergeItemsBySourceKey` を追加 export。`normalizeItems` を `normalizeGoshuinItem` を使う形にリファクタ（**外部挙動は不変**）。既存 9 関数のシグネチャ・挙動は無変更 |
| `supabase/functions/_shared/crawl_test.ts`                            | テスト**追加のみ**（既存 42 テストは 1 行も変更・削除しない）                                                                                                                                                                                               |
| `supabase/functions/crawl-spot-sources/index.ts`                      | `mode` の受付、Instagram パス（`runInstagramPass`）、`INSTAGRAM_SYSTEM_PROMPT`、Instagram 用定数、`RunSummary.instagram` を追加。**既存 web パスのロジック・`SYSTEM_PROMPT` は無変更**                                                                      |
| `supabase/cron/schedule_crawl_spot_sources.sql`                       | 既存 job の body に `'mode','web'` を追加。Instagram 用の 2 つ目の job を追加。トークン期限と更新手順のコメントを追加                                                                                                                                       |
| `src/types/supabase.ts`                                               | `LimitedGoshuinItem` に `source_key?: string \| null` を追加（他の型は無変更）                                                                                                                                                                              |
| `src/components/spot-detail/LimitedGoshuinSection.tsx`                | `sourceLinkLabel(url)` を追加 export し、出典リンクのテキストに使う。他は無変更                                                                                                                                                                             |
| `src/components/spot-detail/__tests__/LimitedGoshuinSection.test.tsx` | テスト**追加のみ**（既存 30 テストは無変更）                                                                                                                                                                                                                |

#### 変更しないファイル

`supabase/migrations/` 配下すべて、`supabase/seeds/` 配下すべて、`supabase/functions/extract-spot-info/` 配下すべて、`supabase/functions/crawl-spot-sources/deno.json`、`supabase/config.toml`、`src/services/spotInfo.ts` とそのテスト、`src/hooks/useSpotInfo.ts` とそのテスト、`src/components/spot-detail/SpotDetailContent.tsx` / `SpotCompactCard.tsx` / `SpotInfoSection.tsx` / `SpotBottomSheet.tsx` とそれぞれのテスト、`src/screens/` 配下すべて、`src/navigation/` 配下すべて、`jest.setup.js`、`jest.config.js`、`.eslintrc.js`、`tsconfig.json`、`package.json`。

### データ構造

#### `LimitedGoshuinItem`（`_shared/crawl.ts` と `src/types/supabase.ts` の両方）

```ts
export interface LimitedGoshuinItem {
  name: string;
  period: string | null;
  period_start?: string | null;
  period_end?: string | null;
  description?: string | null;
  source_url: string; // web: ページ URL / Instagram: 投稿 permalink
  fetched_at: string;
  source_key?: string | null; // 追加。Instagram のみ `instagram:${username}`。web は未設定
}
```

#### `InstagramPost`（`_shared/instagram.ts`）

```ts
export interface InstagramPost {
  permalink: string; // 例 https://www.instagram.com/p/DL1234abcd/
  timestamp: string; // 例 2026-07-07T09:12:33+0000（Graph API の生値）
  caption: string; // 欠落時は ''
}
```

#### `spot_aggregated_info` への書き込み（`info_type='limited_goshuin'`）

P2-01 と同一（`source_stamp_ids: []` / `confidence_score: 0.9` / `last_reported_at = fetched_at`）。**`confidence_score` は Instagram 由来でも 0.9 固定**（`(spot_id, info_type)` で 1 行しか持てず、web と Instagram が同じ行を共有するため差をつけない）。

`info_data.items` の Instagram 由来要素の例:

```json
{
  "name": "七夕限定御朱印",
  "period": "7月1日〜7月7日",
  "period_start": null,
  "period_end": null,
  "description": "書き置きのみ",
  "source_url": "https://www.instagram.com/p/DL1234abcd/",
  "fetched_at": "2026-08-03T17:00:00.000Z",
  "source_key": "instagram:kandamyoujin"
}
```

### `_shared/instagram.ts` の純粋関数（すべて export）

| 関数                          | シグネチャ                                                                                                                 |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `parseInstagramUsername`      | `(url: string) => string \| null`                                                                                          |
| `buildBusinessDiscoveryUrl`   | `(igUserId: string, username: string, mediaLimit: number) => string`                                                       |
| `classifyGraphApiError`       | `(status: number, json: unknown) => 'not_business' \| 'token_invalid' \| 'rate_limited' \| 'other'`                        |
| `parseBusinessDiscoveryPosts` | `(json: unknown) => InstagramPost[]`                                                                                       |
| `filterRecentPosts`           | `(posts: InstagramPost[], nowMs: number, lookbackDays: number) => InstagramPost[]`                                         |
| `toJstDate`                   | `(iso: string) => string`                                                                                                  |
| `buildInstagramContentKey`    | `(posts: InstagramPost[]) => string`                                                                                       |
| `buildInstagramUserMessage`   | `(todayJst: string, username: string, posts: InstagramPost[], maxCaptionChars: number, maxTotalChars: number) => string`   |
| `normalizeInstagramItems`     | `(raw: unknown[], posts: InstagramPost[], sourceKey: string, fetchedAt: string, maxItems: number) => LimitedGoshuinItem[]` |

#### `parseInstagramUsername`

1. `new URL(url)` に失敗したら `null`
2. `protocol !== 'https:'` なら `null`（web パスの SSRF ポリシーと揃える）
3. `hostname.toLowerCase()` が `instagram.com` / `www.instagram.com` / `m.instagram.com` の**いずれかと完全一致**しなければ `null`（部分一致にしない。`instagram.com.evil.jp` を弾く）
4. `pathname` を `/` で分割して空セグメントを除去。**セグメント数がちょうど 1 でなければ `null`**（`/p/<shortcode>/` や `/explore/tags/x` を弾く）
5. そのセグメントの先頭 `@` を 1 個だけ剥がし、`toLowerCase()` する
6. 予約語（`p` / `reel` / `reels` / `tv` / `stories` / `explore` / `accounts` / `direct` / `about` / `developer` / `legal` / `privacy` / `help` / `challenge` / `session` / `oauth` / `web` / `graphql` / `api` / `s`）に一致したら `null`
7. `/^[a-z0-9._]{1,30}$/` に一致しなければ `null`。一致すればその文字列を返す

クエリ文字列とフラグメントは `pathname` を使うため自動的に無視される。

#### `buildBusinessDiscoveryUrl`

```ts
const fields = `business_discovery.username(${username}){username,media.limit(${mediaLimit}){caption,permalink,timestamp}}`;
return `https://graph.facebook.com/v26.0/${encodeURIComponent(igUserId)}?${new URLSearchParams({ fields }).toString()}`;
```

**戻り値に `access_token` を含めない**。token は `index.ts` が fetch 直前に `&access_token=${encodeURIComponent(token)}` を付ける。こうすることで「ログに出せる URL」と「実際に投げる URL」を型レベルで分離し、トークン漏洩を構造的に防ぐ。

#### `classifyGraphApiError`

- `status === 429` → `'rate_limited'`
- `json.error.code` を数値として読む（読めなければ `'other'`）
  - `110` → `'not_business'`
  - `190` / `102` → `'token_invalid'`
  - `4` / `17` / `32` / `613` → `'rate_limited'`
  - それ以外 → `'other'`

#### `parseBusinessDiscoveryPosts`

`json.business_discovery.media.data` を辿る。途中がオブジェクトでない / 配列でない場合は `[]`。各要素について:

- `permalink` が文字列で、`new URL()` でパースでき、`protocol === 'https:'`、ホストが instagram.com 系（`parseInstagramUsername` と同じホスト集合）でなければ**破棄**
- `timestamp` が文字列で `Number.isNaN(Date.parse(timestamp)) === false` でなければ**破棄**
- `caption` は文字列ならその値、それ以外は `''`
- **API のレスポンス順（新しい順）を保持**して返す

#### `filterRecentPosts`

`cutoff = nowMs - lookbackDays * 86_400_000`。`Date.parse(p.timestamp) >= cutoff` の投稿だけを順序を保って返す。パース不能は除外。**入力配列を破壊しない**。

#### `toJstDate`

`Date.parse(iso)` が NaN なら `''`。そうでなければ `new Date(parsed + 9*60*60*1000).toISOString().slice(0, 10)`。

#### `buildInstagramContentKey`

```ts
return posts
  .map(p => `${p.permalink}\t${p.timestamp}\t${p.caption}`)
  .sort()
  .join('\n');
```

（`sort()` は `map` が返した新配列に対して行うため入力を破壊しない。空配列なら `''`。）

#### `buildInstagramUserMessage`

出力フォーマットを次に固定する（テキスト一致で検証する）:

```
【今日の日付】2026-08-03
【アカウント】@kandamyoujin
【投稿数】2

--- 投稿 0 ---
【投稿日】2026-07-08
【本文】
七夕限定御朱印を7月1日から7月7日まで頒布します。

--- 投稿 1 ---
【投稿日】2026-07-01
【本文】
（本文なし）
```

- 各投稿の `caption` は `maxCaptionChars` で切り詰める。空文字なら `（本文なし）`
- 投稿は**先頭から順に**追加し、**追加後の総文字数が `maxTotalChars` を超える投稿以降は含めない**（先頭側の `post_index` がずれないようにするため、末尾から落とす）
- `【投稿数】` にはヘッダに実際に含めた投稿の件数ではなく **`posts.length`** を書く（`post_index` の値域を Claude に伝えるため）
- 投稿の番号は `posts` 配列の**位置そのまま**（0 起点）

#### `normalizeInstagramItems`

```ts
for (const entry of raw) {
  if (items.length >= maxItems) break;
  if (typeof entry !== 'object' || entry === null) continue;
  const idx = (entry as Record<string, unknown>).post_index;
  if (typeof idx !== 'number' || !Number.isInteger(idx) || idx < 0 || idx >= posts.length) continue;
  const item = normalizeGoshuinItem(entry, posts[idx].permalink, fetchedAt);
  if (!item) continue;
  items.push({ ...item, source_key: sourceKey });
}
```

`normalizeGoshuinItem`（`_shared/crawl.ts` から import）が name 必須 / `isLikelyGoshuin` ガード / 100・300 文字切り詰め / `YYYY-MM-DD` 判定をすべて担う。**Claude が返した `source_url` / `fetched_at` / `source_key` は一切採用しない**。

### `_shared/crawl.ts` への追加

```ts
/** 1 要素分の正規化。破棄すべき要素は null。normalizeItems と Instagram パスで共有する */
export function normalizeGoshuinItem(
  entry: unknown,
  sourceUrl: string,
  fetchedAt: string
): LimitedGoshuinItem | null;

/** source_key 単位のマージ。source_key を持たない要素（web 由来）は常に保持する。入力は破壊しない */
export function mergeItemsBySourceKey(
  existing: LimitedGoshuinItem[],
  sourceKey: string,
  incoming: LimitedGoshuinItem[]
): LimitedGoshuinItem[];
```

`normalizeItems` は `normalizeGoshuinItem` を使うループに置き換えるが、**シグネチャ・戻り値・破棄条件・切り詰め幅・件数上限のすべてを現行どおりに保つ**（既存 Deno テストが 1 行も変わらずに通ることで担保する）。`isServiceRoleAuthorized` / `isAllowedSourceUrl` / `isCrawlableContentType` / `htmlToText` / `sha256Hex` / `parseClaudeJson` / `isLikelyGoshuin` / `mergeLimitedGoshuinItems` / `isPastDeadline` も無変更。

### `crawl-spot-sources/index.ts` の変更

#### 追加する定数

```ts
const META_GRAPH_VERSION = 'v26.0';
const MAX_INSTAGRAM_SOURCES_PER_RUN = 25; // 1回の実行で叩く Graph API 呼び出しの上限（1 source = 1 call・ページングなし・リトライなし）
const INSTAGRAM_MEDIA_LIMIT = 25; // 1アカウントあたり取得する投稿数
const INSTAGRAM_LOOKBACK_DAYS = 60; // timestamp による機械的な鮮度カットオフ
const MAX_CAPTION_CHARS = 1_500; // 1投稿の caption を Claude に渡す上限
const MAX_INSTAGRAM_PROMPT_CHARS = 30_000; // 投稿一覧全体の上限
```

`MAX_ITEMS_PER_SOURCE`（10）・`FETCH_TIMEOUT_MS`（10 秒）・`RUN_BUDGET_MS`（100 秒）・`CLAUDE_MODEL`・`CLAUDE_MAX_TOKENS` は既存値を Instagram パスでも共用する。

**1 回の実行での外部 API 呼び出し上限（明示）**: Graph API ≤ **25 回**、Claude API ≤ **25 回**（変化があった source のみ）、web パスの外部 fetch ≤ **20 回**、web パスの Claude ≤ **20 回**。

#### リクエストボディ

```ts
{ limit?: number; spot_id?: string; dry_run?: boolean; mode?: 'web' | 'instagram' | 'all' }
```

- `mode` の既定値は `'all'`。`'web' | 'instagram' | 'all'` 以外の値は `'all'` として扱う
- `mode === 'all'` のとき **Instagram パスを先に実行し、その後 web パス**を実行する。理由: Instagram パスは呼び出し回数が上限 25 で頭打ちの短時間処理であり、先に走らせないと web パスが `RUN_BUDGET_MS` を使い切って Instagram が恒久的に飢える
- `limit` は両パスに適用し、それぞれ `1..MAX_SOURCES_PER_RUN` / `1..MAX_INSTAGRAM_SOURCES_PER_RUN` にクランプする
- `spot_id` は両パスの絞り込みに使う（手動再クロール用）
- `isPastDeadline(startedAt, Date.now(), RUN_BUDGET_MS)` は**両パスのループ先頭で判定**する（`startedAt` は 1 リクエストで共通）

#### `RunSummary`

既存フィールドは 1 つも変えず、`instagram` を追加する。`mode` に関わらず**常に含める**（走らなかったパスは 0 / false）。

```json
{
  "processed": 20,
  "changed": 3,
  "extracted": 3,
  "unchanged": 15,
  "failed": 1,
  "skipped_blocked": 0,
  "skipped_content_type": 1,
  "deadline_reached": false,
  "instagram": {
    "processed": 23,
    "changed": 4,
    "extracted": 3,
    "unchanged": 18,
    "failed": 0,
    "skipped_invalid_url": 0,
    "skipped_not_business": 1,
    "skipped_no_credentials": false,
    "rate_limited": false,
    "token_invalid": false,
    "deadline_reached": false
  }
}
```

#### Instagram パスの処理フロー

1. `Deno.env.get('META_ACCESS_TOKEN')` と `Deno.env.get('META_IG_USER_ID')` を読む。どちらかが空 / 未設定なら `instagram.skipped_no_credentials = true` を立てて**パスごとスキップ**（return）
2. 巡回対象を取得:
   ```ts
   let q = supabase
     .from('spot_info_sources')
     .select('id, spot_id, url, source_type, content_hash')
     .eq('enabled', true)
     .eq('source_type', 'sns_link')
     .ilike('url', '%instagram.com%')
     .order('last_crawled_at', { ascending: true, nullsFirst: true })
     .limit(igLimit);
   if (body.spot_id) q = q.eq('spot_id', body.spot_id);
   ```
3. **1 件ずつ逐次処理**。各 source は `try/catch` で囲み、1 件の失敗でパス全体を止めない。ループ先頭で `isPastDeadline` を判定し、超えたら `instagram.deadline_reached = true` で打ち切る。`rate_limited` / `token_invalid` が立ったら以降のループを打ち切る
4. 各 source の処理:
   1. `username = parseInstagramUsername(source.url)`。`null` なら `instagram.skipped_invalid_url++` して次へ（`last_crawled_at` は更新しない = 登録ミスに気付けるようにする）
   2. `instagram.processed++`
   3. `url = buildBusinessDiscoveryUrl(igUserId, username, INSTAGRAM_MEDIA_LIMIT)` に token を付けて `AbortController` + `FETCH_TIMEOUT_MS` / `redirect: 'error'` で fetch
   4. 非 2xx なら本文を JSON としてパースし `classifyGraphApiError(status, json)` で分岐（判断 6 の表のとおり）
   5. `posts = filterRecentPosts(parseBusinessDiscoveryPosts(json), Date.now(), INSTAGRAM_LOOKBACK_DAYS)`
   6. `hash = await sha256Hex(buildInstagramContentKey(posts))`
   7. `hash === source.content_hash` → `instagram.unchanged++`、`last_crawled_at` のみ更新して次へ
   8. `instagram.changed++`。`dry_run` なら `last_crawled_at` のみ更新して次へ（判断 7）
   9. `posts.length === 0` なら Claude を呼ばず `newItems = []`。そうでなければ:
      ```ts
      const todayJst = toJstDate(new Date().toISOString());
      const message = buildInstagramUserMessage(
        todayJst,
        username,
        posts,
        MAX_CAPTION_CHARS,
        MAX_INSTAGRAM_PROMPT_CHARS
      );
      // Claude Haiku 4.5 を INSTAGRAM_SYSTEM_PROMPT で呼ぶ
      // （既存 callClaudeApi と同じ形。model / max_tokens / anthropic-version は共通）
      const newItems = normalizeInstagramItems(
        parseClaudeJson(text).items,
        posts,
        `instagram:${username}`,
        fetchedAt,
        MAX_ITEMS_PER_SOURCE
      );
      ```
      成功したら `instagram.extracted++`。Claude が非 2xx なら throw → `instagram.failed++`、**`content_hash` は更新しない**（次回再抽出）
   10. `spot_aggregated_info` の既存行を読み、マージする:

       ```ts
       const merged = mergeItemsBySourceKey(existingItems, `instagram:${username}`, newItems);
       ```

       - `merged.length === 0` → 該当行を `delete`
       - それ以外 → 既存 web パスと同一の `upsert`（`onConflict: 'spot_id,info_type'`）

   11. `spot_info_sources` を `{ content_hash: hash, last_crawled_at: fetchedAt, last_changed_at: fetchedAt, updated_at: fetchedAt }` で更新

### Claude 抽出（Instagram パス）

`INSTAGRAM_SYSTEM_PROMPT` の全文:

```
あなたは寺社の公式 Instagram アカウントの投稿から「限定御朱印」の情報だけを抽出するアシスタントです。
投稿本文に明示的に書かれている情報のみを抽出し、推測・創作・補完は一切行わないでください。
書かれていない項目は null にしてください。年号の変換や期間の推定も行わないでください。

抽出対象は「期間限定・月替わり・行事限定などの特別な御朱印」だけです。
「御朱印」「朱印」「御集印」として明記されているものだけを対象とし、
通常の御朱印・御朱印帳の頒布・授与所の案内・イベント全般は対象外です。
お守り・お札・破魔矢・御神矢・土鈴・熊手・縁起物などの授与品は、
期間限定であっても御朱印ではないため絶対に含めないでください。

ユーザーメッセージには【今日の日付】と、投稿ごとの【投稿日】が含まれます。
次のものは items に含めないでください:
- 頒布期間の終了日が明記されていて、それが今日より前のもの
- 名称・期間・本文の表記から頒布時期が今日から見て明らかに過ぎているもの
  （例: 8月時点での「新年限定」「正月限定」、昨年以前の年号が明記された告知）
次のものは必ず含めてください（除外しないでください）:
- 現在頒布中のもの、頒布開始が今後のもの
- 「◯月から」「◯月〜」のように開始のみ記載され終了の記載が無いもの
  （開始が過去の月でも、終了していない限り頒布中とみなす）
- 通年・月替わり・季節替わりで続いているもの、期間の記載が無く現在の頒布と読めるもの

【投稿日】は「いつ告知されたか」の手がかりとしてのみ使ってください。
投稿日を period / period_start / period_end に書かないでください（本文に無い期間を作らないため）。

各 item には、その情報が書かれていた投稿の番号を post_index（0 起点の整数）で必ず入れてください。
同じ御朱印が複数の投稿に出てくる場合は、最も新しい（番号が小さい）投稿の番号を1つだけ使い、
item を重複させないでください。

以下の JSON のみを返してください。説明文・前置き・コードブロック外の文字は不要です。
{
  "items": [
    {
      "post_index": 0,
      "name": "御朱印の名称（本文の表記そのまま・必須）",
      "period": "頒布期間の表記そのまま。書かれていなければ null",
      "period_start": "期間開始が西暦日付として明記されている場合のみ YYYY-MM-DD。それ以外は null",
      "period_end": "期間終了が西暦日付として明記されている場合のみ YYYY-MM-DD。それ以外は null",
      "description": "初穂料・書き置きの別など補足。無ければ null"
    }
  ]
}
該当する限定御朱印が投稿に無い場合は {"items": []} を返してください。
```

### pg_cron（`supabase/cron/schedule_crawl_spot_sources.sql`）

既存 job の body に `mode` を明示し、Instagram 用の 2 つ目の job を **30 分ずらして**登録する。パスを分けることで、それぞれが独立した `RUN_BUDGET_MS` を持てるようにする。

```sql
-- 週2回（火・金 02:00 JST = 月・木 17:00 UTC）: 公式サイト / RSS
select cron.schedule(
  'crawl-spot-sources-biweekly', '0 17 * * 1,4',
  $$ ... body := jsonb_build_object('mode', 'web', 'limit', 20) ... $$
);

-- 週2回（火・金 02:30 JST = 月・木 17:30 UTC）: Instagram Business Discovery
select cron.schedule(
  'crawl-spot-sources-instagram', '30 17 * * 1,4',
  $$ ... body := jsonb_build_object('mode', 'instagram', 'limit', 25) ... $$
);
```

- 既存 job は登録済みのため、**再登録の手順**（`select cron.unschedule('crawl-spot-sources-biweekly');` してから再実行）をコメントで明記する
- `META_ACCESS_TOKEN` の**期限 2026-10-02** と更新手順（アクセストークンデバッガーで延長 → `npx supabase@latest secrets set META_ACCESS_TOKEN=...`）をコメントで残す
- **実キーは書かない**（Vault 参照のみ）

### 表示仕様（`LimitedGoshuinSection`）

追加する純粋関数（同ファイルから export）:

| 関数                   | 仕様                                                                                                                                                                                     |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `sourceLinkLabel(url)` | `new URL(url).hostname.toLowerCase()` が `instagram.com` / `www.instagram.com` / `m.instagram.com` のいずれかなら `'Instagramの投稿を見る'`、それ以外・パース不能は `'公式サイトで確認'` |

`limited-goshuin-source-{index}` のテキストを固定文字列 `公式サイトで確認` から `{sourceLinkLabel(item.source_url)}` に差し替える。**スタイル（`styles.linkText` = `typography.caption` + `colors.primary[500]`）・testID・アイコン（`open-in-new` / size 14 / `colors.primary[500]`）・押下時の `Linking.openURL(item.source_url)`・compact バリアント・「公式SNS」セクションはすべて無変更**。

## 既存テストの削除・変更一覧（明示的宣言）

契約として宣言した上で変更する（勝手に消さない）。**削除するテストは無い。既存アサーションの変更も無い。**

### `supabase/functions/_shared/crawl_test.ts`

- **追加のみ**: `normalizeGoshuinItem` と `mergeItemsBySourceKey` の `Deno.test` を追記する
- 既存 42 テストは 1 行も変更しない。`normalizeItems` のリファクタが外部挙動を変えていないことを、この「既存テストが無変更で通る」ことで担保する（AC-A19 / H-1）

### `src/components/spot-detail/__tests__/LimitedGoshuinSection.test.tsx`

- **追加のみ**: `sourceLinkLabel` の単体テストと、Instagram permalink を `source_url` に持つ item のレンダリングテストを追記する
- 既存 30 テストは無変更で通る（`source_url: 'https://example.jp/goshuin'` を使っており `公式サイトで確認` のまま）

### 変更しないテストファイル

`src/hooks/__tests__/useSpotInfo.test.ts`・`src/services/__tests__/spotInfo.test.ts`・`src/components/spot-detail/__tests__/SpotDetailContent.test.tsx`・`SpotCompactCard.test.tsx`・`SpotInfoSection.test.tsx`・`SpotBottomSheet.test.tsx`・`src/screens/__tests__/*`・`src/navigation/__tests__/*` は**一切変更しない**（AC-Q5）。

## テスト方針

TDD（t-wada 流）で Red → Green → Refactor。1 スライス = 1 コミット。推奨分割:

1. `refactor: extract normalizeGoshuinItem and add source_key merge helper` — `_shared/crawl.ts` + `crawl_test.ts` への追加（既存テストが無変更で通ることを先に確認）
2. `feat: add instagram business discovery helpers` — `_shared/instagram.ts` + `_shared/instagram_test.ts`（Deno テスト先行）
3. `feat: crawl instagram sources in crawl-spot-sources` — `index.ts`（mode / Instagram パス / プロンプト / RunSummary）
4. `chore: schedule instagram crawl and document token renewal` — cron SQL
5. `feat: label instagram permalinks in limited goshuin section` — `sourceLinkLabel` + 型 + テスト

規約:

- テストは対象と同階層の `__tests__/`。expo / Supabase のモックは `jest.setup.js` の既存分に依存し、個別に再モックしない
- `Linking.openURL` は `jest.spyOn(Linking, 'openURL').mockResolvedValue(true)` で検証する
- 「今日」に依存するテストは `jest.useFakeTimers().setSystemTime(...)` で固定し `afterEach` で戻す。Deno 側は `nowMs` を引数で受け取る設計にしているため実時刻に依存しない
- 1 テスト 1 アサーション / Arrange-Act-Assert。エッジケース（`post_index` 範囲外 / caption 欠落 / 窓内 0 件 / code 110 / code 190 / 429）を必ず含める
- TDD 中は `npm test -- --testPathPattern="LimitedGoshuinSection"`、最終確認で `npm test` 全件
- Deno テストは `deno test supabase/functions/_shared/`（Jest からは `*_test.ts` 命名により不可視）

## 受入基準（Acceptance Criteria）

goshuin-evaluator がこの基準に基づいて合否判定を行う。各基準は独立して検証可能。

区分:

| 群    | 検証手段                                                                     |
| ----- | ---------------------------------------------------------------------------- |
| **A** | `grep` / ファイル存在 / `git diff`（機械検証）                               |
| **D** | Jest（`npm test`。アプリ側の表示ロジック）                                   |
| **H** | **manual-ops: Deno ユニットテスト**（`deno` 未インストールのため）           |
| **I** | **manual-ops: 実 API / デプロイ / curl**（ユーザー作業）                     |
| **N** | **native-only**: 実機 iPhone 目視（Expo Web ではボトムシートに到達できない） |
| **Q** | 品質ゲート                                                                   |

**Edge Function の検証は H（純粋関数のユニットテスト）と I（実 API への手動確認）に完全に分離している。** H は外部通信なしで再現可能、I は実トークンと実アカウントを要する。

### A. ファイル・静的内容（`grep` / `git diff` で機械チェック）

- [ ] AC-A1: `supabase/functions/_shared/instagram.ts` が存在し、`parseInstagramUsername` / `buildBusinessDiscoveryUrl` / `classifyGraphApiError` / `parseBusinessDiscoveryPosts` / `filterRecentPosts` / `toJstDate` / `buildInstagramContentKey` / `buildInstagramUserMessage` / `normalizeInstagramItems` の 9 関数をすべて `export` している
- [ ] AC-A2: `supabase/functions/_shared/instagram_test.ts` が存在し、`supabase/functions/_shared/instagram.test.ts` が**存在しない**（`ls supabase/functions/_shared/` で確認）
- [ ] AC-A3: `supabase/functions/_shared/crawl.ts` が `normalizeGoshuinItem` と `mergeItemsBySourceKey` を `export` し、かつ既存 10 export（`isServiceRoleAuthorized` / `isAllowedSourceUrl` / `isCrawlableContentType` / `htmlToText` / `sha256Hex` / `parseClaudeJson` / `isLikelyGoshuin` / `normalizeItems` / `mergeLimitedGoshuinItems` / `isPastDeadline`）もすべて残っている
- [ ] AC-A4: `supabase/functions/_shared/crawl.ts` の `LimitedGoshuinItem` に `source_key?: string | null` がある
- [ ] AC-A5: `supabase/functions/crawl-spot-sources/index.ts` に `META_GRAPH_VERSION`（値 `'v26.0'`）・`MAX_INSTAGRAM_SOURCES_PER_RUN`・`INSTAGRAM_MEDIA_LIMIT`・`INSTAGRAM_LOOKBACK_DAYS`・`MAX_CAPTION_CHARS`・`MAX_INSTAGRAM_PROMPT_CHARS` の 6 定数が定義されている
- [ ] AC-A6: `index.ts` が `Deno.env.get('META_ACCESS_TOKEN')` と `Deno.env.get('META_IG_USER_ID')` を参照している
- [ ] AC-A7: `index.ts` の `console.log` / `console.warn` / `console.error` の引数に `accessToken` / `access_token` の識別子が現れない（`grep -n "console\.\(log\|warn\|error\)" supabase/functions/crawl-spot-sources/index.ts | grep -c "accessToken\|access_token"` が 0）。判断 6 が固定メッセージとして要求する `META_ACCESS_TOKEN invalid or expired` は静的リテラルでトークン値を含まないため許容する（I-18 がこのログ行の存在を要求しており、当初の grep パターンとは両立しないことが実装時に判明。2026-08-03 修正）
- [ ] AC-A8: `index.ts` が Instagram 巡回対象を `.eq('source_type', 'sns_link')` と `.ilike('url', '%instagram.com%')` の組み合わせで取得している
- [ ] AC-A9: `index.ts` に既存 web パスの `.neq('source_type', 'sns_link')` が**残っている**
- [ ] AC-A10: `index.ts` が `mode` を読み取り、`'web'` / `'instagram'` / `'all'` の 3 文字列リテラルをすべて含む
- [ ] AC-A11: `index.ts` に `INSTAGRAM_SYSTEM_PROMPT` が定義され、その文字列に `推測`・`創作`・`post_index`・`【投稿日】` の 4 語がすべて含まれる
- [ ] AC-A12: `index.ts` の既存 `SYSTEM_PROMPT` 定数が **1 文字も変更されていない**（`git diff develop -- supabase/functions/crawl-spot-sources/index.ts | grep '^-' | grep -cE "あなたは寺社の公式サイトから|お守り・お札・破魔矢|通年・月替わり・季節替わり"` が **0**）
- [ ] AC-A13: `index.ts` の `RunSummary` に `instagram` フィールドがあり、その型に `processed` / `changed` / `extracted` / `unchanged` / `failed` / `skipped_invalid_url` / `skipped_not_business` / `skipped_no_credentials` / `rate_limited` / `token_invalid` / `deadline_reached` の 11 キーがすべて定義されている
- [ ] AC-A14: `supabase/migrations/` 配下が **1 ファイルも追加・変更されていない**（`git diff --name-only develop -- supabase/migrations/` が空）
- [ ] AC-A15: `supabase/seeds/` 配下と `supabase/seed_*.sql` が **1 ファイルも追加・変更されていない**（`git diff --name-only develop -- supabase/seeds/ supabase/seed_*.sql` が空）
- [ ] AC-A16: `supabase/cron/schedule_crawl_spot_sources.sql` に `'crawl-spot-sources-instagram'` と `'30 17 * * 1,4'` と `'mode', 'instagram'` が含まれ、既存 job の body に `'mode', 'web'` が含まれる
- [ ] AC-A17: 同ファイルに実キー・実トークンが含まれない（`grep -cE "eyJ[A-Za-z0-9_-]{20,}|sb_secret_[A-Za-z0-9]{10,}|EAA[A-Za-z0-9]{20,}" supabase/cron/schedule_crawl_spot_sources.sql` が **0**）かつ `2026-10-02` と `secrets set META_ACCESS_TOKEN` の 2 語を含む（トークン更新手順の記録）
- [ ] AC-A18: `src/types/supabase.ts` の `LimitedGoshuinItem` に `source_key?: string | null` がある
- [ ] AC-A19: `git diff develop -- supabase/functions/_shared/crawl_test.ts | grep -c "^-[^-]"` が **0**（既存 42 個の `Deno.test` を 1 行も変更・削除していない）
- [ ] AC-A20: `git diff develop -- src/components/spot-detail/__tests__/LimitedGoshuinSection.test.tsx | grep -c "^-[^-]"` が **0**（既存 30 テストを 1 行も変更・削除していない）
- [ ] AC-A21: `supabase/functions/crawl-spot-sources/deno.json` が変更されていない（`git diff --name-only develop -- supabase/functions/crawl-spot-sources/deno.json` が空）

### D. アプリ側の表示（`src/components/spot-detail/__tests__/LimitedGoshuinSection.test.tsx`・`npm test`）

システム時刻は既存テストと同じ `2026-08-02T12:00:00Z` に固定して検証する。

- [ ] AC-D1: `sourceLinkLabel('https://www.instagram.com/p/DL1234abcd/')` が `'Instagramの投稿を見る'` を返す
- [ ] AC-D2: `sourceLinkLabel('https://instagram.com/p/DL1234abcd/')` が `'Instagramの投稿を見る'` を返す（`www.` なし）
- [ ] AC-D3: `sourceLinkLabel('https://example.jp/goshuin')` が `'公式サイトで確認'` を返す
- [ ] AC-D4: `sourceLinkLabel('not-a-url')` が `'公式サイトで確認'` を返す（パース不能でも例外を投げない）
- [ ] AC-D5: `sourceLinkLabel('https://instagram.com.evil.jp/p/x/')` が `'公式サイトで確認'` を返す（ホストの部分一致で誤判定しない）
- [ ] AC-D6: `variant="full"` で items 1 件・`source_url: 'https://www.instagram.com/p/DL1234abcd/'` のとき、`limited-goshuin-source-0` のテキストが `Instagramの投稿を見る` である
- [ ] AC-D7: AC-D6 の状態で `limited-goshuin-source-0` を押すと `Linking.openURL` が `'https://www.instagram.com/p/DL1234abcd/'` で 1 回呼ばれる
- [ ] AC-D8: `getByText('Instagramの投稿を見る')` のスタイルが `typography.caption`（fontSize 12）かつ色 `colors.primary[500]`（`#f27f0d`）である（`toHaveStyle` で検証）
- [ ] AC-D9: items 2 件（index 0 = Instagram permalink / index 1 = `https://example.jp/goshuin`）のとき、`limited-goshuin-source-0` が `Instagramの投稿を見る`、`limited-goshuin-source-1` が `公式サイトで確認` を表示する
- [ ] AC-D10: `source_key: 'instagram:kandamyoujin'` を持つ item を渡しても、画面上に文字列 `instagram:kandamyoujin` が表示されない（内部キーを露出しない）
- [ ] AC-D11: 既存 30 テストが**アサーション無変更で**通る

### H. manual-ops: Deno ユニットテスト（外部通信なし・Jest では検証不能）

`deno` は未インストール。実行前に `brew install deno`（または `curl -fsSL https://deno.land/install.sh | sh`）。
実行コマンド: **`deno test supabase/functions/_shared/`**（リポジトリルートで実行。初回は jsr からの依存取得のためネットワークが必要）。

**共通**

- [ ] H-1 (manual-ops): 上記コマンドが exit code 0 で終了し、`0 failed` が出る。**`crawl_test.ts` の既存 42 テストがすべて通る**（`normalizeItems` のリファクタが外部挙動を変えていないことの担保）

**`parseInstagramUsername`**

- [ ] H-2 (manual-ops): `https://www.instagram.com/kandamyoujin/` と `https://www.instagram.com/fushimiinaritaisha_official`（末尾スラッシュなし）がそれぞれ `'kandamyoujin'` / `'fushimiinaritaisha_official'` を返すテストが存在し通る
- [ ] H-3 (manual-ops): `https://www.instagram.com/takekoma.inari/`（ピリオド含む）が `'takekoma.inari'` を返すテストが存在し通る
- [ ] H-4 (manual-ops): `https://www.instagram.com/KandaMyoujin/` が `'kandamyoujin'`（小文字化）、`https://www.instagram.com/@kandamyoujin/` が `'kandamyoujin'`（`@` 除去）を返すテストが存在し通る
- [ ] H-5 (manual-ops): `https://www.instagram.com/kandamyoujin/?hl=ja` と `https://www.instagram.com/kandamyoujin/#top` がいずれも `'kandamyoujin'` を返すテストが存在し通る
- [ ] H-6 (manual-ops): `https://instagram.com/kandamyoujin` と `https://m.instagram.com/kandamyoujin/` がいずれも `'kandamyoujin'` を返すテストが存在し通る
- [ ] H-7 (manual-ops): `https://www.instagram.com/p/DL1234abcd/`（投稿 URL）・`https://www.instagram.com/explore/`（予約語）・`https://www.instagram.com/`（セグメント 0）がいずれも `null` を返すテストが存在し通る
- [ ] H-8 (manual-ops): `https://x.com/kanda_myoujin`・`https://instagram.com.evil.jp/kandamyoujin`・`http://www.instagram.com/kandamyoujin/`（http）・`not-a-url` がいずれも `null` を返すテストが存在し通る

**`buildBusinessDiscoveryUrl`**

- [ ] H-9 (manual-ops): 戻り値が `https://graph.facebook.com/v26.0/17841439672371375?` で始まり、`decodeURIComponent` した結果に `business_discovery.username(kandamyoujin)` と `media.limit(25)` と `caption` と `permalink` と `timestamp` がすべて含まれるテストが存在し通る
- [ ] H-10 (manual-ops): 戻り値に文字列 `access_token` が**含まれない**テストが存在し通る（トークン漏洩の構造的防止）

**`classifyGraphApiError`**

- [ ] H-11 (manual-ops): `(400, { error: { code: 110 } })` が `'not_business'` を返すテストが存在し通る
- [ ] H-12 (manual-ops): `(400, { error: { code: 190 } })` と `(400, { error: { code: 102 } })` がいずれも `'token_invalid'` を返すテストが存在し通る
- [ ] H-13 (manual-ops): `(400, { error: { code: 4 } })` / `(400, { error: { code: 17 } })` / `(400, { error: { code: 32 } })` / `(400, { error: { code: 613 } })` / `(429, {})` がいずれも `'rate_limited'` を返すテストが存在し通る
- [ ] H-14 (manual-ops): `(500, {})` / `(400, { error: { code: 100 } })` / `(400, null)` がいずれも `'other'` を返すテストが存在し通る

**`parseBusinessDiscoveryPosts`**

- [ ] H-15 (manual-ops): `{ business_discovery: { media: { data: [3件] } } }` から 3 件を **API のレスポンス順どおり**に返すテストが存在し通る
- [ ] H-16 (manual-ops): `permalink` が instagram.com 以外 / `permalink` が非文字列 / `timestamp` 欠落 / `timestamp` がパース不能、の各要素を破棄するテストが存在し通る
- [ ] H-17 (manual-ops): `caption` 欠落の要素が `caption: ''` で残るテストが存在し通る
- [ ] H-18 (manual-ops): `business_discovery` 欠落 / `media.data` が非配列 / `null` 入力のとき `[]` を返すテストが存在し通る

**`filterRecentPosts` / `toJstDate`**

- [ ] H-19 (manual-ops): `nowMs = Date.parse('2026-08-03T00:00:00Z')` / `lookbackDays = 60` のとき、`2026-07-07T09:00:00+0000` の投稿を残し `2026-05-01T09:00:00+0000` の投稿を除外するテストが存在し通る
- [ ] H-20 (manual-ops): `filterRecentPosts` が入力配列を破壊せず、残った投稿の順序が入力順のままであるテストが存在し通る
- [ ] H-21 (manual-ops): `toJstDate('2026-07-07T15:30:00+0000')` が `'2026-07-08'`、`toJstDate('2026-07-07T09:00:00+0000')` が `'2026-07-07'`、`toJstDate('bad')` が `''` を返すテストが存在し通る

**`buildInstagramContentKey`**

- [ ] H-22 (manual-ops): 同じ投稿集合を**順序違い**で渡すと同一の文字列を返すテストが存在し通る
- [ ] H-23 (manual-ops): `caption` だけが 1 文字違う集合に対して異なる文字列を返し、空配列に対して `''` を返すテストが存在し通る

**`buildInstagramUserMessage`**

- [ ] H-24 (manual-ops): 戻り値に `【今日の日付】2026-08-03` / `【アカウント】@kandamyoujin` / `【投稿数】2` / `--- 投稿 0 ---` / `--- 投稿 1 ---` がすべて含まれるテストが存在し通る
- [ ] H-25 (manual-ops): `caption` が空文字の投稿について本文が `（本文なし）` になるテストが存在し通る
- [ ] H-26 (manual-ops): `maxCaptionChars = 5` のとき、6 文字以上の caption が 5 文字に切り詰められるテストが存在し通る
- [ ] H-27 (manual-ops): `maxTotalChars` を小さくしたとき、**末尾の投稿から落ち、先頭の `--- 投稿 0 ---` は残る**テストが存在し通る（`post_index` のずれ防止）

**`normalizeInstagramItems`**

- [ ] H-28 (manual-ops): `post_index: 0` の正常な item に対して、`source_url` が `posts[0].permalink`、`fetched_at` が引数の値、`source_key` が引数の値になるテストが存在し通る
- [ ] H-29 (manual-ops): Claude が `source_url: 'https://evil.example/fake'` と `source_key: 'instagram:evil'` を返しても、いずれも引数由来の値で**上書き**されるテストが存在し通る
- [ ] H-30 (manual-ops): `post_index` が (a) 範囲外（`posts.length` 以上 / 負） (b) 文字列 `'0'` (c) 非整数 `1.5` (d) 欠落 のいずれの場合も item が**破棄**されるテストが存在し通る
- [ ] H-31 (manual-ops): `isLikelyGoshuin` ガードが効き、`{ post_index: 0, name: '七夕守', description: '8月7日まで授与' }`（授与品）が破棄されるテストが存在し通る
- [ ] H-32 (manual-ops): `maxItems` で件数が切られるテストが存在し通る

**`normalizeGoshuinItem` / `mergeItemsBySourceKey`（`crawl_test.ts` への追加分）**

- [ ] H-33 (manual-ops): `normalizeGoshuinItem` が name 欠落 / `isLikelyGoshuin` false のとき `null` を返し、正常時は `source_key` を**含まない**オブジェクトを返すテストが存在し通る
- [ ] H-34 (manual-ops): `mergeItemsBySourceKey` が同一 `source_key` の既存要素だけを置き換え、**`source_key` を持たない要素（web 由来）と別 `source_key` の要素を保持**するテストが存在し通る
- [ ] H-35 (manual-ops): `mergeItemsBySourceKey` が入力配列を破壊せず、`incoming` が空のとき該当 `source_key` の要素だけが消えるテストが存在し通る

### I. manual-ops: 実 API / デプロイ / 実クロール（ユーザー作業）

Supabase CLI は未インストール。すべて `npx supabase@latest` で実行する。
service*role キー（`sb_secret*...`）: `npx supabase@latest projects api-keys --project-ref tvnozkpxncmnehyomoff --reveal`以下`<KEY>` は上記で取得した secret キー、`<TOKEN>`は`META_ACCESS_TOKEN` の値。

**実 API の疎通（デプロイ前）**

- [ ] I-1 (manual-ops): `npx supabase@latest secrets list --project-ref tvnozkpxncmnehyomoff` の出力に `META_ACCESS_TOKEN` と `META_IG_USER_ID` の両方が現れる
- [ ] I-2 (manual-ops): 次の curl が HTTP 200 を返し、`business_discovery.media.data[0]` に `caption` / `permalink` / `timestamp` の 3 キーが揃っている:
      `curl -s "https://graph.facebook.com/v26.0/17841439672371375?fields=business_discovery.username(kandamyoujin)%7Busername%2Cmedia.limit(3)%7Bcaption%2Cpermalink%2Ctimestamp%7D%7D&access_token=<TOKEN>" | jq .`
- [ ] I-3 (manual-ops): 上記の `kandamyoujin` を存在しない username（例 `goshuin_nonexistent_zzz999`）に替えた curl が `"code": 110` を含む JSON を返す（`classifyGraphApiError` の `not_business` 分岐の実挙動確認）

**デプロイ**

- [ ] I-4 (manual-ops): `npx supabase@latest functions deploy crawl-spot-sources --project-ref tvnozkpxncmnehyomoff --use-api --no-verify-jwt` が成功する

**dry_run（Claude を呼ばない疎通確認）**

- [ ] I-5 (manual-ops): 次のリクエストが 200 とサマリ JSON を返し、`instagram.processed` が 1 以上、`instagram.skipped_no_credentials` が `false` である:
      `curl -X POST -H "Authorization: Bearer <KEY>" -H "Content-Type: application/json" -d '{"mode":"instagram","dry_run":true,"limit":25}' https://tvnozkpxncmnehyomoff.supabase.co/functions/v1/crawl-spot-sources`
- [ ] I-6 (manual-ops): I-5 の直後に `select count(*) from spot_aggregated_info where info_type='limited_goshuin' and info_data::text like '%instagram.com/p/%';` が **0** を返す（dry_run で書き込みが起きていない）
- [ ] I-7 (manual-ops): I-5 の直後に `select count(*) from spot_info_sources where source_type='sns_link' and url ilike '%instagram.com%' and content_hash is not null;` が **0** を返す（dry_run で `content_hash` を更新していない）かつ `last_crawled_at is not null` の行が 1 件以上ある

**本実行**

- [ ] I-8 (manual-ops): `-d '{"mode":"instagram","limit":25}'` で叩くと 200 が返り、`instagram.extracted` が 1 以上になる
- [ ] I-9 (manual-ops): **同じリクエストをもう一度**叩くと `instagram.unchanged` が `instagram.processed` と等しく、`instagram.extracted` が 0 になる（差分検知が効いており Claude を呼んでいない）
- [ ] I-10 (manual-ops): `select info_data from spot_aggregated_info where info_type='limited_goshuin';` を確認し、Instagram 由来のアイテムの `source_url` が **`https://www.instagram.com/p/` または `https://www.instagram.com/reel/` で始まる投稿 permalink** であり、`source_key` が `instagram:<username>` の形式である
- [ ] I-11 (manual-ops): I-10 の各 permalink をブラウザで開くと、その御朱印について書かれた**実在の投稿**が表示される（出典の捏造がない）
- [ ] I-12 (manual-ops): 神田明神（`kandamyoujin`）の items に **「七夕守」などのお守り・授与品が 1 件も含まれない**（`isLikelyGoshuin` ガードの回帰）
- [ ] I-13 (manual-ops): 八坂神社（`kyotogionyasaka`）の items に御朱印以外の授与品が含まれない
- [ ] I-14 (manual-ops): 榴岡天満宮（`tsutsujigaoka_tenmangu`）の `spot_aggregated_info` に `source_key = 'instagram:tsutsujigaoka_tenmangu'` のアイテムが 1 件以上入る（公式サイト更新停止スポットのカバー = 本 Issue の主目的）
- [ ] I-15 (manual-ops): 宮城縣護國神社（`gokokumiyagi`）について、通年切り絵の告知投稿が直近 60 日以内にあれば items に含まれ、無ければ含まれない（判断 3 の窓の挙動確認。どちらでも合格だが**どちらだったかを記録する**）
- [ ] I-16 (manual-ops): 各 items の `period_end` に、本文に書かれていない日付（投稿日など）が入っていない

**エラー系**

- [ ] I-17 (manual-ops): anon キーで同じリクエストを叩くと **401** が返る（コスト保護。P2-01 から継承）
- [ ] I-18 (manual-ops): `npx supabase@latest secrets set META_ACCESS_TOKEN=invalid_token_for_test --project-ref tvnozkpxncmnehyomoff` した後に `-d '{"mode":"instagram","limit":1}'` を叩くと、レスポンスの `instagram.token_invalid` が `true` になり、`npx supabase@latest functions logs crawl-spot-sources` に `META_ACCESS_TOKEN invalid or expired` の行が出る。**確認後、正しいトークンに必ず戻す**
- [ ] I-19 (manual-ops): 関数ログのどの行にも `META_ACCESS_TOKEN` の実値が現れない（トークン漏洩なし）
- [ ] I-20 (manual-ops): Business/Creator でないアカウントが seed 内に存在する場合、`instagram.skipped_not_business` に計上され、**その他のアカウントの処理が継続している**（`instagram.processed` が 1 に止まっていない）

**web パスの回帰**

- [ ] I-21 (manual-ops): `-d '{"mode":"web","limit":20}'` を叩くと、レスポンスのトップレベル `processed` / `changed` / `unchanged` が P2-01 と同じ意味で埋まり、`instagram.processed` が 0 である
- [ ] I-22 (manual-ops): I-21 の後、既存の web ソース由来アイテム（`source_key` を持たないアイテム）が `spot_aggregated_info` から消えていない。かつ I-8 で入った Instagram 由来アイテムも消えていない（双方向のマージ共存の確認）

**cron**

- [ ] I-23 (manual-ops): `supabase/cron/schedule_crawl_spot_sources.sql` の手順どおり既存 job を `cron.unschedule` して 2 つの job を登録し直すと、`select jobname, schedule from cron.job;` に `crawl-spot-sources-biweekly` / `0 17 * * 1,4` と `crawl-spot-sources-instagram` / `30 17 * * 1,4` の 2 行が現れる
- [ ] I-24 (manual-ops): 一時ジョブ（`select cron.schedule('tmp-ig','* * * * *', ...)`）で 1 分後に `select * from cron.job_run_details order by start_time desc limit 5;` に `succeeded` が出る。確認後 `select cron.unschedule('tmp-ig');` で片付ける

### N. native-only 基準（Expo Web ではボトムシートに到達できない）

実機 iPhone + EAS Development Build（`/dev`）での目視確認。Maestro フローは追加しない（外部アプリ遷移を跨ぐため）。

- [ ] N-1 (native-only): I-14 まで完了した榴岡天満宮のピンを地図でタップ → ボトムシートを上にドラッグして展開すると、`限定御朱印` の見出しと項目が表示される
- [ ] N-2 (native-only): その項目の出典リンクが **`Instagramの投稿を見る`** と表示される（`公式サイトで確認` ではない）
- [ ] N-3 (native-only): `Instagramの投稿を見る` をタップすると、**該当の Instagram 投稿**（一覧やプロフィールではなく個別投稿）が Instagram アプリまたは Safari で開く
- [ ] N-4 (native-only): 公式サイト由来のアイテムと Instagram 由来のアイテムが同じスポットに並ぶ場合、それぞれの出典リンクの文言が `公式サイトで確認` と `Instagramの投稿を見る` に**個別に切り替わる**
- [ ] N-5 (native-only): 同じスポットの `公式SNS` セクションに、従来どおり Instagram / X のプロフィールリンク（ホスト名表記）が表示される（**SNS リンク表示の回帰なし**）
- [ ] N-6 (native-only): 折りたたみボトムシートのチップ `限定御朱印 N件` が従来どおり 1 行で表示される（レイアウト崩れなし）

### Q. 品質基準

- [ ] Q-1: 全テストが通る（`npm test`）
- [ ] Q-2: Lint エラーがない（`npm run lint`）
- [ ] Q-3: 型エラーがない（`npm run typecheck`）
- [ ] Q-4: 本 Issue で追加・変更した `StyleSheet.create()` のスタイル値に 16 進カラーの直値がない（本 Issue では `LimitedGoshuinSection` のスタイル自体を変更しないため、`git diff develop -- src/components/spot-detail/LimitedGoshuinSection.tsx` の変更行に `StyleSheet` の中身が含まれないことでも可）
- [ ] Q-5: `src/services/spotInfo.ts`・`src/hooks/useSpotInfo.ts`・`src/components/spot-detail/SpotDetailContent.tsx`・`SpotCompactCard.tsx`・`SpotInfoSection.tsx`・`SpotBottomSheet.tsx` とそれぞれのテストが **1 行も変更されていない**（`git diff --stat develop -- <各パス>` が空）
- [ ] Q-6: `src/` 配下の新規・変更ファイルに Deno / Edge Function 由来の import（`https://esm.sh/...` や `Deno.` の参照）が無い
- [ ] Q-7: `supabase/functions/` 配下に React Native / `@theme` の import が無い
- [ ] Q-8: `supabase/functions/_shared/instagram.ts` に `Deno.env` / `fetch(` / `createClient` の呼び出しが無い（純粋関数のみで構成され、I/O は `index.ts` にある）

## スコープ外（やらないこと）

契約書に無いことは実装しない。

- **第 2 柱の記事単位クロール**（公式サイトの記事 URL 単位での出典付け）。別 Issue
- **X（旧 Twitter）対応**（API 有料のため収益化後に判断）。X の `sns_link` は従来どおりリンク表示のみ
- **トークンの自動更新機構**（長期トークンのリフレッシュ、システムユーザートークンへの移行、失効時の Slack / メール通知）。検知とログ・summary フラグまでが本 Issue
- **`source_type` への値追加 migration**（判断 1）。`spot_info_sources` のスキーマは一切変更しない
- **Instagram 巡回キュー用の部分インデックス追加**（判断 1）
- **投稿画像の取得・保存・表示**（`media_url` / `thumbnail_url` は取得しない）
- **`media` のページング**（`after` カーソルの追跡）。1 アカウントにつき最新 `INSTAGRAM_MEDIA_LIMIT` 件のみ
- **Instagram のストーリーズ / リールのインサイト取得**（`instagram_manage_insights` は権限として付与済みだが本 Issue では使わない）
- **Business Discovery 不可アカウントの検出結果の永続化**（`spot_info_sources` に失敗フラグ列を足す・自動 `enabled=false` 化）
- **失敗ソースのリトライ / バックオフ**（週 2 回の巡回で次回に回収する）
- **巡回結果の履歴テーブル**（`crawl_logs` 等）。観測は `cron.job_run_details` / `net._http_response` / Edge Function ログで行う
- **`extract-spot-info` の変更**
- **web パスのロジック変更**（プロンプト・`htmlToText`・SSRF ガード・マージキー・`RunSummary` の既存フィールド）
- **`spot_aggregated_info` のスキーマ変更**
- **seed への新規 Instagram アカウント追加**（既存 23 件をそのまま使う）
- **アプリ内での出典の種類別グルーピング / フィルタ UI**（Instagram 由来だけを表示する等）
- **プッシュ通知・課金 / サブスク**（P2-01 から継続してスコープ外）
- **`docs/product/direction.md` / `docs/technical/tech-design.md` / `docs/design/ui-design.md` / `supabase/seeds/README.md` の更新**（feature-list の進捗記録はハーネス側の責務）
- **多言語対応**（表示文言はすべて日本語固定）

## 注意事項

- **Deno テストの命名**: `instagram_test.ts`（アンダースコア）。`instagram.test.ts` にすると `jest.config.js` の `testMatch` に拾われ `npm test` が Deno 構文で落ちる（AC-A2 で検出する）
- **マージキーの取り違えが最大の地雷**: Instagram パスで `mergeLimitedGoshuinItems`（`source_url` キー）を呼ぶと、permalink がプロフィール URL と一致しないため**過去のアイテムが 1 件も消えず無限に増える**。必ず `mergeItemsBySourceKey`（`source_key` キー）を使う（H-34 / I-9 で検出する）
- **web パスのマージキーを変えない**: 本番の既存アイテムは `source_key` を持たない。web パスを `mergeItemsBySourceKey` に移行すると既存アイテムが除去されず**重複する**（調査結果 4。I-22 で検出する）
- **`source_key` はプロフィール URL ではなく `instagram:<username>`**: URL の末尾スラッシュ有無が seed に混在しており、URL をキーにすると表記揺れで孤児アイテムが発生する（調査結果 1）
- **`source_url` / `fetched_at` / `source_key` を Claude に生成させない**: `post_index` の整数だけを返させ、URL はコード側が `posts[idx].permalink` から代入する。ここを守らないと「出典 URL が実在しない」誤情報になる（H-29 / I-11 で検出する）
- **`post_index` の値域チェックを省かない**: 範囲外・非整数の index を無視して `posts[idx]` にアクセスすると `undefined.permalink` で例外になる。範囲外は item ごと破棄する（H-30 で検出する）
- **プロンプトの投稿順と `posts` 配列の順序を一致させる**: `buildInstagramContentKey` はハッシュ用に**コピーをソート**する。プロンプトに渡す配列（= `post_index` の基準）は API のレスポンス順（新しい順）のまま保つこと。ここがずれると出典が別の投稿に紐づく
- **`maxTotalChars` の切り詰めは末尾から**: 先頭の投稿を落とすと `post_index` がずれる（H-27 で検出する）
- **トークンをログに出さない**: `buildBusinessDiscoveryUrl` は access_token を含まない URL を返す設計にし、token は fetch 直前に付ける。エラーログにはリクエスト URL ではなく username と status / code のみを出す（AC-A7 / I-19 で検出する）
- **`content_hash` を更新するタイミング**: Claude 呼び出しが失敗したときは更新しない（更新すると「変化なし」と判定されて次回以降も抽出されない）。P2-01 と同じ原則
- **`code 110` で実行全体を止めない**: 個人アカウントは十分ありうる。その source だけスキップして次へ進む。逆に `code 190` / `429` は続けても全滅するので**パス全体を即中断**する（判断 6）
- **secrets が無くても web パスを壊さない**: `META_ACCESS_TOKEN` / `META_IG_USER_ID` 未設定時は Instagram パスをスキップするだけ。関数全体を 500 にしない
- **`mode: 'all'` では Instagram を先に走らせる**: web パスを先にすると `RUN_BUDGET_MS` を使い切って Instagram が恒久的に飢える
- **cron の再登録を忘れない**: 既存 job は body に `mode` を持たない状態で登録済み。`cron.unschedule` → 再 `cron.schedule` しないと SQL ファイルの変更が本番に反映されない（I-23 で検出する）
- **cron 式は UTC**: `'30 17 * * 1,4'` = 月・木 17:30 UTC = 火・金 02:30 JST
- **トークン期限 2026-10-02**: 失効すると Instagram パスが全滅する。10 月初旬に[アクセストークンデバッガー](https://developers.facebook.com/tools/debug/accesstoken/)の GUI 手順で延長し `npx supabase@latest secrets set META_ACCESS_TOKEN=...` で更新する
- **強制再抽出**: `spot_info_sources.content_hash` を null に PATCH してから `{"mode":"instagram","spot_id":"..."}` で叩く（hash 一致だと Claude を呼ばずスキップされる）
- **60 日の窓は意図的に「消える」設計**: 窓から外れた投稿由来のアイテムは次回巡回で DB から消える。バグ報告として扱わない（判断 3）
- **文言は AC と一字一句合わせる**: `Instagramの投稿を見る` / `公式サイトで確認` / `【今日の日付】` / `【アカウント】` / `【投稿数】` / `【投稿日】` / `【本文】` / `（本文なし）` / `--- 投稿 {index} ---` はテキスト一致で判定する。実装で言い回しを変えたい場合は本ファイルを先に更新する
- 実装が契約と食い違う事実を発見した場合は、契約書を黙って逸脱せず本ファイルを更新してから実装する
