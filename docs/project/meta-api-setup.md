# Meta API セットアップ手順(P2-02 限定御朱印ウォッチャー v2)

Instagram Business Discovery API で他の寺社アカウントの公開投稿(caption / permalink / timestamp)を取得するための、ユーザー側セットアップ手順。**すべて無料**。所要 30分〜1時間。

- 確認日: 2026-08-02。business_discovery は健在、Graph API 現行バージョンは **v25.0**(2026-02 リリース)
- 必要権限(公式ドキュメント確認済み): `instagram_basic` / `instagram_manage_insights` / `pages_read_engagement`。トークンは **Facebook User アクセストークン**(アプリトークン不可)
- 前提: 呼び出す側・呼ばれる側の両方が Instagram の**ビジネス or クリエイター(プロ)アカウント**であること。個人アカウントの寺社は取得不可 → 現行どおりリンク表示のまま(仕様化済み)

## 前提として必要なもの

- 個人の Facebook アカウント(開発者登録・FB ページ作成に使う。本名の通常アカウントで OK)
- スマホの Instagram アプリ

## Step 1: Instagram アカウントの準備(約10分・スマホ)

1. アプリ公式アカウントとして新規作成を推奨(例: `goshuin.sampo`)。既存の個人アカウントをプロ化しても機能上は同じだが、公開プロフィールがビジネス扱いになる点に注意
2. プロアカウントに切替: **設定とアクティビティ → アカウントの種類とツール → プロアカウントに切り替える → 「ビジネス」を選択**
3. カテゴリは「アプリ・サービス」等で適当に。連絡先情報の公開はオフで OK

## Step 2: Facebook ページ作成 + Instagram 連携(約10分)

1. facebook.com に個人アカウントでログイン → **ページを作成**(名前は「御朱印さんぽ」等。中身は空で OK、公開も必須ではない)
2. 連携(どちらか一方向で OK。Meta の UI は頻繁に変わる):
   - Instagram アプリ側: プロフィール編集 → ページ → 作成した FB ページを選択
   - または FB ページ側: 設定 → リンク済みのアカウント → Instagram を接続

## Step 3: Meta developer 登録 + アプリ作成(約10分)

1. [developers.facebook.com](https://developers.facebook.com) に個人 FB アカウントでログイン → 開発者登録(メール/電話認証)
2. My Apps → **Create App**
3. ユースケース選択では **「その他(Other)」→ アプリタイプ「ビジネス(Business)」** を選ぶ
   - ⚠️ 「Instagram」ユースケースは選ばない(あれは Instagram ログイン方式用で、business_discovery が使えるのは Facebook ログイン方式のビジネスアプリ)
4. アプリ名は `goshuin-sampo-watcher` 等
5. **アプリは開発モードのままで OK**。自分(管理者)のトークンで公開データを読むだけなので App Review 不要

## Step 4: トークンと IG User ID の取得(約15分)

[Graph API Explorer](https://developers.facebook.com/tools/explorer/) を使う。

1. 右上でアプリを選択
2. Permissions に以下を追加: `instagram_basic`, `instagram_manage_insights`, `pages_read_engagement`, `pages_show_list`
3. **Generate Access Token** → ログインダイアログで FB ページと IG アカウントへのアクセスを許可(短期トークンが得られる)
4. IG User ID を取得:
   - `GET me/accounts` → 作成したページの `id` を控える
   - `GET {page-id}?fields=instagram_business_account` → 返ってくる `id`(17 で始まる数字)が **IG User ID**
5. 長期トークン(60日有効)に交換。App ID / App Secret はアプリ設定 → ベーシックで確認:

   ```
   curl "https://graph.facebook.com/v25.0/oauth/access_token?grant_type=fb_exchange_token&client_id={app-id}&client_secret={app-secret}&fb_exchange_token={短期トークン}"
   ```

## Step 5: 動作確認(1リクエスト)

神田明神(seed 登録済み・プロアカウント)で試す:

```
curl "https://graph.facebook.com/v25.0/{IG User ID}?fields=business_discovery.username(kandamyoujin){username,media.limit(3){caption,permalink,timestamp}}&access_token={長期トークン}"
```

- 直近3投稿の caption / permalink / timestamp が返れば **セットアップ完了**
- エラーコード `(#110)` が返る場合は対象がプロアカウントでない(その寺社は取得対象外 → リンク表示のまま)

## セットアップ完了後に開発側へ渡すもの

1. **IG User ID** — 秘密情報ではないのでチャットに貼って OK
2. **長期トークン** — チャットに貼らず、Supabase secrets に自分で登録するのを推奨:

   ```
   npx supabase@latest secrets set META_ACCESS_TOKEN=EAAG... --project-ref tvnozkpxncmnehyomoff
   ```

   (関数側で参照する env 名は契約書で最終確定。まずこの名前で登録しておけば OK)

3. App ID / App Secret は Meta ダッシュボードでいつでも参照できるため共有不要(トークン更新時に本人が使う)

## 運用ノート

- **長期トークンは60日で失効する**。失効前に Step 4-5 と同じ `fb_exchange_token` エンドポイントで現トークンを再交換すれば延命できる。期限切れの検知・通知を実装スコープに入れるかは契約書で判断
- 無期限トークンが必要になったら Business Manager + System User 化という手段があるが、セットアップが重いので v2 は60日運用で開始
- business_discovery にはアカウント単位の取得量制限があるが、週2回 × 23アカウント程度なら問題にならない
