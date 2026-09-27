import { readFileSync } from 'fs';
import { join } from 'path';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { requireOptionalNativeModule } from 'expo';
import { Linking, Platform } from 'react-native';

import {
  clearRecordCompleted,
  noteRecordCompleted,
  openAppStoreWriteReview,
  readStoreReviewHistory,
  requestStoreReview,
  takeRecordCompleted,
  writeStoreReviewHistory,
} from '@services/storeReview';

/*
 * Issue #288 AC-7〜14。ネイティブの入口・この起動の中だけの印・端末の履歴・レビューを書くリンク。
 * ネイティブは jest.setup.js の requireOptionalNativeModule のモックだけで差し替える（D-2）。
 * 既定は「ExpoStoreReview が無い」（今の開発用アプリと同じ）
 */

const requireOptional = jest.mocked(requireOptionalNativeModule);
/** jest.setup.js の既定（ExpoStoreReview なら null） */
const defaultRequireOptional = requireOptional.getMockImplementation();

let fake: { isAvailableAsync: jest.Mock; requestReview: jest.Mock };
/** 偽のモジュール（使える）を返すようにする */
const useFakeModule = () =>
  requireOptional.mockImplementation(
    (name: string) => (name === 'ExpoStoreReview' ? fake : null) as never
  );

const originalOS = Platform.OS;
const setOS = (os: string) =>
  Object.defineProperty(Platform, 'OS', { get: () => os, configurable: true });

beforeEach(() => {
  jest.clearAllMocks();
  requireOptional.mockImplementation(defaultRequireOptional);
  fake = {
    isAvailableAsync: jest.fn(async () => true),
    requestReview: jest.fn(async () => undefined),
  };
  clearRecordCompleted();
});

afterEach(() => {
  setOS(originalOS);
  jest.restoreAllMocks();
});

describe('requestStoreReview', () => {
  it('AC-7: ネイティブが無い（既定）なら false で resolve する', async () => {
    await expect(requestStoreReview()).resolves.toBe(false);
  });

  it('AC-7: ネイティブの差し替えは jest.setup.js に置いている', () => {
    const setup = readFileSync(join(__dirname, '../../../jest.setup.js'), 'utf8');
    expect(setup).toContain('requireOptionalNativeModule');
  });

  it.each(['android', 'web'])('AC-8: %s ではモジュールを読みにも行かず false', async os => {
    setOS(os);
    useFakeModule();

    await expect(requestStoreReview()).resolves.toBe(false);
    expect(requireOptional).not.toHaveBeenCalled();
    expect(fake.isAvailableAsync).not.toHaveBeenCalled();
    expect(fake.requestReview).not.toHaveBeenCalled();
  });

  it('AC-9: 使えない（TestFlight）なら false で、requestReview を呼ばない', async () => {
    fake.isAvailableAsync.mockResolvedValue(false);
    useFakeModule();

    await expect(requestStoreReview()).resolves.toBe(false);
    expect(fake.requestReview).not.toHaveBeenCalled();
  });

  it('AC-10: 使えるなら requestReview を1回呼んで true', async () => {
    useFakeModule();

    await expect(requestStoreReview()).resolves.toBe(true);
    expect(fake.requestReview).toHaveBeenCalledTimes(1);
    expect(requireOptional).toHaveBeenCalledWith('ExpoStoreReview');
  });

  it('AC-11: requestReview が reject しても false で resolve し、警告を1回出す', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    fake.requestReview.mockRejectedValue(new Error('MissingCurrentWindowSceneException'));
    useFakeModule();

    await expect(requestStoreReview()).resolves.toBe(false);
    expect(warn).toHaveBeenCalledTimes(1);
  });
});

describe('AC-12: この起動の中だけの印', () => {
  it('何もしなければ null', () => {
    expect(takeRecordCompleted()).toBeNull();
  });

  it('置いた枚数を取り出すと消える', () => {
    noteRecordCompleted(3);
    expect(takeRecordCompleted()).toBe(3);
    expect(takeRecordCompleted()).toBeNull();
  });

  it('あとから置いた枚数で上書きする', () => {
    noteRecordCompleted(3);
    noteRecordCompleted(4);
    expect(takeRecordCompleted()).toBe(4);
  });

  it('消すと null', () => {
    noteRecordCompleted(3);
    clearRecordCompleted();
    expect(takeRecordCompleted()).toBeNull();
  });
});

describe('AC-13: 端末の履歴', () => {
  it('無ければ履歴なしとして読む', async () => {
    jest.mocked(AsyncStorage.getItem).mockResolvedValueOnce(null);

    await expect(readStoreReviewHistory()).resolves.toEqual({ count: 0, lastRequestedAt: null });
    expect(AsyncStorage.getItem).toHaveBeenCalledWith('store_review_history');
  });

  it('JSON で書く', async () => {
    await writeStoreReviewHistory({ count: 1, lastRequestedAt: '2026-10-05T03:00:00.000Z' });

    expect(AsyncStorage.setItem).toHaveBeenCalledWith(
      'store_review_history',
      '{"count":1,"lastRequestedAt":"2026-10-05T03:00:00.000Z"}'
    );
  });

  it('読めなければ reject のまま返す', async () => {
    jest.mocked(AsyncStorage.getItem).mockRejectedValueOnce(new Error('disk'));

    await expect(readStoreReviewHistory()).rejects.toThrow('disk');
  });
});

describe('AC-14: openAppStoreWriteReview', () => {
  it('App Store のレビューを書く画面の URL を1回開く', async () => {
    const openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);

    await openAppStoreWriteReview();

    expect(openURL).toHaveBeenCalledTimes(1);
    expect(openURL).toHaveBeenCalledWith(
      'https://apps.apple.com/app/id6797201465?action=write-review'
    );
  });

  it('開けなければ reject する', async () => {
    jest.spyOn(Linking, 'openURL').mockRejectedValue(new Error('cannot open'));

    await expect(openAppStoreWriteReview()).rejects.toThrow('cannot open');
  });
});
