# Issue #327 evaluator report

## 判定: PASS

- 受入基準: AC-1〜55 55/55 合格（Jest。AC は Jest のテストが通ることと、テストの中身が基準の文に当たっていることで確認）・UI-1〜9 9/9 合格（UI-9 は下の注意つき）・Q-1〜11 11/11 合格
- 機械検証: test OK（2,682 件。並列が重いと 8 件が時間切れ、下記）, lint OK（0 エラー・15 警告）, typecheck OK
- UI検証: OK（Expo Web・京都の位置情報・node の playwright-core）

## 機械検証の詳細

- `npm test` 既定の並列: マシンの load average が 120〜150 のとき 8 件・5 スイートが失敗（MapScreen #311 の FAB、RootNavigator、TabNavigator、GalleryScreen ほか。いずれも時間切れ）。`npx jest --runInBand` で MapScreen・navigation・GalleryScreen だけ流すと 220 件全部通過。`npx jest --maxWorkers=3` で全体を流すと 186 スイート・2,682 件全部通過。負荷による揺れで、コードの不具合ではないと判断
- Q-4 〜 Q-9・Q-11 の grep: 0 行（Q-9 の expect の行は `ここに御朱印を追加する` の 1 件だけ）。Q-6/Q-8 は申し送りの言い換えどおり 0 件
- Q-10: `FirstStampCard`・`SaveMapReveal` の新しい動きは opacity と transform（translateY・scale）だけ。`fill` は動かさず、新しい `Animated.timing` はすべて `useNativeDriver: true`
- Q-11: 変更ファイルは対象表の中だけ（`.agents/` 等なし）。`feature-list.json`・`progress.md` は S8 なのでまだ差分に無い（違反ではない）

## UI 基準

- UI-1 PASS: card left 16・right 377、map-screen.bottom − card.bottom = 16。見出し「参拝したら、写真1枚で\n日本地図に。」、下の行「撮ると、京都府に色が差します」、fab 0。emboss opacity 1（カードが DOM に出て 1560ms 後）。`card-393.png`
- UI-2 PASS: 375・440 とも ボタンの文字の高さ 20、ボタンはカードの内側、見出しの高さ 48。`card-375.png`・`card-440.png`
- UI-3 PASS: rAF で 1 コマずつ測定。400ms までの 24 コマで幅が増えたコマ 0（361 → 160.9、右下へ向かう）。436ms でカードが DOM から消える。fab の right 373・下の余白 20。＋を押すと 13ms でカードが戻り、ログインは出ない。読み込み直すとカードが出る。`fold.webm`・`fold-samples.json`
- UI-4 PASS: 「近くの寺社（5）」・5 行・距離 74m/619m/860m/1.1km/1.3km（昇順・50 以下・書式 OK）。カードと＋は無い。0 行目（八坂神社）を押すと bottom-sheet に八坂神社、カードは無い。`nearby.png`・`spot-sheet.png`
- UI-5 PASS: 「行きたい」でログインが出る。「あとにする」のあと bottom-sheet はそのまま、「この内容で記録する」は出ない。`ui5-login.png`
- UI-6 PASS: ［御朱印を撮る］でログインが出る。「あとにする」のあとカードが残る。`ui6-login.png`
- UI-7 PASS: `?preview=goshuincho` → 御朱印帳タブで「次の1枚を撮る」1 件、「ここに御朱印を追加する」0 件。`goshuincho-1.png`・`ui7-body.txt`
- UI-8 PASS（`reducedMotion: 'reduce'`）: カードの opacity は 1 だけ、top は 605.9 だけ、emboss は 1 だけ（途中のコマ無し）。✕ で幅 361 のまま次のコマで消える（縮むコマ無し）。`reduce-card.png`・`reduce.webm`
- UI-9 PASS（判断つき）: `console.txt`。
  - `collapsable` の non-boolean エラーは各ページ 1 回。8082（develop）でも 1 回出る（base 確認済み）ので新しいエラーではない
  - pageerror `Cannot read properties of undefined (reading 'width')` 6 件は `?preview=goshuincho` のページだけ。8082 の同じ URL でも同じ 6 件（既存）
  - `A component is changing an uncontrolled input to be controlled` が、近くの寺社の行を押して SpotBottomSheet を開いたとき 1 回出る（行きたい・ログイン経路でも）。差分が触っていない SpotBottomSheet 側で、develop では寺社のシートを開く操作ができず（地図がスタブ）8082 と比べていない。#327 の変更が原因かは未確認 → 基準外の所見に書く
  - `useNativeDriver` の警告は除外（基準どおり）
- 動画は Playwright の `recordVideo` が ffmpeg-1013 を要求して使えなかったため、CDP の screencast のコマを ffmpeg で webm にした（`fold.webm`・`reduce.webm`。コマの時刻は `*-frames.json`）。見た目の判断は rAF の測定値（`fold-samples.json`）でも行った

## 申し送りの妥当性

- AC-16（G を PrefectureEmboss の下だけ数える）・AC-21（280+20ms）・AC-23/47（RN の timer 1 つが 50ms で消える）・AC-32（stub）・Q-6・Q-8 の文字の言い換え: いずれも基準の意図（3 層・畳み終わりに onDismiss・unmount 後に自分の timer が残らない・畳んだあとの出し分け・禁止語が残らない）を損なわない。妥当と判断

## Punch list

なし

## スキップした基準

- H-1〜7: native-only でオーナーが実機（対象外）
- AC-3・AC-4 のテストには「AC-n」の札が付いていないが、`firstStamp.test.ts` の「言葉」と `japanMapZoom.test.ts` の「倍率を固定する」が文の通りに確かめている（合格）

## 基準外の所見（合否に含めない）

1. 上の uncontrolled input の警告（SpotBottomSheet を開くとき 1 回。#327 の差分のファイルではない。原因の確認を推奨）
2. 全体テストを既定の並列で流すと、負荷が高いとき MapScreen・RootNavigator・TabNavigator・GalleryScreen が時間切れになる。#327 のテストが重くしているわけではない（`--maxWorkers=3` で全部通過）
3. evidence の再現スクリプトを `scripts/` に置いた（`scripts/ev.js` ほか）。不要なら外してよい

## 証跡

`/Users/kaiwajun/orca/workspaces/goshuin-app/first-stamp-327/.claude/harness/evidence/issue-327/` : card-393.png・card-375.png・card-440.png・nearby.png・spot-sheet.png・ui5-login.png・ui6-login.png・reduce-card.png・goshuincho-1.png・ui7-body.txt・fold.webm・reduce.webm・fold-samples.json・fold-frames.json・reduce-frames.json・console.txt（console-ui\*.txt は元）・scripts/・evaluator-report.md
