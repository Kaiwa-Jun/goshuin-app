// Jest setup file
// Add any global test setup here

// localStorage mock for Supabase session persistence
const localStorageMock = (() => {
  let store = {};
  return {
    getItem: key => store[key] ?? null,
    setItem: (key, value) => {
      store[key] = String(value);
    },
    removeItem: key => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();

Object.defineProperty(global, 'localStorage', {
  value: localStorageMock,
});

// Silence console during tests (optional)
// global.console = {
//   ...console,
//   log: jest.fn(),
//   debug: jest.fn(),
//   info: jest.fn(),
// };
