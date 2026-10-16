# App Store の運用（版・ビルド・審査）

2026-10-17 時点。iOS だけを配信している（日本の App Store のみ。Google Play は出していない）。

## 1. いまの状態

| 版    | 状態                                                 | メモ                                                       |
| ----- | ---------------------------------------------------- | ---------------------------------------------------------- |
| 1.0   | 2026-09-19 承認・09-22 公開                          | 審査で 5 回却下されてから通った                            |
| 1.1.0 | 2026-09-23 公開                                      | 日本地図・月参り・印・オンボーディング・新しいアイコン     |
| 1.2.0 | **2026-10-05 公開（いま出ている版）**                | 名前・サブタイトル・キーワードを変えた。検索の表示が増えた |
| 1.3.0 | **App Store Connect で「提出準備中」。ビルドはまだ** | 下の 2 を参照                                              |

1.3.0 の中身: 記録が 0 枚の人の最初の 1 枚を手伝う（地図の下のカード・近くの寺社の一覧・1 枚目の保存で県に色が差す。Issue #327）。

1.3.0 で App Store Connect に入れ済みのもの（2026-10-15）:

- 英語（en-US）の掲載文（名前「Goshuin Sanpo: Temple & Shrine」・サブタイトル・キーワード・説明文・プロモーション・What's New）
- 日本語のキーワードの入れ替え・スクショ 4 枚（オーナー承認済み）・What's New（日本語・英語）
- マーケティング URL とプライバシーポリシーの URL を goshuinsanpo.com に（サポート URL は GitHub の Issues のまま）
- 公開のしかた: 審査が通ったら自動で公開（`AFTER_APPROVAL`）
- 文面の元: `docs/project/store-metadata.md`

## 2. 1.3.0 の残りの手順

1. **オーナーに、本番ビルドを始めてよいか聞く**（EAS のビルドの回数を使う。無料の枠は月ごと。2026-09 に使い切ったことがある）
2. ビルドする作業場所を develop の最新にして、`git status` が空なのを見る。`app.json` の `version` が `1.3.0` なのを見る
3. **`npm ci` を流す**（流さないと、手元とビルドの側で runtimeVersion の指紋が食い違って落ちる。1.2.0 のビルド 22 がこれで落ちた）

   ```sh
   npm ci
   npx expo-updates runtimeversion:resolve --platform ios   # 値を控えておく
   eas build --profile production --platform ios
   ```

   - ビルド番号は EAS の側で自動で 1 つ上がる（`appVersionSource: remote`・`autoIncrement`）
   - 失敗したら `eas build:view <id> --json` の `logFiles`（gzip）を開いて、落ちた段を読む

4. ビルドが App Store Connect に届いて「処理済み（VALID）」になるのを待つ（`~/goshuin-work/asc/asc-wait-build.mjs`）。届いたビルドを 1.3.0 に付ける（`asc-prepare-1.2.0-b24.mjs` と同じ形。版とビルドの番号を 1.3.0 に書き換えて使う）
5. **審査用のメモ（App Review の Notes）が 1.2.0 のときの文のまま**なので、1.3.0 の中身に書き直す。今の値は `asc-read-1.3.0-review.mjs` で読める（パスワードは画面に出さない）
6. `asc-set-auto-release.mjs`・`asc-submit-1.2.0-b24.mjs` は版の番号が `1.2.0` のまま書いてある。1.3.0 に直してから使う
7. `asc-presubmit-check.mjs`（1.3.0 に直してある）で、出す前の状態を確かめる
8. **全体をオーナーに見せる**（ビルド・What's New・スクショ・審査のメモ）。了承をもらってから審査に出す
9. 出したあと: 審査の状態を API で見る。通ったら自動で公開される。公開されたら、2 週間後に検索の順位を測り直す（[growth.md](growth.md)）

## 3. App Store Connect の API

ブラウザを使わずに、たいていの操作ができる。鍵は `~/.appstoreconnect/` にある `.p8` のファイル（ID と場所は PRIVATE.md）。鍵の中身は読まない・出さない。

| できること                                                   | 道具                                                                                |
| ------------------------------------------------------------ | ----------------------------------------------------------------------------------- |
| 版・ビルド・審査の状態を読む                                 | `~/goshuin-work/dashboard/collect-asc.mjs`・`scripts/asc-review.mjs status`（リポ） |
| What's New・プロモーション・説明文・キーワード・URL を変える | `~/goshuin-work/asc/asc-finish-1.3.0.mjs` など                                      |
| スクショを差し替える                                         | `asc-shots-1.3.0.mjs`                                                               |
| ビルドを版に付ける                                           | `asc-prepare-1.2.0-b24.mjs`（形の見本）                                             |
| 公開のしかたを変える（`releaseType`）                        | `asc-set-auto-release.mjs`                                                          |
| 審査に出す・取り下げる                                       | `asc-submit-1.2.0-b24.mjs`・`asc-cancel-review.mjs`                                 |
| 審査用のメモ・添付                                           | `scripts/asc-review.mjs notes`・`attach`（リポ）                                    |
| 手動公開の版を公開する                                       | `POST appStoreVersionReleaseRequests`                                               |
| ダウンロード数などのレポート                                 | `~/goshuin-work/marketing/effect/asc-dl.mjs`（Analytics Reports）                   |

- 書き込みは外のサービスの変更なので、**前にオーナーの了承を取る**
- `--dry` が付く道具は、先に `--dry` で中身を見てから本番で動かす
- 版の情報（`appInfo`）は 2 つある。公開中の版のもの（`READY_FOR_SALE`）は触らない。直してよいのは提出準備中のほう
- API でできないこと: 審査の担当者への返信（Resolution Center）、App のプライバシーの一部。これはオーナーにブラウザでログインしてもらい、操作だけ手伝う

## 4. 審査で気をつけること

- 審査の担当者は、審査のたびに Apple でログインしてアカウントを作ることがある。DB の数を数えるときは除く
- デモ用のアカウント（ログイン情報）は App Store Connect の審査の欄に入っている。値は出さない
- これまでの却下と答え方の記録: `docs/project/app-review-2.1-response.md`・`.claude/harness/handoff.md`（2026-08 の分）

## 5. ほかに知っておくこと

- **OTA（EAS Update）**: ネイティブの依存を足した版のあとは、新しい JS は新しいストアのビルドにしか届かない（runtimeVersion は指紋の方式）。詳しくは `docs/project/release-guide.md` の 6
- **課金（プラス）**: RevenueCat でつないであるが、`BILLING_ENABLED=false` で閉じている。「記録した人 50 人」を始める目安にしている
- **本番の DB に当てる**: `supabase db query --linked -f <migration>` → `supabase migration repair --status applied <版>`（`db push` は過去の版番号のずれで使えない）。`supabase` は `~/.local/bin/supabase`（npx は使わない）。打つたびに、オーナーの画面に macOS のキーチェーンの許可の窓が出ることがある。オーナーが自分のターミナルで環境変数 `SUPABASE_ACCESS_TOKEN` を入れていれば出ない
- **写真の配り先**: 御朱印の写真は Supabase Storage と Cloudflare R2 の両方に書き、表示は R2 の変換（`img.goshuinsanpo.com/cdn-cgi/image/...`）から。Supabase の転送量（Cached Egress）は、2026-10-03 に無料の枠を超えて本番が止まり、Pro に上げた
