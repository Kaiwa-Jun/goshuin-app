# Guideline 2.1 情報要求への回答（build 14 / 2026-08-15）

- **Submission ID**: `040dc6c7-fc7e-454d-9cb6-e787c538bf54`
- **却下日**: 2026-08-15（5回目）
- **指摘**: Guideline 2.1 - Information Needed - New App Submission の**1件のみ**

## ✅ 前回の指摘2件は再指摘されていない

build 13 で指摘された **4.8（ログインサービス）と 1.2（UGC）は今回のメールに出てこない**。
PR #148 / #149 の対応が受け入れられたとみてよい。

**今回はバグの指摘ではなく、新規アプリの審査で審査員が理解を深めるための情報要求。**
コード修正は不要で、**ビルド14をそのまま使える**（再ビルド不要）。

### ASC の現況（2026-08-15 に API で実測）

`node scripts/asc-review.mjs status` でいつでも確認できる。

| 項目           | 値                                                     |
| -------------- | ------------------------------------------------------ |
| バージョン 1.0 | `REJECTED`（審査キューには載っていない）               |
| build 14       | `VALID` / 期限切れなし / `READY_FOR_BETA_TESTING`      |
| 審査提出       | `UNRESOLVED_ISSUES`                                    |
| Notes          | **旧い日本語のまま**（275文字）。置き換えが要る        |
| 添付           | `goshuin-account-deletion-build13.mov` が1件残っている |
| TestFlight     | ⚠️ **グループもテスターも0件**（下記 §0）              |

---

## 0. ⚠️ 撮影の前に: TestFlight に build 14 が降りてこない

**内部テストグループが1つも無い。** このままだと iPhone の TestFlight アプリに
「御朱印さんぽ」が出てこないので、**撮影の段取り以前に詰まる**。

```bash
node scripts/asc-review.mjs testflight
```

グループ `Internal` を作り、build 14 を配布対象に入れ、アカウント所有者
（`kj.11235813213455@gmail.com`）をテスターに追加する。数分で TestFlight に出る。

📌 **なぜ dev client ではだめか**: 開発メニューや Expo のランチャーが映り込むうえ、
審査に出したビルドそのものではない。5回却下されている状況で余計な疑問を足さない。

---

## 1. 画面録画（唯一のブロッカー・ユーザー作業）

> A screen recording captured on a physical device, running the latest operating system,
> demonstrating the app's functionality.

⚠️ **「実機で」「最新 OS で」と明記されている。** シミュレータ録画では要件を満たさない。

### 準備（この順で）

1. **iPhone を最新 iOS に更新する**（設定 → 一般 → ソフトウェア・アップデート）。
   Apple が "running the latest operating system" と書いているので、ここは合わせておく。
   ⚠️ **更新後のバージョン番号を控える**（設定 → 一般 → 情報）。Notes 更新の引数になる
2. `node scripts/asc-review.mjs testflight` → TestFlight で **build 14** を入れる
3. **捨てアカウント（Google）を用意し、iPhone に追加しておく**。
   録画には**アカウント削除**まで含めるので、本アカウントで撮ると宮城の御朱印記録が消える。
   事前に端末へ足しておくとサインインのシートで選ぶだけになり、パスワード入力が映らない
4. **紙の御朱印帳を手元に開いておく**。ステップ9でカメラを使うので被写体が要る
5. **おやすみモードをオンにする**（通知バナーが映り込むと撮り直し）
6. 画面収録をコントロールセンターに出しておく。**縦向き固定**

### カット割り（この順で1本撮る）

⚠️ **前回の版から4か所直した**（オンボーディングのボタン名／位置情報ダイアログの出る
タイミング／限定御朱印の対象スポット／カメラ経路）。実装を読んで確認した内容。

| #   | 操作                                                                                              | 何を見せているか                          |
| --- | ------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| 1   | **アプリを起動**（初回起動の状態から）                                                            | 「起動から始めること」の要件              |
| 2   | オンボーディング **4枚**を「**次へ**」で3回進める。⚠️ **「スキップ」は押さない**                  | —                                         |
| 3   | 4枚目で「**続ける**」→ **その場で位置情報ダイアログ** → 「Appの使用中は許可」                     | ⚠️ **要件: 機微データへの許可プロンプト** |
| 4   | 地図にピンが並ぶ。少しスワイプ / ピンチする                                                       | コア機能① 地図                            |
| 5   | 検索バーで「**靖國**」→ 結果をタップ → **ハンドル（画面の73%付近）をタップして展開**              | コア機能② 限定御朱印                      |
| 6   | 地図に戻り、**右下の「+」をタップ**                                                               | —                                         |
| 7   | **ログインシートに「Sign in with Apple」と「Google でログイン」が並ぶのを見せる**（1〜2秒止める） | ⚠️ 4.8 対応の証跡にもなる                 |
| 8   | **Google でログイン**（捨てアカウント）→ 記録画面へ                                               | ⚠️ **要件: 登録・ログインのフロー**       |
| 9   | **写真枠をタップ → カメラの許可ダイアログを許可 → 紙の御朱印を撮影**                              | ⚠️ **要件: 機微データへの許可プロンプト** |
| 10  | 「スポット」を選び、「訪問日」を確認し、「メモ（任意）」を入れて **「この内容で記録する」**       | コア機能③ 記録                            |
| 11  | 完了画面（`N箇所目の御朱印！` の演出）                                                            | —                                         |
| 12  | **御朱印帳タブ** → 蛇腹をめくって見せる                                                           | コア機能④ 御朱印帳                        |
| 13  | **あつめるタブ** → バッジ・地域別の進捗                                                           | コア機能⑤ コレクション                    |
| 14  | **自分タブ → 「アカウントを削除」→ 「アカウントを削除する」→ 確認の「削除する」**                 | ⚠️ **要件: アカウント削除のフロー**       |

### ⚠️ 前回の版から直した4点（理由）

1. **ステップ2の「続ける」→「次へ」**（`OnboardingScreen.tsx:142-155`）。
   1〜3枚目のボタンは「次へ」で、「続ける」は4枚目だけ。
   「スキップ」は**最終スライドへ飛ばすだけ**（Guideline 5.1.1(iv) 対応で脱出口を1本にしてある）
   なので、押しても権限ダイアログは避けられないが、**スライドが映らず尺が痩せる**
2. **ステップ3は独立した操作ではない**（`OnboardingScreen.tsx:89-97`）。
   位置情報のリクエストは「続ける」のハンドラの中。**タップ→ダイアログが1つの動作**なので、
   前の版のように2ステップに分けると「どこかで別に許可する画面がある」と読める
3. **ステップ5は「ピンをタップ」ではなく靖國神社を検索する。**
   限定御朱印のデータが入っているスポットは限られる（**靖國神社3件 / 金蛇水神社7件 /
   湯島天満宮3件**）。適当なピンを開くと**チップも中身も出ずコア機能②が映らない**。
   ⚠️ **展開はハンドルの「タップ」。スワイプは地図のパンになる**（`store-shot-limited.yaml` の教訓）
4. **ステップ9は「または『ギャラリーから選ぶ』」を外した。**
   ギャラリー経路（`usePhotoPicker.ts:56`）は `launchImageLibraryAsync` を直に呼ぶだけで
   **権限ダイアログが出ない**。Apple が見たいのはそのダイアログなので、**カメラ一択**。
   ⚠️ カメラ権限は一度拒否すると OS が二度と聞かないので、**捨てアカウント用に
   アプリを入れ直した直後の状態で撮る**

### 撮り終えたら

- 尺は **2〜4分**。長すぎると見てもらえない
- ⚠️ **通しで1本。** 途中で止めて繋ぐと「起動から始まる1本」に見えなくなる
- ファイルを **`~/Downloads/`** に置いて次節へ
- ⚠️ **サイズに注意。** iPhone の画面収録は 1080p で3分 ≒ 100MB を超え、そのままでは
  添付できない。`attach` が 45MB で止めて圧縮コマンドを出す（ffmpeg は導入済み）:

  ```bash
  ffmpeg -i 録画.mov -vcodec libx264 -crf 30 -preset veryfast -vf "scale=-2:960" \
    -acodec aac -b:a 64k 録画-small.mp4
  ```

  画質より「操作が追えること」が優先。960p で十分

---

## 2〜7. Notes 欄の英文

⚠️ **正は `scripts/asc-review.mjs` の `notesText()`。** ここに本文を転記すると
片方が腐るので置かない。

```bash
node scripts/asc-review.mjs notes --ios 26.5   # ← 実機の実際のバージョンに置き換える
```

- 実機の機種は **iPhone 16**（ASC の `/v1/devices` から確認済み）なのでスクリプトに埋めてある
- ⚠️ **ASC の Notes は 4000 文字上限**。現在 3806 文字（余裕 194）。
  スクリプトが超過を弾く。追記するときは削るものを決めてから
- 実行前にいまの Notes を `~/asc-notes-backup-*.txt` に退避する
  （2026-08-15 時点の内容は `.claude/harness/asc-review-notes-backup-2026-08-15.txt` にもある）

---

## 返信の段取り

| #   | やること                      | どうやる                                                                         |
| --- | ----------------------------- | -------------------------------------------------------------------------------- |
| 1   | TestFlight に build 14 を出す | `node scripts/asc-review.mjs testflight`                                         |
| 2   | 実機で録画                    | 上記のカット割り（**ユーザー作業**）                                             |
| 3   | Notes を更新                  | `node scripts/asc-review.mjs notes --ios <実機>`                                 |
| 4   | 録画を添付                    | `node scripts/asc-review.mjs attach ~/Downloads/<file>.mov`                      |
| 5   | 古い添付を消す（任意）        | `node scripts/asc-review.mjs rm-attachment 816a98f8-9d11-46e6-9b99-bad9bbe220a5` |
| 6   | App Review へ返信             | **ASC のブラウザ**（API に返信のエンドポイントは無い）                           |
| 7   | 「審査へ提出」                | **ASC のブラウザ**                                                               |

⚠️ **1・3・4・5 は API でやる。** ブラウザの添付ダイアログは 2026-08-11 に機能せず
半日溶かした（handoff の「ASC の画面操作」）。**ブラウザが要るのは 6 と 7 だけ。**

⚠️ **順番を守る。** 添付と Notes が入る前に「審査へ提出」すると、また同じ 2.1 が返る。

### 返信本文（短くてよい）

```
Hello,

Thank you for the review. We have provided all of the requested information.

- A screen recording captured on a physical iPhone running the latest iOS is
  attached in the App Review Information section. It starts from launching the
  app and covers the location permission prompt, the map, limited-edition
  goshuin information, sign-in, the camera permission prompt, recording a
  goshuin, the goshuin book, the collection screen, and account deletion.
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

---

## 📌 2.3.3（スクリーンショット）について

今回のメールの "How to Prevent Common Issues" に 2.3.3 の一般論が載っているが、
**指摘としては挙がっていない**（あの節は毎回付く定型文）。

ストアの6枚が 8/2 の見た目で古いのは事実（handoff 参照）。ただし
**2.1 の再提出と同時に差し替えると切り分けが濁る**ので、**今回は触らない**。
差し替えるなら 2.1 が解決してから。
