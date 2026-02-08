import 'react-native-url-polyfill/auto';

import { createClient } from '@supabase/supabase-js';

// babel-preset-expo は process.env.EXPO_PUBLIC_* をビルド時にインライン化する。
// テスト環境では process.env から直接取得するためヘルパーを使用。
const env = process.env;
const supabaseUrl = env['EXPO_PUBLIC_SUPABASE_URL'];
const supabaseAnonKey = env['EXPO_PUBLIC_SUPABASE_ANON_KEY'];

if (!supabaseUrl) {
  throw new Error('EXPO_PUBLIC_SUPABASE_URL is not set');
}

if (!supabaseAnonKey) {
  throw new Error('EXPO_PUBLIC_SUPABASE_ANON_KEY is not set');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: globalThis.localStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
