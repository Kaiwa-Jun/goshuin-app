# Issue #4: Expoプロジェクト初期セットアップ

## 概要

Expo (React Native) + TypeScript のプロジェクトを初期化し、開発に必要な基盤を構築する。
package.json, tsconfig.json, ESLint, Prettier, Jest, Husky, CI/CD は既に設定済み。
Expoアプリとして起動するためのファイル（app.json, babel.config.js, App.tsx）とディレクトリ構造を作成する。

## 関連ドキュメント

- [要件定義](../product/requirements.md)
- [技術設計](../technical/tech-design.md)
- [UI設計](../design/ui-design.md)

## 詳細設計

### 設計判断

- **React Navigation を採用**（Expo Router ではなく）: Issue指定、`src/screens/` + `src/navigation/` の既存設計と整合
- **TDDは例外**: セットアップフェーズのため。App.tsx のスモークテストのみ作成

### 対象ファイル

| 操作 | ファイル                                                                                |
| ---- | --------------------------------------------------------------------------------------- |
| 新規 | `app.json`                                                                              |
| 新規 | `babel.config.js`                                                                       |
| 新規 | `App.tsx`                                                                               |
| 新規 | `src/constants/app.ts`                                                                  |
| 新規 | `src/__tests__/App.test.tsx`                                                            |
| 新規 | `assets/icon.png`, `splash.png`, `adaptive-icon.png`, `favicon.png`                     |
| 新規 | `src/{components,screens,navigation,hooks,services,stores,types,utils,styles}/.gitkeep` |
| 変更 | `tsconfig.json` (パスエイリアス3件追加)                                                 |
| 変更 | `jest.config.js` (moduleNameMapper 3件追加)                                             |
| 変更 | `package.json` / `package-lock.json` (npm install で自動更新)                           |
| 削除 | `src/index.ts` (constants/app.ts に移動)                                                |

### 実装方針

1. 依存パッケージのインストール（npm install + expo install）
2. app.json 作成（Expo設定、権限設定）
3. babel.config.js 作成（パスエイリアス解決）
4. assets/ プレースホルダー画像配置
5. src/ ディレクトリ構造作成 + src/index.ts を constants/app.ts に移動
6. tsconfig.json / jest.config.js にパスエイリアス追加
7. App.tsx 作成（エントリーポイント）
8. App.tsx のスモークテスト作成
9. 検証（typecheck / lint / test / 起動確認）

### 追加パッケージ

| パッケージ                       | 用途                           |
| -------------------------------- | ------------------------------ |
| `@react-navigation/native`       | ナビゲーション基盤             |
| `@react-navigation/bottom-tabs`  | タブナビゲーション             |
| `react-native-screens`           | ネイティブ画面管理             |
| `react-native-safe-area-context` | SafeArea対応                   |
| `react-native-maps`              | 地図表示                       |
| `expo-location`                  | 位置情報取得                   |
| `expo-image-picker`              | 画像選択                       |
| `expo-camera`                    | カメラ撮影                     |
| `babel-plugin-module-resolver`   | Babel パスエイリアス解決 (dev) |

## テスト方針

- App.tsx のスモークテスト（レンダリング確認）
- `npm run typecheck` / `npm run lint` / `npm test` がすべて通ること

## 注意事項

- `react-native-maps`: iOS は Apple Maps がデフォルト動作。Android の Google Maps API キー設定は別Issue
- `expo-camera`: SDK 52 で `CameraView` に移行済み。実装時は新APIを使用
- `babel.config.js` は `.eslintrc.js` の `ignorePatterns` で除外済み
