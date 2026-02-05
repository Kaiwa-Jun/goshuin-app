# 御朱印コレクションアプリ - ドキュメント

**コンセプト**: 「集めるたび、地図があなたの旅になる。」

## ディレクトリ構成

```
docs/
├── README.md                  # このファイル
├── product/                   # プロダクト企画関連
│   ├── product-overview.md    # プロダクト概要
│   ├── requirements.md        # 要件定義
│   ├── market-analysis.md     # 競合・市場分析
│   ├── monetization.md        # 収益化
│   └── user-research.md       # ユーザーリサーチ
├── technical/                 # 技術設計関連
│   └── tech-design.md         # 技術スタック・DB設計
├── design/                    # UI/UX設計関連
│   ├── ui-design.md           # UI設計 v6（画面仕様・遷移フロー）
│   └── stitch.md              # Stitchデザインデータの取り込みガイド
├── project/                   # プロジェクト管理
│   └── roadmap.md             # TODO・ロードマップ
└── issues/                    # Issue別詳細設計
    └── README.md              # Issue設計ドキュメントの運用ガイド
```

## ドキュメントステータス

| ドキュメント | ステータス |
|---|---|
| プロダクト概要 | 完了 |
| 要件定義 | 完了 |
| 技術設計 | 完了 |
| 競合・市場分析 | 完了 |
| 収益化 | 完了 |
| UI設計 v6 | 完了 |
| Stitchデザイン | 取り込み予定 |
| ユーザーリサーチ | 未完了（ヒアリング待ち） |
| TODO / ロードマップ | 進行中 |

## Stitchデザインデータについて

UIデザインは [Stitch](https://stitch.withgoogle.com/) で作成しています。

- **設計ドキュメント**: `docs/design/ui-design.md` に画面仕様・遷移フローを記載
- **デザインデータ取り込み**: Stitch MCPを使用して実装コード側（`src/`）に直接取り込む

詳細は [docs/design/stitch.md](./design/stitch.md) を参照してください。

## Issue別詳細設計について

`docs/issues/` ディレクトリには、Issue単位でClaude Codeとやりとりして作成した詳細設計ドキュメントを格納します。

運用フローについては [docs/issues/README.md](./issues/README.md) を参照してください。
