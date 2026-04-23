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

- [x] **Sign in with Apple の実装** — Apple ガイドライン 4.8 により必須（Google Sign-In がある場合）
- [x] **プライバシーポリシーの公開URL** — https://kaiwa-jun.github.io/goshuin-app/legal/privacy.html（GitHub Pages 有効化が必要、手順は §2.1）
- [x] **利用規約の公開URL** — https://kaiwa-jun.github.io/goshuin-app/legal/terms.html（同上）
- [x] **サポートURL** — https://github.com/Kaiwa-Jun/goshuin-app/issues
- [x] **app.json / package.json の version を `1.0.0` に更新**
- [x] **App Store / Google Play メタデータドキュメント作成** — `docs/project/store-metadata.md` に確定版を記載
- [ ] **App Store 用スクリーンショット作成** — 最低 6.7 インチ (1290x2796px)、撮影手順は `store-metadata.md` 参照
- [ ] **GitHub Pages の有効化** — リポジトリ Settings から手動で有効化（手順は §2.1）

### 対応済み

- [x] マスタデータ投入（全国1,010件）
- [x] 位置情報・カメラ等の権限メッセージ（app.json infoPlist）
- [x] 暗号化の申告（ITSAppUsesNonExemptEncryption: false）
- [x] 利用規約・プライバシーポリシーの文面（docs/legal/）
- [x] EAS production ビルドプロファイル（eas.json）
- [x] バンドルID: `com.goshuin.app`

## 2.1 GitHub Pages の有効化

プライバシーポリシー・利用規約は `docs/legal/*.html` に格納されており、GitHub Pages で公開する。初回のみリポジトリ設定から有効化が必要。

### 設定手順

1. GitHub リポジトリ（https://github.com/Kaiwa-Jun/goshuin-app）を開く
2. **Settings** タブ → 左サイドバー **Pages**
3. **Build and deployment** セクションで以下を設定:
   - **Source**: `Deploy from a branch`
   - **Branch**: `main` / `/docs`
4. **Save** をクリック
5. 1〜2 分待ってから、下記 URL にアクセスして 200 で表示されることを確認:
   - https://kaiwa-jun.github.io/goshuin-app/
   - https://kaiwa-jun.github.io/goshuin-app/legal/privacy.html
   - https://kaiwa-jun.github.io/goshuin-app/legal/terms.html

### 公開対象ファイル

| パス                      | 用途                                                        |
| ------------------------- | ----------------------------------------------------------- |
| `docs/index.html`         | トップページ（各ドキュメントへのリンク集）                  |
| `docs/legal/privacy.html` | プライバシーポリシー                                        |
| `docs/legal/terms.html`   | 利用規約                                                    |
| `docs/.nojekyll`          | Jekyll 処理を無効化（`_` で始まるファイルを配信可能にする） |

> **注意**: `docs/` 配下の `.md` ファイル（本ガイド等）も公開される点に留意すること。機密情報は `docs/` に置かない。

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

> **確定版のメタデータ（説明文本体、サブタイトル、キーワード、プロモーションテキスト、Google Play 向け項目、データセーフティ申告等）は [`docs/project/store-metadata.md`](./store-metadata.md) を参照。**

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
