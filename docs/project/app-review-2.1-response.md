# Guideline 2.1 情報要求への回答（build 14 / 2026-08-15）

- **Submission ID**: `040dc6c7-fc7e-454d-9cb6-e787c538bf54`
- **却下日**: 2026-08-15（5回目）
- **指摘**: Guideline 2.1 - Information Needed - New App Submission の**1件のみ**

## ✅ 前回の指摘2件は再指摘されていない

build 13 で指摘された **4.8（ログインサービス）と 1.2（UGC）は今回のメールに出てこない**。
PR #148 / #149 の対応が受け入れられたとみてよい。

**今回はバグの指摘ではなく、新規アプリの審査で審査員が理解を深めるための情報要求。**
コード修正は不要で、**ビルド14をそのまま使える**（再ビルド不要）。

---

## 1. 画面録画（⚠️ 唯一のブロッカー・ユーザー作業）

> A screen recording captured on a physical device, running the latest operating system,
> demonstrating the app's functionality.

⚠️ **「実機で」と明記されている。** シミュレータの録画は要件を満たさない可能性が高い。
5回却下されている状況なので、文字どおり実機で撮る。

### 準備

1. **build 14 を TestFlight で iPhone に入れる**（dev client ではなく**提出したビルドそのもの**を映す）
2. ⚠️ **捨てアカウントを用意する** — 録画には**アカウント削除**まで含める必要がある。
   本アカウント（宮城の御朱印記録が入っている）で撮ると**データが消える**。
   **Google サインイン用の別アカウント**を使えば、Apple ID を切り替えずに済む
3. iPhone の画面収録をオンにする（設定 → コントロールセンター）

### カット割り（この順で1本撮る）

| #   | 操作                                                                                     | 何を見せているか                          |
| --- | ---------------------------------------------------------------------------------------- | ----------------------------------------- |
| 1   | **アプリを起動**（初回起動の状態から）                                                   | 「起動から始めること」の要件              |
| 2   | オンボーディング4枚を「続ける」で進む                                                    | —                                         |
| 3   | **位置情報の許可ダイアログで「Appの使用中は許可」**                                      | ⚠️ **要件: 機微データへの許可プロンプト** |
| 4   | 地図にピンが並ぶ。少しスワイプ/ズームする                                                | コア機能① 地図                            |
| 5   | ピンをタップ → ボトムシート → **ハンドルをタップして展開** → 限定御朱印を見せる          | コア機能② 限定御朱印                      |
| 6   | 地図に戻り、**右下の「+」をタップ**                                                      | —                                         |
| 7   | **ログインシートに「Sign in with Apple」と「Google でログイン」が並ぶのを見せる**        | ⚠️ 4.8 対応の証跡にもなる                 |
| 8   | **Google でログイン**（捨てアカウント）→ 記録画面へ                                      | ⚠️ **要件: 登録・ログインのフロー**       |
| 9   | 写真枠をタップ → **カメラの許可ダイアログを許可** → 撮影（または「ギャラリーから選ぶ」） | ⚠️ **要件: 機微データへの許可プロンプト** |
| 10  | スポットを選び、訪問日を確認し、メモを入れて**「この内容で記録する」**                   | コア機能③ 記録                            |
| 11  | 完了画面（件数の演出）                                                                   | —                                         |
| 12  | **御朱印帳タブ** → めくって見せる                                                        | コア機能④ 御朱印帳                        |
| 13  | **あつめるタブ** → バッジ・地域別の進捗                                                  | コア機能⑤ コレクション                    |
| 14  | **自分タブ → 「アカウントを削除」** → 確認 → 削除完了                                    | ⚠️ **要件: アカウント削除のフロー**       |

📌 **UGC の通報・ブロックは撮らなくてよい。** build 14 で公開機能を撤去したので該当しない。
📌 **課金のフローも無い**（買い切りもサブスクも未実装）。

### 撮り終えたら

- 尺は**2〜4分**を目安に。長すぎると見てもらえない
- ASC の App Review 情報 → 添付ファイルに登録する。
  ⚠️ **返信ダイアログからの添付は過去に機能しなかった**（handoff の「ASC の画面操作」参照）

---

## 2〜7. Notes 欄に書く回答（英語・そのまま貼れる）

⚠️ ASC の **App Review Information → メモ（Notes）** 欄に貼る。
現在の内容（サインイン不要の旨など）は活かしつつ、以下で置き換える。

```
=== About this app ===

御朱印さんぽ (Goshuin Sampo) is a personal record-keeping app for goshuin —
the calligraphic seals visitors receive at Japanese shrines and temples.

Problem it solves: people who collect goshuin keep them in paper books and lose
track of where and when they visited. This app lets them photograph each seal,
attach the shrine/temple and the visit date, and see their visits accumulate on a map.

Target audience: people in Japan who visit shrines and temples and collect goshuin.
The app is Japanese-language only.

Core features (all free, no purchases of any kind):
1. Map of shrines and temples (about 1,100 spots nationwide, our own master data)
2. Recording a goshuin: one photo + spot + visit date + optional memo
3. A digital goshuin book that you flip through
4. Collection stats and badges
5. "Limited-edition goshuin" information gathered from each shrine's own website
   and public Instagram account

=== 2. Devices and OS tested ===

- iPhone [MODEL] running iOS [VERSION]  (physical device)
- iPhone 16 Plus simulator running iOS 26.5 (Xcode 26.6)

=== 3. Function and target audience ===

See "About this app" above.

=== 4. How to set up and reach the main features ===

No account is required to browse. Launch the app, complete the 4 onboarding
screens, and allow location access when prompted — the map then shows shrines
and temples near you. Tapping a pin opens a sheet; dragging or tapping its
handle expands it to show limited-edition goshuin information.

An account is required only to record a goshuin. Tap the "+" button on the map
and sign in with Sign in with Apple or Google. Reviewers may use their own
Apple ID; Sign in with Apple's private email relay is supported, and no demo
credentials are needed. Account deletion is available at
"自分" (Me) tab -> "アカウントを削除" (Delete account).

Location note: the app is built for Japan. Outside Japan the map will show no
spots, so please set the simulated or real location to Japan — for example
35.6786, 139.7442 (central Tokyo) — to see the map populated.

=== 5. External services used ===

- Supabase (supabase.com) — authentication, PostgreSQL database, file storage
  for goshuin photos, and serverless functions. Data is stored in Supabase.
- Sign in with Apple, and Google Sign-In — authentication only.
- Anthropic Claude API (api.anthropic.com, model claude-haiku-4-5) — when a user
  writes a free-text memo on a record, the memo text is sent to Claude to extract
  structured facts (parking, reception hours, access notes) that are shown on the
  spot page. Only the memo text is sent; photos and personal identifiers are not.
  The same API is used server-side to summarise limited-edition goshuin
  announcements found on shrine websites.
- Meta Graph API (graph.facebook.com) — server-side only, used to read public
  posts from shrines' own public Instagram business accounts in order to surface
  limited-edition goshuin announcements. No user data is sent to Meta.
- Apple Maps (MapKit via react-native-maps) — map rendering.

There are no payment processors, no advertising SDKs, and no analytics SDKs.

=== 6. Regional differences ===

The app behaves identically in all regions. There are no region-gated features.
The content is Japan-specific: the spot database covers Japanese shrines and
temples only, and the interface is Japanese-language only. Outside Japan the app
runs normally but the map will contain no spots.

=== 7. Regulated industry / third-party material ===

The app is not part of a regulated industry and contains no protected
third-party material.

- The shrine and temple master data consists of factual public information
  (name, address, coordinates, category) that we compiled ourselves.
- Goshuin photographs are taken and uploaded by the user, and are visible only
  to the user who created them. The app does not display any other user's
  content.
- Limited-edition goshuin information is short factual summaries of announcements
  that each shrine publishes on its own website or public Instagram account, and
  each item links back to the original source.
```

⚠️ `[MODEL]` と `[VERSION]` は実機の値に置き換えること（設定 → 一般 → 情報）。

---

## 返信の段取り

1. 実機で録画（上記のカット割り）
2. Notes 欄を上記で更新して**保存**
3. 録画を App Review 情報の**添付ファイル**に登録
4. App Review へ返信（下記の短文）
5. 「審査へ提出」

### 返信本文（短くてよい）

```
Hello,

Thank you for the review. We have provided all of the requested information.

- A screen recording captured on a physical iPhone is attached in the App Review
  Information section. It starts from launching the app and covers the location
  permission prompt, the map, limited-edition goshuin information, sign-in,
  the camera permission prompt, recording a goshuin, the goshuin book, the
  collection screen, and account deletion.
- Items 2 through 7 are answered in full in the Notes field of the App Review
  Information section.

Two points that may help the review:

- The app requires no purchases of any kind. There is no paid content, no
  subscription, and no in-app purchase.
- Build 14 no longer contains any user-generated content that is visible to other
  users. Every record is visible only to the user who created it, so there are no
  reporting or blocking mechanisms to demonstrate.

Please let us know if anything further is needed.

Best regards,
```
