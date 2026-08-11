# Issue #133: `fetchVisitedSpotIds` の握り潰しをやめ、バッジ判定のずれを直す

- GitHub Issue: #133（Refs #131）
- ブランチ: `feature/issue-133-visited-spot-ids-error-handling` → develop
- 監査根拠: `docs/design/ux-audit-2026-08.md` B-3「エラーの握り潰しがコード全体の作法になっている」

## 関連ドキュメント

- [UX 監査 2026-08](../design/ux-audit-2026-08.md) — B-3（握り潰しの方針: コア導線はエラー種別と原文、一覧系は「読み込めませんでした / 再試行」）
- [Issue #118 契約書](./issue-118-record-upload-error.md) — `describeSupabaseError` と「原文を出す」作法の出所
- [Issue #130 契約書](./issue-130-record-flow-shortening.md) — `isSavingRef` の二度押しガード（A-11〜A-13）と完了画面の取り消し導線の前提
- [プロダクト方針 v2](../product/direction.md) — Phase 1「記録体験の磨き込み」
- `CLAUDE.md` — コード規約（テーマトークン必須・直値禁止 / 状態管理はカスタム hooks + ローカル state のみ）

## 概要

`fetchVisitedSpotIds`（`src/services/stamps.ts:14-23`）は通信エラー時に `console.warn` して**空の `Set` を返す**。`RecordScreen.save()` はこの結果から `previousCount` を出して `evaluateNewBadge(previousCount, currentCount)` に渡しているため、取得に失敗すると `previousCount` が 0 に落ち、**実際は100箇所目でも「1箇所目の御朱印！」と表示され、獲得済みのバッジが再び出る**。

記録そのものは成功するのでデータは壊れない（バッジは DB に永続化されておらず `evaluateNewBadge` は純関数）。**表示だけの問題**だが、記録はコア導線であり、監査 B-3 の方針「コア導線（記録・アップロード）はエラー種別と原文を出す」の対象に当たる。

**本 Issue は #133 が指す経路（`fetchVisitedSpotIds` とその2つの呼び出し元）だけを直す。** B-3 全体の掃討は別ループ。

## 呼び出し元は2つある

| 呼び出し元                        | 用途                                   | 失敗したときの現状の見え方                                        | 本 Issue での扱い           |
| --------------------------------- | -------------------------------------- | ----------------------------------------------------------------- | --------------------------- |
| `src/screens/RecordScreen.tsx:88` | `previousCount` とバッジ判定           | **誤った件数と誤ったバッジが出る**（嘘の情報が celebrate される） | **直す**（S-1 / S-2 / S-3） |
| `src/hooks/useUserStamps.ts:26`   | 地図・巡礼詳細の訪問済みピン／達成表示 | 訪問済みが**未訪問の色**で出る（情報が欠ける）                    | **挙動を変えない**（S-4）   |

**片方だけ直して片方を壊さないことを本契約書の必須条件とする。** `useUserStamps` の消費者は `MapScreen.tsx:60` と `PilgrimageDetailScreen.tsx:32` の2画面。

## 決定事項

| ID  | 論点                                    | 決定                                                                                        | 根拠                                                                                                                                                                                                                                                                                                                                                                          |
| --- | --------------------------------------- | ------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D-1 | 失敗を呼び出し元にどう伝えるか          | **`fetchVisitedSpotIds` が throw する**（`describeSupabaseError` でメッセージを組み立てる） | 同じ `stamps.ts` の `uploadStampImage:59` / `createStamp:87` / `fetchStampById:115` が既に throw する作法（PR #118）。このリポジトリの層の役割分担は「services は throw、hooks が判別可能ユニオンに畳む」（`useRecordForm.submit()` / `deleteAccount()`）。かつ `useUserStamps` は既に try/catch で包んでおり、rejection のテストも持っているため**波及ゼロで乗り換えられる** |
| D-2 | 取得に失敗したとき記録を止めるか        | **止めない。`form.submit()` は必ず実行する**                                                | 失敗しているのは表示用の前取得であって記録ではない。ここで中断すると「写真は撮れたのに保存されない」になり、コア導線が今より脆くなる。Issue の趣旨と逆                                                                                                                                                                                                                        |
| D-3 | 失敗したとき完了画面に何を出すか        | **件数を出さない・バッジ判定をしない・小さな注記を1行出す**                                 | 「誤った数字を出すより出さないほうがよい」（Issue 本文）。ただし黙って消すと B-3 の指摘「ユーザーは壊れていることに気づけない」がそのまま残るため、理由を1行だけ添える。完了画面はお祝いの場なのでエラー画面には飛ばさず、`typography.caption` + `opacity` で控えめに置く                                                                                                     |
| D-4 | `useUserStamps`（地図ピン）をどうするか | **握り潰しを維持する。ただし `console.warn` で診断可能にする**                              | 害の質が違う。記録導線は**嘘の数字を祝う**が、地図ピンは**訪問済みが未訪問色になる**だけで誤情報を主張しない。地図に「読み込めませんでした / 再試行」を出すのは監査 B-3 の一覧系対応であり別ループ（スコープ外に明記）。現状の catch は `catch {}` でログすら残らないので、そこだけ塞ぐ                                                                                       |

### 検討して採らなかった案: サービスが判別可能ユニオンを返す

```ts
// 採らなかった
type VisitedSpotIdsResult =
  | { success: true; spotIds: Set<string> }
  | { success: false; message: string };
```

型の上で失敗を無視できなくなる利点はあるが、

- `stamps.ts` の他の関数（`uploadStampImage` / `createStamp` / `fetchStampById` / `deleteStamp`）はすべて throw であり、1関数だけ返り値の作法が変わる
- `useUserStamps` の既存の try/catch が無意味になり、**呼び出し元2つとも書き換えが必要になる**（throw なら `useUserStamps` は無改修）
- ユニオンを返すのはこのリポジトリでは hooks / 画面向けサービス（`useRecordForm.submit()`・`deleteAccount()`）の役割

以上から throw を採る。

## スコープ

### やること

| ID  | 内容                                                                                                                                     |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| S-1 | `fetchVisitedSpotIds` を throw に変える（`describeSupabaseError(error, '訪問済みスポットの取得に失敗しました')`）                        |
| S-2 | `RecordScreen.save()` で `fetchVisitedSpotIds` を try/catch し、失敗時は**件数とバッジを算出しない**まま記録を続行する                   |
| S-3 | `RecordComplete` の params に `countUnavailable?: boolean` を足し、`RecordCompleteScreen` に注記を1行出す                                |
| S-4 | `useUserStamps` の `catch {}` を `catch (error)` にして `console.warn` を出す（**空 `Set` にフォールバックする挙動そのものは変えない**） |

### やらないこと（スコープ外）

B-3 の掃討は別ループ。以下は**本 Issue では一切触れない**。

- `stamps.ts` の他の握り潰し: `fetchStampsBySpotId:33`（`[]` を返す）/ `fetchAllStamps:101`（`[]` を返す）/ `fetchPublicStampsBySpotId:158`（`[]` を返す）
- `src/services/spotInfo.ts:11,26` の握り潰し
- **地図・巡礼詳細に「読み込めませんでした / 再試行」の UI を出すこと**（監査 B-3 の一覧系対応。D-4 の判断で先送り）
- `useUserStamps` の返り値へのエラー state 追加（消費者がいない dead code になる）
- **`fetchVisitedSpotIds` のリトライ**（記録導線に待ち時間を足す。頻度に対して割に合わない）
- **`fetchVisitedSpotIds` の呼び出しを `submit()` の後ろに移すこと**（`previousCount` の意味が変わり、二度押しガード `isSavingRef` の窓（issue-130 A-11）も動く。別 Issue）
- 件数・バッジを DB に永続化すること
- `RecordCompleteScreen` のレイアウト・アニメーション・ボタン構成の変更
- `ErrorScreen` の変更

### 変更しないファイル

以下は**1行も変更しない**。変更されていたらスコープ違反として差し戻す。

- `src/screens/MapScreen.tsx`
- `src/screens/PilgrimageDetailScreen.tsx`
- `src/hooks/useRecordForm.ts`
- `src/services/badges.ts`
- `src/screens/ErrorScreen.tsx`
- `src/utils/supabaseError.ts`（既存の `describeSupabaseError` をそのまま使う）
- `src/services/stamps.ts` の `fetchVisitedSpotIds` **以外**の関数
- `src/hooks/__tests__/useUserStamps.test.ts`（**無改修で通ることが地図側の無回帰の証拠**。E-3 参照）

## 詳細設計

### S-1: `fetchVisitedSpotIds` を throw にする

```ts
export async function fetchVisitedSpotIds(): Promise<Set<string>> {
  const { data, error } = await supabase.from('stamps').select('spot_id');

  if (error) {
    throw new Error(describeSupabaseError(error, '訪問済みスポットの取得に失敗しました'));
  }

  return new Set((data as { spot_id: string }[]).map(row => row.spot_id));
}
```

シグネチャ（`Promise<Set<string>>`）は変わらない。変わるのは「失敗したとき resolve するか reject するか」だけ。

### S-2: `RecordScreen.save()`

```
save()
  ├─ try { visitedSpotIds = await fetchVisitedSpotIds() }
  │  catch { visitedSpotIds = null; console.warn('[record] fetchVisitedSpotIds failed: <message>') }
  ├─ result = await form.submit()          ← 取得の成否によらず必ず実行（D-2）
  └─ result.success && result.stamp
       ├─ visitedSpotIds !== null → 従来どおり visitCount / badge を算出して渡す
       └─ visitedSpotIds === null → visitCount と badge を渡さず countUnavailable: true を渡す
```

- **`visitedSpotIds === null` のとき `evaluateNewBadge` を呼ばない**。`previousCount` が無い以上、判定できる材料が無い（0 を代入して呼ぶのが今のバグそのもの）
- **`visitCount` / `badge` は `undefined` を明示的に渡すのではなく、キーごと省略する**。`RecordCompleteScreen` は `visitCount` が falsy なら既存のフォールバック文言「御朱印を記録しました！」を出し、`badge` が falsy なら `BadgeAnimation` を描画しないため、**完了画面側の分岐は追加不要**
- `console.warn` の接頭辞は `useRecordForm` の `console.error('[record] submit failed at ...')` に合わせて `[record]` にする。記録は続行できているので warn（error ではない）
- この変更後、**`save()` は reject しない**（`form.submit()` は既に判別可能ユニオンを返す）。`handleSavePress` の `try/finally` は catch を持たないため、ここを塞がないと通信失敗のたびに unhandled rejection になる
- 取得に失敗したうえで `submit()` も失敗した場合は、**従来どおり** `Error` 画面へ `type` / `origin` / `stage` / `message` を渡して遷移する（分岐に手を入れない）

### S-3: `RecordComplete` の注記

`src/navigation/types.ts`:

```ts
RecordComplete:
  | {
      stampImageUrl?: string;
      spotName?: string;
      visitCount?: number;
      badge?: { name: string; description: string } | null;
      stampId?: string;
      imagePath?: string;
      /** 訪問済みスポットの取得に失敗し、件数とバッジを算出できなかった（Issue #133） */
      countUnavailable?: boolean;   // 追加
    }
  | undefined;
```

`RecordCompleteScreen` の `visit-count` テキストの**直下**に置く:

| 項目       | 値                                                                                                                      |
| ---------- | ----------------------------------------------------------------------------------------------------------------------- |
| 文言       | `通信エラーのため記録数を表示できません`                                                                                |
| `testID`   | `visit-count-unavailable`                                                                                               |
| 表示条件   | `countUnavailable === true` のときだけ                                                                                  |
| スタイル   | `...typography.caption` / `color: colors.white` / `opacity: 0.7`                                                        |
| 直値の禁止 | 色・余白・文字サイズはすべて `src/theme/` のトークン参照（`opacity` の数値のみ既存 `buttonUndoText` と同じ 0.7 を許容） |

「記録は保存された」ことは既存の見出し「登録完了！」と本文「御朱印を記録しました！」が伝えているため、注記には**失敗した理由だけ**を書く。エラー画面へは飛ばさない（記録は成功しているため）。

### S-4: `useUserStamps`

```ts
} catch (error) {
  // 地図の訪問済みピンは未訪問色に倒れるだけで誤情報にはならないため、
  // 空 Set へのフォールバックは維持する。ログだけは残す（監査 B-3・Issue #133 D-4）
  console.warn('[useUserStamps] fetchVisitedSpotIds failed:', error);
  if (!cancelled) setVisitedSpotIds(new Set());
}
```

**返り値の型・空 `Set` へのフォールバック・`isLoading` の挙動は変えない。**

## テスト方針

| ファイル                                              | 変更                                                                                                  |
| ----------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `src/services/__tests__/stamps.test.ts`               | `'returns empty Set on error'` を **`throw` を検証するテストに書き換える**（A 群）                    |
| `src/screens/__tests__/RecordScreen.test.tsx`         | `mockFetchVisitedSpotIds.mockRejectedValue(...)` の経路を追加（B 群）。既存の成功系テストは変更しない |
| `src/screens/__tests__/RecordCompleteScreen.test.tsx` | `countUnavailable` の有無での注記の出し分けを追加（C 群）                                             |
| `src/hooks/__tests__/useUserStamps.test.ts`           | **無改修**。既存の `'returns empty Set on fetch error'` が throw 版でもそのまま通る（E-3）            |

失敗経路（`fetchVisitedSpotIds` だけが失敗し、アップロードと insert は成功する）は**実機では再現困難**（一時的な通信の揺らぎでしか起きず、コードを書き換えずに再現する手段が無い）。したがって**この経路はユニットテストが全面的に担保する**。実機確認は回帰のみに使う（F 群）。契約書に再現用のコード改変手順は入れない。

## 受入基準

検証欄: **機械** = grep / ファイル存在で確認 / **テスト** = `npm test` で確認 / **native-only** = 実機確認

### A 群: `fetchVisitedSpotIds`（S-1）

| #   | 基準                                                                                                                                                                   | 検証   |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| A-1 | `supabase.from('stamps').select('spot_id')` が `error` を返したとき、`fetchVisitedSpotIds()` が reject する（空 `Set` を返さない）                                     | テスト |
| A-2 | A-1 で reject される値は `Error` インスタンスで、`message` が `describeSupabaseError` の出力（`code=` / `status=` などが併記される）である                             | テスト |
| A-3 | `error` が `message` も `code` / `status` / `details` / `hint` も持たない場合（`{}` をモックする）、`message` がちょうど `訪問済みスポットの取得に失敗しました` になる | テスト |
| A-4 | 成功時の返り値が従来どおり重複を畳んだ `Set<string>` である（既存テストが変更なしで通る）                                                                              | テスト |
| A-5 | `src/services/stamps.ts` の `fetchVisitedSpotIds` 内に `console.warn` が残っていない                                                                                   | 機械   |

### B 群: `RecordScreen`（S-2）

| #    | 基準                                                                                                                                                                                     | 検証   |
| ---- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| B-1  | `fetchVisitedSpotIds` が reject しても `form.submit()` が呼ばれる                                                                                                                        | テスト |
| B-2  | `fetchVisitedSpotIds` が reject し `submit()` が成功したとき、`RecordComplete` へ遷移する                                                                                                | テスト |
| B-3  | B-2 の遷移 params に `visitCount` が含まれない（`expect.not.objectContaining` / キーの不在で確認）                                                                                       | テスト |
| B-4  | B-2 の遷移 params に `badge` が含まれない                                                                                                                                                | テスト |
| B-5  | B-2 の遷移 params に `countUnavailable: true` が含まれる                                                                                                                                 | テスト |
| B-6  | `fetchVisitedSpotIds` が reject したとき `evaluateNewBadge` が**一度も呼ばれない**                                                                                                       | テスト |
| B-7  | B-2 の遷移 params に `stampImageUrl` / `spotName` / `stampId` / `imagePath` は従来どおり含まれる（取り消し導線を壊さない）                                                               | テスト |
| B-8  | `fetchVisitedSpotIds` が reject し `submit()` も失敗したとき、`Error` 画面へ `type` / `origin: 'record'` / `stage` / `message` を渡して遷移する                                          | テスト |
| B-9  | `fetchVisitedSpotIds` が reject しても `save()` の Promise が reject しない（unhandled rejection を出さない）                                                                            | テスト |
| B-10 | `fetchVisitedSpotIds` が reject した後、もう一度記録ボタンを押すと `submit()` が再び呼ばれる（`isSavingRef` の in-flight ガードが張り付かない。issue-130 A-12/A-13 と同趣旨）            | テスト |
| B-11 | `fetchVisitedSpotIds` が成功したときの既存挙動が変わらない: 新規スポットで `visitCount = previousCount + 1`、再訪で `visitCount = previousCount`、`badge` は `evaluateNewBadge` の返り値 | テスト |
| B-12 | B-11 の成功経路の params に `countUnavailable` のキーが含まれない                                                                                                                        | テスト |
| B-13 | reject 時に `console.warn` が `[record]` 接頭辞付きで1回呼ばれる                                                                                                                         | テスト |

### C 群: `RecordCompleteScreen` の注記（S-3）

| #   | 基準                                                                                                                                  | 検証   |
| --- | ------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| C-1 | `src/navigation/types.ts` の `RecordComplete` params に `countUnavailable?: boolean` がある                                           | 機械   |
| C-2 | `countUnavailable: true` のとき `testID="visit-count-unavailable"` が描画され、文言が `通信エラーのため記録数を表示できません` である | テスト |
| C-3 | `countUnavailable` が未指定のとき `testID="visit-count-unavailable"` が描画されない（`queryByTestId` が `null`）                      | テスト |
| C-4 | `countUnavailable: false` のとき `testID="visit-count-unavailable"` が描画されない                                                    | テスト |
| C-5 | `countUnavailable: true` かつ `visitCount` 無しのとき、`testID="visit-count"` の文言が `御朱印を記録しました！` である                | テスト |
| C-6 | `countUnavailable: true` かつ `badge` 無しのとき `testID="badge-animation"` が描画されない                                            | テスト |
| C-7 | 注記のスタイルに色・文字サイズの直値が無く、`typography` / `colors` トークン由来である                                                | 機械   |
| C-8 | 注記は `testID="visit-count"` の**直後**に描画される（親 View の子の順序で確認）                                                      | テスト |

### D 群: `useUserStamps`（S-4・無回帰）

| #   | 基準                                                                                                                                                                                | 検証   |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| D-1 | `fetchVisitedSpotIds` が reject したとき `visitedSpotIds` が空の `Set` になり、`isLoading` が `false` になる                                                                        | テスト |
| D-2 | D-1 のとき hook が throw せず、レンダリングが継続する                                                                                                                               | テスト |
| D-3 | `src/hooks/useUserStamps.ts` の catch 節に `[useUserStamps]` 接頭辞付きの `console.warn` がある（**テストではなく grep で確認する**。既存テストを改修せずに済ませるため。E-3 参照） | 機械   |
| D-4 | `useUserStamps` の返り値の型が `{ visitedSpotIds: Set<string>; isLoading: boolean }` のままである                                                                                   | 機械   |
| D-5 | 未認証時に `fetchVisitedSpotIds` が呼ばれない既存挙動が維持される                                                                                                                   | テスト |

### E 群: 回帰・品質

| #   | 基準                                                                                                                                                                                        | 検証 |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- |
| E-1 | `npm test` が全パスする（既存件数を割らない）                                                                                                                                               | 機械 |
| E-2 | `npm run lint` が 0 errors / `npm run typecheck` が clean                                                                                                                                   | 機械 |
| E-3 | `src/hooks/__tests__/useUserStamps.test.ts` が **git diff に現れない**（無改修で通る = 地図側の無回帰の証拠）                                                                               | 機械 |
| E-4 | 「変更しないファイル」節に挙げたファイルが `git diff --name-only develop...HEAD` に現れない                                                                                                 | 機械 |
| E-5 | `grep -rn "fetchVisitedSpotIds(" src/ \| grep -v __tests__ \| grep -v "services/stamps.ts"` の結果が `RecordScreen.tsx` と `useUserStamps.ts` の2行のみである（呼び出し元を増やしていない） | 機械 |
| E-6 | グローバル状態管理ライブラリの import が増えていない                                                                                                                                        | 機械 |

### F 群: 実機確認（人間ゲート後・回帰のみ）

失敗経路は実機で再現できないため、ここでは**正常系が壊れていないこと**だけを見る。

| #   | 基準                                                                                                                                                                                                                           | 検証            |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------- |
| F-1 | 実機でオンライン状態で記録すると、完了画面に従来どおり `N箇所目の御朱印！` が出る                                                                                                                                              | **native-only** |
| F-2 | F-1 で `visitCount` が閾値（1 / 5 / 10 / 30 / 50 / 100）に達したときバッジアニメーションが出る。**確認者の実記録数が閾値-1 のときのみ検証できる。達しない場合は「未検証」と明記して可**（B-11 と既存ユニットテストで担保済み） | **native-only** |
| F-3 | F-1 の完了画面に `通信エラーのため記録数を表示できません` の注記が**出ない**                                                                                                                                                   | **native-only** |
| F-4 | 地図タブで訪問済みスポットのピンが従来どおり訪問済みの表示になる                                                                                                                                                               | **native-only** |

> F 群はカメラ（記録フロー）と地図背景を通るため Expo Web では検証できない。Maestro フローは追加せず、実機での目視確認とする（既存の `e2e/` に記録フローの完走フローが無いため、本 Issue で新設するのは費用対効果が合わない）。

## 実装スライス（1スライス = 1コミット）

**順序に意味がある。** サービスを先に throw に変えると、`RecordScreen` に catch が入るまでの間、通信失敗のたびに unhandled rejection が出る中間状態が生まれる。そのため **S-1 と S-2 は同一コミット**にする。

| #   | 内容                                                                                                                                      | 対応     | 受入基準 |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------- | -------- | -------- |
| 1   | `RecordComplete` params に `countUnavailable` を追加し、`RecordCompleteScreen` に注記を実装する（この時点では誰も渡さないので挙動は不変） | S-3      | C 群     |
| 2   | `fetchVisitedSpotIds` を throw に変え、**同時に** `RecordScreen.save()` に try/catch を入れる                                             | S-1・S-2 | A / B 群 |
| 3   | `useUserStamps` の catch に `console.warn` を足す                                                                                         | S-4      | D 群     |

## リスク

| リスク                                                                  | 対処                                                                                                                                      |
| ----------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| throw 化で `useUserStamps` 経由の地図が落ちる                           | 既存の try/catch が受け止める。無改修の既存テスト（`'returns empty Set on fetch error'` が rejection をモックしている）が証拠。E-3 で固定 |
| `RecordScreen` の catch 漏れで unhandled rejection（記録画面が redbox） | B-9 が明示的に検証する。スライス 2 で S-1 と S-2 を同一コミットにして中間状態を作らない                                                   |
| 「件数が出ない」ことをユーザーが不具合と受け取る                        | D-3 の注記で理由を1行出す。記録が保存されたことは既存の「登録完了！」「御朱印を記録しました！」が伝える                                   |
| 失敗経路が実機で再現できず、机上の実装で終わる                          | ユニットテスト（B 群 11 項目）で経路を全面的に固定する。実機は回帰のみ（F 群）と明記済み                                                  |
| B-3 の他の握り潰しに手を広げてスライスが膨らむ                          | 「やらないこと」に対象関数を列挙済み。E-4 / E-5 が機械的に検出する                                                                        |

## 注意事項

- `describeSupabaseError` は既存実装をそのまま使う（`src/utils/supabaseError.ts` は変更しない）
- `console.warn` の接頭辞は `[record]` / `[useUserStamps]` で揃える。実機では Metro のログにしか出ないため、`[record]` はテスト（B-13）、`[useUserStamps]` は grep（D-3）で固定する
- 状態管理は既存どおりカスタム hooks + ローカル state のみ。新しいライブラリを入れない（E-6）
- 完了画面の注記は `src/theme/` のトークン参照で書く。直値の色・フォントサイズを書かない（C-7）
