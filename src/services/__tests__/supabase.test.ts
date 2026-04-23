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

describe('Supabase client', () => {
  beforeEach(() => {
    jest.resetModules();
    mockCreateClient.mockClear();
    process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';
  });

  it('should export a supabase client', () => {
    const { supabase } = require('../supabase');
    expect(supabase).toBeDefined();
  });

  it('should call createClient with correct URL and key', () => {
    require('../supabase');
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

  it('should call createClient exactly once (singleton)', () => {
    require('../supabase');
    require('../supabase');
    expect(mockCreateClient).toHaveBeenCalledTimes(1);
  });

  it('should throw when EXPO_PUBLIC_SUPABASE_URL is empty', () => {
    process.env.EXPO_PUBLIC_SUPABASE_URL = '';
    expect(() => require('../supabase')).toThrow('EXPO_PUBLIC_SUPABASE_URL is not set');
  });

  it('should throw when EXPO_PUBLIC_SUPABASE_ANON_KEY is empty', () => {
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = '';
    expect(() => require('../supabase')).toThrow('EXPO_PUBLIC_SUPABASE_ANON_KEY is not set');
  });
});
