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
