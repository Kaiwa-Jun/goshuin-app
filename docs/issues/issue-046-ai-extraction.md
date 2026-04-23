# Issue #46: AIによるコメント情報抽出と構造化データ表示

## 概要

ユーザーが御朱印記録時に投稿したコメント（memo）をClaude APIで解析し、駐車場情報・兼務社情報・受付時間・アクセス情報を自動抽出。スポット詳細ボトムシートに構造化情報として表示する。

## 関連ドキュメント

- [要件定義](../product/requirements.md)
- [技術設計](../technical/tech-design.md)
- [UI設計](../design/ui-design.md)
- 前提Issue: #45（御朱印記録の公開機能）

## システムアーキテクチャ

### 全体フロー

```
[ユーザー投稿]
    |
    v
useRecordForm.submit()
    ├── uploadStampImage()
    ├── createStamp()  → stamps テーブル INSERT（従来通り）
    └── triggerExtraction(stampId)  → fire-and-forget（新規）
            |
            v
      supabase.functions.invoke('extract-spot-info')
            |
            v
    [Supabase Edge Function]
        ├── stamps テーブルから memo 取得
        ├── Claude API (claude-haiku-4-5) 呼び出し
        ├── stamps.extracted_info (JSONB) 更新
        └── spot_aggregated_info UPSERT（集約ロジック）
            |
            v
[スポット詳細ボトムシート]
    useSpotInfo → spot_aggregated_info 取得
    SpotDetailContent に構造化情報セクション表示
```

### 設計判断

| 判断ポイント       | 選択                                      | 理由                                       |
| ------------------ | ----------------------------------------- | ------------------------------------------ |
| AI API呼び出し場所 | Supabase Edge Functions                   | APIキー秘匿、サーバーサイド処理            |
| AI モデル          | claude-haiku-4-5                          | コスト効率（~$0.0005/投稿）、日本語性能    |
| 投稿UXへの影響     | fire-and-forget                           | 抽出失敗しても投稿は成功する               |
| DB設計             | stamps + spot_aggregated_info の2テーブル | トレーサビリティと表示パフォーマンスの両立 |

## 詳細設計

### データベース

#### stamps テーブル変更

```sql
-- stamps に抽出結果カラム追加
ALTER TABLE public.stamps ADD COLUMN extracted_info JSONB;

CREATE INDEX idx_stamps_extracted_info ON public.stamps
  USING GIN (extracted_info) WHERE extracted_info IS NOT NULL;
```

`extracted_info` の JSON 構造:

```json
{
  "parking": { "available": true, "capacity": 10, "location": "境内南側" },
  "affiliated_shrines": [{ "name": "稲荷社", "details": "本殿右手奥" }],
  "reception_hours": { "open": "09:00", "close": "16:00", "notes": "書き置きのみ" },
  "access_notes": "最寄り駅から徒歩15分、坂道あり"
}
```

#### spot_aggregated_info テーブル新規作成

```sql
CREATE TABLE public.spot_aggregated_info (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  spot_id UUID NOT NULL REFERENCES public.spots(id) ON DELETE CASCADE,
  info_type TEXT NOT NULL,  -- 'parking' | 'affiliated_shrines' | 'reception_hours' | 'access_notes'
  info_data JSONB NOT NULL,
  source_stamp_ids UUID[] NOT NULL DEFAULT '{}',
  confidence_score REAL NOT NULL DEFAULT 0,  -- 0.0 ~ 1.0
  last_reported_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_spot_aggregated_info_spot_type
  ON public.spot_aggregated_info (spot_id, info_type);

-- RLS: 全ユーザー閲覧可能
ALTER TABLE public.spot_aggregated_info ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view spot aggregated info"
  ON public.spot_aggregated_info FOR SELECT USING (true);

CREATE POLICY "Service role can manage spot aggregated info"
  ON public.spot_aggregated_info FOR ALL USING (auth.role() = 'service_role');
```

#### confidence_score 計算ロジック

- 基本スコア: 情報源 1件=0.3, 2件=0.6, 3件以上=0.8
- 新しさボーナス: 最新情報源が30日以内なら +0.2
- 最大 1.0

### Edge Function

#### ファイル: `supabase/functions/extract-spot-info/index.ts`

**処理フロー:**

1. stamp_id から stamps レコード取得（memo, spot_id）
2. memo が空なら早期リターン
3. Claude API に memo を送り構造化情報を抽出
4. stamps.extracted_info を UPDATE
5. 同一 spot_id の全 stamps.extracted_info を集約
6. spot_aggregated_info を UPSERT

**AI プロンプト:**

```
System:
あなたは御朱印・神社仏閣の口コミから構造化情報を抽出するアシスタントです。
ユーザーの投稿コメントから以下の情報を抽出してJSON形式で返してください。
該当する情報がない場合は、そのフィールドを省略してください。
推測や創作は行わず、コメントに明示的に書かれている情報のみ抽出してください。

抽出対象:
1. parking: 駐車場情報 (available: boolean, capacity?: number, location?: string)
2. affiliated_shrines: 兼務社情報 (name: string, details?: string)[]
3. reception_hours: 受付時間 (open?: string HH:MM, close?: string HH:MM, notes?: string)
4. access_notes: アクセス補足情報 (string)

User:
{memo の内容}
```

**集約ルール:**

- parking.available: 直近3件の多数派
- reception_hours: 最新の投稿を優先
- affiliated_shrines: 全投稿からユニオン（社名で重複排除）
- access_notes: 最新の投稿を優先

**環境変数:**

- `ANTHROPIC_API_KEY`: `supabase secrets set` で設定

### 型定義 (`src/types/supabase.ts`)

```typescript
export interface ExtractedInfo {
  parking?: { available: boolean; capacity?: number; location?: string };
  affiliated_shrines?: { name: string; details?: string }[];
  reception_hours?: { open?: string; close?: string; notes?: string };
  access_notes?: string;
}

export interface SpotAggregatedInfo {
  id: string;
  spot_id: string;
  info_type: 'parking' | 'affiliated_shrines' | 'reception_hours' | 'access_notes';
  info_data: Record<string, unknown>;
  source_stamp_ids: string[];
  confidence_score: number;
  last_reported_at: string;
  created_at: string;
  updated_at: string;
}

// Stamp に追加
// extracted_info: ExtractedInfo | null;
```

### サービス層

#### 新規: `src/services/spotInfo.ts`

```typescript
fetchSpotAggregatedInfo(spotId: string): Promise<SpotAggregatedInfo[]>
// spot_aggregated_info テーブルから取得

triggerExtraction(stampId: string): Promise<void>
// supabase.functions.invoke('extract-spot-info', { body: { stamp_id: stampId } })
// fire-and-forget: エラーは console.warn のみ
```

#### 変更: `src/hooks/useRecordForm.ts`

submit() 内、createStamp 成功後に追加（**await しない**ので投稿速度に影響なし）:

```typescript
// fire-and-forget: ユーザーの投稿体験は現在と全く同じ速度
triggerExtraction(stamp.id).catch(() => {});
return { success: true, stamp };
```

#### 変更: `src/screens/RecordScreen.tsx`

メモ入力欄の下にガイドテキストを追加（投稿促進）:

```
💡 駐車場の有無、受付時間、アクセス情報などを書くと、
スポット情報として自動的に反映されます
```

- メモを書くタイミングが、何を書けば役に立つか伝える最適なタイミング
- ツールチップ不要。常に見える薄いガイドテキストでシンプルに実装

### フック層

#### 新規: `src/hooks/useSpotInfo.ts`

```typescript
interface ParsedSpotInfo {
  parking?: { available: boolean; capacity?: number; location?: string };
  affiliatedShrines?: { name: string; details?: string }[];
  receptionHours?: { open?: string; close?: string; notes?: string };
  accessNotes?: string;
}

useSpotInfo(spotId: string): { spotInfo: ParsedSpotInfo | null; isLoading: boolean }
```

### UI

#### 新規: `src/components/spot-detail/SpotInfoSection.tsx`

構造化情報をアイコン＋テキストで表示:

- 🅿️ 駐車場: あり（10台・境内南側）/ なし
- 🕐 受付: 9:00〜16:00 + 補足
- ⛩️ 兼務: 社名リスト
- 📍 アクセス: テキスト

配置場所: SpotDetailContent の訪問カードと「ここで記録する」ボタンの間。
**情報がない場合はセクション自体を非表示**（「-」等のプレースホルダーは表示しない。ボトムシートは情報閲覧の場であり、ノイズを減らしてスッキリしたUIを維持する）。

#### 変更: `src/components/spot-detail/SpotDetailContent.tsx`

- props に `spotInfo?: ParsedSpotInfo` 追加
- `<Card>` と `<Button>` の間に `{spotInfo && <SpotInfoSection spotInfo={spotInfo} />}` 挿入

#### 変更: `src/components/spot-detail/SpotBottomSheet.tsx`

- `useSpotInfo(spotId)` フック呼び出し追加
- `SpotDetailContent` に `spotInfo` を渡す

## 対象ファイル

### 新規作成

| ファイル                                                             | 内容                             |
| -------------------------------------------------------------------- | -------------------------------- |
| `supabase/migrations/20260402000000_add_extracted_info.sql`          | stamps.extracted_info カラム追加 |
| `supabase/migrations/20260402000001_create_spot_aggregated_info.sql` | 集約テーブル作成                 |
| `supabase/functions/extract-spot-info/index.ts`                      | Edge Function                    |
| `src/services/spotInfo.ts`                                           | 構造化情報のサービス層           |
| `src/hooks/useSpotInfo.ts`                                           | 構造化情報取得フック             |
| `src/components/spot-detail/SpotInfoSection.tsx`                     | 構造化情報表示コンポーネント     |
| 対応テストファイル各種                                               |                                  |

### 変更

| ファイル                                           | 変更内容                                                               |
| -------------------------------------------------- | ---------------------------------------------------------------------- |
| `src/types/supabase.ts`                            | ExtractedInfo, SpotAggregatedInfo 型追加、Stamp に extracted_info 追加 |
| `src/hooks/useRecordForm.ts`                       | submit 内で triggerExtraction 呼び出し追加                             |
| `src/screens/RecordScreen.tsx`                     | メモ欄の下にガイドテキスト追加（投稿促進）                             |
| `src/components/spot-detail/SpotDetailContent.tsx` | spotInfo props 追加、SpotInfoSection 組み込み                          |
| `src/components/spot-detail/SpotBottomSheet.tsx`   | useSpotInfo 接続                                                       |

## チーム構成

### Member A: `service-implementer` -- バックエンド層

- 型定義追加、マイグレーション作成
- `spotInfo.ts` サービス層（TDD）
- Edge Function 実装

### Member B: `service-implementer` -- フック層

- `useSpotInfo` フック（TDD）
- `useRecordForm` の triggerExtraction 追加（TDD）

### Member C: `ui-implementer` -- UI層

- `SpotInfoSection` コンポーネント（TDD）
- `SpotDetailContent` / `SpotBottomSheet` の変更（TDD）
- `RecordScreen` メモ欄にガイドテキスト追加（TDD）

### Member D: DB マイグレーション（最初に実行）

- stamps テーブル変更
- spot_aggregated_info テーブル作成
- Supabase MCP で適用

### 実行順序

```
Phase 1: Member D（DB）
Phase 2: Member A（サービス層・Edge Function）
Phase 3: Member B + C 並行（フック層 + UI）
Phase 4: Edge Function デプロイ + 統合検証
```

## テスト方針

| レイヤー      | テスト方法                                   |
| ------------- | -------------------------------------------- |
| サービス層    | supabase モック、jest                        |
| フック層      | renderHook + モック、jest                    |
| UI層          | render + fireEvent、jest                     |
| Edge Function | ロジック分離して Deno.test、統合テストは手動 |

## 注意事項

- **affiliated_shrines の方向性**: 神社Aが神社B・Cの御朱印もまとめて授与するケースでは、神社Aの詳細に「B・Cの御朱印もここで授与」と表示される。逆方向（神社Bの詳細に「御朱印は神社Aで授与」）は、ユーザーが神社B側に投稿したメモから access_notes として自然に抽出される想定。将来必要になれば JSONB なのでカテゴリ追加も容易
- **投稿促進UI**: スポット詳細ではなく記録画面のメモ欄にガイドテキストを配置。メモを書くタイミングが投稿促進の最適なタイミングであり、スポット詳細はノイズを減らしてスッキリ保つ
- **JSONB による拡張性**: 将来新しい情報カテゴリ（例: 初穂料、季節限定御朱印）を追加する場合、DBスキーマ変更不要。AIプロンプトの抽出対象に項目を追加し、UI に表示セクションを追加するだけで対応可能
- Edge Function は Supabase プロジェクト初導入。`supabase functions deploy` の手順確認が必要
- ANTHROPIC_API_KEY は `supabase secrets set` で設定（コードに含めない）
- fire-and-forget パターンのため、抽出失敗は投稿のUXに影響しない
- 初期は投稿数が少ないため API コストは問題にならない（~$0.0005/投稿）
- Stamp 型に `extracted_info` を追加すると、既存テストのモックデータに `extracted_info: null` の追加が必要
