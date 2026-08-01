# ストア開発者アカウント セットアップ手順（2026-08 調査）

release-guide.md の補足。開発者アカウント周りの**本人にしかできない手動作業**を「確認 → 登録 → EAS 連携」の順にまとめる。

## Step 0: 登録済みかどうかの確認（最初にやる・15分）

### Apple Developer Program

1. https://developer.apple.com/account/ に Apple Account でサインイン（2FA 必須）
   - **有効**: 「Membership details」に Entity type: Individual / Team ID / 有効期限が表示される
   - **期限切れ**: 「Renew Membership」の警告が出る。期限切れ中はアプリがストアから取り下げられるが、[更新手順](https://developer.apple.com/support/renewal/)でいつでも復帰可能
   - **未登録**: Membership 情報がなく「Join the Apple Developer Program」への誘導のみ
2. https://appstoreconnect.apple.com/ にもログイン。「My Apps」に入れれば有効なメンバーシップあり
3. メール検索: 「Welcome to the Apple Developer Program」「Your receipt from Apple」「Apple Developer Programへようこそ」

### Google Play Developer

1. https://play.google.com/console/ に Google アカウントでログイン
   - **登録済み**: ダッシュボード（アプリ一覧）が表示される（$25 一回払いのため期限切れ概念なし）
   - **未登録**: サインアップ画面に誘導される
2. メール検索: 「Google Play Console」「Google Payments」
3. **重要**: 2023-11-13 より前に作成した個人アカウントが見つかれば、下記の「12人×14日クローズドテスト要件」が**免除**される。旧アカウント発掘の価値は大きい

## Step 1: 未登録だった場合の新規登録

### Apple（個人 / Individual）

- 登録: https://developer.apple.com/jp/programs/enroll/
- 必要: 2FA 有効な Apple Account / 法律上の氏名（半角ローマ字。App Store の「販売元」表示になる）/ 本人名義クレジットカード
- 料金: 年額 99 USD（日本円建て決済、近年実績 約12,980円/年 — 決済画面で要確認）
- 所要: 購入後 24 時間以内に確認メール。本人確認が入ると数日

### Google Play（個人）

- 登録: https://play.google.com/console/signup
- 必要: $25（プリペイド不可）/ 政府発行身分証での本人確認（カード名義と一致）/ 実機 Android デバイスの確認
- **⚠ リリース計画に直結**: 2023-11-13 以降作成の個人アカウントは、production 公開前に**クローズドテストで「12人以上のテスターが直近14日間連続オプトイン」**の実績 + production アクセス申請（審査 最大7日）が必要（[公式](https://support.google.com/googleplay/android-developer/answer/14151465)）。テスターが途中で12人を割るとカウントがリセットされるため **15人程度で開始**が安全。**Android の一般公開は登録から最短でも約3週間後**と見込むこと
- 帰結: **iOS を先行リリースし、Android はクローズドテストを並走させる**のが現実的

## Step 2: 登録後の EAS Submit 連携

### iOS

1. App Store Connect API Key を発行: https://appstoreconnect.apple.com/access/integrations/api で「+」→ Admin ロール → **.p8 は1回しかダウンロードできない**。Key ID / Issuer ID を控える
2. `eas credentials --platform ios` の対話フローで API Key を EAS に保存するのが最も楽（eas.json への記載不要）
3. Bundle ID `com.goshuin.app` は初回 `eas build -p ios` が自動登録。App Store Connect のアプリレコードも `eas submit -p ios` の対話フローが作成を代行できる

### Android

1. Google Cloud でサービスアカウント作成 → JSON キーをダウンロード（**git にコミットしない**）: [Expo 公式手順](https://github.com/expo/fyi/blob/main/creating-google-service-account.md)
2. Google Play Android Developer API を有効化
3. Play Console → Users and permissions でサービスアカウントにリリース管理権限を付与
4. 初回だけは Play Console でアプリを作成し、**Internal testing トラックに AAB を手動アップロード**（パッケージ名は最初の AAB で確定）。以後は `eas submit -p android`

## Step 3: その他（将来の課金導入時）

- **Apple Paid Applications 契約**（買い切り/IAP を出す前に必要）: App Store Connect → Business。銀行口座を先に登録 → 税務フォームは W-8BEN。**租税条約欄を飛ばすと売上から30%源泉徴収される**ので注意。無料アプリのみなら不要
- **Google Play お支払いプロファイル**: 有料化時に作成。無料のみなら不要
- 輸出コンプライアンス: `ITSAppUsesNonExemptEncryption: false` は app.json 設定済み

## 推奨の進め方

1. Step 0 の確認（両ストア・メール検索まで）
2. 未登録なら両方を即日申請（Apple ≈24h、Google は本人確認で数日）
3. **Google は登録でき次第すぐ Internal testing まで進め、クローズドテスト12人の募集を開始**（14日カウントがクリティカルパス）
4. 待ち時間で Step 2 のクレデンシャル整備
