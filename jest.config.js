/**
 * テストは JST で走らせる（Issue #204）。
 *
 * 訪問日のずれのように「端末が UTC より進んでいる」ときだけ出る不具合は、
 * CI（UTC）では再現せずテストが素通りしてしまう。利用者の端末と同じ
 * タイムゾーンで見るために、ここで固定する。
 *
 * ⚠️ テストファイルの中で `process.env.TZ` を書き換えても Linux では効かない
 *    （Node が起動時に読んだものを使うため）。worker が fork される前の
 *    ここで入れておくと、worker は起動時から JST になる
 */
process.env.TZ = 'Asia/Tokyo';

module.exports = {
  preset: 'jest-expo',
  testEnvironment: 'node',
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@react-native-async-storage/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg|@supabase/.*|react-native-url-polyfill)',
  ],
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@components/(.*)$': '<rootDir>/src/components/$1',
    '^@screens/(.*)$': '<rootDir>/src/screens/$1',
    '^@hooks/(.*)$': '<rootDir>/src/hooks/$1',
    '^@services/(.*)$': '<rootDir>/src/services/$1',
    '^@types/(.*)$': '<rootDir>/src/types/$1',
    '^@utils/(.*)$': '<rootDir>/src/utils/$1',
    '^@theme/(.*)$': '<rootDir>/src/theme/$1',
  },
  collectCoverageFrom: ['src/**/*.{ts,tsx}', '!src/**/*.d.ts', '!src/**/__tests__/**'],
  testMatch: ['**/__tests__/**/*.test.{ts,tsx}', '**/*.test.{ts,tsx}'],
};
