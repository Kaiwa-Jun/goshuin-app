# Stitchデザインデータ

## 概要

UIデザインは [Stitch](https://stitch.withgoogle.com/) で作成しています。デザインデータはStitch MCPを使用して参照・取り込みます。

## Stitch プロジェクト情報

- **プロジェクトID**: `9044469756277541238`
- **テーマ**: カスタムカラー `#f27f0d`、フォント Plus Jakarta Sans、角丸フル、彩度3

## デザインデータの役割分担

| 場所                         | 内容                                                   |
| ---------------------------- | ------------------------------------------------------ |
| Stitch（スクリーンショット） | デザインの正（視覚的なリファレンス）                   |
| Stitch（HTMLコード）         | 細かいスタイル値の確認用（補助）                       |
| `docs/design/ui-design.md`   | 画面仕様・遷移フロー・UX設計意図                       |
| `src/theme/`                 | テーマシステム（colors, typography, spacing, shadows） |
| `src/` (実装コード側)        | React Native コンポーネント・スタイル                  |

## デザイン参照方法

### 優先順位

1. **スクリーンショット画像**（メイン） — コンテキスト効率が良く、視覚的に忠実（~1,500トークン/画面）
2. **HTMLコード**（補助） — 微妙な色・余白・グラデーション値の確認用（~3,000トークン/画面）
3. **ui-design.md**（仕様） — 画面遷移・UX設計意図の参照用

### Stitch MCP コマンド

```
# 全画面のスクリーンショットURL一覧を取得
mcp__stitch__list_screens(projectId: "9044469756277541238")

# 特定画面の詳細（HTMLコード含む）を取得
mcp__stitch__get_screen(
  name: "projects/9044469756277541238/screens/{screenId}",
  projectId: "9044469756277541238",
  screenId: "{screenId}"
)
```

## 画面一覧（Stitch上の画面ID）

| 画面名                              | Screen ID                          | 用途                   |
| ----------------------------------- | ---------------------------------- | ---------------------- |
| Login Screen                        | `9ae17a9345344b47b489d33bc8179780` | ログイン               |
| Main Map Dashboard                  | `a48bd54ba1c14bb584878a5f93b48ace` | 地図画面               |
| Spot Details - Shrine               | `3a0d6ffba7ed4a468f0638d0f8d66353` | スポット詳細           |
| Record New Goshuin                  | `6dc8e708ccd143aa9e272c22d0321fdd` | 御朱印記録             |
| Registration Success - Badge Earned | `e7caf2651ec64fdbbb3b537133e1e57b` | 登録完了（バッジ獲得） |
| Goshuin Gallery Grid                | `f94362257c2c4959b6d7f68f36d26cd3` | ギャラリー             |
| Collection & Achievements           | `0399a0fc1ca642b58870ef860decbeb1` | コレクション           |
| App Settings                        | `63735f12b2ad4b8caf0462106786ea92` | 設定                   |
| Location Access Error               | `38549fb7a7af4998a5769c8634fa78fe` | 位置情報エラー         |

※ hidden状態の画面（バリアント・旧バージョン）は省略

## 開発フローでの使い方

### Phase 1.5 デザイン取得

1. `list_screens` で対象画面のスクリーンショットURLを取得
2. 設計ドキュメント（`docs/issues/issue-XXX-*.md`）にスクリーンショットURLを記載
3. 細かいスタイル値が必要な場合のみ `get_screen` でHTMLコードも取得

### Phase 2 実装時（ui-implementer への指示）

- タスク指示にスクリーンショットURLを含める
- 「このスクリーンショットに合わせてUIを実装」と明示
- HTMLコードが必要な場合はダウンロードURLも添付

### Phase 3 検証時

- Chrome DevTools MCP で実装画面のスクリーンショットを取得
- Stitch のスクリーンショットと並べて差分を確認

## 実装時の注意事項

- HTMLコードは Tailwind CSS ベース → React Native StyleSheet に変換する（直接コピーしない）
- テーマシステム（`src/theme/`）の値を使って色・余白を指定する
- Rive対応予定のコンポーネント（登録完了演出、バッジ、FABボタン等）は、独立したコンポーネントとして切り出す
- Expo プロジェクトの技術スタック（React Native + TypeScript）に適合させる

---

## 2026-09: SDK 経由でデザインを起こす（現行の手順）

「あゆみを地図にする」以降の提案（UX メモ `HdRsemF7phLZVYPG1CjNu6`）を実装する前に、Stitch で画面の実物を作って合意を取るための手順。

### MCP ではなく SDK を使う

`.mcp.json` に Stitch の HTTP MCP を置いてあるが、**セッションに読み込まれていないと `mcp__stitch__*` が生えない**（追加直後は Claude Code の再起動 + `/mcp` での承認が要る）。
その間は **`@google/stitch-sdk` が同じ API を叩く**ので、こちらで進められる。`STITCH_API_KEY` は `~/.zshrc` に設定済み。

```bash
mkdir -p /tmp/stitch && cd /tmp/stitch && npm i @google/stitch-sdk
# gen.mjs（下記）を置いて実行
node gen.mjs <プロンプトの .md へのフルパス>
```

```js
// gen.mjs
import { stitch } from '@google/stitch-sdk';
import { readFileSync, writeFileSync } from 'node:fs';
const PROJECT = '9044469756277541238';
const DS = 'assets/13553185452205907849'; // 下記の design system
const prompt = readFileSync(process.argv[2], 'utf8');
const res = await stitch.callTool('generate_screen_from_text', {
  projectId: PROJECT,
  prompt,
  deviceType: 'MOBILE',
  designSystem: DS,
});
const s = res.outputComponents.flatMap(c => c.design?.screens ?? [])[0];
console.log(s.id, s.title);
writeFileSync('out.html', await (await fetch(s.htmlCode.downloadUrl)).text());
```

### 落とし穴（実地で踏んだもの）

| 症状                                            | 原因・対処                                                                                                                                                                                                  |
| ----------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `generate_screen_from_text` が invalid argument | **`modelId` を渡すと落ちる**（`GEMINI_3_1_PRO` でも）。**modelId は省く**。既定モデルで通る                                                                                                                 |
| `project.getScreen(id)` が invalid argument     | SDK のこのメソッドは通らない。`project.screens()` を取って `find` する                                                                                                                                      |
| 生成した画面が `screens()` に出てこない         | 反映が遅れる。**生成レスポンスの `outputComponents[].design.screens[]` から id と URL を拾う**                                                                                                              |
| `screenshot.downloadUrl` が粗い                 | 512px のサムネイル。**`htmlCode.downloadUrl` を落として `python3 -m http.server` + Playwright（幅400）で撮る**方が読める                                                                                    |
| 試し打ちのゴミ画面が溜まる                      | **`generate_screen_from_text` は呼ぶたびに画面が残る**（引数の検証だけのつもりでも）。**delete のツールは MCP にも SDK にも無い**ので、消すには Stitch の UI を開くしかない。捨てるつもりの呼び出しをしない |

### design system

`assets/13553185452205907849` —「御朱印さんぽ 2026-09（実装トークン準拠）」

| 項目        | 値                                                                                                                          |
| ----------- | --------------------------------------------------------------------------------------------------------------------------- |
| 元ネタ      | **`docs/design/DESIGN.md`** を `theme.designMd` にそのまま流し込んでいる                                                    |
| customColor | `#f27f0d`（`colorVariant: FIDELITY` で種の色を保つ）                                                                        |
| フォント    | `NOTO_SANS`（**enum に日本語対応フォントが Noto しかない**。Plus Jakarta Sans は CJK グリフを持たないので旧テーマから変更） |
| 角丸        | `ROUND_TWELVE`（実装のカードが 12〜16。旧テーマの「角丸フル」は pill になりすぎ）                                           |

旧 design system「Amber Meridian」は既存9画面が参照しているので**更新せず、新規に作った**。

### プロンプト

`docs/design/stitch-prompts/` に1画面1ファイルで置く。中身は「アプリの説明 → いまの実装 → 作ってほしい画面 → スタイル（実 hex）」の順。

| ファイル                | 画面               | 状態                                                 |
| ----------------------- | ------------------ | ---------------------------------------------------- |
| `01-ayumi-map.md`       | あゆみ（地図化）   | 生成済み → screen `07c053a651704b8995a148a9adf64583` |
| `02-record-complete.md` | 登録完了の作り込み | 未生成                                               |
| `04-tsukimairi.md`      | 月参り・満願       | 未生成                                               |

生成結果は `docs/design/mockups/2026-09-*.{png,html}` に置く。

### 書くときのコツ

- **「日本地図」とだけ書くと地理的な輪郭を描こうとして崩れる**。「47都道府県を正方形タイルのグリッドに並べたカルトグラム」と書く
- 色は必ず hex で書く。トークン名（primary[500] 等）は伝わらない
- 「UIの文字はすべて日本語です」を先頭に書く
- **地図の「形」は Stitch で詰めない**。「47都道府県のグリッド」と書いても Stitch は日本列島の配置を作れない（階段状になる）。**どのマスがどの県かの表は実装側の仕様**（UX メモの `grid-area` の並びがそのまま使える）。Stitch に見てもらうのは器（カード・余白・密度・凡例）の方
- **旧 Stitch 画面は IA が古い**（タブが「コレクション」・中央に FAB のある5タブ）。プロンプトで現行の4タブを明示し、`edit_screens` ではなく新規生成する
