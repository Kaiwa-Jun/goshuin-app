# App Store / Google Play リリース手順

## 1. 前提条件

### アカウント登録

| サービス                | 費用            | URL                                   |
| ----------------------- | --------------- | ------------------------------------- |
| Apple Developer Program | $99/年          | https://developer.apple.com/programs/ |
| Google Play Developer   | $25（一回払い） | https://play.google.com/console/      |

### ツール

```bash
# EAS CLI のインストール
npm install -g eas-cli

# EAS にログイン
eas login
```

## 2. リリース前チェックリスト

### 必須（リリースブロッカー）

- [ ] **Sign in with Apple の実装** — Apple ガイドライン 4.8 により必須（Google Sign-In がある場合）
- [ ] **プライバシーポリシーの公開URL** — `docs/legal/privacy.html` を GitHub Pages 等で公開
- [ ] **利用規約の公開URL** — `docs/legal/terms.html` を GitHub Pages 等で公開
- [ ] **サポートURL** — お問い合わせ先ページ（GitHub Pages で簡易ページ or メールリンク）
- [ ] **app.json の version を `1.0.0` に更新** — 現在 `0.1.0`
- [ ] **App Store 用スクリーンショット作成** — 最低 6.7 インチ (1290x2796px)
- [ ] **App Store 用説明文・キーワード作成**

### 対応済み

- [x] マスタデータ投入（全国1,010件）
- [x] 位置情報・カメラ等の権限メッセージ（app.json infoPlist）
- [x] 暗号化の申告（ITSAppUsesNonExemptEncryption: false）
- [x] 利用規約・プライバシーポリシーの文面（docs/legal/）
- [x] EAS production ビルドプロファイル（eas.json）
- [x] バンドルID: `com.goshuin.app`

## 3. iOS App Store リリース手順

### 3-1. バージョン更新

`app.json` の `version` を更新:

```json
{
  "expo": {
    "version": "1.0.0"
  }
}
```

`package.json` も同期:

```json
{
  "version": "1.0.0"
}
```

### 3-2. Production ビルド

```bash
eas build --platform ios --profile production
```

初回実行時:

- Apple Developer アカウントへのログインを求められる
- Distribution Certificate とプロビジョニングプロファイルが EAS により自動生成・管理される
- ビルドは EAS クラウドで実行（ローカル Xcode 不要）

### 3-3. App Store Connect に提出

```bash
# ビルド完了後に提出
eas submit --platform ios

# または ビルドと同時に提出（推奨）
eas build --platform ios --profile production --auto-submit
```

初回実行時:

- Apple ID での認証が必要
- App Store Connect 上にアプリが未作成の場合、EAS が自動作成を提案する

### 3-4. App Store Connect でメタデータ入力

https://appstoreconnect.apple.com で以下を設定:

| 項目                    | 内容                                                        |
| ----------------------- | ----------------------------------------------------------- |
| アプリ名                | 御朱印コレクション                                          |
| サブタイトル            | 例:「御朱印を地図で管理」（30文字以内）                     |
| カテゴリ                | プライマリ: ライフスタイル、セカンダリ: 旅行                |
| 説明文                  | アプリの機能説明（4000文字以内）                            |
| キーワード              | 御朱印,神社,寺院,参拝,巡礼,地図,コレクション（100文字以内） |
| スクリーンショット      | 6.7インチ (1290x2796px): 必須                               |
| プライバシーポリシーURL | 公開URL                                                     |
| サポートURL             | 公開URL                                                     |
| 価格                    | 無料                                                        |

### 3-5. 審査提出

App Store Connect で「審査に提出」→ 通常 1〜3 日で結果。

## 4. Google Play リリース手順

### 4-1. Production ビルド

```bash
eas build --platform android --profile production
```

.aab（Android App Bundle）が生成される。

### 4-2. 初回リリース（手動アップロード）

Google Play Console の制限により、**初回の .aab は手動アップロードが必須**。

1. Google Play Console (https://play.google.com/console/) でアプリを作成
2. 本番 → リリース作成 → .aab ファイルをアップロード
3. ストア掲載情報を入力:
   - タイトル、説明文、スクリーンショット
   - コンテンツのレーティング（質問に回答）
   - プライバシーポリシーURL
   - データセーフティ（収集するデータの申告）

### 4-3. 2回目以降のリリース

```bash
# EAS Submit で自動化可能
eas submit --platform android
```

事前に Google Service Account Key の設定が必要:

1. Google Cloud Console → サービスアカウント作成 → JSON キーをダウンロード
2. Google Play Console → API アクセス → サービスアカウントをリンク

## 5. App Store Review の注意点

### リジェクトされやすいポイント

| リスク                     | 詳細                                                     | 対策                       |
| -------------------------- | -------------------------------------------------------- | -------------------------- |
| Sign in with Apple 未実装  | ガイドライン 4.8: サードパーティログインがある場合は必須 | **実装必須**               |
| プライバシーポリシーの不備 | 位置情報・カメラ・写真を使うアプリは特に厳しい           | 公開URL を用意             |
| メタデータの不備           | スクリーンショットや説明文が不十分                       | 全項目を埋める             |
| ログインなしで使えない     | Apple はログイン不要でも基本機能が使えることを推奨       | 遅延ログイン方式で対応済み |
| コンテンツが少なすぎる     | データが空だとリジェクトの可能性                         | マスタデータ投入済み       |

### 審査で聞かれる可能性があること

- **位置情報の利用目的**: 「周辺の神社仏閣を検索するため」（app.json に設定済み）
- **カメラの利用目的**: 「御朱印の写真を撮影するため」（app.json に設定済み）

## 6. リリース後の運用

### OTA アップデート（EAS Update）

JavaScript バンドルのみの変更（UI修正、バグ修正等）は、ストア審査なしで即時配信可能:

```bash
# OTA アップデートの配信
eas update --branch production --message "バグ修正"
```

**注意**: ネイティブコードの変更（新しいネイティブモジュール追加等）はストア再審査が必要。

### バージョン管理

- `eas.json` の `production` プロファイルに `autoIncrement: true` が設定済み
- ビルドごとに buildNumber（iOS）/ versionCode（Android）が自動インクリメントされる
- `app.json` の `version`（ユーザーに見えるバージョン）は手動で更新

### バージョン更新の目安

| 変更内容   | バージョン更新 | 例            |
| ---------- | -------------- | ------------- |
| バグ修正   | パッチ         | 1.0.0 → 1.0.1 |
| 機能追加   | マイナー       | 1.0.0 → 1.1.0 |
| 大規模変更 | メジャー       | 1.0.0 → 2.0.0 |
