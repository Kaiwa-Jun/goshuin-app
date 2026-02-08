# Issue #6: Supabase DBスキーマ作成

## 概要

Supabase上にアプリのコアテーブル（profiles, spots, stamps, goshuincho）を作成し、RLS・インデックス・トリガーを設定する。

## 関連ドキュメント

- [要件定義](../product/requirements.md)
- [技術設計](../technical/tech-design.md)

## 詳細設計

### テーブル構成

| テーブル   | 説明                                    |
| ---------- | --------------------------------------- |
| profiles   | ユーザープロファイル（auth.usersと1:1） |
| spots      | 神社仏閣のスポット情報                  |
| stamps     | 御朱印記録                              |
| goshuincho | 御朱印帳                                |

### マイグレーション一覧

| #   | ファイル                                                   | 内容                                                                   |
| --- | ---------------------------------------------------------- | ---------------------------------------------------------------------- |
| 1   | `20260208102520_create_profiles.sql`                       | profiles テーブル、handle_updated_at()、handle_new_user()トリガー、RLS |
| 2   | `20260208102535_create_spots.sql`                          | spots テーブル、spot_type/spot_status enum、地図用インデックス、RLS    |
| 3   | `20260208102547_create_stamps.sql`                         | stamps テーブル、インデックス、RLS（CRUD全操作）                       |
| 4   | `20260208102601_create_goshuincho.sql`                     | goshuincho テーブル、stamps への FK追加、RLS                           |
| 5   | `20260208120000_add_default_goshuincho_on_signup.sql`      | handle_new_user() 拡張（デフォルト御朱印帳の自動作成）                 |
| 6   | `20260208120100_add_composite_index_and_delete_policy.sql` | stamps 複合インデックス、goshuincho DELETEポリシー                     |

### 共通トリガー関数

- `handle_updated_at()`: 全テーブルの `updated_at` を自動更新
- `handle_new_user()`: ユーザー登録時に profiles + デフォルト御朱印帳を自動作成

### RLSポリシー

| テーブル   | SELECT          | INSERT              | UPDATE   | DELETE                   |
| ---------- | --------------- | ------------------- | -------- | ------------------------ |
| profiles   | 本人のみ        | トリガー経由        | 本人のみ | -                        |
| spots      | active のみ全員 | 認証済み（pending） | -        | -                        |
| stamps     | 本人のみ        | 本人のみ            | 本人のみ | 本人のみ                 |
| goshuincho | 本人のみ        | 本人のみ            | 本人のみ | 本人のみ（非デフォルト） |

### インデックス

| テーブル   | インデックス                                         | 用途                             |
| ---------- | ---------------------------------------------------- | -------------------------------- |
| spots      | `idx_spots_location (lat, lng)`                      | 地図表示・周辺検索               |
| spots      | `idx_spots_status (status)`                          | ステータスフィルタ               |
| stamps     | `idx_stamps_user_id (user_id)`                       | ユーザー別取得                   |
| stamps     | `idx_stamps_spot_id (spot_id)`                       | スポット別取得                   |
| stamps     | `idx_stamps_visited_at (visited_at)`                 | 日付順ソート                     |
| stamps     | `idx_stamps_user_visited (user_id, visited_at DESC)` | ギャラリー画面用複合インデックス |
| goshuincho | `idx_goshuincho_user_id (user_id)`                   | ユーザー別取得                   |

## テスト方針

- マイグレーション適用後、SQLで関数定義・インデックス・ポリシーの存在を確認
- `npm run typecheck` で型エラーがないことを確認

## 注意事項

- `goshuincho_id` は nullable（未分類の御朱印を許容）
- デフォルト御朱印帳は削除不可（RLS DELETEポリシーで `is_default = false` を条件に）
- spots の INSERT は `status = 'pending'` のみ許可（承認フロー）
