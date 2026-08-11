# セッション引き継ぎ（最終更新: 2026-08-09）

## ▶ 再開したらここから（2026-08-09 時点）

**残タスクの一覧はタスクボードが正**: `.claude/harness/task-board.html` / Artifact https://claude.ai/code/artifact/961421e9-0005-4116-9b18-f3856646e0aa （更新方法は下記「残タスクの棚卸し」参照）

**直近で完了（すべて 2026-08-09。PR 9本）**:

| PR   | 内容                                                             |
| ---- | ---------------------------------------------------------------- |
| #119 | 監査 A-4 アップロードエラー（#118）                              |
| #120 | グリッドを古い順に                                               |
| #121 | 監査 A-1 カメラが起動しない                                      |
| #122 | CI-1 の 404（`auto-review` にモデル未指定）                      |
| #124 | **P1-10 案3 タブ入れ替え**（#123。A-13 / A-14 / B-6 も同時解決） |
| #126 | #125 行きたいの削除が地図に即時反映されない                      |
| #127 | 監査 A-2 / A-3 / A-10 / A-11 / B-4                               |
| #129 | #128 日付ピッカーで年月を変えると日を選ばずに閉じる              |
| #131 | **P1-02 記録フローの最短化**（#130。D-3 の決定を反映）           |

**監査（A-1〜A-14 + B-4）はこれで全部片付いた**。P1-02 / P1-03 / P1-10 とも `passes: true`。テストは 1002 → **1087件**。

## ⚠️ 次に参拝したときに必ず確認すること（P1-02 の積み残し）

**PR #131 で入れた「最寄りスポットの既定選択」は、位置情報に依存する2項目が未検証のままマージした**（自宅からは 500m 以内に候補が無く、「ガードで出なかった」のか「遠くて出なかった」のか区別できないため）。

1. **境内（500m以内）で最寄りが既定選択され、「現在地から自動選択」ラベルが出るか**
2. **位置情報を拒否した状態で既定選択が働かないか**（⚠️ これが最重要。`useLocation` は未許可でも `DEFAULT_LOCATION`＝**仙台**を返すため、ガードが壊れていると東京にいるユーザーに仙台のスポットが既定選択される）

**追跡用 Issue #132** を切ってある。確認できたら `docs/issues/issue-130-record-flow-shortening.md` の「実機確認の結果」表を更新して #132 を閉じること。

**失敗しても安全側に倒れる**（自動選択が働かなければ従来どおり手で選ぶ動作に落ちる）ためマージ判断したが、未検証であることは事実として残っている。

### P1-02 で分かったこと

- **監査 B-1 の「5〜6タップ」は誤りだった**。実測は地図 FAB 経路で**7タップ**。監査は「スポット自動選択が効く場合」を前提にしていたが、その自動選択は実装されていなかった。**監査の数字は実装を確かめずに書かれていることがある**
- **確認モーダルの廃止だけでは 7→6 にしかならない**。3タップに届かせるにはカメラ直起動とスポット自動選択が要った。**D-3 は「3タップを塞いでいる元凶」ではなく3本あるレバーの1本**だった
- **`direction.md` に「3タップ」という数字は無い**（出典は `ui-design.md:25` の v6 で、B-4 で一部撤回済み）。要件は「タップ数削減」であって3という数字ではない
- ⚠️ **`isSubmitting` は `submit()` の中で初めて true になる**。その手前に await があるとボタンの `disabled` が効かず二度押しできる。確認モーダルがこの窓を吸収していたため、廃止して初めて露出した
- ⚠️ **`submit()` は検証失敗時に `stage`/`message` 無しの失敗を返す**ので、呼び出し側で先に `validate()` しないと入力不備でエラー画面に飛ぶ

**次にやること: 残る設計判断 D-5（ピンの色）/ D-6（受付時間のデータ整備）、またはバックログ（P1-01 Maestro E2E / P1-04 パーソナル年報 / P1-07 地図の全国スケール解禁）。**

⚠️ D-5 は着手前に `docs/issues/issue-099-map-clustering.md` 追補1〜4 を必読。

**他の候補**:

- **残る設計判断**: D-5 ピンの色（⚠️ 着手前に `docs/issues/issue-099-map-clustering.md` 追補1〜4 必読）/ D-6 受付時間のデータ整備（B-7・全1,109スポット中2件しかデータが無い）
- **バックログ**: P1-01 Maestro E2E の実戦検証 / P1-04 パーソナル年報 / P1-07 地図の全国スケール解禁
- **小物**: `ImageGalleryModal` のレンダー中 `setValue`（`src/components/common/ImageGalleryModal.tsx:82-88`・別 issue 化推奨）/ CI で見つけた別件2件（下記）
- **GitHub open issue**: **#132 P1-02 の実機未検証2項目（参拝時に確認）** / **#133 `fetchVisitedSpotIds` の握り潰しでバッジ判定がずれる** / #82 買い切りプレミアム（low）/ #67 全国 rank3 マスタデータ（medium）/ #47 訪問ルートの記録・共有

### ⚠️ 教訓: 監査項目は症状であって要件ではない

A-2 は監査に「訪問日が西暦のみ」と**表示の問題として**書かれていたが、着手前に本人に確認したら実際は**入力側**の困りごとだった。

> 紙の御朱印上の日付は和暦で書いてあって、投稿時に西暦で日時を指定する際にそこの変換が難しかった。表示については正直どっちでもいい

表示を和暦化する（監査の字面どおりの対応）のではなく、**日付選択の行に和暦を併記して紙と照合できるようにする**のが正解だった。監査項目に着手するときは、字面を要件として実装する前に何が困ったのかを確かめること。

**P1-10（案3 タブ入れ替え）は実機確認まで完了して `passes: true`（2026-08-09）**。1回目の実機確認でバグを1件検出し、Issue #125 / PR #126 で修正・再確認済み（下記の教訓を参照）。

### ⚠️ 教訓: データ源を差し替えるときは再取得の性質も移す

PR #124 の auto-review が「`MapScreen` が `useWishlist`（ID の Set）と `useWishlistSpots`（詳細の JOIN）を二重に取得している」と指摘し、件数を `wishlistSpotIds.size` に変えた。指摘は正しかったが、**`useWishlistSpots` が持っていた `useFocusEffect` による再取得の性質を落とした**結果、行きたいを削除しても地図の件数が古いまま残る退行が入った（実機で発見）。

`useWishlist` を `useFocusEffect` に変えて、件数とピンの色を1つの軽いクエリで同時に直した。**ピンの色のずれは案3より前からあった既存問題**で、地図 → 一覧 → 削除 → 地図に戻る導線になって毎回目に入るようになっただけ。

📌 **ストアスクショの方針（2026-08-09 決定）**: 残り3枚を先に撮るのはやめた。理由: ①ストアには既に6枚アップロード済みで**審査はそれで進んでおり、残り3枚はブロッカーではない** ②dev client は Metro から作業ツリーを読むため撮れるのは常に「いまの develop」で、審査中の build 12（8/8 早朝・#114 も #116 も入っていない）とは一致しない。**次のビルド提出とセットで6枚とも撮り直す**。シミュレータ `goshuin-shot` にアプリはインストール済み・Maestro も動くので、**ログインさえ通れば撮影は自動化できる**（AsyncStorage に保存セッションが無いことを確認済み。シミュレータ上で1回ログインしてもらえば以降は自動）

**#116 の実機 N 群8項目は全消化（2026-08-09）**。グリッドの並び（→ PR #120）と、残り5項目（スワイプの手触り / スナップ・小型端末での収まり・再起動をまたぐ表示モード永続化・白紙ページから記録画面・1件入った状態のページ番号と和暦）をすべて OK と確認。

### 残タスクの棚卸し → **`.claude/harness/task-board.html` に集約した**

**一覧の正はタスクボード**（Artifact: https://claude.ai/code/artifact/961421e9-0005-4116-9b18-f3856646e0aa ）。全31件 + ユーザー作業7件を性質別（バグ / 小さい改善 / 設計判断 / バックログ / リリース・期日 / ユーザー作業）に束ね、規模・根拠の file:line・ブロッカー・期日を載せてある。**チェックは Claude が更新する運用**（完了したら該当項目に `done` クラスを付け、セクションと rail のカウントも直して同じ URL に再デプロイする。`file_path` を同じにすれば URL は変わらない）。

以下は棚卸し時に**コードで裏を取った事実**。ボードの内容と重複するが、根拠として残す。

- ~~**A-1 カメラが起動しない**~~ — **完了（PR #121・実機確認済み・2026-08-09）**
- ~~**A-2 記録画面の訪問日が西暦のみ**~~ — **完了（PR #127）**。ただし解は「表示の和暦化」ではなく「日付選択への和暦併記」（上記の教訓を参照）
- ~~**A-3 日付ピッカーのスクロール位置**~~ — **完了（PR #127）**
- ~~**A-10 0件の空状態に CTA ボタンが無い**~~ — **完了（PR #127）**。flip モードは白紙ページが入口なので、グリッドモードにのみ CTA を追加した
- ~~**A-11「他の巡礼を見る」の展開**~~ — **完了（PR #127）**
- ~~**A-13 行きたいリストのカードがタップできない**~~ — **完了（PR #124・P1-10 で移設と同時に解決）**
- **A-14 位置情報を設定画面から** — 未対応と確認。`SettingsScreen.tsx` はアカウント / 公開設定 / アプリ情報の3セクションのみ（`51 / 78 / 100`）

**#114・#116 で吸収済み**: A-5 / A-6 / A-7 / A-8 / A-12（ボトムシート再設計）、めくり側の和暦

**feature-list で passes: false**: P1-01 Maestro E2E の実戦検証 / P1-04 パーソナル年報 / P1-07 地図の全国スケール解禁。~~P1-03~~ / ~~P1-10~~ / ~~P1-02~~ は 2026-08-09 に実機確認まで完了で passes: true（P1-02 は位置情報依存の2項目のみ未検証。上記「次に参拝したときに必ず確認すること」参照）

**GitHub の open issue**: #82 買い切り型プレミアム（low）/ #67 全国ランク3マスタデータ（medium）/ #47 訪問ルートの記録・共有

**設計判断が要るもの**: B-7 受付時間は仕組みだけあってデータが無い（D-6）/ D-5 ピンの色（要 #099 追補）。~~タブ入れ替え~~ / ~~B-6~~ は P1-10 で、~~B-4~~ は PR #127 で、~~D-4~~ は「御朱印帳の中だけ」で、~~D-3 確認モーダル~~ は「廃止して完了画面に取り消し」で決定済み（PR #131）

**別 issue 化すべき既知の問題**: `ImageGalleryModal` がレンダー中に `Animated.Value.setValue()` を呼び React が警告を出す（`src/components/common/ImageGalleryModal.tsx:79-88`）

**CI（CI-1）— 解消済み（PR #122・2026-08-09）**: `auto-review` が毎回 404 で落ちていた原因は、**action にモデルを渡していなかった**ため、インストールされる Claude Code の既定モデル（リタイア済みの `claude-sonnet-4-20250514`）が使われていたこと。`claude-code-base-action@beta` の **`model` 入力**に `claude-sonnet-5` を指定して解消（`anthropic_model` は DEPRECATED、`model` が現行。`allowed_tools` は `beta` タグ時点でも有効な入力）。同じ action を使う `mention-response` にも同じ指定を入れた。**PR #122 で auto-review が pass し、実際にレビューコメントが投稿されることまで確認済み**。

⚠️ 過去の記述の訂正: ワークフローは **`.github/workflows/pr-review.yml` の1本だけ**で、その中の3ジョブ（`auto-review` / `mention-response` / `lint-and-test`）のうち `auto-review` だけが落ちていた。`lint-and-test` は同じファイル内にあり元から success。

📌 **CI-1 の作業中に見つかった別件（未対応・要判断）**: ①`mention-response` が `${{ github.event.comment.body }}` を `prompt` に直接展開している（シェルではなく action 入力なのでコマンドインジェクションではないが、コメント本文でプロンプトを動かせる）②`permissions` が3ジョブ共通で `contents: write` / `pull-requests: write` / `issues: write` と広く、`lint-and-test` には不要

**期日があるもの**:

- **App Store 審査結果**（buildNumber 12 を 8/8 提出）→ **8/9 時点で結果メールは未着**（Apple からのメールを全件確認済み）。バイナリの ASC アップロードは `eas submit:list` で `FINISHED / 8-08 09:33 JST` を確認。⚠️ **build 11 は提出 8/2 → 却下 8/6 で約4日**かかっているので、48時間で焦らなくてよい。唯一未確認なのは **8/8 の「審査へ提出」が ASC 上で審査待ちになっているか**（要 Apple ログイン・ユーザー作業）。通過なら手動リリース
- **8/11(火)朝: cron 実行確認** — `crawl-spot-sources` の2ジョブが succeeded か（`select jobname, status, start_time from cron.job_run_details order by start_time desc limit 10;`）
- **10月初旬: Meta アクセストークン更新**（期限 2026-10-02）

**ユーザー作業待ち**:

- **ASC で 8/8 の再提出ステータスを確認**（「審査待ち / 審査中」になっているか）。今回の棚卸しで唯一、事実にできなかった点。要 Apple ログイン
- ~~**Google Play**: 本人確認（審査中）+ Android 実機での Play Console ログイン~~ → **iOS 優先のため保留**
- ~~実機スクショ3枚~~ → **次のビルド提出とセットで6枚とも撮り直す方針に変更**（下記「ストアスクショの方針」参照）。いま撮る必要はない
- **実機確認**: 新機能を入れたときのみ。8/9 時点の実装（P1-03 / P1-10 / 小さい改善 / 日付ピッカー）はすべて実機確認済み

### 実機の動かし方

dev サーバーは tmux `goshuin-dev` で動いている。**まず生きているか確認してから**。

```bash
curl -s -o /dev/null -w "%{http_code}\n" --max-time 10 http://localhost:8081/status
cat .dev-tunnel/url.txt
```

- 200 が返れば Dev Client を Reload するだけでよい
- ⚠️ **つながらない場合だけ `/dev` を叩き直す**。trycloudflare の quick tunnel は無保証で切れる。叩き直すと URL が変わるので `./scripts/dev.sh qr` で QR を出して読み直すこと

### 記録が失敗したときの拾い方（#118 で入れた仕込み）

ErrorScreen に**「詳細」ブロックが出て、例外の原文がそのまま表示される**。長押しでコピーできる。

- 見出しが「**アップロードエラー**」= Storage への画像アップロードで失敗
- 見出しが「**保存エラー**」= 画像は上がっていて stamps への insert で失敗

Metro のログから拾う場合:

```bash
tmux capture-pane -pt goshuin-dev -S -300 | grep -A 5 "submit failed at"
```

`console.error('[record] submit failed at <stage>: <message>')` が出る。ペインを直接見るなら `tmux attach -t goshuin-dev`（デタッチは `Ctrl-b` → `d`）。

### #118 で分かったこと（要点）

`supabase-js` の Storage クライアントは FormData を渡されると内部で `body.has('cacheControl')` を呼ぶ。**RN の FormData ポリフィルは `append` / `getAll` / `getParts` しか持たず `has()` が無い**ため、通信が1バイトも出る前に `TypeError: body.has is not a function` で落ちていた。`isNetworkError()` にマッチしない例外は全部 `'upload'` に倒れる分岐だったので、画面には「アップロードエラー」としか出ていなかった。

**Storage 側は無罪だった**（監査時の第一候補だったが違った）:

- バケット `goshuin-images` は存在。`public=true` / 5MB上限 / `allowed_mime_types={image/jpeg, image/png, image/webp}`
- `storage.objects` のポリシー6本すべて適切
- **2026-03-04 にアプリ経由のアップロード成功実績が1件残っている** → 依存を上げたときに `has()` のガードが入って壊れた**回帰**

### #118 の修正の内容

- `uploadStampImage` を `expo-file-system` の `File#bytes()` でバイト列を渡す方式に変更。`contentType: 'image/jpeg'` の明示は**必須**（`allowed_mime_types` があるので既定値だと弾かれる）
- `expo-file-system` は `expo@54` の推移的依存として既にネイティブ側に入っている。`package.json` に明示しただけでバージョンは 19.0.21 のまま = **dev build の作り直しは不要**
- `submit()` が `stage`（`'upload' | 'create'`）と `message` を返し、ErrorScreen が原文を表示する
- RN の FormData を global に差し込んで supabase-js の実物を通す回帰テストを追加（`stamps-upload-native.test.ts`）。jest の node 環境の FormData は `has()` を持つのでこの仕込みが無いと検出できない
- `goshuin-images` バケットとポリシーを migration 化（監査が指摘していた再現性の穴）。本番は既にこの状態なので適用不要

機械検証: **テスト 89 suite / 1020 件全パス**、lint 0 errors、typecheck clean。実機確認済み。

### ⚠️ 今後のための教訓

- **RN の FormData は web の FormData ではない**。ライブラリに渡すときは web API 前提になっていないか疑う
- **jest（node 環境）と実機で global の実装が違うものは、テストが通っても実機で落ちる**（`FormData` / `Blob` / `atob`）。global を差し替えて実物のライブラリを通す特性テストで守る
- **表示されているエラー名を信じない**。分岐が雑だと無関係な失敗が同じ画面に集まる

### 直近で終わったこと

- **Issue #114（P1-09 ボトムシート）完了** — PR #115 マージ済み・`passes: true`・実機確認済み
- **Issue #116（P1-03 めくり UI）完了** — PR #117 マージ済み・**実機確認済み・`passes: true`（2026-08-09）**。契約書 `docs/issues/issue-116-goshuincho-flip-ui.md`（95項目）。右綴じ（`FlatList inverted`）+ 蛇腹の折り（RN 標準 `Animated` でスクロール連動）+ 白紙ページ = 記録入口 + グリッド切替の永続化 + 和暦。テスト1002件
  - Evaluator の結果（80 PASS / 1 FAIL / 8 SKIP）は**右綴じと蛇腹を入れる前の版**に対するものだが、当該2機能は実機確認で代替した。残件は W-17（ImageGalleryModal のレンダー中 setValue・既存実装・別 issue 予定）
  - **Expo Web での検証手段を作った**: 認証が Google/Apple のネイティブサインインのみで Web からログインできないため、`?preview=goshuincho` で fixture を差し込む web 専用プレビュー経路を足した（契約書 S-7・ユーザー承認済み）。`http://localhost:8081/?preview=goshuincho` → 御朱印タブ。native では `.web.ts` が解決されないので常に無効
  - 📌 **別 issue 化すべき既知の問題**: `ImageGalleryModal` がレンダー中に `Animated.Value.setValue()` を呼んでおり React が `Cannot update a component while rendering...` を出す（`src/components/common/ImageGalleryModal.tsx:79-88`。「ちらつき回避のため意図的」というコメント付きの既存実装）。#116 が原因ではなく、S-7 で Web から到達できるようになって表面化しただけ
- **P1-03 完成後の予定だったタブ入れ替え（案3: 地図 / 御朱印帳 / あつめる / 自分）は未着手**。めくり UI は入ったので着手可能

### Playwright で Expo Web を触るときのメモ（#116 で消耗した分）

- Expo Web は tmux `goshuin-dev` が 8081 で配信中。**再起動しない**
- 御朱印タブは `[role="tab"] >> nth=1`。タブ名は先頭に空白が入るため name 指定が効きにくい
- **`browser_evaluate` 内の生 DOM `.click()` では RN Web のボタンを正しく押せない**（押せなかったり別要素が誤爆したりする）。必ず Playwright の実クリックを `[data-testid=...]` に対して行う
- コンソールの 400 2件（`spots?...id=eq.` / `stamps?...id=eq.` の空文字 ID）は**既存**（P1-08 の Evaluator 所見）。新規判定の対象外

（参考）Expo Web は tmux セッション `goshuin-dev` が 8081 で配信中。**二重起動は失敗する**

---

## P2-02 Instagram Business Discovery — 完了（2026-08-08 運用投入）

Issue #111 / PR #112 マージ済み・本番投入完了（passes: true）。Meta セットアップ〜実装〜検証〜運用投入までの全経緯。

- ✅ Meta セットアップ完了: FB ページ「御朱印さんぽ」（Page ID `1301682473018397`）、Instagram `goshuinsampo`（ビジネスアカウント化済み）、FB⇔IG 連携、Meta developer アプリ `goshuin-sampo-watcher`（App ID `1559445438958824`）。IG User ID = `17841439672371375`
- ✅ 長期アクセストークン発行済み（**期限: 2026-10-02**）。Supabase secrets に `META_ACCESS_TOKEN` / `META_IG_USER_ID` 登録済み。**10月初旬に更新要**: [アクセストークンデバッガー](https://developers.facebook.com/tools/debug/accesstoken/)にトークンを貼って「デバッグ」→「アクセストークンを延長」→ `npx supabase@latest secrets set META_ACCESS_TOKEN=<延長後トークン> --project-ref tvnozkpxncmnehyomoff`
- ✅ 実装完了・Evaluator PASS 75/75。PR #112 マージ済み（`crawl-spot-sources` に Instagram パス追加、`mode` パラメータで web/instagram を制御）
- ✅ **本番デプロイ済み**。実クロール検証で23アカウント中19件で Claude 抽出成功、2件は個人アカウント判定でスキップ、failed 0件
- ⚠️ **重要な落とし穴（本番投入時に発見・解決済み）**: Meta developer アプリが **Business Portfolio にリンクされていない**と、`business_discovery` が `OAuthException code 200 "API access blocked"` で全滅する。8/3 のセットアップ時点では未リンクでも一時的に動いていたが、8/8 の本番検証時には完全にブロックされていた（Standard Access アプリの猶予期間切れとみられる）。**対処**: Meta for Developers → アプリ設定 → ベーシック → 「ビジネスポートフォリオ」を「御朱印さんぽ」にリンク（Unverified 状態のままで解消する）。今後同様のエラーが出たらまずこれを疑う
- ✅ **実機・DB 両方で確認済み**: 榴岡天満宮（公式サイト更新停止スポット）に Instagram 由来アイテムが表示され、リンクから実際の投稿に遷移できることを確認。浅草神社で web/Instagram 混在表示（文言の個別切り替え）も確認
- ✅ **cron 再登録完了（2026-08-08）**: `crawl-spot-sources-biweekly`（`0 17 * * 1,4` = 火金02:00 JST・web）/ `crawl-spot-sources-instagram`（`30 17 * * 1,4` = 火金02:30 JST・instagram）の2ジョブ体制で稼働中。**次回火曜(8/11)朝に両方 succeeded か確認**: `select jobname, status, start_time, end_time from cron.job_run_details order by start_time desc limit 10;`
- 📌 **カバレッジの現状**: 全1,109スポット中、巡回対象は**29スポット・79ソース**（東京・宮城・京都の rank5 全29件。official 40 / sns_link 39）。**対象スポット自体に漏れは無い**（rank5 29件は全件登録済み）

## Instagram 情報ソース棚卸し — 完了（2026-08-08）

ユーザーが金蛇水神社（Instagram 運用中なのにアプリに出ない）から気づいて着手。詳細は `docs/project/instagram-source-inventory-2026-08.md`。

- 調査済み: 対象29スポット中 **7件が Instagram(`sns_link`) 未登録**と判明（official は全件あり、rank5 の選定漏れではなく sns_link の欠落）
- ✅ **金蛇水神社・大崎八幡宮・湯島天満宮の3件を追加・本実行・実機確認まで完了**。CLI (`projects api-keys --reveal`) が既知バグで service_role キーを取得できなかったため、Claude in Chrome でログイン済み Supabase ダッシュボードの SQL Editor を直接操作して INSERT を実行（ユーザー承認済み）。dry_run → spot_id 指定の個別確認 → 本実行の順で検証
  - 湯島天満宮: 3件抽出 / 金蛇水神社: 7件抽出 / 大崎八幡宮: 0件（ビジネスアカウント認識・クロール成功、該当投稿が現状ないだけで異常ではない）
  - 全体バッチの `skipped_not_business:2` は既知の別アカウント（以前から個人アカウント判定済み）。追加した3件は個別確認で全て `skipped_not_business:0` を確認済み
- ❌ **明治神宮（`@meijijingu_sukeikai`）は見送り確定**（ユーザー判断）。理由: 本体公式サイトからの直接リンクなし、崇敬会は明治神宮本体ではなく関連団体、「公式情報」としての信頼性が不明瞭。本体が別の公式Instagramを開設 or 公式サイトにリンクが追加された場合に再検討
- ❌ **志波彦神社・鹽竈神社 / 烏森神社 / 東寺は Instagram 未運用と判断**（対象外）
- 📌 恒久的な論点（未着手・要プロダクト判断）: 巡回対象を rank4 以下や他都道府県に拡大するかどうかは今回のスコープ外
- メモ: deno を `~/.deno/bin/deno` にインストール済み（H 群テストの自動検証用）。Evaluator/Planner の goshuin-\_ エージェント型はセッションに未登録のことがある → general-purpose に `.claude/agents/*.md` を読ませて代行させる
- メモ: Claude in Chrome は facebook.com / instagram.com / accountscenter.instagram.com / developers.facebook.com / appstoreconnect.apple.com を許可済み。クロスドメインに遷移するポップアップは拡張の追跡が切れるので、ポップアップ内は素早く1操作ずつ・親タブは触らず待つ。Apple/Meta のログインセッションは時々切れるので、切れたらユーザーに再ログインを頼む

## Issue #116 めくり UI — develop マージ済み・実機未確認（2026-08-09）

契約書 `docs/issues/issue-116-goshuincho-flip-ui.md`（受入基準95項目）。PR #117。12コミット。

- 御朱印タブに「めくり / グリッド」の切り替えを追加。既定はめくり。選択は `AsyncStorage`（`gallery_view_mode`）に永続化
- **右綴じ**: 1ページ目（最も古い御朱印）が右端、新しいページほど左。`FlatList` の `inverted` で表現した。配列を逆順にする実装だと、ページ番号の算出とデータが後から増えたときの起点が両方ずれる
- **蛇腹の折り**: ページ間の余白を 0 にして折り目で接するようにし、スクロール量に連動して折り角（`rotateY`）と影を連続的に動かす。折れて縮む分（`(w/2)(1-cosθ)`）を平行移動で詰めないと隙間が空いて地続きに見えない（`computeFoldShift`）。中央が手前に来るよう距離で `zIndex` を決めないと隣が中央に被る。**RN 標準の `Animated` のみ**（reanimated 等は未導入のまま）
- 調整用の定数: `FOLD_ANGLE_DEG=48` / `FOLD_SHADE_OPACITY=0.16` / `PERSPECTIVE=900` / `PAGE_WIDTH_RATIO=0.68`
- 白紙ページ（末尾＝一番左）をタップすると記録画面へ。0件でも白紙だけは出る
- 帳面（`goshuincho`）一覧はスコープ外。**既存 stamps が全件 `goshuincho_id = null`** で、記録フロー改修 + backfill migration が別途要るため
- ⚠️ **`fireEvent.scroll` は `onScroll` にしか届かない**。`onMomentumScrollEnd` は `fireEvent(list, 'momentumScrollEnd', {...})` で発火し、`layoutMeasurement` / `contentSize` も渡さないと `VirtualizedList` が TypeError で落ちる
- ⚠️ **RN Web は data URI の読み込みに失敗しても無言**（背景を当てないだけ）。`data:image/svg+xml;utf8,` はメディアタイプのパラメータが不正で読めない。`data:image/svg+xml,${encodeURIComponent(svg)}` が正
- ⚠️ **`inverted` と組み合わせると平行移動も回転も向きが反転する**。符号は実際にブラウザで見て決めた

## Issue #114 ボトムシート改善 — 完了（PR #115 マージ済み・2026-08-09）

契約書 `docs/issues/issue-114-bottom-sheet-redesign.md`（受入基準94項目）。15コミット。

- 全9スライスを TDD で実装。`SpotSheetHeader` / `SpotThumbnailStrip` / `SpotSheetActions` を新設し、`SpotCompactCard` を削除。compact/expanded を「共通ヘッダー + 段階的な情報追加」の構造に変更
- 機械検証: **テスト 910件 / 81 suite 全パス**、lint 0 errors、typecheck clean
- Evaluator 1回目: 80/94 で FAIL。**W-3 で本物のバグを検出**
- ⚠️ **W-3 の教訓（重要）**: compact のアクション行がタブバーの裏に潜り込み、「記録する」の中心をタップするとタブバーに吸われていた。原因は `SpotBottomSheet` がシートの位置を `Dimensions.get('window').height` 基準で計算していたこと。**シートの親はタブバーを除いた領域**なので、その差分だけ下にずれる。`BottomTabBarHeightContext` から実タブバー高さを取り `availableHeight` 基準に変更して解消。**この位置計算は旧実装から同じで、compact の最下部に押せる要素が無かったため誰も気づいていなかった**。今後シート下端に操作要素を足すときは必ずこの重なりを疑うこと
- ✅ **実機でタブバー重なりの解消をユーザーが確認済み**（Evaluator は native 系10項目を検証手段が無く SKIP していたため、この確認が最重要だった）
- ✅ **人間ゲートで6点を提示して承認済み**（2026-08-09）。契約書に明記済みだったもの: ①ハンドルのタップで展開/収納 ②web スタブへの命令的 API 追加（検証イネーブラ）③`SpotCompactCard` の削除 ④行きたいアイコンの語彙変更（`flag`→`bookmark`）と CollectionScreen への波及。契約書と食い違ったもの: ⑤FAB 右下移動と設計ドキュメントの相乗り（`MapScreen.tsx` が「変更しないファイル」のため Q-6 が FAIL。**ユーザー判断で PR は分けず、意図的な逸脱として PR 本文に記録**）⑥`expandedHeight` の基準を `SCREEN_HEIGHT`→`availableHeight` に変更（契約書 §464 は「変更しない」と明記していたが W-3 修正の必然的な帰結。スナップ判定の閾値は無変更）
- 📌 **ゲート運用の教訓**: 引き継ぎに「契約書に無い追加」として並べた6点のうち4点は実は契約書に明記済みだった。**「Issue 本文に無い」と「契約書と食い違う」は別物**で、混ぜると本当の逸脱（⑤⑥）が埋もれる。次回から2段に分けて提示すること
- 📌 契約書が前提にしていた `toHaveStyle` はこのプロジェクトに未導入（`@testing-library/jest-native` が無い）。`StyleSheet.flatten(node.props.style)` で代替した

## 画面構成（IA）の決定 — 案3 で確定（2026-08-09）

監査を受けてユーザーと詰めた結果。モック: `docs/design/mockups/ia-options.html`（Artifact: https://claude.ai/code/artifact/206e1b9e-74e1-43e9-9731-33bd51765c9f ）

- ✅ **タブ構成は案3「御朱印帳を主役に」で決定**: `地図 / 御朱印帳 / あつめる / 自分`
  - 地図 = これから行く場所（**行きたいリストをここへ移す**）／御朱印帳 = 集めたもの（P1-03 のめくり UI）／あつめる = バッジ・巡礼チャレンジ・地域別／自分 = アカウント・公開設定・位置情報・アプリ情報
- ✅ **めくり UI の形**: 「**1枚を大きく表示し、左右に隣のページが覗く**」形（＝2枚並べる見開きは1枚が細長くなるため却下）。覗いている両端が蛇腹の折り目。横スワイプで送る。**めくっていって白紙のページに来たら、そこが記録ボタン**になる
- ✅ **グリッド表示との切り替えボタンを併設**。選んだ表示は**裏側で永続化**（保存ボタンは出さない）。`AsyncStorage` は導入済みで `useOnboarding` / `useSearchHistory` に既存パターンあり、踏襲するだけ
- ✅ **記録先の御朱印帳のルール**: 御朱印帳タブの白紙ページから記録 → **いま開いている御朱印帳**へ。FAB / ボトムシートの「記録する」から記録 → **フローの中で御朱印帳を選ぶ**
- ✅ **FAB を右下へ移動（`766feb9`・PR #115 でマージ済み）**: `MapScreen.tsx` の `fabContainer` を `alignSelf:'center'` → `right:20`。**タブ構成とは独立した判断**として先行対応した
- 📌 `goshuincho` テーブル（帳面名・表紙画像・使い始め日）は既に DB にあり、サインアップ時にデフォルト1冊まで作られている。**UI が無いだけ**なので P1-03 の着手コストは見た目より低い
- 🔜 **着手順（ユーザー合意）**: ①**ボトムシートの改善を先に**（案1〜3どれでも共通で手戻りが出ないため）→ ②その後 P1-03（めくり UI）→ ③完成をもってタブ入れ替え

## UI/UX 監査 — 完了（2026-08-08）

ユーザーが実機を一通り操作して気になった点を挙げ、それを起点に現状実装を横断調査した。結果は **`docs/design/ux-audit-2026-08.md`**（ユーザー指摘14件の検証 + 追加論点9件 + 画面構成3案 + 決定待ち7件）。

- ユーザーの関心は「必要な機能は今のままでよく、**それをどう見せるか・どう使わせるか**を見直したい」。画面構成（現行4タブ）自体を変えることも視野に入れている
- **優先順位は未決定**。監査は出したが、どこから着手するかはユーザーと相談してから
- 特に効きそうな発見: ①コアバリュー「3タップで記録完了」が実際は5〜6タップ ②記録の入口が地図のみで御朱印/コレクションタブから入れない ③ログイン済み0件の空状態だけ CTA ボタンが無い（ゲスト側にはある）④`goshuincho` テーブルが未使用のまま存在＝P1-03 の着手コストが見た目より低い可能性 ⑤エラー握り潰しが全体の作法になっており通信失敗と0件が区別できない
- 実機で判明したバグ2件（**カメラ起動しない** / **アップロードエラー**）は監査 A-1・A-4 に記載。どちらも実機での再現・切り分けが要る。アップロードは先に「エラー原文を出す」だけ入れると進む
- ⚠️ ピンの色や形を変える案（監査 A-9）は Issue #099 のマーカー churn クラッシュ知見に直結。着手前に `docs/issues/issue-099-map-clustering.md` 追補1〜4 を必ず読むこと
- Stitch（`stitch.withgoogle.com`）は Claude in Chrome の許可ドメイン未登録のため現状こちらから開けない。モックはドメイン追加か、こちらで HTML/Artifact を作るかの二択

## App Store 審査対応（2026-08-08）

- ✅ **v1.0.0 buildNumber 11 が Guideline 5.1.1（プライバシー）で却下**（2026-08-06）。原因: `expo-camera` / `expo-image-picker` の config plugin がデフォルトでマイク権限のプレースホルダー文言 `NSMicrophoneUsageDescription` を自動追加していた（コード上はマイクを一切使っていない。写真撮影は `expo-image-picker` の `launchCameraAsync` のみ）
- ✅ **修正済み・PR #113 マージ済み**: `app.json` の両プラグインに `microphonePermission: false` を指定してマイク権限自体を削除（iOS: `NSMicrophoneUsageDescription` 削除 / Android: `RECORD_AUDIO` 削除）。カメラ・フォトライブラリの権限文言は元々具体的な日本語だったため無変更
- ✅ **buildNumber 12 をビルド・submit・審査へ再提出済み（2026-08-08）**。最大48時間で結果通知
- **submit の手順メモ**: `eas submit --non-interactive` は ASC API Key の初回設定ができないため、`eas.json` の `submit.production.ios` に一時的に `ascApiKeyPath` / `ascApiKeyId` / `ascApiKeyIssuerId` を追記して実行し、**完了後に必ず `git checkout eas.json` で戻す**（コミットしない）。値は **`~/.appstoreconnect/README.md`** にまとめてある（2026-08-11 に整備）。⚠️ **`ascApiKeyPath` は `~` が展開されないので絶対パスで書くこと**。Issuer ID は**リポジトリには置かない方針**（.p8 と組み合わさると submit 権限そのものになる）
- **却下後の再提出フロー**: 配信タブ → 却下された提出物ページ → 右上「審査内容を更新」→ ダイアログで「提出」→ 提出物詳細ページでビルド行にホバーすると出る削除アイコンで**古いビルドを外す** → 「ビルドを追加」で新ビルドを選択 → 「保存」→「審査用に追加」→ 右パネル「審査へ提出」

`/clear` 後の文脈復元用。読み終えたら「次のアクション」から再開する。方針の唯一のソースは `docs/product/direction.md`。

## いま何をしているか（全体像）

御朱印アプリ（Expo + Supabase）の **Phase 0（iOS 先行リリース）が完了間近**。**v1.0.0 は App Store に提出済みで審査待ち**。ここからは Phase 1（記録体験の磨き込み）と、差別化の本丸である限定御朱印情報の機能に着手するフェーズ。開発は `/build-feature` の自律ループ（契約書 → TDD → 機械検証 → goshuin-evaluator → 人間ゲート → PR）で回す。**人間ゲートは push/PR 直前の1箇所のみ**。

## リリース状況（2026-08-08 時点）

- **アプリ名: 御朱印さんぽ**（「御朱印コレクション」→「御朱印マップ」と変遷。マップは App Store で登録済みだったため。45競合を調査して決定）
- **iOS: 審査中（2回目）**。v1.0.0 / **buildNumber 12** / ascAppId `6797201465` / Apple Team `292ZWTG3UD`。1回目（buildNumber 11）は Guideline 5.1.1 で却下 → マイク権限修正（PR #113）→ 再提出済み。結果は最大48時間後
  - 掲載情報・スクショ6枚・プライバシー申告まで入力完了
  - ASC API Key は **`~/.appstoreconnect/AuthKey_D9CP6Y4YA3.p8`**（権限 600 / フォルダ 700。同フォルダの `README.md` に Key ID・Issuer ID・submit 手順あり）。**Apple から再ダウンロードできない**ので、失うとキーを失効させて作り直すことになる。`~/Downloads` にも同じものが残っているが、そちらは掃除で消える前提で扱う
  - `eas.json` の submit プロファイルに ascAppId / appleTeamId 設定済み。`ascApiKeyPath` 等は個人パスのためコミットしていない（submit 時に一時的に足す。手順は上記「App Store 審査対応」参照）
- **Android: 未着手・優先度を下げた（2026-08-11 ユーザー判断）**。まず iOS のリリースを通すことに集中する。Google Play の本人確認が審査中 + Android 実機での Play Console ログインが未完了
- **main ブランチ**: develop をマージ済み（PR #101）。GitHub Pages の法務ページも「御朱印さんぽ」に更新済み

## これまでの経緯（2026-08-02、時系列）

1. プロダクト方針 v2 決定: リリース先行 / 差別化4軸の段階導入 / ハイブリッド収益化（direction.md）
2. **PR #91**: 開発ハーネス刷新（/build-feature、planner/evaluator 2体制、Maestro スキャフォールド）
3. **PR #92**: マスタデータ（宮城 DB 同期 + 東京増強99件）→ **DB 適用済み。全1,109件・東京119件**
4. **PR #94**（Issue #93）: 地図即修正（1,000行フェッチ上限 / visited・wishlist ピン消失 / ズーム境界チラつき）
5. **PR #95**: iOS ビルドの AppCheckCore エラー修正（expo-build-properties, useFrameworks: static）。**これが無いと iOS production ビルドは失敗する**
6. **PR #97**（Issue #96 / P1-05）: 地図をビューポート×rank優先 top-N 方式に再設計
7. **PR #98**: 巡礼データ（6コース+札所75件）の DB エクスポート
8. **PR #100**（Issue #99 / P1-06）: クラスタリング導入。実機クラッシュを4イテレーションで追い込み、最終的に `minZoomLevel=8` で封じ込め（全経緯は契約書 `docs/issues/issue-099-map-clustering.md` 追補1〜4）
9. **PR #101**: develop → main のリリースマージ。v1.0.0 を App Store Connect へ提出
10. **PR #103**（Issue #102 / P1-08）: 初回体験の改善。タブ遷移ブロック撤廃 + 御朱印/コレクションのゲスト空状態 + 検索の未入力時提案（近隣/人気）。Evaluator PASS 47/47・実機確認済み
11. **PR #105〜#110**（Issue #104 / P2-01）: 限定御朱印ウォッチャー MVP を**運用投入まで完了**（passes: true・実機確認済み）。spot_info_sources + crawl-spot-sources Edge Function（hash 差分検知 → Haiku 4.5 構造化）+ LimitedGoshuinSection。seed 29スポット79ソース（#106）、授与品混入→isLikelyGoshuin ガード（#108）、過去告知混入→日付注入プロンプト（#109）+ 頒布中(開始のみ記載)の誤除外対策（#110）。cron 週2回（火金02:00 JST）稼働中

## このセッションでの重要な発見

1. **本番ビルドが起動時クラッシュしていた**（出荷寸前で発見）。`EXPO_PUBLIC_*` をブラケット記法・変数経由で読んでおり、babel-preset-expo のインライン化が効かず本番で undefined になっていた。Metro 経由の開発では動くため気づきにくい。`src/services/__tests__/envAccess.test.ts` で再発防止済み
2. **EAS に環境変数が未登録だった**。`eas env:create` で production/preview に8件登録済み
3. **地図の全国スケールクラッシュは Apple Maps のタイルメモリ起因**とみられ、アプリコード側（マーカー churn・スナップショット機構・無限アニメリーク）は追補1〜3で潰し切った。解禁は P1-07

## 次のアクション（2026-08-09 時点）

1. ~~P1-08 初回体験の改善~~ — **完了**（Issue #102 / PR #103）
2. ~~P2-02 限定御朱印ウォッチャー v2（Instagram 第1柱）~~ — **完了・運用投入済み**（Issue #111 / PR #112、2026-08-08）
3. ~~cron 再登録~~ — **完了**（2026-08-08。次回火曜(8/11)朝に succeeded 確認予定）
4. ~~Instagram 情報ソース棚卸し~~ — **完了**（金蛇水神社・大崎八幡宮・湯島天満宮を追加・本実行・実機確認済み。明治神宮は見送り確定）
5. ~~P1-09 ボトムシートの情報設計改善~~ — **完了**（Issue #114 / PR #115、2026-08-09）
6. ~~A-4 アップロードエラー~~ — **完了**（Issue #118 / PR #119、実機確認済み・passes: true）
7. ~~Issue #116（P1-03 めくり UI）の実機確認 N 群8項目~~ — **完了**（2026-08-09・passes: true）
   7.5. ~~監査 A-1 カメラが起動しない~~ — **完了**（PR #121・実機確認済み）／~~CI-1 の 404~~ — **完了**（PR #122）
   7.6. **← いまここ: タブ入れ替え（案3: 地図 / 御朱印帳 / あつめる / 自分）**。P1-03 完了でブロッカーが外れた。規模 L・契約書から
8. **審査結果待ち**（buildNumber 12、最大48時間）。通過 → 手動リリース / リジェクト → 内容確認して対応
9. （7.6 に前倒し）タブ入れ替えの詳細: 行きたいリストを地図タブへ移す。決定の経緯は下記「画面構成（IA）の決定」
10. その他の候補（優先順は未合意・要相談）:
    - **P2-02 第2柱**: 公式サイトの記事単位クロール
    - **対象スポットの拡大**: rank4 以下や他都道府県への拡大（今回は既存29スポット内の欠落補完のみでスコープ外とした）
11. ~~Google Play~~ — **iOS 優先のため保留**（2026-08-11 ユーザー判断）

## ユーザー待ちの項目

- **実機でのスクショ3枚**（コレクション / 御朱印ギャラリー / 記録画面）— ログイン済み実データが必要。撮影 → AirDrop → こちらで 1284×2778 に変換して差し替え
- ~~**Google Play**: 本人確認（審査中）/ Android 実機での Play Console ログイン~~ → **iOS 優先のため保留**
- **App Store Connect の操作代行**: Claude in Chrome 拡張は接続できるが、拡張が入っている Chrome プロファイルが Apple 未ログイン。一度ログインしてもらえれば以降の操作を代行可能（パスワード・2FA 入力は必ずユーザー本人が行う）

## 環境・成果物の場所

- **スクショ**: `goshuin-app-artifacts/screenshots-ios-6.7/`（1290×2796）と `screenshots-ios-6.5/`（1284×2778、アップロード済み）
- **ビルド成果物**: `goshuin-app-artifacts/`（Android .aab v1.0.0/vc2 / iOS シミュレータ用 tar.gz）
- **開発環境**: Xcode 26.6 / iOS 26.5 シミュレータ（`goshuin-shot` = iPhone 16 Plus, UDID `325F0C9C-7C83-4B66-8BF9-33C2BE7053BD`）/ Maestro 2.8.0（`~/.maestro/bin/maestro`）
- **スクショ撮影**: `xcrun simctl location <udid> set 35.7148,139.7967`（浅草）→ `maestro test e2e/flows/store-screenshots.yaml`。**位置設定を忘れると緯度経度0の海になる**
- **dev サーバー**: tmux セッション `goshuin-dev`（`/dev` で再起動）
- **Supabase**: 読み取りは `.env` の anon キーで REST 直叩き（1リクエスト最大1,000行）。**書き込みはユーザーがプライベート Chrome の SQL Editor で実行する運用**
- **EAS**: ログイン済み。`--non-interactive --no-wait` で投げて `build:list --json` で状態確認（`build:view` は JSON が壊れることがある）

## 限定御朱印ウォッチャーの運用メモ（P2-01 で確立、2026-08-02）

- **Supabase CLI は必ず `npx supabase@latest`**（素の `npx supabase` は古い v2.20 を解決して config.toml の `[project]` を読めない）。デプロイは Docker レート制限を避けて `--use-api` を付ける: `npx supabase@latest functions deploy crawl-spot-sources --project-ref tvnozkpxncmnehyomoff --use-api --no-verify-jwt`
- **verify_jwt は必ず false**（config.toml に明記済み）。このプロジェクトは新 API キー体系で、関数環境の `SUPABASE_SERVICE_ROLE_KEY` は `sb_secret_...`。JWT 検証が有効だと sb_secret はゲートウェイで弾かれ、legacy JWT は関数内ガードで弾かれる詰みになる
- **関数の認可**: `Authorization: Bearer <sb_secret キー>`。キーは `npx supabase@latest projects api-keys --project-ref tvnozkpxncmnehyomoff --reveal` で取得（**--reveal 必須**。無いと伏せ字が返り Invalid API key になる）。Vault には `service_role_key` の名前で sb_secret を保存済み（cron が参照）
- **強制再抽出**: `spot_info_sources.content_hash` を null に PATCH → 関数を `{"spot_id": "..."}` 付きで叩く（hash 一致だと Claude を呼ばずスキップされるため）
- **既知の問題**: 平安神宮は先方の SSL 中間証明書チェーン不備で fetch が常に失敗（毎回 failed 1 は正常）。榴岡天満宮は公式サイトの御朱印告知が2022年で停止しており Instagram のみ（P2-02 の動機）
- **抽出品質の防衛線**: ①isLikelyGoshuin ガード（name+description に朱印/集印必須、朱印帳/挟み紙除外）②プロンプトに今日の日付を注入して過去告知を除外、頒布中(開始のみ記載・通年)は含める。プロンプト変更時は必ず「八坂神社(授与品一覧)」「榴岡(古い告知)」「護國神社(通年切り絵)」で回帰確認する
- **cron 実行履歴**: `select * from cron.job_run_details order by start_time desc limit 5;`（SQL Editor）

## ⚠️ `supabase db push` を使ってはいけない（2026-08-11 発見）

`npx supabase@latest migration list --linked` を取ったところ、**ローカルの `supabase/migrations/` と本番の migration 履歴が大きく乖離**していた。

- **ローカルにあるが本番に未記録**: `20260331000000`（wishlists）/ `20260401000000` / `20260402000000` / `20260402000001` / `20260402100000` / `20260402110000` / `20260403000000` / `20260802000000`（spot_info_sources）/ `20260809000000`（goshuin-images バケット）
- **本番にあるがローカルに無い**: `20260331151025` / `20260401014636` / `20260401044605` / `20260401065345` / `20260401065354` / `20260402063657` / `20260402071325` / `20260402175907`

原因は、これらのスキーマ変更が**ダッシュボードの SQL Editor で直接適用され、あとから migrations ファイルとして写経された**ため（`20260809000000_create_goshuin_images_bucket.sql` の冒頭コメントにその経緯が書かれている）。

**したがって `supabase db push` を打つと、既に適用済みの migration 9本を流し直そうとする。** テーブルの CREATE が衝突して落ちるか、最悪の場合は意図しない変更が入る。**個別の migration を流すときは `db query` を使うこと**:

```
npx supabase@latest link --project-ref tvnozkpxncmnehyomoff --yes   # 未リンクなら先に
npx supabase@latest db query --linked -f supabase/migrations/<file>.sql
```

読み取りだけなら `db query --linked "<SQL>"` がそのまま使える（Management API 経由なので DB パスワード不要）。**ただし書き込み系は Claude Code の権限レイヤーに止められる**ので、ユーザーの承認か SQL Editor での実行が要る。

流したあとは `migration repair` で履歴にも記録すること（やらないと「保留中」に見えて乖離を1本増やす）:

```
npx supabase@latest migration repair --status applied <version> --linked
```

既存の乖離分をまとめて揃えるのも同じコマンドでできるが、**未着手**。やるなら1本ずつ実体を確認してから。

## 参照ファイル

- 方針・Phase 0 チェックリスト: `docs/product/direction.md`
- 契約書: `docs/issues/issue-099-map-clustering.md`（追補1〜4 が最も学びが多い）/ `issue-096-map-viewport-topn.md` / `issue-093-map-spot-display-fixes.md`
- ストア関連: `docs/project/store-metadata.md`（掲載情報の確定値）/ `store-account-setup.md` / `release-guide.md`
- ハーネス状態: `.claude/harness/feature-list.json` / `progress.md`
