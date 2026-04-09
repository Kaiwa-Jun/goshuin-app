# Issue #72: 設定画面: アプリバージョンを package.json から自動取得する

## 概要

`SettingsScreen.tsx` でアプリバージョンが `1.0.0` とハードコードされている。
`expo-constants` を使用して `app.json` / `package.json` のバージョンを動的に取得するよう変更する。
合わせて `SettingsScreen.test.tsx` のバージョン検証もモックベースに更新する。

## 関連ドキュメント

- [要件定義](../product/requirements.md)
- [技術設計](../technical/tech-design.md)

## 詳細設計

### 対象ファイル

- `src/screens/SettingsScreen.tsx`（変更）— ハードコード値を `Constants.expoConfig?.version` に置換
- `src/screens/__tests__/SettingsScreen.test.tsx`（変更）— `expo-constants` をモックし、バージョン値の期待値を修正

### 実装方針

**expo-constants を採用する理由**

`package.json` を直接 `import` する方法はバンドラー依存のアプローチであり、
Expo の公式ドキュメントでは `Constants.expoConfig` の使用を推奨している。
`Constants.expoConfig.version` は `app.json` の `expo.version` を参照するため、
`package.json` と `app.json` を同期させる現行設計（両方 `0.1.0`）と整合する。
また EAS Build・EAS Update 環境でも正しいバージョンが取得できる。

**変更内容**

1. `SettingsScreen.tsx` への変更:
   - `import Constants from 'expo-constants';` を追加
   - `const appVersion = Constants.expoConfig?.version ?? '不明';` を定義
   - JSX 内の `1.0.0` を `{appVersion}` に置換

2. `package.json` への変更:
   - `dependencies` に `"expo-constants": "~18.0.13"` を明示的に追加

3. `SettingsScreen.test.tsx` への変更:
   - `expo-constants` のモックを追加
   - バージョン期待値を `'0.1.0'` に修正

### データ構造

型: `Constants.expoConfig` は `ExpoConfig | null` 型。
`version` フィールドは `string | undefined`（`ExpoConfig.version?: string`）。
フォールバックとして `?? '不明'` を設定する。

### 画面仕様

変更なし。「バージョン」行の右側に表示される文字列のみ動的取得に変わる。

## テスト方針

- `expo-constants` を `jest.mock` でモック化し、`expoConfig.version` に固定値 `'0.1.0'` を返す
- 既存テスト `renders app info section` の `expect(getByText('1.0.0'))` を `expect(getByText('0.1.0'))` に更新
- `expoConfig` が `null` の場合に `'不明'` が表示されることを確認する新規テストを追加

## 受入基準（Acceptance Criteria）

### 機能基準

- [ ] AC-1: 設定画面の「バージョン」行に、`app.json` の `expo.version`（現在 `0.1.0`）と同じ値が表示される
- [ ] AC-2: `app.json` の `expo.version` を変更した場合、コード変更なしに設定画面のバージョン表示も変わる（ハードコードされていない）
- [ ] AC-3: `Constants.expoConfig` が `null` の場合、バージョン表示が `'不明'` になる

### UI基準

- [ ] UI-1: 設定画面の「アプリ情報」セクション「バージョン」行の右側にバージョン文字列が表示される（既存スタイル維持）

### 品質基準

- [ ] Q-1: 全テストが通る（`npm test`）
- [ ] Q-2: Lint エラーがない（`npm run lint`）
- [ ] Q-3: 型エラーがない（`npm run typecheck`）

## 注意事項

- `expo-constants` は現時点では `node_modules` に存在するが `package.json` の `dependencies` に明示されていない。本 Issue で明示的に追加すること。
- `Constants.expoConfig?.version` は `string | undefined` のため、nullish coalescing（`??`）でフォールバック文字列を必ず設定すること。
- テストで `expo-constants` をモックする際、`default` エクスポートであることに注意。
