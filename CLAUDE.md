# 御朱印コレクションアプリ — Claude Code ガイド

「集めるたび、地図があなたの旅になる。」御朱印の参拝記録を地図に可視化するモバイルアプリ。

- **スタック**: Expo (React Native) + TypeScript (strict) + Supabase (Auth / DB / Storage / Edge Functions)
- **プロダクト方針**: @docs/product/direction.md（2026-08 決定。roadmap.md / monetization.md はこれで置き換え済み）
- **ドキュメント索引**: @docs/README.md

## コマンド

| コマンド                             | 用途                                                              |
| ------------------------------------ | ----------------------------------------------------------------- |
| `npm test` / `npm run test:watch`    | Jest（jest-expo + testing-library）                               |
| `npm run lint` / `npm run typecheck` | ESLint / tsc --noEmit                                             |
| `npm run e2e`                        | Maestro E2E（要: シミュレータ + dev build。`e2e/README.md` 参照） |
| `/dev`                               | Cloudflare Tunnel + Expo Dev Server（実機 iPhone 確認用）         |

## アーキテクチャ

```
src/
├── components/   # 再利用 UI（common / animated / record / spot-detail / search / stamp-detail）
├── screens/      # 全 14 画面
├── hooks/        # データ取得と画面状態（カスタム hooks + ローカル state のみ）
├── services/     # Supabase 連携（auth / stamps / spots / collection / pilgrimages / badges 等）
├── navigation/   # React Navigation v7（RootNavigator / TabNavigator / 各 Stack）
├── theme/        # デザイントークン（colors / spacing / typography / shadows）
├── types/ utils/ constants/
supabase/         # migrations / seeds（全国マスタデータ）/ functions（Edge Functions, Deno）
e2e/              # Maestro フロー
```

- **状態管理はカスタム hooks + ローカル state のみ**。グローバル状態管理ライブラリ（Zustand / Redux / Context）は不使用。新規導入しない
- パスエイリアス: `@/` `@components/` `@screens/` `@hooks/` `@services/` `@theme/` `@utils/`（tsconfig / jest / eslint で一貫設定）
- DB は全テーブル RLS 有効。スキーマ変更は `supabase/migrations/` に追加

## 開発フロー

機能実装は **`/build-feature` スキルの自律ループ**で進める:
契約書（docs/issues/）→ TDD 実装 → 機械検証 → goshuin-evaluator 検証 → **人間ゲート（push/PR 直前の1箇所のみ）** → PR。

- **人間ゲートは push / PR 作成の直前だけ**。それ以外の承認・確認を途中で求めない
- TDD は t-wada 流（`tdd-workflow` スキル）。テストと実装は同じ作業者が書く
- 1スライス = 1コミット。Conventional Commits（feat / fix / docs / style / refactor / test / chore）
- ブランチ: `feature/issue-XXX-<slug>` → develop。main はリリース用
- サブエージェント委譲は「大きな独立したトラック」がある場合のみ（同時最大2）。検証目的の委譲は goshuin-evaluator に限る
- 進捗は `.claude/harness/progress.md` と feature-list に残す。**未検証の機能を完了扱いにしない**

## 環境の制約

- **Expo Go では動かない**。ネイティブモジュール（Google Sign-In 等）があるため EAS Development Build 必須
  - 実機: `eas build --profile development --platform ios` / シミュレータ: `--profile development-simulator`
- **Expo Web**（`npx expo start --web --port 8081`）は UI 検証専用。地図背景・カメラ・スワイプは Web 非対応（`metro.config.js` で react-native-maps をスタブに解決）
- Supabase は無操作が続くと pause される。開発再開時に dashboard での resume が必要なことがある

## コード規約

- ES Modules / TypeScript strict / 関数コンポーネント + hooks / `StyleSheet.create()`
- 色・余白・文字は `src/theme/` のトークンを参照する（直値を書かない）
- テストは対象と同階層の `__tests__/` に置く。expo モジュールのモックは `jest.setup.js` に集約済み
