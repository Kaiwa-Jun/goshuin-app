/**
 * 実機（React Native / Hermes）の環境を再現してアップロード経路を検証する。
 *
 * 背景: RN の FormData ポリフィルは append / getAll / getParts しか持たない。
 * 一方 supabase-js の Storage クライアントは FormData を渡されると
 * `body.has('cacheControl')` を呼ぶため、実機では通信が始まる前に
 * `TypeError: body.has is not a function` で落ちていた（記録が1件も保存できない）。
 *
 * jest の実行環境の FormData は Node 側の実装で has() を持っているため、
 * `@services/supabase` をモックする通常のテストではこの回帰を検出できない。
 * ここでは
 *   1. global.FormData を RN のポリフィルに差し替え
 *   2. supabase-js の実物のクライアント（fetch だけモック）を通す
 * ことで、実機と同じコードパスを踏ませている。
 */
import { uploadStampImage } from '@services/stamps';

// react-native の内部モジュールで型定義が無い。
// 実機の FormData（has() を持たない）を再現するためだけに読み込む
// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
const RNFormData = require('react-native/Libraries/Network/FormData').default as new () => object;

type FetchMock = jest.Mock<Promise<unknown>, [string, Record<string, unknown>]>;

declare global {
  // eslint-disable-next-line no-var
  var __storageFetchMock: FetchMock;
}

jest.mock('@services/supabase', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
  const { createClient } = require('@supabase/supabase-js');
  return {
    supabase: createClient('https://example.supabase.co', 'anon-key', {
      global: {
        fetch: (...args: unknown[]) => global.__storageFetchMock(...(args as [never, never])),
      },
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    }),
  };
});

describe('uploadStampImage（実機の FormData 環境）', () => {
  const originalFormData = global.FormData;
  let fetchMock: FetchMock;

  beforeAll(() => {
    // 実機の FormData には has() が無い。これがこのテストの肝
    (global as unknown as { FormData: unknown }).FormData = RNFormData;
  });

  afterAll(() => {
    (global as unknown as { FormData: unknown }).FormData = originalFormData;
  });

  beforeEach(() => {
    fetchMock = jest.fn(async () => ({
      ok: true,
      status: 200,
      statusText: 'OK',
      headers: new Map(),
      json: async () => ({ Id: 'obj-1', Key: 'goshuin-images/user-1/1-abc.jpg' }),
      text: async () => '',
    })) as unknown as FetchMock;
    global.__storageFetchMock = fetchMock;
  });

  it('has() を持たない FormData 環境でも送信まで到達する', async () => {
    const path = await uploadStampImage('user-1', 'file:///photo.jpg');

    expect(path).toMatch(/^user-1\/\d+-[a-z0-9]+\.jpg$/);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('FormData ではなくバイト列を送る', async () => {
    await uploadStampImage('user-1', 'file:///photo.jpg');

    const [, init] = fetchMock.mock.calls[0];
    expect(init.body).toBeInstanceOf(Uint8Array);
    expect(init.body).not.toBeInstanceOf(RNFormData);
  });

  it('バケットの allowed_mime_types に通る content-type を付ける', async () => {
    await uploadStampImage('user-1', 'file:///photo.jpg');

    const [url, init] = fetchMock.mock.calls[0];
    // supabase-js は headers を Headers インスタンスに正規化する
    const headers = init.headers as Headers;

    expect(url).toContain('/storage/v1/object/goshuin-images/user-1/');
    expect(headers.get('content-type')).toBe('image/jpeg');
  });
});
