import AsyncStorage from '@react-native-async-storage/async-storage';
import { requireOptionalNativeModule } from 'expo';
import { Linking, Platform } from 'react-native';

import { APP_STORE_WRITE_REVIEW_URL, STORE_REVIEW_HISTORY_KEY } from '@/constants/storeReview';
import { parseStoreReviewHistory, type StoreReviewHistory } from '@utils/storeReview';

/**
 * App Store のレビュー（Issue #288）。仕様: docs/issues/issue-288-review-request.md
 *
 * ⚠️ `expo-store-review` は **import も require もしない**（D-1）。入口が読み込んだ瞬間に
 *    requireNativeModule を呼ぶので、ネイティブの入っていない開発用アプリでは読んだ時点で落ちる。
 *    また JS の requestReview() はネイティブが無いとストアの URL を開きに行く。
 *    パッケージはネイティブ側のため（autolinking でビルドに入る）だけに入れている
 */

/** ExpoStoreReview のうち使う2つ（ios/StoreReviewModule.swift） */
interface StoreReviewNative {
  /** TestFlight で配られていなければ true */
  isAvailableAsync(): Promise<boolean>;
  /** 前面の scene が無いと reject（MissingCurrentWindowSceneException） */
  requestReview(): Promise<void>;
}

/**
 * システムのレビュー依頼を出す。呼べたら true（実際に表示したかはシステムが決めるので分からない）。
 * iOS 以外・ネイティブが無い・使えない（TestFlight）・失敗は false で、reject しない
 */
export async function requestStoreReview(): Promise<boolean> {
  if (Platform.OS !== 'ios') return false;
  const native = requireOptionalNativeModule<StoreReviewNative>('ExpoStoreReview');
  if (!native) return false;
  try {
    if ((await native.isAvailableAsync()) !== true) return false;
    await native.requestReview();
    return true;
  } catch (e) {
    console.warn('[storeReview] requestReview failed', e);
    return false;
  }
}

/*
 * 「この起動の中で、完了画面を見た」という一度きりの合図（D-6）。
 * 起動をまたいではいけない（AsyncStorage に置くと、完了画面でアプリを終了した人に次の起動の直後に
 * 出てしまう）ので、モジュールの変数に置く。画面を描き直すための状態ではないので state・Context にしない
 */
let recordCompleted: number | null = null;

/** 完了画面が開いたときに、そのときの通算の枚数を置く（前の印は上書き） */
export function noteRecordCompleted(totalStampCount: number): void {
  recordCompleted = totalStampCount;
}

/** 記録画面が開いたときに消す（「もう1枚」のあとの ✕・保存の失敗の直後に出さない） */
export function clearRecordCompleted(): void {
  recordCompleted = null;
}

/** 印を取り出す。取り出すと消える。無ければ null */
export function takeRecordCompleted(): number | null {
  const value = recordCompleted;
  recordCompleted = null;
  return value;
}

/** AsyncStorage の読み取りが失敗したら reject のまま返す（呼ぶ側で「出さない」にする） */
export async function readStoreReviewHistory(): Promise<StoreReviewHistory> {
  return parseStoreReviewHistory(await AsyncStorage.getItem(STORE_REVIEW_HISTORY_KEY));
}

export function writeStoreReviewHistory(history: StoreReviewHistory): Promise<void> {
  return AsyncStorage.setItem(STORE_REVIEW_HISTORY_KEY, JSON.stringify(history));
}

/** App Store の「レビューを書く」画面を開く。開けなければ reject のまま返す */
export async function openAppStoreWriteReview(): Promise<void> {
  await Linking.openURL(APP_STORE_WRITE_REVIEW_URL);
}
