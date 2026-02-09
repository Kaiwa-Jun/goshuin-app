# Issue #13: Google OAuth をネイティブ実装に戻す

## 概要

Expo Go 対応のため、Google OAuth を `@react-native-google-signin/google-signin`（ネイティブ）から `expo-auth-session` + `expo-web-browser`（ブラウザベース）に一時的に移行した。

EAS Development Build が利用可能になった時点で、UX 向上のためネイティブ実装に戻す。

## 移行理由

- `@react-native-google-signin/google-signin` はネイティブモジュールを必要とし、Expo Go では動作しない
- EAS Development Build には Xcode（macOS 15.6+）が必要だが、現在の macOS 15.1 ではインストール不可
- ブラウザベースの OAuth は動作するが、UX がネイティブに劣る（ブラウザ遷移が発生する）

## リバート条件

以下の **いずれか** が満たされた時にリバートを実施:

1. macOS を 15.6 以上にアップデートし、Xcode がインストール可能になった
2. EAS Development Build が利用可能な環境が整った
3. Expo Go でネイティブ Google Sign-In が動作する方法が見つかった

## 元のネイティブ実装

### 認証フロー

1. `GoogleSignin.configure()` で Web/iOS クライアント ID を設定
2. `GoogleSignin.signIn()` でネイティブ Google ログイン UI を表示
3. `idToken` を取得
4. `supabase.auth.signInWithIdToken()` で Supabase セッション作成

### サインアウトフロー

1. `supabase.auth.signOut()` で Supabase セッション破棄
2. `GoogleSignin.signOut()` で Google セッション破棄

## リバート手順チェックリスト

### 1. パッケージ変更

- [ ] `expo-auth-session` を削除: `npm uninstall expo-auth-session`
- [ ] `expo-web-browser` を削除: `npm uninstall expo-web-browser`
- [ ] `expo-crypto` を削除: `npm uninstall expo-crypto`
- [ ] `@react-native-google-signin/google-signin` を追加: `npx expo install @react-native-google-signin/google-signin`

### 2. app.json

- [ ] `plugins` に `"@react-native-google-signin/google-signin"` を追加
- [ ] `plugins` から `"expo-web-browser"` を削除（不要な場合）

### 3. src/services/auth.ts

- [ ] `expo-auth-session` / `expo-web-browser` のインポートを削除
- [ ] `WebBrowser.maybeCompleteAuthSession()` 呼び出しを削除
- [ ] `@react-native-google-signin/google-signin` のインポートを復活
- [ ] `configureGoogleSignIn()` 関数を復活
- [ ] `signInWithGoogle()` を `GoogleSignin.signIn()` → `signInWithIdToken()` フローに戻す
- [ ] `signOut()` に `GoogleSignin.signOut()` を追加

### 4. src/navigation/RootNavigator.tsx

- [ ] `configureGoogleSignIn` のインポートを復活
- [ ] モジュールスコープでの `configureGoogleSignIn()` 呼び出しを復活

### 5. jest.setup.js

- [ ] `expo-auth-session` / `expo-web-browser` / `expo-crypto` モックを削除
- [ ] `@react-native-google-signin/google-signin` モックを復活

### 6. テスト更新

- [ ] `src/services/__tests__/auth.test.ts` をネイティブフローのテストに戻す
- [ ] `src/navigation/__tests__/RootNavigator.test.tsx` の auth モックに `configureGoogleSignIn` を追加

### 7. 検証

- [ ] `npm test` 全パス
- [ ] `npm run lint` エラーなし
- [ ] `npm run typecheck` エラーなし
- [ ] EAS Development Build でネイティブ Google ログインが動作

## 影響ファイル一覧

コード内に `[REVERT-TO-NATIVE]` コメントが付与された箇所:

| ファイル                              | 箇所                                                 |
| ------------------------------------- | ---------------------------------------------------- |
| `src/services/auth.ts`                | ファイル全体（冒頭コメント）、`signOut()` 内コメント |
| `src/services/__tests__/auth.test.ts` | ファイル冒頭コメント                                 |
| `src/navigation/RootNavigator.tsx`    | `configureGoogleSignIn` 削除箇所のコメント           |
| `jest.setup.js`                       | google-signin モック削除箇所のコメント               |

## 関連ドキュメント

- [要件定義](../product/requirements.md)
- [技術設計](../technical/tech-design.md)

## 現在の実装（ブラウザベース）

### 認証フロー

1. `supabase.auth.signInWithOAuth()` で OAuth URL を取得（`skipBrowserRedirect: true`）
2. `WebBrowser.openAuthSessionAsync()` でブラウザで Google 認証
3. リダイレクト URL のフラグメントから `access_token` / `refresh_token` を抽出
4. `supabase.auth.setSession()` でセッション設定

### サインアウトフロー

1. `supabase.auth.signOut()` のみ（Google セッション破棄は不要）
