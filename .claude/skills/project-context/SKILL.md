---
name: project-context
description: 御朱印アプリのプロジェクト固有の知識とコンテキスト
---

# プロジェクトコンテキスト

## アプリ概要

- **コンセプト**: 「集めるたび、地図があなたの旅になる。」
- **対象**: 御朱印集めを趣味とするユーザー。「SNSなし・広告なし・高速で美しい記録特化」のポジションを取る
- **コア体験**: 地図上に旅の足跡が残る達成感
- **紙の御朱印の代替（デジタル御朱印）を謳う機能は作らない**（価値観の反発が強い領域）

## プロダクト方針（2026-08 決定 — 詳細は docs/product/direction.md）

- v1.0.0 をリリース先行で出し、実ユーザーの反応を得ながら育てる
- Phase 1: 記録体験の磨き込み → Phase 2: 限定御朱印ウォッチャー + サブスク → Phase 3: 巡礼ルート計画 + 巡礼パック → Phase 4: 英語対応
- 収益化はハイブリッド: コア体験（記録・地図・ギャラリー）は永久無料 / 統計・テーマ等は買い切り / ウォッチャー通知のみ低額サブスク

## 技術スタック

- **モバイル**: Expo (React Native) + TypeScript strict。Expo Go 不可、EAS Development Build 必須
- **バックエンド**: Supabase (Auth / Database / Storage / Edge Functions)
- **地図**: react-native-maps（Web ではスタブに解決）
- **認証**: Google Sign-In + Sign in with Apple + 遅延ログイン方式（未ログインでも地図閲覧可）

## データベース構造（全テーブル RLS 有効）

- `profiles` - ユーザープロフィール
- `spots` - 神社・寺院（type: shrine/temple、rank カラムで有名度ランク）
- `stamps` - 御朱印記録（画像必須、公開設定あり）
- `goshuincho` - 御朱印帳
- `wishlists` - 行きたいリスト
- `pilgrimages` - 巡礼チャレンジ
- `spot_aggregated_info` - AI 抽出のスポット情報（駐車場・受付時間等。Edge Function `extract-spot-info`）

## 重要な設計判断

1. **御朱印画像は必須** - 画像なしは単なるチェックインになるため
2. **検索半径はデフォルト2-3km** - 候補が少なければ自動拡大
3. **登録目標は10秒以内** - シンプルなUXを重視
4. **神社+寺院の両方を対象** - テーブル名は `spots`
5. **状態管理はカスタム hooks + ローカル state のみ** - グローバル状態管理ライブラリを導入しない

## ドキュメント参照

- プロダクト方針: @docs/product/direction.md（roadmap.md / monetization.md を置き換え済み）
- 要件定義: @docs/product/requirements.md
- 技術設計: @docs/technical/tech-design.md
- UI設計: @docs/design/ui-design.md
- リリース手順: @docs/project/release-guide.md
