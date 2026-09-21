/* eslint-disable @typescript-eslint/no-var-requires */
const mockCreateClient = jest.fn(() => ({
  auth: {},
  from: jest.fn(),
  storage: {},
}));

jest.mock('@supabase/supabase-js', () => ({
  createClient: mockCreateClient,
}));

jest.mock('react-native-url-polyfill/auto', () => {});

const mockAsyncStorage = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
};
jest.mock('@react-native-async-storage/async-storage', () => mockAsyncStorage);

/*
 * ⚠️ `jest.resetModules()` を素で呼ぶと、**このファイルが終わったあとも**
 * そのワーカーのモジュール登録が壊れたままになる。
 *
 * 別のテストが残したアニメーションのタイマーがその状態で発火すると、
 * react-native の Easing が中で遅延 require している bezier が undefined に
 * なり、`_bezier is not a function` で**毎回ちがうテスト**が落ちる。
 * 原因のファイルと落ちるファイルが一致しないので、非常に追いにくい。
 *
 * このファイルは「環境変数を変えて読み直す」ために登録をいじりたいだけなので、
 * `jest.isolateModules()` でこのファイルの中に閉じ込める。
 */
const loadSupabase = () => {
  let mod: typeof import('../supabase') | undefined;
  jest.isolateModules(() => {
    mod = require('../supabase');
  });
  return mod!;
};

describe('Supabase client', () => {
  beforeEach(() => {
    mockCreateClient.mockClear();
    process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';
  });

  it('should export a supabase client', () => {
    expect(loadSupabase().supabase).toBeDefined();
  });

  it('should call createClient with correct URL and key', () => {
    loadSupabase();
    expect(mockCreateClient).toHaveBeenCalledWith(
      'https://test.supabase.co',
      'test-anon-key',
      expect.objectContaining({
        auth: expect.objectContaining({
          storage: mockAsyncStorage,
          autoRefreshToken: true,
          persistSession: true,
          detectSessionInUrl: false,
        }),
      })
    );
  });

  // 同じ登録の中では1度しか作らない（シングルトン）
  it('should call createClient exactly once (singleton)', () => {
    jest.isolateModules(() => {
      require('../supabase');
      require('../supabase');
    });
    expect(mockCreateClient).toHaveBeenCalledTimes(1);
  });

  it('should throw when EXPO_PUBLIC_SUPABASE_URL is empty', () => {
    process.env.EXPO_PUBLIC_SUPABASE_URL = '';
    expect(loadSupabase).toThrow('EXPO_PUBLIC_SUPABASE_URL is not set');
  });

  it('should throw when EXPO_PUBLIC_SUPABASE_ANON_KEY is empty', () => {
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = '';
    expect(loadSupabase).toThrow('EXPO_PUBLIC_SUPABASE_ANON_KEY is not set');
  });
});
