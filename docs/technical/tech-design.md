# 技術設計

## 技術スタック

**決定**: Supabase採用

- モバイル: Expo (React Native) + TypeScript
- バックエンド: Supabase（認証、DB、ストレージが揃っている）
- iOS/Android両対応

### 画像ストレージコスト試算

- 前提: 御朱印画像500KB/枚、初年度10ユーザー、年50枚/人
- 年間: 500枚 × 500KB = 250MB
- Supabase Free tier (1GB) で余裕、100ユーザー超でPro検討

## データベース構造

```sql
users
├── id
├── email
├── created_at
└── updated_at

spots（旧shrines）
├── id
├── name
├── lat
├── lng
├── type（shrine / temple）
├── address
├── status（active / pending / merged）
├── created_by_user_id
├── merged_into_spot_id
├── created_at
└── updated_at

goshuincho（御朱印帳）
├── id
├── user_id
├── name（「伊勢神宮で買った朱色の帳」等）
├── cover_image_path（表紙の写真）
├── started_at（使い始めた日）
├── is_default（デフォルトの帳かどうか）
├── created_at
└── updated_at

stamps（御朱印記録）
├── id
├── user_id
├── spot_id
├── goshuincho_id（どの御朱印帳に貼ったか、nullable）
├── visited_at
├── image_path
├── memo
├── created_at
└── updated_at
```

### 補足

- `goshuincho_id` は nullable にする（「どの帳に入れたか未分類」を許容）
- ユーザー作成時にデフォルトの御朱印帳を1冊自動作成
- MVP では御朱印帳機能は「将来実装」として、stamps テーブルに `goshuincho_id` カラムだけ用意しておく

## マスタデータ調達

**決定**: 神社本庁・各宗派公式 + AI活用でデータ整備

- OpenStreetMapは補助的に使用（品質にばらつきあり）
- 神社本庁の神社検索、各宗派の寺院検索から正確なデータを取得
- Google Mapsで緯度経度を補完
- Claude等でデータ整形 → Supabaseへ投入
- 初期データ件数: 宮城県内500-1,000件程度
- ユーザー追加 → 承認フローも併用（MVP段階は手動承認）
